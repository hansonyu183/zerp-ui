<script setup lang="ts" generic="D extends object">
import { renderBlock, type DomainBlock } from "./domain-blocks";
const props = defineProps<{
  block: DomainBlock<D>;
  modelValue: D;
  scope: string;
  mode: "read" | "edit";
  formMode: "create" | "edit";
  disabled: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: D];
  pending: [value: boolean];
}>();
const Content = () =>
  props.block[renderBlock]({
    value: props.modelValue,
    scope: props.scope,
    mode: props.mode,
    formMode: props.formMode,
    disabled: props.disabled,
    update: (value) => emit("update:modelValue", value),
    pending: (value) => emit("pending", value),
  });
</script>
<template><Content /></template>
