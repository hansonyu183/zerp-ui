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

const props = defineProps<{ target?: Node }>();
const runtime = inject(directRuntimeKey)!;
const presentation = computed(() =>
  runtime.feedback.presentation(props.target),
);

watch(
  () => props.target,
  (target, _previous, onCleanup) => {
    if (target) onCleanup(runtime.feedback.presentWith(target));
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
    (Object.entries(runtime.operations(props.target)).some(
      ([action, operation]) =>
        operation.disabled && runtime.allowed(props.target!, action),
    ) ||
      (runtime.allowed(props.target, "reconcile") &&
        !runtime.operations(props.target).reconcile?.disabled))
  );
}
</script>
<template>
  <component
    :is="target ? 'div' : FeedbackRegion"
    :class="target ? 'zerp-business-feedback' : 'zerp-business-page-feedback'"
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
.zerp-business-feedback:not(:has(.zerp-feedback)) {
  display: none;
}
/* Keep the dialog surface clear of notices from the page behind it. */
:global(
  .zerp-shell:has(.zerp-record-dialog-overlay--detail.v-overlay--active)
    .zerp-feedback-stack:has(> .zerp-business-page-feedback)
) {
  z-index: 1;
}
:global(.zerp-record-dialog-overlay--detail.v-dialog) {
  align-items: flex-start;
}
</style>
