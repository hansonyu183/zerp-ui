<script setup lang="ts">
import { ref, watch, useId } from "vue";
import { VTabs, VTab } from "vuetify/components";
import {
  type Node,
  type ObjectNode,
  ancestors as nodeAncestors,
  independent as independentNode,
} from "./business-nodes";
import BusinessNode from "./BusinessNode.vue";
const props = defineProps<{
  entries: [string, Node][];
  name: string;
  focus?: Node;
  publicAuth?: boolean;
  readOnly?: boolean;
  filter?: boolean;
  save?: (node: ObjectNode) => Promise<void>;
}>();
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
watch(
  [() => props.entries, () => props.focus],
  () => {
    const focused = props.entries.find(
      ([, n]) =>
        props.focus &&
        (n === props.focus || nodeAncestors(props.focus).includes(n)),
    );
    if (focused) {
      active.value = focused[0];
      return;
    }
    if (!props.entries.some(([key]) => key === active.value))
      active.value = props.entries[0]?.[0] ?? "";
  },
  { immediate: true },
);
</script>
<template>
  <VTabs
    v-if="entries.length > 1"
    v-model="active"
    show-arrows
    :aria-label="name"
  >
    <VTab
      v-for="([key, child], index) in entries"
      :key="key"
      :value="key"
      :id="`${tabId}-tab-${index}`"
      :aria-controls="`${tabId}-panel-${index}`"
      :data-member="key"
      @focus="active = key"
      >{{ child.label }}</VTab
    >
  </VTabs>
  <template v-for="([key, child], index) in entries" :key="key">
    <div
      v-if="visited.has(key)"
      v-show="active === key"
      :id="`${tabId}-panel-${index}`"
      :role="entries.length > 1 ? 'tabpanel' : undefined"
      :aria-labelledby="
        entries.length > 1 ? `${tabId}-tab-${index}` : undefined
      "
      :class="{ 'zerp-form-panel': entries.length > 1 }"
    >
      <BusinessNode
        :node="child"
        :focus="focus"
        :public-auth="publicAuth"
        :read-only="independentNode(child) ? false : readOnly"
        :filter="filter"
        :save="save"
      />
    </div>
  </template>
</template>
