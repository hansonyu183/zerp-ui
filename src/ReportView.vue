<script
  setup
  lang="ts"
  generic="
    P extends object,
    R extends object,
    I = string,
    K extends string | number = string | number,
    T = never
  "
>
import {
  computed,
  shallowRef,
  ref,
  watch,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  nextTick,
} from "vue";
import { ReportUnavailable, validateReportRows } from "./report";
import type {
  ReportDefinition,
  ReportSnapshot,
  ReportCell,
  ReportDrill,
  FixedReportAdapter,
} from "./report";
import type { Fields, Page, AnyField } from "./contracts";
import DynamicForm from "./DynamicForm.vue";
import DataList from "./DataList.vue";
import { clone } from "./clone";
import { validate } from "./validation";
type Definition = ReportDefinition<P, R, I, K, T>;
type Snapshot = ReportSnapshot<P, R, I, K, T>;
const props = withDefaults(
  defineProps<{
    definition: Definition;
    scope: string;
    permissions: { query: boolean; export: boolean };
    pageSize?: number;
    active?: boolean;
    restore?: Snapshot;
  }>(),
  { pageSize: 20, active: true },
);
const emit = defineEmits<{
  snapshot: [value: Snapshot];
  drill: [value: ReportDrill<I, K, T>];
}>();
const input = shallowRef<P>(clone(props.definition.initialParameters()));
const applied = shallowRef<P | null>(null);
const result = shallowRef<Page<R> | null>(null);
const fixed = shallowRef<Snapshot["fixed"]>(null);
const adopted = shallowRef<Definition>(props.definition);
const page = ref(1),
  loading = ref(false),
  exporting = ref(false),
  pending = ref(false);
const error = ref(""),
  exportError = ref(""),
  notice = ref(""),
  formGeneration = ref(0);
const valid = ref(true),
  checking = ref(false),
  cancelling = ref(false),
  enabled = ref(props.active);
const scroll = ref<HTMLElement>();
let position = { left: 0, top: 0 };
let generation = 0,
  exportGeneration = 0,
  validationGeneration = 0;
let controller: AbortController | undefined,
  exportController: AbortController | undefined,
  validationController: AbortController | undefined;
