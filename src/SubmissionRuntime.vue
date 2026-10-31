<script
  setup
  lang="ts"
  generic="D extends object, I, S, O, H, A extends object, E = never"
>
import { computed, onBeforeUnmount, ref, shallowRef, toRaw, watch } from "vue";
import Feedback from "./Feedback.vue";
import { VProgressLinear } from "vuetify/components";
import type { AnyField } from "./contracts";
import type { ConfigurationBlock } from "./configuration";
import type {
  DocumentArchive,
  DocumentSnapshot,
  DocumentAction,
  DocumentAttempt,
  StageAttempt,
} from "./document";
import type { SubmissionDefinition } from "./submission";
import DynamicForm from "./DynamicForm.vue";
import DataList from "./DataList.vue";
import { clone, message } from "./clone";
import { validate } from "./validation";
import { writeLock } from "./write-lock";
const props = defineProps<{
  definition: SubmissionDefinition<D, I, S, O, H, A, E>;
  scope: string;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly ConfigurationBlock<D>[];
  kind?: "document" | "voucher";
  lockAdapter?: object;
  externalDisabled?: boolean;
}>();
const vouchers = computed(() => props.definition.vouchers);
type Snapshot = DocumentSnapshot<D, I, S, O, H>;
type Attempt = DocumentAttempt<D, I, S, H> | StageAttempt<I, S, O>;
type Local = { id: string; file: File; staged?: { handle: H } };
type Draft = {
  mode: "create" | "edit";
  source: Snapshot;
  view: "official" | "candidate";
  values: D;
  files: Local[];
};
const lock = computed(() =>
  writeLock<D, I, Attempt, Draft>(
    props.lockAdapter ?? props.definition.adapter,
    `${props.kind ?? "document"}:${props.definition.resource}`,
    props.scope,
  ),
);
const rows = shallowRef<
  import("./contracts").Page<{ identity: I; number: string; handler: string }>
>({ items: [], total: 0 });
const voucherPage = ref(1);
const voucherIdentity = shallowRef<{ value: I } | null>(null);
const editCaption = computed(() =>
  props.kind === "voucher" ? "编辑单据" : "编辑档案",
);
const submitCaption = computed(() =>
  props.kind === "voucher" ? "提交单据" : "提交档案",
);
const archive = shallowRef<DocumentArchive<D, I, S, O, H, A> | null>(null);
const selected = ref<"official" | "candidate" | "history" | "audit">(
    "official",
  ),
  historyIndex = ref(0);
const editor = ref(false);
const historical = shallowRef<Snapshot | null>(null);
const snapshot = computed(() =>
  editor.value && lock.value.context
    ? lock.value.context.source
    : selected.value === "history"
      ? historical.value
      : selected.value === "audit"
        ? null
        : archive.value?.[selected.value],
);
const loading = ref(false),
  error = ref(""),
  notice = ref(""),
  verifying = ref(false),
  downloading = ref(false);
const pending = ref<Record<string, boolean>>({});
const blocked = computed(() => lock.value.phase !== "idle");
const disabled = computed(
  () =>
    blocked.value ||
    !!props.externalDisabled ||
    !props.permissions.read ||
    !props.permissions.write,
);
const busy = computed(() => Object.values(pending.value).some(Boolean));
const fields = computed(
  () =>
    props.definition.fields.filter(
      (f) => !props.blocks?.some((b) => b.key === f.key),
    ) as unknown as typeof props.definition.fields,
);
let generation = 0,
  queryId = 0,
  instance = 0,
  active = true,
  verificationId = 0;
