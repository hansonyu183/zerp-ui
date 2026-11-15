<script setup lang="ts">
import {
  computed,
  inject,
  ref,
  watch,
  toRaw,
  useId,
  onMounted,
  nextTick,
} from "vue";
import { VBtn, VTabs, VTab } from "vuetify/components";
import { nodeMetadata as meta } from "./model-node";
import {
  directRuntimeKey,
  members,
  labels,
  type Node,
  type CollectionNode,
} from "./direct-model-runtime";
const props = withDefaults(
  defineProps<{
    node: Node;
    focus?: Node;
    publicAuth?: boolean;
    autoRead?: boolean;
    readOnly?: boolean;
    filter?: boolean;
  }>(),
  { autoRead: true },
);
import BusinessField from "./BusinessField.vue";
import BusinessCollection from "./BusinessCollection.vue";
import RecordDialog from "./RecordDialog.vue";
const runtime = inject(directRuntimeKey)!;
const info = computed(() => props.node[meta]);

const field = computed(() => props.node as Extract<Node, { value: unknown }>);
const array = computed(
  () => props.node as Extract<Node, { [meta]: { kind: "array" } }>,
);
const collection = computed(() => props.node as CollectionNode);
const visible = computed(() => {
  const projected = members(props.node);
  const focused =
    props.focus &&
    [...runtime.ancestors(props.focus), props.focus].find(
      (n) => runtime.ancestors(n).at(-1) === props.node,
    );
  if (focused && !projected.some(([, n]) => n === focused)) {
    const entry = Object.entries(props.node).find(([, n]) => n === focused);
    if (entry) projected.push(entry as [string, Node]);
  }
  return projected.filter(([, n]) => props.publicAuth || runtime.readable(n));
});
const active = ref("");
const tabId = useId();
const visited = ref(new Set<string>());
watch(
  active,
  (key) => {
    if (key) visited.value.add(key);
  },
  { flush: "sync" },
);
const aggregate = computed(() =>
  visible.value.some(([, n]) =>
    ["object", "collection"].includes(n[meta].kind),
  ),
);
watch(
  [visible, () => props.focus],
  () => {
    const focused = visible.value.find(
      ([, n]) =>
        props.focus &&
        (n === props.focus || runtime.ancestors(props.focus).includes(n)),
    );
    if (focused) {
      active.value = focused[0];
      return;
    }
    if (!visible.value.some(([key]) => key === active.value))
      active.value = visible.value[0]?.[0] ?? "";
  },
  { immediate: true },
);
const actions = computed(() =>
  Object.entries(runtime.operations(props.node)).filter(
    ([key]) =>
      key !== "query" &&
      (!props.readOnly || key === "reconcile" || key === "get") &&
      !(info.value.kind === "output" && key === "print") &&
      runtime.allowed(props.node, key, props.publicAuth),
  ),
);
const dialogReady = ref(false);
onMounted(() => {
  void nextTick(() => {
    dialogReady.value = true;
  });
});
const dismissedDraft = ref<Node | null>(null);
const detailMode = ref<"read" | "edit">("edit");
const detail = computed(() =>
  props.focus && runtime.ancestors(props.focus).at(-1) === props.node
    ? props.focus
    : collection.value.draft && collection.value.draft !== dismissedDraft.value
      ? collection.value.draft
      : collection.value.selected,
);
function openDetail(mode: "read" | "edit") {
  detailMode.value = mode;
}
function closeDetail() {
  const target = detail.value;
  if (collection.value.draft === target) dismissedDraft.value = target;
  if (collection.value.selected === target) collection.value.selected = null;
  if (props.focus === target)
    runtime.model()[meta].navigation.visit(props.node as CollectionNode);
  detailMode.value = "edit";
}
const pending = computed(() => runtime.busy.value.has(toRaw(props.node)));
function run(action: string) {
  return runtime.run(props.node, action, props.publicAuth);
}
const canQuery = computed(
  () =>
    !!runtime.operations(props.node).query &&
    runtime.allowed(props.node, "query") &&
    !runtime.operations(props.node).query?.disabledReason &&
    !pending.value,
);
async function query(page = 1) {
  if (!canQuery.value) return;
  collection.value.page = page;
  await run("query");
}
watch(
  () => props.node,
  () => {
    if (props.autoRead !== false)
      void run(info.value.kind === "collection" ? "query" : "get");
  },
  { immediate: true },
);
</script>
<template>
  <section v-if="publicAuth || runtime.readable(node)" :aria-label="info.name">
    <template v-if="info.kind === 'object'">
      <template v-if="aggregate">
        <VTabs
          v-if="visible.length > 1"
          v-model="active"
          show-arrows
          :aria-label="info.name"
        >
          <VTab
            v-for="([key, child], index) in visible"
            :key="key"
            :value="key"
            :id="`${tabId}-tab-${index}`"
            :aria-controls="`${tabId}-panel-${index}`"
            :data-member="key"
            @focus="active = key"
            >{{ child[meta].name }}</VTab
          >
        </VTabs>
        <template v-for="([key, child], index) in visible" :key="key">
          <div
            v-if="visited.has(key)"
            v-show="active === key"
            :id="`${tabId}-panel-${index}`"
            :role="visible.length > 1 ? 'tabpanel' : undefined"
            :aria-labelledby="
              visible.length > 1 ? `${tabId}-tab-${index}` : undefined
            "
            :class="{ 'zerp-form-panel': visible.length > 1 }"
          >
            <BusinessNode
              :node="child"
              :focus="focus"
              :public-auth="publicAuth"
              :read-only="child[meta].kind === 'collection' ? false : readOnly"
              :filter="filter"
            />
          </div>
        </template>
      </template>
      <div
        v-else
        class="zerp-direct-form"
        :class="{
          'zerp-direct-form--short': visible.length <= 3,
          'zerp-direct-form--filter': filter,
        }"
      >
        <BusinessNode
          v-for="[key, child] in visible"
          :key="key"
          :node="child"
          :focus="focus"
          :public-auth="publicAuth"
          :auto-read="false"
          :read-only="readOnly"
          :class="{
            'zerp-direct-form-wide': [
              'longText',
              'array',
              'collection',
              'output',
              'interactions',
            ].includes(child[meta].kind),
          }"
        />
      </div>
    </template>
    <template v-else-if="info.kind === 'collection'">
      <BusinessNode :node="collection.query" :auto-read="false" filter />
      <VBtn
        v-if="runtime.allowed(node, 'query')"
        :disabled="pending || !!runtime.operations(node).query?.disabledReason"
        @click="query()"
        >查询</VBtn
      >
      <VBtn
        v-if="
          collection.draft &&
          collection.draft === dismissedDraft &&
          runtime.readable(collection.draft)
        "
        @click="dismissedDraft = null"
        >继续编辑</VBtn
      >
      <BusinessCollection
        :node="collection"
        :loading="pending"
        :can-query="canQuery"
        @page="query"
        @open="openDetail"
      />
      <RecordDialog
        v-if="dialogReady && detail && runtime.readable(detail)"
        :title="collection.draft === detail ? '新增' : detail[meta].name"
        @close="closeDetail"
      >
        <BusinessNode
          :node="detail"
          :focus="focus"
          :read-only="
            collection.draft === detail ? false : detailMode === 'read'
          "
        />
        <VBtn @click="closeDetail">关闭</VBtn>
      </RecordDialog>
    </template>
    <template v-else-if="info.kind === 'array' && 'items' in node"
      ><div
        v-for="(row, i) in array.items.filter((item) => runtime.readable(item))"
        :key="i"
      >
        <input
          v-if="array[meta].operations.remove"
          type="radio"
          :aria-label="`选择第 ${i + 1} 项`"
          :checked="array.selected === row"
          @change="array.selected = row"
        /><BusinessNode
          :node="row"
          :auto-read="false"
          :read-only="readOnly"
        /></div
    ></template>
    <BusinessField
      v-else-if="'value' in node"
      :node="field"
      :read-only="readOnly || (!publicAuth && !runtime.writable(node))"
      :scope="runtime.scope.value"
    />
    <div v-if="actions.length" role="group" :aria-label="`${info.name}操作`">
      <VBtn
        v-for="[action, operation] in actions"
        :key="action"
        :disabled="pending || !!operation.disabledReason"
        :title="operation.disabledReason"
        @click="run(action)"
        >{{ labels[action] ?? action }}</VBtn
      >
    </div>
  </section>
</template>

<style scoped>
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
  grid-column: 1 / -1;
}
@container (min-width: 520px) {
  .zerp-direct-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (min-width: 800px) {
  .zerp-direct-form {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@container (min-width: 1060px) {
  .zerp-direct-form--filter {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.zerp-direct-form--short {
  grid-template-columns: 1fr;
}
</style>
