import type { Component } from "vue";
import type {
  Attempt,
  Column,
  Fields,
  Page,
  ReconcileResult,
  WriteResult,
} from "./contracts";
export type ConfigurationAttempt<D, I> = Attempt<D, I> &
  Readonly<{ operation: "save"; input: D }>;
export type ConfigurationAdapter<
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
  get(input: {
    scope: string;
    identity: I;
  }): Promise<{ values: D; identity: I; writable?: boolean }>;
  empty?(input: { scope: string; filters: F }): D;
  save(attempt: ConfigurationAttempt<D, I>): Promise<WriteResult>;
};
export type ConfigurationDefinition<
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
  adapter: ConfigurationAdapter<D, F, R, I>;
  reconcile?: (
    attempt: ConfigurationAttempt<D, I>,
  ) => Promise<ReconcileResult<E>>;
};
export function defineConfiguration<
  D extends object,
  F extends object,
  R extends object,
  I,
  E = never,
>(
  definition: ConfigurationDefinition<D, F, R, I, E>,
): ConfigurationDefinition<D, F, R, I, E> {
  return definition;
}
export type ConfigurationBlockProps<V, C> = {
  modelValue: V;
  catalog: C;
  mode: "read" | "edit";
  disabled: boolean;
  "onUpdate:modelValue"?: (value: V) => void;
  onPending?: (pending: boolean) => void;
};
export type ConfigurationBlock<D extends object> = {
  [K in Extract<keyof D, string>]: {
    key: K;
    component: Component<ConfigurationBlockProps<D[K], never>>;
    catalog: unknown;
  };
}[Extract<keyof D, string>];
// Capture the catalog type when assembling each block, without exposing runtime controls.
export function configurationBlock<D extends object>() {
  return <K extends Extract<keyof D, string>, C>(block: {
    key: K;
    component: Component<ConfigurationBlockProps<D[K], C>>;
    catalog: C;
  }): ConfigurationBlock<D> => block as ConfigurationBlock<D>;
}
