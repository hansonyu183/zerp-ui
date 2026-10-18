<script setup lang="ts">
const { showTitle = true } = defineProps<{ showTitle?: boolean }>();
import { ref } from "vue";
import { VersionView, configurationBlock } from "@zerp/ui";
import { sample, type Pricing, type Formula, type Scenario } from "./adapters";
import PricingBlock from "./PricingBlock.vue";
import FormulaBlock from "./FormulaBlock.vue";
const resource = ref("pricing"),
  scenario = ref<Scenario>("success");
const pricing = sample<Pricing>(
  "synthetic-prices",
  "合成版本 · 定价",
  [{ key: "name", label: "名称", type: "text", required: true }],
  {
    name: "合成定价",
    pricing: [{ customer: "客户甲", amount: "9007199254740993.0100" }],
  },
  () => scenario.value,
);
const formula = sample<Formula>(
  "synthetic-formula",
  "合成版本 · 配方",
  [{ key: "name", label: "名称", type: "text", required: true }],
  { name: "合成配方", formula: [{ material: "a", quantity: "0.0100" }] },
  () => scenario.value,
);
const priceBlocks = [
  configurationBlock<Pricing>()({
    key: "pricing",
    component: PricingBlock,
    catalog: ["客户甲", "客户乙"] as readonly string[],
  }),
];
const formulaBlocks = [
  configurationBlock<Formula>()({
    key: "formula",
    component: FormulaBlock,
    catalog: [
      { code: "a", label: "合成原料甲" },
      { code: "b", label: "合成原料乙" },
    ] as readonly { code: string; label: string }[],
  }),
];
const permissions = { read: true, write: true, reconcile: true };
</script>
<template>
  <main>
    <p>合成内存 Adapter；不连接真实 ZERP API，不代表真实后端或 E2E 证据。</p>
    <label
      >版本示例<select v-model="resource" aria-label="版本示例">
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
    <h1 v-if="showTitle">
      {{ resource === "pricing" ? pricing.title : formula.title }}
    </h1>
    <VersionView
      v-if="resource === 'pricing'"
      :definition="pricing"
      :blocks="priceBlocks"
      scope="synthetic-session"
      :permissions="permissions"
    />
    <VersionView
      v-else
      :definition="formula"
      :blocks="formulaBlocks"
      scope="synthetic-session"
      :permissions="permissions"
    />
  </main>
</template>
