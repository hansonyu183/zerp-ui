import type { Column, Fields } from "./contracts";

export type VoucherEditorValue<H extends object, R extends object> = {
  header: H;
  rows: readonly R[];
};

export type VoucherEditorChildColumn<R extends object, C extends object> = {
  key: {
    [K in Extract<keyof R, string>]: R[K] extends readonly C[] ? K : never;
  }[Extract<keyof R, string>];
  label: string;
  type: "children";
  fields: Fields<C>;
  empty: () => C;
  summary: (children: readonly C[]) => string;
  visible?: boolean;
  width?: string;
};

export type VoucherEditorColumn<R extends object, C extends object = object> =
  Column<R> | VoucherEditorChildColumn<R, C>;

export type VoucherEditorDefinition<
  H extends object,
  R extends object,
  C extends object = object,
> = {
  headerFields: Fields<H>;
  rowFields: Fields<R>;
  columns: readonly VoucherEditorColumn<R, C>[];
  rowKey: (row: R) => string;
  emptyRow: () => R;
};
