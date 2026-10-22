<script setup lang="ts" generic="T extends object, I = never">
import { ref, watch } from "vue";
import FactFields from "./FactFields.vue";
import type { DetailGroup, FactField } from "./details";
const props = defineProps<{
  value: T;
  groups: readonly DetailGroup<T, I>[];
  scope: string;
  instance: string | number;
}>();
const emit = defineEmits<{ related: [intent: I] }>();
const generation = ref(0);
watch(
  () => [props.scope, props.instance, props.value],
  () => {
    generation.value++;
  },
  { flush: "sync" },
);
function fields(group: DetailGroup<T, I>) {
  return group.fields as unknown as readonly FactField[];
}
</script>
<template>
  <section :key="generation" aria-label="资料详情">
    <section v-for="group in groups" :key="group.key" :aria-label="group.label">
      <h3>{{ group.label }}</h3>
      <FactFields
        :value="value"
        :fields="fields(group)"
        @related="emit('related', $event as I)"
      />
    </section>
  </section>
</template>
