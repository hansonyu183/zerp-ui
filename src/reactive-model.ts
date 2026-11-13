import type { WorkflowOperations } from "./model-workflow";
import type { BatchOperations } from "./model-batch";
import type { SubmissionOperations } from "./model-submission";
import type { ModelQuery } from "./model-query";
import type { ModelBusinessActions } from "./model-operation";
import { nodeMetadata } from "./model-node";
import { operationLabels } from "./operation";
import type { Page, ReferenceValue } from "./contracts";
import type { Brand, ThemeChoice } from "./shell";
import type { WritePersistence, WriteOwner } from "./write-recovery";
import type { Attempt } from "./contracts";
import type { Interaction, InteractionAnswers } from "./collaboration";

export type ModelOwner = Readonly<{
  ledger: string;
  operator: string;
  generation: string;
}>;
export type ReadonlyValue<T> = T extends object
  ? { readonly [K in keyof T]: ReadonlyValue<T[K]> }
  : T;
export type ModelContext<
  I = unknown,
  P extends readonly unknown[] = readonly [],
> = {
  owner: ModelOwner;
  identity: ReadonlyValue<I>;
  ancestors: ReadonlyValue<P>;
  signal: AbortSignal;
};
export type ModelRequest<
  V,
  I,
  P extends readonly unknown[] = readonly [],
> = Readonly<{
  requestId: string;
  owner: ModelOwner;
  node: readonly string[];
  operation: "create" | "update" | "delete" | "enable" | "disable";
  input: ReadonlyValue<V>;
  /** Answers accepted for this draft, frozen with the durable original. */
  answers: InteractionAnswers;
  identity: ReadonlyValue<I>;
  ancestors: ReadonlyValue<P>;
  concurrency: string | null;
}>;
export type ModelSnapshot<V, I> = {
  value: ReadonlyValue<V>;
  identity: ReadonlyValue<I>;
  concurrency: string;
};
export type ModelFieldPath<V> = {
  [K in Extract<keyof V, string>]:
    | K
    | (unknown extends V[K]
        ? readonly [K, string, ...string[]]
        : NonNullable<V[K]> extends object
          ? | readonly [
                K,
                ...Extract<
                  ModelFieldPath<NonNullable<V[K]>>,
                  readonly string[]
                >,
              ]
            | readonly [K, Extract<keyof NonNullable<V[K]>, string>]
          : never);
}[Extract<keyof V, string>];
export type ModelWriteResult<V, I, Input = V> =
  | { status: "success"; snapshot?: ModelSnapshot<V, I>; message?: string }
  | {
      status: "failure";
      message: string;
      fields?: readonly { field: ModelFieldPath<Input>; message: string }[];
    }
  | { status: "unknown"; message?: string };
export type ModelEvidence<V, I> =
  | { status: "unknown" }
  | {
      status: "applied" | "not-applied";
      requestId: string;
      evidence: ModelSnapshot<V, I>;
      snapshot?: ModelSnapshot<V, I>;
    };
export type ModelWrite<
  V,
  I,
  Input = V,
  P extends readonly unknown[] = readonly [],
> = {
  disabledReason?: string;
  run(
    request: ModelRequest<Input, I, P>,
  ): Promise<ModelWriteResult<V, I, Input>>;
  reconcile?(request: ModelRequest<Input, I, P>): Promise<ModelEvidence<V, I>>;
};
export type ModelLocalIntent<V = object> =
  | { kind: "related"; node: ModelNode; identity?: unknown }
  | {
      kind: "calculate";
      run(context: {
        owner: ModelOwner;
        input: ReadonlyValue<V>;
        answers: InteractionAnswers;
        signal: AbortSignal;
      }): Promise<ModelCalculationResult<V>>;
    }
  | {
      kind: "download";
      read(context: {
        owner: ModelOwner;
        signal: AbortSignal;
      }): Promise<{ content: Blob; filename: string }>;
    };
