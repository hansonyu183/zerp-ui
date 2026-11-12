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
  type WriteOwner,
  type WritePersistence,
  type WriteJournal,
  type Attempt,
} from "../assembly";
export type Model = {
  [A in TaskAction]: {
    input: { value: string };
    preview: OperationPreview;
    evidence: { requestId: string; binding: string };
  };
};
const copy = <T>(value: T): T => structuredClone(value);
// JSON facts are compared by value, independently of property construction order.
function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const operationKey = (owner: OperationOwner) =>
  `capabilities:${JSON.stringify([owner.scope, owner.operator, owner.resource])}`;
function progress(
  old: { refreshed?: true; completed?: true },
  next: { refreshed?: true; completed?: true },
) {
  if ((old.refreshed && !next.refreshed) || (old.completed && !next.completed))
    throw Error("不能回退完成记录。");
}

function atomic<T>(key: string, work: () => T): Promise<T> {
  return navigator.locks.request(`synthetic-store:${key}`, work);
}
export function operation(
  owner: OperationOwner,
  refresh: (
    request: OperationRequest<Model, string, number>,
  ) => void = () => {},
) {
  const key = operationKey(owner),
    server = `${key}:authority`;
  type Store = {
    head: string | null;
    records: Record<string, OperationJournal<Model, string, number>>;
  };
  const read = (): Store =>
    JSON.parse(localStorage.getItem(key) ?? '{"head":null,"records":{}}');
  type Authority = {
    request: OperationRequest<Model, string, number>;
    receipt?: OperationReceipt<Model>;
  };
  const authorityKey = (id: string) => `${server}:${id}`;
  // This ledger represents the synthetic server, independently of the client's
  // recoverable journal. Real consumers validate against their actual authority.
  function bindingFor(
    request: Omit<OperationRequest<Model, string, number>, "binding">,
  ) {
    return canonical({
      requestId: request.requestId,
      owner: request.owner,
      action: request.action,
      identity: request.identity,
      input: request.input,
      concurrency: request.concurrency,
      preview: request.preview,
    });
  }
  function authority(
    request: OperationRequest<Model, string, number>,
  ): Authority {
    const record = JSON.parse(
      localStorage.getItem(authorityKey(request.requestId)) ?? "null",
    ) as Authority | null;
    if (
      !same(request.owner, owner) ||
      request.binding !== bindingFor(request) ||
      !record ||
      !same(record.request, request)
    )
      throw Error("合成权威原请求不匹配；保持锁定。");
    return record;
  }
  function accepts(
    request: OperationRequest<Model, string, number>,
    result: OperationReceipt<Model>,
  ) {
    try {
      return same(authority(request).receipt, result);
    } catch {
      return false;
    }
  }
  function checkJournal(journal: OperationJournal<Model, string, number>) {
    const record = authority(journal.request);
    if (journal.receipt && !same(record.receipt, journal.receipt))
      throw Error("合成权威回执不匹配；保持锁定。");
  }
  const persistence: OperationPersistence<Model, string, number> = {
    load: async (requestedOwner, id) =>
      atomic(key, () => {
        if (!same(owner, requestedOwner)) throw Error("原请求身份不匹配。");
        const s = read();
        const journal = s.records[id ?? s.head ?? ""] ?? null;
        if (journal) checkJournal(journal);
        return copy(journal);
      }),
    save: async (journal, expected) =>
      atomic(key, () => {
        checkJournal(journal);
        const s = read(),
          old = s.head ? s.records[s.head] : null;
        if (!same(journal.request.owner, owner))
          throw Error("原请求身份不匹配。");
        const id = journal.request.requestId;
        if (expected === null) {
          if ((old && !old.completed) || Object.hasOwn(s.records, id))
            throw Error("已有原请求待核实。");
        } else {
          const prior = s.records[expected];
          if (
            expected !== id ||
            !prior ||
            !same(prior.request, journal.request) ||
            !same(prior.association, journal.association)
          )
            throw Error("原请求已变化。");
          progress(prior, journal);
          if (
            prior.receipt &&
            (!journal.receipt ||
              prior.receipt.status !== journal.receipt.status ||
              // Only sealing an unsealed not-applied receipt may change its proof.
              (!(
                prior.receipt.status === "not-applied" &&
                !prior.receipt.sealed &&
                journal.receipt.status === "not-applied" &&
                journal.receipt.sealed
              ) &&
                !same(prior.receipt, journal.receipt)))
          )
            throw Error("不能回退原请求终态。");
          if (s.head !== expected) {
            if (prior.completed && same(prior, journal)) return;
            throw Error("原请求已变化。");
          }
        }
        if (
          (journal.refreshed &&
            (!journal.receipt ||
              (journal.receipt.status === "not-applied" &&
                !journal.receipt.sealed))) ||
          (journal.completed && !journal.refreshed)
        )
          throw Error("原请求尚未完成。");
        s.head = id;
        s.records[id] = copy(journal);
        localStorage.setItem(key, JSON.stringify(s));
      }),
    remove: async (requestedOwner, id) =>
      atomic(key, () => {
        const s = read(),
          j = s.records[id];
        if (!same(owner, requestedOwner)) throw Error("原请求身份不匹配。");
        if (j) checkJournal(j);
        if (
          !j?.receipt ||
          !j.refreshed ||
          (j.receipt.status === "not-applied" && !j.receipt.sealed)
        )
          throw Error("原请求尚未完成。");
        if (j.completed) return;
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
      prepare: async (intent) => {
        const facts = {
          ...copy(intent),
          requestId: crypto.randomUUID(),
          concurrency: 1,
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
        };
        const request = {
          ...facts,
          binding: bindingFor(facts),
        } as OperationRequest<Model, string, number>;
        localStorage.setItem(
          authorityKey(request.requestId),
          JSON.stringify({ request }),
        );
        return request;
      },
      acceptsPreparation: (intent, request) => {
        try {
          authority(request);
          return same(intent, {
            owner: request.owner,
            action: request.action,
            identity: request.identity,
            input: request.input,
          });
        } catch {
          return false;
        }
      },
      execute: async (request) =>
        atomic(server, () => {
          const original = authority(request);
          const result = original.receipt ?? receipt(original.request);
          localStorage.setItem(
            authorityKey(request.requestId),
            JSON.stringify({ ...original, receipt: result }),
          );
          return request.input.value === "unknown"
            ? { status: "unknown" as const }
            : result;
        }),
      reconcile: async (request) =>
        authority(request).receipt ?? { status: "unknown" },
      seal: async (request) =>
        atomic(server, () => {
          const original = authority(request);
          if (original.receipt) return copy(original.receipt);
          const result = receipt(original.request, false);
          localStorage.setItem(
            authorityKey(request.requestId),
            JSON.stringify({ ...original, receipt: result }),
          );
          return result;
        }),
      accepts,
      refresh: async (settlement) => {
        if (!accepts(settlement.request, settlement.receipt))
          throw Error("合成权威回执不匹配；保持锁定。");
        if (settlement.receipt.status === "applied")
          refresh(copy(settlement.request));
      },
    },
  });
}
export function batches(
  owner: OperationOwner,
): BatchPersistence<Model, string, number> {
  const key = `batch:${operationKey(owner)}`;
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
  type Journal = WriteJournal<Attempt<{ name: string }, string>>;
  type Store = { head: string | null; records: Record<string, Journal> };
  const keyFor = (owner: WriteOwner) =>
    `capabilities:crud:${JSON.stringify([owner.scope, owner.resource])}`;
  const read = (key: string): Store =>
    JSON.parse(localStorage.getItem(key) ?? '{"head":null,"records":{}}');
  return {
    load: async (owner, id) => {
      const key = keyFor(owner);
      return atomic(key, () => {
        const store = read(key);
        return copy(store.records[id ?? store.head ?? ""] ?? null);
      });
    },
    save: async (journal, expected) => {
      const key = keyFor(journal.attempt);
      return atomic(key, () => {
        const store = read(key),
          head = store.head ? store.records[store.head] : null,
          id = journal.attempt.id;
        if (expected === null) {
          if ((head && !head.completed) || Object.hasOwn(store.records, id))
            throw Error("已有原请求待核实。");
        } else {
          const prior = store.records[expected];
          if (
            expected !== id ||
            !prior ||
            !same(prior.attempt, journal.attempt) ||
            (prior.outcome && !same(prior.context, journal.context))
          )
            throw Error("原请求已变化。");
          progress(prior, journal);
          if (prior.outcome && prior.outcome !== journal.outcome)
            throw Error("不能回退原请求终态。");
          if (store.head !== expected) {
            if (prior.completed && same(prior, journal)) return;
            throw Error("原请求已变化。");
          }
        }
        if (
          (journal.refreshed && !journal.outcome) ||
          (journal.completed && !journal.refreshed)
        )
          throw Error("原请求尚未完成。");
        store.head = id;
        store.records[id] = copy(journal);
        localStorage.setItem(key, JSON.stringify(store));
      });
    },
    complete: async (owner, id) => {
      const key = keyFor(owner);
      return atomic(key, () => {
        const store = read(key),
          old = store.records[id];
        if (!old?.outcome || !old.refreshed) throw Error("原请求尚未完成。");
        if (old.completed) return;
        store.records[id] = { ...old, completed: true };
        localStorage.setItem(key, JSON.stringify(store));
      });
    },
  };
}
