<script
  setup
  lang="ts"
  generic="D extends object, F extends object, R extends object, I, E = never"
>
import { computed, onBeforeUnmount, ref, shallowRef, watch, toRaw } from "vue";
import { VAlert, VProgressLinear } from "vuetify/components";
import type {
  CrudDefinition,
  CrudAction,
  Page,
  Attempt,
  AnyField,
  FieldKey,
} from "./contracts";
import type { ConfigurationBlock } from "./configuration";
import DynamicForm from "./DynamicForm.vue";
import DataList from "./DataList.vue";
import { clone, message } from "./clone";
import { validate } from "./validation";
import { writeLock } from "./write-lock";
const props = defineProps<{
  definition: CrudDefinition<D, F, R, I, E>;
  scope: string;
  blocks?: readonly ConfigurationBlock<D>[];
  beforeClose?: () => Promise<boolean>;
  permissions: {
    query: boolean;
    create: boolean;
    write: boolean;
    reconcile?: boolean;
  };
}>();
const emit = defineEmits<{
  protection: [state: { dirty: boolean; pending: boolean }];
  queried: [filters: F];
}>();
const filters = shallowRef<F>(props.definition.initialFilters()),
  applied = shallowRef<F>(clone(filters.value)),
  result = shallowRef<Page<R>>({ items: [], total: 0 }),
  page = ref(1),
  loading = ref(false),
  error = ref(""),
  notice = ref("");
const editor = shallowRef<{
    values: D;
    readOnly?: boolean;
    identity?: I;
    row?: R;
    readonlyFields?: readonly FieldKey<D>[];
  } | null>(null),
  formPending = ref(false),
  detailLoading = ref(false),
  confirming = shallowRef<{
    row: R;
    action: Exclude<CrudAction, "edit" | "view">;
  } | null>(null),
  verifying = ref(false);
const readonlyFields = shallowRef<readonly FieldKey<D>[]>([]);
const editFields = computed(
  () =>
    props.definition.fields
      .filter(
        (field) => !props.blocks?.some((block) => block.key === field.key),
      )
      .map((field) => ({
        ...field,
        readonly:
          field.readonly ||
          readonlyFields.value.some((key) => key === field.key),
      })) as unknown as typeof props.definition.fields,
);
const moreFilters = ref(false);
const shownFilters = computed(() =>
  moreFilters.value
    ? props.definition.filters
    : (props.definition.filters.slice(
        0,
        1,
      ) as unknown as typeof props.definition.filters),
);
const lock = computed(() =>
  writeLock<D, I>(
    props.definition.adapter,
    props.definition.resource,
    props.scope,
  ),
);
const blocked = computed(() => lock.value.phase !== "idle");
watch(
  () => [editor.value, lock.value.phase] as const,
  () =>
    emit("protection", {
      dirty: !!editor.value && !editor.value.readOnly,
      pending: blocked.value,
    }),
  { immediate: true, flush: "sync" },
);
let version = 0,
  queryVersion = 0,
  editVersion = 0,
  active = true;
