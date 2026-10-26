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
import { clone, message } from "./clone";
import DynamicForm from "./DynamicForm.vue";
import FactFields from "./FactFields.vue";
import { formFacts, factText } from "./details";
import type { Fields } from "./contracts";
import type {
  VoucherEditorChildColumn,
  VoucherEditorColumn,
  VoucherEditorDefinition,
  VoucherEditorValue,
  VoucherEditorChange,
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
  "update:modelValue": [
    value: VoucherEditorValue<H, R>,
    change: VoucherEditorChange,
  ];
  pending: [value: boolean];
}>();
const writable = computed(() => props.mode === "edit" && !props.disabled);
const canInsert = computed(
  () => writable.value && props.rowOperations?.insert !== false,
);
const canUpdate = computed(
  () => writable.value && props.rowOperations?.update !== false,
);
const canDelete = computed(
  () => writable.value && props.rowOperations?.delete !== false,
);
function canEditRow(key: string | null) {
  return key === null ? canInsert.value : canUpdate.value;
}
const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
);
const editing = shallowRef<{
  key: string | null;
  value: R | null;
  targetKey?: string;
  candidate?: VoucherEditorValue<H, R>;
} | null>(null);
const visibleValue = computed(
  () => editing.value?.candidate ?? props.modelValue,
);
const rowFormVersion = ref(0);
function candidateRow(
  candidate: VoucherEditorValue<H, R>,
  key: string,
): R | null {
  const rows = candidate.rows.filter((row) => props.rowKey(row) === key);
  if (rows.length > 1) throw new Error("明细行标识重复，请重新编辑。");
  return rows[0] ? clone(rows[0]) : null;
}
const deleting = ref<string | null>(null);
const preparing = ref(false);
const error = ref("");
let preparation = 0;
let disposed = false;
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
    preparing.value ||
      headerPending.value ||
      rowPending.value ||
      childPending.value ||
      !!editing.value ||
      (canUpdate.value && !!childEditing.value),
  );
}
function setHeader(value: H) {
  if (writable.value)
    emit(
      "update:modelValue",
      { ...props.modelValue, header: clone(value) },
      { kind: "header" },
    );
}
function display(row: R, column: VoucherEditorColumn<R, C>) {
  if (column.type === "children") {
    const children = row[column.key];
    return column.summary(Array.isArray(children) ? (children as C[]) : []);
  }
  const value = row[column.key];
  return factText(value, { ...column, type: column.type ?? "text" });
}
function beginChild(
  row: R,
  column: VoucherEditorChildColumn<R, C>,
  event: MouseEvent,
) {
  if (preparing.value || childEditing.value || editing.value) return;
  childTrigger = event.currentTarget as HTMLButtonElement;
  childEditing.value = {
    parentKey: props.rowKey(row),
    column,
    rows: clone(Array.isArray(row[column.key]) ? (row[column.key] as C[]) : []),
    sourceRows: props.modelValue.rows,
  };
  pending();
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
      "summary, button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
    ),
  ).filter((element) => {
    for (
      let parent = element.parentElement;
      parent && parent !== childDialog.value;
      parent = parent.parentElement
    ) {
      if (
        parent.tagName === "DETAILS" &&
        !parent.hasAttribute("open") &&
        parent.querySelector("summary") !== element
      )
        return false;
    }
    return true;
  });
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
  if (!draft || !canUpdate.value || childPending.value) return;
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
  emit("update:modelValue", { ...props.modelValue, rows }, { kind: "row" });
}
async function begin(row?: R) {
  if (
    !(row ? canUpdate.value : canInsert.value) ||
    preparing.value ||
    editing.value ||
    childEditing.value
  )
    return;
  deleting.value = null;
  error.value = "";
  if (row) {
    editing.value = {
      key: props.rowKey(row),
      value: clone(row),
      ...(props.rowDraft
        ? { targetKey: props.rowKey(row), candidate: clone(props.modelValue) }
        : {}),
    };
    pending();
    return;
  }
  const token = ++preparation;
  preparing.value = true;
  pending();
  try {
    if (props.rowDraft) {
      const result = await props.rowDraft.prepare({
        candidate: clone(props.modelValue),
      });
      if (disposed || token !== preparation || !canInsert.value) return;
      if (
        props.modelValue.rows.some((row) => props.rowKey(row) === result.rowKey)
      )
        throw new Error("新明细行标识已存在，请重新编辑。");
      const candidate = clone(result.candidate);
      editing.value = {
        key: null,
        targetKey: result.rowKey,
        value: candidateRow(candidate, result.rowKey),
        candidate,
      };
    } else {
      const value = await props.emptyRow();
      if (disposed || token !== preparation || !canInsert.value) return;
      editing.value = { key: null, value: clone(value) };
    }
  } catch (cause) {
    if (!disposed && token === preparation) {
      error.value = message(cause);
    }
  } finally {
    if (!disposed && token === preparation) {
      preparing.value = false;
      pending();
    }
  }
}
async function changeRow(value: R) {
  const draft = editing.value;
  if (!draft || !draft.value || !canEditRow(draft.key) || preparing.value)
    return;
  if (!props.rowDraft && !props.transformRow) {
    editing.value = { ...draft, value: clone(value) };
    return;
  }
  const token = ++preparation;
  preparing.value = true;
  error.value = "";
  pending();
  try {
    let candidate: VoucherEditorValue<H, R> | undefined;
    let next: R | null;
    if (props.rowDraft) {
      const input = clone(draft.candidate!);
      const rows = input.rows.map((row) =>
        props.rowKey(row) === draft.targetKey ? clone(value) : row,
      );
      candidate = props.rowDraft.change
        ? await props.rowDraft.change({
            value: clone(value),
            previous: clone(draft.value),
            candidate: { ...input, rows },
          })
        : { ...input, rows };
      candidate = clone(candidate);
      next = candidateRow(candidate, draft.targetKey!);
    } else {
      next = await props.transformRow!({
        value: clone(value),
        previous: clone(draft.value),
      });
    }
    if (
      disposed ||
      token !== preparation ||
      !canEditRow(draft.key) ||
      editing.value !== draft
    )
      return;
    editing.value = {
      ...draft,
      value: clone(next),
      ...(candidate ? { candidate } : {}),
    };
  } catch (cause) {
    if (!disposed && token === preparation) {
      error.value = message(cause);
      rowFormVersion.value++;
    }
  } finally {
    if (!disposed && token === preparation) {
      preparing.value = false;
      pending();
    }
  }
}
function finishRow() {
  const draft = editing.value;
  if (!draft || !canEditRow(draft.key) || preparing.value || rowPending.value)
    return;
  if (draft.candidate) {
    const candidate = clone(draft.candidate);
    editing.value = null;
    rowPending.value = false;
    emit("update:modelValue", candidate, { kind: "row" });
    pending();
    return;
  }
  if (!draft.value) return;
  const rowValue = draft.value;
  const rows = [...props.modelValue.rows];
  if (draft.key === null) {
    if (rows.some((row) => props.rowKey(row) === props.rowKey(rowValue)))
      return;
    rows.push(clone(rowValue));
  } else {
    const index = rows.findIndex((row) => props.rowKey(row) === draft.key);
    if (index < 0) return;
    if (
      props.rowKey(rowValue) !== draft.key &&
      rows.some((row) => props.rowKey(row) === props.rowKey(rowValue))
    )
      return;
    rows[index] = clone(rowValue);
  }
  editing.value = null;
  rowPending.value = false;
  emit("update:modelValue", { ...props.modelValue, rows }, { kind: "row" });
  pending();
}
function removeRow() {
  if (!canDelete.value || preparing.value || deleting.value === null) return;
  const rows = props.modelValue.rows.filter(
    (row) => props.rowKey(row) !== deleting.value,
  );
  deleting.value = null;
  emit("update:modelValue", { ...props.modelValue, rows }, { kind: "delete" });
}
function reset() {
  preparation++;
  preparing.value = false;
  error.value = "";
  editing.value = null;
  deleting.value = null;
  cancelChild(false);
  headerPending.value = false;
  rowPending.value = false;
  emit("pending", false);
}
function cancelRow() {
  preparation++;
  preparing.value = false;
  error.value = "";
  editing.value = null;
  rowPending.value = false;
  pending();
}
watch(() => [props.scope, props.instance, props.mode, props.disabled], reset, {
  flush: "sync",
});
watch(
  () => props.modelValue,
  () => {
    if (preparing.value || editing.value?.candidate) reset();
  },
  { deep: true, flush: "sync" },
);
watch(
  () => [canInsert.value, canUpdate.value, canDelete.value],
  () => {
    if (
      (preparing.value && !editing.value && !canInsert.value) ||
      (editing.value && !canEditRow(editing.value.key))
    )
      reset();
    if (!canDelete.value) deleting.value = null;
    if (props.mode === "edit" && !canUpdate.value && childEditing.value)
      cancelChild(false);
  },
  { flush: "sync" },
);
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
onBeforeUnmount(() => {
  disposed = true;
  preparation++;
  emit("pending", false);
});
</script>

