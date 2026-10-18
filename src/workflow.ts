import type { Column, Page, ReconcileResult, WriteResult } from "./contracts";
export type WorkflowAction =
  | "OPEN_VOUCHER"
  | "CREATE_CHILD"
  | "APPROVE_CHILD"
  | "REJECT_CHILD"
  | "RETRY_CHILD"
  | "CANCEL_CHILD";
export type WorkflowNode<N, R, T, D> = {
  identity: N;
  revision: R;
  label: string;
  state: string;
  voucher?: D;
  /** Authoritative backend facts, still rechecked by the backend on execution. */
  eligible: readonly WorkflowAction[];
  targets: readonly { key: string; label: string; identity: T }[];
};
export type WorkflowInstance<I, N, R, T, D> = {
  identity: I;
  label: string;
  nodes: readonly WorkflowNode<N, R, T, D>[];
};
export type WorkflowAttempt<I, N, R, T, D> = Readonly<{
  id: string;
  scope: string;
  resource: string;
  instance: I;
  node: N;
  revision: R;
  reason: string;
}> &
  (
    | Readonly<{ operation: "CREATE_CHILD"; target: T }>
    | Readonly<{ operation: "OPEN_VOUCHER"; voucher: D }>
    | Readonly<{
        operation: Exclude<WorkflowAction, "CREATE_CHILD" | "OPEN_VOUCHER">;
      }>
  );
export type WorkflowAdapter<I, N, R, T, D, A extends object> = {
  list(input: {
    scope: string;
    keyword: string;
    page: number;
    pageSize: number;
  }): Promise<Page<{ identity: I; label: string }>>;
  get(input: {
    scope: string;
    identity: I;
  }): Promise<WorkflowInstance<I, N, R, T, D>>;
  audit(input: { scope: string; identity: I }): Promise<readonly A[]>;
  act(attempt: WorkflowAttempt<I, N, R, T, D>): Promise<WriteResult>;
};
export type WorkflowDefinition<I, N, R, T, D, A extends object, E = never> = {
  resource: string;
  title: string;
  auditColumns: readonly Column<A>[];
  adapter: WorkflowAdapter<I, N, R, T, D, A>;
  /** Only return a conclusive result after matching authoritative audit evidence
   * to this exact attempt: id/scope/instance/node/revision/action and input.
   * Historical similar actions or lack of audit visibility must remain unknown. */
  reconcile?(
    attempt: WorkflowAttempt<I, N, R, T, D>,
  ): Promise<ReconcileResult<E>>;
};
export function defineWorkflow<I, N, R, T, D, A extends object, E = never>(
  definition: WorkflowDefinition<I, N, R, T, D, A, E>,
): WorkflowDefinition<I, N, R, T, D, A, E> {
  return definition;
}
