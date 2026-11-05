<script setup lang="ts">
import { nextTick, onBeforeUnmount } from "vue";
import { injectDefaults } from "vuetify/lib/composables/defaults.js";
import {
  VDialog,
  VCard,
  VCardTitle,
  VCardText,
  VDefaultsProvider,
} from "vuetify/components";
const props = defineProps<{
  title: string;
  blocked?: boolean;
  returnFocus?: HTMLElement | null;
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
    const trigger = props.returnFocus ?? initialTrigger;
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
        <VCardTitle>{{ title }}</VCardTitle>
        <VCardText
          ><div
            :ref="
              (element) => emit('feedback', element as HTMLElement | null)
            " />
          <slot
        /></VCardText>
      </VCard>
    </VDefaultsProvider>
  </VDialog>
</template>
