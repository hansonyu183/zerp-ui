<script setup lang="ts">
const { showTitle = true } = defineProps<{ showTitle?: boolean }>();
import { ref } from "vue";
import { ConfigurationView, configurationBlock } from "@zerp/ui";
import { sample, type Mapping, type Scenario } from "./adapters";
import ConfigurationContracts from "./ConfigurationContracts.vue";
import RouteBlock from "./RouteBlock.vue";
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
  configurationBlock<Mapping>()({
    key: "route",
    component: RouteBlock,
    catalog: ["目标甲", "目标乙"] as readonly string[],
  }),
];
const permissions = { read: true, write: true, reconcile: true };
</script>
<template>
  <main>
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
    <h1 v-if="showTitle">
      {{
        resource === "mapping"
          ? mapping.title
          : resource === "period"
            ? period.title
            : report.title
      }}
    </h1>
    <ConfigurationView
      v-if="resource === 'mapping'"
      :definition="mapping"
      :blocks="blocks"
      scope="synthetic-session"
      :permissions="permissions"
    />
    <ConfigurationView
      v-else-if="resource === 'period'"
      :definition="period"
      scope="synthetic-session"
      :permissions="permissions"
    />
    <ConfigurationView
      v-else
      :definition="report"
      scope="synthetic-session"
      :permissions="permissions"
    />
    <ConfigurationContracts v-if="showTitle" />
  </main>
</template>
