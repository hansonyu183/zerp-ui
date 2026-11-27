<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import { computed, inject } from "vue";
import { feedbackTargetKey } from "./feedback-scope";
const props = defineProps<{ target?: HTMLElement | null }>();
const host = inject(feedbackTargetKey, undefined);
const destination = computed(() => props.target ?? host?.value);
</script>
<template>
  <Teleport :to="destination ?? 'body'" :disabled="!destination">
    <div v-bind="$attrs" class="zerp-feedback-region"><slot /></div>
  </Teleport>
</template>