const current = (v: number) => active && v === version;
const blockPending = ref<Record<string, boolean>>({});
const bindings = computed(() => {
  const v = version,
    e = editVersion;
  const live = () => current(v) && e === editVersion && !!editor.value;
  const editable = () =>
    live() &&
    !blocked.value &&
    props.permissions.write &&
    !editor.value?.readOnly;
  return (
    props.blocks?.map((block) => ({
      key: block.key,
      component: toRaw(block.component),
      props: {
        modelValue: clone(editor.value?.values[block.key]),
        catalog: clone(block.catalog),
        mode: editor.value?.readOnly ? ("read" as const) : ("edit" as const),
        disabled: !editable(),
        "onUpdate:modelValue": (value: D[typeof block.key]) => {
          if (editable())
            editor.value = {
              ...editor.value!,
              values: { ...editor.value!.values, [block.key]: clone(value) },
            };
        },
        onPending: (value: boolean) => {
          if (live())
            blockPending.value = { ...blockPending.value, [block.key]: value };
        },
      },
    })) ?? []
  );
});
async function query(next = 1, submit = false) {
  if (!props.permissions.query) return;
  if (submit) {
    const invalid = validate(
      props.definition.filters as readonly AnyField[],
      filters.value,
      "create",
    );
    if (invalid) {
      error.value = invalid;
      return;
    }
    applied.value = clone(filters.value);
  }
  const v = version,
    q = ++queryVersion,
    target = lock.value,
    refreshing = target.phase === "refresh",
    refreshAttempt = target.attempt;
  loading.value = true;
  error.value = "";
  try {
    const value = await props.definition.adapter.query({
      scope: props.scope,
      filters: clone(applied.value),
      page: next,
      pageSize: 20,
    });
    if (!current(v) || q !== queryVersion) return;
    result.value = clone(value);
    page.value = next;
    emit("queried", clone(applied.value));
    if (
      refreshing &&
      target.phase === "refresh" &&
      target.attempt === refreshAttempt
    ) {
      target.phase = "idle";
      target.attempt = null;
    }
  } catch (e) {
    if (current(v) && q === queryVersion) error.value = message(e);
  } finally {
    if (current(v) && q === queryVersion) loading.value = false;
  }
}
async function begin(row?: R, readOnly = false) {
  if (
    blocked.value ||
    detailLoading.value ||
    editor.value ||
    (readOnly ? !props.permissions.query : !props.permissions.write) ||
    (row
      ? !props.definition.actions(row).includes(readOnly ? "view" : "edit")
      : !props.permissions.create)
  )
    return;
  const v = version,
    e = ++editVersion;
  error.value = "";
  formPending.value = false;
  blockPending.value = {};
  readonlyFields.value = [];
  if (!row) {
    editor.value = {
      values: clone(
        props.definition.adapter.empty({
          scope: props.scope,
          filters: clone(applied.value),
        }),
      ),
    };
    return;
  }
  detailLoading.value = true;
  try {
    const identity = clone(props.definition.identity(row)),
      detail = await props.definition.adapter.get({
        scope: props.scope,
        identity,
      });
    if (current(v) && e === editVersion) {
      readonlyFields.value = detail.readonlyFields ?? [];
      editor.value = {
        values: clone(detail.values),
        identity: clone(detail.identity),
        row,
        readOnly: readOnly || detail.writable === false,
        readonlyFields: detail.readonlyFields,
      };
    }
  } catch (e) {
    if (current(v)) error.value = message(e);
  } finally {
    if (current(v) && e === editVersion) detailLoading.value = false;
  }
}
async function editViewed() {
  const row = editor.value?.row;
  if (!row) return;
  await cancel();
  if (!editor.value) await begin(row);
}
async function cancel() {
  if (lock.value.phase === "pending") return;
  const v = version,
    e = editVersion;
  if (props.beforeClose && !(await props.beforeClose())) return;
  if (!current(v) || e !== editVersion) return;
  editor.value = null;
  formPending.value = false;
  blockPending.value = {};
  editVersion++;
}
async function write(operation: Attempt<D, I>["operation"], row?: R) {
  if (
    blocked.value ||
    formPending.value ||
    Object.values(blockPending.value).some(Boolean) ||
    !props.permissions.write ||
    editor.value?.readOnly
  )
    return;
  if (operation === "create" && !props.permissions.create) return;
  if (
    row &&
    !props.definition
      .actions(row)
      .includes(operation === "save" ? "edit" : (operation as CrudAction))
  )
    return;
  const definition = props.definition,
    target = lock.value,
    v = version;
  const input =
    operation === "save" || operation === "create"
      ? clone(editor.value?.values)
      : undefined;
  if (input) {
    const invalid = validate(
      definition.fields as readonly AnyField[],
      input,
      operation === "create" ? "create" : "edit",
    );
    if (invalid) {
      error.value = invalid;
      return;
    }
  }
  const identity =
    operation === "save"
      ? clone(editor.value?.identity)
      : row
        ? clone(definition.identity(row))
        : undefined;
  const attempt: Attempt<D, I> = Object.freeze({
    id: crypto.randomUUID(),
    scope: props.scope,
    resource: definition.resource,
    operation,
    input,
    identity,
  });
  const execute =
    operation === "create"
      ? definition.adapter.create
      : operation === "save"
        ? definition.adapter.save
        : operation === "delete"
          ? definition.adapter.delete
          : definition.adapter.setEnabled;
  if (!execute) return;
  target.phase = "pending";
  target.attempt = attempt;
  error.value = "";
  notice.value = "";
  confirming.value = null;
  try {
    const outcome = await execute.call(definition.adapter, clone(attempt));
    if (outcome.status === "success") {
      target.phase = "refresh";
      if (current(v)) {
        editor.value = null;
        notice.value = "写入成功。";
        await query(page.value);
      }
    } else if (outcome.status === "failure") {
      target.phase = "idle";
      target.attempt = null;
      if (current(v)) error.value = outcome.message;
    } else {
      target.phase = "unknown";
      if (current(v))
        error.value = outcome.message ?? "写入结果未知，保持锁定。";
    }
  } catch {
    target.phase = "unknown";
    if (current(v)) error.value = "写入结果未知，保持锁定。";
  }
}
async function reconcile() {
  const target = lock.value,
    attempt = target.attempt,
    reconcile = props.definition.reconcile,
    v = version;
  if (
    !attempt ||
    target.phase !== "unknown" ||
    !reconcile ||
    !props.permissions.reconcile ||
    verifying.value
  )
    return;
  verifying.value = true;
  try {
    const outcome = await reconcile(clone(attempt));
    if (
      outcome.status !== "unknown" &&
      outcome.attemptId === attempt.id &&
      outcome.evidence !== undefined &&
      outcome.evidence !== null &&
      target.attempt === attempt &&
      target.phase === "unknown"
    ) {
      if (outcome.status === "applied") {
        target.phase = "refresh";
        if (current(v)) {
          editor.value = null;
          await query(page.value);
        }
      } else {
        target.phase = "idle";
        target.attempt = null;
      }
    } else if (current(v)) notice.value = "证据不足，结果仍未知。";
  } catch (e) {
    if (current(v)) error.value = message(e);
  } finally {
    if (current(v)) verifying.value = false;
  }
}
function actions(row: R) {
  return props.permissions.query
    ? props.definition
        .actions(row)
        .filter((a) => a === "view" || props.permissions.write)
        .filter((a) => a !== "delete" || props.definition.adapter.delete)
        .filter(
          (a) =>
            (a !== "enable" && a !== "disable") ||
            props.definition.adapter.setEnabled,
        )
    : [];
}
const captions = {
  view: "查看",
  edit: "编辑",
  enable: "启用",
  disable: "停用",
  delete: "删除",
} as const;
watch(
  [() => props.scope, () => props.definition, () => props.permissions.query],
  () => {
    version++;
    queryVersion++;
    editVersion++;
    filters.value = props.definition.initialFilters();
    applied.value = clone(filters.value);
    result.value = { items: [], total: 0 };
    editor.value = null;
    confirming.value = null;
    page.value = 1;
    loading.value = false;
    detailLoading.value = false;
    formPending.value = false;
    blockPending.value = {};
    verifying.value = false;
    error.value = "";
    notice.value = "";
    void query();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  active = false;
  version++;
  queryVersion++;
  editVersion++;
});
defineExpose({ openRow: (row: R, readOnly = true) => begin(row, readOnly) });
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <form v-if="permissions.query" @submit.prevent="query(1, true)">
      <DynamicForm
        :fields="shownFilters"
        v-model="filters"
        :scope="scope"
      /><button
        v-if="definition.filters.length > 1"
        type="button"
        @click="moreFilters = !moreFilters"
      >
        {{ moreFilters ? "收起条件" : "更多条件" }}</button
      ><button type="submit" :disabled="loading">查询</button>
    </form>
    <VProgressLinear
      v-if="loading || detailLoading"
      indeterminate
      aria-label="加载中"
    />
    <VAlert v-if="error" type="error" role="alert"
      >{{ error
      }}<button v-if="permissions.query" type="button" @click="query(page)">
        重试读取
      </button></VAlert
    >
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="lock.phase === 'unknown'" role="status">
      写入结果未知。普通查询或关闭编辑不能解除锁定。<button
        v-if="definition.reconcile && permissions.reconcile"
        type="button"
        :disabled="verifying"
        @click="reconcile"
      >
        核实本次请求
      </button>
    </p>
    <p v-if="lock.phase === 'refresh'" role="status">
      写入已成功，请重试读取；不会再次提交。
    </p>
    <button
      v-if="permissions.create && permissions.write"
      aria-label="新增"
      type="button"
      :disabled="blocked || !!editor || detailLoading"
      @click="begin()"
    >
      <span class="zerp-ui-icon" aria-hidden="true">&#xf0415;</span>新增
    </button>
    <DataList
      :columns="definition.columns"
      :cell="
        (row, key) =>
          key === definition.columns[0]?.key &&
          definition.viewLabel &&
          definition.actions(row).includes('view')
            ? {
                kind: 'detail',
                target: 'record',
                label: definition.viewLabel(row),
              }
            : undefined
      "
      @cell="(_cell, row) => begin(row, true)"
      :result="result"
      :page="page"
      :page-size="20"
      :loading="loading"
      :actions="actions"
      :disabled="blocked || !!editor || detailLoading"
      @page="query($event)"
      @action="
        (action, row) =>
          action === 'edit'
            ? begin(row)
            : action === 'view'
              ? begin(row, true)
              : (confirming = { row, action })
      "
    />
    <section v-if="confirming" role="dialog" aria-label="确认操作">
      <p>确认{{ captions[confirming.action] }}？</p>
      <button type="button" @click="confirming = null">取消操作</button
      ><button
        type="button"
        :disabled="blocked"
        @click="write(confirming.action, confirming.row)"
      >
        确认{{ captions[confirming.action] }}
      </button>
    </section>
    <section v-if="editor" role="dialog" aria-label="编辑资料">
      <button
        v-if="
          editor.readOnly &&
          editor.row &&
          permissions.write &&
          definition.actions(editor.row).includes('edit')
        "
        type="button"
        :disabled="blocked"
        @click="editViewed"
      >
        编辑
      </button>
      <DynamicForm
        :fields="editFields"
        :model-value="editor.values"
        :scope="scope"
        :disabled="blocked || !permissions.write || editor.readOnly"
        :mode="editor.row ? 'edit' : 'create'"
        @update:model-value="editor = { ...editor!, values: $event }"
        @pending="formPending = $event"
      />
      <component
        v-for="block in bindings"
        :is="block.component"
        :key="block.key + editVersion"
        v-bind="block.props"
      />
      <button
        type="button"
        :disabled="lock.phase === 'pending'"
        @click="cancel"
      >
        取消编辑</button
      ><button
        type="button"
        v-if="!editor.readOnly"
        :disabled="
          blocked ||
          formPending ||
          Object.values(blockPending).some(Boolean) ||
          !permissions.write
        "
        @click="write(editor.row ? 'save' : 'create', editor.row)"
      >
        保存
      </button>
    </section>
  </section>
</template>
