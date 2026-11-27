<script setup lang="ts">
import { computed } from "vue";
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VDialog,
} from "vuetify/components";
import { available, editable, handleable } from "./business-nodes";
import {
  feedbackForApplication,
  isReading,
  recordLoadFailed,
} from "./business-operations";
import { useRecordWindows, type RecordWindow } from "./record-windows";
import RecordDialog from "./RecordDialog.vue";
import BusinessNode from "./BusinessNode.vue";
import BusinessFeedback from "./BusinessFeedback.vue";
import TemplatePrint from "./TemplatePrint.vue";

const {
  active,
  visible,
  confirm,
  close,
  resolveSwitch,
  save,
  beginEdit,
  retry,
} = useRecordWindows();
const { blocking } = feedbackForApplication();
const foreground = computed(
  () =>
    visible.value.find((entry) => entry.type === active.value) ??
    visible.value.at(-1),
);
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
    :blocked="!!blocking || !!confirm"
    :reading="isReading(entry.record)"
    :return-focus="entry.focus"
    @close="close(entry)"
  >
    <template #actions>
      <VBtn
        v-if="recordLoadFailed(entry.record)"
        variant="text"
        @click="retry(entry)"
        >重试读取</VBtn
      >
      <VBtn
        v-if="
          entry.mode === 'read' &&
          !isReading(entry.record) &&
          available(entry.record, 'update')
        "
        variant="text"
        @click="beginEdit(entry)"
        >编辑</VBtn
      >
    </template>
    <BusinessNode
      :node="entry.edits ? entry.draft : entry.record"
      :editing="entry.mode === 'edit'"
      :read-only="readOnly(entry)"
      :save="(node) => save(entry, node)"
    />
    <TemplatePrint
      v-if="entry.collection.draft !== entry.record && readOnly(entry)"
      :key="entry.printKey"
      :collection="entry.collection"
      :record="entry.record"
      :auto-open="entry.print"
    />
    <template #feedback>
      <BusinessFeedback
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
    aria-label="丢弃未保存的编辑？"
    max-width="420"
  >
    <VCard>
      <VCardText>丢弃当前记录的未保存编辑并切换？</VCardText>
      <VCardActions>
        <VBtn @click="resolveSwitch(false)">取消</VBtn>
        <VBtn color="primary" @click="resolveSwitch(true)">丢弃并切换</VBtn>
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
