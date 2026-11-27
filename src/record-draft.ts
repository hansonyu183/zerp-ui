import { reactive, toRaw } from "vue";
import type { BusinessNode, ObjectNode, RecordsNode } from "./business-model";
import { equalValues } from "./editor-values";

const origins = new WeakMap<object, BusinessNode>();

export function draftOrigin<T extends BusinessNode>(node: T): T {
  return (origins.get(toRaw(node)) ?? node) as T;
}

function copyValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyValue) as T;
  if (value && typeof value === "object" && !(value instanceof File))
    return { ...value };
  return value;
}

function assign(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value,
  });
}

function copy<T extends BusinessNode>(node: T): T {
  if (node.kind === "interactions" || node.kind === "output") return node;
  // Keep presentation and eligibility reactive on the original. Each input
  // owns its editable value and each owned records node owns its local rows.
  const draft = Object.create(node) as T;
  origins.set(draft, node);
  if (node.kind === "object") assign(draft, "members", node.members.map(copy));
  else if (node.kind === "records") {
    assign(draft, "items", node.items.map(copy));
    assign(draft, "selected", null);
  } else if ("value" in node && !node.readOnly)
    assign(draft, "value", copyValue(node.value));
  return draft;
}

export function recordDraft(record: ObjectNode) {
  return reactive(copy(record));
}

export function recordValues(node: BusinessNode): unknown {
  if (node.kind === "object") return node.members.map(recordValues);
  if (node.kind === "records")
    return node.items.map((row) => [row.identity, row.key, recordValues(row)]);
  if (
    "value" in node &&
    node.kind !== "output" &&
    node.kind !== "interactions" &&
    !node.readOnly
  )
    return copyValue(node.value);
}

export function edited(record: ObjectNode, baseline: unknown) {
  return !equalValues(recordValues(record), baseline);
}

export function registerDraftRows(node: RecordsNode) {
  const origin = origins.get(toRaw(node));
  if (!origin) return;
  const attach = (member: BusinessNode) => {
    if (!origins.has(toRaw(member))) origins.set(toRaw(member), origin);
    if (member.kind === "object") member.members.forEach(attach);
    if (member.kind === "records") member.items.forEach(attach);
  };
  node.items.forEach(attach);
}

/** Replace only the saved object's comparison values in the window baseline. */
export function updateBaseline(
  record: ObjectNode,
  baseline: unknown,
  target: ObjectNode,
  values: unknown,
): unknown {
  if (record === target) return values;
  if (!Array.isArray(baseline)) return baseline;
  return record.members.map((member, index) => {
    if (member.kind === "object")
      return updateBaseline(member, baseline[index], target, values);
    return baseline[index];
  });
}
