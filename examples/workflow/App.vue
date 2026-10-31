<script setup lang="ts">
import { defineWorkflowPage, defineVoucherPage } from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { computed, ref } from "vue";
import { controls, workflow, voucherFor, type VoucherRef } from "./adapters";
const route = useRoute(),
  router = useRouter(),
  scope = ref("session-a");
const voucherDefinition = computed(() =>
  voucherFor(
    String(
      route.params.id ?? decodeURIComponent(route.path.split("/").at(-1) ?? ""),
    ),
  ),
);
const permissions = {
  read: true,
  audit: true,
  reconcile: true,
  actions: [
    "OPEN_VOUCHER",
    "CREATE_CHILD",
    "APPROVE_CHILD",
    "REJECT_CHILD",
    "RETRY_CHILD",
    "CANCEL_CHILD",
  ] as const,
  targets: ["receipt"],
};
function openVoucher(voucher: VoucherRef) {
  void router.push(`/vouchers/${encodeURIComponent(voucher.id)}`);
}
const flowPage = defineWorkflowPage({
  definition: workflow,
  permissions,
  onOpenVoucher: openVoucher,
});
const voucherPage = defineVoucherPage(() => ({
  definition: voucherDefinition.value,
  permissions: { read: true, write: true, reconcile: true },
}));
const isFlow = computed(() => !route.path.startsWith("/vouchers/"));
const page = computed(() => (isFlow.value ? flowPage : voucherPage));
</script>
<template>
  <ExamplePage :page="page" :scope="scope" />
  <aside class="example-controls" aria-label="合成流程控制">
    <p>独立合成 Adapter 演示；资格与审计不代表真实后端授权或 ZERP E2E。</p>
    <label
      >会话作用域<select v-model="scope" aria-label="会话作用域">
        <option>session-a</option>
        <option>session-b</option>
      </select></label
    >
    <label
      >写入情景<select v-model="controls.scenario" aria-label="写入情景">
        <option value="success">成功</option>
        <option value="unknown">已应用但响应未知</option>
        <option value="not-applied">确认未应用</option>
        <option value="no-evidence">只有历史同类审计</option>
        <option value="conflict">冲突</option>
        <option value="refresh-failure">成功后刷新失败</option>
      </select></label
    >
    <label
      >读取情景<select v-model="controls.reads" aria-label="读取情景">
        <option value="success">成功</option>
        <option value="failure">失败</option>
        <option value="empty">空态</option>
      </select></label
    >
    <RouterLink to="/">返回流程</RouterLink>
    <p v-if="!isFlow">
      消费者路由目标：{{
        route.params.id ??
        decodeURIComponent(route.path.split("/").at(-1) ?? "")
      }}
    </p>
  </aside>
</template>
