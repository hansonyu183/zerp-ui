import type { ObjectShape, ModelInput } from "./reactive-model";
import type {
  OperationAction,
  OperationDefinition,
  OperationPreview,
  OperationModel,
} from "./operation";
import type { PrintDocument } from "./printing";

/** Erased marker keeps arbitrary evidence private while preserving action and identity. */
export const modelOperation: unique symbol = Symbol("zerp.model.operation");
export type ModelAction<A extends OperationAction, I> = {
  readonly [modelOperation]: { action: A; identity?: (identity: I) => I };
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
> = ModelAction<A, I> & {
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
  persistence: OperationDefinition<Whole, I, B>["persistence"];
} & Omit<
    OperationDefinition<ModelActionModel<A, N, E>, I, B>["adapter"],
    "execute"
  > & {
    run: OperationDefinition<
      ModelActionModel<A, N, E>,
      I,
      B
    >["adapter"]["execute"];
  };
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
>(
  action: A,
  input: N,
  protocol: Omit<
    ModelOperation<A, N, I, B, E, Whole>,
    "input" | typeof modelOperation
  >,
): ModelOperation<A, N, I, B, E, Whole> {
  return Object.assign(protocol, { input, [modelOperation]: { action } });
}
export type ModelBusinessActions<I> = {
  [A in Exclude<OperationAction, "create" | "edit" | "delete">]?: ModelAction<
    A,
    I
  >;
};
