<script
  setup
  lang="ts"
  generic="R extends object, T = never, A extends ListAction = CrudAction"
>
import { computed } from "vue";
import RowActions from "./RowActions.vue";
import type { ReportCell, ReportSummary } from "./report";
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
  rowKey?: (row: R) => string | number;
  summary?: ReportSummary<R>;
  cell?: (row: R, key: Extract<keyof R, string>) => ReportCell<T> | undefined;
}>();
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
  if (props.disabled || props.loading) return;
  const keys = new Set(props.selectedKeys ?? []);
  for (const row of rows) {
    if (props.selectable?.(row) === false) continue;
    const key = identity(row);
    if (selected) keys.add(key);
    else keys.delete(key);
  }
  const visible = new Set(eligible.value.map(identity));
  emit(
    "update:selectedKeys",
    [...keys].filter((key) => visible.has(key)),
  );
}
function dispatch(action: ListAction, row: R) {
  if (
    !props.disabled &&
    !props.loading &&
    props.actions?.(row).includes(action as A)
  )
    emit("action", action as A, row);
}
function record(event: MouseEvent, intent: ReportCell<T>, row: R) {
  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
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
    <p v-if="summary">{{ summary.caption }}</p>
    <table>
      <thead>
        <tr>
          <th v-if="selectedKeys !== undefined" scope="col">
            <input
              type="checkbox"
              aria-label="全选当前页"
              :checked="allSelected"
              :indeterminate="
                !allSelected &&
                eligible.some((row) => selectedKeys?.includes(identity(row)))
              "
              :disabled="disabled || loading || !eligible.length"
              @change="
                selectRows(
                  eligible,
                  ($event.target as HTMLInputElement).checked,
                )
              "
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
        <tr
          v-for="(row, index) in result.items"
          :key="rowKey ? rowKey(row) : index"
        >
          <td v-if="selectedKeys !== undefined" data-label="选择">
            <input
              type="checkbox"
              :aria-label="`选择 ${identity(row)}`"
              :checked="selectedKeys.includes(identity(row))"
              :disabled="disabled || loading || selectable?.(row) === false"
              @change="
                selectRows([row], ($event.target as HTMLInputElement).checked)
              "
            />
          </td>
          <td
            v-for="column in visibleColumns"
            :key="column.key"
            :data-label="column.label"
          >
            <template
              v-for="intent in [cell?.(row, column.key)]"
              :key="column.key"
            >
              <a
                v-if="
                  intent?.kind === 'record' && !disabled && !intent.disabled
                "
                :href="intent.href"
                :aria-label="intent.label"
                @click="record($event, intent, row)"
                >{{ display(row, column) }}</a
              >
              <button
                v-else-if="intent"
                type="button"
                :aria-label="intent.label"
                :disabled="disabled || intent.disabled"
                @click="emit('cell', intent, row)"
              >
                {{ display(row, column) }}
              </button>
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
    </table>
    <p v-if="!loading && !result.items.length">暂无数据</p>
    <nav aria-label="分页">
      <button
        type="button"
        :disabled="page <= 1 || loading || disabled"
        @click="emit('page', page - 1)"
      >
        上一页</button
      ><span
        >第 {{ page }} 页<span v-if="result.total !== undefined">
          · 共 {{ result.total }} 条</span
        ></span
      ><button
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
      </button>
    </nav>
  </div>
</template>
