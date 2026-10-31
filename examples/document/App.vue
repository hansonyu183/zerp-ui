<script setup lang="ts">
import { computed, ref } from "vue";
import { defineDocumentPage, domainBlocks } from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import { sample, type Pricing, type Formula, type Scenario } from "./adapters";

const resource = ref("pricing"),
  scenario = ref<Scenario>("success");
const pricing = sample<Pricing>(
  "synthetic-prices",
  "合成档案 · 定价",
  [{ key: "name", label: "名称", type: "text", required: true }],
  {
    name: "合成定价",
    pricing: [{ customer: "客户甲", amount: "9007199254740993.0100" }],
  },
  () => scenario.value,
);
const formula = sample<Formula>(
  "synthetic-formula",
  "合成档案 · 配方",
  [{ key: "name", label: "名称", type: "text", required: true }],
  { name: "合成配方", formula: [{ material: "a", quantity: "0.0100" }] },
  () => scenario.value,
);
const priceBlocks = [
  domainBlocks<Pricing>().rows({
    key: "pricing",
    label: "合成客户定价",
    fields: [
      {
        key: "customer",
        label: "定价客户",
        type: "enum",
        options: [
          { value: "客户甲", label: "客户甲" },
          { value: "客户乙", label: "客户乙" },
        ],
      },
      { key: "amount", label: "定价金额", type: "decimal" },
    ],
    empty: () => ({ customer: "客户甲", amount: "0.0000" }),
    get: (value) => value,
    set: (_value, rows) => [...rows],
  }),
];
const formulaBlocks = [
  domainBlocks<Formula>().rows({
    key: "formula",
    label: "合成产品配方",
    fields: [
      {
        key: "material",
        label: "配方原料",
        type: "enum",
        options: [
          { value: "a", label: "合成原料甲" },
          { value: "b", label: "合成原料乙" },
        ],
      },
      { key: "quantity", label: "配方用量", type: "decimal" },
    ],
    empty: () => ({ material: "a", quantity: "0.0100" }),
    get: (value) => value,
    set: (_value, rows) => [...rows],
  }),
];
const permissions = { read: true, write: true, reconcile: true };
const pricePage = defineDocumentPage({
  definition: pricing,
  permissions,
  blocks: priceBlocks,
});
const formulaPage = defineDocumentPage({
  definition: formula,
  permissions,
  blocks: formulaBlocks,
});
const page = computed(() =>
  resource.value === "pricing" ? pricePage : formulaPage,
);
</script>
<template>
  <ExamplePage :page="page" />
  <aside class="example-controls" aria-label="合成档案控制">
    <p>合成内存 Adapter；不连接真实 ZERP API，不代表真实后端或 E2E 证据。</p>
    <label
      >档案示例<select v-model="resource" aria-label="档案示例">
        <option value="pricing">定价</option>
        <option value="formula">配方</option>
      </select></label
    >
    <label
      >写入情景<select v-model="scenario" aria-label="写入情景">
        <option value="success">成功</option>
        <option value="conflict">修订冲突</option>
        <option value="stage-unknown">暂存未知</option>
        <option value="business-unknown">提交未知</option>
        <option value="no-evidence">无核实证据</option>
        <option value="refresh-failure">刷新失败</option>
      </select></label
    >
  </aside>
</template>
