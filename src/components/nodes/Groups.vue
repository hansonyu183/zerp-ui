<script setup lang="ts">
import { ref, watch, useId } from "vue";
import { VTabs, VTab } from "vuetify/components";
import { independent as independentNode } from "../../app/nodes";
import type {
  Node as NodeValue,
  CollectionTarget,
  ObjectNode,
} from "../../model/business-model";
import Node from "./Node.vue";
const props = defineProps<{
  entries: NodeValue[];
  targetHref?: (target: CollectionTarget) => string | undefined;
  name: string;
  readOnly?: boolean;
  filter?: boolean;
  save?: (node: ObjectNode) => Promise<void>;
}>();
const emit = defineEmits<{ visit: [target: CollectionTarget] }>();
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
  () => props.entries,
  (entries) => {
    if (!entries.some((child) => child.key === active.value))
      active.value = entries[0]?.key ?? "";
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
      v-for="(child, index) in entries"
      :key="child.key"
      :value="child.key"
      :id="`${tabId}-tab-${index}`"
      :aria-controls="`${tabId}-panel-${index}`"
      :data-member="child.key"
      @focus="active = child.key"
      >{{ child.label }}</VTab
    >
  </VTabs>
  <template v-for="(child, index) in entries" :key="child.key">
    <div
      v-if="visited.has(child.key)"
      v-show="active === child.key"
      :id="`${tabId}-panel-${index}`"
      :role="entries.length > 1 ? 'tabpanel' : undefined"
      :aria-labelledby="
        entries.length > 1 ? `${tabId}-tab-${index}` : undefined
      "
      :class="{ 'zerp-form-panel': entries.length > 1 }"
    >
      <Node
        :target-href="targetHref"
        @visit="emit('visit', $event)"
        :node="child"
        :read-only="independentNode(child) ? false : readOnly"
        :filter="filter"
        :save="save"
      />
    </div>
  </template>
</template>
