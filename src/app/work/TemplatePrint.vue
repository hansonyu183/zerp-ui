<script setup lang="ts">
// 从集合的打印模板生成当前页或单条记录的预览，并管理排版的生命周期。
import { isPending } from "../usePending";
import { sessionScope } from "../session";
import { allowed as nodeAllows, readable as nodeReadable } from "../nodes";
import { computed, ref, watch } from "vue";
import { VBtn } from "vuetify/components";
import type { ListCollection, ObjectNode } from "../../model/business-model";
import { layoutPrintTemplate } from "../../components/printing/print-layout";
import type { PreparedPrint } from "../../components/printing/model-print";
import PrintPreview from "../../components/printing/PrintPreview.vue";
import RecordDialog from "./dialogs/RecordDialog.vue";
import Feedback from "../../components/feedback/Feedback.vue";
import FeedbackRegion from "../../components/feedback/FeedbackRegion.vue";
const props = defineProps<{
  collection: ListCollection;
  record?: ObjectNode;
  disabled?: boolean;
  autoOpen?: boolean;
}>();
const open = ref(false);
const template = computed(() =>
  props.record
    ? props.collection.itemPrintTemple
    : props.collection.printTemple,
);
const permitted = computed(
  () =>
    nodeAllows(props.collection, props.record ? "itemPrint" : "print") &&
    (!props.record || nodeReadable(props.record)),
);
const printableRows = computed(() =>
  props.collection.items.filter((row) => nodeReadable(row)),
);
const hasUnprintableRecord = computed(() =>
  props.record
    ? props.record.identity === null || !props.record.printable
    : printableRows.value.some(
        (row) => row.identity === null || !row.printable,
      ),
);
const pending = computed(
  () =>
    isPending(props.collection) ||
    (props.record
      ? isPending(props.record)
      : printableRows.value.some((row) => isPending(row))),
);
const blockedReason = computed(() =>
  hasUnprintableRecord.value
    ? props.record
      ? "此记录当前不可打印。"
      : "当前页有不可打印的记录。"
    : pending.value
      ? "正在处理，请稍后打印。"
      : "",
);
const eligible = computed(
  () =>
    !props.disabled &&
    permitted.value &&
    !hasUnprintableRecord.value &&
    (props.record
      ? (props.collection.items.includes(props.record) ||
          props.collection.selected === props.record) &&
        props.collection.draft !== props.record
      : printableRows.value.length > 0),
);
const available = computed(() => eligible.value && !pending.value);
const preview = ref<{ output?: PreparedPrint; error?: string }>({});
const layingOut = ref(false);
// 只在预览打开且具备打印资格时跟踪源数据并启动排版。
watch(
  [
    () =>
      open.value && available.value && template.value
        ? { template: template.value, source: props.record ?? props.collection }
        : undefined,
    sessionScope,
  ],
  async ([request], _previous, onCleanup) => {
    preview.value = {};
    layingOut.value = false;
    if (!request) return;
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    layingOut.value = true;
    try {
      const output = await layoutPrintTemplate(
        request.template,
        request.source,
        nodeReadable,
        controller.signal,
      );
      if (!controller.signal.aborted) preview.value = { output };
    } catch (cause) {
      if (!controller.signal.aborted)
        preview.value = {
          error: cause instanceof Error ? cause.message : "打印模板无效。",
        };
    } finally {
      if (!controller.signal.aborted) layingOut.value = false;
    }
  },
  { deep: true, immediate: true, flush: "sync" },
);
let autoOpened = false;
watch(
  sessionScope,
  () => {
    open.value = false;
    autoOpened = true;
  },
  { flush: "sync" },
);
watch(
  [() => props.collection, () => props.record],
  () => {
    open.value = false;
    autoOpened = false;
  },
  { flush: "sync" },
);
watch(
  [() => props.autoOpen, available, template],
  ([requested, ready, configured]) => {
    if (!requested) autoOpened = false;
    else if (ready && configured && !autoOpened) {
      autoOpened = true;
      open.value = true;
    }
  },
  { immediate: true, flush: "post" },
);
</script>
<template>
  <template v-if="template && permitted">
    <VBtn v-if="eligible" :disabled="pending" @click="open = available">{{
      record ? "单条打印" : "当前页打印"
    }}</VBtn>
    <FeedbackRegion v-if="!open && (!record || autoOpen)"
      ><Feedback :message="blockedReason" kind="warning"
    /></FeedbackRegion>
    <RecordDialog v-if="open" :title="template.label" @close="open = false">
      <FeedbackRegion
        ><Feedback :message="preview.error || blockedReason" kind="error"
      /></FeedbackRegion>
      <p v-if="layingOut" role="status">正在排版…</p>
      <PrintPreview
        v-if="preview.output"
        :document="preview.output.document"
        :prepared-markup="preview.output.markup"
        :action-available="() => available && !!preview.output"
        :confirm-result="false"
      />
      <VBtn variant="text" @click="open = false">关闭</VBtn>
    </RecordDialog>
  </template>
</template>
