import type { DeepReadonly } from "vue";
import type { Column, Fields, Page } from "./contracts";
import type {
  VersionAdapter,
  VersionAttempt,
  StageAttempt,
  VersionReconciliation,
} from "./version";
export type DocumentIdentity<I, R, U> = Readonly<{
  document: I;
  revision: R;
  submission: DeepReadonly<U> | null;
}>;
export type DocumentSnapshot<D, I, R, U, S, O, H> = {
  identity: DocumentIdentity<I, R, U>;
  number: string;
  handler: string;
  state: S;
  values: D;
  owner: O;
  attachments: readonly { label: string; handle: H }[];
  eligible: { edit?: boolean; clone?: boolean; approve?: boolean };
};
export type DocumentArchive<D, I, R, U, S, O, H, A> = {
  current: DocumentSnapshot<D, I, R, U, S, O, H> | null;
  history: readonly DocumentSnapshot<D, I, R, U, S, O, H>[];
  audit: readonly A[];
};
export type DocumentAttempt<D extends object, I, R, U, S, H> = Extract<
  VersionAttempt<D, DocumentIdentity<I, R, U>, S, H>,
  { operation: "submit" | "approve" }
>;
export type DocumentStageAttempt<I, R, U, S, O> = StageAttempt<
  DocumentIdentity<I, R, U>,
  S,
  O
>;
export type DocumentReconciliation<H, E> = VersionReconciliation<H, E>;
export type DocumentAdapter<D extends object, I, R, U, S, O, H, A> = {
  list(input: { scope: string; page: number; pageSize: number }): Promise<
    Page<{
      identity: DocumentIdentity<I, R, U>;
      number: string;
      handler: string;
    }>
  >;
  get(input: {
    scope: string;
    identity: DocumentIdentity<I, R, U>;
  }): Promise<DocumentArchive<D, I, R, U, S, O, H, A>>;
  /** Local preparation only; no business write. Consumer allocates the exact new identity. */
  empty?(input: { scope: string }): DocumentSnapshot<D, I, R, U, S, O, H>;
  clone?(input: {
    scope: string;
    source: DocumentSnapshot<D, I, R, U, S, O, H>;
  }): DocumentSnapshot<D, I, R, U, S, O, H>;
  submit: VersionAdapter<D, DocumentIdentity<I, R, U>, S, O, H, A>["submit"];
  approve?: VersionAdapter<D, DocumentIdentity<I, R, U>, S, O, H, A>["approve"];
  attachments?: VersionAdapter<
    D,
    DocumentIdentity<I, R, U>,
    S,
    O,
    H,
    A
  >["attachments"];
};
export type DocumentDefinition<
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
  resource: string;
  title: string;
  fields: Fields<D>;
  auditColumns: readonly Column<A>[];
  adapter: DocumentAdapter<D, I, R, U, S, O, H, A>;
  reconcile?(
    attempt:
      DocumentAttempt<D, I, R, U, S, H> | DocumentStageAttempt<I, R, U, S, O>,
  ): Promise<DocumentReconciliation<H, E>>;
};
export function defineDocument<
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
  definition: DocumentDefinition<D, I, R, U, S, O, H, A, E>,
): DocumentDefinition<D, I, R, U, S, O, H, A, E> {
  return definition;
}
