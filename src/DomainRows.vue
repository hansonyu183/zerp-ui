<script setup lang="ts" generic="R extends object">
import { shallowRef, ref, watch, onBeforeUnmount } from "vue";
import DynamicForm from "./DynamicForm.vue";
import FactFields from "./FactFields.vue";
import { formFacts } from "./details";
import { clone } from "./clone";
import { equalValues } from "./editor-values";
import type { Fields } from "./contracts";
const props = defineProps<{
  label: string;
  fields: Fields<R>;
  empty: () => R;
  modelValue: readonly R[];
  scope: string;
  mode: "read" | "edit";
  disabled: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: readonly R[]];
  pending: [value: boolean];
}>();
const editing = shallowRef<{ index: number | null; value: R } | null>(null),
  pending = ref(false),
  valid = ref(true);
function begin(index: number | null) {
  if (props.disabled || props.mode === "read") return;
  editing.value = {
    index,
    value: clone(index === null ? props.empty() : props.modelValue[index]),
  };
  emit("pending", true);
}
function cancel() {
  editing.value = null;
  pending.value = false;
  valid.value = true;
  emit("pending", false);
}
function finish() {
  if (!editing.value || props.disabled || pending.value || !valid.value) return;
  const rows = [...props.modelValue];
  if (editing.value.index === null) rows.push(clone(editing.value.value));
  else rows[editing.value.index] = clone(editing.value.value);
  cancel();
  emit("update:modelValue", rows);
}
function remove(index: number) {
  if (props.disabled || props.mode === "read" || editing.value) return;
  emit(
    "update:modelValue",
    props.modelValue.filter((_, i) => i !== index),
  );
}
watch(() => [props.scope, props.mode], cancel);
watch(
  () => props.modelValue,
  (value, previous) => {
    if (!equalValues(value, previous)) cancel();
  },
);
onBeforeUnmount(() => emit("pending", false));
</script>
<template>
  <fieldset :aria-label="label" :disabled="disabled">
    <legend>{{ label }}</legend>
    <section
      v-for="(row, index) in modelValue"
      :key="index"
      :aria-label="`${label} ${index + 1}`"
    >
      <FactFields :value="row" :fields="formFacts(fields)" />
      <template v-if="mode === 'edit'"
        ><button type="button" :disabled="!!editing" @click="begin(index)">
          编辑{{ label }} {{ index + 1 }}</button
        ><button type="button" :disabled="!!editing" @click="remove(index)">
          删除{{ label }} {{ index + 1 }}
        </button></template
      >
    </section>
    <button
      v-if="mode === 'edit'"
      type="button"
      :disabled="!!editing"
      @click="begin(null)"
    >
      新增{{ label }}
    </button>
    <section v-if="editing" role="dialog" :aria-label="`编辑${label}`">
      <DynamicForm
        :fields="fields"
        :model-value="editing.value"
        :scope="scope"
        :disabled="disabled"
        @update:model-value="editing = { ...editing!, value: $event }"
        @pending="pending = $event"
        @validation="valid = $event.valid"
      /><button
        type="button"
        :disabled="pending || !valid || disabled"
        @click="finish"
      >
        确定{{ label }}</button
      ><button type="button" @click="cancel">取消{{ label }}</button>
    </section>
  </fieldset>
</template>
