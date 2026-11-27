// 校验列表接收的有限报表样式和汇总值，并解析当前页可呈现的分组。
import type { Column } from "./types";
import type {
  ReportAppearance,
  ReportPresentation,
  ReportSummary,
} from "../../../../model/report";

export type ReportCell<T> =
  | {
      kind: "record";
      target: T;
      href: string;
      label: string;
    }
  | {
      kind: "select" | "detail";
      target: T;
      label: string;
      stamp: string;
    };
function object(
  value: unknown,
  keys: readonly string[] | undefined,
  message: string,
): void {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (keys && Object.keys(value).some((key) => !keys.includes(key)))
  )
    throw new Error(message);
}
export function validateReportColumns<R>(columns: readonly Column<R>[]) {
  const seen = new Set<string>();
  for (const column of columns) {
    object(column, ["key", "label"], "报表列定义包含不支持的属性。");
    if (
      typeof column.key !== "string" ||
      !column.key ||
      seen.has(column.key) ||
      typeof column.label !== "string" ||
      !column.label
    )
      throw new Error("报表列定义不正确或重复。");
    seen.add(column.key);
  }
}

export function validateReportSummary<R extends object>(
  fields: ReadonlySet<string>,
  summary: ReportSummary<R>,
) {
  object(summary, ["caption", "values"], "报表合计不正确。");
  if (typeof summary.caption !== "string")
    throw new Error("报表合计标题不正确。");
  object(summary.values, undefined, "报表合计值不正确。");
  for (const [key, value] of Object.entries(summary.values)) {
    if (!fields.has(key)) continue;
    if (
      value !== null &&
      value !== undefined &&
      typeof value !== "string" &&
      typeof value !== "boolean" &&
      !Number.isFinite(value)
    )
      throw new Error("报表合计值须为字符串、有限数字、布尔值或空值。");
  }
}
function validateReportKeys<R extends object, K extends string | number>(
  rows: readonly R[],
  rowKey: (row: R) => K,
) {
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
  return keys;
}
export function resolveReportGroups<
  R extends object,
  K extends string | number,
>(
  fields: ReadonlySet<string>,
  rows: readonly R[],
  rowKey: (row: R) => K,
  presentation: ReportPresentation<R, K> | undefined,
) {
  if (presentation === undefined) return [];
  object(presentation, ["rows", "groups"], "报表呈现属性不正确。");
  if (!Array.isArray(presentation.rows) || !Array.isArray(presentation.groups))
    throw new Error("报表呈现需要稳定行身份及呈现事实。");
  const keys = validateReportKeys(rows, rowKey);
  const positions = new Map(keys.map((key, index) => [key, index]));
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
    if (!positions.has(fact.rowId)) continue;
    if (styled.has(fact.rowId)) throw new Error("报表行呈现重复。");
    styled.add(fact.rowId);
    if (fact.appearance !== undefined) appearance(fact.appearance);
    if (fact.cells !== undefined) {
      object(fact.cells, undefined, "报表单元格呈现不正确。");
      for (const [key, value] of Object.entries(fact.cells))
        if (fields.has(key)) appearance(value as ReportAppearance);
    }
  }
  // 两端都在当前页才有位置呈现组头和小计。
  const ranges = presentation.groups.flatMap((group) => {
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
    const first = positions.get(group.firstKey);
    const last = positions.get(group.lastKey);
    if (first === undefined || last === undefined) return [];
    if (
      typeof group.id !== "string" ||
      !group.id ||
      typeof group.label !== "string" ||
      !Number.isInteger(group.level) ||
      group.level < 0 ||
      first > last ||
      typeof group.continuedBefore !== "boolean" ||
      typeof group.continuedAfter !== "boolean" ||
      (group.continuedBefore && first !== 0) ||
      (group.continuedAfter && last !== rows.length - 1)
    )
      throw new Error("报表分组身份、范围或续页事实不正确。");
    return [{ group, first, last }];
  });
  const ids = new Set<string>();
  // 从父组往子组处理，缺少可呈现父组时一并跳过子组。
  const visible: typeof ranges = [];
  for (const range of ranges.sort((a, b) => a.group.level - b.group.level)) {
    if (range.group.level > 0) {
      const parent = visible.find(
        (other) =>
          other.group.level === range.group.level - 1 &&
          other.first <= range.first &&
          other.last >= range.last,
      );
      if (!parent) continue;
      if (
        (range.group.continuedBefore && !parent.group.continuedBefore) ||
        (range.group.continuedAfter && !parent.group.continuedAfter)
      )
        throw new Error("报表分组续页事实与父组不一致。");
    }
    if (
      visible.some(
        (other) =>
          other.group.level === range.group.level &&
          other.first <= range.last &&
          range.first <= other.last,
      )
    )
      throw new Error("同层报表分组不能交叠。");
    if (ids.has(range.group.id)) throw new Error("报表分组身份重复。");
    validateReportSummary(fields, range.group.summary);
    ids.add(range.group.id);
    visible.push(range);
  }
  return visible.map(({ group }) => group);
}
