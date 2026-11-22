<script setup lang="ts">
import { computed, inject, toRaw } from "vue";
import DataList from "./DataList.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
import Feedback from "./Feedback.vue";
import type { Column } from "./contracts";
import { businessRowActions, type RowAction } from "./row-action";
import type { ReportCell, ReportPresentation } from "./report";
import type { CollectionTarget } from "./business-model";
import {
  directRuntimeKey,
  labels,
  type CollectionNode,
  type DirectRuntime,
  type ObjectNode,
  type Node,
} from "./direct-model-runtime";
import type { FieldNode } from "./business-model";
import { formatField } from "./model-format";
import { readableTarget as targetReadable, visitTarget } from "./model-target";
type Values = Record<string, string | number | boolean | null>;
const props = defineProps<{
  node: CollectionNode;
  queryView?: ReturnType<DirectRuntime["queryView"]>;
  canQuery: boolean;
}>();
const emit = defineEmits<{
  page: [page: number];
  open: [mode: "read" | "edit", restoreFocus: () => HTMLElement | null];
  print: [record: ObjectNode];
}>();
const runtime = inject(directRuntimeKey)!;
function field(row: ObjectNode, key: string) {
  return row.members.find((member) => member.key === key);
}
const columns = computed<Column<Values>[]>(() =>
  props.node.columns
    .filter((column) =>
      props.node.items.every((row) => {
        const n = field(row, column.key);
        return !n || runtime.readable(n);
      }),
    )
    .map((column) => ({ ...column, type: "text" })),
);
function display(node: Node | undefined): Values[string] {
  if (!node || !runtime.readable(node) || !("value" in node)) return null;
  if (node.kind === "secret" || node.kind === "password") return "••••••";
  try {
    return formatField(node as FieldNode);
  } catch (error) {
    return error instanceof Error ? error.message : "格式错误";
  }
}
const modelError = computed(() =>
  props.node.items
    .filter((row) => runtime.readable(row))
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
  const rows = props.node.items
    .filter((row) => runtime.readable(row))
    .map((row) => {
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
function actions(row: Values): RowAction[] {
  const source = original(row);
  if (!source || !runtime.readable(source)) return [];
  const result: RowAction[] = [runtime.editable(source) ? "edit" : "view"];
  if (props.node.itemPrintTemple && runtime.allowed(props.node, "itemPrint"))
    result.push("print");
  const available = new Set([
    ...Object.keys(businessRowActions),
    "delete",
    "submit",
    "approve",
    "withdraw",
    "reverse",
    "calculate",
    "clone",
    "send",
    "unapprove",
    "complete",
    "uncomplete",
    "void",
    "unvoid",
    "enable",
    "disable",
  ]);
  for (const action of Object.keys(runtime.operations(source)))
    if (available.has(action) && runtime.allowed(source, action))
      result.push(action as RowAction);
  return result;
}
function showAllActions(row: Values) {
  return !!original(row)?.workflow;
}
function reasons(row: Values): Partial<Record<RowAction, string>> {
  const source = original(row);
  if (!source) return {};
  return Object.fromEntries(
    actions(row)
      .filter(
        (action) =>
          runtime.busy.value.has(toRaw(source)) ||
          (action === "print" &&
            !!props.node.itemPrintTemple &&
            (!source.printable || source.identity === null)) ||
          (action !== "edit" &&
            action !== "view" &&
            runtime.operations(source)[action]?.disabled),
      )
      .map((action) => [
        action,
        action === "print" && !source.printable
          ? "保存或核实当前记录后打印"
          : "当前不可用",
      ]),
  );
}
function select(action: RowAction, row: Values) {
  const source = original(row);
  if (
    !source ||
    !props.node.items.includes(source) ||
    !actions(row).includes(action) ||
    reasons(row)[action]
  )
    return;
  if (action === "print" && props.node.itemPrintTemple) {
    emit("print", source);
    return;
  }
  if (action === "view" || action === "edit") {
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
    props.node.selected = source;
    emit("open", action === "edit" ? "edit" : "read", restoreFocus);
  } else void runtime.run(source, action);
}
function filterValues(values: Partial<Values>): Partial<Values> {
  return Object.fromEntries(
    columns.value
      .filter(
        (column) =>
          props.node.items.every((row) => {
            const n = field(row, column.key);
            return runtime.readable(row) && !!n && runtime.readable(n);
          }) && Object.hasOwn(values, column.key),
      )
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
      const row = props.node.items.find((row) => row.identity === id);
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
                Object.entries(row.cells).filter(([key]) => {
                  const record = props.node.items.find(
                      (item) => item.identity === row.rowId,
                    ),
                    node = record && field(record, key);
                  return (
                    !!node &&
                    runtime.readable(node) &&
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
function readableTarget(target: CollectionTarget) {
  return targetReadable(runtime, target);
}

function cell(
  row: Values,
  key: string,
): ReportCell<CollectionTarget> | undefined {
  const source = original(row),
    node = source && field(source, key);
  if (!node || !runtime.readable(node)) return;
  const fact = props.node.report?.cells?.find(
    (fact) => toRaw(fact.row) === toRaw(source!) && fact.field === key,
  );
  if (!fact || !readableTarget(fact.target)) return;
  const value = {
    kind: fact.kind,
    target: fact.target,
    label: fact.label,
    disabled: fact.disabled,
  };
  return fact.kind === "record"
    ? {
        ...value,
        kind: "record",
        href: runtime
          .model()
          .navigation.href(fact.target.collection, fact.target.record),
      }
    : { ...value, kind: fact.kind };
}
function visit(value: ReportCell<CollectionTarget>, row: Values) {
  const source = original(row);
  if (
    !source ||
    !props.node.items.includes(source) ||
    !runtime.readable(source) ||
    !readableTarget(value.target)
  )
    return;
  const fact = props.node.report?.cells?.find(
    (fact) =>
      toRaw(fact.row) === toRaw(source) &&
      toRaw(fact.target) === toRaw(value.target) &&
      !fact.disabled,
  );
  if (!fact) return;
  const node = field(source, fact.field);
  if (!node || !runtime.readable(node)) return;
  visitTarget(runtime, value.target);
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
    :loading="queryView?.state === 'loading'"
    :result-state="queryView?.state ?? 'idle'"
    :paging-disabled="!canQuery || queryView?.state === 'failure'"
    :row-key="key"
    :summary="summary"
    :presentation="presentation"
    :cell="cell"
    :actions="actions"
    action-column
    :action-labels="labels"
    :disabled-actions="reasons"
    :show-all-actions="showAllActions"
    empty-caption="暂无记录"
    @page="emit('page', $event)"
    @action="select"
    @cell="visit"
  />
</template>
