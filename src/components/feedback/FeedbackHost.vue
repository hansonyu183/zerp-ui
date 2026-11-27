<script setup lang="ts">
import { provide, shallowRef } from "vue";
import { feedbackTargetKey } from "./feedback-scope";
const target = shallowRef<HTMLElement | null>(null);
provide(feedbackTargetKey, target);
function mountTarget(element: unknown) {
  if (element instanceof HTMLElement) {
    target.value = element;
  }
}
</script>
<template>
  <slot />
  <div :ref="mountTarget" class="zerp-feedback-stack" aria-label="页面消息" />
</template>
