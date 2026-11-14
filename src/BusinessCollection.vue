<script setup lang="ts">
import { computed, inject, toRaw } from "vue";
import DataList from "./DataList.vue";
import type { Column } from "./contracts";
import type { ReportCell, ReportPresentation } from "./report";
import { nodeMetadata as meta } from "./model-node";
import {
  directRuntimeKey,
  type Node,
  type CollectionNode,
  type ObjectNode,
  type Target,
} from "./direct-model-runtime";
type Values = Record<string, string | number | boolean | null>;
const props = defineProps<{
  node: CollectionNode;
  loading: boolean;
  canQuery: boolean;
}>();
const emit = defineEmits<{ page: [page: number] }>();
const runtime = inject(directRuntimeKey)!;
const columns = computed<Column<Values>[]>(() =>
  props.node[meta].list
    .filter((key) => runtime.readable(props.node[meta].element[key]!))
    .map((key) => {
      const field = props.node[meta].element[key]!;
      const kind = field[meta].kind;
      return {
        key,
        label: field[meta].name,
        type:
          kind === "decimal" ||
          kind === "integer" ||
          kind === "date" ||
          kind === "boolean"
            ? kind
            : "text",
      };
    }),
);
function display(field: Node | undefined): Values[string] {
  if (!field || !runtime.readable(field)) return null;
  if (field[meta].kind === "secret" || field[meta].kind === "password")
    return "••••••";
  if (!("value" in field)) return null;
  if (field[meta].kind === "reference") {
    const value = (field as Extract<Node, { [meta]: { kind: "reference" } }>)
      .value;
    return Array.isArray(value)
      ? value.map((item) => item.label).join("、")
      : (value?.label ?? null);
  }
  if (field[meta].kind === "enum") {
    const selected = field as Extract<Node, { [meta]: { kind: "enum" } }>;
    return (
      selected[meta].options.find((option) => option.id === selected.value)
        ?.name ?? selected.value
    );
  }
  return typeof field.value === "string" ||
    typeof field.value === "number" ||
    typeof field.value === "boolean"
    ? field.value
    : null;
}
// This is an ephemeral display projection, never an editable record or saved baseline.
const projected = computed(() => {
  const originals = new Map<Values, ObjectNode>();
  const rows = props.node.items
    .filter((row) => runtime.readable(row))
    .map((row) => {
      const values = Object.fromEntries(
        columns.value.map((column) => [column.key, display(row[column.key])]),
      );
      originals.set(values, row);
      return values;
    });
  return { rows, originals };
});
function original(row: Values) {
  return projected.value.originals.get(row);
}
function key(row: Values) {
  const node = original(row)!;
  if (
    props.node[meta].report?.presentation &&
    node[meta].identity === undefined
  )
    throw Error("结构化报表记录必须提供稳定身份。");
  return node[meta].identity ?? String(props.node.items.indexOf(node));
}
function filterValues(values: Partial<Values>): Partial<Values> {
  return Object.fromEntries(
    columns.value
      .filter(
        (column) =>
          props.node.items.every(
            (row) =>
              runtime.readable(row) && runtime.readable(row[column.key]!),
          ) && Object.hasOwn(values, column.key),
      )
      .map((column) => [column.key, values[column.key]]),
  );
}
const summary = computed(() => {
  const value = props.node[meta].report?.summary;
  return value
    ? { caption: value.caption, values: filterValues(value.values) }
    : undefined;
});
const presentation = computed<ReportPresentation<Values, string> | undefined>(
  () => {
    const value = props.node[meta].report?.presentation;
    if (!value) return undefined;
    const visible = (id: string) => {
      const row = props.node.items.find((row) => row[meta].identity === id);
      return !row || runtime.readable(row);
    };
    return {
      ...value,
      rows: value.rows
        .filter((row) => visible(row.rowId))
        .map((row) => ({
          ...row,
          cells: row.cells
            ? Object.fromEntries(
                Object.entries(row.cells).filter(([field]) => {
                  const node = props.node.items.find(
                    (item) => item[meta].identity === row.rowId,
                  )?.[field];
                  return (
                    !!node &&
                    columns.value.some((column) => column.key === field) &&
                    runtime.readable(node)
                  );
                }),
              )
            : undefined,
        })),
      groups: value.groups
        .filter((group) => visible(group.firstKey) && visible(group.lastKey))
        .map((group) => ({
          ...group,
          summary: {
            caption: group.summary.caption,
            values: filterValues(group.summary.values),
          },
        })),
    };
  },
);
function cell(row: Values, field: string): ReportCell<Target> | undefined {
  const source = original(row);
  if (!source || !runtime.readable(source[field]!)) return;
  const fact = props.node[meta].report?.cells?.find(
    (item) => toRaw(item.row) === toRaw(source) && item.field === field,
  );
  if (!fact || !runtime.readable(fact.target)) return;
  const value = {
    kind: fact.kind,
    target: fact.target,
    label: fact.label,
    disabled: !!fact.disabledReason,
  };
  return fact.kind === "record"
    ? {
        ...value,
        kind: "record",
        href: runtime.model()[meta].navigation.href(fact.target),
      }
    : { ...value, kind: fact.kind };
}
function visit(value: ReportCell<Target>, row: Values) {
  const source = original(row);
  if (
    !source ||
    !props.node.items.includes(source) ||
    !runtime.readable(source) ||
    !runtime.readable(value.target)
  )
    return;
  const current = props.node[meta].report?.cells?.some(
    (fact) =>
      toRaw(fact.row) === toRaw(source) &&
      toRaw(fact.target) === toRaw(value.target) &&
      !fact.disabledReason &&
      runtime.readable(source[fact.field]!),
  );
  if (current) runtime.model()[meta].navigation.visit(value.target);
}
function select(_action: string, row: Values) {
  const source = original(row);
  if (source && props.node.items.includes(source) && runtime.readable(source))
    props.node.selected = source;
}
</script>
<template>
  <DataList
    :columns="columns"
    :result="{ items: projected.rows, total: node.total }"
    :page="node.page"
    :page-size="node.pageSize"
    :loading="loading"
    :paging-disabled="!canQuery"
    :row-key="key"
    :summary="summary"
    :presentation="presentation"
    :cell="cell"
    :actions="() => ['view']"
    empty-caption="暂无记录"
    @page="emit('page', $event)"
    @action="select"
    @cell="visit"
  />
</template>
