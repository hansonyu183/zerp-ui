<script setup lang="ts" generic="P extends object, R extends object">
import { computed, shallowRef, ref, watch, onBeforeUnmount } from "vue";
import { validateReportRows } from "./report";
import type { ReportDefinition } from "./report";
import type { Fields, Page, AnyField } from "./contracts";
import DynamicForm from "./DynamicForm.vue";
import ListSurface from "./ListSurface.vue";
import { clone } from "./clone";
import { validate } from "./validation";
const props = withDefaults(
  defineProps<{
    definition: ReportDefinition<P, R>;
    scope: string;
    permissions: { query: boolean; export: boolean };
    pageSize?: number;
  }>(),
  { pageSize: 20 },
);
const input = shallowRef<P>(clone(props.definition.initialParameters()));
const applied = shallowRef<P | null>(null);
const result = shallowRef<Page<R> | null>(null);
const formGeneration = ref(0);
const page = ref(1),
  loading = ref(false),
  exporting = ref(false),
  pending = ref(false);
const error = ref(""),
  exportError = ref(""),
  notice = ref("");
const canQuery = computed(
  () => props.permissions.query && !!props.definition.adapter.query,
);
const canExport = computed(
  () => props.permissions.export && !!props.definition.adapter.export,
);
let request = 0,
  exportRequest = 0;
function message(caught: unknown) {
  return caught instanceof Error && caught.message
    ? caught.message
    : "报表请求失败，请重试。";
}
function parameters() {
  const invalid = validate(
    props.definition.parameters as readonly AnyField[],
    input.value,
    "edit",
  );
  if (pending.value || invalid) throw new Error(invalid ?? "请完成参数输入。");
  return clone(input.value);
}
async function query(target: number) {
  const adapter = props.definition.adapter.query;
  if (!canQuery.value || !adapter || !applied.value) return;
  const current = ++request;
  loading.value = true;
  error.value = "";
  result.value = null;
  page.value = target;
  try {
    const value = await adapter({
      scope: props.scope,
      parameters: clone(applied.value),
      page: target,
      pageSize: props.pageSize,
    });
    if (current !== request) return;
    validateReportRows(props.definition.columns, value.items);
    result.value = value;
  } catch (caught) {
    if (current === request) error.value = message(caught);
  } finally {
    if (current === request) loading.value = false;
  }
}
function updateInput(value: P) {
  input.value = value;
}
function search() {
  if (!canQuery.value) return;
  try {
    applied.value = parameters();
    void query(1);
  } catch (caught) {
    error.value = message(caught);
  }
}
async function download() {
  const adapter = props.definition.adapter.export;
  if (!canExport.value || exporting.value || !adapter) return;
  exportError.value = "";
  notice.value = "";
  const current = ++exportRequest;
  try {
    const values = parameters();
    exporting.value = true;
    const artifact = await adapter({ scope: props.scope, parameters: values });
    if (current !== exportRequest) return;
    const url = URL.createObjectURL(artifact.content);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.filename;
      link.click();
      notice.value = "导出已准备。";
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (caught) {
    if (current === exportRequest) exportError.value = message(caught);
  } finally {
    if (current === exportRequest) exporting.value = false;
  }
}
function reset() {
  formGeneration.value++;
  request++;
  exportRequest++;
  input.value = clone(props.definition.initialParameters());
  applied.value = null;
  result.value = null;
  page.value = 1;
  loading.value = false;
  exporting.value = false;
  pending.value = false;
  error.value = "";
  exportError.value = "";
  notice.value = "";
}
watch(
  () => [
    props.scope,
    props.definition,
    props.definition.resource,
    props.permissions.query,
    props.permissions.export,
    props.pageSize,
  ],
  reset,
  { flush: "sync" },
);
onBeforeUnmount(() => {
  request++;
  exportRequest++;
});
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <h1>{{ definition.title }}</h1>
    <form @submit.prevent="search">
      <DynamicForm
        :key="formGeneration"
        :fields="definition.parameters as unknown as Fields<P>"
        :model-value="input"
        :scope="scope"
        :disabled="!canQuery && !canExport"
        mode="edit"
        @update:model-value="updateInput"
        @pending="pending = $event"
      />
      <button v-if="canQuery" type="submit" :disabled="pending">查询</button>
      <button
        v-if="canExport"
        type="button"
        :disabled="pending || exporting"
        @click="download"
      >
        导出
      </button>
    </form>
    <p v-if="!canQuery && canExport">你可以填写参数并导出此报表。</p>
    <p v-if="!canQuery && !canExport">没有可用的报表操作。</p>
    <p v-if="loading" role="status">正在查询…</p>
    <p v-if="exporting" role="status">正在导出…</p>
    <p v-if="error" role="alert">
      {{ error }}
      <button
        v-if="applied && canQuery"
        type="button"
        :disabled="loading"
        @click="query(page)"
      >
        重试查询
      </button>
    </p>
    <p v-if="exportError" role="alert">{{ exportError }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <ListSurface
      v-if="canQuery && result"
      :columns="definition.columns"
      :result="result"
      :page="page"
      :page-size="pageSize"
      :loading="loading"
      @page="query"
    />
  </section>
</template>
