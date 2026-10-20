<script setup lang="ts" generic="H extends object, R extends object">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { clone } from "./clone";
import DynamicForm from "./DynamicForm.vue";
import type { Column } from "./contracts";
import type {
  VoucherEditorDefinition,
  VoucherEditorValue,
} from "./voucher-editor";

const props = defineProps<
  VoucherEditorDefinition<H, R> & {
    modelValue: VoucherEditorValue<H, R>;
    scope: string;
    mode: "read" | "edit";
    disabled?: boolean;
  }
>();
const emit = defineEmits<{
  "update:modelValue": [value: VoucherEditorValue<H, R>];
  pending: [value: boolean];
}>();
const writable = computed(() => props.mode === "edit" && !props.disabled);
const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
);
const editing = shallowRef<{ key: string | null; value: R } | null>(null);
const deleting = ref<string | null>(null);
const headerPending = ref(false);
const rowPending = ref(false);
function pending() {
  emit("pending", headerPending.value || rowPending.value);
}
function setHeader(value: H) {
  if (writable.value)
    emit("update:modelValue", { ...props.modelValue, header: clone(value) });
}
function display(row: R, column: Column<R>) {
  const value = row[column.key];
  return value === null || value === undefined
    ? "—"
    : column.type === "boolean"
      ? value
        ? "是"
        : "否"
      : column.type === "enum"
        ? (column.options?.find((option) => option.value === value)?.label ??
          String(value))
        : String(value);
}
function begin(row?: R) {
  if (!writable.value) return;
  deleting.value = null;
  editing.value = {
    key: row ? props.rowKey(row) : null,
    value: clone(row ?? props.emptyRow()),
  };
}
function finishRow() {
  const draft = editing.value;
  if (!draft || !writable.value || rowPending.value) return;
  const rows = [...props.modelValue.rows];
  if (draft.key === null) {
    if (rows.some((row) => props.rowKey(row) === props.rowKey(draft.value)))
      return;
    rows.push(clone(draft.value));
  } else {
    const index = rows.findIndex((row) => props.rowKey(row) === draft.key);
    if (index < 0) return;
    if (
      props.rowKey(draft.value) !== draft.key &&
      rows.some((row) => props.rowKey(row) === props.rowKey(draft.value))
    )
      return;
    rows[index] = clone(draft.value);
  }
  editing.value = null;
  rowPending.value = false;
  pending();
  emit("update:modelValue", { ...props.modelValue, rows });
}
function removeRow() {
  if (!writable.value || deleting.value === null) return;
  const rows = props.modelValue.rows.filter(
    (row) => props.rowKey(row) !== deleting.value,
  );
  deleting.value = null;
  emit("update:modelValue", { ...props.modelValue, rows });
}
function reset() {
  editing.value = null;
  deleting.value = null;
  headerPending.value = false;
  rowPending.value = false;
  emit("pending", false);
}
function cancelRow() {
  editing.value = null;
  rowPending.value = false;
  pending();
}
watch(() => [props.scope, props.mode], reset);
watch(
  () => props.modelValue.rows,
  (rows) => {
    if (
      editing.value?.key &&
      !rows.some((row) => props.rowKey(row) === editing.value?.key)
    )
      reset();
    if (
      deleting.value &&
      !rows.some((row) => props.rowKey(row) === deleting.value)
    )
      deleting.value = null;
  },
);
onBeforeUnmount(() => emit("pending", false));
</script>

<template>
  <section class="zerp-voucher-editor" aria-label="单据编辑展示">
    <div class="zerp-voucher-editor__header" aria-label="单据表头">
      <DynamicForm
        :fields="headerFields"
        :model-value="modelValue.header"
        :scope="scope"
        :disabled="!writable"
        @update:model-value="setHeader"
        @pending="
          headerPending = $event;
          pending();
        "
      />
    </div>
    <div class="zerp-voucher-editor__table">
      <table aria-label="单据明细">
        <thead>
          <tr>
            <th v-for="column in visibleColumns" :key="column.key" scope="col">
              {{ column.label }}
            </th>
            <th v-if="writable" scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in modelValue.rows" :key="rowKey(row)">
            <td
              v-for="column in visibleColumns"
              :key="column.key"
              :data-label="column.label"
            >
              {{ display(row, column) }}
            </td>
            <td v-if="writable" data-label="操作">
              <button type="button" :disabled="!!editing" @click="begin(row)">
                编辑明细行 {{ index + 1 }}
              </button>
              <button
                type="button"
                :disabled="!!editing"
                @click="deleting = rowKey(row)"
              >
                删除明细行 {{ index + 1 }}
              </button>
              <span v-if="deleting === rowKey(row)">
                确认删除该行？
                <button type="button" @click="removeRow">
                  确认删除明细行 {{ index + 1 }}
                </button>
                <button type="button" @click="deleting = null">取消删除</button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="modelValue.rows.length === 0">暂无明细行</p>
      <button
        v-if="writable"
        type="button"
        :disabled="!!editing"
        @click="begin()"
      >
        新增明细行
      </button>
    </div>
    <section v-if="editing" role="dialog" aria-label="编辑明细行">
      <DynamicForm
        :fields="rowFields"
        :model-value="editing.value"
        :scope="scope"
        :disabled="!writable"
        @update:model-value="editing = { ...editing!, value: $event }"
        @pending="
          rowPending = $event;
          pending();
        "
      />
      <button
        type="button"
        :disabled="!writable || rowPending"
        @click="finishRow"
      >
        确定明细行
      </button>
      <button type="button" @click="cancelRow">取消明细行</button>
    </section>
  </section>
</template>
