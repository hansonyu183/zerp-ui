<script
  setup
  lang="ts"
  generic="H extends object, R extends object, C extends object = object"
>
import { useDisplay } from "vuetify";
import RowActions from "./RowActions.vue";
import { injectDefaults } from "vuetify/lib/composables/defaults.js";
import {
  VDefaultsProvider,
  VBtn,
  VCard,
  VTable,
  VDialog,
} from "vuetify/components";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { clone, message } from "./clone";
import { equalValues } from "./editor-values";
import DynamicForm from "./DynamicForm.vue";
import FactFields from "./FactFields.vue";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
import { formFacts, factText } from "./details";
import type { Fields } from "./contracts";
import type {
  VoucherEditorChildColumn,
  VoucherEditorColumn,
  VoucherEditorDefinition,
  VoucherEditorValue,
  VoucherEditorChange,
} from "./voucher-editor";

// VDialog starts a Vuetify defaults root; preserve this page's preset and bounded overlays.
const pageDefaults = injectDefaults();
const { xs } = useDisplay();
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
  "update:modelValue": [
    value: VoucherEditorValue<H, R>,
    change: VoucherEditorChange,
  ];
  pending: [value: boolean];
}>();
const formMode = computed(() => props.formMode ?? "edit");
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
const activeRowFields = computed<Fields<R>>(() =>
  typeof props.rowFields === "function"
    ? editing.value?.value
      ? props.rowFields(clone(editing.value.value))
      : ([] as unknown as Fields<R>)
    : props.rowFields,
);
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
const childInvalid = ref(false);
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
  if (writable.value && !preparing.value && !editing.value?.candidate)
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
    token: Symbol(),
    parentKey: props.rowKey(row),
    column,
    rows: clone(Array.isArray(row[column.key]) ? (row[column.key] as C[]) : []),
    sourceRows: props.modelValue.rows,
  };
  pending();
  nextTick(() => childClose.value[0]?.$el?.focus());
}
const childColumn = computed(() => childEditing.value?.column);
const childFields = computed(
  () =>
    (childColumn.value
      ? [
          {
            key: "items",
            label: childColumn.value.label,
            type: "rows",
            fields: childColumn.value.fields,
            empty: childColumn.value.empty,
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
  childInvalid.value = false;
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
  if (!draft || !canUpdate.value || childPending.value || childInvalid.value)
    return;
  if (!equalValues(props.modelValue.rows, draft.sourceRows)) {
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
watch(
  () => [
    props.scope,
    props.instance,
    props.mode,
    props.formMode,
    props.disabled,
  ],
  reset,
  {
    flush: "sync",
  },
);
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
    if (childEditing.value && !equalValues(rows, childEditing.value.sourceRows))
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
const tableColumns = computed(() => {
  const data = visibleColumns.value.map((column) => ({
    kind: "data" as const,
    column,
    key: `field:${column.key}`,
  }));
  if (!writable.value) return data;
  const action = { kind: "actions" as const, key: "actions" };
  return xs.value
    ? [...data, action]
    : [...data.slice(0, 1), action, ...data.slice(1)];
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
        :mode="formMode"
        :disabled="!writable || preparing"
        @update:model-value="setHeader"
        @pending="
          headerPending = $event;
          pending();
        "
      />
    </div>
    <FeedbackRegion>
      <Feedback :message="error" kind="error" />
      <Feedback :message="preparing ? '正在更新明细…' : undefined" persistent />
    </FeedbackRegion>
    <div class="zerp-voucher-editor__table">
      <component
        :is="xs ? 'div' : VTable"
        aria-label="单据明细"
        class="zerp-compact-table"
        density="compact"
        :class="{ 'zerp-record-cards': xs }"
      >
        <thead v-if="!xs">
          <tr>
            <th
              v-for="entry in tableColumns"
              :key="entry.key"
              scope="col"
              :class="{ 'zerp-list__actions': entry.kind === 'actions' }"
            >
              {{ entry.kind === "actions" ? "操作" : entry.column.label }}
            </th>
          </tr>
        </thead>
        <component
          :is="xs ? 'div' : 'tbody'"
          :class="{ 'zerp-record-cards': xs }"
        >
          <component
            :is="xs ? VCard : 'tr'"
            :tag="xs ? 'article' : undefined"
            :variant="xs ? 'outlined' : undefined"
            :class="{ 'zerp-record-card': xs }"
            v-for="(row, index) in visibleValue.rows"
            :key="rowKey(row)"
            :aria-label="xs ? `明细行 ${index + 1}` : undefined"
          >
            <component
              :is="xs ? 'div' : 'td'"
              v-for="entry in tableColumns"
              :key="entry.key"
              :data-label="
                entry.kind === 'actions' ? '操作' : entry.column.label
              "
              :class="{ 'zerp-list__actions': !xs && entry.kind === 'actions' }"
            >
              <template v-if="entry.kind === 'data'">
                <span v-if="xs" class="zerp-record-card__label">{{
                  entry.column.label
                }}</span>
                <template v-if="entry.column.type === 'children'">
                  <VBtn
                    color=""
                    variant="tonal"
                    type="button"
                    :disabled="
                      preparing ||
                      !!editing ||
                      !!childEditing ||
                      (mode === 'edit' && !!disabled)
                    "
                    @click="beginChild(row, entry.column, $event)"
                  >
                    {{ canUpdate ? "编辑" : "查看" }}{{ entry.column.label }} ·
                    明细行
                    {{ index + 1 }}
                  </VBtn>
                  <span>{{ display(row, entry.column) }}</span>
                </template>
                <template v-else>{{ display(row, entry.column) }}</template>
              </template>
              <template v-else>
                <RowActions
                  :actions="[
                    ...(canUpdate ? ['edit' as const] : []),
                    ...(canDelete ? ['delete' as const] : []),
                  ]"
                  :disabled="preparing || !!editing || !!childEditing"
                  @action="
                    $event === 'edit' ? begin(row) : (deleting = rowKey(row))
                  "
                />
                <span v-if="deleting === rowKey(row)">
                  确认删除该行？
                  <VBtn
                    color="error"
                    variant="flat"
                    type="button"
                    @click="removeRow"
                  >
                    确认删除
                  </VBtn>
                  <VBtn
                    color=""
                    variant="tonal"
                    type="button"
                    @click="deleting = null"
                    >取消删除</VBtn
                  >
                </span>
              </template>
            </component>
          </component>
        </component>
      </component>
      <p v-if="visibleValue.rows.length === 0">暂无明细行</p>
      <VBtn
        color=""
        variant="tonal"
        v-if="canInsert"
        type="button"
        :disabled="preparing || !!editing || !!childEditing"
        @click="begin()"
      >
        新增
      </VBtn>
    </div>
    <VCard
      tag="section"
      class="zerp-business-card pa-4"
      v-if="editing"
      role="region"
      aria-label="编辑明细行"
    >
      <p v-if="!editing.value">该明细行已移除。</p>
      <DynamicForm
        v-else
        :key="rowFormVersion"
        :fields="activeRowFields"
        :model-value="editing.value"
        :scope="scope"
        :mode="formMode"
        :disabled="!writable || preparing"
        @update:model-value="changeRow"
        @pending="
          rowPending = $event;
          pending();
        "
      />
      <VBtn
        color="primary"
        variant="flat"
        type="button"
        :disabled="!writable || preparing || rowPending"
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
      ><VDefaultsProvider :defaults="pageDefaults"
        ><VCard class="pa-4" max-height="100%" style="overflow-y: auto">
          <FactFields
            v-if="!canUpdate"
            :fields="formFacts(childFields)"
            :value="{ items: child.rows }"
          />
          <DynamicForm
            v-else
            :fields="childFields"
            :model-value="{ items: child.rows }"
            :scope="scope"
            :mode="formMode"
            :disabled="!writable || preparing"
            @update:model-value="
              childEditing?.token === child.token &&
              (childEditing = { ...child, rows: $event.items })
            "
            @validation="
              childEditing?.token === child.token &&
              (childInvalid = !$event.valid)
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
            v-if="canUpdate"
            type="button"
            :disabled="childPending || childInvalid"
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
            {{ canUpdate ? "取消" : "关闭" }}{{ child.column.label }}
          </VBtn>
        </VCard></VDefaultsProvider
      ></VDialog
    >
  </section>
</template>
