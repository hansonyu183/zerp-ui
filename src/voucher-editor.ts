import { arrayFields, childArray } from "./model-array-fields";
import { clone } from "./clone";
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
  rowFields: Fields<R> | ((row: R) => Fields<R>);
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

import { validate } from "./validation";
/** Internal validation includes committed nested rows as well as unfinished editor state. */
export function validateVoucherContent<
  H extends object,
  R extends object,
  C extends object,
>(
  definition: VoucherEditorDefinition<H, R, C>,
  value: VoucherEditorValue<H, R>,
  mode: "create" | "edit" = "edit",
): string | undefined {
  const header = validate(definition.headerFields, value.header, mode);
  if (header) return header;
  for (const row of value.rows) {
    const invalid = validate(
      typeof definition.rowFields === "function"
        ? definition.rowFields(clone(row))
        : definition.rowFields,
      row,
      mode,
    );
    if (invalid) return invalid;
    for (const column of definition.columns) {
      if (column.type !== "children") continue;
      const children = row[column.key];
      if (!Array.isArray(children)) return `${column.label}应为明细列表。`;
      for (const child of children) {
        if (!child || typeof child !== "object")
          return `${column.label}包含无效子项。`;
        const problem = validate(
          arrayFields(childArray(column, row), child),
          child,
          mode,
        );
        if (problem) return problem;
      }
    }
  }
  return undefined;
}