let ownedLock = lock.value;
function discardUnstaged() {
  if (
    ownedLock.phase === "idle" &&
    !ownedLock.context?.files.some((f) => f.staged)
  )
    ownedLock.context = undefined;
}
const current = (g: number) => active && generation === g;
function close() {
  if (lock.value.phase === "pending") return;
  editor.value = false;
  instance++;
  pending.value = {};
  // Successful/unknown stages remain owned by this session. Closing never deletes artifacts.
  if (
    lock.value.phase === "idle" &&
    !lock.value.context?.files.some((f) => f.staged)
  )
    lock.value.context = undefined;
}
async function query() {
  if (!props.permissions.read) return;
  const g = generation,
    q = ++queryId,
    target = lock.value,
    attempt = target.attempt,
    refreshing = target.phase === "refresh";
  loading.value = true;
  error.value = "";
  try {
    let result: DocumentArchive<D, I, S, O, H, A>;
    if (props.definition.vouchers) {
      const list = await props.definition.vouchers.list({
        scope: props.scope,
        page: voucherPage.value,
        pageSize: 20,
      });
      if (!current(g) || q !== queryId) return;
      rows.value = clone(list);
      result = voucherIdentity.value
        ? await props.definition.vouchers.get({
            scope: props.scope,
            identity: clone(voucherIdentity.value.value),
          })
        : { official: null, candidate: null, history: [], audit: [] };
    } else
      result = await props.definition.adapter.query!({ scope: props.scope });
    if (!current(g) || q !== queryId) return;
    archive.value = clone(result);
    if (
      refreshing &&
      target.phase === "refresh" &&
      target.attempt === attempt
    ) {
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
async function openVoucher(identity: I) {
  if (editor.value || loading.value || !props.permissions.read) return;
  archive.value = null;
  voucherIdentity.value = { value: clone(identity) };
  selected.value = "official";
  historical.value = null;
  instance++;
  await query();
}
async function pageVouchers(page: number) {
  if (editor.value || loading.value) return;
  voucherPage.value = page;
  await query();
}
function prepare(operation: "create" | "clone") {
  if (
    disabled.value ||
    loading.value ||
    editor.value ||
    !props.definition.vouchers
  )
    return;
  try {
    if (lock.value.context) {
      resumeDraft();
      return;
    }
    const source = snapshot.value;
    const draft =
      operation === "create"
        ? props.definition.vouchers.empty?.({ scope: props.scope })
        : source &&
            props.definition.vouchers.canClone?.(source) &&
            selected.value !== "audit"
          ? props.definition.vouchers.clone?.({
              scope: props.scope,
              source: clone(source),
            })
          : null;
    if (!draft) return;
    archive.value ??= {
      official: null,
      candidate: null,
      history: [],
      audit: [],
    };
    lock.value.context ??= {
      mode: "create",
      source: clone(draft),
      view: "official",
      values: clone(draft.values),
      files: [],
    };
    resumeDraft();
  } catch (e) {
    error.value = message(e);
  }
}
function resumeDraft() {
  if (disabled.value || loading.value || editor.value || !lock.value.context)
    return;
  archive.value ??= { official: null, candidate: null, history: [], audit: [] };
  selected.value = lock.value.context.view;
  editor.value = true;
  instance++;
  pending.value = {};
  error.value = "";
  notice.value = "";
}
function begin() {
  if (
    disabled.value ||
    editor.value ||
    !snapshot.value?.eligible.edit ||
    selected.value === "history" ||
    selected.value === "audit"
  )
    return;
  lock.value.context ??= {
    mode: "edit",
    source: clone(snapshot.value),
    view: selected.value === "candidate" ? "candidate" : "official",
    values: clone(snapshot.value.values),
    files: [],
  };
  resumeDraft();
}
function updateDraft(fn: (d: Draft) => Draft) {
  if (lock.value.context) lock.value.context = fn(lock.value.context);
}
const bindings = computed(() => {
  const g = generation,
    i = instance,
    editing = editor.value;
  const live = () => current(g) && i === instance && editing && editor.value;
  const writable = () => live() && !disabled.value;
  const values = editor.value
    ? lock.value.context?.values
    : snapshot.value?.values;
  return {
    form: (value: D) => {
      if (writable()) updateDraft((d) => ({ ...d, values: clone(value) }));
    },
    pending: (value: boolean) => {
      if (live()) pending.value = { ...pending.value, form: value };
    },
    blocks: values
      ? (props.blocks?.map((block) => ({
          key: block.key,
          component: toRaw(block.component),
          props: {
            modelValue: clone(values[block.key]),
            catalog: clone(block.catalog),
            mode:
              editor.value && !disabled.value
                ? ("edit" as const)
                : ("read" as const),
            disabled: !editor.value || disabled.value,
            "onUpdate:modelValue": (value: D[typeof block.key]) => {
              if (writable())
                updateDraft((d) => ({
                  ...d,
                  values: { ...d.values, [block.key]: clone(value) },
                }));
            },
            onPending: (value: boolean) => {
              if (live())
                pending.value = {
                  ...pending.value,
                  [`block:${block.key}`]: value,
                };
            },
          },
        })) ?? [])
      : [],
  };
});
function addFiles(event: Event) {
  const input = event.target as HTMLInputElement,
    files = Array.from(input.files ?? []);
  input.value = "";
  if (!editor.value || disabled.value || !props.definition.adapter.attachments)
    return;
  for (const file of files) {
    const invalid = props.definition.adapter.attachments.validate(file);
    if (invalid) {
      error.value = invalid;
      continue;
    }
    updateDraft((d) => ({
      ...d,
      files: [...d.files, { id: crypto.randomUUID(), file }],
    }));
  }
}
function base(source: Snapshot) {
  return {
    id: crypto.randomUUID(),
    scope: props.scope,
    resource: props.definition.resource,
    identity: clone(source.identity),
    state: clone(source.state),
  };
}
async function submit() {
  const draft = lock.value.context;
  if (!editor.value || !draft || disabled.value || busy.value) return;
  const invalid = validate(
    fields.value as readonly AnyField[],
    draft.values,
    draft.mode,
  );
  if (invalid) {
    error.value = invalid;
    return;
  }
  const g = generation,
    target = lock.value,
    definition = props.definition;
  queryId++;
  loading.value = false;
  error.value = "";
  notice.value = "";
  for (const file of draft.files) {
    if (file.staged) continue;
    if (!definition.adapter.attachments) return;
    const attempt: StageAttempt<I, S, O> = {
      ...base(draft.source),
      operation: "stage",
      owner: clone(draft.source.owner),
      fileId: file.id,
      file: file.file,
    };
    target.phase = "pending";
    target.attempt = attempt;
    try {
      const outcome = await definition.adapter.attachments.stage({
        ...clone(attempt),
        file: file.file,
      });
      if (outcome.status === "success") {
        target.context = {
          ...target.context!,
          files: target.context!.files.map((f) =>
            f.id === file.id
              ? { ...f, staged: { handle: clone(outcome.handle) } }
              : f,
          ),
        };
        target.phase = "idle";
        target.attempt = null;
      } else {
        target.phase = outcome.status === "unknown" ? "unknown" : "idle";
        if (outcome.status === "failure") target.attempt = null;
        if (current(g)) error.value = outcome.message ?? "附件暂存结果未知。";
        return;
      }
    } catch {
      target.phase = "unknown";
      if (current(g)) error.value = "附件暂存结果未知。";
      return;
    }
    // An old session may record its result, but never starts the next write.
    if (!current(g) || !props.permissions.read || !props.permissions.write)
      return;
  }
  const attempt: Extract<
    DocumentAttempt<D, I, S, H>,
    { operation: "submit" }
  > = {
    ...base(draft.source),
    operation: "submit",
    input: clone(draft.values),
    attachments: [
      ...draft.source.attachments.map((a) => clone(a.handle)),
      ...target.context!.files.map((f) => clone(f.staged!.handle)),
    ],
  };
  await write(attempt, () => definition.adapter.submit(clone(attempt)));
}
async function act(operation: DocumentAction) {
  const source = snapshot.value,
    adapter = props.definition.adapter;
  if (
    !source ||
    disabled.value ||
    editor.value ||
    !!lock.value.context ||
    loading.value ||
    selected.value === "history" ||
    selected.value === "audit" ||
    !source.eligible[operation]
  )
    return;
  const b = base(source);
  if (operation === "approve" && adapter.approve) {
    const a = { ...b, operation: "approve" as const };
    await write(a, () => adapter.approve!(clone(a)));
  } else if (operation === "enable" && adapter.enable) {
    const a = { ...b, operation: "enable" as const };
    await write(a, () => adapter.enable!(clone(a)));
  } else if (operation === "disable" && adapter.disable) {
    const a = { ...b, operation: "disable" as const };
    await write(a, () => adapter.disable!(clone(a)));
  }
}
async function write(
  attempt: DocumentAttempt<D, I, S, H>,
  run: () => Promise<import("./contracts").WriteResult>,
) {
  const target = lock.value,
    g = generation;
  target.phase = "pending";
  target.attempt = attempt;
  queryId++;
  loading.value = false;
  error.value = "";
  notice.value = "";
  try {
    const result = await run();
    if (result.status === "success") {
      target.phase = "refresh";
      target.context = undefined;
      if (current(g)) {
        close();
        notice.value = "业务写入已成功。";
        await query();
      }
    } else {
      target.phase = result.status === "unknown" ? "unknown" : "idle";
      if (result.status === "failure") target.attempt = null;
      if (current(g)) error.value = result.message ?? "业务写入结果未知。";
    }
  } catch {
    target.phase = "unknown";
    if (current(g)) error.value = "业务写入结果未知。";
  }
}
async function reconcile() {
  const target = lock.value,
    attempt = target.attempt,
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
  const v = ++verificationId;
  verifying.value = true;
  try {
    const outcome = await verify(clone(attempt));
    if (!current(g) || v !== verificationId || !props.permissions.reconcile)
      return;
    if (
      outcome.status === "unknown" ||
      outcome.attemptId !== attempt.id ||
      outcome.evidence == null ||
      target.attempt !== attempt ||
      target.phase !== "unknown" ||
      (attempt.operation === "stage") !== (outcome.operation === "stage")
    ) {
      if (current(g)) notice.value = "证据不足，结果仍未知。";
      return;
    }
    if (
      attempt.operation === "stage" &&
      outcome.operation === "stage" &&
      outcome.status === "applied"
    ) {
      target.context = {
        ...target.context!,
        files: target.context!.files.map((f) =>
          f.id === attempt.fileId
            ? { ...f, staged: { handle: clone(outcome.handle) } }
            : f,
        ),
      };
      target.phase = "idle";
      target.attempt = null;
      if (current(g)) notice.value = "已核实附件暂存成功；尚未业务提交。";
    } else if (outcome.status === "not-applied") {
      target.phase = "idle";
      target.attempt = null;
      if (current(g)) notice.value = "已确认本次请求未应用。";
    } else {
      target.phase = "refresh";
      target.context = undefined;
      if (current(g)) {
        close();
        notice.value = "已核实业务写入成功。";
        await query();
      }
    }
  } catch (e) {
    if (current(g)) error.value = message(e);
  } finally {
    if (current(g) && v === verificationId) verifying.value = false;
  }
}
async function readAttachment(handle: H, owner: O) {
  const adapter = props.definition.adapter.attachments,
    g = generation,
    i = instance;
  if (!adapter || !props.permissions.read || downloading.value) return;
  downloading.value = true;
  try {
    const result = await adapter.read({
      scope: props.scope,
      owner: clone(owner),
      handle: clone(handle),
    });
    if (!current(g) || i !== instance || !props.permissions.read) return;
    const url = URL.createObjectURL(result.content);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    if (current(g)) error.value = message(e);
  } finally {
    if (current(g)) downloading.value = false;
  }
}
watch(
  () => props.permissions.reconcile,
  () => {
    verificationId++;
    verifying.value = false;
  },
  { flush: "sync" },
);
function select(view: typeof selected.value, index = 0) {
  if (editor.value) return;
  selected.value = view;
  historical.value =
    view === "history" ? clone(archive.value?.history[index] ?? null) : null;
  historyIndex.value = index;
  instance++;
}
watch(
  [() => props.scope, () => props.definition, () => props.permissions.read],
  () => {
    discardUnstaged();
    ownedLock = lock.value;
    generation++;
    queryId++;
    instance++;
    editor.value = false;
    pending.value = {};
    archive.value = null;
    rows.value = { items: [], total: 0 };
    voucherPage.value = 1;
    voucherIdentity.value = null;
    selected.value = "official";
    historyIndex.value = 0;
    historical.value = null;
    loading.value = false;
    verifying.value = false;
    downloading.value = false;
    error.value = "";
    notice.value = "";
    void query();
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => {
  discardUnstaged();
  active = false;
  generation++;
  instance++;
});
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <div class="zerp-progress-reserve">
      <VProgressLinear v-if="loading" indeterminate aria-label="加载中" />
    </div>
    <div class="zerp-feedback-region">
      <Feedback :message="error" kind="error" />
      <Feedback :message="notice" />
      <Feedback
        :message="lock.phase === 'unknown' ? '请求结果未知' : undefined"
        kind="warning"
        persistent
      >
        {{
          lock.attempt?.operation === "stage" ? "附件暂存" : "业务写入"
        }}结果未知。普通读取或关闭不能解锁。
        <button
          v-if="definition.reconcile && permissions.reconcile"
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
        业务写入已成功，请重试读取；不会再次提交。
      </Feedback>
    </div>
    <button v-if="permissions.read" :disabled="loading" @click="query">
      重试读取
    </button>
    <button
      v-if="
        vouchers &&
        lock.context &&
        !editor &&
        permissions.write &&
        permissions.read
      "
      :disabled="disabled || loading"
      @click="resumeDraft"
    >
      恢复 Draft
    </button>
    <section v-if="vouchers && permissions.read" aria-label="单据列表">
      <button
        v-if="vouchers.empty && permissions.write"
        :disabled="disabled || loading || editor"
        @click="prepare('create')"
      >
        创建 Draft
      </button>
      <DataList
        :columns="[
          { key: 'number', label: '编号' },
          { key: 'handler', label: '经办人' },
        ]"
        :result="rows"
        :page="voucherPage"
        :page-size="20"
        :loading="loading || editor"
        @page="pageVouchers"
      />
      <button
        v-for="(row, index) in rows.items"
        :key="index"
        :disabled="loading || editor"
        @click="openVoucher(row.identity)"
      >
        查看 {{ row.number }}
      </button>
    </section>
    <nav
      v-if="permissions.read"
      :aria-label="vouchers ? '单据视图' : '档案视图'"
    >
      <button :disabled="editor" @click="select('official')">
        {{ vouchers ? "当前单据" : "正式资料" }}
      </button>
      <button v-if="!vouchers" :disabled="editor" @click="select('candidate')">
        开放候选
      </button>
      <button
        v-for="(item, index) in archive?.history"
        :key="index"
        :disabled="editor"
        @click="select('history', index)"
      >
        历史 {{ item.label }}
      </button>
      <button :disabled="editor" @click="select('audit')">审计</button>
    </nav>
    <template v-if="permissions.read && archive">
      <DataList
        v-if="selected === 'audit'"
        :columns="definition.auditColumns"
        :result="{ items: archive.audit, total: archive.audit.length }"
        :page="1"
        :page-size="archive.audit.length || 1"
      />
      <template v-else-if="snapshot">
        <p>
          {{ vouchers ? "单据" : "档案" }}：{{ snapshot.label }} · 状态：{{
            snapshot.state
          }}
        </p>
        <button
          v-if="
            vouchers?.clone &&
            vouchers.canClone?.(snapshot) &&
            permissions.write &&
            !editor
          "
          :disabled="disabled || loading"
          @click="prepare('clone')"
        >
          克隆 Draft
        </button>
        <DynamicForm
          v-if="!editor"
          :key="`${selected}:${historyIndex}`"
          :fields="fields"
          :model-value="clone(snapshot.values)"
          :scope="scope"
          disabled
        />
        <ul v-if="!editor">
          <li v-for="(item, index) in snapshot.attachments" :key="index">
            {{ item.label }}
            <button
              v-if="definition.adapter.attachments"
              :disabled="downloading"
              @click="readAttachment(item.handle, snapshot.owner)"
            >
              读取附件 {{ item.label }}
            </button>
          </li>
        </ul>
        <template v-if="selected !== 'history' && permissions.write && !editor">
          <button
            v-if="snapshot.eligible.edit"
            :disabled="disabled || loading"
            @click="begin"
          >
            {{ editCaption }}
          </button>
          <button
            v-if="snapshot.eligible.approve && definition.adapter.approve"
            :disabled="disabled || loading"
            @click="act('approve')"
          >
            审批通过
          </button>
          <button
            v-if="snapshot.eligible.enable && definition.adapter.enable"
            :disabled="disabled || loading"
            @click="act('enable')"
          >
            启用档案
          </button>
          <button
            v-if="snapshot.eligible.disable && definition.adapter.disable"
            :disabled="disabled || loading"
            @click="act('disable')"
          >
            停用档案
          </button>
        </template>
        <section
          v-if="editor && lock.context"
          :key="instance"
          role="dialog"
          :aria-label="editCaption"
        >
          <DynamicForm
            :fields="fields"
            :model-value="clone(lock.context.values)"
            :scope="scope"
            :mode="lock.context.mode"
            :disabled="disabled"
            :onUpdate:modelValue="bindings.form"
            :onPending="bindings.pending"
          />
          <label v-if="definition.adapter.attachments"
            >本地附件<input
              type="file"
              multiple
              aria-label="本地附件"
              :disabled="disabled"
              @change="addFiles"
          /></label>
          <ul>
            <li v-for="file in lock.context.files" :key="file.id">
              {{ file.file.name }}：{{
                file.staged ? "暂存成功，尚未业务提交" : "本地准备，待暂存"
              }}
            </li>
          </ul>
          <button :disabled="lock.phase === 'pending'" @click="close">
            关闭编辑
          </button>
          <button :disabled="disabled || busy" @click="submit">
            {{ submitCaption }}
          </button>
        </section>
        <component
          v-for="block in bindings.blocks"
          :is="block.component"
          :key="`${instance}:${block.key}`"
          v-bind="block.props"
        />
      </template>
      <p v-else>暂无{{ selected === "official" ? "正式资料" : "开放候选" }}</p>
    </template>
  </section>
</template>
