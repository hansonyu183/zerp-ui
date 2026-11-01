<script
  setup
  lang="ts"
  generic="
    R extends object,
    T = never,
    A extends ListAction = CrudAction,
    K extends string | number = string | number
  "
>
import Feedback from "./Feedback.vue";
import { VBtn, VCheckboxBtn, VTable } from "vuetify/components";
import { computed } from "vue";
import RowActions from "./RowActions.vue";
import {
  validateReportColumns,
  validateReportPresentation,
  validateReportSummary,
} from "./report";
import type {
  ReportCell,
  ReportSummary,
  ReportPresentation,
  ReportAppearance,
} from "./report";
import type { Column, Page, CrudAction, ListAction } from "./contracts";
const props = defineProps<{
  columns: readonly Column<R>[];
  result: Page<R>;
  page: number;
  pageSize: number;
  loading?: boolean;
  selectedKeys?: readonly (string | number)[];
  selectable?: (row: R) => boolean;
  actions?: (row: R) => readonly A[];
  viewHref?: (row: R) => string | undefined;
  disabled?: boolean;
  wide?: boolean;
  rowKey?: (row: R) => K;
  summary?: ReportSummary<R>;
  presentation?: ReportPresentation<R, K>;
  cell?: (row: R, key: Extract<keyof R, string>) => ReportCell<T> | undefined;
}>();
const presentationError = computed(() => {
  try {
    validateReportColumns(props.columns);
    validateReportPresentation(
      props.columns,
      props.result.items,
      props.rowKey,
      props.presentation,
    );
    if (props.summary) validateReportSummary(props.columns, props.summary);
    return "";
  } catch (caught) {
    return caught instanceof Error ? caught.message : "列表呈现不正确。";
  }
});
const presentationStyle = (row: R, key?: Extract<keyof R, string>) => {
  const p = props.presentation?.rows.find(
    (entry) => entry.rowId === props.rowKey?.(row),
  );
  const a: ReportAppearance = {
    ...p?.appearance,
    ...(key ? p?.cells?.[key] : {}),
  };
  const color = (v: string | undefined) =>
    v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
  return {
    color: color(a.foreground),
    backgroundColor: color(a.background),
    fontWeight: a.bold === undefined ? undefined : a.bold ? "bold" : "normal",
    fontStyle:
      a.italic === undefined ? undefined : a.italic ? "italic" : "normal",
    textAlign: a.align,
  };
};
const groups = (row: R, start: boolean) =>
  props.presentation?.groups
    .filter((g) => (start ? g.firstKey : g.lastKey) === props.rowKey?.(row))
    .slice()
    .sort((a, b) => (start ? a.level - b.level : b.level - a.level)) ?? [];
