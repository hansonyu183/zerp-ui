import { nodeMetadata } from "./model-node";
import type { BatchOperations } from "./model-batch";
import type { ModelNode, ModelOwner } from "./reactive-model";
type Members<N> = N extends { readonly [nodeMetadata]: { children: infer S } }
  ? S
  : N extends { readonly [nodeMetadata]: { element: () => infer E } }
    ? Members<E>
    : N extends { readonly [nodeMetadata]: { element: infer E } }
      ? Members<E>
      : never;
type PortKeys<O> = O extends BatchOperations
  ? "executeBatch"
  : O extends unknown
    ? Extract<keyof O, string>
    : never;
type OperationKeys<N> = N extends {
  readonly [nodeMetadata]: { operations: infer O };
}
  ? | PortKeys<O>
    | (N extends { readonly [nodeMetadata]: { element: () => infer E } }
        ? OperationKeys<E>
        : never)
  : never;
type FieldPermissions<N> = [Members<N>] extends [never]
  ? never
  : {
      readonly [K in keyof Members<N>]?: Access & {
        fields?: FieldPermissions<Members<N>[K]>;
      };
    };
type Access = { read?: boolean; write?: boolean };
const permissionBinding: unique symbol = Symbol("zerp.model.permission");
export type ModelPermission = {
  readonly [permissionBinding]: true;
  readonly node: ModelNode;
  readonly read?: boolean;
  readonly write?: boolean;
  readonly fields?: Readonly<
    Record<string, Access & { fields?: ModelPermission["fields"] }>
  >;
  readonly operations?: Readonly<Record<string, boolean>>;
};
/** Keys reference this node's fields and finite operations, never routes or callbacks. */
export function permission<N extends ModelNode>(
  node: N,
  access: Access & {
    fields?: FieldPermissions<N>;
    operations?: [OperationKeys<N>] extends [never]
      ? never
      : Partial<Record<OperationKeys<N>, boolean>>;
  },
): ModelPermission {
  return { node, ...access, [permissionBinding]: true } as ModelPermission;
}
export type ModelUserPermissions = {
  owner: ModelOwner;
} & (
  | { administrator: true; grants?: never }
  | { administrator?: false; grants: readonly ModelPermission[] }
);
