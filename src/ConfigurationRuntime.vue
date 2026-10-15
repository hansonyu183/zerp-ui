<script
  setup
  lang="ts"
  generic="D extends object, F extends object, R extends object, I, E = never"
>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { VAlert, VProgressLinear } from "vuetify/components";
import type { AnyField, Page } from "./contracts";
import type {
  ConfigurationDefinition,
  ConfigurationAttempt,
  ConfigurationBlock,
} from "./configuration";
import DynamicForm from "./DynamicForm.vue";
import ListSurface from "./ListSurface.vue";
import { clone, message } from "./clone";
import { validate } from "./validation";
import { writeLock } from "./write-lock";
const props = defineProps<{
  definition: ConfigurationDefinition<D, F, R, I, E>;
  scope: string;
  permissions: { read: boolean; write: boolean; reconcile?: boolean };
  blocks?: readonly ConfigurationBlock<D>[];
}>();
const filters = shallowRef<F>(props.definition.initialFilters()),
  applied = shallowRef<F>(clone(filters.value));
const result = shallowRef<Page<R>>({ items: [], total: 0 }),
  page = ref(1),
  loading = ref(false),
  error = ref(""),
  notice = ref("");
const editor = shallowRef<{
  values: D;
  identity?: I;
  writable: boolean;
} | null>(null);
const detailLoading = ref(false),
  verifying = ref(false),
  pending = ref<Record<string, boolean>>({});
const lock = computed(() =>
  writeLock<D, I>(
    props.definition.adapter,
    `configuration:${props.definition.resource}`,
    props.scope,
  ),
);
const blocked = computed(() => lock.value.phase !== "idle");
const disabled = computed(
  () =>
    blocked.value ||
    !props.permissions.read ||
    !props.permissions.write ||
    !editor.value?.writable,
);
const formFields = computed(
  () =>
    props.definition.fields.filter(
      (f) => !props.blocks?.some((b) => b.key === f.key),
    ) as unknown as typeof props.definition.fields,
);
let generation = 0,
  queryId = 0,
  editId = 0,
  active = true;
