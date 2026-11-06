<script setup lang="ts">
import { computed, ref, watch, useId } from "vue";
import { VTabs, VTab, VTabsWindow, VTabsWindowItem } from "vuetify/components";
import FactFields from "./FactFields.vue";
import type { FactGroup } from "./details";
const props = defineProps<{
  value: object;
  groups: readonly FactGroup[];
  scope: string;
  instance?: string | number;
}>();
const emit = defineEmits<{ related: [intent: unknown] }>();
const groups = computed(() =>
  props.groups.filter((group) => group.fields.length),
);
const selected = ref<string>();
const id = useId();
const generation = ref(0);
watch(
  () => [props.scope, props.instance],
  () => {
    selected.value = groups.value[0]?.key;
    generation.value++;
  },
  { immediate: true, flush: "sync" },
);
watch(groups, (next) => {
  if (!next.some((group) => group.key === selected.value))
    selected.value = next[0]?.key;
});
</script>
<template>
  <section :key="generation" class="zerp-grouped-facts">
    <template v-if="groups.length > 1">
      <VTabs v-model="selected" aria-label="资料分组" show-arrows>
        <VTab
          v-for="(group, index) in groups"
          :key="group.key"
          :value="group.key"
          :id="`${id}-tab-${index}`"
          :aria-controls="`${id}-panel-${index}`"
          >{{ group.label }}</VTab
        >
      </VTabs>
      <VTabsWindow v-model="selected">
        <VTabsWindowItem
          v-for="(group, index) in groups"
          :key="group.key"
          :value="group.key"
          :id="`${id}-panel-${index}`"
          role="tabpanel"
          :aria-labelledby="`${id}-tab-${index}`"
          tabindex="0"
        >
          <FactFields
            :value="value"
            :fields="group.fields"
            @related="emit('related', $event)"
          />
        </VTabsWindowItem>
      </VTabsWindow>
    </template>
    <section v-else-if="groups[0]" :aria-label="groups[0].label" role="region">
      <h3 class="text-subtitle-2">{{ groups[0].label }}</h3>
      <FactFields
        :value="value"
        :fields="groups[0].fields"
        @related="emit('related', $event)"
      />
    </section>
  </section>
</template>
