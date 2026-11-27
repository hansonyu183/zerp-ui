import {
  computed,
  onBeforeUnmount,
  shallowReactive,
  shallowRef,
  toRaw,
  watch,
} from "vue";
import type { ListCollection, ObjectNode } from "./business-model";
import { readable } from "./business-nodes";
import { loadFirst, retryRecord, runOperation } from "./business-operations";
import {
  applicationModel,
  modelVersion,
  sessionScope,
  sessionState,
} from "./business-session";
import {
  draftOrigin,
  edited,
  recordDraft,
  recordValues,
  updateBaseline,
} from "./record-draft";

type Request = {
  collection: ListCollection;
  record: ObjectNode;
  mode: "read" | "edit";
  focus?: () => HTMLElement | null;
  print?: boolean;
};

export type RecordWindow = Request & {
  type: string;
  key: number;
  printKey: number;
  draft: ObjectNode;
  baseline: unknown;
  edits: boolean;
};

const controller = shallowRef<ReturnType<typeof createWindows>>();

export function openRecord(request: Request) {
  controller.value?.open(request);
}

export function useRecordWindows() {
  const windows = createWindows();
  controller.value = windows;
  onBeforeUnmount(() => {
    controller.value = undefined;
  });
  return windows;
}

function createWindows() {
  const windows = shallowReactive(new Map<string, RecordWindow>());
  let key = 0;
  const active = shallowRef<string>();
  const confirm = shallowRef<Request>();
  const visible = computed(() =>
    [...windows.values()].filter((entry) => readable(entry.record)),
  );

  watch(
    [modelVersion, sessionScope, sessionState],
    () => {
      windows.clear();
      active.value = undefined;
      confirm.value = undefined;
    },
    { flush: "sync" },
  );

  function open(request: Request, discard = false) {
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
