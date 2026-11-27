<script setup lang="ts">
// 组织单个集合的筛选、查询、分页和打印入口，将记录打开请求交给 WorkPage。
import { computed, onMounted, onBeforeUnmount } from "vue";
import { VBtn } from "vuetify/components";
import type {
  CollectionTarget,
  ListCollection,
  ObjectNode,
} from "../../../model/business-model";
import {
  isPending,
  loadPage,
  queryView as getQueryView,
  runOperation,
} from "../../operations";
import { available, operations, readable as nodeReadable } from "../../nodes";
import { currentModel, sessionScope, sessionState } from "../../session";
import { routedCollection } from "../work-router";
import type { RecordRequest } from "../dialogs/record-windows";
import { reportPosition, saveReportPosition } from "./report-position";
import Node from "../../../components/nodes/Node.vue";
import ModelFeedback from "../../../components/feedback/ModelFeedback.vue";
import ActionGroup from "../../../components/nodes/ActionGroup.vue";
import CollectionList from "./CollectionList.vue";
import TemplatePrint from "../TemplatePrint.vue";

const props = defineProps<{
  collection: ListCollection;
  targetHref: (target: CollectionTarget) => string | undefined;
}>();
const emit = defineEmits<{
  open: [request: RecordRequest];
  visit: [target: CollectionTarget];
}>();
const actions = computed(() =>
  Object.keys(operations(props.collection)).filter(
    (name) => name !== "query" && available(props.collection, name),
  ),
);
const pending = computed(() => isPending(props.collection));
function openDetail(
  record: ObjectNode,
  mode: "read" | "edit",
  focus?: () => HTMLElement | null,
  print = false,
) {
  emit("open", { collection: props.collection, record, mode, focus, print });
}
async function action(name: string) {
  const node = props.collection;
  if (name !== "create") {
    await runOperation(node, name);
    return;
  }
  const focus = document.activeElement;
  if ((await runOperation(node, name)) && node.draft)
    openDetail(node.draft, "edit", () =>
      focus instanceof HTMLElement ? focus : null,
    );
}
const queryAvailable = computed(
  () =>
    !!(props.collection.load || props.collection.operations.query) &&
    nodeReadable(props.collection) &&
    !props.collection.operations.query?.disabled,
);
const canQuery = computed(() => queryAvailable.value && !pending.value);
const canPage = computed(() => !!props.collection.load && !pending.value);
const queryView = computed(() => getQueryView(props.collection));
const reading = computed(() => queryView.value?.state === "loading");
const queryFailure = computed(() =>
  queryView.value?.state === "failure" ? queryView.value : undefined,
);
const queryError = computed(() => {
  const failure = queryFailure.value;
  if (!failure) return;
  if (failure.notice !== undefined) return `查询失败：${failure.notice}`;
  return failure.blocking ? "查询失败。" : "查询失败，请重试。";
});
const retryAvailable = computed(() => {
  const failure = queryFailure.value;
  return (
    !!failure?.canRetry() &&
    (failure.explicit ? queryAvailable.value : !!props.collection.load)
  );
});
function retryQuery() {
  const failure = queryFailure.value;
  if (failure && retryAvailable.value && !pending.value)
    void readPage(failure.retryPage, failure.explicit);
}
async function query() {
  if (!canQuery.value) return;
  await readPage(1, true);
}
async function readPage(page: number, explicit = false) {
  const collection = props.collection;
  const model = currentModel.value;
  const scope = sessionScope.value;
  const state = sessionState.value;
  const work = model?.work;
  if (
    (await loadPage(collection, page, explicit)) &&
    collection.report &&
    currentModel.value === model &&
    model?.work === work &&
    sessionScope.value === scope &&
    sessionState.value === state
  )
    saveReportPosition(collection, { left: 0, top: 0 });
}
const initialScope = sessionScope.value;
const initialNode = props.collection;
let scrollFrame: number | undefined;
onMounted(() => {
  const saved = props.collection.report && reportPosition(props.collection);
  if (saved)
    scrollFrame = requestAnimationFrame(() =>
      window.scrollTo(saved.left, saved.top),
    );
});
onBeforeUnmount(() => {
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  if (
    initialNode.report &&
    initialScope === sessionScope.value &&
    nodeReadable(initialNode) &&
    routedCollection.value === initialNode
  )
    saveReportPosition(initialNode, {
      left: window.scrollX,
      top: window.scrollY,
    });
});
</script>
<template>
  <section v-if="nodeReadable(collection)" :aria-label="collection.label">
    <Node
      :node="collection.conditions"
      :target-href="targetHref"
      filter
      @visit="emit('visit', $event)"
    />
    <div class="zerp-business-actions">
      <div class="zerp-business-query">
        <VBtn
          v-if="queryAvailable"
          color="primary"
          variant="tonal"
          :loading="reading"
          :disabled="!canQuery"
          @click="query()"
          >查询</VBtn
        >
        <div
          class="zerp-business-query__status"
          :tabindex="queryFailure ? 0 : undefined"
        >
          <span v-if="reading" role="status">正在读取…</span>
          <div v-else-if="queryFailure" role="alert">
            {{ queryError }}
            <span v-if="collection.items.some(nodeReadable)">
              已有结果未更新。
            </span>
          </div>
          <ModelFeedback :target="collection" exact />
        </div>
        <VBtn
          v-if="retryAvailable"
          variant="text"
          :disabled="pending"
          @click="retryQuery"
          >重试</VBtn
        >
      </div>
      <TemplatePrint :collection="collection" />
      <ActionGroup
        v-if="actions.length"
        :actions="actions"
        :pending="pending"
        :aria-label="`${collection.label ?? ''}操作`"
        @action="action"
      />
      <VBtn
        v-if="
          collection.draft &&
          collection.draft !== collection.selected &&
          nodeReadable(collection.draft)
        "
        @click="openDetail(collection.draft, 'edit')"
        >继续编辑</VBtn
      >
    </div>
    <CollectionList
      :node="collection"
      :query-view="queryView"
      :can-query="canPage"
      @page="readPage($event)"
      @open="openDetail"
      @visit="emit('visit', $event)"
      @print="openDetail($event, 'read', undefined, true)"
    />
  </section>
</template>
<style scoped>
.zerp-business-query {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 13rem;
  min-inline-size: 0;
}
@media (max-width: 599px) {
  .zerp-business-query {
    flex-basis: 50%;
  }
}
.zerp-business-query__status {
  flex: 1;
  min-inline-size: 0;
  block-size: var(--zerp-control-size, 2rem);
  align-content: safe center;
  overflow: auto;
  overflow-wrap: anywhere;
}
section {
  min-width: 0;
  container-type: inline-size;
}
</style>
