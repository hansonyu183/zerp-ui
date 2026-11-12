import type { OperationModel, OperationDefinition } from "./operation";
import type { BatchEntry, BatchPersistence } from "./batch";
export const modelBatch: unique symbol = Symbol("zerp.model.batch");
export type ModelBatchOperation<M extends OperationModel, I, B> = {
  disabledReason?: string;
  /** A fresh authoritative proposal is frozen by the runtime only on explicit start. */
  entries: readonly BatchEntry<M, I>[];
  persistence: OperationDefinition<M, I, B>["persistence"];
  journal: BatchPersistence<M, I, B>;
  run: OperationDefinition<M, I, B>["adapter"]["execute"];
} & Omit<OperationDefinition<M, I, B>["adapter"], "execute">;
export type BatchOperations = { readonly [modelBatch]: true };
export function batchOperations<M extends OperationModel, I, B>(
  operation: ModelBatchOperation<M, I, B>,
): BatchOperations & { executeBatch: ModelBatchOperation<M, I, B> } {
  return { [modelBatch]: true, executeBatch: operation };
}
