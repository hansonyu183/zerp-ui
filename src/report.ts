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
export type ReportCell<T> =
  | {
      kind: "record";
      target: T;
      href: string;
      label: string;
      disabled?: boolean;
    }
  | { kind: "select" | "detail"; target: T; label: string; disabled?: boolean };
export type ReportSummary<R> = { caption: string; values: Partial<R> };
export type ReportResultRequest<I> = {
  scope: string;
  resultId: I;
  signal: AbortSignal;
};
export type ReportValidity = {
  status: "valid" | "expired" | "forbidden" | "identity-invalid";
};
export type ReportCancellation = {
  status: "cancelled" | "completed" | "failed" | "cleanup-unconfirmed";
};
export class ReportUnavailable extends Error {
  constructor(
    public readonly reason: Exclude<ReportValidity["status"], "valid">,
    message: string,
  ) {
    super(message);
  }
}
export type FixedReportAdapter<P extends object, R extends object, I> = {
  query: (
    input: ReportQuery<P> & { requestId: string; signal: AbortSignal },
  ) => Promise<Page<R> & { id: I; summary: ReportSummary<R>; context: string }>;
  page: (
    input: ReportResultRequest<I> & { page: number; pageSize: number },
  ) => Promise<Page<R>>;
  export?: (input: ReportResultRequest<I>) => Promise<ReportExport>;
  revalidate: (input: ReportResultRequest<I>) => Promise<ReportValidity>;
  cancel?: (input: {
    scope: string;
    requestId: string;
  }) => Promise<ReportCancellation>;
};
type ReportBase<
  P extends object,
  R extends object,
  K extends string | number,
> = {
  resource: string;
  title: string;
  parameters: ReportParameters<P>;
  initialParameters: () => P;
  columns: readonly ReportColumn<R>[];
  rowKey: (row: R) => K;
};
export type ReportDrill<I, K, T> = {
  scope: string;
  resource: string;
  resultId: I;
  rowId: K;
  cell: ReportCell<T>;
};
export type ReportDefinition<
  P extends object,
  R extends object,
  I = string,
  K extends string | number = string | number,
  T = never,
> =
  | (ReportBase<P, R, K> & { kind: "parameter"; adapter: ReportAdapter<P, R> })
  | (ReportBase<P, R, K> & {
      kind: "fixed";
      adapter: FixedReportAdapter<P, R, I>;
      cell?: (
        row: R,
        column: Extract<keyof R, string>,
      ) => ReportCell<T> | undefined;
    });
export type ReportSnapshot<
  P extends object,
  R extends object,
  I = string,
  K extends string | number = string | number,
  T = never,
> = {
  scope: string;
  resource: string;
  input: P;
  applied: P | null;
  result: Page<R> | null;
  page: number;
  pageSize: number;
  fixed: { id: I; summary: ReportSummary<R>; context: string } | null;
  definition: ReportDefinition<P, R, I, K, T>;
  scroll: { left: number; top: number };
};
export function defineReport<
  P extends object,
  R extends object,
  I = string,
  K extends string | number = string | number,
  T = never,
>(
  definition: Extract<ReportDefinition<P, R, I, K, T>, { kind: "parameter" }>,
): Extract<ReportDefinition<P, R, I, K, T>, { kind: "parameter" }>;
export function defineReport<
  P extends object,
  R extends object,
  I = string,
  K extends string | number = string | number,
  T = never,
>(
  definition: Extract<ReportDefinition<P, R, I, K, T>, { kind: "fixed" }>,
): Extract<ReportDefinition<P, R, I, K, T>, { kind: "fixed" }>;
export function defineReport<
  P extends object,
  R extends object,
  I = string,
  K extends string | number = string | number,
  T = never,
>(
  definition: ReportDefinition<P, R, I, K, T>,
): ReportDefinition<P, R, I, K, T> {
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
      if (value === null || value === undefined) continue;
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
