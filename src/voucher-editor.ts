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

export type VoucherEditorChange = { kind: "header" | "row" | "delete" };

export type VoucherEditorRowDraft<H extends object, R extends object> = {
  prepare: (input: {
    candidate: VoucherEditorValue<H, R>;
  }) =>
    | { rowKey: string; candidate: VoucherEditorValue<H, R> }
    | Promise<{ rowKey: string; candidate: VoucherEditorValue<H, R> }>;
  change?: (input: {
    value: R;
    previous: R;
    candidate: VoucherEditorValue<H, R>;
  }) => VoucherEditorValue<H, R> | Promise<VoucherEditorValue<H, R>>;
};

export type VoucherEditorDefinition<
  H extends object,
  R extends object,
  C extends object = object,
> = {
  headerFields: Fields<H>;
  rowFields: Fields<R>;
  columns: readonly VoucherEditorColumn<R, C>[];
  rowKey: (row: R) => string;
  rowOperations?: { insert: boolean; update: boolean; delete: boolean };
  transformRow?: (change: { value: R; previous: R }) => R | Promise<R>;
} & (
  | { emptyRow: () => R | Promise<R>; rowDraft?: never }
  | {
      rowDraft: VoucherEditorRowDraft<H, R>;
      emptyRow?: never;
      transformRow?: undefined;
    }
);
