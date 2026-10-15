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