const current = (g: number) => active && g === generation;
function close() {
  if (lock.value.phase === "pending") return;
  editId++;
  editor.value = null;
  pending.value = {};
}
async function query(next = page.value, submit = false) {
  if (!props.permissions.read) return;
  if (submit) {
    const invalid = validate(
      props.definition.filters as readonly AnyField[],
      filters.value,
      "create",
    );
    if (invalid) {
      error.value = invalid;
      return;
    }
    applied.value = clone(filters.value);
  }
  const g = generation,
    q = ++queryId,
    target = lock.value,
    refreshing = target.phase === "refresh",
    attempt = target.attempt;
  loading.value = true;
  error.value = "";
  try {
    const value = await props.definition.adapter.query({
      scope: props.scope,
      filters: clone(applied.value),
      page: next,
      pageSize: 20,
    });
    if (!current(g) || q !== queryId) return;
    result.value = clone(value);
    page.value = next;
    if (
      refreshing &&
      target.phase === "refresh" &&
      target.attempt === attempt
    ) {
      target.phase = "idle";
      target.attempt = null;
    }
  } catch (e) {
    if (current(g) && q === queryId) error.value = message(e);
  } finally {
    if (current(g) && q === queryId) loading.value = false;
  }
}
async function begin(row?: R) {
  if (
    blocked.value ||
    editor.value ||
    detailLoading.value ||
    !props.permissions.read ||
    !props.permissions.write
  )
    return;
  const g = generation,
    e = ++editId,
    definition = props.definition;
  error.value = "";
  notice.value = "";
  pending.value = {};
  if (!row) {
    if (definition.adapter.empty)
      editor.value = {
        values: clone(
          definition.adapter.empty({
            scope: props.scope,
            filters: clone(applied.value),
          }),
        ),
        writable: true,
      };
    return;
  }
  detailLoading.value = true;
  try {
    const detail = await definition.adapter.get({
      scope: props.scope,
      identity: clone(definition.identity(row)),
    });
    if (current(g) && e === editId)
      editor.value = {
        values: clone(detail.values),
        identity: clone(detail.identity),
        writable: detail.writable !== false,
      };
  } catch (cause) {
    if (current(g) && e === editId) error.value = message(cause);
  } finally {
    if (current(g) && e === editId) detailLoading.value = false;
  }
}
// Every event handler captures the editor instance. Old blocks cannot alter a new editor.
const bindings = computed(() => {
  const g = generation,
    e = editId;
  const valid = () =>
    current(g) && e === editId && !!editor.value && !disabled.value;
  return {
    form: (value: D) => {
      if (valid()) editor.value = { ...editor.value!, values: clone(value) };
    },
    formPending: (value: boolean) => {
      if (valid()) pending.value = { ...pending.value, form: value };
    },
    blocks:
      props.blocks?.map((block) => ({
        key: block.key,
        component: block.component,
        props: {
          modelValue: clone(editor.value?.values[block.key]),
          catalog: clone(block.catalog),
          mode: disabled.value ? ("read" as const) : ("edit" as const),
          disabled: disabled.value,
          "onUpdate:modelValue": (value: D[typeof block.key]) => {
            if (valid())
              editor.value = {
                ...editor.value!,
                values: { ...editor.value!.values, [block.key]: clone(value) },
              };
          },
          onPending: (value: boolean) => {
            if (valid())
              pending.value = {
                ...pending.value,
                [`block:${block.key}`]: value,
              };
          },
        },
      })) ?? [],
  };
});
async function save() {
  if (
    !editor.value ||
    disabled.value ||
    Object.values(pending.value).some(Boolean)
  )
    return;
  const definition = props.definition,
    target = lock.value,
    g = generation;
  const invalid = validate(
    formFields.value as readonly AnyField[],
    editor.value.values,
    "edit",
  );
  if (invalid) {
    error.value = invalid;
    return;
  }
  const attempt: ConfigurationAttempt<D, I> = Object.freeze({
    id: crypto.randomUUID(),
    scope: props.scope,
    resource: definition.resource,
    operation: "save",
    input: clone(editor.value.values),
    identity: clone(editor.value.identity),
  });
  target.phase = "pending";
  target.attempt = attempt;
  queryId++;
  loading.value = false;
  error.value = "";
  notice.value = "";
  try {
    const outcome = await definition.adapter.save(clone(attempt));
    if (outcome.status === "success") {
      target.phase = "refresh";
      if (current(g)) {
        close();
        notice.value = "配置已保存。";
        await query();
      }
    } else if (outcome.status === "failure") {
      target.phase = "idle";
      target.attempt = null;
      if (current(g)) error.value = outcome.message;
    } else {
      target.phase = "unknown";
      if (current(g)) error.value = outcome.message ?? "保存结果未知。";
    }
  } catch {
    target.phase = "unknown";
    if (current(g)) error.value = "保存结果未知。";
  }
}
async function reconcile() {
  const target = lock.value,
    attempt = target.attempt as ConfigurationAttempt<D, I> | null,
    verify = props.definition.reconcile,
    g = generation;
  if (
    target.phase !== "unknown" ||
    !attempt ||
    !verify ||
    !props.permissions.reconcile ||
    verifying.value
  )
    return;
  verifying.value = true;
  try {
    const outcome = await verify(clone(attempt));
    if (
      outcome.status !== "unknown" &&
      outcome.attemptId === attempt.id &&
      outcome.evidence != null &&
      target.attempt === attempt &&
      target.phase === "unknown"
    ) {
      if (outcome.status === "applied") {
        target.phase = "refresh";
        if (current(g)) {
          close();
          notice.value = "已核实保存成功。";
          await query();
        }
      } else {
        target.phase = "idle";
        target.attempt = null;
        if (current(g)) notice.value = "已确认本次请求未应用。";
      }
    } else if (current(g)) notice.value = "证据不足，结果仍未知。";
  } catch (e) {
    if (current(g)) error.value = message(e);
  } finally {
    if (current(g)) verifying.value = false;
  }
}
watch(
  () => [props.scope, props.definition, props.permissions.read],
  () => {
    generation++;
    queryId++;
    editId++;
    editor.value = null;
    pending.value = {};
    result.value = { items: [], total: 0 };
    page.value = 1;
    filters.value = props.definition.initialFilters();
    applied.value = clone(filters.value);
    loading.value = false;
    detailLoading.value = false;
    verifying.value = false;
    error.value = "";
    notice.value = "";
    void query(1);
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => {
  active = false;
  generation++;
  queryId++;
  editId++;
});
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <h1>{{ definition.title }}</h1>
    <form v-if="permissions.read" @submit.prevent="query(1, true)">
      <DynamicForm
        v-model="filters"
        :fields="definition.filters"
        :scope="scope"
      />
      <button type="submit" :disabled="loading">查询</button>
    </form>
    <VProgressLinear
      v-if="loading || detailLoading"
      indeterminate
      aria-label="加载中"
    />
    <VAlert v-if="error" type="error" role="alert">{{ error }}</VAlert>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="lock.phase === 'unknown'" role="status">
      保存结果未知。普通读取或关闭编辑不能解除锁定。
      <button
        v-if="definition.reconcile && permissions.reconcile"
        type="button"
        :disabled="verifying"
        @click="reconcile"
      >
        核实本次请求
      </button>
    </p>
    <p v-if="lock.phase === 'refresh'" role="status">
      保存已成功，请重试读取；不会再次提交。
    </p>
    <button
      v-if="permissions.read"
      type="button"
      :disabled="loading"
      @click="query()"
    >
      重试读取
    </button>
    <button
      v-if="definition.adapter.empty && permissions.write && permissions.read"
      type="button"
      :disabled="blocked || !!editor || detailLoading"
      @click="begin()"
    >
      新增配置
    </button>
    <ListSurface
      :columns="definition.columns"
      :result="result"
      :page="page"
      :page-size="20"
      :loading="loading"
      :actions="() => (permissions.read && permissions.write ? ['edit'] : [])"
      :disabled="blocked || !!editor || detailLoading"
      @page="query($event)"
      @action="(_action, row) => begin(row)"
    />
    <section v-if="editor" :key="editId" role="dialog" aria-label="编辑配置">
      <DynamicForm
        :fields="formFields"
        :model-value="clone(editor.values)"
        :scope="scope"
        mode="edit"
        :disabled="disabled"
        :onUpdate:modelValue="bindings.form"
        :onPending="bindings.formPending"
      />
      <component
        v-for="block in bindings.blocks"
        :is="block.component"
        :key="block.key"
        v-bind="block.props"
      />
      <button type="button" :disabled="lock.phase === 'pending'" @click="close">
        关闭编辑
      </button>
      <button
        type="button"
        :disabled="disabled || Object.values(pending).some(Boolean)"
        @click="save"
      >
        保存
      </button>
    </section>
  </section>
</template>
