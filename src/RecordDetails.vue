<script setup lang="ts" generic="T extends object, I = never">
import GroupedFacts from "./GroupedFacts.vue";
import type { DetailGroup, FactGroup } from "./details";
defineProps<{
  value: T;
  groups: readonly DetailGroup<T, I>[];
  scope: string;
  instance: string | number;
}>();
const emit = defineEmits<{ related: [intent: I] }>();
</script>
<template>
  <GroupedFacts
    aria-label="资料详情"
    :value="value"
    :groups="groups as unknown as readonly FactGroup[]"
    :scope="scope"
    :instance="instance"
    @related="emit('related', $event as I)"
  />
</template>
