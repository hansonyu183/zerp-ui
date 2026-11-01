import type { WritePersistence } from "./write-recovery";
import type { DraftCollaboration } from "./collaboration";
export type Page<T> = { items: readonly T[] } & (
  { total: number; hasMore?: never } | { hasMore: boolean; total?: never }
);
export type ReferenceValue = {
  id: string;
  label: string;
  selectable?: boolean;
  snapshot?: unknown;
};
export type ReferenceAdapter = {
  search(input: {
    scope: string;
    parent?: ReferenceValue | null;
    keyword: string;
    page: number;
    pageSize: number;
  }): Promise<Page<ReferenceValue>>;
  resolve(input: {
    scope: string;
    parent?: ReferenceValue | null;
    ids: readonly string[];
  }): Promise<readonly ReferenceValue[]>;
};
type Common<K extends string> = {
  key: K;
  label: string;
  required?: boolean;
  readonly?: boolean;
  mode?: "create" | "edit";
  when?: { key: string; equals: string | boolean | number | null };
};
export type AnyField = Common<string> &
  (
    | {
        type: "text" | "textarea" | "password";
        minLength?: number;
        maxLength?: number;
      }
    | { type: "date" | "decimal" }
    | { type: "integer"; min?: number; max?: number }
    | { type: "boolean" }
    | { type: "date-range" }
    | {
        type: "multi-enum";
        options: readonly { value: string; label: string }[];
      }
    | { type: "enum"; options: readonly { value: string; label: string }[] }
    | { type: "reference"; adapter: ReferenceAdapter; parentKey?: string }
    | { type: "references"; adapter: ReferenceAdapter; parentKey?: string }
    | { type: "rows"; fields: readonly AnyField[]; empty: () => object }
  );
type Kind<V> =
  NonNullable<V> extends boolean
    ? Extract<AnyField, { type: "boolean" }>
    : NonNullable<V> extends number
      ? Extract<AnyField, { type: "integer" }>
      : NonNullable<V> extends string
        ? Extract<
            AnyField,
            {
              type:
                "text" | "textarea" | "password" | "date" | "decimal" | "enum";
            }
          >
        : NonNullable<V> extends readonly (infer R)[]
          ? R extends string
            ? Extract<AnyField, { type: "multi-enum" | "date-range" }>
            : R extends ReferenceValue
              ? Extract<AnyField, { type: "references" }>
              : R extends object
                ? { type: "rows"; fields: Fields<R>; empty: () => R }
                : never
          : NonNullable<V> extends ReferenceValue
            ? Extract<AnyField, { type: "reference" }>
            : never;
type Keyed<V, K extends string> = V extends unknown
  ? Common<K> & Omit<V, "key">
  : never;
export type Fields<T extends object> = keyof T extends never
  ? readonly AnyField[]
  : readonly {
      [K in Extract<keyof T, string>]-?: Keyed<Kind<T[K]>, K>;
    }[Extract<keyof T, string>][];
export type Column<R> = {
  key: Extract<keyof R, string>;
  label: string;
  type?: "text" | "boolean" | "decimal" | "integer" | "date" | "enum";
  options?: readonly { value: string; label: string }[];
  visible?: boolean;
  width?: string;
};
export type CrudAction = "view" | "edit" | "enable" | "disable" | "delete";
export type ListAction =
  | "view"
  | "send"
  | "withdraw"
  | "check"
  | "uncheck"
  | "complete"
  | "uncomplete"
  | "void"
  | "unvoid"
  | CrudAction;
export type Attempt<D, I> = Readonly<{
  id: string;
  scope: string;
  resource: string;
  operation: "create" | "save" | "enable" | "disable" | "delete";
  input?: D;
  identity?: I;
}>;
export type WriteResult =
  | { status: "success" }
  | { status: "failure"; message: string }
  | { status: "unknown"; message?: string };
export type ReconcileResult<E> =
  | { status: "unknown" }
  | { status: "applied" | "not-applied"; attemptId: string; evidence: E };
export type CrudAdapter<
  D extends object,
  F extends object,
  R extends object,
  I,
> = {
  query(input: {
    scope: string;
    filters: F;
    page: number;
    pageSize: number;
  }): Promise<Page<R>>;
  get(input: { scope: string; identity: I }): Promise<{
    values: D;
    identity: I;
    readonlyFields?: readonly Extract<keyof D, string>[];
    writable?: boolean;
  }>;
  empty(input: { scope: string; filters: F }): D;
  create(attempt: Attempt<D, I>): Promise<WriteResult>;
  save(attempt: Attempt<D, I>): Promise<WriteResult>;
  setEnabled?(attempt: Attempt<D, I>): Promise<WriteResult>;
  delete?(attempt: Attempt<D, I>): Promise<WriteResult>;
};
export type CrudDefinition<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
> = {
  resource: string;
  title: string;
  fields: Fields<D>;
  filters: Fields<F>;
  initialFilters: () => F;
  columns: readonly Column<R>[];
  identity: (row: R) => I;
  actions: (row: R) => readonly CrudAction[];
  viewLabel?: (row: R) => string;
  viewTitle?: string;
  adapter: CrudAdapter<D, F, R, I>;
  collaboration?: DraftCollaboration<D, unknown>;
  persistence?: WritePersistence<Attempt<D, I>>;
  reconcile?: (attempt: Attempt<D, I>) => Promise<ReconcileResult<E>>;
};
export function defineCrud<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
>(definition: CrudDefinition<D, F, R, I, E>): CrudDefinition<D, F, R, I, E> {
  return definition;
}

/** Finite editor entrances; all honor current protection and permissions. */
export type CrudViewHandle<R> = {
  openRow(row: R, readOnly?: boolean): Promise<boolean>;
  close(): Promise<boolean>;
};
