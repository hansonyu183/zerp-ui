import {
  defineOperation,
  type TaskAction,
  type OperationPreview,
  type OperationOwner,
  type OperationJournal,
  type OperationPersistence,
  type OperationRequest,
  type OperationReceipt,
  type BatchPersistence,
  type BatchJournal,
  type WritePersistence,
  type WriteJournal,
  type Attempt,
} from "@zerp/ui";
export type Model = {
  [A in TaskAction]: {
    input: { value: string };
    preview: OperationPreview;
    evidence: { requestId: string; binding: string };
  };
};
const copy = <T>(value: T): T => structuredClone(value);
function atomic<T>(key: string, work: () => T): Promise<T> {
  return navigator.locks.request(`synthetic-store:${key}`, work);
}
export function operation(
  owner: OperationOwner,
  refresh: (
    request: OperationRequest<Model, string, number>,
  ) => void = () => {},
) {
  const key = `capabilities:${owner.resource}`,
    server = `${key}:authority`;
  type Store = {
    head: string | null;
    records: Record<string, OperationJournal<Model, string, number>>;
  };
  const read = (): Store =>
    JSON.parse(localStorage.getItem(key) ?? '{"head":null,"records":{}}');
  const persistence: OperationPersistence<Model, string, number> = {
    load: async (_owner, id) =>
      atomic(key, () => {
        const s = read();
        return copy(s.records[id ?? s.head ?? ""] ?? null);
      }),
    save: async (journal, expected) =>
      atomic(key, () => {
        const s = read(),
          old = s.head ? s.records[s.head] : null;
        if (expected === null) {
          if (old && !old.completed) throw Error("已有原请求待核实。");
        } else if (s.head !== expected) throw Error("原请求已变化。");
        s.head = journal.request.requestId;
        s.records[s.head] = copy(journal);
        localStorage.setItem(key, JSON.stringify(s));
      }),
    remove: async (_owner, id) =>
      atomic(key, () => {
        const s = read(),
          j = s.records[id];
        if (s.head !== id || !j?.receipt || !j.refreshed)
          throw Error("原请求尚未完成。");
        s.records[id] = { ...j, completed: true };
        localStorage.setItem(key, JSON.stringify(s));
      }),
  };
  const receipt = (
    request: OperationRequest<Model, string, number>,
    applied = true,
  ): OperationReceipt<Model> =>
    ({
      status: applied ? "applied" : "not-applied",
      ...(applied ? {} : { sealed: true }),
      action: request.action,
      owner: copy(request.owner),
      requestId: request.requestId,
      binding: request.binding,
      evidence: { requestId: request.requestId, binding: request.binding },
    }) as OperationReceipt<Model>;
  return defineOperation<Model, string, number>({
    protocol: "operation",
    persistence,
    adapter: {
      prepare: async (intent) => ({
        ...copy(intent),
        requestId: crypto.randomUUID(),
        concurrency: 1,
        binding: JSON.stringify(intent),
        preview: {
          title: "核对完整输入",
          sections: [
            {
              key: "content",
              title: "本次内容",
              rows: [
                {
                  key: "value",
                  fields: [{ label: "内容", value: intent.input.value }],
                },
              ],
            },
          ],
        },
      }),
      acceptsPreparation: (intent, request) =>
        request.binding === JSON.stringify(intent),
      execute: async (request) => {
        const result = receipt(request);
        localStorage.setItem(
          `${server}:${request.requestId}`,
          JSON.stringify(result),
        );
        return request.input.value === "unknown"
          ? { status: "unknown" }
          : result;
      },
      reconcile: async (request) =>
        JSON.parse(
          localStorage.getItem(`${server}:${request.requestId}`) ?? "null",
        ) ?? { status: "unknown" },
      seal: async (request) => {
        const prior = localStorage.getItem(`${server}:${request.requestId}`);
        if (prior) return JSON.parse(prior);
        const result = receipt(request, false);
        localStorage.setItem(
          `${server}:${request.requestId}`,
          JSON.stringify(result),
        );
        return result;
      },
      accepts: (request, result) =>
        request.requestId === result.evidence.requestId &&
        request.binding === result.evidence.binding,
      refresh: async (settlement) => {
        if (settlement.receipt.status === "applied")
          refresh(copy(settlement.request));
      },
    },
  });
}
export function batches(
  owner: OperationOwner,
): BatchPersistence<Model, string, number> {
  const key = `batch:${owner.resource}`;
  return {
    load: async () => JSON.parse(localStorage.getItem(key) ?? "null"),
    save: async (journal, expected) =>
      atomic(key, () => {
        const old = JSON.parse(
          localStorage.getItem(key) ?? "null",
        ) as BatchJournal<Model, string, number> | null;
        if ((old?.id ?? null) !== expected) throw Error("批次已变化。");
        localStorage.setItem(key, JSON.stringify(journal));
      }),
  };
}
export function recovery(): WritePersistence<
  Attempt<{ name: string }, string>
> {
  const key = "capabilities:crud";
  return {
    load: async () => JSON.parse(localStorage.getItem(key) ?? "null"),
    save: async (journal, expected) =>
      atomic(key, () => {
        const old = JSON.parse(
          localStorage.getItem(key) ?? "null",
        ) as WriteJournal<Attempt<{ name: string }, string>> | null;
        if (
          expected === null
            ? old && !old.completed
            : old?.attempt.id !== expected
        )
          throw Error("原请求已变化。");
        localStorage.setItem(key, JSON.stringify(journal));
      }),
    complete: async (_owner, id) =>
      atomic(key, () => {
        const old = JSON.parse(
          localStorage.getItem(key) ?? "null",
        ) as WriteJournal<Attempt<{ name: string }, string>>;
        if (old?.attempt.id !== id || !old.outcome || !old.refreshed)
          throw Error("原请求尚未完成。");
        localStorage.setItem(key, JSON.stringify({ ...old, completed: true }));
      }),
  };
}
