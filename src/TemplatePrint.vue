<script setup lang="ts">
import { computed, inject, ref, watch, onMounted, toRaw } from "vue";
import { VBtn } from "vuetify/components";
import type { Collection, ObjectNode } from "./business-model";
import { directRuntimeKey } from "./direct-model-runtime";
import { bindPrintTemplate } from "./model-print";
import PrintPreview from "./PrintPreview.vue";
import RecordDialog from "./RecordDialog.vue";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
const props = defineProps<{
  collection: Collection;
  record?: ObjectNode;
  disabled?: boolean;
  autoOpen?: boolean;
}>();
const runtime = inject(directRuntimeKey)!;
const open = ref(false);
const template = computed(() =>
  props.record
    ? props.collection.itemPrintTemple
    : props.collection.printTemple,
);
const permitted = computed(
  () =>
    runtime.allowed(props.collection, props.record ? "itemPrint" : "print") &&
    (!props.record || runtime.readable(props.record)),
);
const printableRows = computed(() =>
  props.collection.items.filter((row) => runtime.readable(row)),
);
const unconfirmed = computed(() =>
  props.record
    ? props.record.identity === null || !props.record.printable
    : printableRows.value.some(
        (row) => row.identity === null || !row.printable,
      ),
);
const pending = computed(
  () =>
    runtime.busy.value.has(toRaw(props.collection)) ||
    (props.record
      ? runtime.busy.value.has(toRaw(props.record))
      : printableRows.value.some((row) => runtime.busy.value.has(toRaw(row)))),
);
const blockedReason = computed(() =>
  unconfirmed.value
    ? props.record
      ? "记录尚未确认保存，请保存或核实后再打印。"
      : "当前页有未确认保存的记录，请保存或核实后再打印。"
    : pending.value
      ? "正在处理，请稍后打印。"
      : "",
);
const available = computed(
  () =>
    !props.disabled &&
    !pending.value &&
    permitted.value &&
    !unconfirmed.value &&
    (props.record
      ? (props.collection.items.includes(props.record) ||
          props.collection.selected === props.record) &&
        props.collection.draft !== props.record
      : printableRows.value.length > 0),
);
const preview = computed(() => {
  if (!open.value || !available.value || !template.value) return {};
  try {
    return {
      document: bindPrintTemplate(
        template.value,
        props.record ?? props.collection,
        runtime.readable,
      ),
    };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "打印模板无效。" };
  }
});
onMounted(() => {
  if (props.autoOpen && available.value) open.value = true;
});
watch([runtime.scope, () => props.collection, () => props.record], () => {
  open.value = false;
});
</script>
<template>
  <template v-if="template && permitted">
    <VBtn :disabled="!available" @click="open = available">{{
      record ? "单条打印" : "当前页打印"
    }}</VBtn>
    <FeedbackRegion v-if="!open"
      ><Feedback :message="blockedReason" kind="warning"
    /></FeedbackRegion>
    <RecordDialog v-if="open" :title="template.label" @close="open = false">
      <FeedbackRegion
        ><Feedback :message="preview.error || blockedReason" kind="error"
      /></FeedbackRegion>
      <PrintPreview
        v-if="preview.document"
        :document="preview.document"
        :allowed="permitted"
        :disabled="!available"
        :confirm-result="false"
      />
      <VBtn @click="open = false">关闭</VBtn>
    </RecordDialog>
  </template>
</template>
