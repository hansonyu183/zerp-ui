<script setup lang="ts">
import {
  VTextField,
  VBtn,
  VList,
  VListItem,
  VProgressLinear,
  VMenu,
  VDialog,
  VCard,
  VCardTitle,
  VCardText,
  VCardActions,
} from "vuetify/components";
import { useDisplay } from "vuetify";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
import FeedbackHost from "./FeedbackHost.vue";
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
  hierarchical?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  descriptionId?: string;
  invalid?: boolean;
}>();
const disabled = computed(() => props.disabled || !!props.disabledReason);
const emit = defineEmits<{
  "update:modelValue": [
    value: ReferenceValue | readonly ReferenceValue[] | null,
  ];
  pending: [value: boolean];
}>();
const { xs } = useDisplay();
const open = ref(false);
const summary = computed(() =>
  shown.value.length > 1
    ? `${shown.value[0]!.label} 等 ${shown.value.length} 项`
    : (shown.value[0]?.label ?? ""),
);
watch(
  () => disabled.value,
  (disabled) => {
    if (disabled) open.value = false;
  },
);
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
const ancestry = ref<ReferenceValue[]>([]);
const shown = computed(() =>
  selected.value.map((v) => ({
    ...resolved.value.find((r) => r.id === v.id),
    ...v,
    label: v.label || resolved.value.find((r) => r.id === v.id)?.label || v.id,
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
      ...(props.hierarchical
        ? { ancestor: ancestry.value.at(-1) ?? null }
        : {}),
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
function browse(value?: ReferenceValue) {
  if (disabled.value || busy.value) return;
  if (value) ancestry.value.push(value);
  else ancestry.value.pop();
  keyword.value = "";
  void search();
}
function choose(value: ReferenceValue) {
  if (disabled.value || value.selectable === false) return;
  emit(
    "update:modelValue",
    props.multiple
      ? [...selected.value.filter((v) => v.id !== value.id), value]
      : value,
  );
  if (!props.multiple) open.value = false;
}
function remove(id: string) {
  if (!disabled.value)
    emit(
      "update:modelValue",
      props.multiple ? selected.value.filter((v) => v.id !== id) : null,
    );
}
watch(
  () => [props.scope, props.adapter, props.parent],
  () => {
    open.value = false;
    searchVersion++;
    resolveVersion++;
    resolved.value = [];
    result.value = { items: [], total: 0 };
    page.value = 1;
    ancestry.value = [];
    if (!disabled.value) void search();
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
  <div class="zerp-reference">
    <component
      :is="xs ? VDialog : VMenu"
      v-model="open"
      :disabled="disabled"
      :aria-label="xs ? `选择${label}` : undefined"
      :close-on-content-click="false"
      location="bottom start"
      :max-width="xs ? 'calc(100vw - 1rem)' : 480"
    >
      <template #activator="{ props: activator }">
        <VTextField
          v-bind="activator"
          :label="label"
          :aria-label="label"
          :model-value="summary"
          readonly
          :disabled="disabled"
          :error="invalid || !!error"
          :aria-invalid="invalid || error ? 'true' : undefined"
          :aria-describedby="descriptionId"
          :messages="disabledReason"
          :hide-details="!disabledReason"
          density="compact"
          append-inner-icon="mdi-menu-down"
          role="combobox"
          aria-haspopup="dialog"
          :aria-expanded="open"
          @keydown.enter.stop.prevent="open = true"
          @keydown.space.stop.prevent="open = true"
        />
      </template>
      <VCard
        class="zerp-reference-panel"
        :role="xs ? undefined : 'dialog'"
        :aria-label="`选择${label}`"
      >
        <FeedbackHost>
          <VCardTitle>选择{{ label }}</VCardTitle>
          <VCardText>
            <VList aria-label="已选引用" density="compact">
              <VListItem
                v-for="value in shown"
                :key="value.id"
                :title="value.label"
                :subtitle="
                  value.selectable === false
                    ? '不可选（保留历史选择）'
                    : undefined
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
                :aria-invalid="invalid || error ? 'true' : undefined"
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
            <FeedbackRegion
              ><Feedback :message="error" kind="error"
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
              ></FeedbackRegion
            >
            <div
              class="zerp-reference-progress"
              role="status"
              :aria-label="busy ? '加载中' : undefined"
            >
              <VProgressLinear :indeterminate="busy" :active="busy" />
            </div>
            <div v-if="hierarchical" aria-label="引用层级">
              <VBtn
                type="button"
                variant="text"
                :disabled="disabled || busy || !ancestry.length"
                @click="browse()"
                >上一级</VBtn
              >
              <span>{{
                ancestry.map((item) => item.label || item.id).join(" / ") ||
                "全部"
              }}</span>
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
                <VBtn
                  v-if="hierarchical && item.hasChildren"
                  type="button"
                  variant="text"
                  :disabled="disabled || busy"
                  :aria-label="`浏览${item.label}下级`"
                  @click="browse(item)"
                  >下级</VBtn
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
          </VCardText>
          <VCardActions
            ><VBtn type="button" @click="open = false"
              >完成选择</VBtn
            ></VCardActions
          >
        </FeedbackHost>
      </VCard>
    </component>
  </div>
</template>
