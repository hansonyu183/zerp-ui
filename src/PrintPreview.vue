<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { printMarkup, type PrintDocument } from "./printing";
import { VBtn } from "vuetify/components";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
const props = defineProps<{
  document: PrintDocument;
  allowed: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ opened: [] }>();
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
let loadGeneration = 0;
watch(
  markup,
  () => {
    ++loadGeneration;
    ready.value = false;
    error.value = markup.value ? "" : "打印内容无效，请重新生成预览。";
  },
  { immediate: true },
);
async function loaded() {
  const generation = ++loadGeneration;
  const preview = frame.value?.contentDocument;
  ready.value = false;
  if (!preview) return;
  try {
    if (
      props.document.watermark?.font === "cjk-sans" ||
      props.document.pages.some((page) =>
        page.items.some(
          (item) => item.kind === "text" && item.font === "cjk-sans",
        ),
      )
    ) {
      const fonts = await preview.fonts.load(
        "10pt zerp-print-cjk-sans",
        "中文",
      );
      if (!fonts.length) throw Error("font");
    }
    await Promise.all(Array.from(preview.images, (image) => image.decode()));
    if (
      generation === loadGeneration &&
      preview === frame.value?.contentDocument
    )
      ready.value = true;
  } catch {
    if (
      generation === loadGeneration &&
      preview === frame.value?.contentDocument
    )
      error.value = "打印字体或位图不可用，请安装指定字体或重新生成位图。";
  }
}
function print() {
  if (!props.allowed || props.disabled || !ready.value || !markup.value) return;
  try {
    frame.value?.contentWindow?.print();
    emit("opened");
  } catch {
    error.value = "打印窗口未打开，请确认未打印。";
  }
}
</script>
<template>
  <section aria-label="打印输出">
    <FeedbackRegion><Feedback :message="error" kind="error" /></FeedbackRegion
    ><VBtn
      type="button"
      :disabled="!allowed || disabled || !ready || !markup"
      @click="print"
    >
      打开打印窗口
    </VBtn>
    <p>打印后请选择“已打印”或“未打印”。关闭窗口不会登记。</p>
    <iframe
      v-if="markup"
      :key="markup"
      ref="frame"
      title="打印预览"
      sandbox="allow-modals allow-same-origin"
      :srcdoc="markup"
      class="zerp-print-preview"
      @load="loaded"
    />
  </section>
</template>
