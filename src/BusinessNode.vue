<script setup lang="ts">
import {
  computed,
  inject,
  ref,
  watch,
  toRaw,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { VBtn } from "vuetify/components";
import {
  directRuntimeKey,
  members,
  isCollection,
  type Node,
  type CollectionNode,
  type ObjectNode,
} from "./direct-model-runtime";
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
import RecordDialog from "./RecordDialog.vue";
import BusinessGroups from "./BusinessGroups.vue";
import TemplatePrint from "./TemplatePrint.vue";
import BusinessFamilyContent from "./BusinessFamilyContent.vue";
const props = withDefaults(
  defineProps<{
    node: Node;
    focus?: Node;
    publicAuth?: boolean;
    autoRead?: boolean;
    readOnly?: boolean;
    filter?: boolean;
    editing?: boolean;
  }>(),
  { autoRead: true },
);
const runtime = inject(directRuntimeKey)!;
const collection = computed(() => props.node as CollectionNode);
const records = computed(() => props.node as RecordsNode);
const field = computed(() => props.node as FieldNode);
const visible = computed(() =>
  members(props.node).filter(
    ([, node]) =>
      node.label !== null && (props.publicAuth || runtime.readable(node)),
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
  Object.keys(runtime.operations(props.node)).filter(
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
      runtime.available(props.node, key, props.publicAuth),
  ),
);
const saveUnavailable = computed(() => {
  const node = props.node;
  return (
    !isCollection(node) &&
    node.kind === "object" &&
    (props.editing ||
      (node === runtime.model().account.profile && runtime.writable(node))) &&
    !actions.value.includes("update")
  );
});
const pending = computed(() => runtime.busy.value.has(toRaw(props.node)));
const dialogReady = ref(false);
onMounted(
  () =>
    void nextTick(() => {
      dialogReady.value = true;
    }),
);
const printRequested = ref(false);
const restoreDetailFocus = ref<() => HTMLElement | null>();
function openDetail(
  mode: "read" | "edit",
  restoreFocus: () => HTMLElement | null,
) {
  detailMode.value = mode;
  printRequested.value = false;
  restoreDetailFocus.value = restoreFocus;
}
const dismissedDraft = ref<ObjectNode | null>(null),
  detailMode = ref<"read" | "edit">("edit");
const detail = computed(() =>
  collection.value.draft && collection.value.draft !== dismissedDraft.value
    ? collection.value.draft
    : collection.value.selected,
);
function closeDetail() {
  if (collection.value.draft === detail.value)
    dismissedDraft.value = detail.value;
  if (collection.value.selected === detail.value)
    collection.value.selected = null;
  detailMode.value = "edit";
  printRequested.value = false;
}
const queryAvailable = computed(() => runtime.available(props.node, "query"));
const canQuery = computed(() => queryAvailable.value && !pending.value);
const queryView = computed(() =>
  isCollection(props.node) ? runtime.queryView(props.node) : undefined,
);
const reading = computed(() => queryView.value?.state === "loading");
const queryFailure = computed(() =>
  queryView.value?.state === "failure" ? queryView.value : undefined,
);
function retryQuery() {
  const failure = queryFailure.value;
  if (failure?.canRetry()) void query(failure.retryPage);
}
async function query(page = 1) {
  if (!canQuery.value) return;
  collection.value.page = page;
  await runtime.run(props.node, "query");
}
watch(
  () => props.node,
  () => {
    if (
      props.autoRead &&
      !(
        isCollection(props.node) &&
        props.node.report &&
        runtime.reportViews.has(toRaw(props.node))
      )
    )
      void runtime.run(
        props.node,
        isCollection(props.node) ? "query" : "get",
        props.publicAuth,
      );
  },
  { immediate: true },
);
const initialScope = runtime.scope.value;
const initialNode = props.node;
let scrollFrame: number | undefined;
onMounted(() => {
  const saved =
    isCollection(props.node) &&
    props.node.report &&
    runtime.reportViews.get(toRaw(props.node));
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
    initialScope === runtime.scope.value &&
    runtime.readable(initialNode) &&
    runtime.model().navigation.current === initialNode
  )
    runtime.reportViews.set(toRaw(initialNode), {
      left: window.scrollX,
      top: window.scrollY,
    });
});
</script>
<template>
  <section
    v-if="publicAuth || runtime.readable(node)"
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
            :auto-read="false"
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
      <BusinessNode :node="collection.conditions" :auto-read="false" filter />
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
              <span v-if="collection.items.some(runtime.readable)">
                已有结果未更新。
              </span>
            </div>
            <BusinessFeedback :target="collection" exact />
          </div>
          <VBtn
            v-if="queryFailure?.canRetry() && queryAvailable"
            variant="text"
            :disabled="!canQuery"
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
          @action="runtime.run(node, $event, publicAuth)"
        />
        <VBtn
          v-if="
            collection.draft &&
            collection.draft === dismissedDraft &&
            runtime.readable(collection.draft)
          "
          @click="dismissedDraft = null"
          >继续编辑</VBtn
        >
      </div>
      <BusinessCollection
        :node="collection"
        :query-view="queryView"
        :can-query="canQuery"
        @page="query"
        @open="openDetail"
        @print="
          restoreDetailFocus = undefined;
          collection.selected = $event;
          detailMode = 'read';
          printRequested = true;
        "
      />
      <RecordDialog
        v-if="dialogReady && detail && runtime.readable(detail)"
        :title="collection.draft === detail ? '新增' : (detail.label ?? '')"
        header-close
        :return-focus="
          collection.draft === detail ? undefined : restoreDetailFocus
        "
        @close="closeDetail"
      >
        <BusinessNode
          :node="detail"
          :editing="
            collection.draft === detail ||
            (detailMode === 'edit' && runtime.writable(detail))
          "
          :read-only="
            collection.draft === detail
              ? false
              : detailMode === 'read' || !runtime.editable(detail)
          "
        />
        <TemplatePrint
          v-if="
            collection.draft !== detail &&
            (collection.items.includes(detail) ||
              collection.selected === detail) &&
            (detailMode === 'read' || !runtime.editable(detail))
          "
          :collection="collection"
          :record="detail"
          :auto-open="printRequested"
        />
        <template #feedback>
          <BusinessFeedback
            :target="detail"
            fixed
            :blocked="
              (collection.draft === detail ||
                (detailMode === 'edit' && runtime.editable(detail))) &&
              !runtime.available(detail, 'update')
            "
          />
        </template>
      </RecordDialog>
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
      :read-only="readOnly || (!publicAuth && !runtime.writable(node))"
      :scope="runtime.scope.value"
    />
    <BusinessActionGroup
      v-if="!isCollection(node) && (actions.length || saveUnavailable)"
      class="zerp-business-actions"
      :actions="actions"
      :pending="pending"
      :aria-label="`${node.label ?? ''}操作`"
      @action="runtime.run(node, $event, publicAuth)"
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
