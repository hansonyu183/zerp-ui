<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import type { ConfigurationBlockProps } from "@zerp/ui";
const props =
  defineProps<
    ConfigurationBlockProps<{ quantity: string }, { unit: string }>
  >();
const emit = defineEmits<{
  "update:modelValue": [value: { quantity: string }];
  pending: [value: boolean];
}>();
let timer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(timer));
function calculate() {
  emit("pending", true);
  timer = setTimeout(() => {
    emit("update:modelValue", { quantity: "1.005" });
    emit("pending", false);
  }, 100);
}
</script>
<template>
  <section aria-label="数量区块">
    <p>单位：{{ catalog.unit }}</p>
    <label
      >精确数量<input
        aria-label="精确数量"
        :value="modelValue.quantity"
        :readonly="mode === 'read'"
        :disabled="disabled"
        @input="
          emit('update:modelValue', {
            quantity: ($event.target as HTMLInputElement).value,
          })
        " /></label
    ><button v-if="mode === 'edit'" :disabled="disabled" @click="calculate">
      计算草稿
    </button>
  </section>
</template>
