<script setup lang="ts">
import { computed } from "vue";
import { VCheckbox, VFileInput, VTextField } from "vuetify/components";
import { nodeMetadata as meta } from "./model-node";
import type { BusinessModel } from "./business-model";
import type { ReferenceAdapter, ReferenceValue } from "./contracts";
import ReferencePicker from "./ReferencePicker.vue";
import PrintPreview from "./PrintPreview.vue";

type Field = Extract<BusinessModel[string], { value: unknown }>;
type Reference = Extract<Field, { [meta]: { kind: "reference" } }>;
type Output = Extract<Field, { [meta]: { kind: "output" } }>;
const props = defineProps<{ node: Field; readOnly?: boolean; scope: string }>();
const metadata = computed(() => props.node[meta]);
const disabled = computed(() => props.readOnly || metadata.value.readOnly);
const reference = computed(() => props.node as Reference);
const output = computed(() => props.node as Output);
const adapter = computed<ReferenceAdapter>(() => {
  const node = reference.value;
  const metadata = node[meta];
  return {
    directory: metadata.load ?? node,
    dependencies: metadata.dependencies,
    async load() {
      await metadata.load?.run();
      return metadata.options;
    },
  };
});
function setValue(value: unknown) {
  if (disabled.value) return;
  if (metadata.value.kind === "boolean") {
    (props.node as Extract<Field, { value: boolean }>).value = Boolean(value);
  } else if (metadata.value.kind === "attachments") {
    (props.node as Extract<Field, { value: File[] }>).value = Array.isArray(
      value,
    )
      ? value
      : value instanceof File
        ? [value]
        : [];
  } else if (metadata.value.kind === "reference") {
    const selected = value as ReferenceValue | readonly ReferenceValue[] | null;
    reference.value.value = Array.isArray(selected)
      ? [...selected]
      : (selected as ReferenceValue | null);
  } else if (metadata.value.kind !== "output") {
    (props.node as Extract<Field, { value: string }>).value =
      value == null ? "" : String(value);
  }
}
</script>
<template>
  <VCheckbox
    v-if="metadata.kind === 'boolean'"
    :label="metadata.name"
    :model-value="Boolean(node.value)"
    :disabled="disabled"
    @update:model-value="setValue"
  />
  <ReferencePicker
    v-else-if="metadata.kind === 'reference'"
    :adapter="adapter"
    :scope="scope"
    :label="metadata.name"
    :model-value="reference.value"
    :multiple="metadata.multiple"
    :disabled="disabled"
    :disabled-reason="metadata.load?.disabledReason"
    @update:model-value="setValue"
  />
  <VFileInput
    v-else-if="metadata.kind === 'attachments'"
    :label="metadata.name"
    :model-value="node.value as File[]"
    :multiple="metadata.multiple"
    :disabled="disabled"
    @update:model-value="setValue"
  />
  <section v-else-if="metadata.kind === 'output'" :aria-label="metadata.name">
    <PrintPreview
      v-if="output.value"
      :document="output.value"
      :allowed="false"
    />
    <p v-else>尚未生成预览</p>
  </section>
  <VTextField
    v-else
    :label="metadata.name"
    :aria-label="metadata.name"
    :model-value="node.value"
    :type="
      metadata.kind === 'password'
        ? 'password'
        : metadata.kind === 'date'
          ? 'date'
          : 'text'
    "
    :inputmode="metadata.kind === 'decimal' ? 'decimal' : undefined"
    :required="metadata.required"
    :readonly="disabled"
    @update:model-value="setValue"
  />
</template>
