<script setup lang="ts">
import type { ConfigurationBlockProps } from "@zerp/ui";
defineProps<
  ConfigurationBlockProps<
    { target: string; dimensions: string[] },
    readonly string[]
  >
>();
const emit = defineEmits<{
  "update:modelValue": [value: { target: string; dimensions: string[] }];
  pending: [value: boolean];
}>();
</script>
<template>
  <fieldset :disabled="disabled">
    <legend>合成映射区块</legend>
    <label
      >目标<select
        aria-label="映射目标"
        :value="modelValue.target"
        @change="
          emit('update:modelValue', {
            ...modelValue,
            target: ($event.target as HTMLSelectElement).value,
          })
        "
      >
        <option v-for="target in catalog" :key="target">{{ target }}</option>
      </select></label
    >
    <p>维度：{{ modelValue.dimensions.join("、") }}</p>
  </fieldset>
</template>
