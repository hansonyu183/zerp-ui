import { computed, toRaw } from "vue";
import type {
  BusinessNode,
  ListCollection,
  CollectionTarget,
  ObjectNode,
  Operation,
  Workbench,
} from "./business-model";
import { draftOrigin } from "./record-draft";
import { modelCollections } from "./model-collections";
import {
  applicationReady,
  currentModel,
  sessionState,
} from "./business-session";

export type { ObjectNode } from "./business-model";
export type CollectionNode = ListCollection;
export type Node = BusinessNode | ListCollection;
export function isCollection(node: Node): node is ListCollection {
  return "conditions" in node;
}
export function members(node: Node): [string, BusinessNode][] {
  return !isCollection(node) && node.kind === "object"
    ? node.members.map((child) => [child.key, child])
    : [];
}
const structuralPaths = computed(() => {
  const result = new Map<object, Node[]>();
  const model = currentModel.value;
  if (!model) return result;
  const targets: CollectionTarget[] = [];
  function collect(target: unknown) {
    if (target && typeof target === "object" && "collection" in target)
      targets.push(target as CollectionTarget);
  }
  function walk(node: Node, parents: Node[]) {
    if (result.has(toRaw(node))) return;
    result.set(toRaw(node), parents);
    if (isCollection(node)) {
      walk(node.conditions, [...parents, node]);
      for (const item of [...node.items, node.selected, node.draft])
        if (item) walk(item, [...parents, node]);
      for (const cell of node.report?.cells ?? []) collect(cell.target);
    } else if (node.kind === "object")
      for (const child of node.members) walk(child, [...parents, node]);
    else if (node.kind === "records")
      for (const item of node.items) walk(item, [...parents, node]);
    else if (node.kind === "interactions")
      for (const item of node.items) {
        if ("target" in item) collect(item.target);
        if (item.kind === "menu" || item.kind === "tree")
          for (const entry of item.items) {
            collect(entry.target);
            for (const child of entry.children ?? []) collect(child.target);
          }
      }
  }
  const collections = modelCollections(model.work);
  for (const node of collections) walk(node, []);
  const w = model.work.workbench;
  if (w?.readable !== false && w)
    for (const node of [w.information, w.vouchers, w.reports, w.masters])
      walk(node, []);
  for (const node of [
    model.authentication.form,
    model.work.account.profile,
    model.work.account.password,
  ])
    walk(node, []);
  if (w) {
    const rows = new Set(
      [w.information, w.vouchers, w.reports, w.masters]
        .flatMap((section) => section.items)
        .map(toRaw),
    );
    for (const [row, target] of w.targets ?? [])
      if (rows.has(toRaw(row))) collect(target);
    collect(w.manageReports);
  }
  const roots = new Set(collections.map(toRaw));
  // Explicit finite target edges attach off-page records after actual ownership
  // has been indexed. An already owned record never moves to another root.
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!;
    if (target.record && roots.has(toRaw(target.collection)))
      walk(target.record, [target.collection]);
  }
  return result;
});
export function ancestors(node: Node) {
  const source = isCollection(node) ? node : draftOrigin(node);
  return structuralPaths.value.get(toRaw(source)) ?? [];
}
const same = (a: object, b: object) => toRaw(a) === toRaw(b);
export function readable(node: Node): boolean {
  if (!applicationReady.value || node.readable === false) return false;
  const source = isCollection(node) ? node : draftOrigin(node);
  if (source.readable === false) return false;
  const parents = structuralPaths.value.get(toRaw(source));
  if (!parents || parents.some((parent) => parent.readable === false))
    return false;
  if (sessionState.value !== "password-required") return true;
  const password = currentModel.value!.work.account.password;
  return (
    same(node, password) || parents.some((parent) => same(parent, password))
  );
}
export function writable(node: Node): boolean {
  return (
    readable(node) &&
    ![...ancestors(node), node].some(
      (member) => !isCollection(member) && member.readOnly,
    )
  );
}
export function operations(node: Node): Record<string, Operation<never>> {
  const model = currentModel.value;
  if (!model) return {};
  if (same(node, model.authentication.form))
    return model.authentication.operations;
  if (same(node, model.work.account.password))
    return {
      ...model.work.account.password.operations,
      changePassword: model.work.account.operations.changePassword,
    };
  if (!isCollection(node) && node.kind === "object")
    return {
      ...node.document?.operations,
      ...node.workflow?.operations,
      ...node.processing?.operations,
      ...node.batch?.operations,
      ...node.report?.operations,
      ...node.output?.operations,
      ...node.operations,
    };
  return "operations" in node
    ? (node.operations as Record<string, Operation>)
    : "load" in node && node.load
      ? { load: node.load }
      : {};
}
export function allowed(
  node: Node,
  action: string,
  publicAuth = false,
): boolean {
  const automatic =
    isCollection(node) &&
    ((action === "print" && node.printTemple) ||
      (action === "itemPrint" && node.itemPrintTemple));
  if (!operations(node)[action] && !automatic) return false;
  if (publicAuth)
    return (
      !!currentModel.value &&
      same(node, currentModel.value.authentication.form) &&
      node.readable !== false &&
      sessionState.value === "anonymous" &&
      action === "signIn"
    );
  return readable(node);
}
export function available(node: Node, action: string, publicAuth = false) {
  return (
    allowed(node, action, publicAuth) && !operations(node)[action]?.disabled
  );
}
export function editable(node: Node) {
  return allowed(node, "update");
}
export function handleable(node: ObjectNode) {
  if (
    node.processing &&
    Object.keys(node.processing.operations).some((action) =>
      allowed(node, action),
    )
  )
    return true;
  return (
    [node.document, node.workflow, node.batch, node.report].some((capability) =>
      Object.keys(capability?.operations ?? {}).some((action) =>
        available(node, action),
      ),
    ) ||
    (!!node.output &&
      (available(node, "confirmPrinted") ||
        available(node, "confirmNotPrinted")))
  );
}

export function independent(node: Node) {
  return (
    ancestors(node).length === 0 ||
    (!isCollection(node) && node.kind === "object" && editable(node))
  );
}

export function releaseNodeIndex() {
  void structuralPaths.value;
}

export function workbenchReadable(node: Workbench) {
  return (
    node.readable !== false &&
    [node.information, node.vouchers, node.reports, node.masters].some(readable)
  );
}
