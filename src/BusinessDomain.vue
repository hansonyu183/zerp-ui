<script setup lang="ts">
import { computed, inject, ref, toRaw, useId, watch } from "vue";
import { VTabs, VTab } from "vuetify/components";
import type { Collection, DomainGroup } from "./business-model";
import { directRuntimeKey } from "./direct-model-runtime";
import { plainClick, renderedHref } from "./model-target";
import BusinessNode from "./BusinessNode.vue";
const props = defineProps<{ node: DomainGroup }>();
const runtime = inject(directRuntimeKey)!;
const id = useId();
const ids = new WeakMap<object, number>();
let nextId = 0;
function key(collection: Collection) {
  const raw = toRaw(collection);
  if (!ids.has(raw)) ids.set(raw, ++nextId);
  return ids.get(raw)!;
}
const entries = computed(() =>
  props.node.members.filter((collection) => runtime.readable(collection)),
);
const current = computed(() => {
  const selected = runtime.model().navigation.current;
  return selected && entries.value.includes(selected) ? selected : null;
});
const visited = new WeakSet<object>();
const autoRead = ref(true);
watch(
  current,
  (collection) => {
    if (!collection) return;
    const raw = toRaw(collection);
    autoRead.value = !visited.has(raw);
    visited.add(raw);
  },
  { immediate: true, flush: "sync" },
);
function visit(event: MouseEvent | KeyboardEvent, collection: Collection) {
  if (!entries.value.includes(collection)) {
    event.preventDefault();
    return;
  }
  if (renderedHref(event) !== runtime.model().navigation.href(collection)) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  if (collection !== current.value)
    runtime.model().navigation.visit(collection);
}
</script>
<template>
  <section v-if="entries.length" :aria-label="node.label" class="zerp-domain">
    <VTabs
      v-if="entries.length > 1"
      :model-value="current ? key(current) : undefined"
      :aria-label="node.label"
      color="primary"
      show-arrows
    >
      <VTab
        v-for="collection in entries"
        :key="key(collection)"
        :value="key(collection)"
        :id="`${id}-tab-${key(collection)}`"
        :aria-controls="`${id}-panel`"
        :href="runtime.model().navigation.href(collection)"
        @click="visit($event, collection)"
        @keydown.space="visit($event, collection)"
      >
        {{ collection.label }}
      </VTab>
    </VTabs>
    <div
      v-if="current"
      :id="`${id}-panel`"
      :role="entries.length > 1 ? 'tabpanel' : undefined"
      :aria-labelledby="
        entries.length > 1 ? `${id}-tab-${key(current)}` : undefined
      "
      :class="{ 'zerp-form-panel': entries.length > 1 }"
    >
      <h2 v-if="current.label !== node.label">{{ current.label }}</h2>
      <BusinessNode :key="key(current)" :node="current" :auto-read="autoRead" />
    </div>
  </section>
</template>
