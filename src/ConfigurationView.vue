<script
  setup
  lang="ts"
  generic="D extends object, F extends object, R extends object, I, E = never"
>
import DomainBlockHost from "./DomainBlockHost.vue";
import { validateDomainBlocks, type DomainBlock } from "./domain-blocks";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import Feedback from "./Feedback.vue";
import { VProgressLinear } from "vuetify/components";
import type { AnyField, Page } from "./contracts";
import type {
  ConfigurationDefinition,
  ConfigurationAttempt,
  ConfigurationViewHandle,
  ConfigurationDraft,
} from "./configuration";
import type { EditProtection, EditGuardHandle } from "./edit-guard";
import EditGuard from "./EditGuard.vue";
import FactFields from "./FactFields.vue";
import { formFacts } from "./details";
import DynamicForm from "./DynamicForm.vue";
import DataList from "./DataList.vue";
import { equalValues, freezeValues } from "./editor-values";
import { clone, message } from "./clone";
import { validate } from "./validation";
import { writeLock } from "./write-lock";
import { writeRecovery } from "./write-recovery";
import DraftCollaborationView from "./DraftCollaboration.vue";
const props = defineProps<{
  definition: ConfigurationDefinition<D, F, R, I, E>;
  scope: string;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly DomainBlock<D>[];
  beforeClose?: () => Promise<boolean>;
  discardVersion?: number;
  initialRow?: R;
  retainEditor?: boolean;
}>();
const emit = defineEmits<{
  protection: [state: EditProtection];
  draft: [value: ConfigurationDraft<D, I> | null];
  queried: [filters: F];
}>();
const guard = shallowRef<EditGuardHandle | null>(null);
const initial = shallowRef<D | null>(null);
const filterPending = ref(false);
const filters = shallowRef<F>(props.definition.initialFilters()),
  applied = shallowRef<F>(clone(filters.value));
const result = shallowRef<Page<R>>({ items: [], total: 0 }),
  page = ref(1),
  loading = ref(false),
  error = ref(""),
  notice = ref("");
const editor = shallowRef<{
  values: D;
  identity?: I;
  writable: boolean;
  creating: boolean;
} | null>(null);
const detailLoading = ref(false),
  verifying = ref(false),
  pending = ref<Record<string, boolean>>({});
const lock = computed(() =>
  writeLock<
    D,
    I,
    ConfigurationAttempt<D, I>,
    { retain: boolean; identity?: I }
  >(
    props.definition.adapter,
    `configuration:${props.definition.resource}`,
    props.scope,
  ),
);
const recovery = () =>
  writeRecovery(lock.value, props.definition.persistence, {
    scope: props.scope,
    resource: props.definition.resource,
  });
async function restoreWrite() {
  const recover = recovery();
  try {
    await recover.restore();
  } catch (cause) {
    error.value = message(cause);
  }
}
const blocked = computed(() => lock.value.phase !== "idle");
const disabled = computed(
  () =>
    blocked.value ||
    !props.permissions.read ||
    !props.permissions.write ||
    !editor.value?.writable,
);
const formFields = computed(
  () =>
    props.definition.fields.filter(
      (f) => !props.blocks?.some((b) => b.key === f.key),
    ) as unknown as typeof props.definition.fields,
);
let generation = 0,
  queryId = 0,
  editId = 0,
  active = true;
