import type { OperationOwner, OperationPersistence } from "@zerp/ui";
import {
  decodeJournal,
  type SyntheticModel,
  type Identity,
  type Baseline,
  type SyntheticJournal,
} from "./operation-adapter";
// This synthetic consumer owns its storage schema and atomic transactions.
export function operationJournal() {
  let opened: Promise<IDBDatabase> | undefined;
  const database = () =>
    (opened ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("zerp-ui-synthetic-operations", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("requests");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onblocked = () => reject(new Error("合成存储升级被其它页面占用"));
    }));
  const key = (owner: OperationOwner) =>
    JSON.stringify([owner.scope, owner.operator, owner.resource]);
  async function transaction(
    owner: OperationOwner,
    mode: IDBTransactionMode,
    apply: (
      store: IDBObjectStore,
      record: SyntheticJournal | null,
    ) => SyntheticJournal | null,
    requestId?: string,
  ) {
    const db = await database();
    return new Promise<SyntheticJournal | null>((resolve, reject) => {
      const tx = db.transaction("requests", mode, { durability: "strict" }),
        store = tx.objectStore("requests");
      let result: SyntheticJournal | null = null,
        failure: unknown;
      const read = store.get(
        requestId ? `${key(owner)}:request:${requestId}` : key(owner),
      );
      read.onsuccess = () => {
        try {
          result = apply(
            store,
            read.result === undefined ? null : decodeJournal(read.result),
          );
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(failure ?? tx.error ?? new Error("合成原请求事务失败"));
    });
  }
  const persistence: OperationPersistence<SyntheticModel, Identity, Baseline> =
    {
      async load(owner, requestId) {
        return transaction(
          owner,
          "readonly",
          (_store, record) => record,
          requestId,
        );
      },
      async save(record, expectedId) {
        const checked = decodeJournal(record);
        await transaction(
          checked.request.owner,
          "readwrite",
          (store, existing) => {
            if (
              (existing && !existing.completed
                ? existing.request.requestId
                : null) !== expectedId
            )
              throw new Error("原请求槽已占用或发生并发变化");
            if (
              expectedId !== null &&
              existing &&
              existing.request.binding !== checked.request.binding
            )
              throw new Error("拒绝改写原请求完整输入");
            if (
              expectedId !== null &&
              existing?.receipt?.status === "applied" &&
              checked.receipt?.status !== "applied"
            )
              throw new Error("拒绝回退已应用回执");
            if (
              expectedId !== null &&
              existing?.receipt?.status === "not-applied" &&
              existing.receipt.sealed &&
              (checked.receipt?.status !== "not-applied" ||
                !checked.receipt.sealed)
            )
              throw new Error("拒绝回退已封存回执");
            if (
              expectedId !== null &&
              existing?.refreshed &&
              !checked.refreshed
            )
              throw new Error("拒绝回退读取完成记录");
            store.put(checked, key(checked.request.owner));
            store.put(
              checked,
              `${key(checked.request.owner)}:request:${checked.request.requestId}`,
            );
            return checked;
          },
        );
      },
      async remove(owner, expectedId) {
        await transaction(owner, "readwrite", (store, existing) => {
          if (existing?.request.requestId !== expectedId)
            throw new Error("拒绝删除另一原请求");
          if (!existing.refreshed)
            throw new Error("拒绝清理未完成读取的原请求");
          const completed = decodeJournal({ ...existing, completed: true });
          store.put(completed, key(owner));
          store.put(completed, `${key(owner)}:request:${expectedId}`);
          return completed;
        });
      },
    };
  return {
    persistence,
    close() {
      if (opened) void opened.then((db) => db.close());
    },
  };
}
