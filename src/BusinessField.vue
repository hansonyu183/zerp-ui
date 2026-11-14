<script setup lang="ts">
import { computed } from "vue";
import {
  VCheckbox,
  VFileInput,
  VTextField,
  VTextarea,
  VSelect,
} from "vuetify/components";
import { nodeMetadata as meta } from "./model-node";
import type { BusinessModel } from "./business-model";
import type { ReferenceAdapter, ReferenceValue } from "./contracts";
import ReferencePicker from "./ReferencePicker.vue";
import BusinessFamilyContent from "./BusinessFamilyContent.vue";

type Field = Extract<BusinessModel[string], { value: unknown }>;
type Reference = Extract<Field, { [meta]: { kind: "reference" } }>;

const props = defineProps<{ node: Field; readOnly?: boolean; scope: string }>();
const metadata = computed(() => props.node[meta]);
const disabled = computed(() => props.readOnly || metadata.value.readOnly);
const reference = computed(() => props.node as Reference);

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
  } else if (metadata.value.kind === "integer") {
    (props.node as Extract<Field, { [meta]: { kind: "integer" } }>).value =
      value === "" || value == null ? null : Number(value);
  } else if (metadata.value.kind === "enum") {
    (props.node as Extract<Field, { [meta]: { kind: "enum" } }>).value =
      value == null ? null : String(value);
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
  } else if (
    metadata.value.kind !== "output" &&
    metadata.value.kind !== "interactions"
  ) {
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
  <BusinessFamilyContent
    v-else-if="metadata.kind === 'output' || metadata.kind === 'interactions'"
    :node="node"
    :read-only="disabled"
  />
  <VSelect
    v-else-if="metadata.kind === 'enum'"
    :label="metadata.name"
    :aria-label="metadata.name"
    :items="metadata.options"
    item-title="name"
    item-value="id"
    :model-value="node.value"
    :readonly="disabled"
    @update:model-value="setValue"
  />
  <VTextarea
    v-else-if="metadata.kind === 'longText'"
    :label="metadata.name"
    :aria-label="metadata.name"
    :model-value="node.value as string"
    :readonly="disabled"
    @update:model-value="setValue"
  />
  <VTextField
    v-else
    :label="metadata.name"
    :aria-label="metadata.name"
    :model-value="node.value"
    :type="
      metadata.kind === 'password' || metadata.kind === 'secret'
        ? 'password'
        : metadata.kind === 'date'
          ? 'date'
          : metadata.kind === 'datetime'
            ? 'datetime-local'
            : metadata.kind === 'integer'
              ? 'number'
              : 'text'
    "
    :inputmode="metadata.kind === 'decimal' ? 'decimal' : undefined"
    :required="metadata.required"
    :readonly="disabled"
    @update:model-value="setValue"
  />
</template>
