<script setup lang="ts">
import {
  VTextField,
  VBtn,
  VList,
  VListItem,
  VProgressLinear,
} from "vuetify/components";
import Feedback from "./Feedback.vue";
import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue";
import type { ReferenceAdapter, ReferenceValue, Page } from "./contracts";
import { message } from "./clone";
const props = defineProps<{
  adapter: ReferenceAdapter;
  modelValue: ReferenceValue | readonly ReferenceValue[] | null;
  scope: string;
  label: string;
  parent?: ReferenceValue | null;
  multiple?: boolean;
  disabled?: boolean;
  descriptionId?: string;
  invalid?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [
    value: ReferenceValue | readonly ReferenceValue[] | null,
  ];
  pending: [value: boolean];
}>();
const keyword = ref(""),
  page = ref(1),
  result = shallowRef<Page<ReferenceValue>>({ items: [], total: 0 }),
  searchError = ref(""),
  resolveError = ref(""),
  busy = ref(false);
const error = computed(() =>
  [searchError.value, resolveError.value].filter(Boolean).join("；"),
);
const selected = computed<readonly ReferenceValue[]>(() =>
  Array.isArray(props.modelValue)
    ? props.modelValue
    : props.modelValue
      ? [props.modelValue as ReferenceValue]
      : [],
);
const resolved = shallowRef<readonly ReferenceValue[]>([]);
const shown = computed(() =>
  selected.value.map((v) => ({
    ...resolved.value.find((r) => r.id === v.id),
    ...v,
  })),
);
let searchVersion = 0,
  resolveVersion = 0,
  active = true;
const more = computed(() =>
  result.value.total !== undefined
    ? page.value * 20 < result.value.total
    : result.value.hasMore,
);
async function search(next = 1) {
  const version = ++searchVersion;
  page.value = next;
  busy.value = true;
  searchError.value = "";
  try {
    const value = await props.adapter.search({
      scope: props.scope,
      keyword: keyword.value,
      parent: props.parent,
      page: next,
      pageSize: 20,
    });
    if (active && version === searchVersion) result.value = value;
  } catch (e) {
    if (active && version === searchVersion) searchError.value = message(e);
  } finally {
    if (active && version === searchVersion) busy.value = false;
  }
}
async function resolve() {
  const version = ++resolveVersion;
  emit("pending", true);
  resolveError.value = "";
  try {
    const value = await props.adapter.resolve({
      scope: props.scope,
      parent: props.parent,
      ids: selected.value.map((v) => v.id),
    });
    if (active && version === resolveVersion) resolved.value = value;
  } catch (e) {
    if (active && version === resolveVersion) resolveError.value = message(e);
  } finally {
    if (active && version === resolveVersion) emit("pending", false);
  }
}
function choose(value: ReferenceValue) {
  if (props.disabled || value.selectable === false) return;
  emit(
    "update:modelValue",
    props.multiple
      ? [...selected.value.filter((v) => v.id !== value.id), value]
      : value,
  );
}
function remove(id: string) {
  if (!props.disabled)
    emit(
      "update:modelValue",
      props.multiple ? selected.value.filter((v) => v.id !== id) : null,
    );
}
watch(
  () => [props.scope, props.adapter, props.parent],
  () => {
    searchVersion++;
    resolveVersion++;
    resolved.value = [];
    result.value = { items: [], total: 0 };
    page.value = 1;
    void search();
    void resolve();
  },
  { immediate: true },
);
watch(
  () => props.modelValue,
  () => void resolve(),
);
onBeforeUnmount(() => {
  active = false;
  searchVersion++;
  resolveVersion++;
  emit("pending", false);
});
</script>
<template>
  <fieldset
    class="zerp-reference zerp-field-group"
    :disabled="disabled"
    :aria-describedby="descriptionId"
    :aria-invalid="invalid ? 'true' : undefined"
  >
    <legend class="text-subtitle-1">{{ label }}</legend>
    <VList aria-label="已选引用" density="compact">
      <VListItem
        v-for="value in shown"
        :key="value.id"
        :title="value.label"
        :subtitle="
          value.selectable === false ? '不可选（保留历史选择）' : undefined
        "
      >
        <template #append
          ><VBtn
            type="button"
            variant="text"
            :disabled="disabled"
            :aria-label="`移除${value.label}`"
            @click="remove(value.id)"
            >移除</VBtn
          ></template
        >
      </VListItem>
    </VList>
    <div class="zerp-reference-search">
      <VTextField
        v-model="keyword"
        :label="`${label}搜索`"
        :aria-label="`${label}搜索`"
        :aria-describedby="descriptionId"
        :aria-invalid="invalid ? 'true' : undefined"
        :disabled="disabled"
        hide-details
        @keydown.enter.prevent="search()"
      />
      <VBtn
        type="button"
        variant="tonal"
        :disabled="disabled || busy"
        @click="search()"
        >搜索引用</VBtn
      >
    </div>
    <Feedback :message="error" kind="error"
      ><VBtn
        type="button"
        variant="text"
        :disabled="disabled || busy"
        @click="
          search();
          resolve();
        "
        >重试引用</VBtn
      ></Feedback
    >
    <div
      class="zerp-reference-progress"
      role="status"
      :aria-label="busy ? '加载中' : undefined"
    >
      <VProgressLinear :indeterminate="busy" :active="busy" />
    </div>
    <VList :aria-label="`${label}候选`">
      <VListItem v-for="item in result.items" :key="item.id">
        <VBtn
          type="button"
          variant="text"
          :disabled="disabled || item.selectable === false || busy"
          @click="choose(item)"
          >{{ item.label }}</VBtn
        >
      </VListItem>
    </VList>
    <div class="zerp-reference-pagination">
      <VBtn
        type="button"
        variant="text"
        :disabled="disabled || page === 1 || busy"
        @click="search(page - 1)"
        >上一页引用</VBtn
      >
      <span aria-label="引用当前页">{{ page }}</span>
      <VBtn
        type="button"
        variant="text"
        :disabled="disabled || !more || busy"
        @click="search(page + 1)"
        >下一页引用</VBtn
      >
    </div>
  </fieldset>
</template>
