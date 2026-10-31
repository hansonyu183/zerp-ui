<script setup lang="ts">
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
  <fieldset class="zerp-reference" :disabled="disabled">
    <legend>{{ label }}</legend>
    <ul aria-label="已选引用">
      <li v-for="value in shown" :key="value.id">
        {{ value.label
        }}<span v-if="value.selectable === false">（不可选）</span
        ><button
          type="button"
          :aria-label="`移除${value.label}`"
          @click="remove(value.id)"
        >
          移除
        </button>
      </li>
    </ul>
    <input
      v-model="keyword"
      :aria-label="`${label}搜索`"
      @keydown.enter.prevent="search()"
    /><button type="button" @click="search()">搜索引用</button>
    <Feedback :message="error" kind="error"
      ><button
        type="button"
        @click="
          search();
          resolve();
        "
      >
        重试引用
      </button>
    </Feedback>
    <Feedback :message="busy ? '加载中' : undefined" persistent />
    <ul>
      <li v-for="item in result.items" :key="item.id">
        <button
          type="button"
          :disabled="item.selectable === false || busy"
          @click="choose(item)"
        >
          {{ item.label }}
        </button>
      </li>
    </ul>
    <button
      type="button"
      :disabled="page === 1 || busy"
      @click="search(page - 1)"
    >
      上一页引用</button
    ><span>{{ page }}</span
    ><button type="button" :disabled="!more || busy" @click="search(page + 1)">
      下一页引用
    </button>
  </fieldset>
</template>
