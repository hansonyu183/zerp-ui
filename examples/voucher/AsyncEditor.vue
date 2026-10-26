<script setup lang="ts">
import { ref } from "vue";
import {
  VoucherEditor,
  type VoucherEditorDefinition,
  type VoucherEditorValue,
} from "@zerp/ui";
type Header = { note: string };
type Row = { id: string; name: string; quantity: string };
const scope = ref(0),
  pending = ref(false);
const value = ref<VoucherEditorValue<Header, Row>>({
  header: { note: "" },
  rows: [{ id: "existing", name: "现有行", quantity: "1.0000" }],
});
let complete: (() => void) | undefined;
let reject: ((error: Error) => void) | undefined;
const definition: VoucherEditorDefinition<Header, Row> = {
  headerFields: [],
  rowFields: [
    { key: "name", label: "名称", type: "text" },
    { key: "quantity", label: "数量", type: "decimal" },
  ],
  columns: [
    { key: "name", label: "名称" },
    { key: "quantity", label: "数量", type: "decimal" },
  ],
  rowKey: (row) => row.id,
  emptyRow: () =>
    new Promise<Row>((resolve, fail) => {
      complete = () =>
        resolve({ id: "prepared-row", name: "异步默认行", quantity: "0.0000" });
      reject = fail;
    }),
  transformRow: ({ value: next }) =>
    new Promise<Row>((resolve, fail) => {
      complete = () => resolve({ ...next, quantity: "123.4500" });
      reject = fail;
    }),
};
</script>
<template>
  <section aria-label="异步明细示例">
    <h2>异步明细示例</h2>
    <button type="button" @click="complete?.()">返回准备结果</button>
    <button type="button" @click="reject?.(new Error('请重新选择产品。'))">
      模拟准备失败
    </button>
    <button type="button" @click="scope++">切换明细上下文</button>
    <span role="status">{{ pending ? "明细准备中" : "明细空闲" }}</span>
    <VoucherEditor
      v-bind="definition"
      v-model="value"
      :scope="`async-${scope}`"
      mode="edit"
      @pending="pending = $event"
    />
  </section>
</template>
