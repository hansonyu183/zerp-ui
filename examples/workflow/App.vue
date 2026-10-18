<script setup lang="ts">
const { showTitle = true } = defineProps<{ showTitle?: boolean }>();
import { WorkflowView, DocumentView } from "@zerp/ui";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { computed, ref } from "vue";
import { controls, workflow, documentFor, type DocumentRef } from "./adapters";
const route = useRoute(),
  router = useRouter(),
  scope = ref("session-a");
const documentDefinition = computed(() => documentFor(String(route.params.id)));
const permissions = {
  read: true,
  audit: true,
  reconcile: true,
  actions: [
    "OPEN_DOCUMENT",
    "CREATE_CHILD",
    "APPROVE_CHILD",
    "REJECT_CHILD",
    "RETRY_CHILD",
    "CANCEL_CHILD",
  ] as const,
  targets: ["receipt"],
};
function openDocument(document: DocumentRef) {
  void router.push(`/documents/${encodeURIComponent(document.id)}`);
}
</script>
<template>
  <main>
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
    <h1 v-if="showTitle">
      {{ route.path === "/" ? workflow.title : documentDefinition.title }}
    </h1>
    <WorkflowView
      v-if="route.path === '/'"
      :definition="workflow"
      :scope="scope"
      :permissions="permissions"
      @open-document="openDocument"
    />
    <section v-else>
      <p>消费者路由目标：{{ route.params.id }}</p>
      <DocumentView
        :key="String(route.params.id)"
        :definition="documentDefinition"
        :scope="scope"
        :permissions="{ read: true, write: true, reconcile: true }"
      />
    </section>
  </main>
</template>
