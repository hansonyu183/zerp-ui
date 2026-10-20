<script setup lang="ts">
import { ref } from "vue";
import {
  VoucherEditor,
  type VoucherEditorDefinition,
  type VoucherEditorValue,
} from "@zerp/ui";

type Header = { supplier: string; date: string };
type Row = { id: string; name: string; quantity: string };
const definition: VoucherEditorDefinition<Header, Row> = {
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
  ],
  rowKey: (row) => row.id,
  emptyRow: () => ({ id: crypto.randomUUID(), name: "", quantity: "" }),
};
const value = ref<VoucherEditorValue<Header, Row>>({
  header: { supplier: "合成供应商甲", date: "2026-10-20" },
  rows: [{ id: "row-one", name: "合成商品甲", quantity: "0.0100" }],
});
</script>

<template>
  <section aria-label="独立单据编辑展示示例">
    <h2>独立单据编辑展示</h2>
    <VoucherEditor
      v-bind="definition"
      :model-value="value"
      scope="standalone-synthetic"
      mode="edit"
      @update:model-value="value = $event"
    />
  </section>
</template>
