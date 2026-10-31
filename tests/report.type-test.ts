import {
  defineReport,
  type ReportAdapter,
  type ReportParameters,
  type ReportColumn,
} from "../src/index";
type Parameters = {
  period: string[];
  minimum: string;
  limit: number;
  active: boolean;
};
type Row = { amount: string; count: number; active: boolean };
const parameters: ReportParameters<Parameters> = [
  { key: "period", label: "期间", type: "date-range" },
  { key: "minimum", label: "金额", type: "decimal" },
  { key: "limit", label: "数量", type: "integer" },
  { key: "active", label: "启用", type: "boolean" },
];
const columns: ReportColumn<Row>[] = [
  { key: "amount", label: "金额", type: "decimal" },
  { key: "count", label: "数量", type: "integer" },
  { key: "active", label: "启用", type: "boolean" },
];
const adapter: ReportAdapter<Parameters, Row> = {
  query: async ({ parameters, scope, page }) => ({
    items: [
      {
        amount: parameters.minimum,
        count: parameters.limit,
        active: parameters.active && !!scope && page > 0,
      },
    ],
    hasMore: false,
  }),
};
defineReport({
  kind: "parameter",
  rowKey: (row: Row) => row.amount,
  resource: "typed",
  title: "报表",
  parameters,
  columns,
  initialParameters: () => ({
    period: ["", ""],
    minimum: "0.0100",
    limit: 0,
    active: false,
  }),
  adapter,
});
const invalidParameters: ReportParameters<Parameters> = [
  // @ts-expect-error Decimal values must be strings, never integer DTO fields.
  { key: "limit", label: "错配", type: "decimal" },
  // @ts-expect-error Recursive editing is not a report parameter.
  { key: "period", label: "错配", type: "rows", fields: [], empty: () => ({}) },
];
const invalidColumns: ReportColumn<Row>[] = [
  // @ts-expect-error Decimal columns cannot silently accept floating point DTO values.
  { key: "count", label: "错配", type: "decimal" },
  // @ts-expect-error Unknown DTO key.
  { key: "missing", label: "错配" },
];
const invalidAdapter: ReportAdapter<Parameters, Row> = {
  // @ts-expect-error Adapter parameter DTO must match the definition.
  query: async (_input: { parameters: { foreign: string } }) => ({
    items: [],
    total: 0,
  }),
};
void [invalidParameters, invalidColumns, invalidAdapter];

// Distinct consumer identities must stay paired through result, page and drill.
import type {
  FixedReportAdapter,
  ReportDrill,
  ReportSnapshot,
} from "../src/index";
type ResultId = { readonly result: string };
type RowId = `row:${string}`;
type Target = { readonly voucher: string };
const fixedAdapter: FixedReportAdapter<Parameters, Row, ResultId, RowId> = {
  query: async () => ({
    id: { result: "one" },
    items: [],
    total: 0,
    summary: { caption: "全结果", values: { amount: "0.0000" } },
    context: "查询日",
  }),
  page: async ({ resultId }) => ({ items: [], hasMore: !!resultId.result }),
  export: async ({ resultId }) => ({
    content: new Blob([resultId.result]),
    filename: "all.csv",
  }),
  revalidate: async () => ({ status: "valid" }),
  cancel: async () => ({ status: "cleanup-unconfirmed" }),
};
const fixed = defineReport<Parameters, Row, ResultId, RowId, Target>({
  kind: "fixed",
  resource: "fixed",
  title: "固定",
  parameters,
  columns,
  initialParameters: () => ({
    period: [],
    minimum: "",
    limit: 0,
    active: false,
  }),
  rowKey: (row) => `row:${row.amount}`,
  adapter: fixedAdapter,
  cell: (row) => ({
    kind: "detail",
    target: { voucher: row.amount },
    label: "明细",
  }),
});
const drill: ReportDrill<ResultId, RowId, Target> = {
  scope: "s",
  resource: "fixed",
  resultId: { result: "one" },
  rowId: "row:one",
  cell: {
    kind: "record",
    href: "/one",
    label: "单据",
    target: { voucher: "one" },
  },
};
const wrongResult: ReportDrill<ResultId, RowId, Target> = {
  ...drill,
  // @ts-expect-error A row identity cannot replace the opaque result identity.
  resultId: "row:one",
};
const wrongRow: ReportDrill<ResultId, RowId, Target> = {
  ...drill,
  // @ts-expect-error A foreign row identity is rejected.
  rowId: "foreign",
};
const wrongTarget: ReportDrill<ResultId, RowId, Target> = {
  ...drill,
  // @ts-expect-error Foreign targets cannot enter this report's interaction contract.
  cell: { kind: "select", label: "选择", target: { customer: "one" } },
};
void fixedAdapter.page({
  scope: "s",
  // @ts-expect-error Fixed paging has no editable parameter input and requires a result identity.
  parameters: { limit: 1 },
  page: 1,
  pageSize: 2,
  signal: new AbortController().signal,
});
const wrongFixed: FixedReportAdapter<Parameters, Row, ResultId, RowId> = {
  ...fixedAdapter,
  // @ts-expect-error A query must return an explicit result identity and authoritative summary.
  query: async () => ({ items: [], total: 0 }),
};
const wrongRestore: ReportSnapshot<Parameters, Row, ResultId, RowId, Target> = {
  scope: "s",
  resource: "fixed",
  input: fixed.initialParameters(),
  applied: null,
  result: null,
  page: 1,
  pageSize: 2,
  fixed: null,
  scroll: { left: 0, top: 0 },
  // @ts-expect-error A snapshot with a foreign row identity cannot restore this report.
  definition: { ...fixed, rowKey: () => 123 },
};
void [fixed, wrongResult, wrongRow, wrongTarget, wrongFixed, wrongRestore];

import type {
  ReportAppearance,
  ReportPresentation,
  ListAction,
} from "../src/index";
const presentation: ReportPresentation<Row, RowId> = {
  rows: [
    {
      rowId: "row:one",
      appearance: { bold: true },
      cells: { amount: { foreground: "#123456", align: "right" } },
    },
  ],
  groups: [
    {
      id: "group",
      label: "分组",
      level: 0,
      firstKey: "row:one",
      lastKey: "row:two",
      continuedBefore: false,
      continuedAfter: true,
      summary: { caption: "权威小计", values: { amount: "19.00" } },
    },
  ],
};
const wrongAppearance: ReportAppearance = {
  // @ts-expect-error Arbitrary CSS cannot enter report presentation.
  position: "fixed",
};
const wrongPresentation: ReportPresentation<Row, RowId> = {
  rows: [
    // @ts-expect-error Presentation row references preserve the consumer row identity type.
    { rowId: "foreign" },
    {
      rowId: "row:one",
      cells: {
        // @ts-expect-error Presentation cells must name this DTO's columns.
        foreign: { bold: true },
      },
    },
  ],
  groups: [],
};
const finiteActions: ListAction[] = ["complete", "uncomplete"];
// @ts-expect-error Company native protocol names belong in the consumer Adapter.
const nativeAction: ListAction = "finish_r";
const dynamic: FixedReportAdapter<Parameters, Row, ResultId, RowId> = {
  ...fixedAdapter,
  query: async () => ({
    id: { result: "dynamic" },
    items: [],
    total: 0,
    columns,
    presentation,
    summary: { caption: "全组", values: { amount: "0" } },
    context: "本次条件",
    expiresAt: 1000,
  }),
};
void [wrongAppearance, wrongPresentation, finiteActions, nativeAction, dynamic];
