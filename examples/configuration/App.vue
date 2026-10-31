<script setup lang="ts">
import { computed, ref } from "vue";
import { defineConfigurationPage, domainBlocks } from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import { sample, type Mapping, type Scenario } from "./adapters";
import ConfigurationContracts from "./ConfigurationContracts.vue";

const resource = ref("mapping"),
  scenario = ref<Scenario>("success");
const mode = () => scenario.value;
const mapping = sample<Mapping>(
  "mapping",
  "合成配置 · 映射",
  [{ key: "name", label: "名称", type: "text" }],
  { name: "合成映射", route: { target: "目标甲", dimensions: ["维度一"] } },
  mode,
  true,
);
const period = sample(
  "period",
  "合成配置 · 期间",
  [
    { key: "name", label: "名称", type: "text", readonly: true },
    { key: "locked", label: "锁定", type: "boolean" },
  ],
  { name: "合成期间", locked: false },
  mode,
);
const report = sample(
  "report",
  "合成配置 · 报表定义",
  [
    { key: "name", label: "名称", type: "text" },
    { key: "expression", label: "表达式", type: "textarea" },
    {
      key: "parameters",
      label: "参数",
      type: "rows",
      fields: [{ key: "name", label: "参数名", type: "text" }],
      empty: () => ({ name: "" }),
    },
  ],
  {
    name: "合成报表",
    expression: "synthetic source",
    parameters: [{ name: "期间" }],
  },
  mode,
  true,
);
const blocks = [
  domainBlocks<Mapping>().fields({
    key: "route",
    label: "合成映射区块",
    fields: [
      {
        key: "target",
        label: "映射目标",
        type: "enum",
        options: [
          { value: "目标甲", label: "目标甲" },
          { value: "目标乙", label: "目标乙" },
        ],
      },
      {
        key: "dimensions",
        label: "维度",
        type: "multi-enum",
        options: [{ value: "维度一", label: "维度一" }],
      },
    ],
  }),
];
const permissions = { read: true, write: true, reconcile: true };
const mappingPage = defineConfigurationPage({
  definition: mapping,
  blocks,
  permissions,
});
const periodPage = defineConfigurationPage({ definition: period, permissions });
const reportPage = defineConfigurationPage({ definition: report, permissions });
const contracts = ref(false);
const scope = ref("synthetic-session-a");
const page = computed(() =>
  resource.value === "mapping"
    ? mappingPage
    : resource.value === "period"
      ? periodPage
      : reportPage,
);
</script>
<template>
  <ConfigurationContracts v-if="contracts" />
  <ExamplePage v-else :page="page" :scope="scope" />
  <aside class="example-controls" aria-label="合成配置控制">
    <label
      >配置会话<select v-model="scope" aria-label="配置会话">
        <option>synthetic-session-a</option>
        <option>synthetic-session-b</option>
      </select></label
    >
    <p>合成 Adapter 演示；不连接真实 API，不执行试算。</p>
    <label
      >配置示例<select v-model="resource" aria-label="配置示例">
        <option value="mapping">映射</option>
        <option value="period">期间</option>
        <option value="report">报表定义</option>
      </select></label
    >
    <label
      >写入情景<select v-model="scenario" aria-label="写入情景">
        <option value="success">成功</option>
        <option value="conflict">修订冲突</option>
        <option value="unknown-applied">未知后确认成功</option>
        <option value="unknown-not-applied">未知后确认未应用</option>
        <option value="unknown-no-evidence">未知且无证据</option>
        <option value="refresh-failure">成功后刷新失败</option>
      </select></label
    >
    <button @click="contracts = !contracts">
      {{ contracts ? "返回配置示例" : "展示配置接缝" }}
    </button>
  </aside>
</template>
