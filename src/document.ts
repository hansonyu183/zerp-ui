import type { Fields, Column, WriteResult } from "./contracts";
export type DocumentAction = "approve" | "enable" | "disable";
export type DocumentSnapshot<D, I, S, O, H> = {
  label: string;
  identity: I;
  state: S;
  values: D;
  owner: O;
  attachments: readonly { label: string; handle: H }[];
  eligible: {
    edit?: boolean;
    approve?: boolean;
    enable?: boolean;
    disable?: boolean;
  };
};
export type DocumentArchive<D, I, S, O, H, A> = {
  official: DocumentSnapshot<D, I, S, O, H> | null;
  candidate: DocumentSnapshot<D, I, S, O, H> | null;
  history: readonly DocumentSnapshot<D, I, S, O, H>[];
  audit: readonly A[];
};
type Base<I, S> = Readonly<{
  id: string;
  scope: string;
  resource: string;
  identity: I;
  state: S;
}>;
export type StageAttempt<I, S, O> = Base<I, S> &
  Readonly<{
    operation: "stage";
    owner: O;
    fileId: string;
    file: File;
  }>;
export type DocumentAttempt<D, I, S, H> = Base<I, S> &
  (
    | Readonly<{ operation: "submit"; input: D; attachments: readonly H[] }>
    | { [K in DocumentAction]: Readonly<{ operation: K }> }[DocumentAction]
  );
export type DocumentReconciliation<H, E> =
  | { status: "unknown" }
  | {
      status: "not-applied" | "applied";
      attemptId: string;
      evidence: E;
      operation: "business";
    }
  | {
      status: "applied";
      attemptId: string;
      evidence: E;
      operation: "stage";
      handle: H;
    }
  | {
      status: "not-applied";
      attemptId: string;
      evidence: E;
      operation: "stage";
    };
export type DocumentAdapter<D extends object, I, S, O, H, A> = {
  query(input: { scope: string }): Promise<DocumentArchive<D, I, S, O, H, A>>;
  submit(
    attempt: Extract<DocumentAttempt<D, I, S, H>, { operation: "submit" }>,
  ): Promise<WriteResult>;
  approve?(
    attempt: Base<I, S> & { operation: "approve" },
  ): Promise<WriteResult>;
  enable?(attempt: Base<I, S> & { operation: "enable" }): Promise<WriteResult>;
  disable?(
    attempt: Base<I, S> & { operation: "disable" },
  ): Promise<WriteResult>;
  attachments?: {
    validate(file: File): string | undefined;
    stage(
      attempt: StageAttempt<I, S, O>,
    ): Promise<
      | { status: "success"; handle: H }
      | { status: "failure"; message: string }
      | { status: "unknown"; message?: string }
    >;
    read(input: {
      scope: string;
      owner: O;
      handle: H;
    }): Promise<{ content: Blob; filename: string }>;
  };
};
export type DocumentDefinition<
  D extends object,
  I,
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
  adapter: DocumentAdapter<D, I, S, O, H, A>;
  // The consumer verifies original identity/revision/state and authoritative evidence,
  // never infers application from an ordinary current-value read.
  reconcile?(
    attempt: DocumentAttempt<D, I, S, H> | StageAttempt<I, S, O>,
  ): Promise<DocumentReconciliation<H, E>>;
};
export function defineDocument<
  D extends object,
  I,
  S,
  O,
  H,
  A extends object,
  E = never,
>(
  definition: DocumentDefinition<D, I, S, O, H, A, E>,
): DocumentDefinition<D, I, S, O, H, A, E> {
  return definition;
}
