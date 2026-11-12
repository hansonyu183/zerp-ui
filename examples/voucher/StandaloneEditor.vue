<script setup lang="ts">
import { ref } from "vue";
import ExamplePage from "../shared/ExamplePage.vue";
import {
  defineDetailsPage,
  projectBusinessVoucherEditor,
  type VoucherEditorDefinition,
  type VoucherEditorValue,
} from "@zerp/ui";

type Header = { supplier: string; date: string };
type Formula = { material: string; amount: string };
type Row = { id: string; name: string; quantity: string; formula: Formula[] };
const definition: VoucherEditorDefinition<Header, Row, Formula> = {
  ...projectBusinessVoucherEditor<Header, Row, Formula>(
    {
      kind: "object",
      name: "合成单据",
      properties: {
        header: {
          kind: "object",
          name: "表头",
          properties: {
            supplier: { kind: "text", name: "供应商" },
            date: { kind: "date", name: "单据日期" },
          },
          form: { fields: ["supplier", "date"] },
        },
        rows: {
          kind: "array",
          name: "明细",
          element: {
            kind: "object",
            name: "明细",
            properties: {
              name: { kind: "text", name: "品名" },
              quantity: {
                kind: "decimal",
                name: "数量",
                numericText: "decimal",
              },
            },
            form: { fields: ["name", "quantity"] },
            list: { fields: ["name", "quantity"] },
          },
        },
      },
    },
    {
      rowKey: (row) => row.id,
      emptyRow: () => ({
        id: crypto.randomUUID(),
        name: "",
        quantity: "",
        formula: [],
      }),
    },
  ),
  columns: [
    { key: "name", label: "品名" },
    { key: "quantity", label: "数量", type: "decimal" },
    {
      key: "formula",
      label: "配方",
      type: "children",
      fields: [
        { key: "material", label: "原料", type: "text" },
        { key: "amount", label: "用量", type: "decimal" },
      ],
      empty: () => ({ material: "", amount: "" }),
      summary: (children) => `${children.length} 项`,
    },
  ],
  rowKey: (row) => row.id,
  emptyRow: () => ({
    id: crypto.randomUUID(),
    name: "",
    quantity: "",
    formula: [],
  }),
};
const value = ref<VoucherEditorValue<Header, Row>>({
  header: { supplier: "合成供应商甲", date: "2026-10-20" },
  rows: [
    { id: "row-one", name: "合成商品甲", quantity: "0.0100", formula: [] },
  ],
});
const page = defineDetailsPage(() => ({
  title: "独立单据编辑展示",
  value: {},
  groups: [],
  instance: "synthetic-editor",
  editor: {
    definition,
    value: value.value,
    onChange: (content: VoucherEditorValue<Header, Row>) =>
      (value.value = content),
  },
}));
</script>

<template>
  <section aria-label="独立单据编辑展示示例">
    <ExamplePage :page="page" scope="standalone-synthetic" />
  </section>
</template>
