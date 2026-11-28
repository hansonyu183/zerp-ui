<script setup lang="ts">
// 提供记录窗口与打印预览的容器，管理关闭、焦点进入和返回。
import FeedbackHost from "../../../components/feedback/FeedbackHost.vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  provide,
  useTemplateRef,
  watch,
} from "vue";
import { formLocked } from "../../nodes";
import { injectDefaults } from "vuetify/lib/composables/defaults.js";
import {
  VDialog,
  VBtn,
  VCard,
  VCardTitle,
  VCardText,
  VDefaultsProvider,
} from "vuetify/components";
const props = withDefaults(
  defineProps<{
    title: string;
    blocked?: boolean;
    show?: boolean;
    workspace?: boolean;
    headerClose?: boolean;
    reading?: boolean;
    formLocked?: boolean;
    returnFocus?: HTMLElement | null | (() => HTMLElement | null);
  }>(),
  { reading: undefined, show: true },
);
const emit = defineEmits<{
  close: [];
}>();
const defaults = injectDefaults();
provide(
  formLocked,
  computed(() => !!props.formLocked),
);
const header = useTemplateRef<HTMLElement>("header");
function focusWorkspace() {
  const element = header.value;
  if (
    props.workspace &&
    props.show &&
    element &&
    !element.closest(".zerp-record-dialog")?.contains(document.activeElement)
  )
    element.focus({ preventScroll: true });
}
watch(
  () => props.show,
  () => void nextTick(focusWorkspace),
  { immediate: true },
);
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
    :model-value="show"
    :scrim="!workspace"
    :retain-focus="!workspace"
    :close-on-back="!workspace"
    :persistent="blocked || workspace"
    :no-click-animation="workspace"
    max-width="1100"
    scrollable
    :aria-label="title"
    :aria-modal="workspace ? 'false' : undefined"
    @keydown.esc="workspace && !blocked && emit('close')"
    @after-enter="focusWorkspace"
    @update:model-value="!$event && !blocked && emit('close')"
  >
    <VDefaultsProvider :defaults="defaults">
      <VCard
        class="zerp-record-dialog"
        tag="section"
        role="region"
        :aria-label="title"
      >
        <FeedbackHost>
          <header
            ref="header"
            :tabindex="workspace ? -1 : undefined"
            class="zerp-record-dialog__header"
          >
            <VCardTitle>{{ title }}</VCardTitle>
            <span
              v-if="reading !== undefined"
              class="zerp-record-dialog__status"
              role="status"
              >{{ reading ? "正在读取…" : "" }}</span
            >
            <slot name="actions" />
            <VBtn
              v-if="headerClose"
              type="button"
              variant="text"
              :disabled="blocked"
              @click="emit('close')"
            >
              关闭
            </VBtn>
          </header>
          <VCardText class="zerp-record-dialog__body" :aria-busy="reading">
            <slot />
          </VCardText>
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
  border-block-end: thin solid
    rgba(var(--v-border-color), var(--v-border-opacity));
}
.zerp-record-dialog__header .v-card-title {
  min-inline-size: 0;
  padding-inline: 1rem;
  font-weight: 500;
  white-space: normal;
  overflow-wrap: anywhere;
}
.zerp-record-dialog__header .v-btn {
  flex-shrink: 0;
}
.zerp-record-dialog__status {
  flex: 0 0 6em;
  margin-inline-start: auto;
  white-space: nowrap;
}
.zerp-record-dialog__body {
  min-block-size: 0;
  padding: 1rem;
  overscroll-behavior: contain;
}
</style>
