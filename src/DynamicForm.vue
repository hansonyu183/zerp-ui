<script setup lang="ts" generic="T extends object">
import {
  computed,
  ref,
  shallowRef,
  watch,
  watchEffect,
  onBeforeUnmount,
  useId,
} from "vue";
import type { AnyField, Fields, ReferenceValue } from "./contracts";
import {
  VTextField,
  VTextarea,
  VSelect,
  VCheckbox,
  VBtn,
  VCard,
  VCardText,
  VCardActions,
} from "vuetify/components";
import FactFields from "./FactFields.vue";
import { formFacts } from "./details";
import ReferencePicker from "./ReferencePicker.vue";
import { validateFields, type FormValidationState } from "./validation";
import { clone } from "./clone";
const props = defineProps<{
  fields: Fields<T>;
  modelValue: T;
  scope: string;
  disabled?: boolean;
  mode?: "create" | "edit";
}>();
const emit = defineEmits<{
  "update:modelValue": [value: T];
  pending: [value: boolean];
  validation: [value: FormValidationState<T>];
}>();
const values = computed(() => props.modelValue as Record<string, unknown>);
const visible = computed(() =>
  (props.fields as readonly AnyField[]).filter(
    (f) =>
      (!f.mode || f.mode === props.mode) &&
      (!f.when || values.value[f.when.key] === f.when.equals),
  ),
);
function set(key: string, value: unknown) {
  if (props.disabled) return;
  const next = { ...props.modelValue, [key]: value } as Record<string, unknown>;
  for (const field of props.fields as readonly AnyField[]) {
    if (
      (field.type === "reference" || field.type === "references") &&
      field.parentKey === key
    )
      next[field.key] = field.type === "reference" ? null : [];
  }
  emit("update:modelValue", next as T);
}
const formId = useId();
function errors(field: AnyField) {
  return validation.value.issues
    .filter((issue) => issue.key === field.key)
    .map((issue) => issue.message);
}
function control(field: AnyField) {
  return {
    label: field.label,
    "aria-label": field.label,
    disabled: props.disabled || field.readonly,
    // A required boolean must be present; false is a valid business value.
    required: field.type === "boolean" ? undefined : field.required,
    "aria-required": field.required ? "true" : undefined,
    error: errors(field).length > 0,
    "aria-invalid": errors(field).length ? "true" : undefined,
    "aria-describedby": `${formId}-${field.key}-messages`,
    hideDetails: true,
  };
}
const integerInput = ref<Record<string, string>>({});
const emittedInteger = new Map<string, number | null>();
function input(field: AnyField, value: string) {
  if (field.type === "integer") {
    integerInput.value[field.key] = value;
    const valid = /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value));
    pending("$integer:" + field.key, !valid && value !== "");
    if (valid || value === "") {
      const parsed = value === "" ? null : Number(value);
      emittedInteger.set(field.key, parsed);
      set(field.key, parsed);
    }
  } else set(field.key, value);
}
const editing = shallowRef<{
  key: string;
  index: number;
  value: object;
  fields: readonly AnyField[];
} | null>(null);
const childInvalid = ref(false);
const childPending = ref(false),
  sources = ref(new Set<string>());
