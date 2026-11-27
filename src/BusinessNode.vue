<script setup lang="ts">
import { reportPosition, saveReportPosition } from "./report-position";
import {
  isPending,
  loadPage,
  queryView as getQueryView,
  runOperation,
  type QueryView,
} from "./business-operations";
import { sessionScope } from "./business-session";
import { routedCollection } from "./work-router";
import { openRecord } from "./record-windows";
import { computed, onMounted, onBeforeUnmount } from "vue";
import { VBtn } from "vuetify/components";
import {
  members,
  isCollection,
  type Node,
  type CollectionNode,
  type ObjectNode,
  available as nodeAvailable,
  operations as nodeOperations,
  readable as nodeReadable,
  writable as nodeWritable,
} from "./business-nodes";
import type {
  BusinessNode as BusinessValue,
  RecordsNode,
  FieldNode,
} from "./business-model";
import BusinessField from "./BusinessField.vue";
import BusinessFeedback from "./BusinessFeedback.vue";
import BusinessActionGroup from "./BusinessActionGroup.vue";
import BusinessCollection from "./BusinessCollection.vue";
import BusinessRecords from "./BusinessRecords.vue";
import BusinessGroups from "./BusinessGroups.vue";
import TemplatePrint from "./TemplatePrint.vue";
import BusinessFamilyContent from "./BusinessFamilyContent.vue";
const props = defineProps<{
  node: Node;
  focus?: Node;
  publicAuth?: boolean;
  readOnly?: boolean;
  filter?: boolean;
  editing?: boolean;
  profile?: boolean;
  save?: (node: ObjectNode) => Promise<void>;
}>();
const collection = computed(() => props.node as CollectionNode);
const records = computed(() => props.node as RecordsNode);
const field = computed(() => props.node as FieldNode);
const visible = computed(() =>
  members(props.node).filter(([, node]) =>
    props.publicAuth ? node.readable !== false : nodeReadable(node),
  ),
);
const runs = computed(() => {
  const result: {
    key: string;
    grouped: boolean;
    entries: [string, BusinessValue][];
  }[] = [];
  for (const entry of visible.value) {
    const grouped = entry[1].kind === "object" || entry[1].kind === "records";
    const previous = result.at(-1);
    if (previous?.grouped === grouped) previous.entries.push(entry);
    else
      result.push({
        key: `${grouped ? "groups" : "fields"}-${entry[0]}`,
        grouped,
        entries: [entry],
      });
  }
  return result;
});
const actions = computed(() =>
  Object.keys(nodeOperations(props.node)).filter(
    (key) =>
      key !== "query" &&
      !(
        key === "print" &&
        !isCollection(props.node) &&
        props.node.kind === "output"
      ) &&
      !(
        key === "load" &&
        !isCollection(props.node) &&
        ["reference", "treeReference"].includes(props.node.kind)
      ) &&
      (!props.readOnly ||
        (!isCollection(props.node) && props.node.kind === "output") ||
        [
          "get",
          "reconcile",
          "load",
          "preview",
          "print",
          "export",
          "audit",
          "openVoucher",
        ].includes(key)) &&
      nodeAvailable(props.node, key, props.publicAuth),
  ),
);
const saveUnavailable = computed(() => {
  const node = props.node;
  return (
    !isCollection(node) &&
    node.kind === "object" &&
    (props.editing || (props.profile && nodeWritable(node))) &&
    !actions.value.includes("update")
  );
});
const pending = computed(() => isPending(props.node));
function openDetail(
  record: ObjectNode,
  mode: "read" | "edit",
  focus?: () => HTMLElement | null,
  print = false,
) {
  if (routedCollection.value && routedCollection.value !== collection.value)
    return;
  openRecord({ collection: collection.value, record, mode, focus, print });
}
async function action(name: string) {
  const node = props.node;
  if (
    name === "update" &&
    props.save &&
    !isCollection(node) &&
    node.kind === "object"
  ) {
    await props.save(node);
    return;
  }
  if (name === "create" && isCollection(node)) {
    const focus = document.activeElement;
    if ((await runOperation(node, name, props.publicAuth)) && node.draft)
      openDetail(node.draft, "edit", () =>
        focus instanceof HTMLElement ? focus : null,
      );
    return;
  }
  await runOperation(node, name, props.publicAuth);
}
const queryAvailable = computed(
  () =>
    !!(collection.value.load || collection.value.operations.query) &&
    nodeReadable(props.node) &&
    !collection.value.operations.query?.disabled,
);
const canQuery = computed(() => queryAvailable.value && !pending.value);
const canPage = computed(() => !!collection.value.load && !pending.value);
const queryView = computed(() =>
  isCollection(props.node) ? getQueryView(props.node) : undefined,
);
const reading = computed(() => queryView.value?.state === "loading");
const queryFailure = computed(() =>
  queryView.value?.state === "failure" ? queryView.value : undefined,
);
const retryAvailable = computed(() => {
  const failure = queryFailure.value;
  return (
    !!failure?.canRetry() &&
    (failure.explicit ? queryAvailable.value : !!collection.value.load)
  );
});
function retryQuery() {
  const failure = queryFailure.value;
  if (failure && retryAvailable.value && !pending.value)
    void loadPage(collection.value, failure.retryPage, failure.explicit);
}
async function query() {
  if (!canQuery.value) return;
  await loadPage(collection.value, 1, true);
}
const initialScope = sessionScope.value;
const initialNode = props.node;
let scrollFrame: number | undefined;
onMounted(() => {
  const saved =
    isCollection(props.node) && props.node.report && reportPosition(props.node);
  if (saved)
    scrollFrame = requestAnimationFrame(() =>
      window.scrollTo(saved.left, saved.top),
    );
});
onBeforeUnmount(() => {
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  if (
    isCollection(initialNode) &&
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
  <section
    v-if="publicAuth || nodeReadable(node)"
    :aria-label="node.label ?? undefined"
  >
    <template v-if="!isCollection(node) && node.kind === 'object'">
      <template v-for="run in runs" :key="run.key">
        <BusinessGroups
          v-if="run.grouped"
          :entries="run.entries"
          :name="node.label ?? ''"
          :focus="focus"
          :public-auth="publicAuth"
          :read-only="readOnly"
          :filter="filter"
          :save="save"
        />
        <div
          v-else
          class="zerp-direct-form"
          :class="{
            'zerp-direct-form--short': run.entries.length <= 3,
            'zerp-direct-form--filter': filter,
          }"
        >
          <BusinessNode
            v-for="[key, child] in run.entries"
            :key="key"
            :node="child"
            :focus="focus"
            :public-auth="publicAuth"
            :read-only="readOnly"
            :class="{
              'zerp-direct-form-wide':
                child.kind === 'longText' || child.kind === 'records',
            }"
          />
        </div>
      </template>
    </template>
    <template v-else-if="isCollection(node)">
      <BusinessNode :node="collection.conditions" filter />
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
              {{ queryFailure.error }}
              <span v-if="collection.items.some(nodeReadable)">
                已有结果未更新。
              </span>
            </div>
            <BusinessFeedback :target="collection" exact />
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
        <BusinessActionGroup
          v-if="actions.length"
          :actions="actions"
          :pending="pending"
          :aria-label="`${node.label ?? ''}操作`"
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
      <BusinessCollection
        :node="collection"
        :query-view="queryView"
        :can-query="canPage"
        @page="loadPage(collection, $event)"
        @open="openDetail"
        @print="openDetail($event, 'read', undefined, true)"
      />
    </template>
    <BusinessRecords
      v-else-if="node.kind === 'records'"
      :node="records"
      :read-only="readOnly"
    />
    <BusinessFamilyContent
      v-else-if="node.kind === 'output' || node.kind === 'interactions'"
      :node="node"
      :read-only="readOnly"
    />
    <BusinessField
      v-else
      :node="field"
      :public-auth="publicAuth"
      :read-only="readOnly || (!publicAuth && !nodeWritable(node))"
      :scope="sessionScope"
    />
    <BusinessActionGroup
      v-if="!isCollection(node) && (actions.length || saveUnavailable)"
      class="zerp-business-actions"
      :actions="actions"
      :pending="pending"
      :aria-label="`${node.label ?? ''}操作`"
      @action="action"
    >
      <p v-if="saveUnavailable" role="status">当前无法保存。</p>
    </BusinessActionGroup>
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
.zerp-direct-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.zerp-direct-form > * {
  min-width: 0;
}
.zerp-direct-form-wide {
  grid-column: 1/-1;
}
@container (min-width:520px) {
  .zerp-direct-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (min-width:800px) {
  .zerp-direct-form {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@container (min-width:1060px) {
  .zerp-direct-form--filter {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.zerp-direct-form--short {
  grid-template-columns: 1fr;
}
</style>