const current = (g: number) => active && g === generation;
function clearEditor() {
  editId++;
  editor.value = null;
  initial.value = null;
  pending.value = {};
}
async function close(): Promise<boolean> {
  const g = generation,
    e = editId;
  if (blocked.value) return false;
  if (
    editor.value &&
    !(await (props.beforeClose
      ? props.beforeClose()
      : guard.value?.requestLeave()))
  )
    return false;
  if (!current(g) || e !== editId || blocked.value) return false;
  clearEditor();
  return true;
}
async function enter(row?: R): Promise<boolean> {
  const g = generation,
    e = editId,
    requestedRow = row === undefined ? undefined : clone(row);
  if (
    blocked.value ||
    detailLoading.value ||
    !props.permissions.read ||
    (requestedRow === undefined &&
      (!props.permissions.write || !props.definition.adapter.empty))
  )
    return false;
  if (editor.value && (!(await close()) || !current(g) || editId !== e + 1))
    return false;
  return (await begin(requestedRow)) === true;
}
const localPending = computed(() => Object.values(pending.value).some(Boolean));
const protection = computed<EditProtection>(() => ({
  dirty:
    !!editor.value?.writable &&
    !equalValues(editor.value.values, initial.value),
  localPending: localPending.value,
  invalid:
    !!editor.value?.writable &&
    !!(
      validate(
        formFields.value as readonly AnyField[],
        editor.value.values,
        editor.value.creating ? "create" : "edit",
      ) ??
      validateDomainBlocks(
        props.blocks,
        editor.value.values,
        editor.value.creating ? "create" : "edit",
      )
    ),
  writeState: lock.value.phase,
}));
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
watch(
  editor,
  (value) =>
    emit(
      "draft",
      value
        ? (freezeValues({
            values: clone(value.values),
            identity: clone(value.identity),
          }) as ConfigurationDraft<D, I>)
        : null,
    ),
  { immediate: true, flush: "sync" },
);
async function query(next = page.value, submit = false) {
  if (!props.permissions.read) return;
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
  const g = generation,
    q = ++queryId,
    target = lock.value,
    refreshing = target.phase === "refresh",
    attempt = target.attempt;
  loading.value = true;
  error.value = "";
  try {
    if (refreshing && target.outcome) await recovery().settle(target.outcome);
    if (!current(g) || q !== queryId) return;
    const value = await props.definition.adapter.query({
      scope: props.scope,
      filters: clone(requested),
      page: next,
      pageSize: 20,
    });
    if (!current(g) || q !== queryId) return;
    result.value = clone(value);
    applied.value = clone(requested);
    page.value = next;
    emit("queried", clone(applied.value));
    if (
      refreshing &&
      target.phase === "refresh" &&
      target.attempt === attempt
    ) {
      if (target.context?.retain) {
        const identity = target.context.identity;
        if (identity === undefined)
          throw new Error(
            "保存已确认，但协议未返回新记录身份；无法继续编辑。请由 Adapter 提供权威身份。",
          );
        const detail = await props.definition.adapter.get({
          scope: props.scope,
          identity: clone(identity),
        });
        if (
          !current(g) ||
          q !== queryId ||
          target.phase !== "refresh" ||
          target.attempt !== attempt
        )
          return;
        editId++;
        pending.value = {};
        initial.value = clone(detail.values);
        editor.value = {
          values: clone(detail.values),
          identity: clone(detail.identity),
          writable: detail.writable !== false && props.permissions.write,
          creating: false,
        };
      } else clearEditor();
      await recovery().complete();
      target.phase = "idle";
      target.attempt = null;
      target.context = undefined;
    }
  } catch (e) {
    if (current(g) && q === queryId) error.value = message(e);
  } finally {
    if (current(g) && q === queryId) loading.value = false;
  }
}
async function begin(row?: R) {
  if (
    blocked.value ||
    editor.value ||
    detailLoading.value ||
    !props.permissions.read ||
    (!row && !props.permissions.write)
  )
    return false;
  const g = generation,
    e = ++editId,
    definition = props.definition;
  error.value = "";
  notice.value = "";
  pending.value = {};
  if (!row) {
    if (definition.adapter.empty)
      editor.value = {
        values: clone(
          definition.adapter.empty({
            scope: props.scope,
            filters: clone(applied.value),
          }),
        ),
        writable: true,
        creating: true,
      };
    initial.value = editor.value ? clone(editor.value.values) : null;
    return !!editor.value;
  }
  detailLoading.value = true;
  try {
    const detail = await definition.adapter.get({
      scope: props.scope,
      identity: clone(definition.identity(row)),
    });
    if (current(g) && e === editId) {
      initial.value = clone(detail.values);
      editor.value = {
        values: clone(detail.values),
        identity: clone(detail.identity),
        writable: detail.writable !== false && props.permissions.write,
        creating: false,
      };
      return true;
    }
  } catch (cause) {
    if (current(g) && e === editId) error.value = message(cause);
  } finally {
    if (current(g) && e === editId) detailLoading.value = false;
  }
}
// Every event handler captures the editor instance. Old blocks cannot alter a new editor.
const bindings = computed(() => {
  const g = generation,
    e = editId;
  const hasEditor = !!editor.value;
  const live = () => hasEditor && current(g) && e === editId && !!editor.value;
  const valid = () => live() && !disabled.value;
  return {
    form: (value: D) => {
      if (valid()) editor.value = { ...editor.value!, values: clone(value) };
    },
    formPending: (value: boolean) => {
      if (live()) pending.value = { ...pending.value, form: value };
    },
    blocks:
      props.blocks?.map((block) => ({
        key: block.key,
        block,
        props: {
          modelValue: clone(editor.value!.values),
          scope: props.scope,
          formMode: editor.value?.creating
            ? ("create" as const)
            : ("edit" as const),
          mode: editor.value?.writable ? ("edit" as const) : ("read" as const),
          disabled: disabled.value,
          "onUpdate:modelValue": (value: D) => {
            if (valid())
              editor.value = {
                ...editor.value!,
                values: clone(value),
              };
          },
          onPending: (value: boolean) => {
            if (live())
              pending.value = {
                ...pending.value,
                [`block:${block.key}`]: value,
              };
          },
        },
      })) ?? [],
  };
});
async function save() {
  if (
    !editor.value ||
    disabled.value ||
    Object.values(pending.value).some(Boolean)
  )
    return;
  const definition = props.definition,
    target = lock.value,
    g = generation;
  const invalid =
    validate(
      formFields.value as readonly AnyField[],
      editor.value.values,
      editor.value.creating ? "create" : "edit",
    ) ??
    validateDomainBlocks(
      props.blocks,
      editor.value.values,
      editor.value.creating ? "create" : "edit",
    );
  if (invalid) {
    error.value = invalid;
    return;
  }
  const attempt: ConfigurationAttempt<D, I> = Object.freeze({
    id: crypto.randomUUID(),
    scope: props.scope,
    resource: definition.resource,
    operation: "save",
    input: clone(editor.value.values),
    identity: clone(editor.value.identity),
  });
  target.context = { retain: !!props.retainEditor };
  target.phase = "pending";
  target.attempt = attempt;
  target.outcome = undefined;
  target.refreshed = undefined;
  queryId++;
  loading.value = false;
  error.value = "";
  notice.value = "";
  try {
    const originalRecovery = writeRecovery(target, definition.persistence, {
      scope: attempt.scope,
      resource: attempt.resource,
    });
    try {
      await originalRecovery.reserve();
    } catch (cause) {
      target.attempt = null;
      target.phase = "blocked";
      if (current(g)) error.value = message(cause);
      return;
    }
    // Recheck authority after the asynchronous durable reservation, retaining
    // the original recovery lock when the admitted session has become stale.
    if (
      !current(g) ||
      !props.permissions.read ||
      !props.permissions.write ||
      !editor.value?.writable
    ) {
      target.phase = "unknown";
      return;
    }
    const outcome = await definition.adapter.save(clone(attempt));
    if (outcome.status === "success") {
      target.context = {
        retain: target.context?.retain ?? false,
        identity: clone(
          outcome.identity === undefined ? attempt.identity : outcome.identity,
        ),
      };
      target.phase = "refresh";
      await originalRecovery.settle("applied");
      if (current(g)) {
        notice.value = definition.savedMessage ?? "配置已保存。";
        await query();
      }
    } else if (outcome.status === "failure") {
      target.phase = "refresh";
      await originalRecovery.settle("not-applied");
      await originalRecovery.complete();
      target.phase = "idle";
      target.attempt = null;
      if (current(g)) error.value = outcome.message;
    } else {
      target.phase = "unknown";
      if (current(g)) error.value = outcome.message ?? "保存结果未知。";
    }
  } catch {
    if (target.outcome) {
      target.phase = "refresh";
      if (current(g)) error.value = "结果已确认，请重试保存终态并读取。";
      return;
    }
    target.phase = "unknown";
    if (current(g)) error.value = "保存结果未知。";
  }
}
async function reconcile() {
  const target = lock.value,
    attempt = target.attempt as ConfigurationAttempt<D, I> | null,
    verify = props.definition.reconcile,
    g = generation;
  if (
    target.phase !== "unknown" ||
    !attempt ||
    !verify ||
    !props.permissions.reconcile ||
    verifying.value
  )
    return;
  verifying.value = true;
  try {
    const originalRecovery = recovery();
    const outcome = await verify(clone(attempt));
    if (
      outcome.status !== "unknown" &&
      outcome.attemptId === attempt.id &&
      outcome.evidence != null &&
      target.attempt === attempt &&
      target.phase === "unknown"
    ) {
      if (outcome.status === "applied") {
        target.context = {
          retain: target.context?.retain ?? false,
          identity: clone(
            outcome.identity === undefined
              ? attempt.identity
              : outcome.identity,
          ),
        };
        target.phase = "refresh";
        await originalRecovery.settle("applied");
        if (current(g)) {
          notice.value = "已核实保存成功。";
          await query();
        }
      } else {
        target.phase = "refresh";
        await originalRecovery.settle("not-applied");
        await originalRecovery.complete();
        target.phase = "idle";
        target.attempt = null;
        if (current(g)) notice.value = "已确认本次请求未应用。";
      }
    } else if (current(g)) notice.value = "证据不足，结果仍未知。";
  } catch (e) {
    if (current(g)) error.value = message(e);
  } finally {
    if (current(g)) verifying.value = false;
  }
}
watch(
  [
    () => props.scope,
    () => props.definition,
    () => props.permissions.read,
    () => props.permissions.write,
  ],
  () => {
    generation++;
    queryId++;
    editId++;
    editor.value = null;
    initial.value = null;
    pending.value = {};
    result.value = { items: [], total: 0 };
    page.value = 1;
    filters.value = props.definition.initialFilters();
    filterPending.value = false;
    applied.value = clone(filters.value);
    loading.value = false;
    detailLoading.value = false;
    verifying.value = false;
    error.value = "";
    notice.value = "";
    const g = generation,
      e = editId;
    void restoreWrite()
      .then(() => query(1))
      .then(() => {
        if (current(g) && e === editId && props.initialRow)
          void begin(clone(props.initialRow));
      });
  },
  { immediate: true, flush: "sync" },
);
watch(
  () => props.initialRow,
  (row) => {
    if (row) void enter(row);
  },
);
watch(
  () => props.discardVersion,
  () => {
    if (lock.value.phase === "idle") clearEditor();
  },
);
defineExpose<ConfigurationViewHandle<R>>({
  newDraft: () => enter(),
  openRow: (row) => enter(row),
  close,
  refresh: () => query(1),
});
onBeforeUnmount(() => {
  active = false;
  clearEditor();
  generation++;
  queryId++;
  editId++;
});
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <EditGuard
      v-if="!beforeClose"
      ref="guard"
      :scope="scope"
      :instance="editId"
      :active="permissions.read"
      :dirty="protection.dirty"
      :local-pending="protection.localPending"
      :write-state="protection.writeState"
    />

    <form v-if="permissions.read" @submit.prevent="query(1, true)">
      <DynamicForm
        :key="generation"
        v-model="filters"
        :fields="definition.filters"
        :scope="scope"
        @pending="filterPending = $event"
      />
      <button type="submit" :disabled="loading || filterPending">查询</button>
    </form>
    <div class="zerp-progress-reserve">
      <VProgressLinear
        v-if="loading || detailLoading"
        indeterminate
        aria-label="加载中"
      />
    </div>
    <div class="zerp-feedback-region">
      <Feedback
        :message="lock.phase === 'blocked' ? '请先恢复原请求' : undefined"
        kind="warning"
        persistent
        ><button type="button" :disabled="verifying" @click="restoreWrite">
          重试恢复原请求
        </button></Feedback
      >
      <Feedback :message="error" kind="error" />
      <Feedback :message="notice" />
      <Feedback
        :message="lock.phase === 'unknown' ? '请求结果未知' : undefined"
        kind="warning"
        persistent
      >
        保存结果未知。普通读取或关闭编辑不能解除锁定。
        <button
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
        保存已成功，请重试读取；不会再次提交。
      </Feedback>
    </div>
    <button
      v-if="permissions.read"
      type="button"
      :disabled="loading"
      @click="query()"
    >
      重试读取
    </button>
    <button
      v-if="definition.adapter.empty && permissions.write && permissions.read"
      type="button"
      :disabled="blocked || !!editor || detailLoading"
      @click="enter()"
    >
      {{ definition.createLabel ?? "新增配置" }}
    </button>
    <DataList
      :columns="definition.columns"
      :result="result"
      :page="page"
      :page-size="20"
      :loading="loading"
      :actions="
        () => (permissions.read ? [permissions.write ? 'edit' : 'view'] : [])
      "
      :disabled="blocked || !!editor || detailLoading"
      @page="query($event)"
      @action="(_action, row) => enter(row)"
    />
    <section v-if="editor" :key="editId" role="dialog" aria-label="编辑配置">
      <FactFields
        v-if="!editor.writable"
        :value="editor.values"
        :fields="formFacts(formFields as readonly AnyField[])"
      />
      <DynamicForm
        v-else
        :fields="formFields"
        :model-value="clone(editor.values)"
        :scope="scope"
        :mode="editor.creating ? 'create' : 'edit'"
        :disabled="disabled"
        :onUpdate:modelValue="bindings.form"
        :onPending="bindings.formPending"
      />
      <DraftCollaborationView
        v-if="definition.collaboration && editor && !!editor.writable"
        :adapter="definition.collaboration"
        :model-value="editor.values"
        :scope="scope"
        :instance="editId"
        :disabled="blocked"
        @update:model-value="bindings.form($event)"
        @pending="pending = { ...pending, collaboration: $event }"
      />
      <DomainBlockHost
        v-for="block in bindings.blocks"
        :block="block.block"
        :key="block.key"
        v-bind="block.props"
      />
      <button type="button" :disabled="blocked" @click="close">关闭编辑</button>
      <button
        type="button"
        :disabled="disabled || Object.values(pending).some(Boolean)"
        @click="save"
      >
        {{ definition.saveLabel ?? "保存" }}
      </button>
    </section>
  </section>
</template>
