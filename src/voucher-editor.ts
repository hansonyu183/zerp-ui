import type { Column, Fields } from "./contracts";

export type VoucherEditorValue<H extends object, R extends object> = {
  header: H;
  rows: readonly R[];
};

export type VoucherEditorDefinition<H extends object, R extends object> = {
  headerFields: Fields<H>;
  rowFields: Fields<R>;
  columns: readonly Column<R>[];
  rowKey: (row: R) => string;
  emptyRow: () => R;
};
