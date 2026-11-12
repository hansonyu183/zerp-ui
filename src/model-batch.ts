import type { OperationModel } from "./operation";
import type { BatchEntry, BatchPersistence } from "./batch";
import type {
  ModelOperationCallbacks,
  ModelOperationPersistence,
} from "./model-operation";
export const modelBatch: unique symbol = Symbol("zerp.model.batch");
export type ModelBatchOperation<
  M extends OperationModel,
  I,
  B,
  P extends readonly unknown[] = readonly [],
> = {
  disabledReason?: string;
  /** A fresh authoritative proposal is frozen by the runtime only on explicit start. */
  entries: readonly BatchEntry<M, I>[];
  persistence: ModelOperationPersistence<M, I, B, P>;
  journal: BatchPersistence<M, I, B>;
} & ModelOperationCallbacks<M, I, B, P>;
export type BatchOperations<
  I = unknown,
  P extends readonly unknown[] = readonly unknown[],
> = {
  readonly [modelBatch]: {
    identity?: (value: I) => I;
    ancestors?: (value: P) => P;
  };
};
export function batchOperations<
  M extends OperationModel,
  I,
  B,
  P extends readonly unknown[] = readonly [],
>(
  operation: ModelBatchOperation<M, I, B, P>,
): BatchOperations<I, P> & { executeBatch: ModelBatchOperation<M, I, B, P> } {
  return { [modelBatch]: {}, executeBatch: operation };
}
