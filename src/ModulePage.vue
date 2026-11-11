<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { VTabs, VTab } from "vuetify/components";
import PageContentHost from "./PageContentHost.vue";
import { usePageRecovery } from "./page-recovery";
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
const selected = ref(
  props.entries.some((entry) => entry.key === props.selected)
    ? props.selected
    : props.entries[0]?.key,
);
const visited = ref(new Set([selected.value]));
const { required, probing } = usePageRecovery(
  () => props.entries,
  () => props.scope,
  () => props.active,
);
const states = ref<Record<string, EditProtection>>({});
watch(
  () => [props.scope, props.active],
  () => {
    states.value = {};
    visited.value = new Set([selected.value]);
  },
  { flush: "sync" },
);
watch(
  () => props.selected,
  (value) => {
    if (props.entries.some((entry) => entry.key === value)) {
      selected.value = value!;
      visited.value.add(value!);
    }
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
  combineProtection([
    ...Object.values(states.value),
    ...(probing.value
      ? [
          {
            dirty: false,
            localPending: false,
            invalid: false,
            writeState: "blocked" as const,
          },
        ]
      : []),
  ]),
);
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
function select(value: unknown) {
  const key = String(value);
  if (!props.entries.some((entry) => entry.key === key)) return;
  selected.value = key;
  visited.value.add(key);
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
    <VTab
      v-for="entry in entries"
      :key="entry.key"
      :value="entry.key"
      :aria-label="entry.label"
      >{{ entry.label
      }}<span
        v-if="states[entry.key] && states[entry.key]!.writeState !== 'idle'"
        >待处理</span
      ></VTab
    >
  </VTabs>
  <section
    v-for="entry in entries"
    :key="entry.key"
    v-show="entry.key === selected"
    :aria-label="entry.label"
  >
    <PageContentHost
      v-if="
        visited.has(entry.key) ||
        entry.key === selected ||
        required.has(entry.key)
      "
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
