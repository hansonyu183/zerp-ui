<script setup lang="ts">
import FeedbackHost from "./FeedbackHost.vue";
import { nextTick, onBeforeUnmount } from "vue";
import { injectDefaults } from "vuetify/lib/composables/defaults.js";
import {
  VDialog,
  VBtn,
  VCard,
  VCardTitle,
  VCardText,
  VDefaultsProvider,
} from "vuetify/components";
const props = defineProps<{
  title: string;
  blocked?: boolean;
  headerClose?: boolean;
  returnFocus?: HTMLElement | null | (() => HTMLElement | null);
}>();
const emit = defineEmits<{
  close: [];
  feedback: [element: HTMLElement | null];
}>();
const defaults = injectDefaults();
const initialTrigger =
  typeof document === "undefined" ? null : document.activeElement;
onBeforeUnmount(() => {
  void nextTick(() => {
    const trigger =
      typeof props.returnFocus === "function"
        ? props.returnFocus()
        : (props.returnFocus ?? initialTrigger);
    if (
      trigger instanceof HTMLElement &&
      trigger.isConnected &&
      !trigger.matches(":disabled")
    )
      trigger.focus({ preventScroll: true });
  });
});
</script>
<template>
  <VDialog
    :model-value="true"
    :class="{ 'zerp-record-dialog-overlay--detail': headerClose }"
    :persistent="blocked"
    max-width="1100"
    scrollable
    :aria-label="title"
    @update:model-value="!$event && !blocked && emit('close')"
  >
    <VDefaultsProvider :defaults="defaults">
      <VCard
        class="zerp-record-dialog"
        tag="section"
        role="region"
        :aria-label="title"
      >
        <FeedbackHost @target="emit('feedback', $event)">
          <header v-if="headerClose" class="zerp-record-dialog__header">
            <VCardTitle>{{ title }}</VCardTitle>
            <VBtn
              type="button"
              variant="text"
              :disabled="blocked"
              @click="emit('close')"
            >
              关闭
            </VBtn>
          </header>
          <VCardTitle v-else>{{ title }}</VCardTitle>
          <VCardText class="zerp-record-dialog__body"><slot /></VCardText>
          <slot name="feedback" />
        </FeedbackHost>
      </VCard>
    </VDefaultsProvider>
  </VDialog>
</template>

<style scoped>
.zerp-record-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding-inline-end: 0.5rem;
}
.zerp-record-dialog__header .v-card-title {
  min-inline-size: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.zerp-record-dialog__header .v-btn {
  flex-shrink: 0;
}
.zerp-record-dialog__body {
  min-block-size: 0;
  overscroll-behavior: contain;
}
</style>
