<script setup lang="ts">
import { ref } from "vue";
import {
  VoucherEditor,
  type VoucherEditorDefinition,
  type VoucherEditorValue,
  type VoucherEditorChange,
} from "@zerp/ui";
type Header = { note: string };
type Row = { id: string; name: string; count: number };
const value = ref<VoucherEditorValue<Header, Row>>({
  header: { note: "原表头" },
  rows: [
    { id: "original", name: "原明细", count: 1 },
    { id: "peer", name: "其他明细", count: 2 },
  ],
});
const scope = ref(0),
  adopted = ref(0),
  origin = ref("");
let release: (() => void) | undefined;
const definition: VoucherEditorDefinition<Header, Row> = {
  headerFields: [{ key: "note", label: "说明", type: "text" }],
  rowFields: [
    { key: "name", label: "明细名称", type: "text" },
    { key: "count", label: "件数", type: "integer" },
  ],
  columns: [
    { key: "name", label: "明细名称" },
    { key: "count", label: "件数" },
  ],
  rowKey: (row) => row.id,
  rowDraft: {
    prepare: ({ candidate }) =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            rowKey: "full-new",
            candidate: {
              header: { note: "初始化表头" },
              rows: [
                ...candidate.rows.map((row) =>
                  row.id === "peer" ? { ...row, name: "初始化他行" } : row,
                ),
                { id: "full-new", name: "初始化行", count: 0 },
              ],
            },
          });
      }),
    change: async ({ value: row, candidate }) => {
      if (row.count === 7) throw new Error("件数不可用，请重新输入。");
      return {
        header: { note: "计算表头" },
        rows: candidate.rows
          .filter((item) => row.name !== "移除" || item.id !== row.id)
          .map((item) =>
            item.id === "peer" ? { ...item, name: "跨行计算" } : item,
          ),
      };
    },
  },
};
function adopt(
  next: VoucherEditorValue<Header, Row>,
  change: VoucherEditorChange,
) {
  value.value = next;
  adopted.value++;
  origin.value = change.kind;
}
</script>
<template>
  <section aria-label="完整候选示例">
    <h2>完整候选示例</h2>
    <button type="button" @click="release?.()">返回完整初始化</button>
    <button type="button" @click="scope++">切换完整候选上下文</button>
    <p aria-label="已采用说明">{{ value.header.note }}</p>
    <p aria-label="采用次数">{{ adopted }}</p>
    <p aria-label="采用来源">{{ origin }}</p>
    <VoucherEditor
      v-bind="definition"
      :model-value="value"
      :scope="`full-${scope}`"
      mode="edit"
      @update:model-value="adopt"
    />
  </section>
</template>