let retry: (() => void) | undefined;
const job = shallowRef<{
  requestId: string;
  scope: string;
  adapter: FixedReportAdapter<P, R, I>;
}>();
const canQuery = computed(
  () =>
    enabled.value &&
    props.permissions.query &&
    !!props.definition.adapter.query,
);
const canExport = computed(
  () =>
    enabled.value &&
    props.permissions.export &&
    !!(
      result.value && adopted.value.kind === "fixed"
        ? adopted.value.adapter
        : props.definition.adapter
    ).export,
);
const usable = computed(
  () =>
    enabled.value && props.permissions.query && valid.value && !checking.value,
);
const displayDefinition = computed(() =>
  result.value ? adopted.value : props.definition,
);
const resultCell = computed(() =>
  adopted.value.kind === "fixed" ? adopted.value.cell : undefined,
);
function message(caught: unknown) {
  return caught instanceof Error && caught.message
    ? caught.message
    : "报表请求失败，请重试。";
}
function copyDefinition(d: Definition): Definition {
  return {
    ...d,
    adapter: { ...d.adapter },
    columns: d.columns.map((column) => ({
      ...column,
      ...("options" in column
        ? { options: column.options.map((option) => ({ ...option })) }
        : {}),
    })),
  } as Definition;
}
function parameters() {
  const invalid = validate(
    props.definition.parameters as readonly AnyField[],
    input.value,
    "edit",
  );
  if (pending.value || invalid) throw new Error(invalid ?? "请完成参数输入。");
  return clone(input.value);
}
function clearResult() {
  result.value = null;
  fixed.value = null;
  applied.value = null;
  page.value = 1;
  valid.value = true;
}
function failed(caught: unknown) {
  if (caught instanceof ReportUnavailable) {
    clearResult();
    invalidateExport();
  }
  return message(caught);
}
function invalidateExport() {
  exportGeneration++;
  exportController?.abort();
  exporting.value = false;
}
function stop() {
  generation++;
  controller?.abort();
  loading.value = false;
  notice.value = "已停止本地等待；服务端执行未确认取消。";
}
async function runQuery(values: P, target: number, paging: boolean) {
  if (
    cancelling.value ||
    !canQuery.value ||
    (paging && (!usable.value || !result.value))
  )
    return;
  const d = copyDefinition(paging ? adopted.value : props.definition);
  const current = ++generation;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal,
    scope = props.scope;
  invalidateExport();
  validationGeneration++;
  validationController?.abort();
  checking.value = false;
  loading.value = true;
  error.value = "";
  notice.value = "";
  job.value = undefined;
  retry = () => {
    void runQuery(clone(values), target, paging);
  };
  try {
    let value: Page<R>;
    let metadata: Snapshot["fixed"] = fixed.value;
    if (d.kind === "fixed") {
      if (paging && fixed.value)
        value = await d.adapter.page({
          scope,
          resultId: fixed.value.id,
          page: target,
          pageSize: props.pageSize,
          signal,
        });
      else {
        const requestId = crypto.randomUUID();
        job.value = { requestId, scope, adapter: d.adapter };
        const created = await d.adapter.query({
          scope,
          parameters: clone(values),
          page: target,
          pageSize: props.pageSize,
          requestId,
          signal,
        });
        value = created;
        metadata = {
          id: created.id,
          summary: clone(created.summary),
          context: created.context,
        };
      }
    } else {
      if (!d.adapter.query) return;
      value = await d.adapter.query({
        scope,
        parameters: clone(values),
        page: target,
        pageSize: props.pageSize,
      });
      metadata = null;
    }
    if (current !== generation) return;
    validateReportRows(d.columns, value.items);
    const keys = value.items.map(d.rowKey);
    if (
      keys.some((key) => typeof key !== "string" && typeof key !== "number") ||
      new Set(keys).size !== keys.length
    )
      throw new Error("报表行身份必须稳定且不重复。");
    if (metadata)
      validateReportRows(
        d.columns.filter((c) => c.key in metadata!.summary.values),
        [metadata.summary.values as R],
      );
    result.value = clone(value);
    fixed.value = metadata;
    adopted.value = d;
    applied.value = clone(values);
    page.value = target;
    valid.value = true;
    retry = undefined;
  } catch (caught) {
    if (current === generation) error.value = failed(caught);
  } finally {
    if (current === generation) {
      loading.value = false;
      job.value = undefined;
    }
  }
}
function updateInput(value: P) {
  input.value = value;
}
function search() {
  if (!canQuery.value) return;
  try {
    void runQuery(parameters(), 1, false);
  } catch (caught) {
    error.value = message(caught);
  }
}
function changePage(target: number) {
  if (applied.value) void runQuery(clone(applied.value), target, true);
}
async function cancel() {
  const running = job.value;
  if (!running?.adapter.cancel || cancelling.value) return;
  stop();
  const current = generation;
  cancelling.value = true;
  notice.value = "正在请求服务端取消…";
  try {
    const outcome = await running.adapter.cancel({
      scope: running.scope,
      requestId: running.requestId,
    });
    if (current !== generation) return;
    notice.value = {
      cancelled: "服务端已取消。",
      completed: "服务端已完成，未取消；可重新查询。",
      failed: "服务端执行失败。",
      "cleanup-unconfirmed": "服务端清理未确认。",
    }[outcome.status];
  } catch (caught) {
    if (current === generation)
      notice.value = `服务端取消失败，清理未确认：${message(caught)}`;
  } finally {
    if (current === generation) {
      cancelling.value = false;
      job.value = undefined;
    }
  }
}
async function download() {
  if (!canExport.value || exporting.value) return;
  const d =
    props.definition.kind === "fixed" ? adopted.value : props.definition;
  if (d.kind === "fixed" && (!fixed.value || !usable.value)) return;
  exportError.value = "";
  notice.value = "";
  const current = ++exportGeneration;
  exportController = new AbortController();
  try {
    exporting.value = true;
    const artifact =
      d.kind === "fixed"
        ? await d.adapter.export?.({
            scope: props.scope,
            resultId: fixed.value!.id,
            signal: exportController.signal,
          })
        : await d.adapter.export?.({
            scope: props.scope,
            parameters: parameters(),
          });
    if (current !== exportGeneration || !artifact) return;
    const url = URL.createObjectURL(artifact.content);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.filename;
      link.click();
      notice.value = "导出已准备。";
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (caught) {
    if (current === exportGeneration) exportError.value = failed(caught);
  } finally {
    if (current === exportGeneration) exporting.value = false;
  }
}
function snapshot() {
  if (scroll.value)
    position = { left: scroll.value.scrollLeft, top: scroll.value.scrollTop };
  emit("snapshot", {
    scope: props.scope,
    resource: props.definition.resource,
    input: clone(input.value),
    applied: applied.value && clone(applied.value),
    result: result.value && clone(result.value),
    page: page.value,
    pageSize: props.pageSize,
    fixed: fixed.value && clone(fixed.value),
    definition: copyDefinition(adopted.value),
    scroll: { ...position },
  });
}
function drill(cell: ReportCell<T>, row: R) {
  if (!usable.value || !fixed.value || cell.disabled) return;
  snapshot();
  emit("drill", {
    scope: props.scope,
    resource: adopted.value.resource,
    resultId: fixed.value.id,
    rowId: adopted.value.rowKey(row),
    cell,
  });
}
function restorePosition() {
  if (scroll.value) {
    scroll.value.scrollLeft = position.left;
    scroll.value.scrollTop = position.top;
  }
}
async function revalidate() {
  if (!enabled.value || !result.value || !props.permissions.query) return;
  valid.value = false;
  checking.value = true;
  error.value = "";
  const current = ++validationGeneration;
  validationController?.abort();
  validationController = new AbortController();
  try {
    if (adopted.value.kind === "fixed" && fixed.value) {
      const outcome = await adopted.value.adapter.revalidate({
        scope: props.scope,
        resultId: fixed.value.id,
        signal: validationController.signal,
      });
      if (current !== validationGeneration) return;
      if (outcome.status !== "valid") {
        clearResult();
        notice.value = "结果已失效或无权访问，请重新查询。";
        return;
      }
    } else {
      // Parameter reports have no reusable result identity; returning reads the applied page again.
      const values = applied.value;
      const target = page.value;
      clearResult();
      if (values) {
        const resumedGeneration = generation + 1;
        await runQuery(values, target, false);
        await nextTick();
        if (resumedGeneration === generation && result.value) restorePosition();
      }
    }
    if (current === validationGeneration) valid.value = true;
  } catch (caught) {
    if (current === validationGeneration) error.value = failed(caught);
  } finally {
    if (current === validationGeneration) checking.value = false;
    await nextTick();
    if (current === validationGeneration) restorePosition();
  }
}
function deactivate() {
  snapshot();
  enabled.value = false;
  generation++;
  controller?.abort();
  invalidateExport();
  validationGeneration++;
  validationController?.abort();
  loading.value = false;
  checking.value = false;
  valid.value = false;
  cancelling.value = false;
  job.value = undefined;
}
function activate() {
  if (!props.active || enabled.value) return;
  enabled.value = true;
  void revalidate();
}
function reset() {
  generation++;
  controller?.abort();
  invalidateExport();
  validationGeneration++;
  validationController?.abort();
  formGeneration.value++;
  input.value = clone(props.definition.initialParameters());
  clearResult();
  adopted.value = props.definition;
  loading.value = false;
  pending.value = false;
  checking.value = false;
  cancelling.value = false;
  job.value = undefined;
  retry = undefined;
  error.value = "";
  exportError.value = "";
  notice.value = "";
  position = { left: 0, top: 0 };
}
watch(
  [
    () => props.scope,
    () => props.definition.resource,
    () => props.definition.kind,
    () => props.permissions.query,
    () => props.permissions.export,
    () => props.pageSize,
  ],
  reset,
  { flush: "sync" },
);
watch(
  () => props.active,
  (active) => {
    if (active) activate();
    else deactivate();
  },
  { flush: "sync" },
);
function restoreSaved(saved: Snapshot | undefined) {
  if (
    !saved ||
    saved.scope !== props.scope ||
    saved.resource !== props.definition.resource ||
    saved.definition.kind !== props.definition.kind ||
    saved.pageSize !== props.pageSize ||
    !props.permissions.query
  )
    return;
  reset();
  input.value = clone(saved.input);
  applied.value = saved.applied && clone(saved.applied);
  result.value = saved.result && clone(saved.result);
  fixed.value = saved.fixed && clone(saved.fixed);
  adopted.value = copyDefinition(saved.definition);
  page.value = saved.page;
  position = { ...saved.scroll };
  valid.value = false;
  void revalidate();
}
watch(() => props.restore, restoreSaved, { immediate: true });
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(() => {
  deactivate();
});
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <form @submit.prevent="search">
      <DynamicForm
        :key="formGeneration"
        :fields="definition.parameters as unknown as Fields<P>"
        :model-value="input"
        :scope="scope"
        :disabled="(!canQuery && !canExport) || !enabled"
        mode="edit"
        @update:model-value="updateInput"
        @pending="pending = $event"
      />
      <button
        v-if="canQuery"
        type="submit"
        :disabled="pending || cancelling || checking"
      >
        查询
      </button>
      <button
        v-if="canExport"
        type="button"
        :disabled="
          exporting ||
          (definition.kind === 'fixed' ? !fixed || !usable || loading : pending)
        "
        @click="download"
      >
        导出
      </button>
    </form>
    <p v-if="!canQuery && canExport && definition.kind === 'parameter'">
      你可以填写参数并导出此报表。
    </p>
    <p v-if="!canQuery && !canExport">没有可用的报表操作。</p>
    <p v-if="loading" role="status">
      正在查询… <button type="button" @click="stop">停止等待</button>
    </p>
    <button
      v-if="job?.adapter.cancel"
      type="button"
      :disabled="cancelling"
      @click="cancel"
    >
      取消服务端查询
    </button>
    <p v-if="exporting" role="status">正在导出…</p>
    <p v-if="checking || (result && !valid)" role="status">
      结果待重验，分页、导出和下钻暂不可用。
      <button
        type="button"
        :disabled="checking || !enabled"
        @click="revalidate"
      >
        重验结果
      </button>
    </p>
    <p v-if="error" role="alert">
      {{ error }} <span v-if="result">仍显示上次成功结果。</span
      ><button
        v-if="retry && canQuery"
        type="button"
        :disabled="loading || !valid"
        @click="retry()"
      >
        重试查询
      </button>
    </p>
    <p v-if="exportError" role="alert">{{ exportError }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div v-if="canQuery && result" ref="scroll" class="zerp-report-scroll">
      <p>已采用条件：{{ applied }}</p>
      <p v-if="fixed">{{ fixed.context }}</p>
      <DataList
        :columns="displayDefinition.columns"
        :result="result"
        :row-key="displayDefinition.rowKey"
        :page="page"
        :page-size="pageSize"
        :loading="loading"
        :disabled="!usable || cancelling"
        :wide="true"
        :summary="fixed?.summary"
        :cell="resultCell"
        @cell="drill"
        @page="changePage"
      />
    </div>
  </section>
</template>
