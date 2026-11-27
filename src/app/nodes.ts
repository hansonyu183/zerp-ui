// 从静态模型索引节点归属，并根据节点可读性、只读状态和操作资格决定可呈现内容。
import { computed, toRaw } from "vue";
import type {
  DomainGroup,
  DomainSection,
  Node,
  ListCollection,
  CollectionTarget,
  ObjectNode,
  Operation,
  Workbench,
} from "../model/business-model";
import { draftOrigin } from "./work/dialogs/record-draft";
import { applicationReady, currentModel, sessionState } from "./session";

export type NodeOrCollection = Node | ListCollection;
export function isCollection(node: NodeOrCollection): node is ListCollection {
  return "conditions" in node;
}
type DomainEntry = {
  domain: DomainGroup;
  path: string[];
  section?: DomainSection;
};

// 导航、路由和节点索引共用业务模型的静态顺序与路径。
export const workGroups = computed(() =>
  (currentModel.value?.work.members ?? []).map((member) => {
    const domains: DomainEntry[] = [];
    if ("kind" in member) {
      if (member.kind === "domain")
        domains.push({ domain: member, path: [member.key] });
      else {
        for (const child of member.members) {
          if (child.kind === "domain")
            domains.push({ domain: child, path: [member.key, child.key] });
          else
            for (const domain of child.members)
              domains.push({
                domain,
                path: [member.key, child.key, domain.key],
                section: child,
              });
        }
      }
    }
    return { member, domains };
  }),
);
export const collectionEntries = computed(() =>
  workGroups.value.flatMap<{
    collection: ListCollection;
    path: string[];
    domain?: DomainGroup;
  }>(({ member, domains }) => {
    if (!("kind" in member))
      return [{ collection: member, path: [member.key], domain: undefined }];
    return domains.flatMap(({ domain, path }) =>
      domain.members.map((collection) => ({
        collection,
        path: [...path, collection.key],
        domain,
      })),
    );
  }),
);

export function workbenchSections(workbench: Workbench) {
  return (["information", "vouchers", "reports", "masters"] as const).map(
    (role) => ({ role, node: workbench[role] }),
  );
}

function indexNodes() {
  const paths = new Map<object, NodeOrCollection[]>();
  const targets: CollectionTarget[] = [];
  function collect(target: unknown) {
    if (target && typeof target === "object" && "collection" in target)
      targets.push(target as CollectionTarget);
  }
  function walk(node: Node, parents: NodeOrCollection[]) {
    const key = toRaw(node);
    if (paths.has(key)) return;
    paths.set(key, parents);
    if (node.kind === "object")
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
  return { paths, targets, collect, walk };
}

function indexCollection(collection: ListCollection) {
  // 选中已有行不改变归属。只有列表外的选中记录或草稿才补到索引。
  const additional = computed<ObjectNode[]>((previous) => {
    const { items, selected, draft } = collection;
    const extra = [selected, draft].filter(
      (record): record is ObjectNode => !!record && !items.includes(record),
    );
    return previous?.length === extra.length &&
      previous.every((record, index) => record === extra[index])
      ? previous
      : extra;
  });
  return computed(() => {
    const { paths, targets, walk } = indexNodes();
    paths.set(toRaw(collection), []);
    const parents = [collection];
    walk(collection.conditions, parents);
    for (const record of collection.items) walk(record, parents);
    for (const record of additional.value) walk(record, parents);
    for (const cell of collection.report?.cells ?? [])
      targets.push(cell.target);
    return { paths, targets };
  });
}
let collectionIndexes = new WeakMap<
  ListCollection,
  ReturnType<typeof indexCollection>
>();

const structuralPaths = computed(() => {
  const { paths, targets, collect, walk } = indexNodes();
  const model = currentModel.value;
  if (!model) return paths;
  const roots = new Set<object>();
  for (const { collection } of collectionEntries.value) {
    const key = toRaw(collection);
    if (roots.has(key)) continue;
    roots.add(key);
    let index = collectionIndexes.get(collection);
    if (!index) {
      index = indexCollection(collection);
      collectionIndexes.set(collection, index);
    }
    const { paths: localPaths, targets: localTargets } = index.value;
    for (const [node, parents] of localPaths)
      if (!paths.has(node)) paths.set(node, parents);
    for (const target of localTargets) targets.push(target);
  }
  const w = model.work.workbench;
  const sections = w ? workbenchSections(w) : [];
  if (w?.readable !== false) for (const { node } of sections) walk(node, []);
  for (const node of [
    model.authentication.form,
    model.work.account.profile,
    model.work.account.password,
  ])
    walk(node, []);
  if (w) {
    const rows = new Set(sections.flatMap(({ node }) => node.items).map(toRaw));
    for (const [row, target] of w.targets ?? [])
      if (rows.has(toRaw(row))) collect(target);
    collect(w.manageReports);
  }
  // 先合并实际归属，再从有限目标关系接入外页记录。
  for (const target of targets)
    if (target.record && roots.has(toRaw(target.collection)))
      walk(target.record, [target.collection]);
  return paths;
});
export function ancestors(node: NodeOrCollection) {
  const source = isCollection(node) ? node : draftOrigin(node);
  return structuralPaths.value.get(toRaw(source)) ?? [];
}
const same = (a: object, b: object) => toRaw(a) === toRaw(b);
// 读取模型给出的可读状态，并沿所属关系检查上级节点。
export function readable(node: NodeOrCollection): boolean {
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
export function writable(node: NodeOrCollection): boolean {
  return (
    readable(node) &&
    ![...ancestors(node), node].some(
      (member) => !isCollection(member) && member.readOnly,
    )
  );
}
export function operations(
  node: NodeOrCollection,
): Record<string, Operation<never>> {
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
function actionAllowed(
  node: NodeOrCollection,
  action: string,
  publicAuth: boolean,
  operation?: Operation<never>,
) {
  const automatic =
    isCollection(node) &&
    ((action === "print" && node.printTemple) ||
      (action === "itemPrint" && node.itemPrintTemple));
  if (!operation && !automatic) return false;
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
export function allowed(
  node: NodeOrCollection,
  action: string,
  publicAuth = false,
  expected?: Operation<never>,
) {
  const operation = operations(node)[action];
  return (
    (!expected || operation === expected) &&
    actionAllowed(node, action, publicAuth, operation)
  );
}
export function available(
  node: NodeOrCollection,
  action: string,
  publicAuth = false,
) {
  const operation = operations(node)[action];
  return (
    actionAllowed(node, action, publicAuth, operation) && !operation?.disabled
  );
}
export function editable(node: NodeOrCollection) {
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

export function independent(node: NodeOrCollection) {
  return (
    ancestors(node).length === 0 ||
    (!isCollection(node) && node.kind === "object" && editable(node))
  );
}

export function releaseNodeIndex() {
  collectionIndexes = new WeakMap();
  void structuralPaths.value;
}

export function workbenchReadable(node: Workbench) {
  return (
    node.readable !== false &&
    workbenchSections(node).some(({ node }) => readable(node))
  );
}
