<script setup lang="ts">
import { VAutocomplete, VBtn, VListItem } from "vuetify/components";
import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue";
import type { ReferenceAdapter, ReferenceValue } from "./contracts";
import { message } from "./clone";
import {
  readReferenceDirectory,
  clearReferenceDirectory,
} from "./reference-directory";
const props = defineProps<{
  adapter: ReferenceAdapter;
  modelValue: ReferenceValue | readonly ReferenceValue[] | null;
  scope: string;
  label: string;
  parent?: ReferenceValue | null;
  multiple?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  descriptionId?: string;
  invalid?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [
    value: ReferenceValue | readonly ReferenceValue[] | null,
  ];
  pending: [value: boolean];
}>();
const disabled = computed(() => props.disabled || !!props.disabledReason);
const open = ref(false),
  search = ref(""),
  keyword = ref(""),
  page = ref(1),
  busy = ref(false),
  error = ref("");
const candidates = shallowRef<readonly ReferenceValue[]>([]);
const selected = computed<readonly ReferenceValue[]>(() =>
  Array.isArray(props.modelValue)
    ? props.modelValue
    : props.modelValue
      ? [props.modelValue as ReferenceValue]
      : [],
);
const shown = computed(() =>
  selected.value.map((value) => ({
    ...value,
    label:
      (value.label && value.label !== value.id ? value.label : "") ||
      candidates.value.find((item) => item.id === value.id)?.label ||
      value.id,
  })),
);
const filtered = computed(() =>
  candidates.value.filter((value) =>
    value.label
      .toLocaleLowerCase()
      .includes(keyword.value.trim().toLocaleLowerCase()),
  ),
);
const items = computed(() => {
  const result = filtered.value.slice((page.value - 1) * 20, page.value * 20);
  for (const value of shown.value)
    if (!result.some((item) => item.id === value.id))
      result.push({ ...value, selectable: false });
  return result;
});
let version = 0,
  active = true;
let release: (() => void) | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(timer);
  if (
    !props.multiple &&
    shown.value.some((item) => item.label === value || item.id === value)
  ) {
    keyword.value = "";
    page.value = 1;
    return;
  }
  timer = setTimeout(() => {
    keyword.value = value;
    page.value = 1;
  }, 150);
});
async function load() {
  if (
    props.disabledReason ||
    (disabled.value &&
      !selected.value.some((value) => !value.label || value.label === value.id))
  )
    return;
  const request = ++version;
  release?.();
  const lease = readReferenceDirectory(
    props.adapter,
    props.scope,
    props.parent,
  );
  release = lease.release;
  busy.value = true;
  error.value = "";
  try {
    const values = await lease.value;
    if (active && request === version) candidates.value = values;
  } catch (cause) {
    if (active && request === version) error.value = message(cause);
  } finally {
    lease.release();
    if (active && request === version) busy.value = false;
  }
}
watch(open, (value) => {
  if (value) void load();
});
watch(
  () =>
    selected.value.some((value) => !value.label || value.label === value.id),
  (needed) => {
    if (needed) void load();
  },
  { immediate: true },
);
watch(disabled, (value) => {
  if (value) open.value = false;
});
watch(
  () =>
    [
      props.scope,
      props.adapter.directory,
      JSON.stringify(props.adapter.dependencies ?? []),
      props.parent?.id,
    ] as const,
  (value, previous) => {
    if (value.every((item, index) => item === previous[index])) return;
    version++;
    release?.();
    clearReferenceDirectory(
      {
        ...props.adapter,
        directory: previous[1],
        dependencies: JSON.parse(previous[2]),
      },
      previous[0],
      previous[3] ? { id: previous[3], label: "" } : null,
    );
    open.value = false;
    candidates.value = [];
    busy.value = false;
    error.value = "";
    search.value = keyword.value = "";
    page.value = 1;
  },
);
function choose(value: ReferenceValue | readonly ReferenceValue[] | null) {
  if (disabled.value) return;
  const values = Array.isArray(value) ? value : value ? [value] : [];
  if (
    values.some(
      (item) =>
        item.selectable === false &&
        !selected.value.some((previous) => previous.id === item.id),
    )
  )
    return;
  emit("update:modelValue", value);
  if (!props.multiple) open.value = false;
}
onBeforeUnmount(() => {
  active = false;
  version++;
  release?.();
  clearTimeout(timer);
});
</script>
<template>
  <VAutocomplete
    v-model:menu="open"
    v-model:search="search"
    class="zerp-reference"
    :label="label"
    :aria-label="label"
    :model-value="multiple ? shown : (shown[0] ?? null)"
    :items="items"
    item-title="label"
    item-value="id"
    :item-props="(item) => ({ disabled: item.selectable === false })"
    return-object
    no-filter
    :multiple="multiple"
    :chips="multiple"
    :closable-chips="multiple"
    clearable
    :disabled="disabled"
    :loading="busy"
    :error="invalid || !!error"
    :error-messages="error"
    :messages="disabledReason"
    :aria-describedby="descriptionId"
    :aria-invalid="invalid || error ? 'true' : undefined"
    :menu-props="{ maxHeight: 360 }"
    @click:control="open = !disabled"
    @update:model-value="choose"
  >
    <template #append-item>
      <VListItem v-if="error"
        ><VBtn @click.stop="load">重试引用</VBtn></VListItem
      >
      <VListItem v-if="filtered.length > 20" class="zerp-reference-pagination">
        <VBtn :disabled="page === 1" @click.stop="page--">上一页引用</VBtn>
        <span aria-label="引用当前页">{{ page }}</span>
        <VBtn :disabled="page * 20 >= filtered.length" @click.stop="page++"
          >下一页引用</VBtn
        >
      </VListItem>
    </template>
  </VAutocomplete>
</template>
