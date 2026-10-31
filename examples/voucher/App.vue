<script setup lang="ts">
import { ref, shallowRef } from "vue";
import {
  defineVoucherPage,
  domainBlocks,
  type VoucherEditorDefinition,
  type ReferenceAdapter,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import { sample, scriptSample, type Scenario, type Entry } from "./adapters";

import Operations from "./Operations.vue";
import StandaloneEditor from "./StandaloneEditor.vue";
const kind = ref<"ordinary" | "opening" | "system">("ordinary"),
  scenario = ref<Scenario>("success");
const observedInput = shallowRef<Entry>();
const ordinary = sample(
    "ordinary",
    () => scenario.value,
    (value) => (observedInput.value = value),
  ),
  opening = sample(
    "opening",
    () => scenario.value,
    (value) => (observedInput.value = value),
  ),
  system = sample(
    "system",
    () => scenario.value,
    (value) => (observedInput.value = value),
  );
const definitions = { ordinary, opening, system };
const permissions = { read: true, write: true, reconcile: true };
const script = { definition: scriptSample(() => scenario.value), permissions };
type Header = Pick<Entry["entry"], "amount" | "source">;
type Row = Entry["entry"]["rows"][number];
type Child = Row["children"][number];
const source: ReferenceAdapter = {
  search: async () => ({
    items: [
      {
        id: "source-one",
        label: "合成来源甲",
        snapshot: { revision: "source-r7", rate: "0.0100" },
      },
      {
        id: "source-two",
        label: "合成来源乙",
        snapshot: { revision: "source-r3", rate: "0.0100" },
      },
    ],
    hasMore: false,
  }),
  resolve: async ({ ids }) =>
    ids.map((id) => ({ id, label: `已采用 ${id}`, selectable: false })),
};
const sheet: VoucherEditorDefinition<Header, Row, Child> = {
  headerFields: [
    { key: "amount", label: "精确金额", type: "decimal" },
    { key: "source", label: "精确来源", type: "reference", adapter: source },
  ],
  rowFields: [{ key: "name", label: "行名称", type: "text" }],
  columns: [
    { key: "name", label: "行名称" },
    {
      key: "children",
      label: "配方",
      type: "children",
      fields: [{ key: "amount", label: "子项金额", type: "decimal" }],
      empty: () => ({ amount: "0.0100" }),
      summary: (rows) => `${rows.length} 项`,
    },
  ],
  rowKey: (row) => row.id,
  emptyRow: () => ({ id: crypto.randomUUID(), name: "新行", children: [] }),
};
const blocks = [
  domainBlocks<Entry>().voucher({
    key: "entry",
    label: "专用录入区块",
    editor: sheet,
    get: (value) => ({
      header: { amount: value.amount, source: value.source },
      rows: value.rows,
    }),
    set: (_value, content) => ({
      amount: content.header.amount,
      source: content.header.source,
      rows: [...content.rows],
    }),
  }),
];
const page = defineVoucherPage(() => ({
  definition: definitions[kind.value],
  blocks,
  permissions,
  script: kind.value === "ordinary" ? script : undefined,
}));
const mode = ref("submission");
const scope = ref("synthetic-session-a");
</script>
<template>
  <ExamplePage v-if="mode === 'submission'" :page="page" :scope="scope" />
  <StandaloneEditor v-else-if="mode === 'editor'" />
  <Operations v-else />
  <aside class="example-controls" aria-label="合成单据控制">
    <label
      >单据会话<select v-model="scope" aria-label="单据会话">
        <option>synthetic-session-a</option>
        <option>synthetic-session-b</option>
      </select></label
    >
    <p>合成内存 Adapter；不连接真实 ZERP API，不代表真实后端或 E2E 证据。</p>
    <label
      >单据示例<select v-model="kind" aria-label="单据示例">
        <option value="ordinary">普通录入</option>
        <option value="opening">期初</option>
        <option value="system">只读系统</option>
      </select></label
    >
    <label
      >写入情景<select v-model="scenario" aria-label="写入情景">
        <option value="success">成功</option>
        <option value="conflict">冲突</option>
        <option value="unknown-applied">未知已应用</option>
        <option value="unknown-not-applied">未知未应用</option>
        <option value="no-evidence">证据不足</option>
        <option value="stage-unknown">暂存未知</option>
        <option value="refresh-failure">刷新失败</option>
      </select></label
    >
    <label
      >单据演示<select v-model="mode" aria-label="单据演示">
        <option value="submission">完整单据</option>
        <option value="editor">详情编辑</option>
        <option value="operation">独立单据办理示例</option>
      </select></label
    >
    <output aria-label="合成单据原输入">{{
      JSON.stringify(observedInput)
    }}</output>
  </aside>
</template>
