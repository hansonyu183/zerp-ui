import { validDate } from "./validation";
import type { Fields, Page } from "./contracts";

// Reports use value parameters, never recursive editing or arbitrary commands.
type ParameterKind =
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "date-range"
  | "enum"
  | "multi-enum"
  | "reference"
  | "references";
type ParameterField<F> = F extends { type: infer T }
  ? Omit<F, "type"> & { type: Extract<T, ParameterKind> }
  : never;
export type ReportParameters<P extends object> = readonly ParameterField<
  Fields<P>[number]
>[];
type ColumnKind<V> =
  NonNullable<V> extends boolean
    ? { type: "boolean" }
    : NonNullable<V> extends number
      ? { type: "integer" }
      : NonNullable<V> extends string
        ? | { type?: "text" | "decimal" | "integer" | "date" }
          | {
              type: "enum";
              options: readonly { value: string; label: string }[];
            }
        : never;
export type ReportColumn<R> = {
  [K in Extract<keyof R, string>]: {
    key: K;
    label: string;
    visible?: boolean;
    width?: string;
  } & ColumnKind<R[K]>;
}[Extract<keyof R, string>];
export type ReportQuery<P> = {
  scope: string;
  parameters: P;
  page: number;
  pageSize: number;
};
export type ReportExport = { content: Blob; filename: string };
export type ReportAdapter<P extends object, R extends object> = {
  query?: (input: ReportQuery<P>) => Promise<Page<R>>;
  export?: (input: { scope: string; parameters: P }) => Promise<ReportExport>;
};
export type ReportDefinition<P extends object, R extends object> = {
  resource: string;
  title: string;
  parameters: ReportParameters<P>;
  initialParameters: () => P;
  columns: readonly ReportColumn<R>[];
  adapter: ReportAdapter<P, R>;
};
export function defineReport<P extends object, R extends object>(
  definition: ReportDefinition<P, R>,
): ReportDefinition<P, R> {
  return definition;
}

// Check result interpretation before exposing rows; never coerce decimal values to numbers.
export function validateReportRows<R extends object>(
  columns: readonly ReportColumn<R>[],
  rows: readonly R[],
) {
  for (const row of rows)
    for (const column of columns) {
      const value = row[column.key];
      if (value === null) continue;
      const valid =
        column.type === "boolean"
          ? typeof value === "boolean"
          : column.type === "integer"
            ? (typeof value === "number" && Number.isSafeInteger(value)) ||
              (typeof value === "string" && /^-?\d+$/.test(value))
            : column.type === "decimal"
              ? typeof value === "string" && /^[-+]?\d+(\.\d+)?$/.test(value)
              : column.type === "date"
                ? validDate(value)
                : typeof value === "string";
      if (!valid)
        throw new Error(`报表结果列“${column.label}”的值类型不匹配。`);
    }
}
