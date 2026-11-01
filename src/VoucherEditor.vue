<script
  setup
  lang="ts"
  generic="H extends object, R extends object, C extends object = object"
>
import { VBtn, VCard, VTable, VDialog } from "vuetify/components";
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
import FactFields from "./FactFields.vue";
import { formFacts, factText } from "./details";
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
    formMode?: "create" | "edit";
    disabled?: boolean;
  }
>();
const emit = defineEmits<{
  "update:modelValue": [value: VoucherEditorValue<H, R>];
  pending: [value: boolean];
}>();
const formMode = computed(() => props.formMode ?? "edit");
const writable = computed(() => props.mode === "edit" && !props.disabled);
const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
);
const editing = shallowRef<{ key: string | null; value: R } | null>(null);
const deleting = ref<string | null>(null);
const childEditing = shallowRef<{
  token: symbol;
  parentKey: string;
  column: VoucherEditorChildColumn<R, C>;
  rows: C[];
  sourceRows: readonly R[];
} | null>(null);
let childTrigger: HTMLButtonElement | null = null;
const childClose = ref<InstanceType<typeof VBtn>[]>([]);
const headerPending = ref(false);
const rowPending = ref(false);
const childPending = ref(false);
function pending() {
  emit(
    "pending",
    headerPending.value ||
      rowPending.value ||
      childPending.value ||
      !!editing.value ||
      (writable.value && !!childEditing.value),
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
  return factText(value, { ...column, type: column.type ?? "text" });
}
function beginChild(
  row: R,
  column: VoucherEditorChildColumn<R, C>,
  event: MouseEvent,
) {
  if (childEditing.value || editing.value) return;
  childTrigger = event.currentTarget as HTMLButtonElement;
  childEditing.value = {
    token: Symbol(),
    parentKey: props.rowKey(row),
    column,
    rows: clone(Array.isArray(row[column.key]) ? (row[column.key] as C[]) : []),
    sourceRows: props.modelValue.rows,
  };
  pending();
  nextTick(() => childClose.value[0]?.$el?.focus());
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
  const trigger = childTrigger,
    scope = props.scope,
    instance = props.instance;
  childTrigger = null;
  childEditing.value = null;
  childPending.value = false;
  pending();
  if (restoreFocus)
    nextTick(() => {
      if (
        props.scope === scope &&
        props.instance === instance &&
        !childEditing.value &&
        trigger?.isConnected
      )
        trigger.focus({ preventScroll: true });
    });
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
  pending();
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
watch(() => [props.scope, props.instance, props.mode, props.formMode], reset);
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
      <FactFields
        v-if="mode === 'read'"
        :key="`${scope}:${instance}`"
        :fields="formFacts(headerFields)"
        :value="modelValue.header"
      />
      <DynamicForm
        v-else
        :fields="headerFields"
        :model-value="modelValue.header"
        :scope="scope"
        :mode="formMode"
        :disabled="!writable"
        @update:model-value="setHeader"
        @pending="
          headerPending = $event;
          pending();
        "
      />
    </div>
    <div class="zerp-voucher-editor__table">
      <VTable aria-label="单据明细">
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
                <VBtn
                  color=""
                  variant="tonal"
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
                </VBtn>
                <span>{{ display(row, column) }}</span>
              </template>
              <template v-else>{{ display(row, column) }}</template>
            </td>
            <td v-if="writable" data-label="操作">
              <VBtn
                color=""
                variant="tonal"
                type="button"
                :disabled="!!editing || !!childEditing"
                @click="begin(row)"
              >
                编辑明细行 {{ index + 1 }}
              </VBtn>
              <VBtn
                color=""
                variant="tonal"
                type="button"
                :disabled="!!editing || !!childEditing"
                @click="deleting = rowKey(row)"
              >
                删除明细行 {{ index + 1 }}
              </VBtn>
              <span v-if="deleting === rowKey(row)">
                确认删除该行？
                <VBtn
                  color="error"
                  variant="flat"
                  type="button"
                  @click="removeRow"
                >
                  确认删除明细行 {{ index + 1 }}
                </VBtn>
                <VBtn
                  color=""
                  variant="tonal"
                  type="button"
                  @click="deleting = null"
                  >取消删除</VBtn
                >
              </span>
            </td>
          </tr>
        </tbody>
      </VTable>
      <p v-if="modelValue.rows.length === 0">暂无明细行</p>
      <VBtn
        color=""
        variant="tonal"
        v-if="writable"
        type="button"
        :disabled="!!editing || !!childEditing"
        @click="begin()"
      >
        新增明细行
      </VBtn>
    </div>
    <VCard
      tag="section"
      class="zerp-business-card pa-4"
      v-if="editing"
      role="region"
      aria-label="编辑明细行"
    >
      <DynamicForm
        :fields="rowFields"
        :model-value="editing.value"
        :scope="scope"
        :mode="formMode"
        :disabled="!writable"
        @update:model-value="editing = { ...editing!, value: $event }"
        @pending="
          rowPending = $event;
          pending();
        "
      />
      <VBtn
        color="primary"
        variant="flat"
        type="button"
        :disabled="!writable || rowPending"
        @click="finishRow"
      >
        确定明细行
      </VBtn>
      <VBtn color="" variant="tonal" type="button" @click="cancelRow"
        >取消明细行</VBtn
      >
    </VCard>
    <VDialog
      class="zerp-voucher-child-dialog"
      v-for="child in childEditing ? [childEditing] : []"
      :key="scope + ':' + instance + ':' + child.parentKey"
      :model-value="true"
      max-width="720"
      scrollable
      @update:model-value="
        !$event && childEditing?.token === child.token && cancelChild()
      "
      @after-enter="
        childEditing?.token === child.token && childClose[0]?.$el?.focus()
      "
      :aria-label="`${child.column.label} · 明细行 ${modelValue.rows.findIndex((row) => rowKey(row) === child.parentKey) + 1}`"
      ><VCard class="pa-4" max-height="100%" style="overflow-y: auto">
        <FactFields
          v-if="mode === 'read'"
          :fields="formFacts(childFields)"
          :value="{ items: child.rows }"
        />
        <DynamicForm
          v-else
          :fields="childFields"
          :model-value="{ items: child.rows }"
          :scope="scope"
          :mode="formMode"
          :disabled="!writable"
          @update:model-value="
            childEditing?.token === child.token &&
            (childEditing = { ...child, rows: $event.items })
          "
          @pending="
            if (childEditing?.token === child.token) {
              childPending = $event;
              pending();
            }
          "
        />
        <VBtn
          color="primary"
          variant="flat"
          v-if="writable"
          type="button"
          :disabled="childPending"
          @click="childEditing?.token === child.token && finishChild()"
        >
          确定{{ child.column.label }}
        </VBtn>
        <VBtn
          color=""
          variant="tonal"
          ref="childClose"
          type="button"
          @click="childEditing?.token === child.token && cancelChild()"
        >
          {{ writable ? "取消" : "关闭" }}{{ child.column.label }}
        </VBtn>
      </VCard></VDialog
    >
  </section>
</template>
