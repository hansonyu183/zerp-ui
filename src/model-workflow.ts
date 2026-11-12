import type { ObjectShape, ModelValue, ModelNode } from "./reactive-model";
import type {
  WorkflowAdapter,
  WorkflowAction,
  WorkflowAttempt,
  WorkflowDefinition,
} from "./workflow";
export const modelWorkflow: unique symbol = Symbol("zerp.model.workflow");
type Action<I, N, R, T, D, K extends WorkflowAction> = {
  disabledReason?: string;
  run(
    attempt: Extract<WorkflowAttempt<I, N, R, T, D>, { operation: K }>,
  ): ReturnType<WorkflowAdapter<I, N, R, T, D, object>["act"]>;
};
export type WorkflowOperations = {
  readonly [modelWorkflow]: { audit: ObjectShape };
};
export function workflowOperations<
  I,
  N,
  R,
  T,
  D,
  A extends ObjectShape,
  E = never,
>(
  audit: A,
  operations: {
    query: {
      disabledReason?: string;
      run: WorkflowAdapter<I, N, R, T, D, ModelValue<A>>["list"];
    };
    get: {
      disabledReason?: string;
      run: WorkflowAdapter<I, N, R, T, D, ModelValue<A>>["get"];
    };
    audit: {
      disabledReason?: string;
      run: WorkflowAdapter<I, N, R, T, D, ModelValue<A>>["audit"];
    };
    createChild?: Action<I, N, R, T, D, "CREATE_CHILD">;
    approveChild?: Action<I, N, R, T, D, "APPROVE_CHILD">;
    rejectChild?: Action<I, N, R, T, D, "REJECT_CHILD">;
    retryChild?: Action<I, N, R, T, D, "RETRY_CHILD">;
    cancelChild?: Action<I, N, R, T, D, "CANCEL_CHILD">;
    openVoucher?: Action<I, N, R, T, D, "OPEN_VOUCHER"> & {
      target(value: D): { node: ModelNode; identity?: unknown };
    };
    reconcile?: WorkflowDefinition<
      I,
      N,
      R,
      T,
      D,
      ModelValue<A>,
      E
    >["reconcile"];
  },
): typeof operations & WorkflowOperations {
  return Object.assign(operations, { [modelWorkflow]: { audit } });
}
