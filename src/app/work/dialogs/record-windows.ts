// 按业务类型维护窗口、前台窗口和编辑基准，处理同类记录切换。
import {
  computed,
  onBeforeUnmount,
  shallowReactive,
  shallowRef,
  toRaw,
  watch,
} from "vue";
import type { ListCollection, ObjectNode } from "../../../model/business-model";
import { canSelectRecord, readable } from "../../nodes";
import { runWithFeedback } from "../../feedback";
import { readRecord } from "../reads";
import { sessionVersion } from "../../session";
import { edited, recordValues, updateBaseline } from "./record-values";

export type RecordRequest = {
  collection: ListCollection;
  record: ObjectNode;
  mode: "read" | "edit";
  focus?: () => HTMLElement | null;
  print?: boolean;
  resolvedFromUrl?: true;
};

export type RecordWindow = RecordRequest & {
  type: string;
  key: number;
  printKey: number;
  baseline: ReturnType<typeof recordValues> | "loading" | "failed";
  saving: boolean;
};

export type RecordWindowsState = ReturnType<typeof useRecordWindows>;

export function useRecordWindows() {
  // 业务类型作为窗口键。同类切换前检查未保存编辑。
  const windows = shallowReactive(new Map<string, RecordWindow>());
  let key = 0;
  const active = shallowRef<string>();
  const confirm = shallowRef<RecordRequest>();
  const visible = computed(() =>
    [...windows.values()].filter((entry) => readable(entry.record)),
  );

  watch(
    sessionVersion,
    () => {
      windows.clear();
      active.value = undefined;
      confirm.value = undefined;
    },
    { flush: "sync" },
  );

  onBeforeUnmount(() => windows.clear());

  function open(request: RecordRequest, confirmed = false) {
    const { record, collection } = request;
    const type = record.businessType;
    if (
      !type ||
      !readable(collection) ||
      !(request.resolvedFromUrl
        ? canSelectRecord(collection, record)
        : readable(record))
    )
      return false;
    const existing = windows.get(type);
    if (
      existing &&
      (toRaw(existing.record) === toRaw(record) ||
        (record.identity !== null &&
          toRaw(existing.collection) === toRaw(collection) &&
          existing.record.identity === record.identity))
    ) {
      active.value = type;
      if (existing.saving) return true;
      if (request.mode === "edit") existing.mode = "edit";
      existing.print = request.print;
      if (request.print) existing.printKey++;
      return true;
    }
    if (existing?.saving) return false;
    if (
      existing &&
      !confirmed &&
      typeof existing.baseline !== "string" &&
      edited(existing.record, existing.baseline)
    ) {
      confirm.value = request;
      return true;
    }
    const session = sessionVersion.value;
    if (existing) clearSelection(existing, true);
    if (session !== sessionVersion.value) return false;
    collection.selected = record;
    if (
      session !== sessionVersion.value ||
      !readable(record) ||
      collection.selected !== record
    )
      return false;
    const entry: RecordWindow = shallowReactive({
      ...request,
      type,
      key: ++key,
      printKey: 0,
      baseline: "loading",
      saving: false,
    });
    windows.set(type, entry);
    active.value = type;
    void load(entry);
    return true;
  }
  async function load(entry: RecordWindow) {
    const current = () => windows.get(entry.type) === entry;
    const pending = readRecord(entry.record, current);
    const loaded = pending ? await pending : true;
    if (current())
      entry.baseline =
        loaded && readable(entry.record)
          ? recordValues(entry.record)
          : "failed";
  }
  function retry(entry: RecordWindow) {
    if (entry.baseline !== "failed") return;
    entry.baseline = "loading";
    void load(entry);
  }
  function clearSelection(entry: RecordWindow, discardDraft = false) {
    if (entry.collection.selected === entry.record)
      entry.collection.selected = null;
    if (discardDraft && entry.collection.draft === entry.record)
      entry.collection.draft = null;
  }
  function close(entry: RecordWindow) {
    if (entry.saving || windows.get(entry.type) !== entry) return;
    windows.delete(entry.type);
    clearSelection(entry);
    if (active.value === entry.type) active.value = visible.value.at(-1)?.type;
  }
  function resolveSwitch(confirmed: boolean) {
    const request = confirm.value;
    confirm.value = undefined;
    if (confirmed && request) open(request, true);
  }
  function beginEdit(entry: RecordWindow) {
    entry.mode = "edit";
    entry.print = false;
  }
  async function save(entry: RecordWindow, node: ObjectNode) {
    const baseline = entry.baseline;
    const operation = node.operations.update;
    if (
      entry.saving ||
      typeof baseline === "string" ||
      !operation ||
      operation.disabled
    )
      return;
    const identity = node.identity;
    entry.saving = true;
    try {
      const result = await runWithFeedback(
        node,
        () => operation.run(node),
        () =>
          windows.get(entry.type) === entry &&
          (identity === null || node.identity === identity) &&
          node.operations.update === operation &&
          readable(node),
        node,
        true,
      );
      if (result && windows.get(entry.type) === entry)
        entry.baseline = updateBaseline(entry.record, baseline, node);
    } finally {
      entry.saving = false;
    }
  }
  return {
    active,
    visible,
    confirm,
    close,
    resolveSwitch,
    save,
    beginEdit,
    retry,
    open,
  };
}
