<script
  setup
  lang="ts"
  generic="H extends object, R extends object, C extends object = object"
>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { clone } from "./clone";
import DynamicForm from "./DynamicForm.vue";
import type { Fields } from "./contracts";
import type {
  VoucherEditorChildColumn,
  VoucherEditorColumn,
  VoucherEditorDefinition,
  VoucherEditorValue,
} from "./voucher-editor";

const props = defineProps<
  VoucherEditorDefinition<H, R, C> & {
    modelValue: VoucherEditorValue<H, R>;
    scope: string;
    instance?: string | number;
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
const childEditing = shallowRef<{
  parentKey: string;
  column: VoucherEditorChildColumn<R, C>;
  rows: C[];
  sourceRows: readonly R[];
} | null>(null);
let childTrigger: HTMLButtonElement | null = null;
const childClose = ref<HTMLButtonElement | null>(null);
const childDialog = ref<HTMLElement | null>(null);
const headerPending = ref(false);
const rowPending = ref(false);
const childPending = ref(false);
function pending() {
  emit(
    "pending",
    headerPending.value || rowPending.value || childPending.value,
  );
}
function setHeader(value: H) {
  if (writable.value)
    emit("update:modelValue", { ...props.modelValue, header: clone(value) });
}
function display(row: R, column: VoucherEditorColumn<R, C>) {
  if (column.type === "children") {
    const children = row[column.key];
    return column.summary(Array.isArray(children) ? (children as C[]) : []);
  }
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
function beginChild(
  row: R,
  column: VoucherEditorChildColumn<R, C>,
  event: MouseEvent,
) {
  if (childEditing.value || editing.value) return;
  childTrigger = event.currentTarget as HTMLButtonElement;
  childEditing.value = {
    parentKey: props.rowKey(row),
    column,
    rows: clone(Array.isArray(row[column.key]) ? (row[column.key] as C[]) : []),
    sourceRows: props.modelValue.rows,
  };
  nextTick(() => childClose.value?.focus());
}
const childFields = computed(
  () =>
    (childEditing.value
      ? [
          {
            key: "items",
            label: childEditing.value.column.label,
            type: "rows",
            fields: childEditing.value.column.fields,
            empty: childEditing.value.column.empty,
          },
        ]
      : []) as unknown as Fields<{ items: C[] }>,
);
function cancelChild(restoreFocus = true) {
  childEditing.value = null;
  childPending.value = false;
  pending();
  if (restoreFocus)
    nextTick(() => {
      if (childTrigger?.isConnected) childTrigger.focus();
      childTrigger = null;
    });
  else childTrigger = null;
}
function childKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelChild();
    return;
  }
  if (event.key !== "Tab" || !childDialog.value) return;
  const focusable = Array.from(
    childDialog.value.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
    ),
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function finishChild() {
  const draft = childEditing.value;
  if (!draft || !writable.value || childPending.value) return;
  if (props.modelValue.rows !== draft.sourceRows) {
    cancelChild();
    return;
  }
  const rows = [...props.modelValue.rows];
  const index = rows.findIndex((row) => props.rowKey(row) === draft.parentKey);
  if (index < 0) {
    cancelChild();
    return;
  }
  rows[index] = { ...rows[index], [draft.column.key]: clone(draft.rows) } as R;
  cancelChild();
  emit("update:modelValue", { ...props.modelValue, rows });
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
  cancelChild(false);
  headerPending.value = false;
  rowPending.value = false;
  emit("pending", false);
}
function cancelRow() {
  editing.value = null;
  rowPending.value = false;
  pending();
}
watch(() => [props.scope, props.instance, props.mode], reset);
watch(
  () => props.modelValue.rows,
  (rows) => {
    if (childEditing.value && rows !== childEditing.value.sourceRows)
      cancelChild();
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
              <template v-if="column.type === 'children'">
                <button
                  type="button"
                  :disabled="
                    !!editing ||
                    !!childEditing ||
                    (mode === 'edit' && !!disabled)
                  "
                  @click="beginChild(row, column, $event)"
                >
                  {{ writable ? "编辑" : "查看" }}{{ column.label }} · 明细行
                  {{ index + 1 }}
                </button>
                <span>{{ display(row, column) }}</span>
              </template>
              <template v-else>{{ display(row, column) }}</template>
            </td>
            <td v-if="writable" data-label="操作">
              <button
                type="button"
                :disabled="!!editing || !!childEditing"
                @click="begin(row)"
              >
                编辑明细行 {{ index + 1 }}
              </button>
              <button
                type="button"
                :disabled="!!editing || !!childEditing"
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
        :disabled="!!editing || !!childEditing"
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
    <div v-if="childEditing" class="zerp-voucher-editor__overlay">
      <section
        ref="childDialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`${childEditing.column.label} · 明细行 ${modelValue.rows.findIndex((row) => rowKey(row) === childEditing?.parentKey) + 1}`"
        @keydown="childKeydown"
      >
        <DynamicForm
          :fields="childFields"
          :model-value="{ items: childEditing.rows }"
          :scope="scope"
          :disabled="!writable"
          @update:model-value="
            childEditing = { ...childEditing!, rows: $event.items }
          "
          @pending="
            childPending = $event;
            pending();
          "
        />
        <button
          v-if="writable"
          type="button"
          :disabled="childPending"
          @click="finishChild"
        >
          确定{{ childEditing.column.label }}
        </button>
        <button ref="childClose" type="button" @click="cancelChild()">
          {{ writable ? "取消" : "关闭" }}{{ childEditing.column.label }}
        </button>
      </section>
    </div>
  </section>
</template>
