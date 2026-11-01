<script setup lang="ts" generic="T extends object, I = never">
import { VCard, VCardTitle, VCardText } from "vuetify/components";
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
    <VCard
      v-for="group in groups"
      :key="group.key"
      :aria-label="group.label"
      role="region"
      variant="outlined"
      class="zerp-detail-group"
    >
      <VCardTitle tag="h3" class="text-h6 text-wrap">{{
        group.label
      }}</VCardTitle>
      <VCardText>
        <FactFields
          :value="value"
          :fields="fields(group)"
          @related="emit('related', $event as I)"
        />
      </VCardText>
    </VCard>
  </section>
</template>
