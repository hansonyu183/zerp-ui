<script setup lang="ts">
import {
  collectionHref,
  goToCollection,
  routedCollection,
} from "./work-router";
import { readable as nodeReadable } from "./business-nodes";
import { computed, toRaw, useId } from "vue";
import { VTabs, VTab } from "vuetify/components";
import type { ListCollection, DomainGroup } from "./business-model";
import { plainClick, renderedHref } from "./model-target";
import BusinessNode from "./BusinessNode.vue";
const props = defineProps<{ node: DomainGroup }>();
const id = useId();
const ids = new WeakMap<object, number>();
let nextId = 0;
function key(collection: ListCollection) {
  const raw = toRaw(collection);
  if (!ids.has(raw)) ids.set(raw, ++nextId);
  return ids.get(raw)!;
}
const entries = computed(() =>
  props.node.members.filter((collection) => nodeReadable(collection)),
);
const current = computed(() => {
  const selected = routedCollection.value;
  return selected && entries.value.includes(selected) ? selected : null;
});
function visit(event: MouseEvent | KeyboardEvent, collection: ListCollection) {
  if (!entries.value.includes(collection)) {
    event.preventDefault();
    return;
  }
  if (renderedHref(event) !== collectionHref(collection)) {
    event.preventDefault();
    return;
  }
  if (!plainClick(event)) return;
  event.preventDefault();
  if (collection !== current.value) goToCollection(collection);
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
        :href="collectionHref(collection)"
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
      <BusinessNode :key="key(current)" :node="current" />
    </div>
  </section>
</template>