<template>
  <section class="zerp-voucher-editor" aria-label="单据编辑展示">
    <div class="zerp-voucher-editor__header" aria-label="单据表头">
      <FactFields
        v-if="mode === 'read' || editing?.candidate"
        :key="`${scope}:${instance}`"
        :fields="formFacts(headerFields)"
        :value="visibleValue.header"
      />
      <DynamicForm
        v-else
        :fields="headerFields"
        :model-value="modelValue.header"
        :scope="scope"
        :disabled="!writable || preparing"
        @update:model-value="setHeader"
        @pending="
          headerPending = $event;
          pending();
        "
      />
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="preparing" role="status">正在更新明细…</p>
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
          <tr v-for="(row, index) in visibleValue.rows" :key="rowKey(row)">
            <td
              v-for="column in visibleColumns"
              :key="column.key"
              :data-label="column.label"
            >
              <template v-if="column.type === 'children'">
                <button
                  type="button"
                  :disabled="
                    preparing ||
                    !!editing ||
                    !!childEditing ||
                    (mode === 'edit' && !!disabled)
                  "
                  @click="beginChild(row, column, $event)"
                >
                  {{ canUpdate ? "编辑" : "查看" }}{{ column.label }} · 明细行
                  {{ index + 1 }}
                </button>
                <span>{{ display(row, column) }}</span>
              </template>
              <template v-else>{{ display(row, column) }}</template>
            </td>
            <td v-if="writable" data-label="操作">
              <button
                v-if="canUpdate"
                type="button"
                :disabled="preparing || !!editing || !!childEditing"
                @click="begin(row)"
              >
                编辑明细行 {{ index + 1 }}
              </button>
              <button
                v-if="canDelete"
                type="button"
                :disabled="preparing || !!editing || !!childEditing"
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
      <p v-if="visibleValue.rows.length === 0">暂无明细行</p>
      <button
        v-if="canInsert"
        type="button"
        :disabled="preparing || !!editing || !!childEditing"
        @click="begin()"
      >
        新增明细行
      </button>
    </div>
    <section v-if="editing" role="dialog" aria-label="编辑明细行">
      <p v-if="!editing.value">该明细行已移除。</p>
      <DynamicForm
        v-else
        :key="rowFormVersion"
        :fields="rowFields"
        :model-value="editing.value"
        :scope="scope"
        :disabled="!writable || preparing"
        @update:model-value="changeRow"
        @pending="
          rowPending = $event;
          pending();
        "
      />
      <button
        type="button"
        :disabled="!writable || preparing || rowPending"
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
        <FactFields
          v-if="!canUpdate"
          :fields="formFacts(childFields)"
          :value="{ items: childEditing.rows }"
        />
        <DynamicForm
          v-else
          :fields="childFields"
          :model-value="{ items: childEditing.rows }"
          :scope="scope"
          :disabled="!writable || preparing"
          @update:model-value="
            childEditing = { ...childEditing!, rows: $event.items }
          "
          @pending="
            childPending = $event;
            pending();
          "
        />
        <button
          v-if="canUpdate"
          type="button"
          :disabled="childPending"
          @click="finishChild"
        >
          确定{{ childEditing.column.label }}
        </button>
        <button ref="childClose" type="button" @click="cancelChild()">
          {{ canUpdate ? "取消" : "关闭" }}{{ childEditing.column.label }}
        </button>
      </section>
    </div>
  </section>
</template>
