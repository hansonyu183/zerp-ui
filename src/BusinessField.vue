<script setup lang="ts">
import { computed, inject } from "vue";
import {
  VCheckbox,
  VFileInput,
  VTextField,
  VTextarea,
  VSelect,
} from "vuetify/components";
import type { FieldNode, ReferenceValue } from "./business-model";
import type { ReferenceAdapter } from "./contracts";
import ReferencePicker from "./ReferencePicker.vue";
import { directRuntimeKey } from "./direct-model-runtime";
import { formatField } from "./model-format";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
const props = defineProps<{
  node: FieldNode;
  readOnly?: boolean;
  scope: string;
  publicAuth?: boolean;
}>();
const runtime = inject(directRuntimeKey)!;
const disabled = computed(() => props.readOnly || props.node.readOnly);
const secret = computed(() =>
  props.node.kind === "secret" ? props.node : null,
);
const reference = computed(() =>
  props.node.kind === "reference" || props.node.kind === "treeReference"
    ? props.node
    : null,
);
const display = computed(() => {
  if (!disabled.value) return {};
  try {
    return { value: formatField(props.node) };
  } catch (cause) {
    return {
      value: "",
      error: cause instanceof Error ? cause.message : "显示格式无效。",
    };
  }
});
function setSecretIntent(intent: "keep" | "replace" | "clear") {
  if (disabled.value || !secret.value) return;
  secret.value.value =
    intent === "replace" ? { intent, value: "" } : { intent };
}
function setSecretValue(value: unknown) {
  if (!disabled.value && secret.value?.value.intent === "replace")
    secret.value.value.value = String(value ?? "");
}
const loadDisabled = computed(
  () =>
    !!reference.value?.load &&
    (reference.value.load.disabled ||
      (!props.publicAuth && !runtime.allowed(reference.value, "load"))),
);
const adapter = computed<ReferenceAdapter>(() => {
  const node = reference.value!;
  return {
    directory: node,
    async load() {
      if (node.load) {
        if (loadDisabled.value) throw Error("当前不能读取候选值。");
        if (props.publicAuth) await node.load.run();
        else await runtime.run(node, "load");
      }
      return node.options;
    },
  };
});
function setValue(value: unknown) {
  if (disabled.value) return;
  const node = props.node;
  if (node.kind === "boolean") node.value = Boolean(value);
  else if (node.kind === "integer")
    node.value = value === "" || value == null ? null : Number(value);
  else if (node.kind === "attachments")
    node.value = Array.isArray(value)
      ? value
      : value instanceof File
        ? [value]
        : [];
  else if (node.kind === "reference" || node.kind === "treeReference") {
    if (node.multiple)
      node.value = Array.isArray(value)
        ? value.map((item: ReferenceValue) => ({
            id: item.id,
            label: item.label,
          }))
        : [];
    else {
      const item = Array.isArray(value)
        ? null
        : (value as ReferenceValue | null);
      node.value = item ? { id: item.id, label: item.label } : null;
    }
  } else if (node.kind !== "secret")
    node.value = value == null ? "" : String(value);
}
</script>
<template>
  <div v-if="secret">
    <VSelect
      density="compact"
      hide-details
      :label="node.label ?? undefined"
      :aria-label="node.label ?? undefined"
      :model-value="secret.value.intent"
      :disabled="disabled"
      :items="[
        { title: '保留', value: 'keep' },
        { title: '修改', value: 'replace' },
        { title: '清除', value: 'clear' },
      ]"
      @update:model-value="setSecretIntent"
    />
    <VTextField
      v-if="secret.value.intent === 'replace'"
      density="compact"
      hide-details
      :label="`新的${node.label}`"
      :aria-label="`新的${node.label}`"
      type="password"
      autocomplete="new-password"
      :model-value="secret.value.value"
      :readonly="disabled"
      @update:model-value="setSecretValue"
    />
  </div>
  <VCheckbox
    v-else-if="node.kind === 'boolean'"
    density="compact"
    hide-details
    :label="node.label ?? undefined"
    :model-value="node.value"
    :disabled="disabled"
    @update:model-value="setValue"
  />
  <ReferencePicker
    v-else-if="reference"
    :adapter="adapter"
    :scope="scope"
    :label="node.label ?? ''"
    :model-value="reference.value"
    :multiple="reference.multiple"
    :tree="reference.kind === 'treeReference'"
    :disabled="disabled"
    :disabled-reason="loadDisabled ? '当前不能读取候选值。' : undefined"
    @update:model-value="setValue"
  />
  <VFileInput
    v-else-if="node.kind === 'attachments'"
    density="compact"
    hide-details
    :label="node.label ?? undefined"
    :model-value="node.value"
    :multiple="node.multiple"
    :disabled="disabled"
    @update:model-value="setValue"
  />
  <VTextarea
    v-else-if="node.kind === 'longText'"
    density="compact"
    hide-details
    :label="node.label ?? undefined"
    :aria-label="node.label ?? undefined"
    :model-value="node.value"
    :readonly="disabled"
    @update:model-value="setValue"
  />
  <div v-else>
    <VTextField
      density="compact"
      hide-details
      :label="node.label ?? undefined"
      :aria-label="node.label ?? undefined"
      :model-value="
        disabled && ['date', 'datetime', 'decimal'].includes(node.kind)
          ? display.value
          : node.value
      "
      :type="
        disabled
          ? 'text'
          : node.kind === 'password'
            ? 'password'
            : node.kind === 'date'
              ? 'date'
              : node.kind === 'integer'
                ? 'number'
                : 'text'
      "
      :inputmode="node.kind === 'decimal' ? 'decimal' : undefined"
      :required="node.required"
      :readonly="disabled"
      @update:model-value="setValue"
    />
    <FeedbackRegion
      ><Feedback :message="display.error" kind="error"
    /></FeedbackRegion>
  </div>
</template>
