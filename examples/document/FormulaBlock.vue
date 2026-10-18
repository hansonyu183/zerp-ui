<script setup lang="ts">
import { onMounted, onBeforeUnmount, shallowRef } from "vue";
import type { ConfigurationBlockProps } from "@zerp/ui";
import type { Formula } from "./adapters";
const props =
  defineProps<
    ConfigurationBlockProps<
      Formula["formula"],
      readonly { code: string; label: string }[]
    >
  >();
const emit = defineEmits<{
  "update:modelValue": [value: Formula["formula"]];
  pending: [value: boolean];
}>();
const catalog = shallowRef<typeof props.catalog>([]);
let active = true;
onBeforeUnmount(() => {
  active = false;
});
onMounted(async () => {
  emit("pending", true);
  const prepared = await Promise.resolve(structuredClone(props.catalog));
  if (!active) return;
  catalog.value = prepared;
  emit("pending", false);
});
</script>
<template>
  <fieldset :disabled="disabled || mode === 'read' || !catalog.length">
    <legend>合成产品配方</legend>
    <div v-for="(row, index) in modelValue" :key="index">
      <label
        >原料<select
          aria-label="配方原料"
          :value="row.material"
          @change="
            emit(
              'update:modelValue',
              modelValue.map((r, i) =>
                i === index
                  ? {
                      ...r,
                      material: ($event.target as HTMLSelectElement).value,
                    }
                  : r,
              ),
            )
          "
        >
          <option
            v-for="material in catalog"
            :key="material.code"
            :value="material.code"
          >
            {{ material.label }}
          </option>
        </select></label
      >
      <label
        >用量<input
          aria-label="配方用量"
          :value="row.quantity"
          @input="
            emit(
              'update:modelValue',
              modelValue.map((r, i) =>
                i === index
                  ? {
                      ...r,
                      quantity: ($event.target as HTMLInputElement).value,
                    }
                  : r,
              ),
            )
          "
      /></label>
    </div>
  </fieldset>
</template>
