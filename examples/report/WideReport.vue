<script setup lang="ts">
import { ref } from "vue";
import { defineReport, defineReportPage, type ReportColumn } from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
type Row = { id: string; [key: string]: string };
const selected = ref("");
const columns: ReportColumn<Row>[] = [
  { key: "id", label: "客户编号", width: "160px" },
  { key: "name", label: "客户名称", width: "280px" },
  { key: "salesperson", label: "业务员" },
  { key: "terms", label: "结算方式" },
  { key: "date", label: "最近交易日", type: "date" },
  { key: "orders", label: "订单数", type: "integer" },
  ...[
    ["sales", "销售金额"],
    ["receipts", "收款金额"],
    ["debt", "当前欠款"],
    ["limit", "欠款额度"],
    ["cost", "销售成本"],
    ["profit", "销售毛利"],
    ["freight", "运输成本"],
    ["returns", "退货金额"],
  ].map(([key, label]) => ({
    key: key!,
    label: label!,
    type: "decimal" as const,
    width: "160px",
  })),
  { key: "address", label: "地址", width: "360px" },
  { key: "note", label: "备注", width: "400px" },
  { key: "view", label: "客户详情" },
  { key: "settings", label: "客户设置" },
];
const items: Row[] = [1, 2, 3].map((i) => ({
  id: `SYN-00${i}`,
  name: `合成客户${i}${i === 2 ? "（名称较长的分公司）" : ""}`,
  salesperson: `业务员${i}`,
  terms: "月结",
  date: "2026-11-05",
  orders: String(i * 12),
  sales: "123456.78",
  receipts: "100000.00",
  debt: "23456.78",
  limit: "100000.00",
  cost: "90000.00",
  profit: "33456.78",
  freight: "2000.00",
  returns: "0.00",
  address: "合成地区示例路123号第二栋",
  note: i === 2 ? "LONG-UNBROKEN-REFERENCE-".repeat(5) : "送货前联系收货人",
  view: "查看",
  settings: "设置",
}));
const definition = defineReport<{}, Row, string, string, string>({
  kind: "fixed",
  resource: "synthetic-wide",
  title: "多列报表排版试用",
  parameters: [],
  initialParameters: () => ({}),
  describeParameters: () => "全部",
  columns,
  rowKey: (row) => row.id,
  cell: (row: Row, key: string) =>
    key === "view" || key === "settings"
      ? {
          kind: "detail" as const,
          target: row.id,
          label: `${key === "view" ? "查看" : "设置"} ${row.name}`,
        }
      : undefined,
  adapter: {
    query: async () => ({
      id: "synthetic-wide-1",
      items,
      total: items.length,
      summary: {
        caption: "合计",
        values: { sales: "370370.34", debt: "70370.34" },
      },
      context: "合成数据",
    }),
    page: async () => ({ items, total: items.length }),
    revalidate: async () => ({ status: "valid" as const }),
  },
});
const page = defineReportPage({
  definition,
  permissions: { query: true, export: false },
  onDrill: (intent) => {
    selected.value = `${intent.cell.label}`;
  },
});
</script>
<template>
  <ExamplePage :page="page" />
  <output v-if="selected" aria-label="试用操作结果">{{ selected }}</output>
</template>
