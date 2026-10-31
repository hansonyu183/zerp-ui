<script
  setup
  lang="ts"
  generic="D extends object, F extends object, R extends object, I, E = never"
>
import DomainBlockHost from "./DomainBlockHost.vue";
import {validateDomainBlocks,type DomainBlock} from "./domain-blocks";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import Feedback from "./Feedback.vue";
import { VProgressLinear } from "vuetify/components";
import type {
  CrudDefinition,
  CrudAction,
  ListAction,
  Page,
  Attempt,
  AnyField,
  CrudViewHandle,
} from "./contracts";

import type { EditProtection, EditGuardHandle } from "./edit-guard";
import EditGuard from "./EditGuard.vue";
import FactFields from "./FactFields.vue";
import { formFacts } from "./details";
import DynamicForm from "./DynamicForm.vue";
import DataList from "./DataList.vue";
import { equalValues } from "./editor-values";
import { clone, message } from "./clone";
import { validate } from "./validation";
import { writeLock } from "./write-lock";
const props = defineProps<{
  definition: CrudDefinition<D, F, R, I, E>;
  scope: string;
  blocks?: readonly DomainBlock<D>[];
  beforeClose?: () => Promise<boolean>;
  discardVersion?: number;
  initialRow?: R;
  readOnly?: boolean;
  selectedKeys?: readonly (string | number)[];
  rowKey?: (row: R) => string | number;
  listActions?: (row: R) => readonly Exclude<ListAction, CrudAction>[];
  permissions: {
    query: boolean;
    create: boolean;
    write: boolean;
    reconcile?: boolean;
  };
}>();
const emit = defineEmits<{
  protection: [state: EditProtection];
  queried: [filters: F];
  "update:selectedKeys": [keys: (string | number)[]];
  listAction: [action: Exclude<ListAction, CrudAction>, row: R];
}>();
const guard = shallowRef<EditGuardHandle | null>(null);
const initial = shallowRef<D | null>(null);
const blockPending = ref<Record<string, boolean>>({});
const filterPending = ref(false);
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
    writable?: boolean;
    identity?: I;
    row?: R;
    readonlyFields?: readonly Extract<keyof D, string>[];
  } | null>(null),
  formPending = ref(false),
  detailLoading = ref(false),
  confirming = shallowRef<{
    row: R;
    action: Exclude<CrudAction, "edit" | "view">;
  } | null>(null),
  verifying = ref(false);
