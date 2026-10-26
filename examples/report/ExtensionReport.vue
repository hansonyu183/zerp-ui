<script setup lang="ts">
import { ref } from "vue";
import { ReportView, defineReport, type ReportPresentation } from "@zerp/ui";
type Parameters = {
  month: string;
  amount: string;
  useAmount: boolean;
  hidden: string;
};
type Row = { id: string; group: string; amount: string };
const lastAction = ref("");
const presentation: ReportPresentation<Row> = {
  columns: [
    { key: "id", label: "记录" },
    {
      key: "amount",
      label: "精确金额",
      type: "decimal",
      styles: [
        {
          when: {
            key: "amount",
            op: "gt",
            type: "decimal",
            value: "9007199254740993.0100",
          },
          tone: "negative",
          bold: true,
        },
      ],
    },
  ],
  group: {
    key: "group",
    summaries: [
      {
        value: "A",
        caption: "示例组",
        summary: {
          caption: "全组合计",
          values: { amount: "9007199254740999.9999" },
        },
      },
    ],
  },
};
const definition = defineReport<Parameters, Row, string, string, string>({
  kind: "fixed",
  resource: "public-report-extensions",
  title: "参数与分组",
  columns: [{ key: "id", label: "查询前列" }],
  parameters: [
    { key: "month", label: "月份", type: "month", required: true },
    {
      key: "amount",
      label: "金额下限",
      type: "decimal",
      condition: { checkedKey: "useAmount" },
    },
    { key: "hidden", label: "内部条件", type: "text", hidden: true },
  ],
  initialParameters: () => ({
    month: "2026-10",
    amount: "0.0000",
    useAmount: false,
    hidden: "synthetic-retained",
  }),
  rowKey: (r) => r.id,
  cell: (r: Row, key: keyof Row) =>
    key === "id"
      ? { kind: "action" as const, target: r.id, label: "办理 " + r.id }
      : undefined,
  adapter: {
    query: async () => ({
      id: "extension-result-v1",
      items: [{ id: "第一行", group: "A", amount: "9007199254740993.0101" }],
      total: 2,
      summary: {
        caption: "完整结果",
        values: { amount: "9007199254740999.9999" },
      },
      context: "合成固定结果：合计由适配器提供，不按当前页重算。",
      presentation,
    }),
    page: async () => ({
      items: [{ id: "第二行", group: "A", amount: "6.9898" }],
      total: 2,
    }),
    revalidate: async () => ({ status: "valid" as const }),
  },
});
</script>
<template>
  <ReportView
    :definition="definition"
    scope="synthetic-extension"
    :permissions="{ query: true, export: false }"
    :page-size="1"
    @drill="lastAction = $event.cell.target"
  />
  <p v-if="lastAction" role="status">合成办理：{{ lastAction }}</p>
</template>
