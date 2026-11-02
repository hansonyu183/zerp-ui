import {
  defineOperation,
  defineBatchPage,
  defineTaskPage,
  type OperationJournal,
  type BatchJournal,
} from "@zerp/ui";
import { convertLegacy } from "./legacy-conversion";
import {
  migrationOwner as owner,
  legacyBatch,
  legacySingle,
  proof,
  authoritativeReceipts,
  type MigrationModel,
  type Request,
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
          return copy(s.records[id ?? s.head ?? ""] ?? null);
        });
      },
      save: async (journal, expected) =>
        update((s) => {
          const old = s.records[s.head ?? ""];
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
      prepare: async (intent) => {
        if (intent.input.value !== "never-sent")
          throw Error("旧已发项不能重新准备。");
        return {
          ...copy(intent),
          requestId: crypto.randomUUID(),
          binding: JSON.stringify(intent),
          concurrency: 8,
          preview: { title: "未发项完整预览", sections: [] },
        };
      },
      acceptsPreparation: (intent, request) =>
        request.binding === JSON.stringify(intent),
      execute: async (request) =>
        update((s) => {
          s.executed.push(request.requestId);
          return proof(request);
        }),
      reconcile: async (request) =>
        update((s) => {
          s.reconciled.push(request.requestId);
          return copy(
            authoritativeReceipts[request.requestId] ?? {
              status: "unknown" as const,
            },
          );
        }),
      seal: async () => ({ status: "unknown" }),
      accepts: (request, receipt) =>
        same(receipt, proof(request)) || same(receipt, proof(request, false)),
      refresh: async () => {},
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
          return atomic(() => copy(read().batch));
        },
        save: async (journal, expected) =>
          update((s) => {
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
