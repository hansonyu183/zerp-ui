<script setup lang="ts" generic="T extends object">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue";
import type { AnyField, Fields, ReferenceValue } from "./contracts";
import ReferencePicker from "./ReferencePicker.vue";
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
const integerInput = ref<Record<string, string>>({});
function input(field: AnyField, target: HTMLInputElement) {
  if (field.type === "integer") {
    integerInput.value[field.key] = target.value;
    const valid =
      /^-?\d+$/.test(target.value) &&
      Number.isSafeInteger(Number(target.value));
    pending("$integer:" + field.key, !valid && target.value !== "");
    if (valid || target.value === "")
      set(field.key, target.value === "" ? null : Number(target.value));
  } else
    set(field.key, field.type === "boolean" ? target.checked : target.value);
}
const editing = shallowRef<{
  key: string;
  index: number;
  value: object;
  fields: readonly AnyField[];
} | null>(null);
const childPending = ref(false),
  sources = new Set<string>();
function pending(key: string, busy: boolean) {
  if (busy) sources.add(key);
  else sources.delete(key);
  emit("pending", sources.size > 0);
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
function rows(key: string) {
  return (values.value[key] ?? []) as object[];
}
function begin(field: Extract<AnyField, { type: "rows" }>, index: number) {
  childPending.value = false;
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
  if (!e || props.disabled || childPending.value) return;
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
    sources.clear();
    integerInput.value = {};
    emit("pending", false);
  },
);
watch(visible, (fields) => {
  const keys = new Set(fields.map((field) => field.key));
  for (const key of sources)
    if (key.startsWith("$integer:") && !keys.has(key.slice(9)))
      sources.delete(key);
  emit("pending", sources.size > 0);
});
onBeforeUnmount(() => emit("pending", false));
</script>
<template>
  <div class="zerp-form">
    <template v-for="field in visible" :key="field.key">
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
        @update:model-value="set(field.key, $event)"
        @pending="pending(field.key, $event)" />
      <fieldset
        v-else-if="field.type === 'rows'"
        :disabled="disabled || field.readonly"
      >
        <legend>{{ field.label }}</legend>
        <ol>
          <li v-for="(row, index) in rows(field.key)" :key="index">
            <span>{{ JSON.stringify(row) }}</span
            ><button
              type="button"
              :disabled="!!editing"
              @click="begin(field, index)"
            >
              编辑{{ field.label }}{{ index + 1 }}</button
            ><button
              type="button"
              :disabled="!!editing"
              @click="
                set(
                  field.key,
                  rows(field.key).filter((_, i) => i !== index),
                )
              "
            >
              删除{{ field.label }}{{ index + 1 }}
            </button>
          </li>
        </ol>
        <button type="button" :disabled="!!editing" @click="begin(field, -1)">
          新增{{ field.label }}
        </button>
      </fieldset>
      <fieldset
        v-else-if="field.type === 'date-range'"
        :disabled="disabled || field.readonly"
      >
        <legend>{{ field.label }}</legend>
        <label v-for="(suffix, index) in ['起', '止']" :key="suffix"
          >{{ field.label + suffix }}
          <input
            type="date"
            :aria-label="field.label + suffix"
            :value="range(field.key)[index] ?? ''"
            @input="
              setRange(
                field.key,
                index,
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </label>
      </fieldset>
      <label v-else
        >{{ field.label
        }}<textarea
          v-if="field.type === 'textarea'"
          :aria-label="field.label"
          :disabled="disabled || field.readonly"
          :value="values[field.key] as string"
          @input="set(field.key, ($event.target as HTMLTextAreaElement).value)"
        />
        <select
          v-else-if="field.type === 'enum' || field.type === 'multi-enum'"
          :multiple="field.type === 'multi-enum'"
          :aria-label="field.label"
          :disabled="disabled || field.readonly"
          :value="values[field.key]"
          @change="
            set(
              field.key,
              field.type === 'multi-enum'
                ? Array.from(
                    ($event.target as HTMLSelectElement).selectedOptions,
                    (option) => option.value,
                  )
                : ($event.target as HTMLSelectElement).value,
            )
          "
        >
          <option value="">请选择</option>
          <option
            v-for="option in field.options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <input
          v-else
          :type="
            field.type === 'boolean'
              ? 'checkbox'
              : field.type === 'password'
                ? 'password'
                : field.type === 'date'
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
          :aria-label="field.label"
          :disabled="disabled || field.readonly"
          :checked="values[field.key] === true"
          :value="
            field.type === 'integer'
              ? (integerInput[field.key] ?? values[field.key] ?? '')
              : (values[field.key] ?? '')
          "
          @input="input(field, $event.target as HTMLInputElement)"
        /> </label
    ></template>
    <section v-if="editing" role="dialog" aria-label="编辑子项">
      <DynamicForm
        :fields="editing.fields"
        :model-value="editing.value"
        :scope="scope"
        :disabled="disabled"
        :mode="mode"
        @update:model-value="editing = { ...editing!, value: $event }"
        @pending="
          childPending = $event;
          pending('$child', $event);
        "
      /><button
        type="button"
        :disabled="disabled || childPending"
        @click="confirm"
      >
        确定子项</button
      ><button type="button" :disabled="disabled" @click="cancelEditing">
        取消子项
      </button>
    </section>
  </div>
</template>
