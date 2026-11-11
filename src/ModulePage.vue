<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { VTabs, VTab } from "vuetify/components";
import PageContentHost from "./PageContentHost.vue";
import type { ModuleEntry } from "./business";
import { combineProtection, type EditProtection } from "./edit-guard";
const props = withDefaults(
  defineProps<{
    entries: readonly ModuleEntry[];
    scope: string;
    active?: boolean;
    discard?: number;
    selected?: string;
    embedded?: boolean;
  }>(),
  { active: true },
);
const emit = defineEmits<{
  protection: [value: EditProtection];
  select: [key: string];
}>();
const selected = ref(props.selected ?? props.entries[0]?.key);
const states = ref<Record<string, EditProtection>>({});
watch(
  () => [props.scope, props.active],
  () => {
    states.value = {};
  },
  { flush: "sync" },
);
watch(
  () => props.selected,
  (value) => {
    if (props.entries.some((entry) => entry.key === value))
      selected.value = value!;
  },
);
watch(
  () => props.entries.map((entry) => entry.key),
  (keys) => {
    if (!keys.includes(selected.value ?? "")) selected.value = keys[0];
    states.value = Object.fromEntries(
      Object.entries(states.value).filter(([key]) => keys.includes(key)),
    );
  },
);
const protection = computed(() =>
  combineProtection(Object.values(states.value)),
);
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
function select(value: unknown) {
  const key = String(value);
  if (!props.entries.some((entry) => entry.key === key)) return;
  selected.value = key;
  emit("select", key);
}
</script>
<template>
  <VTabs
    v-if="entries.length > 1"
    :model-value="selected"
    aria-label="模块分组"
    show-arrows
    @update:model-value="select"
  >
    <VTab v-for="entry in entries" :key="entry.key" :value="entry.key">{{
      entry.label
    }}</VTab>
  </VTabs>
  <section
    v-for="entry in entries"
    :key="entry.key"
    v-show="entry.key === selected"
    :aria-label="entry.label"
  >
    <PageContentHost
      :page="entry.page"
      :scope="scope"
      :active="active ?? true"
      :discard="discard"
      :heading="false"
      :embedded="embedded"
      @protection="states = { ...states, [entry.key]: $event }"
    />
  </section>
</template>
