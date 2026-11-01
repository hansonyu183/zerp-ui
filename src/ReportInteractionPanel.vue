<script setup lang="ts" generic="T">
import { ref, shallowRef, watch } from "vue";
import BusinessInteractions from "./BusinessInteractions.vue";
import { clone } from "./clone";
import { equalValues } from "./editor-values";
import type { Interaction, InteractionAnswers } from "./collaboration";
const props = defineProps<{
  items: readonly Interaction<T>[];
  answers: InteractionAnswers;
  disabled: boolean;
}>();
const emit = defineEmits<{
  answer: [id: string, value: string | boolean];
  intent: [target: T];
}>();
const snapshot = shallowRef(clone(props.items)),
  version = ref(0);
watch(
  () => clone(props.items),
  (value) => {
    if (!equalValues(snapshot.value, value)) {
      snapshot.value = value;
      version.value++;
    }
  },
  { deep: true, flush: "sync" },
);
</script>
<template>
  <BusinessInteractions
    :key="version"
    :items="snapshot"
    :answers="answers"
    :disabled="disabled"
    @answer="(id, value) => emit('answer', id, value)"
    @intent="(target) => emit('intent', target)"
  />
</template>
