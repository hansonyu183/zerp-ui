import { defineReport, type ReportAdapter, type ReportExport } from "@zerp/ui";
export type Parameters = {
  keyword: string;
  range: string[];
  state: string;
  minimum: string;
  includeZero: boolean;
};
export type Row = {
  name: string;
  amount: string;
  state: string;
  internal: string;
};
export type Scenario = "success" | "empty" | "failure";
// Both backends are synthetic. Neither DTO is a library or ZERP model.
type BatchDTO = {
  records: { caption: string; decimalValue: string; completed: boolean }[];
  next: boolean;
};
type LedgerDTO = {
  entries: { description: string; balance: string; statusCode: string }[];
  count: number;
};
const delay = () => new Promise((resolve) => setTimeout(resolve, 40));
const rows: Row[] = [
  {
    name: "合成甲",
    amount: "9007199254740993.0100",
    state: "done",
    internal: "合成内部值",
  },
  {
    name: "合成乙",
    amount: "0.0000",
    state: "pending",
    internal: "合成内部值",
  },
  { name: "合成丙", amount: "-12.3400", state: "done", internal: "合成内部值" },
];
export function reportExample(
  kind: "batch" | "ledger",
  scenario: () => Scenario,
) {
  function selected(parameters: Parameters) {
    return rows.filter(
      (row) =>
        (!parameters.keyword || row.name.includes(parameters.keyword)) &&
        (!parameters.state || row.state === parameters.state) &&
        (parameters.includeZero || row.amount !== "0.0000"),
    );
  }
  const adapter: ReportAdapter<Parameters, Row> = {
    async query({ parameters, page, pageSize }) {
      await delay();
      if (scenario() === "failure") throw new Error("合成查询失败，请重试。");
      const all = scenario() === "empty" ? [] : selected(parameters);
      const part = all.slice((page - 1) * pageSize, page * pageSize);
      if (kind === "batch") {
        const dto: BatchDTO = {
          records: part.map((row) => ({
            caption: row.name,
            decimalValue: row.amount,
            completed: row.state === "done",
          })),
          next: page * pageSize < all.length,
        };
        return {
          items: dto.records.map((record) => ({
            name: record.caption,
            amount: record.decimalValue,
            state: record.completed ? "done" : "pending",
            internal: "消费者映射",
          })),
          hasMore: dto.next,
        };
      }
      const dto: LedgerDTO = {
        entries: part.map((row) => ({
          description: row.name,
          balance: row.amount,
          statusCode: row.state,
        })),
        count: all.length,
      };
      return {
        items: dto.entries.map((entry) => ({
          name: entry.description,
          amount: entry.balance,
          state: entry.statusCode,
          internal: "另一DTO映射",
        })),
        total: dto.count,
      };
    },
    async export({ parameters }): Promise<ReportExport> {
      await delay();
      if (scenario() === "failure") throw new Error("合成导出失败，请重试。");
      // This consumer owns its CSV schema; decimal strings are never parsed as floats.
      const lines = [
        "名称,金额,状态",
        ...selected(parameters).map(
          (row) =>
            `${row.name},${row.amount},${row.state === "done" ? "已完成" : "待处理"}`,
        ),
      ];
      return {
        content: new Blob(["\ufeff" + lines.join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
        filename: `synthetic-${kind}.csv`,
      };
    },
  };
  return defineReport<Parameters, Row>({
    resource: `synthetic-${kind}`,
    title: kind === "batch" ? "合成报表 · 分批" : "合成报表 · 台账",
    parameters: [
      { key: "keyword", label: "关键字", type: "text" },
      { key: "range", label: "日期范围", type: "date-range", required: true },
      {
        key: "state",
        label: "状态参数",
        type: "enum",
        options: [
          { value: "done", label: "已完成" },
          { value: "pending", label: "待处理" },
        ],
      },
      { key: "minimum", label: "金额下限", type: "decimal" },
      { key: "includeZero", label: "包含零值", type: "boolean" },
    ],
    initialParameters: () => ({
      keyword: "",
      range: ["2026-10-01", "2026-10-31"],
      state: "",
      minimum: "",
      includeZero: true,
    }),
    columns: [
      { key: "name", label: "名称", width: "12rem" },
      {
        key: "amount",
        label: "金额（原十进制值）",
        type: "decimal",
        width: "18rem",
      },
      {
        key: "state",
        label: "状态",
        type: "enum",
        options: [
          { value: "done", label: "已完成" },
          { value: "pending", label: "待处理" },
        ],
      },
      { key: "internal", label: "隐藏列", visible: false },
    ],
    adapter,
  });
}