export type ModelCalculationResult<V> = {
  value: ReadonlyValue<V>;
  interactions?: readonly Interaction<ModelLocalIntent<V>>[];
};
export type ModelCalculation<V, I, P extends readonly unknown[]> = {
  disabledReason?: string;
  run(
    context: ModelContext<I, P> & {
      input: ReadonlyValue<V>;
      event: "initialize" | "change" | "answer" | "action";
      answers: InteractionAnswers;
    },
  ): Promise<ModelCalculationResult<V>>;
};
export type ModelRead<
  I,
  O,
  Identity = unknown,
  P extends readonly unknown[] = readonly [],
> = {
  disabledReason?: string;
  run(
    context: ModelContext<Identity, P> & {
      input: ReadonlyValue<I>;
      page: number;
      pageSize: number;
      requestId?: string;
    },
  ): Promise<O>;
};
type NoPresentation = {
  template?: never;
  render?: never;
  component?: never;
  slots?: never;
  layout?: never;
};
export type ModelScalar = string | number | boolean | null;
export type FieldKind =
  | "text"
  | "longText"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "secret"
  | "reference";
export type FieldOptions<V> = NoPresentation & {
  value?: V;
  required?: boolean;
  readOnly?: boolean;
  options?: readonly { id: string; name: string }[];
};
export type ValueNode<V = ModelScalar> = {
  value: V;
  readonly [nodeMetadata]: {
    kind: FieldKind;
    name: string;
    options: FieldOptions<V>;
    operations?: ReferenceOperations;
  };
};
export type ModelNode = {
  readonly [nodeMetadata]: {
    kind:
      | FieldKind
      | "object"
      | "array"
      | "collection"
      | "messages"
      | "application";
    name: string;
  };
};
export type ObjectShape = ModelNode & {
  readonly [nodeMetadata]: {
    kind: "object";
    children: ModelMembers;
    identity: readonly string[];
    concurrency: string | null;
    independent: boolean;
    identityValue?: unknown;
    parentIdentities?: readonly unknown[];
  };
};
export type ModelMembers = Record<string, ModelNode>;
export type ModelValue<N> =
  N extends ValueNode<infer V>
    ? V
    : N extends {
          [nodeMetadata]: {
            kind: "object";
            children: infer S extends ModelMembers;
          };
        }
      ? {
          [
            K in keyof S as S[K] extends {
              [nodeMetadata]: { independent: true };
            }
              ? never
              : K
          ]: ModelValue<S[K]>;
        }
      : N extends { [nodeMetadata]: { kind: "array"; element: infer E } }
        ? ModelValue<E>[]
        : N extends ModelNode
          ? unknown
          : never;
export type ModelInput<N> = N extends {
  [nodeMetadata]: { kind: "object"; children: infer S extends ModelMembers };
}
  ? {
      [
        K in keyof S as S[K] extends {
          [nodeMetadata]:
            { independent: true } | { options: { readOnly: true } };
        }
          ? never
          : K
      ]: ModelInput<S[K]>;
    }
  : N extends { [nodeMetadata]: { kind: "array"; element: infer E } }
    ? ModelInput<E>[]
    : ModelValue<N>;
type Identity<S extends ModelMembers, K extends readonly (keyof S)[]> = {
  [F in K[number]]: NonNullable<ModelValue<S[F]>>;
};
export type ObjectOperations<
  V,
  I,
  Input,
  P extends readonly unknown[],
> = ModelBusinessActions<I, P> & {
  get?: ModelRead<void, ModelSnapshot<V, I>, I, P>;
  update?: ModelWrite<V, I, Input, P>;
  delete?: ModelWrite<V, I, void, P>;
  enable?: ModelWrite<V, I, void, P>;
  disable?: ModelWrite<V, I, void, P>;
  initialize?: ModelCalculation<V, I, P>;
  calculate?: ModelCalculation<V, I, P>;
};
export type AuthenticationOperation = "signIn" | "restoreSession" | "signOut";
export type SessionResult = { status: "success" | "failure"; message?: string };
export type SessionOperations<V> = Partial<
  Record<
    AuthenticationOperation,
    {
      disabledReason?: string;
      run(context: {
        input: ReadonlyValue<V>;
        owner: ModelOwner | null;
        signal: AbortSignal;
      }): Promise<SessionResult>;
    }
  >
