<script setup lang="ts">
import { computed, inject, ref, watch, toRaw } from "vue";
import { VBtn } from "vuetify/components";
import { nodeMetadata as meta } from "./model-node";
import {
  directRuntimeKey,
  members,
  labels,
  type Node,
  type ObjectNode,
  type CollectionNode,
} from "./direct-model-runtime";
const props = withDefaults(
  defineProps<{
    node: Node;
    focus?: Node;
    publicAuth?: boolean;
    autoRead?: boolean;
  }>(),
  { autoRead: true },
);
import BusinessField from "./BusinessField.vue";
import BusinessCollection from "./BusinessCollection.vue";
const runtime = inject(directRuntimeKey)!;
const info = computed(() => props.node[meta]);
const object = computed(() => props.node as ObjectNode);
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
      !(info.value.kind === "output" && key === "print") &&
      runtime.allowed(props.node, key, props.publicAuth),
  ),
);
const detail = computed(() =>
  props.focus && runtime.ancestors(props.focus).at(-1) === props.node
    ? props.focus
    : (collection.value.draft ?? collection.value.selected),
);
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
        <div role="tablist" :aria-label="info.name">
          <VBtn
            v-for="[key, child] in visible"
            :key="key"
            role="tab"
            :data-member="key"
            :aria-selected="active === key"
            @click="active = key"
            >{{ child[meta].name }}</VBtn
          >
        </div>
        <template v-for="[key, child] in visible" :key="key"
          ><BusinessNode
            v-if="active === key"
            :node="child"
            :focus="focus"
            :public-auth="publicAuth"
        /></template>
      </template>
      <template v-else
        ><BusinessNode
          v-for="[key, child] in visible"
          :key="key"
          :node="child"
          :focus="focus"
          :public-auth="publicAuth"
          :auto-read="false"
      /></template>
    </template>
    <template v-else-if="info.kind === 'collection'">
      <BusinessNode :node="collection.query" :auto-read="false" />
      <VBtn
        v-if="runtime.allowed(node, 'query')"
        :disabled="pending || !!runtime.operations(node).query?.disabledReason"
        @click="query()"
        >查询</VBtn
      >
      <BusinessCollection
        :node="collection"
        :loading="pending"
        :can-query="canQuery"
        @page="query"
      />
      <BusinessNode v-if="detail" :node="detail" />
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
        /><BusinessNode :node="row" :auto-read="false" /></div
    ></template>
    <BusinessField
      v-else-if="'value' in node"
      :node="field"
      :read-only="!publicAuth && !runtime.writable(node)"
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
