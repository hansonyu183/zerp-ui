<script setup lang="ts" generic="K">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import {
  VBtn,
  VPagination,
  VProgressLinear,
  VTextField,
} from "vuetify/components";
import type {
  WorkbenchPreference,
  WorkbenchPreferencesPage,
} from "./workbench";
import { clone } from "./clone";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
const props = defineProps<{
  options: WorkbenchPreferencesPage<K>;
  scope: string;
  active: boolean;
}>();
const items = shallowRef<readonly WorkbenchPreference<K>[]>([]);
const search = ref(""),
  currentPage = ref(1);
const pageSize = 50;
const filtered = computed(() =>
  items.value.filter((item) =>
    item.name
      .toLocaleLowerCase()
      .includes(search.value.trim().toLocaleLowerCase()),
  ),
);
const pages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize)),
);
const rows = computed(() =>
  filtered.value.slice(
    (currentPage.value - 1) * pageSize,
    currentPage.value * pageSize,
  ),
);
watch([search, pages], () => {
  currentPage.value = Math.min(currentPage.value, pages.value);
});
watch(search, () => {
  currentPage.value = 1;
});
const busy = ref(false),
  loaded = ref(false),
  error = ref("");
const pending = shallowRef<{
  id: string;
  key: K;
  added: boolean;
  confirmed: boolean;
}>();
let generation = 0,
  controller: AbortController | undefined;
function cancel() {
  generation++;
  controller?.abort();
}
function message(cause: unknown) {
  return cause instanceof Error ? cause.message : "读取失败，请重试。";
}
async function reload() {
  if (busy.value || !props.active) return;
  const epoch = generation;
  const request = (controller = new AbortController());
  busy.value = true;
  error.value = "";
  try {
    const result = await props.options.adapter.load({
      scope: props.scope,
      signal: request.signal,
    });
    if (epoch !== generation || !props.active) return;
    items.value = result;
    loaded.value = true;
    const original = pending.value;
    if (original) {
      if (
        original.confirmed ||
        result.some(
          (item) => item.id === original.id && item.added === original.added,
        )
      )
        pending.value = undefined;
      else error.value = "尚未确认操作结果，请重试原操作或重新核对。";
    }
  } catch (cause) {
    if (epoch === generation && props.active) error.value = message(cause);
  } finally {
    if (epoch === generation) busy.value = false;
  }
}
async function change(item?: WorkbenchPreference<K>) {
  if (busy.value || !props.active || (item && pending.value)) return;
  const original = item
    ? {
        id: item.id,
        key: clone(item.key),
        added: !item.added,
        confirmed: false,
      }
    : pending.value;
  if (!original || original.confirmed) return;
  pending.value = original;
  const epoch = generation;
  const request = (controller = new AbortController());
  busy.value = true;
  error.value = "";
  let success = false;
  try {
    await props.options.adapter.setAdded({
      key: clone(original.key),
      added: original.added,
      scope: props.scope,
      signal: request.signal,
    });
    if (epoch !== generation || !props.active) return;
    pending.value = { ...original, confirmed: true };
    success = true;
  } catch (cause) {
    if (epoch === generation && props.active)
      error.value = message(cause) + " 操作结果待核对。";
  } finally {
    if (epoch === generation) busy.value = false;
  }
  if (success && epoch === generation) await reload();
}
watch(
  () => [
    props.scope,
    props.active,
    props.options.instance,
    props.options.adapter,
  ],
  () => {
    cancel();
    items.value = [];
    search.value = "";
    currentPage.value = 1;
    busy.value = false;
    loaded.value = false;
    error.value = "";
    pending.value = undefined;
    void reload();
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(cancel);
</script>
<template>
  <section aria-label="常用项管理" :aria-busy="busy">
    <div class="zerp-workbench-progress">
      <VProgressLinear :active="busy" indeterminate aria-label="正在处理" />
    </div>
    <FeedbackRegion>
      <Feedback
        :message="
          pending?.confirmed
            ? '操作已完成，请重新读取。' + error
            : error || (pending ? '操作结果待核对，暂不能进行其他操作。' : '')
        "
        :kind="error ? 'error' : 'status'"
        persistent
      >
        <VBtn
          v-if="pending && !pending.confirmed"
          :disabled="busy"
          @click="change()"
          >重试原操作</VBtn
        >
      </Feedback>
    </FeedbackRegion>
    <form class="zerp-workbench-search" @submit.prevent="reload">
      <VTextField v-model="search" label="名称" hide-details />
      <VBtn type="submit" :disabled="busy">{{
        pending ? "核对结果" : "刷新"
      }}</VBtn>
    </form>
    <ul class="zerp-preference-list">
      <li v-for="item in rows" :key="item.id">
        <span>{{ item.name }}</span
        ><span>{{ item.added ? "已添加" : "未添加" }}</span>
        <VBtn
          :disabled="busy || !!pending || !!error"
          :aria-label="`${item.added ? '移除' : '添加'}：${item.name}`"
          @click="change(item)"
          >{{ item.added ? "移除" : "添加" }}</VBtn
        >
      </li>
    </ul>
    <p v-if="loaded && !rows.length">暂无可选项</p>
    <VPagination
      v-if="pages > 1"
      v-model="currentPage"
      :length="pages"
      aria-label="常用项分页"
    />
  </section>
</template>