>;
type ReferenceRead<I, O> = {
  disabledReason?: string;
  run(
    context: Omit<ModelContext, "owner"> & {
      owner: ModelOwner | null;
      input: ReadonlyValue<I>;
      page: number;
      pageSize: number;
    },
  ): Promise<O>;
};
export type ReferenceOperations = {
  search: ReferenceRead<
    { keyword: string; ancestor?: ReferenceValue | null },
    Page<ReferenceValue>
  >;
  resolve: ReferenceRead<{ ids: readonly string[] }, readonly ReferenceValue[]>;
};
export type ObjectNode<
  S extends ModelMembers = ModelMembers,
  I = unknown,
  P extends readonly unknown[] = readonly [],
  B extends boolean = boolean,
> = S & {
  readonly [nodeMetadata]: {
    kind: "object";
    name: string;
    children: S;
    identityValue?: I;
    parentIdentities?: P;
    identity: readonly string[];
    concurrency: string | null;
    operations: ObjectOperations<
      ModelValue<ObjectNode<S>>,
      I,
      ModelInput<ObjectNode<S>>,
      P
    > &
      SessionOperations<ModelInput<ObjectNode<S>>>;
    independent: B;
    readOnly?: boolean;
    form?: readonly Extract<keyof S, string>[];
    list?: readonly Extract<keyof S, string>[];
  };
};
export type NodeIdentity<N extends ObjectShape> = NonNullable<
  N[typeof nodeMetadata]["identityValue"]
>;
export type NodeAncestors<N extends ObjectShape> = NonNullable<
  N[typeof nodeMetadata]["parentIdentities"]
>;
export type ModelCreate<N extends ObjectShape> = {
  disabledReason?: string;
  run(request: ModelRequest<ModelInput<N>, null, NodeAncestors<N>>): Promise<
    | Exclude<
        ModelWriteResult<ModelValue<N>, NodeIdentity<N>, ModelInput<N>>,
        { status: "success" }
      >
    | {
        status: "success";
        snapshot: ModelSnapshot<ModelValue<N>, NodeIdentity<N>>;
        message?: string;
      }
  >;
  reconcile?(
    request: ModelRequest<ModelInput<N>, null, NodeAncestors<N>>,
  ): Promise<
    | ModelEvidence<ModelValue<N>, NodeIdentity<N>>
    | {
        status: "not-applied";
        requestId: string;
        evidence: ModelSnapshot<ModelValue<N>, null>;
      }
  >;
};
export type CollectionNode<N extends ObjectShape = ObjectShape> = {
  items: N[];
  readonly [nodeMetadata]: {
    kind: "collection";
    name: string;
    element: () => N;
    independent: true;
    operations:
      | {
          query?:
            | (ModelRead<object, Page<N>> & { input?: ObjectShape })
            | ModelQuery<N, ObjectShape>;
          create?: ModelCreate<N>;
          export?: ModelRead<
            object,
            void | { content: Blob; filename: string }
          >;
        }
      | BatchOperations<NodeIdentity<N>, NodeAncestors<N>>;
  };
};
export type ArrayNode<E extends ModelNode = ModelNode> = {
  items: E[];
  readonly [nodeMetadata]: {
    kind: "array";
    name: string;
    element: E;
    create: () => E;
    options: { readOnly?: boolean };
  };
};
export type MessageNode = {
  items: {
    id: string;
    level: "success" | "info" | "warning" | "error";
    text: string;
    target?: ModelNode;
  }[];
  readonly [nodeMetadata]: { kind: "messages"; name: string };
};
/** Keep this port object stable throughout one application lifetime, including remounts. */
export type ModelNavigation = {
  current: { node: ModelNode; identity?: unknown } | null;
  href(node: ModelNode, identity?: unknown): string;
  visit(node: ModelNode, identity?: unknown): void;
  /** Consumer Router installs this guard, and returns its removal function. */
  guard(
    check: (
      next?: { node: ModelNode; identity?: unknown } | null,
    ) => Promise<boolean>,
  ): () => void;
};
export type ModelApplicationOptions = NoPresentation & {
  owner: ModelOwner | null;
  brand: Brand;
  account?: {
    label: string;
    avatar?: { src: string; alt: string };
    profile?: ModelNode;
  };
  theme?: { value: ThemeChoice; change(value: ThemeChoice): void };
  navigation: ModelNavigation;
  persistence?: ModelPersistence;
  forcePasswordChange?: boolean;
};
export type ModelPendingRequest = {
  node: readonly string[];
  ancestors: readonly unknown[];
};
/** pending enumerates unresolved owners without exposing secret request inputs. */
export type ModelPersistence = WritePersistence<
  Attempt<object, ModelIdentity>
