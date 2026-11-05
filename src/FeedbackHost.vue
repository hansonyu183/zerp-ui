<script setup lang="ts">
import { onUnmounted, provide, shallowRef } from "vue";
import { feedbackTargetKey } from "./feedback-scope";
const emit = defineEmits<{ target: [element: HTMLElement | null] }>();
const target = shallowRef<HTMLElement | null>(null);
provide(feedbackTargetKey, target);
function mountTarget(element: unknown) {
  if (element instanceof HTMLElement) {
    target.value = element;
    emit("target", element);
  }
}
onUnmounted(() => emit("target", null));
</script>
<template>
  <slot />
  <div :ref="mountTarget" class="zerp-feedback-stack" aria-label="页面消息" />
</template>
