<script setup lang="ts">
import { feedbackForApplication } from "../../app/operations";
import { applicationReady } from "../../app/session";
import type { CollectionTarget } from "../../model/business-model";
import { computed, useId, watch } from "vue";
import { injectDefaults } from "vuetify/lib/composables/defaults.js";
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VDialog,
  VDefaultsProvider,
} from "vuetify/components";
import {
  isCollection,
  type NodeOrCollection,
  ancestors as nodeAncestors,
  readable as nodeReadable,
} from "../../app/nodes";
import Feedback from "./Feedback.vue";
import { appBarHeight } from "../../styles/theme";

const props = defineProps<{
  target?: NodeOrCollection;
  exact?: boolean;
  fixed?: boolean;
  blocked?: boolean;
}>();
const emit = defineEmits<{ visit: [target: CollectionTarget] }>();
const defaults = injectDefaults();
const feedback = feedbackForApplication();
const { blocking, transient, acknowledge, dismissTransient } = feedback;
const reason = computed(() => feedback.reason(props.target));
const description = useId();

watch(
  () => props.target,
  (target, _previous, onCleanup) => {
    if (target)
      onCleanup(
        feedback.presentWith(target, !!props.exact, () => !!props.blocked),
      );
  },
  { immediate: true },
);
function locate(target: NodeOrCollection) {
  const collection = isCollection(target)
    ? target
    : nodeAncestors(target).find(isCollection);
  if (!collection || !nodeReadable(target)) return;
  const record = [...nodeAncestors(target), target].find(
    (node) =>
      !isCollection(node) &&
      node.kind === "object" &&
      nodeAncestors(node).at(-1) === collection,
  );
  emit("visit", {
    collection,
    record:
      record && !isCollection(record) && record.kind === "object"
        ? record
        : undefined,
  });
}
</script>
<template>
  <div
    v-if="target"
    :tabindex="reason ? 0 : undefined"
    class="zerp-business-feedback"
    :class="{ 'zerp-business-feedback--fixed': fixed }"
  >
    <Feedback
      v-if="reason"
      :key="reason.id"
      :message="reason.text"
      :kind="reason.level === 'error' ? 'error' : 'warning'"
      persistent
    />
  </div>
  <template v-else>
    <div
      class="zerp-business-page-feedback"
      role="region"
      aria-label="页面消息"
    >
      <Feedback
        v-if="reason"
        :key="reason.id"
        :message="reason.text"
        :kind="reason.level === 'error' ? 'error' : 'warning'"
        persistent
      >
        <VBtn
          v-if="reason.target"
          variant="text"
          color="primary"
          @click="locate(reason.target)"
        >
          查看
        </VBtn>
      </Feedback>
      <Feedback
        v-if="transient"
        :key="transient.order"
        :message="transient.message.text"
        :kind="
          transient.message.level === 'error' ||
          transient.message.level === 'warning'
            ? transient.message.level
            : 'status'
        "
        @dismiss="dismissTransient"
      >
        <VBtn
          v-if="transient.message.target"
          variant="text"
          color="primary"
          @click="locate(transient.message.target)"
        >
          查看
        </VBtn>
      </Feedback>
    </div>
    <VDialog
      v-if="blocking"
      :model-value="true"
      :attach="false"
      :contained="false"
      :style="{
        insetBlockStart: applicationReady ? `${appBarHeight}px` : undefined,
      }"
      :aria-describedby="description"
      aria-label="操作提示"
      role="alertdialog"
      class="zerp-blocking-dialog"
      max-width="420"
      scrollable
      persistent
      no-click-animation
    >
      <VDefaultsProvider :defaults="defaults">
        <VCard>
          <VCardTitle>操作提示</VCardTitle>
          <VCardText :id="description" class="zerp-blocking-message">{{
            blocking.text
          }}</VCardText>
          <VCardActions>
            <VBtn color="primary" variant="flat" @click="acknowledge(blocking)"
              >确定</VBtn
            >
          </VCardActions>
        </VCard>
      </VDefaultsProvider>
    </VDialog>
  </template>
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
.zerp-business-feedback:not(.zerp-business-feedback--fixed):empty {
  display: none;
}
.zerp-business-page-feedback {
  position: fixed;
  inset: calc(var(--zerp-app-bar-height, 0px) + 0.5rem) 1rem auto;
  z-index: 2001;
  inline-size: min(30rem, calc(100% - 2rem));
  margin-inline: auto;
  max-block-size: min(40dvh, 16rem);
  overflow: auto;
  overscroll-behavior: contain;
  pointer-events: none;
}
.zerp-business-page-feedback > :deep(.zerp-feedback) {
  margin-block-end: 0.25rem;
  pointer-events: auto;
}
.zerp-blocking-message {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
