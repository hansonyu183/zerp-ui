<script setup lang="ts" generic="R extends object, T = never">
import { computed } from "vue";
import type { ReportCell, ReportSummary } from "./report";
import type { Column, Page, CrudAction } from "./contracts";
const props = defineProps<{
  columns: readonly Column<R>[];
  result: Page<R>;
  page: number;
  pageSize: number;
  loading?: boolean;
  actions?: (row: R) => readonly CrudAction[];
  disabled?: boolean;
  wide?: boolean;
  rowKey?: (row: R) => string | number;
  summary?: ReportSummary<R>;
  cell?: (row: R, key: Extract<keyof R, string>) => ReportCell<T> | undefined;
}>();
const emit = defineEmits<{
  cell: [cell: ReportCell<T>, row: R];
  page: [value: number];
  action: [action: CrudAction, row: R];
}>();
const visibleColumns = computed(() =>
  props.columns.filter((c) => c.visible !== false),
);
const captions = {
  edit: "编辑",
  enable: "启用",
  disable: "停用",
  delete: "删除",
};
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
          <th v-if="actions" scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in result.items"
          :key="rowKey ? rowKey(row) : index"
        >
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
          <td v-if="actions" data-label="操作">
            <button
              v-for="action in actions?.(row)"
              :key="action"
              type="button"
              :disabled="disabled"
              @click="emit('action', action, row)"
            >
              {{ captions[action] }}
            </button>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="summary">
        <tr>
          <td
            v-for="column in visibleColumns"
            :key="column.key"
            :data-label="column.label"
          >
            {{ display(summary.values, column) }}
          </td>
          <td v-if="actions"></td>
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
