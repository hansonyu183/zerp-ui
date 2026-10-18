<script setup lang="ts" generic="R extends object">
import { computed } from "vue";
import type { Column, Page, CrudAction } from "./contracts";
const props = defineProps<{
  columns: readonly Column<R>[];
  result: Page<R>;
  page: number;
  pageSize: number;
  loading?: boolean;
  actions?: (row: R) => readonly CrudAction[];
  disabled?: boolean;
}>();
const emit = defineEmits<{
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
</script>
<template>
  <div class="zerp-list" :aria-busy="loading">
    <table>
      <thead>
        <tr>
          <th
            v-for="column in visibleColumns"
            :key="column.key"
            scope="col"
            :style="{ width: column.width }"
          >
            {{ column.label }}
          </th>
          <th v-if="actions" scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in result.items" :key="index">
          <td
            v-for="column in visibleColumns"
            :key="column.key"
            :data-label="column.label"
          >
            {{ display(row, column) }}
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
    </table>
    <p v-if="!loading && !result.items.length">暂无数据</p>
    <nav aria-label="分页">
      <button
        type="button"
        :disabled="page <= 1 || loading"
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
