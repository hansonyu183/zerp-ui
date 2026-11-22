<script setup lang="ts">
import { computed, inject, watch } from "vue";
import { VBtn } from "vuetify/components";
import {
  directRuntimeKey,
  isCollection,
  type Node,
} from "./direct-model-runtime";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";

const props = defineProps<{
  target?: Node;
  exact?: boolean;
  fixed?: boolean;
  blocked?: boolean;
}>();
const runtime = inject(directRuntimeKey)!;
const presentation = computed(() =>
  runtime.feedback.presentation(props.target),
);

watch(
  () => props.target,
  (target, _previous, onCleanup) => {
    if (target) onCleanup(runtime.feedback.presentWith(target, !!props.exact));
  },
  { immediate: true },
);
function locate(target: Node) {
  const collection = isCollection(target)
    ? target
    : runtime.ancestors(target).find(isCollection);
  if (!collection || !runtime.readable(target)) return;
  if (!isCollection(target)) {
    const record = [...runtime.ancestors(target), target].find(
      (node) =>
        !isCollection(node) &&
        node.kind === "object" &&
        runtime.ancestors(node).at(-1) === collection,
    );
    if (record && !isCollection(record) && record.kind === "object")
      collection.selected = record;
  }
  runtime.model().navigation.visit(collection);
}
function persistent(target: Node | null) {
  return (
    !!target &&
    !!props.target &&
    (!!props.blocked ||
      Object.entries(runtime.operations(target)).some(
        ([action, operation]) =>
          operation.disabled && runtime.allowed(target, action),
      ) ||
      runtime.available(target, "reconcile"))
  );
}
</script>
<template>
  <component
    :is="target ? 'div' : FeedbackRegion"
    :tabindex="
      target && (presentation.failure || presentation.messages.length)
        ? 0
        : undefined
    "
    :class="{
      'zerp-business-feedback': target,
      'zerp-business-feedback--fixed': fixed,
      'zerp-business-page-feedback': !target,
    }"
  >
    <Feedback
      v-if="presentation.failure"
      :key="presentation.failure.key"
      :message="presentation.failure.text"
      kind="error"
    />
    <Feedback
      v-for="message in presentation.messages"
      :key="message.id"
      :message="message.text"
      :kind="
        message.level === 'error' || message.level === 'warning'
          ? message.level
          : 'status'
      "
      :persistent="
        ['error', 'warning'].includes(message.level) &&
        persistent(message.target)
      "
    >
      <VBtn
        v-if="!target && message.target"
        variant="text"
        color="primary"
        @click="locate(message.target)"
        >查看</VBtn
      >
    </Feedback>
  </component>
</template>
<style scoped>
.zerp-business-feedback {
  min-block-size: 0;
  flex: 0 0 auto;
  max-block-size: min(25dvh, 7rem);
  overflow: auto;
  overscroll-behavior: contain;
}
.zerp-business-feedback--fixed {
  block-size: var(--zerp-control-size, 2rem);
}
.zerp-business-feedback:not(.zerp-business-feedback--fixed):not(
    :has(.zerp-feedback)
  ) {
  display: none;
}
/* Keep the dialog surface clear of notices from the page behind it. */
:global(
  .zerp-shell:has(.zerp-record-dialog-overlay--detail.v-overlay--active)
    .zerp-feedback-stack:has(> .zerp-business-page-feedback)
) {
  z-index: 1;
}
</style>
