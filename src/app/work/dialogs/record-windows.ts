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
import { readable } from "../../nodes";
import { loadFirst, retryRecord, runOperation } from "../../operations";
import {
  applicationModel,
  currentModel,
  sessionScope,
  sessionState,
} from "../../session";
import {
  draftOrigin,
  edited,
  recordDraft,
  recordValues,
  updateBaseline,
} from "./record-draft";

export type RecordRequest = {
  collection: ListCollection;
  record: ObjectNode;
  mode: "read" | "edit";
  focus?: () => HTMLElement | null;
  print?: boolean;
};

export type RecordWindow = RecordRequest & {
  type: string;
  key: number;
  printKey: number;
  draft: ObjectNode;
  baseline: unknown;
  edits: boolean;
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
    [currentModel, sessionScope, sessionState],
    () => {
      windows.clear();
      active.value = undefined;
      confirm.value = undefined;
    },
    { flush: "sync" },
  );

  onBeforeUnmount(() => windows.clear());

  function open(request: RecordRequest, discard = false) {
    const { record, collection } = request;
    const type = record.businessType;
    if (!type || !readable(collection) || !readable(record)) return;
    const existing = windows.get(type);
    if (
      existing &&
      (toRaw(existing.record) === toRaw(record) ||
        (record.identity !== null &&
          existing.record.identity === record.identity))
    ) {
      if (request.mode === "edit") beginEdit(existing);
      existing.print = request.print;
      if (request.print) existing.printKey++;
      active.value = type;
      return;
    }
    if (
      existing &&
      existing.edits &&
      !discard &&
      edited(existing.draft, existing.baseline)
    ) {
      confirm.value = request;
      return;
    }
    const owner = sessionScope.value;
    const application = applicationModel.value;
    if (existing) clearSelection(existing, true);
    if (owner !== sessionScope.value || application !== applicationModel.value)
      return;
    collection.selected = record;
    if (
      owner !== sessionScope.value ||
      application !== applicationModel.value ||
      !readable(record) ||
      collection.selected !== record
    )
      return;
    const edits = supportsEditing(record);
    const draft = edits ? recordDraft(record) : record;
    const entry: RecordWindow = shallowReactive({
      ...request,
      type,
      key: ++key,
      printKey: 0,
      draft,
      baseline: edits ? recordValues(draft) : undefined,
      edits,
    });
    windows.set(type, entry);
    active.value = type;
    void loadFirst(record, () => windows.get(type)?.record === record)?.then(
      (loaded) => {
        if (entry.edits && loaded && windows.get(type) === entry)
          applyLoaded(entry);
      },
    );
  }
  // 用户在读取期间有编辑时只更新基准，保留正在编辑的值。
  function applyLoaded(entry: RecordWindow) {
    if (edited(entry.draft, entry.baseline))
      entry.baseline = recordValues(entry.record);
    else resetDraft(entry);
  }
  function resetDraft(entry: RecordWindow) {
    entry.draft = recordDraft(entry.record);
    entry.baseline = recordValues(entry.draft);
  }
  function clearSelection(entry: RecordWindow, discardDraft = false) {
    if (entry.collection.selected === entry.record)
      entry.collection.selected = null;
    if (discardDraft && entry.collection.draft === entry.record)
      entry.collection.draft = null;
  }
  function close(entry: RecordWindow) {
    if (windows.get(entry.type) !== entry) return;
    windows.delete(entry.type);
    clearSelection(entry);
    if (active.value === entry.type) active.value = visible.value.at(-1)?.type;
  }
  function resolveSwitch(discard: boolean) {
    const request = confirm.value;
    confirm.value = undefined;
    if (discard && request) open(request, true);
  }
  function beginEdit(entry: RecordWindow) {
    if (!entry.edits) {
      entry.edits = true;
      resetDraft(entry);
    }
    entry.mode = "edit";
    entry.print = false;
  }
  // 等待保存时可继续编辑，成功后只确认本次提交覆盖的值。
  async function save(entry: RecordWindow, node: ObjectNode) {
    const submitted = recordValues(node);
    const original = draftOrigin(node);
    const result = await runOperation(
      original,
      "update",
      false,
      recordDraft(node),
    );
    if (!result || windows.get(entry.type) !== entry) return;
    const saved = recordDraft(original);
    entry.baseline = updateBaseline(
      entry.draft,
      entry.baseline,
      node,
      recordValues(saved),
    );
    if (edited(node, submitted)) return;
    if (node === entry.draft) entry.draft = saved;
    else node.members = saved.members;
  }
  async function retry(entry: RecordWindow) {
    const current = () => windows.get(entry.type) === entry;
    if (await retryRecord(entry.record, current)) {
      if (entry.edits && current()) applyLoaded(entry);
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

function supportsEditing(record: ObjectNode): boolean {
  return (
    !!record.operations.update ||
    record.members.some(
      (member) => member.kind === "object" && supportsEditing(member),
    )
  );
}