const colspan = computed(
  () =>
    visibleColumns.value.length +
    (props.selectedKeys !== undefined ? 1 : 0) +
    (hasActions.value ? 1 : 0),
);
const emit = defineEmits<{
  "update:selectedKeys": [keys: (string | number)[]];
  cell: [cell: ReportCell<T>, row: R];
  page: [value: number];
  action: [action: A, row: R];
}>();
const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
);
const rowActions = computed(() =>
  props.result.items.map((row) => props.actions?.(row) ?? []),
);
const hasActions = computed(() =>
  rowActions.value.some((actions) => actions.length),
);
// Without a consumer key, retain object identity rather than rebinding an open menu by array index.
// Selection and report presentation still require the consumer's exact rowKey.
const objectKeys = new WeakMap<R, symbol>();
function renderKey(row: R) {
  if (props.rowKey) return props.rowKey(row);
  let key = objectKeys.get(row);
  if (!key) {
    key = Symbol();
    objectKeys.set(row, key);
  }
  return key;
}
function identity(row: R) {
  if (!props.rowKey) throw Error("Selectable DataList requires rowKey");
  return props.rowKey(row);
}
const eligible = computed(() =>
  props.result.items.filter((row) => props.selectable?.(row) !== false),
);
const allSelected = computed(
  () =>
    eligible.value.length > 0 &&
    eligible.value.every((row) => props.selectedKeys?.includes(identity(row))),
);
function selectRows(rows: readonly R[], selected: boolean) {
  if (props.disabled || props.loading || presentationError.value) return;
  const keys = new Set(props.selectedKeys ?? []);
  for (const row of rows) {
    if (!props.result.items.includes(row) || props.selectable?.(row) === false)
      continue;
    const key = identity(row);
    if (selected) keys.add(key);
    else keys.delete(key);
  }
  const visible = new Set<string | number>(eligible.value.map(identity));
  emit(
    "update:selectedKeys",
    [...keys].filter((key) => visible.has(key)),
  );
}
function dispatch(action: ListAction, row: R) {
  if (
    !props.disabled &&
    !props.loading &&
    !presentationError.value &&
    props.result.items.includes(row) &&
    props.actions?.(row).includes(action as A)
  )
    emit("action", action as A, row);
}
function activateCell(
  event: MouseEvent,
  row: R,
  key: Extract<keyof R, string>,
) {
  if (
    props.disabled ||
    presentationError.value ||
    !props.result.items.includes(row)
  ) {
    event.preventDefault();
    return;
  }
  const intent = props.cell?.(row, key);
  if (!intent || intent.disabled) {
    event.preventDefault();
    return;
  }
  if (
    intent.kind !== "record" ||
    (!event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.button === 0)
  )
    emit("cell", intent, row);
}
function display(row: Partial<R>, column: Column<R>) {
  const value = row[column.key];
  return value === null || value === undefined
    ? "—"
    : value === ""
      ? "（空字符串）"
      : column.type === "boolean"
        ? value
          ? "是"
          : "否"
        : column.type === "enum"
          ? (column.options?.find((option) => option.value === value)?.label ??
            String(value))
          : String(value);
}
</script>
<template>
  <div
    class="zerp-list"
    :class="{ 'zerp-list--wide': wide }"
    :aria-busy="loading"
  >
    <Feedback :message="presentationError" kind="error" />
    <template v-if="!presentationError">
      <p v-if="summary">{{ summary.caption }}</p>
      <VTable hover>
        <thead>
          <tr>
            <th v-if="selectedKeys !== undefined" scope="col">
              <VCheckboxBtn
                aria-label="全选当前页"
                :model-value="allSelected"
                :indeterminate="
                  !allSelected &&
                  eligible.some((row) => selectedKeys?.includes(identity(row)))
                "
                :disabled="disabled || loading || !eligible.length"
                @update:model-value="selectRows(eligible, !!$event)"
              />
            </th>
            <th
              v-for="column in visibleColumns"
              :key="column.key"
              scope="col"
              :style="{
                width: column.width,
                minWidth: wide ? column.width : undefined,
              }"
            >
              {{ column.label }}
            </th>
            <th v-if="hasActions" scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, index) in result.items" :key="renderKey(row)">
            <tr
              v-for="group in groups(row, true)"
              :key="'group-start:' + group.id"
              class="zerp-report-group"
            >
              <th :colspan="colspan" scope="rowgroup">
                {{ group.label }}{{ group.continuedBefore ? "（续）" : "" }}
              </th>
            </tr>
            <tr :style="presentationStyle(row)">
              <td v-if="selectedKeys !== undefined" data-label="选择">
                <VCheckboxBtn
                  :aria-label="`选择 ${identity(row)}`"
                  :model-value="selectedKeys.includes(identity(row))"
                  :disabled="disabled || loading || selectable?.(row) === false"
                  @update:model-value="selectRows([row], !!$event)"
                />
              </td>
              <td
                v-for="column in visibleColumns"
                :key="column.key"
                :data-label="column.label"
                :style="presentationStyle(row, column.key)"
              >
                <template
                  v-for="intent in [cell?.(row, column.key)]"
                  :key="column.key"
                >
                  <a
                    v-if="
                      intent?.kind === 'record' && !disabled && !intent.disabled
                    "
                    :style="presentationStyle(row, column.key)"
                    :href="intent.href"
                    :aria-label="intent.label"
                    @click="activateCell($event, row, column.key)"
                    >{{ display(row, column) }}</a
                  >
                  <VBtn
                    v-else-if="intent"
                    variant="text"
                    color="on-surface"
                    type="button"
                    :aria-label="intent.label"
                    :style="presentationStyle(row, column.key)"
                    :disabled="disabled || intent.disabled"
                    @click="activateCell($event, row, column.key)"
                  >
                    {{ display(row, column) }}
                  </VBtn>
                  <template v-else>{{ display(row, column) }}</template>
                </template>
              </td>
              <td v-if="hasActions" data-label="操作">
                <RowActions
                  :actions="rowActions[index]!"
                  :disabled="disabled || loading"
                  :view-href="viewHref?.(row)"
                  @action="dispatch($event, row)"
                />
              </td>
            </tr>
            <tr
              v-for="group in groups(row, false)"
              :key="'group-end:' + group.id"
              class="zerp-report-group-summary"
            >
              <td v-if="selectedKeys !== undefined"></td>
              <td
                v-for="(column, index) in visibleColumns"
                :key="column.key"
                :data-label="column.label"
              >
                <span v-if="index === 0"
                  >{{ group.summary.caption
                  }}{{ group.continuedAfter ? "（续）" : "" }}</span
                >{{
                  Object.hasOwn(group.summary.values, column.key)
                    ? display(group.summary.values, column)
                    : ""
                }}
              </td>
              <td v-if="hasActions"></td>
            </tr>
          </template>
        </tbody>
        <tfoot v-if="summary">
          <tr>
            <td v-if="selectedKeys !== undefined"></td>
            <td
              v-for="column in visibleColumns"
              :key="column.key"
              :data-label="column.label"
            >
              {{ display(summary.values, column) }}
            </td>
            <td v-if="hasActions"></td>
          </tr>
        </tfoot>
      </VTable>
      <p v-if="!loading && !result.items.length">暂无数据</p>
      <nav aria-label="分页">
        <VBtn
          type="button"
          :disabled="page <= 1 || loading || disabled"
          @click="emit('page', page - 1)"
        >
          上一页</VBtn
        ><span
          >第 {{ page }} 页<span v-if="result.total !== undefined">
            · 共 {{ result.total }} 条</span
          ></span
        ><VBtn
          type="button"
          :disabled="
            disabled ||
            loading ||
            (result.total !== undefined
              ? page * pageSize >= result.total
              : !result.hasMore)
          "
          @click="emit('page', page + 1)"
        >
          下一页
        </VBtn>
      </nav>
    </template>
  </div>
</template>