const readonlyFields = shallowRef<readonly Extract<keyof D, string>[]>([]);
const editFields = computed(
  () =>
    props.definition.fields
      .filter((f) => !props.blocks?.some((b) => b.key === f.key))
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
let version = 0,
  queryVersion = 0,
  editVersion = 0,
  active = true;
const current = (v: number) => active && v === version;
async function query(next = 1, submit = false) {
  if (!props.permissions.query) return;
  if (submit) {
    if (filterPending.value) return;
    const invalid = validate(
      props.definition.filters as readonly AnyField[],
      filters.value,
      "create",
    );
    if (invalid) {
      error.value = invalid;
      return;
    }
  }
  const requested = clone(submit ? filters.value : applied.value);
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
      filters: clone(requested),
      page: next,
      pageSize: 20,
    });
    if (!current(v) || q !== queryVersion) return;
    result.value = clone(value);
    applied.value = clone(requested);
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
    !props.permissions.query ||
    (!readOnly && !props.permissions.write) ||
    (row
      ? !props.definition.actions(row).includes(readOnly ? "view" : "edit")
      : !props.permissions.create)
  )
    return false;
  const v = version,
    e = ++editVersion;
  error.value = "";
  formPending.value = false;
  readonlyFields.value = [];
  blockPending.value = {};
  if (!row) {
    editor.value = {
      values: clone(
        props.definition.adapter.empty({
          scope: props.scope,
          filters: clone(applied.value),
        }),
      ),
    };
    initial.value = clone(editor.value.values);
    return true;
  }
  detailLoading.value = true;
  try {
    const identity = clone(props.definition.identity(row)),
      detail = await props.definition.adapter.get({
        scope: props.scope,
        identity,
      });
    if (current(v) && e === editVersion) {
      initial.value = clone(detail.values);
      readonlyFields.value = detail.readonlyFields ?? [];
      editor.value = {
        values: clone(detail.values),
        readOnly: readOnly || detail.writable === false,
        writable: detail.writable !== false,
        identity: clone(detail.identity),
        row,
        readonlyFields: detail.readonlyFields,
      };
      return true;
    }
  } catch (e) {
    if (current(v)) error.value = message(e);
  } finally {
    if (current(v) && e === editVersion) detailLoading.value = false;
  }
}
async function cancel(): Promise<boolean> {
  const v = version,
    e = editVersion;
  if (blocked.value) return false;
  if (
    editor.value &&
    !(await (props.beforeClose
      ? props.beforeClose()
      : guard.value?.requestLeave()))
  )
    return false;
  if (!current(v) || e !== editVersion || blocked.value) return false;
  editor.value = null;
  initial.value = null;
  formPending.value = false;
  blockPending.value = {};
  editVersion++;
  return true;
}
async function openRow(row: R, readOnly = true): Promise<boolean> {
  const v = version,
    e = editVersion,
    requestedRow = clone(row);
  if (
    blocked.value ||
    detailLoading.value ||
    !props.permissions.query ||
    (!readOnly && !props.permissions.write) ||
    !props.definition.actions(requestedRow).includes(readOnly ? "view" : "edit")
  )
    return false;
  if (editor.value) {
    if (!(await cancel()) || !current(v) || editVersion !== e + 1) return false;
  }
  return (await begin(requestedRow, readOnly)) === true;
}
const localPending = computed(
  () => formPending.value || Object.values(blockPending.value).some(Boolean),
);
const protection = computed<EditProtection>(() => ({
  dirty:
    !!editor.value &&
    !editor.value.readOnly &&
    !equalValues(editor.value.values, initial.value),
  localPending: localPending.value,
  invalid:
    !!editor.value &&
    !editor.value.readOnly &&
    !!(validate(
      editFields.value as readonly AnyField[],
      editor.value.values,
      editor.value.row ? "edit" : "create",
    ) ?? validateDomainBlocks(props.blocks,editor.value.values,editor.value.row ? "edit":"create")),
  writeState: lock.value.phase,
}));
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
const bindings = computed(() => {
  const v = version,
    e = editVersion;
  const hasEditor = !!editor.value;
  const live = () =>
    hasEditor && current(v) && e === editVersion && !!editor.value;
  const editable = () =>
    live() &&
    !blocked.value &&
    props.permissions.write &&
    !editor.value?.readOnly;
  return {
    form: (values: D) => {
      if (editable())
        editor.value = { ...editor.value!, values: clone(values) };
    },
    pending: (value: boolean) => {
      if (live()) formPending.value = value;
    },
    blocks:
      props.blocks?.map((block) => {
        const allowed = () =>
          editable() && !readonlyFields.value.includes(block.key);
        return {
          key: block.key,
          block,
          props: {
            modelValue: clone(editor.value!.values),
            scope: props.scope,
            mode:
              editor.value?.readOnly || readonlyFields.value.includes(block.key)
                ? ("read" as const)
                : ("edit" as const),
            disabled: !allowed(),
            "onUpdate:modelValue": (value: D) => {
              if (allowed())
                editor.value = {
                  ...editor.value!,
                  values: clone(value),
                };
            },
            onPending: (value: boolean) => {
              if (live())
                blockPending.value = {
                  ...blockPending.value,
                  [block.key]: value,
                };
            },
          },
        };
      }) ?? [],
  };
});
async function write(operation: Attempt<D, I>["operation"], row?: R) {
  if (
    blocked.value ||
    localPending.value ||
    !props.permissions.query ||
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
      editFields.value as readonly AnyField[],
      input,
      operation === "create" ? "create" : "edit",
    ) ?? validateDomainBlocks(props.blocks,input,operation === "create" ? "create":"edit");
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
  queryVersion++;
  loading.value = false;
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
function actions(row: R): readonly ListAction[] {
  if (!props.permissions.query) return [];
  const crud = props.definition
    .actions(row)
    .filter((action) => action === "view" || props.permissions.write)
    .filter((action) => action !== "delete" || props.definition.adapter.delete)
    .filter(
      (action) =>
        (action !== "enable" && action !== "disable") ||
        props.definition.adapter.setEnabled,
    );
  return [...crud, ...(props.listActions?.(row) ?? [])];
}
function listAction(action: ListAction, row: R) {
  if (
    blocked.value ||
    editor.value ||
    detailLoading.value ||
    !result.value.items.includes(row) ||
    !actions(row).includes(action)
  )
    return;
  if (action === "view" || action === "edit") {
    void openRow(row, action === "view");
  } else if (
    action === "enable" ||
    action === "disable" ||
    action === "delete"
  ) {
    confirming.value = { row, action };
  } else {
    emit("listAction", action, row);
  }
}
function selectRows(keys: (string | number)[]) {
  if (
    !props.permissions.query ||
    blocked.value ||
    editor.value ||
    detailLoading.value
  )
    return;
  emit("update:selectedKeys", keys);
}
const captions = {
  view: "查看",
  edit: "编辑",
  enable: "启用",
  disable: "停用",
  delete: "删除",
} as const;
watch(
  () => [
    props.scope,
    props.definition,
    props.permissions.query,
    props.permissions.write,
    props.permissions.create,
  ],
  () => {
    version++;
    queryVersion++;
    editVersion++;
    filters.value = props.definition.initialFilters();
    filterPending.value = false;
    applied.value = clone(filters.value);
    result.value = { items: [], total: 0 };
    editor.value = null;
    initial.value = null;
    blockPending.value = {};
    confirming.value = null;
    page.value = 1;
    loading.value = false;
    detailLoading.value = false;
    formPending.value = false;
    verifying.value = false;
    error.value = "";
    notice.value = "";
    void query();
  },
  { immediate: true, flush: "sync" },
);
watch(()=>props.discardVersion,()=>{if(lock.value.phase==='idle'){editor.value=null;initial.value=null;formPending.value=false;blockPending.value={};editVersion++;}});
watch(()=>props.initialRow,row=>{if(row)void openRow(row,props.readOnly??true);},{immediate:true});
onBeforeUnmount(() => {
  active = false;
  editor.value = null;
  initial.value = null;
  formPending.value = false;
  blockPending.value = {};
  version++;
  queryVersion++;
  editVersion++;
});
defineExpose<CrudViewHandle<R>>({ openRow, close: cancel });
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <EditGuard
      v-if="!beforeClose"
      ref="guard"
      :scope="scope"
      :instance="editVersion"
      :active="permissions.query"
      :dirty="protection.dirty"
      :local-pending="protection.localPending"
      :write-state="protection.writeState"
    />

    <form v-if="permissions.query" @submit.prevent="query(1, true)">
      <DynamicForm
        :key="version"
        :fields="shownFilters"
        v-model="filters"
        :scope="scope"
        @pending="filterPending = $event"
      /><button
        v-if="definition.filters.length > 1"
        type="button"
        :disabled="filterPending"
        @click="moreFilters = !moreFilters"
      >
        {{ moreFilters ? "收起条件" : "更多条件" }}</button
      ><button type="submit" :disabled="loading || filterPending">查询</button>
    </form>
    <div class="zerp-progress-reserve">
      <VProgressLinear
        v-if="loading || detailLoading"
        indeterminate
        aria-label="加载中"
      />
    </div>
    <div class="zerp-feedback-region">
      <Feedback :message="error" kind="error"
        ><button v-if="permissions.query" type="button" @click="query(page)">
          重试读取
        </button></Feedback
      >
      <Feedback :message="notice" />
      <Feedback
        :message="lock.phase === 'unknown' ? '请求结果未知' : undefined"
        kind="warning"
        persistent
      >
        写入结果未知。普通查询或关闭编辑不能解除锁定。<button
          v-if="definition.reconcile && permissions.reconcile"
          type="button"
          :disabled="verifying"
          @click="reconcile"
        >
          核实本次请求
        </button>
      </Feedback>
      <Feedback
        :message="lock.phase === 'refresh' ? '等待读取权威结果' : undefined"
        kind="warning"
        persistent
      >
        写入已成功，请重试读取；不会再次提交。
      </Feedback>
    </div>
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
          permissions.query &&
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
      @cell="(_cell, row) => openRow(row, true)"
      :result="result"
      :page="page"
      :page-size="20"
      :loading="loading"
      :actions="actions"
      :row-key="rowKey"
      :selected-keys="selectedKeys"
      @update:selected-keys="selectRows"
      :disabled="blocked || !!editor || detailLoading"
      @page="query($event)"
      @action="listAction"
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
      :key="editVersion"
      role="dialog"
      :aria-label="
        editor.readOnly ? (definition.viewTitle ?? '查看资料') : '编辑资料'
      "
    >
      <FactFields
        v-if="editor.readOnly"
        :value="editor.values"
        :fields="formFacts(editFields as readonly AnyField[])"
      />
      <DynamicForm
        v-else
        :fields="editFields"
        :model-value="editor.values"
        :scope="scope"
        :disabled="blocked || !permissions.write"
        :mode="editor.row ? 'edit' : 'create'"
        :onUpdate:modelValue="bindings.form"
        :onPending="bindings.pending"
      />
      <DomainBlockHost
        v-for="block in bindings.blocks"
        :block="block.block"
        :key="block.key"
        v-bind="block.props"
      />
      <button
        v-if="
          editor.readOnly &&
          editor.writable &&
          editor.row &&
          permissions.write &&
          definition.actions(editor.row).includes('edit')
        "
        type="button"
        :disabled="blocked"
        @click="openRow(editor.row, false)"
      >
        编辑
      </button>
      <button type="button" :disabled="blocked" @click="cancel">取消编辑</button
      ><button
        type="button"
        v-if="!editor.readOnly"
        :disabled="blocked || localPending || !permissions.write"
        @click="write(editor.row ? 'save' : 'create', editor.row)"
      >
        保存
      </button>
    </section>
  </section>
</template>
