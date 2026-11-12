import type { ObjectShape, ModelInput, ReadonlyValue } from "./reactive-model";
import type {
  OperationAction,
  OperationPreview,
  OperationModel,
  OperationIntent,
  OperationRequest,
  OperationJournal,
  OperationSettlement,
  OperationPersistence,
  OperationOutcome,
  OperationReceipt,
} from "./operation";
import type { PrintDocument } from "./printing";

export type ModelOperationIntent<
  M extends OperationModel,
  I,
  P extends readonly unknown[] = readonly [],
> = OperationIntent<M, I> & { readonly ancestors: ReadonlyValue<P> };
export type ModelOperationRequest<
  M extends OperationModel,
  I,
  B,
  P extends readonly unknown[] = readonly [],
> = OperationRequest<M, I, B> & { readonly ancestors: ReadonlyValue<P> };
type WithAncestors<T, P extends readonly unknown[]> = T extends {
  request: infer R;
}
  ? Omit<T, "request"> & {
      readonly request: R & { readonly ancestors: ReadonlyValue<P> };
    }
  : never;
export type ModelOperationJournal<
  M extends OperationModel,
  I,
  B,
  P extends readonly unknown[] = readonly [],
> = WithAncestors<OperationJournal<M, I, B>, P>;
export type ModelOperationSettlement<
  M extends OperationModel,
  I,
  B,
  P extends readonly unknown[] = readonly [],
> = WithAncestors<OperationSettlement<M, I, B>, P>;
export type ModelOperationPersistence<
  M extends OperationModel,
  I,
  B,
  P extends readonly unknown[] = readonly [],
> = Omit<OperationPersistence<M, I, B>, "load" | "save"> & {
  load(
    owner: Parameters<OperationPersistence<M, I, B>["load"]>[0],
    requestId?: string,
  ): Promise<ModelOperationJournal<M, I, B, P> | null>;
  save(
    journal: ModelOperationJournal<M, I, B, P>,
    expectedId: string | null,
  ): Promise<void>;
};
export type ModelOperationCallbacks<
  M extends OperationModel,
  I,
  B,
  P extends readonly unknown[] = readonly [],
> = {
  prepare(
    intent: ModelOperationIntent<M, I, P>,
  ): Promise<ModelOperationRequest<M, I, B, P>>;
  acceptsPreparation(
    intent: ModelOperationIntent<M, I, P>,
    prepared: ModelOperationRequest<M, I, B, P>,
  ): boolean;
  run(request: ModelOperationRequest<M, I, B, P>): Promise<OperationOutcome<M>>;
  reconcile(
    request: ModelOperationRequest<M, I, B, P>,
  ): Promise<OperationOutcome<M>>;
  seal(
    request: ModelOperationRequest<M, I, B, P>,
    receipt: OperationReceipt<M>,
  ): Promise<OperationOutcome<M>>;
  refresh(settlement: ModelOperationSettlement<M, I, B, P>): Promise<void>;
  accepts(
    request: ModelOperationRequest<M, I, B, P>,
    receipt: OperationReceipt<M>,
  ): boolean;
};
/** Erased marker keeps arbitrary evidence private while preserving action and identity. */
export const modelOperation: unique symbol = Symbol("zerp.model.operation");
export type ModelAction<
  A extends OperationAction,
  I,
  P extends readonly unknown[] = readonly [],
> = {
  readonly [modelOperation]: {
    action: A;
    identity?: (identity: I) => I;
    ancestors?: (parents: P) => P;
  };
  disabledReason?: string;
};
export type ModelActionModel<
  A extends OperationAction,
  N extends ObjectShape,
  E extends object,
> = {
  [K in A]: { input: ModelInput<N>; preview: OperationPreview; evidence: E };
};
export type ModelOperation<
  A extends OperationAction,
  N extends ObjectShape,
  I,
  B,
  E extends object,
  Whole extends OperationModel & ModelActionModel<A, N, E> = ModelActionModel<
    A,
    N,
    E
  >,
  P extends readonly unknown[] = readonly [],
> = ModelAction<A, I, P> & {
  input: N;
  importResource?: {
    label: string;
    accept: string;
    read(context: {
      file: File;
      owner: import("./reactive-model").ModelOwner;
      signal: AbortSignal;
    }): Promise<ModelInput<N>>;
  };
  printing?: {
    document: PrintDocument;
    state: "preview" | "opened" | "printed" | "not-printed";
  };
  persistence: ModelOperationPersistence<Whole, I, B, P> & {
    secrets?: "encrypted";
  } & ([ModelActionModel<A, N, E>[A]] extends [Whole[A]] ? unknown : never);
} & ModelOperationCallbacks<ModelActionModel<A, N, E>, I, B, P>;
/** A fixed operation's callbacks stay paired with its input, preview, receipt and journal. */
export function operation<
  A extends OperationAction,
  N extends ObjectShape,
  I,
  B,
  E extends object,
  Whole extends OperationModel & ModelActionModel<A, N, E> = ModelActionModel<
    A,
    N,
    E
  >,
  P extends readonly unknown[] = readonly [],
>(
  action: A,
  input: N,
  protocol: Omit<
    ModelOperation<A, N, I, B, E, Whole, P>,
    "input" | typeof modelOperation
  >,
): ModelOperation<A, N, I, B, E, Whole, P> {
  return Object.assign(protocol, { input, [modelOperation]: { action } });
}
export type ModelBusinessActions<
  I,
  P extends readonly unknown[] = readonly [],
> = {
  [A in Exclude<OperationAction, "create" | "edit" | "delete">]?: ModelAction<
    A,
    I,
    P
  >;
};
