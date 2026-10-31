<script setup lang="ts">
import { ref, watch } from "vue";
import type { ConfigurationBlockProps } from "@zerp/ui";
const props =
  defineProps<
    ConfigurationBlockProps<
      { code: string; enabled: boolean },
      readonly string[]
    >
  >();
const emit = defineEmits<{
  "update:modelValue": [value: { code: string; enabled: boolean }];
  pending: [value: boolean];
}>();
const text = ref(props.modelValue.code);
watch(
  () => props.modelValue.code,
  (value) => (text.value = value),
);
function update(value: string) {
  text.value = value;
  emit("pending", value === "-");
  if (value !== "-")
    emit("update:modelValue", { ...props.modelValue, code: value });
}
</script>
<template>
  <fieldset :disabled="disabled">
    <legend>资料设置区块</legend>
    <p v-if="mode === 'read'">设置代码：{{ modelValue.code }}</p>
    <label v-else
      >设置代码<input
        aria-label="设置代码"
        :value="text"
        @input="update(($event.target as HTMLInputElement).value)"
    /></label>
    <p>{{ catalog.join("、") }}</p>
  </fieldset>
</template>
