import type { DeepReadonly } from "vue";
import type { Column, Fields, Page } from "./contracts";
import type {
  DocumentAdapter,
  DocumentAttempt,
  StageAttempt,
  DocumentReconciliation,
} from "./document";
export type VoucherIdentity<I, R, U> = Readonly<{
  voucher: I;
  revision: R;
  submission: DeepReadonly<U> | null;
}>;
export type VoucherSnapshot<D, I, R, U, S, O, H> = {
  identity: VoucherIdentity<I, R, U>;
  number: string;
  handler: string;
  state: S;
  values: D;
  owner: O;
  attachments: readonly { label: string; handle: H }[];
  eligible: { edit?: boolean; clone?: boolean; approve?: boolean };
};
export type VoucherArchive<D, I, R, U, S, O, H, A> = {
  current: VoucherSnapshot<D, I, R, U, S, O, H> | null;
  history: readonly VoucherSnapshot<D, I, R, U, S, O, H>[];
  audit: readonly A[];
};
export type VoucherAttempt<D extends object, I, R, U, S, H> = Extract<
  DocumentAttempt<D, VoucherIdentity<I, R, U>, S, H>,
  { operation: "submit" | "approve" }
>;
export type VoucherStageAttempt<I, R, U, S, O> = StageAttempt<
  VoucherIdentity<I, R, U>,
  S,
  O
>;
export type VoucherReconciliation<H, E> = DocumentReconciliation<H, E>;
export type VoucherAdapter<D extends object, I, R, U, S, O, H, A> = {
  list(input: { scope: string; page: number; pageSize: number }): Promise<
    Page<{
      identity: VoucherIdentity<I, R, U>;
      number: string;
      handler: string;
    }>
  >;
  get(input: {
    scope: string;
    identity: VoucherIdentity<I, R, U>;
  }): Promise<VoucherArchive<D, I, R, U, S, O, H, A>>;
  /** Local preparation only; no business write. Consumer allocates the exact new identity. */
  empty?(input: { scope: string }): VoucherSnapshot<D, I, R, U, S, O, H>;
  clone?(input: {
    scope: string;
    source: VoucherSnapshot<D, I, R, U, S, O, H>;
  }): VoucherSnapshot<D, I, R, U, S, O, H>;
  submit: DocumentAdapter<D, VoucherIdentity<I, R, U>, S, O, H, A>["submit"];
  approve?: DocumentAdapter<D, VoucherIdentity<I, R, U>, S, O, H, A>["approve"];
  attachments?: DocumentAdapter<
    D,
    VoucherIdentity<I, R, U>,
    S,
    O,
    H,
    A
  >["attachments"];
};
export type VoucherDefinition<
  D extends object,
  I,
  R,
  U,
  S,
  O,
  H,
  A extends object,
  E = never,
> = {
  protocol: "submission";
  resource: string;
  title: string;
  fields: Fields<D>;
  auditColumns: readonly Column<A>[];
  adapter: VoucherAdapter<D, I, R, U, S, O, H, A>;
  reconcile?(
    attempt:
      VoucherAttempt<D, I, R, U, S, H> | VoucherStageAttempt<I, R, U, S, O>,
  ): Promise<VoucherReconciliation<H, E>>;
};
export function defineVoucher<
  D extends object,
  I,
  R,
  U,
  S,
  O,
  H,
  A extends object,
  E = never,
>(
  definition: VoucherDefinition<D, I, R, U, S, O, H, A, E>,
): VoucherDefinition<D, I, R, U, S, O, H, A, E> {
  return definition;
}
