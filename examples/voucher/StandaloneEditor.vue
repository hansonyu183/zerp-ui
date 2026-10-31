<script setup lang="ts">
import { ref } from "vue";
import ExamplePage from "../shared/ExamplePage.vue";
import {
  defineDetailsPage,
  type VoucherEditorDefinition,
  type VoucherEditorValue,
} from "@zerp/ui";

type Header = { supplier: string; date: string };
type Formula = { material: string; amount: string };
type Row = { id: string; name: string; quantity: string; formula: Formula[] };
const definition: VoucherEditorDefinition<Header, Row, Formula> = {
  headerFields: [
    { key: "supplier", label: "供应商", type: "text" },
    { key: "date", label: "单据日期", type: "date" },
  ],
  rowFields: [
    { key: "name", label: "品名", type: "text" },
    { key: "quantity", label: "数量", type: "decimal" },
  ],
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
