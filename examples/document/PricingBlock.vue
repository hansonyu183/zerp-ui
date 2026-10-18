<script setup lang="ts">
import { onMounted } from "vue";
import type { ConfigurationBlockProps } from "@zerp/ui";
import type { Pricing } from "./adapters";
defineProps<ConfigurationBlockProps<Pricing["pricing"], readonly string[]>>();
const emit = defineEmits<{
  "update:modelValue": [value: Pricing["pricing"]];
  pending: [value: boolean];
}>();
onMounted(async () => {
  emit("pending", true);
  await Promise.resolve();
  emit("pending", false);
});
</script>
<template>
  <fieldset :disabled="disabled || mode === 'read'">
    <legend>合成客户定价</legend>
    <div v-for="(row, index) in modelValue" :key="index">
      <label
        >客户<select
          aria-label="定价客户"
          :value="row.customer"
          @change="
            emit(
              'update:modelValue',
              modelValue.map((r, i) =>
                i === index
                  ? {
                      ...r,
                      customer: ($event.target as HTMLSelectElement).value,
                    }
                  : r,
              ),
            )
          "
        >
          <option v-for="customer in catalog" :key="customer">
            {{ customer }}
          </option>
        </select></label
      >
      <label
        >价格<input
          aria-label="定价金额"
          :value="row.amount"
          @input="
            emit(
              'update:modelValue',
              modelValue.map((r, i) =>
                i === index
                  ? { ...r, amount: ($event.target as HTMLInputElement).value }
                  : r,
              ),
            )
          "
      /></label>
    </div>
  </fieldset>
</template>
