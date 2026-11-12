import {
  defineOperation,
  defineBatchPage,
  defineTaskPage,
  type OperationJournal,
  type BatchJournal,
} from "../assembly";
import { convertLegacy } from "./legacy-conversion";
import {
  migrationOwner as owner,
  legacyBatch,
  legacySingle,
  proof,
  authoritativeOriginals,
  authoritativeReceipts,
  type MigrationModel,
  type Request,
  type Receipt,
} from "./migration-fixtures";
type Journal = OperationJournal<MigrationModel, string, number>;
type Store = {
  source: string;
  head: string | null;
  records: Record<string, Journal>;
  batch: BatchJournal<MigrationModel, string, number> | null;
  executed: string[];
  reconciled: string[];
};
const copy = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
/** One combined durable synthetic artifact makes conversion installation atomic. No real data. */
export function migrationPage(
  kind: "batch" | "single",
  suppliedSource?: string,
) {
  const key = `synthetic-migration:${kind}`;
  const read = (): Store => JSON.parse(localStorage.getItem(key)!);
  const atomic = <T>(work: () => T): Promise<T> =>
    navigator.locks.request(key, work);
  type Authority = { request: Request; receipt?: Receipt };
  const authorityKey = `${key}:authority`;
  const prepared = (): Record<string, Authority> =>
    JSON.parse(localStorage.getItem(authorityKey) ?? "{}");
  const unsent = legacyBatch.entries.find(
    (entry) => entry.status === "never-sent",
  )!;
  function authority(request: Request): Authority {
    const original = authoritativeOriginals.find(
      (known) => known.requestId === request.requestId,
    );
    const record = original
      ? {
          request: original,
          receipt: authoritativeReceipts[original.requestId],
        }
      : prepared()[request.requestId];
    const belongsToPage = original
      ? (kind === "single") ===
        (original.requestId === legacySingle.original.requestId)
      : kind === "batch";
    if (!record || !belongsToPage || !same(record.request, request))
      throw Error("迁移权威原请求不匹配；保持锁定。");
    return record;
  }
  function accepts(request: Request, receipt: Receipt) {
    try {
      return same(authority(request).receipt, receipt);
    } catch {
      return false;
    }
  }
  function checkJournal(journal: Journal) {
    authority(journal.request);
    const expectedAssociation =
      kind === "single"
        ? undefined
        : (legacyBatch.entries.find(
            (entry) => entry.original?.requestId === journal.request.requestId,
          )?.association ?? {
            kind: "batch",
            batchId: legacyBatch.id,
            entryKey: unsent.key,
          });
    if (
      !same(journal.association, expectedAssociation) ||
      (journal.receipt && !accepts(journal.request, journal.receipt))
    )
      throw Error("迁移权威关联或回执不匹配；保持锁定。");
  }
  function checkBatch(batch: Store["batch"]) {
    if (!batch) throw Error("迁移批次记录缺失；保持锁定。");
    for (const entry of batch.entries)
      if (entry.settlement) checkJournal(entry.settlement);
  }
  const update = <T>(work: (store: Store) => T) =>
    atomic(() => {
      const store = read();
      const result = work(store);
      localStorage.setItem(key, JSON.stringify(store));
      return result;
    });
  const initialize = () =>
    atomic(() => {
      if (localStorage.getItem(key)) return;
      const source =
        suppliedSource ??
        localStorage.getItem(`${key}:import`) ??
        JSON.stringify(kind === "batch" ? legacyBatch : legacySingle);
      const result = convertLegacy(source, owner);
      // Preserve raw source even on refusal, independently of the converted store.
      localStorage.setItem(`${key}:source`, source);
      if (result.status === "refused") throw Error(result.reason);
      const records = Object.fromEntries(
        result.value.journals.map((j) => [j.request.requestId, j]),
      );
      const head =
        result.value.journals.find((j) => !j.completed)?.request.requestId ??
        result.value.journals.at(-1)?.request.requestId ??
        null;
      localStorage.setItem(
        key,
        JSON.stringify({
          source,
          head,
          records,
          batch: result.value.batch ?? null,
          executed: [],
          reconciled: [],
        } satisfies Store),
      );
    });
  const definition = defineOperation<MigrationModel, string, number>({
    protocol: "operation",
    persistence: {
      load: async (_owner, id) => {
        await initialize();
        return atomic(() => {
          const s = read();
          if (!same(_owner, owner)) throw Error("迁移恢复身份不匹配。");
          const journal = s.records[id ?? s.head ?? ""] ?? null;
          if (journal) checkJournal(journal);
          return copy(journal);
        });
      },
      save: async (journal, expected) =>
        update((s) => {
          checkJournal(journal);
          const old = s.records[s.head ?? ""];
          if (old) checkJournal(old);
          if (expected === null ? old && !old.completed : s.head !== expected)
            throw Error("原请求已变化。");
          if (
            expected !== null &&
            old &&
            (!same(old.request, journal.request) ||
              !same(old.association, journal.association) ||
              (old.receipt && !same(old.receipt, journal.receipt)) ||
              (old.refreshed && !journal.refreshed) ||
              (old.completed && !journal.completed))
          )
            throw Error("不能修改原请求或回退证据。");
          s.head = journal.request.requestId;
          s.records[s.head] = copy(journal);
        }),
      remove: async (_owner, id) =>
        update((s) => {
          const old = s.records[id];
          if (!same(_owner, owner)) throw Error("迁移恢复身份不匹配。");
          if (old) checkJournal(old);
          if (old?.completed) return;
          if (
            !old?.refreshed ||
            !old.receipt ||
            (old.receipt.status === "not-applied" && !old.receipt.sealed)
          )
            throw Error("原请求未完成。");
          s.records[id] = { ...old, completed: true };
        }),
    },
    adapter: {
      prepare: async (intent) =>
        atomic(() => {
          if (kind !== "batch" || !same(intent, unsent.intent))
            throw Error("旧已发项不能重新准备。");
          const facts = {
            ...copy(intent),
            requestId: crypto.randomUUID(),
            concurrency: 8,
            preview: { title: "未发项完整预览", sections: [] },
          };
          const request = { ...facts, binding: JSON.stringify(facts) };
          const records = prepared();
          records[request.requestId] = { request };
          localStorage.setItem(authorityKey, JSON.stringify(records));
          return request;
        }),
      acceptsPreparation: (intent, request) => {
        try {
          return (
            same(intent, unsent.intent) &&
            same(authority(request).request, request)
          );
        } catch {
          return false;
        }
      },
      execute: async (request) =>
        update((s) => {
          const record = authority(request);
          if (record.receipt) return copy(record.receipt);
          const receipt = proof(request);
          const records = prepared();
          records[request.requestId] = { request: copy(request), receipt };
          localStorage.setItem(authorityKey, JSON.stringify(records));
          s.executed.push(request.requestId);
          return copy(receipt);
        }),
      reconcile: async (request) =>
        update((s) => {
          const record = authority(request);
          s.reconciled.push(request.requestId);
          return copy(record.receipt ?? { status: "unknown" as const });
        }),
      seal: async (request) => {
        authority(request);
        return { status: "unknown" };
      },
      accepts,
      refresh: async ({ request, receipt }) => {
        if (!accepts(request, receipt))
          throw Error("迁移权威原请求或回执不匹配；保持锁定。");
      },
    },
  });
  if (kind === "batch")
    return defineBatchPage({
      title: "合成旧批次转换",
      owner,
      definition,
      entries: [],
      eligible: true,
      recoveryAllowed: true,
      persistence: {
        load: async () => {
          await initialize();
          return atomic(() => {
            const batch = read().batch;
            checkBatch(batch);
            return copy(batch);
          });
        },
        save: async (journal, expected) =>
          update((s) => {
            checkBatch(journal);
            checkBatch(s.batch);
            if (s.batch?.id !== expected) throw Error("批次已变化。");
            s.batch = copy(journal);
          }),
      },
    });
  const request: Request = legacySingle.original;
  return defineTaskPage<{ value: string }, MigrationModel, string, number>({
    title: "合成单据原请求转换",
    instance: "migrated-single",
    owner,
    identity: request.identity,
    definition,
    values: request.input,
    fields: [],
    actions: ["process"],
    toIntent: (value, action, base) => ({ ...base, action, input: value }),
    eligible: false,
    recoveryAllowed: true,
  });
}
