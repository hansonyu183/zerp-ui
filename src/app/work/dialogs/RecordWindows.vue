<script setup lang="ts">
// 渲染 WorkPage 管理的记录窗口，提供窗口切换、编辑、打印和未保存确认。
import { computed } from "vue";
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VDialog,
} from "vuetify/components";
import { allowed, available, editable } from "../../nodes";
import { feedbackForApplication } from "../../feedback";
import type { RecordWindowsState, RecordWindow } from "./record-windows";
import { targetHref } from "../work-router";
import type {
  CollectionTarget,
  ObjectNode,
} from "../../../model/business-model";
import RecordDialog from "./RecordDialog.vue";
import Node from "../../../components/nodes/Node.vue";
import ModelFeedback from "../../ModelFeedback.vue";
import TemplatePrint from "../TemplatePrint.vue";

const props = defineProps<{ windows: RecordWindowsState }>();
const emit = defineEmits<{ visit: [target: CollectionTarget] }>();

const {
  active,
  visible,
  confirm,
  close,
  resolveSwitch,
  save,
  beginEdit,
  retry,
} = props.windows;
const { blocking } = feedbackForApplication();
const foreground = computed(
  () =>
    visible.value.find((entry) => entry.type === active.value) ??
    visible.value.at(-1),
);
function handleable(node: ObjectNode) {
  if (
    node.processing &&
    Object.keys(node.processing.operations).some((action) =>
      allowed(node, action),
    )
  )
    return true;
  return (
    [node.document, node.workflow, node.batch, node.report].some((capability) =>
      Object.keys(capability?.operations ?? {}).some((action) =>
        available(node, action),
      ),
    ) ||
    (!!node.output &&
      (available(node, "confirmPrinted") ||
        available(node, "confirmNotPrinted")))
  );
}

function locked(entry: RecordWindow) {
  return typeof entry.baseline === "string" || entry.saving;
}

function readOnly(entry: RecordWindow) {
  return (
    entry.print ||
    (!handleable(entry.record) &&
      (entry.mode === "read" || !editable(entry.record)))
  );
}
</script>

<template>
  <div
    v-if="visible.length > 1"
    class="zerp-record-switcher"
    aria-label="记录窗口"
  >
    <VBtn
      v-for="entry in visible"
      :key="entry.type"
      :aria-pressed="entry === foreground"
      @click="active = entry.type"
      >{{ entry.record.label }}</VBtn
    >
  </div>
  <RecordDialog
    v-for="entry in visible"
    :key="entry.key"
    :show="entry === foreground"
    workspace
    header-close
    :title="
      entry.collection.draft === entry.record ? '新增' : entry.record.label
    "
    :blocked="!!blocking || !!confirm || entry.saving"
    :reading="entry.baseline === 'loading'"
    :form-locked="locked(entry)"
    :return-focus="entry.focus"
    @close="close(entry)"
  >
    <template #actions>
      <VBtn
        v-if="entry.baseline === 'failed'"
        variant="text"
        @click="retry(entry)"
        >重试读取</VBtn
      >
      <VBtn
        v-if="
          entry.mode === 'read' &&
          !locked(entry) &&
          available(entry.record, 'update')
        "
        variant="text"
        @click="beginEdit(entry)"
        >编辑</VBtn
      >
    </template>
    <div :inert="locked(entry) || undefined">
      <Node
        :node="entry.record"
        :target-href="targetHref"
        @visit="emit('visit', $event)"
        :editing="entry.mode === 'edit'"
        :read-only="readOnly(entry)"
        :save="(node) => save(entry, node)"
      />
    </div>
    <TemplatePrint
      v-if="
        !locked(entry) &&
        entry.collection.draft !== entry.record &&
        readOnly(entry)
      "
      :key="entry.printKey"
      :collection="entry.collection"
      :record="entry.record"
      :auto-open="entry.print"
    />
    <template #feedback>
      <ModelFeedback
        :target="entry.record"
        fixed
        :blocked="entry.mode === 'edit' && !available(entry.record, 'update')"
      />
    </template>
  </RecordDialog>
  <VDialog
    v-if="confirm"
    :model-value="true"
    persistent
    aria-label="切换记录？"
    max-width="420"
  >
    <VCard>
      <VCardText>当前记录有未保存的变更，仍要切换吗？</VCardText>
      <VCardActions>
        <VBtn @click="resolveSwitch(false)">取消</VBtn>
        <VBtn color="primary" @click="resolveSwitch(true)">继续切换</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.zerp-record-switcher {
  position: fixed;
  inset-inline-end: 16px;
  inset-block-start: calc(var(--zerp-app-bar-height) + 8px);
  z-index: 3000;
  display: flex;
  gap: 4px;
}
</style>
