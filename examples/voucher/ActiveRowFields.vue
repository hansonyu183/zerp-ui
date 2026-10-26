<script setup lang="ts">
import { ref } from "vue";
import {
  VoucherEditor,
  type VoucherEditorDefinition,
  type VoucherEditorValue,
} from "@zerp/ui";
type Header = { note: string };
type Row = { id: string; role: string; name: string; quantity: string };
const value = ref<VoucherEditorValue<Header, Row>>({
  header: { note: "" },
  rows: [{ id: "main", role: "main", name: "合成主项", quantity: "1.0000" }],
});
let next = 1;
const definition: VoucherEditorDefinition<Header, Row> = {
  headerFields: [],
  rowFields: (row) => [
    {
      key: "role",
      label: "行角色",
      type: "enum",
      options: [
        { value: "main", label: "主项" },
        { value: "detail", label: "子项" },
      ],
    },
    { key: "name", label: "行名称", type: "text" },
    {
      key: "quantity",
      label: "行数量",
      type: "decimal",
      readonly: row.role === "main",
    },
    ...(row.role === "detail"
      ? [
          {
            key: "id" as const,
            label: "子项标识",
            type: "text" as const,
            readonly: true,
          },
        ]
      : []),
  ],
  columns: [
    { key: "name", label: "名称" },
    { key: "quantity", label: "数量", type: "decimal" },
  ],
  rowKey: (row) => row.id,
  rowDraft: {
    prepare: async ({ candidate }) => {
      const row = {
        id: "detail-" + next++,
        role: "detail",
        name: "合成子项",
        quantity: "1.0000",
      };
      return {
        rowKey: row.id,
        candidate: { ...candidate, rows: [...candidate.rows, row] },
      };
    },
    change: async ({ candidate }) => {
      await Promise.resolve();
      return candidate;
    },
  },
};
</script>
<template>
  <section aria-label="逐行字段示例">
    <h2>逐行字段</h2>
    <VoucherEditor
      v-model="value"
      v-bind="definition"
      scope="synthetic-active-row"
      mode="edit"
    /><output aria-label="逐行采用结果">{{
      value.rows
        .map((row) => row.id + ":" + row.role + ":" + row.quantity)
        .join("|")
    }}</output>
  </section>
</template>