> & {
  /** Required before secret-bearing originals may cross this consumer port. */
  secrets?: "encrypted";
  pending(owner: ModelOwner): Promise<readonly ModelPendingRequest[]>;
};
export type ModelIdentity = {
  value: unknown;
  ancestors: readonly unknown[];
  concurrency: string | null;
  original?: {
    input: unknown;
    answers: InteractionAnswers;
    node: readonly string[];
    owner: ModelOwner;
    operation: ModelRequest<unknown, unknown>["operation"];
  };
};
export type ApplicationNode<S extends ModelMembers = ModelMembers> = S & {
  readonly [nodeMetadata]: {
    kind: "application";
    name: string;
    children: S;
    options: ModelApplicationOptions;
  };
};

function field<V>(
  kind: FieldKind,
  name: string,
  initial: V,
  options: FieldOptions<V> = {},
): ValueNode<V> {
  return {
    value: options.value === undefined ? initial : options.value,
    [nodeMetadata]: { kind, name, options },
  };
}
export function text<const O extends FieldOptions<string | null> = {}>(
  name: string,
  options?: O,
): ValueNode<string | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("text", name, "" as string | null, options) as ValueNode<
    string | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export function longText<const O extends FieldOptions<string | null> = {}>(
  name: string,
  options?: O,
): ValueNode<string | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("longText", name, "" as string | null, options) as ValueNode<
    string | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export function integer<const O extends FieldOptions<number | null> = {}>(
  name: string,
  options?: O,
): ValueNode<number | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("integer", name, null as number | null, options) as ValueNode<
    number | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export function decimal<const O extends FieldOptions<string | null> = {}>(
  name: string,
  options?: O,
): ValueNode<string | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("decimal", name, "" as string | null, options) as ValueNode<
    string | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export function boolean<const O extends FieldOptions<boolean | null> = {}>(
  name: string,
  options?: O,
): ValueNode<boolean | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("boolean", name, false as boolean | null, options) as ValueNode<
    boolean | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export function date<const O extends FieldOptions<string | null> = {}>(
  name: string,
  options?: O,
): ValueNode<string | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("date", name, "" as string | null, options) as ValueNode<
    string | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export function datetime<const O extends FieldOptions<string | null> = {}>(
  name: string,
  options?: O,
): ValueNode<string | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("datetime", name, "" as string | null, options) as ValueNode<
    string | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export function secret<const O extends FieldOptions<string | null> = {}>(
  name: string,
  options?: O,
): ValueNode<string | null> & { readonly [nodeMetadata]: { options: O } } {
  return field("secret", name, "" as string | null, options) as ValueNode<
    string | null
  > & { readonly [nodeMetadata]: { options: O } };
}
export const enumeration = (
  name: string,
  options: FieldOptions<string | null> & {
    options: readonly { id: string; name: string }[];
  },
) => field("enum", name, "" as string | null, options);
export function reference<
  const O extends FieldOptions<string | null> & {
    operations: ReferenceOperations;
    target?: ModelNode;
  },
