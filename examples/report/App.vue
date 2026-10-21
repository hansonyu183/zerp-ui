<script setup lang="ts">
const { showTitle = true } = defineProps<{ showTitle?: boolean }>();
import { computed, ref } from "vue";
import FixedReport from "./FixedReport.vue";
import { ReportView } from "@zerp/ui";
import { reportExample, type Scenario } from "./adapters";
const kind = ref<"batch" | "ledger" | "fixed">("batch");
const scenario = ref<Scenario>("success");
const eligibility = ref("both");
const definitions = {
  batch: reportExample("batch", () => scenario.value),
  ledger: reportExample("ledger", () => scenario.value),
};
const permissions = computed(() => ({
  query: eligibility.value === "both" || eligibility.value === "query",
  export: eligibility.value === "both" || eligibility.value === "export",
}));
</script>
<template>
  <main>
    <p>
      独立合成消费者：不连接真实 ZERP
      API。日期范围和金额下限仅演示原值传递，合成数据不按这两项筛选。
    </p>
    <label
      >报表示例<select v-model="kind" aria-label="报表示例">
        <option value="batch">hasMore 分批 DTO</option>
        <option value="ledger">total 台账 DTO</option>
        <option value="fixed">固定结果、取消与返回恢复</option>
      </select></label
    >
    <label
      >操作资格<select v-model="eligibility" aria-label="操作资格">
        <option value="both">查询和导出</option>
        <option value="query">仅查询</option>
        <option value="export">仅导出</option>
        <option value="none">无资格</option>
      </select></label
    >
    <label
      >读取情景<select v-model="scenario" aria-label="读取情景">
        <option value="success">成功</option>
        <option value="empty">空结果</option>
        <option value="failure">失败</option>
      </select></label
    >
    <h1 v-if="showTitle">
      {{ kind === "fixed" ? "合成报表 · 固定结果" : definitions[kind].title }}
    </h1>
    <FixedReport v-if="kind === 'fixed'" />
    <ReportView
      v-else
      :definition="definitions[kind]"
      scope="synthetic-session-1"
      :permissions="permissions"
      :page-size="2"
    />
  </main>
</template>
