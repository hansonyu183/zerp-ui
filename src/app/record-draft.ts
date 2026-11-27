// 复制记录和所属明细的编辑值，用来源映射把草稿关联到原模型节点。
import { reactive, toRaw } from "vue";
import type { Node, ObjectNode, RecordsNode } from "../model/business-model";

const origins = new WeakMap<object, Node>();

export function draftOrigin<T extends object>(node: T): T {
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

function copy<T extends Node>(node: T): T {
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

export function recordValues(node: Node): unknown {
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

// 明细回调可能在等待后才创建行。成功后先把新增节点关联到原对象。
export function updateDraftRows(
  node: RecordsNode,
  origin: RecordsNode,
  callback: () => void | Promise<void>,
) {
  const result = callback();
  if (typeof result?.then === "function")
    return result.then(() => registerDraftRows(node, origin));
  registerDraftRows(node, origin);
}

function registerDraftRows(node: RecordsNode, origin: RecordsNode) {
  const attach = (member: Node) => {
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

// 比较草稿与基准时忽略对象属性顺序，保留数组顺序及 null、false、空字符串等值的差异。
function equalValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (typeof File !== "undefined" && (a instanceof File || b instanceof File))
    return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => equalValues(value, b[i]))
    );
  if (a instanceof Date || b instanceof Date)
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && equalValues(left[key], right[key]),
    )
  );
}
