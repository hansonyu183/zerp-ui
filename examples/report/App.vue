<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import FixedReport from "./FixedReport.vue";
import CompactTable from "./CompactTable.vue";
import {
  defineReportPage,
  defineDetailsPage,
  type PageDefinition,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import { reportExample, type Scenario } from "./adapters";
const kind = ref<"batch" | "ledger" | "fixed" | "compact">("batch");
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
const relatedPage = shallowRef<PageDefinition<"details" | "task">>();
function showRelated() {
  relatedPage.value = defineDetailsPage({
    title: "合成资料详情",
    instance: "synthetic-detail",
    value: { name: "合成客户" },
    editor: {
      definition: {
        headerFields: [{ key: "name", label: "详情名称", type: "text" }],
        rowFields: [],
        columns: [],
        rowKey: () => "row",
        emptyRow: () => ({}),
      },
      value: { header: { name: "合成客户" }, rows: [] },
    },
    groups: [
      {
        key: "facts",
        label: "基本资料",
        fields: [{ key: "name", label: "名称", type: "text" }],
      },
    ],
  });
}
const page = defineReportPage(() => ({
  definition: definitions[kind.value === "ledger" ? "ledger" : "batch"],
  permissions: permissions.value,
  pageSize: 2,
  related: relatedPage.value
    ? {
        page: relatedPage.value,
        onClose: () => {
          relatedPage.value = undefined;
        },
      }
    : undefined,
}));
</script>
<template>
  <CompactTable v-if="kind === 'compact'" />
  <FixedReport v-else-if="kind === 'fixed'" />
  <ExamplePage v-else :page="page" scope="synthetic-session-1" />
  <aside class="example-controls" aria-label="合成报表控制">
    <button @click="showRelated">关联资料详情</button>
    <p>
      独立合成消费者：不连接真实 ZERP
      API。日期范围和金额下限仅演示原值传递，合成数据不按这两项筛选。
    </p>
    <label
      >报表示例<select v-model="kind" aria-label="报表示例">
        <option value="batch">hasMore 分批 DTO</option>
        <option value="ledger">total 台账 DTO</option>
        <option value="compact">紧凑表格</option>
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
  </aside>
</template>