>(
  name: string,
  options: O,
): ValueNode<string | null> & { readonly [nodeMetadata]: { options: O } } {
  const node = field("reference", name, null as string | null, options);
  node[nodeMetadata].operations = options.operations;
  return node as ValueNode<string | null> & {
    readonly [nodeMetadata]: { options: O };
  };
}
type SameParents<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
type ChildHierarchy<N, P extends readonly unknown[]> = N extends {
  [nodeMetadata]: {
    kind: "collection";
    element: () => infer E extends ObjectShape;
  };
}
  ? SameParents<NodeAncestors<E>, P> extends true
    ? N
    : never
  : N extends {
        [nodeMetadata]: {
          kind: "object";
          children: infer S extends ModelMembers;
          independent: infer B;
        };
      }
    ? B extends true
      ? N extends ObjectShape
        ? SameParents<NodeAncestors<N>, P> extends true
          ? N
          : never
        : never
      : N & { [K in keyof S]: ChildHierarchy<S[K], P> }
    : N;
type ChildrenHierarchy<S extends ModelMembers, P extends readonly unknown[]> = {
  [K in keyof S]: ChildHierarchy<S[K], P>;
};
type ObjectOptions<
  S extends ModelMembers,
  K extends readonly Extract<keyof S, string>[],
  P extends readonly unknown[],
> = NoPresentation & {
  identity?: K;
  concurrency?: string | null;
  readOnly?: boolean;
  form?: readonly Extract<keyof S, string>[];
  list?: readonly Extract<keyof S, string>[];
  operations?: ObjectOperations<
    ModelValue<ObjectNode<S>>,
    Identity<S, K>,
    ModelInput<ObjectNode<S>>,
    P
  > &
    SessionOperations<ModelInput<ObjectNode<S>>>;
};
type IndependentOperations<
  V,
  I,
  Input,
  P extends readonly unknown[],
> = ObjectOperations<V, I, Input, P> &
  (
    | { get: ModelRead<void, ModelSnapshot<V, I>, I, P> }
    | { update: ModelWrite<V, I, Input, P> }
    | { delete: ModelWrite<V, I, void, P> }
    | { enable: ModelWrite<V, I, void, P> }
    | { disable: ModelWrite<V, I, void, P> }
    | {
        [A in keyof ModelBusinessActions<I, P>]-?: Required<
          Pick<ModelBusinessActions<I, P>, A>
        >;
      }[keyof ModelBusinessActions<I, P>]
  );
export function object<
  const S extends ModelMembers,
  const K extends readonly Extract<keyof S, string>[] = readonly [],
  P extends readonly unknown[] = readonly [],
>(
  name: string,
  children: S & ChildrenHierarchy<S, readonly [...P, Identity<S, K>]>,
  options: ObjectOptions<S, K, P> & {
    operations: IndependentOperations<
      ModelValue<ObjectNode<S>>,
      Identity<S, K>,
      ModelInput<ObjectNode<S>>,
      P
    > &
      SessionOperations<ModelInput<ObjectNode<S>>>;
  },
): ObjectNode<S, Identity<S, K>, P, true>;
export function object<
  const S extends ModelMembers,
  const K extends readonly Extract<keyof S, string>[] = readonly [],
  P extends readonly unknown[] = readonly [],
>(
  name: string,
  children: S,
  options?: Omit<ObjectOptions<S, K, P>, "operations"> & {
    operations?: SessionOperations<ModelInput<ObjectNode<S>>> &
      Pick<
        ObjectOperations<
          ModelValue<ObjectNode<S>>,
          Identity<S, K>,
          ModelInput<ObjectNode<S>>,
          P
        >,
        "initialize" | "calculate"
      >;
  },
): ObjectNode<S, Identity<S, K>, P, false>;
export function object<const S extends ModelMembers>(
  name: string,
  children: S,
  options: NoPresentation & {
    operations: SubmissionOperations | WorkflowOperations;
  },
): S & {
  readonly [nodeMetadata]: {
    kind: "object";
    name: string;
    children: S;
    identity: readonly [];
    identityValue?: {};
    parentIdentities?: readonly [];
    concurrency: null;
    independent: true;
    operations: SubmissionOperations | WorkflowOperations;
  };
};
export function object<
  const S extends ModelMembers,
  const K extends readonly Extract<keyof S, string>[] = readonly [],
  P extends readonly unknown[] = readonly [],
