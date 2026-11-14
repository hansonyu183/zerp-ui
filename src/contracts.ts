import { modelBinding, type ModelCrudBinding } from "./model-binding";
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
  hasChildren?: boolean;
};
export type ReferenceAdapter = {
  directory: object;
  dependencies?: readonly unknown[];
  load(input: {
    scope: string;
    parent?: ReferenceValue | null;
    signal: AbortSignal;
  }): Promise<readonly ReferenceValue[]>;
};
type Common<K extends string> = {
  key: K;
  label: string;
  section?: { key: string; label: string };
  required?: boolean;
  readonly?: boolean;
  mode?: "create" | "edit";
  when?: { key: string; equals: string | boolean | number | null };
};
export type AnyField = Common<string> &
  (
    | {
        type: "text" | "textarea" | "password" | "secret";
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
    | {
        type: "reference";
        adapter: ReferenceAdapter;
        disabledReason?: string;
        parentKey?: string;
        valueMode?: "id";
      }
    | {
        type: "references";
        adapter: ReferenceAdapter;
        disabledReason?: string;
        parentKey?: string;
        valueMode?: "id";
      }
    | { type: "rows"; fields: readonly AnyField[]; empty: () => object }
  );
type Kind<V> =
  NonNullable<V> extends boolean
    ? Extract<AnyField, { type: "boolean" }>
    : NonNullable<V> extends number
      ? Extract<AnyField, { type: "integer" }>
      : NonNullable<V> extends string
        ? | Extract<
              AnyField,
              {
                type:
                  | "text"
                  | "textarea"
                  | "password"
                  | "secret"
                  | "date"
                  | "decimal"
                  | "enum";
              }
            >
          | (Extract<AnyField, { type: "reference" }> & { valueMode: "id" })
        : NonNullable<V> extends readonly (infer R)[]
          ? R extends string
            ? | Extract<AnyField, { type: "multi-enum" | "date-range" }>
              | (Extract<AnyField, { type: "references" }> & {
                  valueMode: "id";
                })
            : R extends ReferenceValue
              ? Extract<AnyField, { type: "references" }> & {
                  valueMode?: never;
                }
              : R extends object
                ? { type: "rows"; fields: Fields<R>; empty: () => R }
                : never
          : NonNullable<V> extends ReferenceValue
            ? Extract<AnyField, { type: "reference" }> & { valueMode?: never }
            : never;
type Keyed<V, K extends string> = V extends unknown
  ? Common<K> & Omit<V, "key">
  : never;
export type Fields<T extends object> = keyof T extends never
  ? readonly AnyField[]
  : readonly {
      [K in Extract<keyof T, string>]-?: Keyed<Kind<T[K]>, K>;
    }[Extract<keyof T, string>][];
/** Content grouping shared by read and edit; field definitions remain the single source of truth. */
export type FieldGroup<T extends object> = {
  key: string;
  label: string;
  fields: readonly (keyof T extends never
    ? string
    : Extract<keyof T, string>)[];
};

export type Column<R> = {
  key: Extract<keyof R, string>;
  label: string;
  type?: "text" | "boolean" | "decimal" | "integer" | "date" | "enum";
  options?: readonly { value: string; label: string }[];
  visible?: boolean;
  width?: string;
  role?: "action";
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
export type WriteResult<I = never> =
  | { status: "success"; identity?: I }
  | { status: "failure"; message: string; field?: string }
  | { status: "unknown"; message?: string };
export type ReconcileResult<E, I = never> =
  | { status: "unknown" }
  | {
      status: "applied" | "not-applied";
      attemptId: string;
      evidence: E;
      identity?: I;
    };
export type ListSort = { key: string; direction: "asc" | "desc" };
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
    sort?: ListSort;
  }): Promise<Page<R>>;
  get(input: { scope: string; identity: I }): Promise<{
    values: D;
    identity: I;
    readonlyFields?: readonly Extract<keyof D, string>[];
    writable?: boolean;
    row?: R;
    notice?: string;
  }>;
  empty(input: { scope: string; filters: F }): D;
  initialize?(input: {
    scope: string;
    filters: F;
  }): Promise<{ values: D; identity?: I }>;
  rebase?(input: {
    scope: string;
    identity: I;
    value: D;
    baseline: D;
  }): Promise<{
    values: D;
    baseline: D;
    identity: I;
    readonlyFields?: readonly Extract<keyof D, string>[];
    writable?: boolean;
  }>;
  prepare?(input: Omit<Attempt<D, I>, "id" | "resource">): Promise<I>;
  create(attempt: Attempt<D, I>): Promise<WriteResult<I>>;
  save(attempt: Attempt<D, I>): Promise<WriteResult<I>>;
  setEnabled?(attempt: Attempt<D, I>): Promise<WriteResult<I>>;
  delete?(attempt: Attempt<D, I>): Promise<WriteResult<I>>;
};
export type CrudDefinition<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
> = {
  [modelBinding]?: ModelCrudBinding<D, R, I>;
  resource: string;
  title: string;
  initialSort?: ListSort;
  export?: (input: {
    scope: string;
    filters: F;
    sort?: ListSort;
  }) => Promise<void>;
  fields: Fields<D>;
  groups?: readonly FieldGroup<D>[];
  filters: Fields<F>;
  initialFilters: () => F;
  columns: readonly Column<R>[];
  labels?: (
    row: R,
  ) => Readonly<Partial<Record<Extract<keyof R, string>, string>>>;
  identity: (row: R) => I;
  actions: (row: R) => readonly CrudAction[];
  disabledActions?: (row: R) => Readonly<Partial<Record<CrudAction, string>>>;
  viewLabel?: (row: R) => string;
  viewTitle?: string;
  adapter: CrudAdapter<D, F, R, I>;
  collaboration?: DraftCollaboration<D, unknown>;
  persistence?: WritePersistence<Attempt<D, I>>;
  reconcile?: (attempt: Attempt<D, I>) => Promise<ReconcileResult<E, I>>;
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
