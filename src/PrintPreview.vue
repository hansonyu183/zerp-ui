<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { printMarkup, type PrintDocument } from "./printing";
import { VBtn } from "vuetify/components";
import Feedback from "./Feedback.vue";
const props = defineProps<{
  document: PrintDocument;
  allowed: boolean;
  disabled?: boolean;
}>();
const frame = ref<HTMLIFrameElement>(),
  ready = ref(false),
  error = ref("");
const markup = computed(() => {
  try {
    return printMarkup(props.document);
  } catch {
    return "";
  }
});
watch(
  markup,
  () => {
    ready.value = false;
    error.value = markup.value ? "" : "打印内容无效，请重新生成预览。";
  },
  { immediate: true },
);
function print() {
  if (!props.allowed || props.disabled || !ready.value || !markup.value) return;
  try {
    frame.value?.contentWindow?.print();
  } catch {
    error.value = "打印窗口未打开，请确认未打印。";
  }
}
</script>
<template>
  <section aria-label="打印输出">
    <Feedback :message="error" kind="error" /><VBtn
      type="button"
      :disabled="!allowed || disabled || !ready || !markup"
      @click="print"
    >
      打开打印窗口
    </VBtn>
    <p>请在打印结束后明确确认已打印或未打印。关闭打印窗口不会自动登记。</p>
    <iframe
      v-if="markup"
      :key="markup"
      ref="frame"
      title="打印预览"
      sandbox="allow-modals allow-same-origin"
      :srcdoc="markup"
      class="zerp-print-preview"
      @load="ready = true"
    />
  </section>
</template>