>(
  name: string,
  children: S,
  options: NoPresentation & {
    identity?: K;
    concurrency?: string | null;
    readOnly?: boolean;
    form?: readonly Extract<keyof S, string>[];
    list?: readonly Extract<keyof S, string>[];
    operations?: unknown;
  } = {},
): ObjectNode<S, Identity<S, K>, P> {
  const operations = (options.operations ?? {}) as ObjectOperations<
    ModelValue<ObjectNode<S>>,
    Identity<S, K>,
    ModelInput<ObjectNode<S>>,
    P
  > &
    SessionOperations<ModelInput<ObjectNode<S>>>;
  return Object.assign({}, children, {
    [nodeMetadata]: {
      kind: "object" as const,
      name,
      children,
      identity: options.identity ?? [],
      get concurrency() {
        return options.concurrency ?? null;
      },
      set concurrency(value: string | null) {
        options.concurrency = value;
      },
      get readOnly() {
        return options.readOnly;
      },
      get operations() {
        return (options.operations ?? operations) as typeof operations;
      },
      independent: !!(
        Reflect.ownKeys(operations).some((key) => typeof key === "symbol") ||
        operations.get ||
        operations.update ||
        operations.delete ||
        operations.enable ||
        operations.disable ||
        Object.keys(operations).some((key) =>
          Object.hasOwn(operationLabels, key),
        )
      ),
      form: options.form,
      list: options.list,
    },
  });
}
export function collection<
  N extends ObjectShape,
  Q extends ObjectShape = ObjectShape,
>(
  name: string,
  element: () => N & (keyof NodeIdentity<N> extends never ? never : unknown),
  options: NoPresentation & {
    items?: N[];
    operations?:
      | {
          query?:
            | (ModelRead<
                ModelValue<Q>,
                Page<NoInfer<N>>,
                null,
                NodeAncestors<N>
              > & {
                input?: Q;
              })
            | ModelQuery<NoInfer<N>, Q>;
          create?: ModelCreate<N>;
          export?: ModelRead<
            ModelValue<Q>,
            void | { content: Blob; filename: string },
            null,
            NodeAncestors<N>
          >;
        }
      | BatchOperations<NodeIdentity<N>, NodeAncestors<N>>;
  } = {},
): CollectionNode<N> {
  return {
    items: options.items ?? [],
    [nodeMetadata]: {
      kind: "collection",
      name,
      element,
      independent: true,
      get operations() {
        return options.operations ?? {};
      },
    },
  } as CollectionNode<N>;
}
export function array<
  E extends ModelNode,
  const O extends { readOnly?: boolean } = {},
>(
  name: string,
  create: () => E,
  items: E[] = [],
  options?: O,
): ArrayNode<E> & { readonly [nodeMetadata]: { options: O } } {
  return {
    items,
    [nodeMetadata]: {
      kind: "array",
      name,
      element: create(),
      create,
      options: options ?? ({} as O),
    },
  } as ArrayNode<E> & { readonly [nodeMetadata]: { options: O } };
}
export function messages(items: MessageNode["items"] = []): MessageNode {
  return { items, [nodeMetadata]: { kind: "messages", name: "通知" } };
}
export function application<const S extends ModelMembers>(
  name: string,
  children: S & ChildrenHierarchy<S, readonly []>,
  options: ModelApplicationOptions,
): ApplicationNode<S> {
  return Object.assign({}, children, {
    [nodeMetadata]: { kind: "application" as const, name, children, options },
  });
}
export type ModelPersistenceOwner = WriteOwner;
export type ModelAnswers = InteractionAnswers;
