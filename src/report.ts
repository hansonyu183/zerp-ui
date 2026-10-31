import { validDate } from "./validation";
import type { Column, Fields, Page } from "./contracts";

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
/** Finite presentation facts; all amounts and subtotals are supplied by the consumer. */
export type ReportAppearance = {
  foreground?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
};
export type ReportPresentation<
  R,
  K extends string | number = string | number,
> = {
  rows: readonly {
    rowId: K;
    appearance?: ReportAppearance;
    cells?: Partial<Record<Extract<keyof R, string>, ReportAppearance>>;
  }[];
  groups: readonly {
    id: string;
    label: string;
    level: number;
    firstKey: K;
    lastKey: K;
    continuedBefore: boolean;
    continuedAfter: boolean;
    summary: ReportSummary<R>;
  }[];
};
export type ReportPage<
  R,
  K extends string | number = string | number,
> = Page<R> & {
  /** Absolute epoch milliseconds supplied by the authority; the library has no TTL. */
  expiresAt?: number;
  presentation?: ReportPresentation<R, K>;
};
export type ReportResultRequest<I> = {
  scope: string;
  resultId: I;
  signal: AbortSignal;
};
export type ReportValidity = {
  expiresAt?: number;
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
export type FixedReportAdapter<
  P extends object,
  R extends object,
  I,
  K extends string | number = string | number,
> = {
  query: (
    input: ReportQuery<P> & { requestId: string; signal: AbortSignal },
  ) => Promise<
    ReportPage<R, K> & {
      id: I;
      summary: ReportSummary<R>;
      context: string;
      columns?: readonly ReportColumn<R>[];
    }
  >;
  page: (
    input: ReportResultRequest<I> & { page: number; pageSize: number },
  ) => Promise<ReportPage<R, K>>;
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
  describeParameters?: (parameters: P) => string;
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
      adapter: FixedReportAdapter<P, R, I, K>;
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
  result: ReportPage<R, K> | null;
  page: number;
  pageSize: number;
  fixed: {
    id: I;
    summary: ReportSummary<R>;
    context: string;
    expiresAt?: number;
  } | null;
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
  columns: readonly Column<R>[],
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

function object(
  value: unknown,
  keys: readonly string[],
  message: string,
): void {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error(message);
}
export function validateReportColumns<R>(columns: readonly Column<R>[]) {
  const seen = new Set<string>();
  for (const column of columns) {
    object(
      column,
      ["key", "label", "type", "options", "visible", "width"],
      "报表列定义包含不支持的属性。",
    );
    if (
      typeof column.key !== "string" ||
      !column.key ||
      seen.has(column.key) ||
      typeof column.label !== "string" ||
      !column.label ||
      (column.type !== undefined &&
        !["text", "boolean", "decimal", "integer", "date", "enum"].includes(
          column.type,
        )) ||
      (column.visible !== undefined && typeof column.visible !== "boolean") ||
      (column.width !== undefined && typeof column.width !== "string")
    )
      throw new Error("报表列定义不正确或重复。");
    seen.add(column.key);
    if (column.type === "enum") {
      if (!Array.isArray(column.options))
        throw new Error("报表枚举列缺少选项。");
      const values = new Set<string>();
      for (const option of column.options) {
        object(option, ["value", "label"], "报表枚举选项不正确。");
        if (
          typeof option.value !== "string" ||
          typeof option.label !== "string" ||
          values.has(option.value)
        )
          throw new Error("报表枚举选项不正确。");
        values.add(option.value);
      }
    } else if (column.options !== undefined)
      throw new Error("只有枚举列可声明选项。");
  }
}
export function validateReportSummary<R extends object>(
  columns: readonly Column<R>[],
  summary: ReportSummary<R>,
) {
  object(summary, ["caption", "values"], "报表合计不正确。");
  if (typeof summary.caption !== "string")
    throw new Error("报表合计标题不正确。");
  object(
    summary.values,
    columns.map((column) => column.key),
    "报表合计引用未知列。",
  );
  validateReportRows(
    columns.filter((column) => Object.hasOwn(summary.values, column.key)),
    [summary.values as R],
  );
}
export function validateReportPresentation<
  R extends object,
  K extends string | number,
>(
  columns: readonly Column<R>[],
  rows: readonly R[],
  rowKey: ((row: R) => K) | undefined,
  presentation: ReportPresentation<R, K> | undefined,
) {
  if (presentation === undefined) return;
  object(presentation, ["rows", "groups"], "报表呈现属性不正确。");
  if (
    !rowKey ||
    !Array.isArray(presentation.rows) ||
    !Array.isArray(presentation.groups)
  )
    throw new Error("报表呈现需要稳定行身份及呈现事实。");
  const keys = rows.map(rowKey);
  if (
    keys.some(
      (key) =>
        (typeof key !== "string" && typeof key !== "number") ||
        (typeof key === "number" && !Number.isFinite(key)),
    ) ||
    new Set(keys).size !== keys.length
  )
    throw new Error("报表行身份必须稳定且不重复。");
  const positions = new Map(keys.map((key, index) => [key, index]));
  const fields = columns.map((column) => column.key);
  function appearance(value: ReportAppearance) {
    object(
      value,
      ["foreground", "background", "bold", "italic", "align"],
      "报表呈现包含不支持的样式。",
    );
    if (
      [value.foreground, value.background].some(
        (color) =>
          color !== undefined &&
          (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)),
      )
    )
      throw new Error("报表颜色须为六位十六进制颜色。");
    if (
      [value.bold, value.italic].some(
        (flag) => flag !== undefined && typeof flag !== "boolean",
      ) ||
      (value.align !== undefined &&
        !["left", "center", "right"].includes(value.align))
    )
      throw new Error("报表字形或对齐方式不正确。");
  }
  const styled = new Set<K>();
  const facts: ReportPresentation<R, K>["rows"] = presentation.rows;
  for (const fact of facts) {
    object(fact, ["rowId", "appearance", "cells"], "报表行呈现不正确。");
    if (!positions.has(fact.rowId) || styled.has(fact.rowId))
      throw new Error("报表呈现引用未知或重复行。");
    styled.add(fact.rowId);
    if (fact.appearance !== undefined) appearance(fact.appearance);
    if (fact.cells !== undefined) {
      object(fact.cells, fields, "报表呈现引用未知列。");
      for (const value of Object.values(fact.cells))
        appearance(value as ReportAppearance);
    }
  }
  const ids = new Set<string>();
  const groups: ReportPresentation<R, K>["groups"] = presentation.groups;
  const ranges = groups.map((group) => {
    object(
      group,
      [
        "id",
        "label",
        "level",
        "firstKey",
        "lastKey",
        "continuedBefore",
        "continuedAfter",
        "summary",
      ],
      "报表分组属性不正确。",
    );
    const first = positions.get(group.firstKey),
      last = positions.get(group.lastKey);
    if (
      typeof group.id !== "string" ||
      !group.id ||
      ids.has(group.id) ||
      typeof group.label !== "string" ||
      !Number.isInteger(group.level) ||
      group.level < 0 ||
      first === undefined ||
      last === undefined ||
      first > last ||
      typeof group.continuedBefore !== "boolean" ||
      typeof group.continuedAfter !== "boolean" ||
      (group.continuedBefore && first !== 0) ||
      (group.continuedAfter && last !== rows.length - 1)
    )
      throw new Error("报表分组身份、范围或续页事实不正确。");
    ids.add(group.id);
    validateReportSummary(columns, group.summary);
    return { group, first, last };
  });
  for (const range of ranges) {
    if (
      ranges.some(
        (other) =>
          other !== range &&
          other.group.level === range.group.level &&
          other.first <= range.last &&
          range.first <= other.last,
      )
    )
      throw new Error("同层报表分组不能交叠。");
    if (range.group.level > 0) {
      const parent = ranges.find(
        (other) =>
          other.group.level === range.group.level - 1 &&
          other.first <= range.first &&
          other.last >= range.last,
      );
      if (
        !parent ||
        (range.group.continuedBefore && !parent.group.continuedBefore) ||
        (range.group.continuedAfter && !parent.group.continuedAfter)
      )
        throw new Error("报表分组缺少匹配的父组。");
    }
  }
}
