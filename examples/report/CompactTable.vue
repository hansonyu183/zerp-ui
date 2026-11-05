<script setup lang="ts">
import { ref } from "vue";
import { defineReport, defineReportPage, type ReportCell } from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
type Row = {
  id: string;
  name: string;
  date: string;
  amount: string;
  phone: string;
  note: string;
  detail: string;
  settings: string;
  print: string;
};
const rows: Row[] = [
  {
    id: "C001",
    name: "合成客户甲",
    date: "2026-11-05",
    amount: "123456.78",
    phone: "12345678901",
    note: "这是一条需要自然换行的完整业务备注",
    detail: "详情",
    settings: "设置",
    print: "打印",
  },
  {
    id: "C002",
    name: "合成客户乙",
    date: "2026-11-05",
    amount: "0.01",
    phone: "12345678902",
    note: "普通备注",
    detail: "详情",
    settings: "设置",
    print: "打印",
  },
];
const chosen = ref("");
const definition = defineReport<{}, Row, string, string, string>({
  kind: "fixed",
  resource: "compact-table",
  title: "紧凑表格",
  parameters: [],
  initialParameters: () => ({}),
  rowKey: (r) => r.id,
  columns: [
    { key: "id", label: "编号", width: "20rem" },
    { key: "name", label: "客户名称", width: "30rem" },
    { key: "date", label: "日期", type: "date", width: "20rem" },
    { key: "amount", label: "金额", type: "decimal", width: "25rem" },
    { key: "phone", label: "电话", width: "20rem" },
    { key: "note", label: "备注", width: "30rem" },
    { key: "detail", label: "客户详情", role: "action" },
    { key: "settings", label: "客户设置", role: "action" },
    { key: "print", label: "打印", role: "action" },
  ],
  cell: (r: Row, key: keyof Row): ReportCell<string> | undefined =>
    key === "id"
      ? {
          kind: "record",
          href: `#${r.id}`,
          label: `查看 ${r.id}`,
          target: r.id,
        }
      : ["detail", "settings", "print"].includes(key)
        ? {
            kind: "detail",
            label: `${r[key]} ${r.id}`,
            target: key + ":" + r.id,
            disabled: key === "print",
          }
        : undefined,
  adapter: {
    query: async () => ({
      id: "result",
      items: rows,
      total: 2,
      context: "业务日期 2026-11-05",
      summary: { caption: "合计", values: { amount: "123456.79" } },
    }),
    page: async () => ({ items: rows, total: 2 }),
    revalidate: async () => ({ status: "valid" as const }),
  },
});
const page = defineReportPage({
  definition,
  permissions: { query: true, export: false },
  onDrill: (d) => {
    chosen.value = d.cell.target;
  },
});
</script>
<template>
  <ExamplePage :page="page" /><output aria-label="选中操作">{{
    chosen
  }}</output>
</template>
