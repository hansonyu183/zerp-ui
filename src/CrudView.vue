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
} from "./contracts";
import type { ConfigurationBlock } from "./configuration";
import DynamicForm from "./DynamicForm.vue";
import EditGuard from "./EditGuard.vue";
import type { EditGuardHandle } from "./edit-guard";
import DataList from "./DataList.vue";
import { clone, message } from "./clone";
import { validate } from "./validation";
import { writeLock } from "./write-lock";
const props = defineProps<{
  definition: CrudDefinition<D, F, R, I, E>;
  scope: string;
  blocks?: readonly ConfigurationBlock<D>[];
  permissions: {
    query: boolean;
    create: boolean;
    write: boolean;
    reconcile?: boolean;
  };
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
    identity?: I;
    row?: R;
    readonlyFields?: readonly Extract<keyof D, string>[];
    readonly?: boolean;
  } | null>(null),
  formPending = ref(false),
  blockPending = ref<Record<string, boolean>>({}),
  detailLoading = ref(false),
  confirming = shallowRef<{
    row: R;
    action: Exclude<CrudAction, "edit" | "view">;
  } | null>(null),
  verifying = ref(false);
const guard = ref<EditGuardHandle>();
const baseline = shallowRef<D | null>(null);
const dirty = computed(
  () =>
    !!editor.value &&
    !editor.value.readonly &&
    JSON.stringify(editor.value.values) !== JSON.stringify(baseline.value),
);
const readonlyFields = shallowRef<readonly Extract<keyof D, string>[]>([]);
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
          editor.value?.readonly ||
          readonlyFields.value.some((key) => key === field.key),
      })) as unknown as typeof props.definition.fields,
);
const blocks = computed(() => {
  const v = version,
    e = editVersion;
  const live = () => current(v) && e === editVersion && !!editor.value;
  return (
    props.blocks?.map((block) => ({
      key: block.key,
      component: toRaw(block.component),
      props: {
        modelValue: clone(editor.value?.values[block.key]),
        catalog: clone(block.catalog),
        mode:
          blocked.value ||
          !props.permissions.write ||
          editor.value?.readonly ||
          readonlyFields.value.includes(block.key)
            ? ("read" as const)
            : ("edit" as const),
        disabled:
          blocked.value ||
          !props.permissions.write ||
          editor.value?.readonly ||
          readonlyFields.value.includes(block.key),
        "onUpdate:modelValue": (value: D[typeof block.key]) => {
          if (
            live() &&
            !blocked.value &&
            props.permissions.write &&
            !editor.value?.readonly &&
            !readonlyFields.value.includes(block.key)
          )
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
const pending = computed(
  () => formPending.value || Object.values(blockPending.value).some(Boolean),
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
let version = 0,
  queryVersion = 0,
  editVersion = 0,
  active = true;
const current = (v: number) => active && v === version;
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
async function begin(row?: R, readonly = false) {
  if (
    blocked.value ||
    detailLoading.value ||
    editor.value ||
    !props.permissions.query ||
    (!readonly && !props.permissions.write) ||
    (row
      ? !props.definition.actions(row).includes(readonly ? "view" : "edit")
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
    baseline.value = clone(editor.value.values);
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
        readonlyFields: detail.readonlyFields,
        readonly: readonly || detail.writable === false,
      };
      baseline.value = clone(editor.value.values);
    }
  } catch (e) {
    if (current(v)) error.value = message(e);
  } finally {
    if (current(v) && e === editVersion) detailLoading.value = false;
  }
}
async function requestLeave() {
  if (lock.value.phase === "pending" || lock.value.phase === "unknown")
    return false;
  if (!editor.value || editor.value.readonly || !props.permissions.query)
    return true;
  return guard.value?.requestLeave() ?? true;
}
defineExpose<EditGuardHandle>({ requestLeave });
async function cancel() {
  if (!(await requestLeave())) return;
  editor.value = null;
  formPending.value = false;
  blockPending.value = {};
  editVersion++;
}
async function write(operation: Attempt<D, I>["operation"], row?: R) {
  if (
    blocked.value ||
    pending.value ||
    !props.permissions.write ||
    editor.value?.readonly
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
      editFields.value as readonly AnyField[],
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
  return props.definition
    .actions(row)
    .filter((action) =>
      action === "view" ? props.permissions.query : props.permissions.write,
    )
    .filter((a) => a !== "delete" || props.definition.adapter.delete)
    .filter(
      (a) =>
        (a !== "enable" && a !== "disable") ||
        props.definition.adapter.setEnabled,
    );
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
      :result="result"
      :page="page"
      :page-size="20"
      :loading="loading"
      :actions="actions"
      :disabled="blocked || !!editor || detailLoading"
      @page="query($event)"
      @action="
        (action, row) =>
          action === 'view'
            ? begin(row, true)
            : action === 'edit'
              ? begin(row)
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
    <section
      v-if="editor"
      role="dialog"
      :aria-label="editor.readonly ? '查看资料' : '编辑资料'"
    >
      <DynamicForm
        :fields="editFields"
        :model-value="editor.values"
        :scope="scope"
        :disabled="blocked || !permissions.write || editor.readonly"
        :mode="editor.row ? 'edit' : 'create'"
        @update:model-value="editor = { ...editor!, values: $event }"
        @pending="formPending = $event"
      />
      <component
        v-for="block in blocks"
        :key="block.key"
        :is="block.component"
        v-bind="block.props"
      />
      <button
        type="button"
        :disabled="lock.phase === 'pending'"
        @click="cancel"
      >
        {{ editor.readonly ? "关闭详情" : "取消编辑" }}</button
      ><button
        type="button"
        v-if="!editor.readonly"
        :disabled="blocked || pending || !permissions.write"
        @click="write(editor.row ? 'save' : 'create', editor.row)"
      >
        保存
      </button>
    </section>
    <EditGuard
      ref="guard"
      :scope="scope"
      :instance="editVersion"
      :active="permissions.query && !!editor && !editor.readonly"
      :dirty="dirty"
      :write-state="
        lock.phase === 'pending'
          ? 'pending'
          : lock.phase === 'unknown'
            ? 'unknown'
            : 'idle'
      "
    />
  </section>
</template>
