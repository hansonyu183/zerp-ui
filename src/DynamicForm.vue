<script setup lang="ts" generic="T extends object">
import {
  computed,
  ref,
  watch,
  watchEffect,
  onBeforeUnmount,
  useId,
  nextTick,
} from "vue";
import { arrayFields } from "./model-array-fields";
import type { AnyField, Fields, ReferenceValue, FieldGroup } from "./contracts";
import {
  VTabs,
  VTab,
  VTextField,
  VTextarea,
  VSelect,
  VCheckbox,
  VBtn,
} from "vuetify/components";
import { fieldEnabled, type FormField } from "./form-field";
import FieldFeedback from "./FieldFeedback.vue";
import { groupFields } from "./details";
import ReferencePicker from "./ReferencePicker.vue";
import { validateFields, type FormValidationState } from "./validation";
import { clone } from "./clone";
import { valueAt, setValueAt } from "./business-type";
import { equalValues } from "./editor-values";
const props = defineProps<{
  fields: Fields<T>;
  groups?: readonly FieldGroup<T>[];
  modelValue: T;
  scope: string;
  disabled?: boolean;
  mode?: "create" | "edit";
  purpose?: "filter" | "edit" | "short";
  focusField?: { key: string; version: number };
  issues?: readonly { key: string; message: string }[];
}>();
const emit = defineEmits<{
  "update:modelValue": [value: T];
  pending: [value: boolean];
  validation: [value: FormValidationState<T>];
}>();
const values = computed(() => ({
  ...props.modelValue,
  ...Object.fromEntries(
    (props.fields as readonly AnyField[]).map((field) => [
      field.key,
      valueAt(props.modelValue, field.key),
    ]),
  ),
}));
const visible = computed(() =>
  (props.fields as readonly FormField[]).filter(
    (f) =>
      (!f.mode || f.mode === props.mode) &&
      (!f.when || valueAt(props.modelValue, f.when.key) === f.when.equals),
  ),
);
const groups = computed(() => groupFields(visible.value, props.groups));
const selectedGroup = ref<string>();
watch(
  groups,
  (next) => {
    if (!next.some((group) => group.key === selectedGroup.value))
      selectedGroup.value = next[0]?.key;
  },
  { immediate: true },
);
function groupIssueCount(fields: readonly FormField[]) {
  const keys = new Set<string>(
    validation.value.issues.map((issue) => String(issue.key)),
  );
  for (const source of sources.value) keys.add(sourceField(source));
  for (const issue of props.issues ?? []) keys.add(issue.key);
  return fields.filter((field) => keys.has(field.key)).length;
}
function set(key: string, value: unknown) {
  if (props.disabled) return;
  const next = clone(props.modelValue);
  setValueAt(next, key, value);
  const changed = [key],
    seen = new Set(changed);
  for (const parent of changed)
    for (const field of props.fields as readonly AnyField[]) {
      if (
        (field.type === "reference" || field.type === "references") &&
        field.parentKey === parent &&
        !seen.has(field.key)
      ) {
        setValueAt(next, field.key, field.type === "reference" ? null : []);
        changed.push(field.key);
        seen.add(field.key);
      }
    }
  if (props.fields.some((field) => field.key === key && field.type === "rows"))
    emittedRows.set(key, value);
  emit("update:modelValue", next as T);
}
const formId = useId();
const focusedField = ref<string | null>(null);
function blurField(event: FocusEvent) {
  if (
    !(event.currentTarget as HTMLElement).contains(
      event.relatedTarget as Node | null,
    )
  )
    focusedField.value = null;
}
function errors(field: AnyField) {
  return [
    ...new Set(
      [...validation.value.issues, ...(props.issues ?? [])]
        .filter((issue) => issue.key === field.key)
        .map((issue) => issue.message),
    ),
  ];
}
const root = ref<HTMLElement>();
watch(
  () => props.focusField,
  async (request) => {
    if (!request || !visible.value.some((field) => field.key === request.key))
      return;
    selectedGroup.value = groups.value.find((group) =>
      group.fields.some((field) => field.key === request.key),
    )?.key;
    await nextTick();
    if (props.focusField !== request || props.disabled) return;
    const element = [
      ...(root.value?.querySelectorAll<HTMLElement>("[data-field]") ?? []),
    ].find((element) => element.dataset.field === request.key);
    element
      ?.querySelector<HTMLElement>(
        'input[type="password"]:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
      )
      ?.focus();
  },
  { immediate: true, flush: "post" },
);
const referenceStates = computed(() =>
  Object.fromEntries(
    (props.fields as readonly AnyField[])
      .filter(
        (field) => field.type === "reference" || field.type === "references",
      )
      .map((field) => {
        if (field.type !== "reference" && field.type !== "references")
          throw Error("引用字段无效。");
        const value = values.value[field.key];
        const wrap = (id: unknown): ReferenceValue => ({
          id: String(id),
          label: "",
        });
        const parent = field.parentKey
          ? valueAt(props.modelValue, field.parentKey)
          : undefined;
        return [
          field.key,
          {
            value:
              field.valueMode === "id"
                ? Array.isArray(value)
                  ? value.map(wrap)
                  : value == null || value === ""
                    ? null
                    : wrap(value)
                : ((value ?? null) as ReferenceValue | ReferenceValue[] | null),
            parent:
              typeof parent === "string"
                ? wrap(parent)
                : (parent as ReferenceValue | null | undefined),
          },
        ];
      }),
  ),
);
function reference(
  field: Extract<AnyField, { type: "reference" | "references" }>,
) {
  return referenceStates.value[field.key]!.value;
}
function updateReference(
  field: Extract<AnyField, { type: "reference" | "references" }>,
  value: ReferenceValue | readonly ReferenceValue[] | null,
) {
  set(
    field.key,
    field.valueMode === "id"
      ? Array.isArray(value)
        ? value.map((item) => item.id)
        : value
          ? (value as ReferenceValue).id
          : null
      : value,
  );
}
function control(field: FormField) {
  return {
    label: field.label,
    "aria-label": field.label,
    disabled:
      props.disabled ||
      field.readonly ||
      !fieldEnabled(field, props.modelValue),
    density: "compact" as const,
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
const sources = ref(new Set<string>());
const rowKeys = new Map<string, number[]>();
const emittedRows = new Map<string, unknown>();
let nextRowKey = 0;
function sourceField(source: string) {
  return source.replace(/^\$integer:/, "").replace(/^\$row:(.*):\d+$/, "$1");
}
const validation = computed(() =>
  validateFields(props.fields, props.modelValue, props.mode ?? "edit"),
);
const hasPending = computed(() =>
  [...sources.value].some((key) => {
    const field = (props.fields as readonly FormField[]).find(
      (f) => f.key === sourceField(key),
    );
    return !field || fieldEnabled(field, props.modelValue);
  }),
);
watchEffect(() => {
  emit("validation", { ...validation.value, pending: hasPending.value });
});
watch(hasPending, (value) => emit("pending", value), { flush: "sync" });
function pending(key: string, busy: boolean) {
  if (busy) sources.value.add(key);
  else sources.value.delete(key);
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
function rowEntries(key: string) {
  const values = rows(key);
  let keys = rowKeys.get(key);
  if (!keys) rowKeys.set(key, (keys = []));
  while (keys.length < values.length) keys.push(nextRowKey++);
  keys.length = values.length;
  return values.map((value, index) => ({ value, id: keys[index] }));
}
function writable(field: AnyField) {
  return (
    !props.disabled && !field.readonly && fieldEnabled(field, props.modelValue)
  );
}
function updateRow(field: AnyField, id: number, value: object) {
  const index = rowKeys.get(field.key)?.indexOf(id) ?? -1;
  if (!writable(field) || index < 0) return;
  const next = [...rows(field.key)];
  next[index] = value;
  set(field.key, next);
}
function removeRow(field: AnyField, id: number) {
  const keys = rowKeys.get(field.key);
  const index = keys?.indexOf(id) ?? -1;
  if (!writable(field) || index < 0) return;
  keys!.splice(index, 1);
  pending(`$row:${field.key}:${id}`, false);
  set(
    field.key,
    rows(field.key).filter((_, i) => i !== index),
  );
}
function rowPending(key: string, id: number, busy: boolean) {
  if (rowKeys.get(key)?.includes(id)) pending(`$row:${key}:${id}`, busy);
}
watch(
  () => [props.scope, props.fields, props.mode],
  () => {
    selectedGroup.value = groups.value[0]?.key;
    rowKeys.clear();
    emittedRows.clear();
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
      if (field.type === "rows") {
        const emitted = emittedRows.get(field.key);
        emittedRows.delete(field.key);
        if (
          !equalValues(current[field.key], previous[field.key]) &&
          !equalValues(current[field.key], emitted)
        ) {
          rowKeys.delete(field.key);
          for (const source of sources.value)
            if (source.startsWith(`$row:${field.key}:`))
              sources.value.delete(source);
        }
      }
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
});
onBeforeUnmount(() => emit("pending", false));
</script>
<template>
  <div ref="root" class="zerp-form-container">
    <VTabs
      v-if="groups.length > 1"
      v-model="selectedGroup"
      aria-label="资料分组"
      show-arrows
    >
      <VTab
        v-for="(group, index) in groups"
        :key="group.key"
        :value="group.key"
        :id="`${formId}-tab-${index}`"
        :aria-controls="`${formId}-panel-${index}`"
        :aria-label="group.label"
        :aria-describedby="
          groupIssueCount(group.fields)
            ? `${formId}-issues-${index}`
            : undefined
        "
      >
        {{ group.label }}
        <span
          v-if="groupIssueCount(group.fields)"
          :id="`${formId}-issues-${index}`"
          class="text-error ms-1"
          >{{ groupIssueCount(group.fields) }}项待完善</span
        >
      </VTab>
    </VTabs>
    <section
      v-for="(group, index) in groups"
      :key="group.key"
      v-show="groups.length < 2 || group.key === selectedGroup"
      :class="{ 'zerp-form-panel': groups.length > 1 }"
      :id="`${formId}-panel-${index}`"
      :role="groups.length > 1 ? 'tabpanel' : undefined"
      :aria-labelledby="
        groups.length > 1 ? `${formId}-tab-${index}` : undefined
      "
    >
      <div class="zerp-form" :class="`zerp-form--${purpose ?? 'edit'}`">
        <template v-for="(field, fieldIndex) in group.fields" :key="field.key">
          <h3
            v-if="
              field.section &&
              group.fields[fieldIndex - 1]?.section?.key !== field.section.key
            "
            class="zerp-form-section-title"
          >
            {{ field.section.label }}
          </h3>
          <div
            :data-field="field.key"
            class="zerp-form-field"
            :class="{
              'zerp-form-field--wide':
                field.type === 'textarea' || field.type === 'rows',
              'zerp-form-field--enabled': !!field.enabledBy,
            }"
          >
            <VCheckbox
              v-if="field.enabledBy"
              class="zerp-field-enable"
              density="compact"
              hide-details
              :label="field.enabledBy.label"
              :aria-label="field.enabledBy.label"
              :model-value="values[field.enabledBy.key] === true"
              :disabled="disabled || field.enabledBy.readonly"
              @update:model-value="set(field.enabledBy.key, $event === true)"
            />
            <div
              class="zerp-field-input"
              @focusin="focusedField = field.key"
              @focusout="blurField"
            >
              <ReferencePicker
                v-if="field.type === 'reference' || field.type === 'references'"
                :adapter="field.adapter"
                :disabled-reason="field.disabledReason"
                :parent="referenceStates[field.key]?.parent"
                :model-value="reference(field)"
                :hierarchical="field.hierarchical"
                :scope="scope"
                :label="field.label"
                :multiple="field.type === 'references'"
                :disabled="
                  disabled || field.readonly || !fieldEnabled(field, modelValue)
                "
                :description-id="`${formId}-${field.key}-messages`"
                :invalid="errors(field).length > 0"
                @update:model-value="updateReference(field, $event)"
                @pending="pending(field.key, $event)"
              />
              <fieldset
                v-else-if="field.type === 'rows'"
                :disabled="
                  disabled || field.readonly || !fieldEnabled(field, modelValue)
                "
                class="zerp-field-group"
              >
                <legend>{{ field.label }}</legend>
                <section
                  v-for="(row, index) in rowEntries(field.key)"
                  :key="row.id"
                  :aria-label="`${field.label} ${index + 1}`"
                  class="zerp-form-row"
                >
                  <DynamicForm
                    :fields="arrayFields(field, row.value)"
                    :model-value="row.value"
                    :scope="scope"
                    :mode="mode"
                    :disabled="!writable(field)"
                    @update:model-value="updateRow(field, row.id, $event)"
                    @pending="rowPending(field.key, row.id, $event)"
                  />
                  <VBtn
                    type="button"
                    variant="text"
                    color="error"
                    :disabled="!writable(field)"
                    @click="removeRow(field, row.id)"
                    >删除{{ field.label }} {{ index + 1 }}</VBtn
                  >
                </section>
                <VBtn
                  type="button"
                  variant="tonal"
                  :disabled="!writable(field)"
                  @click="
                    set(field.key, [...rows(field.key), clone(field.empty())])
                  "
                  >新增</VBtn
                >
              </fieldset>
              <fieldset
                v-else-if="field.type === 'date-range'"
                :disabled="
                  disabled || field.readonly || !fieldEnabled(field, modelValue)
                "
                class="zerp-field-group"
              >
                <legend>{{ field.label }}</legend>
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
              <div v-else-if="field.type === 'secret'">
                <VSelect
                  v-bind="control(field)"
                  :model-value="
                    values[field.key] === undefined
                      ? 'keep'
                      : values[field.key] === null
                        ? 'clear'
                        : 'replace'
                  "
                  :items="[
                    { title: '保留', value: 'keep' },
                    { title: '修改', value: 'replace' },
                    { title: '清除', value: 'clear' },
                  ]"
                  @update:model-value="
                    set(
                      field.key,
                      $event === 'keep'
                        ? undefined
                        : $event === 'clear'
                          ? null
                          : '',
                    )
                  "
                />
                <VTextField
                  v-if="
                    values[field.key] !== undefined &&
                    values[field.key] !== null
                  "
                  v-bind="control(field)"
                  :label="`新的${field.label}`"
                  :aria-label="`新的${field.label}`"
                  type="password"
                  autocomplete="new-password"
                  :maxlength="field.maxLength"
                  :model-value="values[field.key] ?? ''"
                  @update:model-value="set(field.key, $event)"
                />
              </div>
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
              <FieldFeedback
                :key="scope"
                :id="`${formId}-${field.key}-messages`"
                :label="field.label"
                :messages="errors(field)"
                :focused="focusedField === field.key"
              />
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.zerp-form-section-title {
  grid-column: 1 / -1;
  font: inherit;
  font-weight: 600;
  margin: 0.75rem 0 0;
}
</style>