const validation = computed(() =>
  validateFields(props.fields, props.modelValue, props.mode ?? "edit"),
);
watchEffect(() =>
  emit("validation", { ...validation.value, pending: sources.value.size > 0 }),
);
function pending(key: string, busy: boolean) {
  if (busy) sources.value.add(key);
  else sources.value.delete(key);
  emit("pending", sources.value.size > 0);
}
function range(key: string): string[] {
  return Array.isArray(values.value[key])
    ? (values.value[key] as string[])
    : ["", ""];
}
function setRange(key: string, index: number, value: string) {
  const next = [...range(key)];
  next[index] = value;
  set(key, next.every((value) => value === "") ? null : next);
}
function options(field: Extract<AnyField, { type: "enum" | "multi-enum" }>) {
  const current = values.value[field.key];
  const selected = Array.isArray(current) ? current : [current];
  return [
    ...field.options.map((option) => ({ ...option, historical: false })),
    ...selected
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          value !== "" &&
          !field.options.some((option) => option.value === value),
      )
      .map((value) => ({ value, label: value, historical: true })),
  ];
}
function rows(key: string) {
  return (values.value[key] ?? []) as object[];
}
function begin(field: Extract<AnyField, { type: "rows" }>, index: number) {
  childPending.value = false;
  childInvalid.value = false;
  pending("$child", false);
  editing.value = {
    key: field.key,
    index,
    value: clone(index < 0 ? field.empty() : rows(field.key)[index]),
    fields: field.fields,
  };
  pending("$editing", true);
}
function confirm() {
  const e = editing.value;
  if (!e || props.disabled || childPending.value || childInvalid.value) return;
  const next = [...rows(e.key)];
  if (e.index < 0) next.push(clone(e.value));
  else next[e.index] = clone(e.value);
  set(e.key, next);
  editing.value = null;
  pending("$editing", false);
}
function cancelEditing() {
  editing.value = null;
  pending("$child", false);
  pending("$editing", false);
}
watch(
  () => [props.scope, props.fields],
  () => {
    editing.value = null;
    childPending.value = false;
    childInvalid.value = false;
    sources.value.clear();
    integerInput.value = {};
    emittedInteger.clear();
    emit("pending", false);
  },
);
watch(
  () => ({ ...values.value }),
  (current, previous) => {
    for (const field of props.fields as readonly AnyField[]) {
      if (
        field.type !== "integer" ||
        Object.is(current[field.key], previous[field.key])
      )
        continue;
      if (
        !emittedInteger.has(field.key) ||
        !Object.is(current[field.key], emittedInteger.get(field.key))
      ) {
        delete integerInput.value[field.key];
        pending("$integer:" + field.key, false);
      }
      emittedInteger.delete(field.key);
    }
  },
);
watch(visible, (fields) => {
  const keys = new Set(fields.map((field) => field.key));
  for (const key of sources.value)
    if (key.startsWith("$integer:") && !keys.has(key.slice(9))) {
      sources.value.delete(key);
      delete integerInput.value[key.slice(9)];
      emittedInteger.delete(key.slice(9));
    }
  emit("pending", sources.value.size > 0);
});
onBeforeUnmount(() => emit("pending", false));
</script>
<template>
  <div class="zerp-form">
    <div v-for="field in visible" :key="field.key" class="zerp-form-field">
      <ReferencePicker
        v-if="field.type === 'reference' || field.type === 'references'"
        :adapter="field.adapter"
        :parent="
          field.parentKey
            ? (values[field.parentKey] as ReferenceValue | null)
            : undefined
        "
        :model-value="
          (values[field.key] ?? null) as
            ReferenceValue | ReferenceValue[] | null
        "
        :scope="scope"
        :label="field.label"
        :multiple="field.type === 'references'"
        :disabled="disabled || field.readonly"
        :description-id="`${formId}-${field.key}-messages`"
        :invalid="errors(field).length > 0"
        @update:model-value="set(field.key, $event)"
        @pending="pending(field.key, $event)"
      />
      <fieldset
        v-else-if="field.type === 'rows'"
        :disabled="disabled || field.readonly"
        class="zerp-field-group"
      >
        <legend class="text-subtitle-1">{{ field.label }}</legend>
        <ol>
          <li v-for="(row, index) in rows(field.key)" :key="index">
            <FactFields :value="row" :fields="formFacts(field.fields)" />
            <VBtn
              type="button"
              variant="text"
              :disabled="disabled || field.readonly || !!editing"
              @click="begin(field, index)"
              >编辑{{ field.label }}{{ index + 1 }}</VBtn
            >
            <VBtn
              type="button"
              variant="text"
              color="error"
              :disabled="disabled || field.readonly || !!editing"
              @click="
                set(
                  field.key,
                  rows(field.key).filter((_, i) => i !== index),
                )
              "
              >删除{{ field.label }}{{ index + 1 }}</VBtn
            >
          </li>
        </ol>
        <VBtn
          type="button"
          variant="tonal"
          :disabled="disabled || field.readonly || !!editing"
          @click="begin(field, -1)"
          >新增{{ field.label }}</VBtn
        >
      </fieldset>
      <fieldset
        v-else-if="field.type === 'date-range'"
        :disabled="disabled || field.readonly"
        class="zerp-field-group"
      >
        <legend class="text-subtitle-1">{{ field.label }}</legend>
        <div class="zerp-date-range">
          <VTextField
            v-for="(suffix, index) in ['起', '止']"
            :key="suffix"
            v-bind="control(field)"
            :label="field.label + suffix"
            :aria-label="field.label + suffix"
            :type="field.readonly ? 'text' : 'date'"
            :model-value="range(field.key)[index] ?? ''"
            @update:model-value="setRange(field.key, index, $event)"
          />
        </div>
      </fieldset>
      <VTextarea
        v-else-if="field.type === 'textarea'"
        v-bind="control(field)"
        :model-value="values[field.key] as string"
        @update:model-value="set(field.key, $event)"
      />
      <VSelect
        v-else-if="field.type === 'enum' || field.type === 'multi-enum'"
        v-bind="control(field)"
        :multiple="field.type === 'multi-enum'"
        :model-value="values[field.key]"
        :items="
          field.type === 'multi-enum'
            ? options(field)
            : [
                { value: '', label: '请选择', historical: false },
                ...options(field),
              ]
        "
        item-title="label"
        item-value="value"
        :item-props="(item) => ({ disabled: item.historical })"
        @update:model-value="set(field.key, $event)"
      />
      <VCheckbox
        v-else-if="field.type === 'boolean'"
        v-bind="control(field)"
        :model-value="values[field.key] as boolean | null"
        @update:model-value="set(field.key, $event)"
      />
      <VTextField
        v-else
        v-bind="control(field)"
        :type="
          field.type === 'password'
            ? 'password'
            : field.type === 'date' && !field.readonly
              ? 'date'
              : 'text'
        "
        :inputmode="
          field.type === 'decimal'
            ? 'decimal'
            : field.type === 'integer'
              ? 'numeric'
              : undefined
        "
        :model-value="
          field.type === 'integer'
            ? (integerInput[field.key] ?? values[field.key] ?? '')
            : (values[field.key] ?? '')
        "
        @update:model-value="input(field, $event)"
      />
      <div
        :id="`${formId}-${field.key}-messages`"
        class="zerp-field-messages text-caption text-error"
        aria-live="polite"
      >
        {{ errors(field).join("；") }}
      </div>
    </div>
    <VCard v-if="editing" aria-label="编辑子项" variant="outlined">
      <VCardText
        ><DynamicForm
          :fields="editing.fields"
          :model-value="editing.value"
          :scope="scope"
          :disabled="disabled"
          :mode="mode"
          @update:model-value="editing = { ...editing!, value: $event }"
          @validation="childInvalid = !$event.valid"
          @pending="
            childPending = $event;
            pending('$child', $event);
          "
      /></VCardText>
      <VCardActions
        ><VBtn
          type="button"
          color="primary"
          variant="flat"
          :disabled="disabled || childPending || childInvalid"
          @click="confirm"
          >确定子项</VBtn
        >
        <VBtn type="button" :disabled="disabled" @click="cancelEditing"
          >取消子项</VBtn
        ></VCardActions
      >
    </VCard>
  </div>
</template>
