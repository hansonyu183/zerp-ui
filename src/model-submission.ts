import type {
  ObjectShape,
  ModelValue,
  ModelInput,
  ArrayNode,
} from "./reactive-model";
import type { DocumentAdapter, DocumentDefinition } from "./document";
import type { VoucherAdapter, VoucherDefinition } from "./voucher";
export type ModelVersions<N extends ObjectShape> = {
  official: N;
  candidate: N;
  history: ArrayNode<N>;
};
export const modelSubmission: unique symbol = Symbol("zerp.model.submission");
type Read<F> = { disabledReason?: string; run: F };
type DocumentPorts<
  N extends ObjectShape,
  I,
  S,
  O,
  H,
  A extends ObjectShape,
  E,
> = {
  get: Read<DocumentAdapter<ModelValue<N>, I, S, O, H, ModelValue<A>>["query"]>;
  submit: Read<
    DocumentAdapter<ModelInput<N>, I, S, O, H, ModelValue<A>>["submit"]
  >;
  approve?: Read<
    NonNullable<
      DocumentAdapter<ModelValue<N>, I, S, O, H, ModelValue<A>>["approve"]
    >
  >;
  enable?: Read<
    NonNullable<
      DocumentAdapter<ModelValue<N>, I, S, O, H, ModelValue<A>>["enable"]
    >
  >;
  disable?: Read<
    NonNullable<
      DocumentAdapter<ModelValue<N>, I, S, O, H, ModelValue<A>>["disable"]
    >
  >;
  stage?: NonNullable<
    DocumentAdapter<ModelValue<N>, I, S, O, H, ModelValue<A>>["attachments"]
  >;
  reconcile?: DocumentDefinition<
    ModelInput<N>,
    I,
    S,
    O,
    H,
    ModelValue<A>,
    E
  >["reconcile"];
};
export type SubmissionOperations = {
  readonly [modelSubmission]: {
    protocol: "document" | "voucher";
    content: ObjectShape;
    versions?: ModelVersions<ObjectShape>;
    audit: ObjectShape;
  };
};
export function documentOperations<
  N extends ObjectShape,
  I,
  S,
  O,
  H,
  A extends ObjectShape,
  E = never,
>(
  versions: ModelVersions<N>,
  audit: A,
  operations: DocumentPorts<N, I, S, O, H, A, E>,
): typeof operations & SubmissionOperations {
  return Object.assign(operations, {
    [modelSubmission]: {
      protocol: "document" as const,
      content: versions.candidate,
      versions,
      audit,
    },
  });
}
type VoucherPorts<
  N extends ObjectShape,
  I,
  R,
  U,
  S,
  O,
  H,
  A extends ObjectShape,
  E,
> = {
  query: Read<
    VoucherAdapter<ModelValue<N>, I, R, U, S, O, H, ModelValue<A>>["list"]
  >;
  get: Read<
    VoucherAdapter<ModelValue<N>, I, R, U, S, O, H, ModelValue<A>>["get"]
  >;
  create?: Read<
    NonNullable<
      VoucherAdapter<ModelValue<N>, I, R, U, S, O, H, ModelValue<A>>["empty"]
    >
  >;
  clone?: Read<
    NonNullable<
      VoucherAdapter<ModelValue<N>, I, R, U, S, O, H, ModelValue<A>>["clone"]
    >
  >;
  submit: Read<
    VoucherAdapter<ModelInput<N>, I, R, U, S, O, H, ModelValue<A>>["submit"]
  >;
  approve?: Read<
    NonNullable<
      VoucherAdapter<ModelValue<N>, I, R, U, S, O, H, ModelValue<A>>["approve"]
    >
  >;
  stage?: NonNullable<
    VoucherAdapter<
      ModelValue<N>,
      I,
      R,
      U,
      S,
      O,
      H,
      ModelValue<A>
    >["attachments"]
  >;
  reconcile?: VoucherDefinition<
    ModelInput<N>,
    I,
    R,
    U,
    S,
    O,
    H,
    ModelValue<A>,
    E
  >["reconcile"];
};
export function voucherOperations<
  N extends ObjectShape,
  I,
  R,
  U,
  S,
  O,
  H,
  A extends ObjectShape,
  E = never,
>(
  content: N,
  audit: A,
  operations: VoucherPorts<N, I, R, U, S, O, H, A, E>,
): typeof operations & SubmissionOperations {
  return Object.assign(operations, {
    [modelSubmission]: { protocol: "voucher" as const, content, audit },
  });
}
