<script setup lang="ts">
const { showTitle = true } = defineProps<{ showTitle?: boolean }>();
import { ref } from "vue";
import { VoucherView, configurationBlock } from "@zerp/ui";
import { sample, scriptSample, type Scenario, type Entry } from "./adapters";
import EntryBlock from "./EntryBlock.vue";
const kind = ref<"ordinary" | "opening" | "system">("ordinary"),
  scenario = ref<Scenario>("success");
const ordinary = sample("ordinary", () => scenario.value),
  opening = sample("opening", () => scenario.value),
  system = sample("system", () => scenario.value);
const definitions = { ordinary, opening, system };
const permissions = { read: true, write: true, reconcile: true };
const script = { definition: scriptSample(() => scenario.value), permissions };
const blocks = [
  configurationBlock<Entry>()({
    key: "entry",
    component: EntryBlock,
    catalog: [
      { id: "source-one", label: "合成来源甲", revision: "source-r7" },
      { id: "source-two", label: "合成来源乙", revision: "source-r3" },
    ] as readonly { id: string; label: string; revision: string }[],
  }),
];
</script>
<template>
  <main>
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
    <h1 v-if="showTitle">{{ definitions[kind].title }}</h1>
    <VoucherView
      :definition="definitions[kind]"
      :blocks="blocks"
      scope="synthetic-session"
      :permissions="permissions"
      :script="kind === 'ordinary' ? script : undefined"
    />
  </main>
</template>
