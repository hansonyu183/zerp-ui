<script setup lang="ts">
// 将集合模型投影为列表行、操作和报表呈现事实，并将交互交回集合视图。
import { isPending } from "../../usePending";
import { runOperation } from "../../node-actions";
import {
  nodeOperations,
  type NodeOrCollection,
} from "../../../model/operations";
import type { QueryView } from "../reads";

import { computed, toRaw } from "vue";
import { useDisplay } from "vuetify";
import DataList from "./list/DataList.vue";
import FeedbackRegion from "../../../components/feedback/FeedbackRegion.vue";
import Feedback from "../../../components/feedback/Feedback.vue";
import type { Column } from "./list/types";
import { rowActionIcons, type RowAction } from "./list/row-action";
import type { ReportCell } from "./list/report";
import type { ReportPresentation } from "../../../model/report";
import type {
  CollectionTarget,
  ListCollection,
  ObjectNode,
} from "../../../model/business-model";
import { readable as nodeReadable } from "../../nodes";
import type { FieldNode } from "../../../model/business-model";
import { formatField } from "../../../components/forms/model-format";
import { targetStamp } from "../../target";
import { resolveTarget } from "../work-router";
type Values = Record<string, string | number | boolean | null>;
const props = defineProps<{
  node: ListCollection;
  queryView?: QueryView;
  canQuery: boolean;
}>();
const emit = defineEmits<{
  page: [page: number];
  open: [
    record: ObjectNode,
    mode: "read" | "edit",
    restoreFocus: () => HTMLElement | null,
  ];
  print: [record: ObjectNode];
  visit: [target: CollectionTarget];
}>();
const { xs } = useDisplay();
// 每行建立一次成员索引，供格式化、样式和合计共用。
const rowFields = computed(() => {
  const fields = new Map<
    ObjectNode,
    Map<string, ObjectNode["members"][number]>
  >();
  const byIdentity = new Map<string, ObjectNode>();
  for (const row of props.node.items) {
    const members = new Map<string, ObjectNode["members"][number]>();
    for (const member of row.members)
      if (!members.has(member.key)) members.set(member.key, member);
    fields.set(row, members);
    if (row.identity !== null && !byIdentity.has(row.identity))
      byIdentity.set(row.identity, row);
  }
  return { fields, byIdentity };
});
function field(row: ObjectNode, key: string) {
  return rowFields.value.fields.get(row)?.get(key);
}
const readableRows = computed(() => props.node.items.filter(nodeReadable));
const columns = computed<Column<Values>[]>(() =>
  props.node.columns.filter((column) =>
    readableRows.value.every((row) => {
      const n = field(row, column.key);
      return !n || nodeReadable(n);
    }),
  ),
);
function display(node: NodeOrCollection | undefined): Values[string] {
  if (!node || !nodeReadable(node) || !("value" in node)) return null;
  try {
    return formatField(node as FieldNode);
  } catch (error) {
    return error instanceof Error ? error.message : "格式错误";
  }
}
const modelError = computed(() =>
  readableRows.value
    .flatMap((row) =>
      props.node.columns
        .filter((column) => !field(row, column.key))
        .map(
          (column) =>
            `${props.node.label} / ${row.identity ?? row.key} / ${column.key}：列引用的成员不存在`,
        ),
    )
    .join("\n"),
);
const projected = computed(() => {
  const originals = new Map<Values, ObjectNode>();
  const rows = readableRows.value.map((row) => {
    const values = Object.fromEntries(
      columns.value.map((column) => [
        column.key,
        display(field(row, column.key)),
      ]),
    );
    originals.set(values, row);
    return values;
  });
  return { rows, originals };
});
const original = (row: Values) => projected.value.originals.get(row);
function key(row: Values) {
  const node = original(row)!;
  return node.identity ?? String(props.node.items.indexOf(node));
}
function rowViewAction(source: ObjectNode) {
  if (!source.businessType) return;
  const update = source.operations.update;
  return update && !update.disabled ? "edit" : "view";
}
function canPrintRow(source: ObjectNode) {
  return (
    !!props.node.itemPrintTemple &&
    source.identity !== null &&
    source.printable &&
    nodeReadable(props.node)
  );
}
function rowOperation(action: string): action is RowAction {
  return (
    action !== "view" &&
    action !== "edit" &&
    Object.hasOwn(rowActionIcons, action) &&
    !(action === "print" && props.node.itemPrintTemple)
  );
}
function actions(row: Values): RowAction[] {
  const source = original(row);
  if (!source || !nodeReadable(source)) return [];
  const result: RowAction[] = [];
  const view = rowViewAction(source);
  if (view) result.push(view);
  if (canPrintRow(source)) result.push("print");
  for (const [action, operation] of Object.entries(nodeOperations(source)))
    if (operation && !operation.disabled && rowOperation(action))
      result.push(action);
  return result;
}
function showAllActions(row: Values) {
  return !xs.value && !!original(row)?.workflow;
}
function reasons(
  row: Values,
  rowActions: readonly RowAction[],
): Partial<Record<RowAction, string>> {
  const source = original(row);
  return source && isPending(source)
    ? Object.fromEntries(rowActions.map((action) => [action, "正在处理"]))
    : {};
}
function select(action: RowAction, row: Values) {
  const source = original(row);
  if (
    !source ||
    !props.node.items.includes(source) ||
    !nodeReadable(source) ||
    isPending(source)
  )
    return;
  if (action === "print" && props.node.itemPrintTemple) {
    if (canPrintRow(source)) emit("print", source);
    return;
  }
  if (action === "view" || action === "edit") {
    if (rowViewAction(source) !== action) return;
    const trigger = document.activeElement;
    const list = trigger?.closest(".zerp-list");
    const recordKey = trigger
      ?.closest("[data-record-key]")
      ?.getAttribute("data-record-key");
    const restoreFocus = () => {
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        !trigger.matches(":disabled")
      )
        return trigger;
      if (!list?.isConnected || recordKey == null) return null;
      const row = Array.from(list.querySelectorAll("[data-record-key]")).find(
        (element) => element.getAttribute("data-record-key") === recordKey,
      );
      const action = row?.querySelector<HTMLElement>(
        '[data-row-action="edit"], [data-row-action="view"]',
      );
      if (!action) return null;
      return action.matches(":disabled")
        ? action.closest<HTMLElement>('[tabindex="0"]')
        : action;
    };
    emit("open", source, action === "edit" ? "edit" : "read", restoreFocus);
  } else void runOperation(source, action);
}
// 合计由消费者提供，只有当前页所有记录及该列成员均可读时才展示该列合计。
const aggregateColumns = computed(() =>
  columns.value.filter((column) =>
    props.node.items.every((row) => {
      const member = field(row, column.key);
      return nodeReadable(row) && !!member && nodeReadable(member);
    }),
  ),
);
function filterValues(values: Partial<Values>): Partial<Values> {
  return Object.fromEntries(
    aggregateColumns.value
      .filter((column) => Object.hasOwn(values, column.key))
      .map((column) => [column.key, values[column.key]]),
  );
}
const summary = computed(() =>
  props.node.report?.summary
    ? {
        caption: props.node.report.summary.caption,
        values: filterValues(props.node.report.summary.values),
      }
    : undefined,
);
const presentation = computed<ReportPresentation<Values, string> | undefined>(
  () => {
    const value = props.node.report?.presentation;
    if (!value) return;
    const visible = (id: string) => {
      const row = rowFields.value.byIdentity.get(id);
      return !row || nodeReadable(row);
    };
    return {
      ...value,
      rows: value.rows
        .filter((row) => visible(row.rowId))
        .map((row) => ({
          ...row,
          cells: row.cells
            ? Object.fromEntries(
                Object.entries(row.cells).filter(([key]) => {
                  const record = rowFields.value.byIdentity.get(row.rowId),
                    node = record && field(record, key);
                  return (
                    !!node &&
                    nodeReadable(node) &&
                    columns.value.some((column) => column.key === key)
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
const reportCells = computed(() => {
  type Cell = NonNullable<
    NonNullable<ListCollection["report"]>["cells"]
  >[number];
  const rows = new Map<ObjectNode, Map<string, Cell>>();
  for (const fact of props.node.report?.cells ?? []) {
    const row = toRaw(fact.row);
    const fields = rows.get(row) ?? new Map<string, Cell>();
    if (!fields.has(fact.field)) fields.set(fact.field, fact);
    rows.set(row, fields);
  }
  return rows;
});
function cell(
  row: Values,
  key: string,
): ReportCell<CollectionTarget> | undefined {
  const source = original(row),
    node = source && field(source, key);
  if (!source || !node || !nodeReadable(node)) return;
  const fact = reportCells.value.get(toRaw(source))?.get(key);
  if (!fact || fact.disabled) return;
  const { target, label, kind } = fact;
  const destination = resolveTarget(target);
  if (!destination?.available) return;
  const href = kind === "record" ? destination.href : undefined;
  return href
    ? { kind: "record", target, label, href }
    : {
        kind: kind === "record" ? "detail" : kind,
        target,
        label,
        stamp: targetStamp(target),
      };
}
</script>
<template>
  <FeedbackRegion
    ><Feedback :message="modelError" kind="error"
  /></FeedbackRegion>
  <DataList
    :columns="columns"
    :result="{ items: projected.rows, total: node.total }"
    :page="
      queryView?.state === 'success'
        ? node.page
        : (queryView?.page ?? node.page)
    "
    :page-size="node.pageSize"
    :result-state="queryView?.state ?? 'success'"
    :paging-disabled="!canQuery || queryView?.state === 'failure'"
    :row-key="key"
    :summary="summary"
    :presentation="presentation"
    :cell="cell"
    :actions="actions"
    :disabled-actions="reasons"
    :show-all-actions="showAllActions"
    @page="emit('page', $event)"
    @action="select"
    @cell="emit('visit', $event.target)"
  />
</template>
