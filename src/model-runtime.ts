import { bindArrayFields } from "./model-array-fields";
import { discardedCollaboration } from "./collaboration-result";
import { modelWorkflowPage } from "./model-workflow-runtime";
import { modelWorkflow } from "./model-workflow";
import { modelSubmissionPage } from "./model-submission-runtime";
import { modelSubmission } from "./model-submission";
import { modelBatch } from "./model-batch";
import { modelBatchPage } from "./model-batch-runtime";
import { modelQueryPage } from "./model-query-runtime";
import { h } from "vue";
import ModelOperations from "./ModelOperations.vue";
import { modelOperation } from "./model-operation";
import { modelOperationPersistence } from "./model-operation-persistence";
import {
  sameOperationOwner,
  type OperationModel,
  type OperationPersistence,
} from "./operation";
import { snapshotPage } from "./pages";
import { modelBinding } from "./model-binding";
import { computed, toRaw, reactive, shallowRef, shallowReactive } from "vue";
import { nodeMetadata } from "./model-node";
import type {
  ModelNode,
  ApplicationNode,
  ModelIdentity,
  ModelOwner,
  ModelPendingRequest,
  ModelRequest,
  ModelSnapshot,
  ModelWriteResult,
  ModelEvidence,
  ModelContext,
  ModelCalculation,
  ModelLocalIntent,
  ModelCalculationResult,
  ReferenceOperations,
  ValueNode,
} from "./reactive-model";
import { defineCrudPage, type PageDefinition } from "./pages";
import type {
  AnyField,
  CrudDefinition,
  Attempt,
  Page,
  CrudAction,
} from "./contracts";
import { clone, message } from "./clone";
import { equalValues, containsSecrets, redactSecrets } from "./editor-values";
import { writeLock } from "./write-lock";

type Values = Record<string, unknown>;
type Context = ModelContext<unknown, readonly unknown[]>;
type Write = {
  disabledReason?: string;
  run(
    request: ModelRequest<unknown, unknown, readonly unknown[]>,
  ): Promise<ModelWriteResult<object, unknown>>;
  reconcile?(
    request: ModelRequest<unknown, unknown, readonly unknown[]>,
  ): Promise<ModelEvidence<object, unknown>>;
};
type Read<T = unknown> = {
  disabledReason?: string;
  input?: ModelNode;
  run(
    context: Context & { input: unknown; page: number; pageSize: number },
  ): Promise<T>;
};
export type RuntimeObject = ModelNode & {
  [nodeMetadata]: {
    kind: "object";
    children: Record<string, ModelNode>;
    name: string;
    identity: readonly string[];
    concurrency: string | null;
    independent: boolean;
    readOnly?: boolean;
    form?: readonly string[];
    list?: readonly (string | readonly string[])[];
    operations: Partial<
      {
        get: Read;
        initialize: ModelCalculation<object, unknown, readonly unknown[]>;
        calculate: ModelCalculation<object, unknown, readonly unknown[]>;
      } & Record<"update" | "delete" | "enable" | "disable", Write>
    >;
  };
};
type RuntimeCollection = ModelNode & {
  items: RuntimeObject[];
  [nodeMetadata]: {
    kind: "collection";
    name: string;
    element(): RuntimeObject;
    operations: {
      query?: Read;
      create?: Write;
      export?: Read<void | { content: Blob; filename: string }>;
    };
  };
};
const asObject = (node: ModelNode) => node as RuntimeObject;
const asCollection = (node: ModelNode) => node as RuntimeCollection;
const isObject = (node: ModelNode) => node[nodeMetadata].kind === "object";
const independentNodes = new WeakSet<object>();
function independent(node: ModelNode) {
  const raw = toRaw(node);
  if (
    node[nodeMetadata].kind === "collection" ||
    (isObject(node) && asObject(node)[nodeMetadata].independent)
  )
    independentNodes.add(raw);
  return independentNodes.has(raw);
}
export function members(node: ModelNode): [string, ModelNode][] {
  const kind = node[nodeMetadata].kind;
  return kind === "object" || kind === "application"
    ? Object.entries(node).filter(
        (entry): entry is [string, ModelNode] =>
          !!entry[1] &&
          typeof entry[1] === "object" &&
          nodeMetadata in entry[1],
      )
    : [];
}
type IndependentMember = {
  path: readonly string[];
  key: string;
  node: ModelNode;
};
function independentMembers(
  node: ModelNode,
  prefix: readonly string[] = [],
): IndependentMember[] {
  return members(node).flatMap(([key, child]) => {
    const path = [...prefix, key];
    if (independent(child))
      return [
        {
          path,
          key: path.length === 1 ? key : JSON.stringify(path),
          node: child,
        },
      ];
    return isObject(child) ? independentMembers(child, path) : [];
  });
}
function memberAt(
  node: ModelNode | undefined,
  path: readonly string[],
): ModelNode | undefined {
  for (const key of path)
    node = node && members(node).find(([name]) => name === key)?.[1];
  return node;
}
export function modelEntries(
  node: ModelNode,
  path: string[] = [],
): { node: ModelNode; path: string[] }[] {
  return members(node).flatMap(([key, child]) => [
    { node: child, path: [...path, key] },
    ...(child[nodeMetadata].kind === "object" &&
    !(child as RuntimeObject)[nodeMetadata].independent
      ? modelEntries(child, [...path, key])
      : []),
  ]);
}
export function modelValue(node: ModelNode, writable = false): unknown {
  const meta = node[nodeMetadata];
  if (isObject(node) || meta.kind === "application")
    return Object.fromEntries(
      members(node)
        .filter(
          ([, child]) =>
            !independent(child) &&
            (!writable ||
              !(child as ValueNode)[nodeMetadata].options?.readOnly),
        )
        .map(([key, child]) => [key, modelValue(child, writable)]),
    );
  if (meta.kind === "array")
    return (node as unknown as { items: ModelNode[] }).items.map((item) =>
      modelValue(item, writable),
    );
  return (node as ValueNode).value;
}
export function adopt(node: ModelNode, value: unknown) {
  if (isObject(node)) {
    for (const [key, child] of members(node))
      if (
        !independent(child) &&
        value &&
        typeof value === "object" &&
        Object.hasOwn(value, key)
      )
        adopt(child, Reflect.get(value, key));
  } else if (node[nodeMetadata].kind === "array" && Array.isArray(value)) {
    const arrayNode = node as unknown as {
      items: ModelNode[];
      [nodeMetadata]: { create(): ModelNode };
    };
    arrayNode.items = value.map((item, index) => {
      const child = declaredRow(arrayNode as ValueArray, item, index);
      adopt(child, item);
      return child;
    });
  } else if (node[nodeMetadata].kind !== "array")
    (node as ValueNode).value = value as never;
}
function identity(node: RuntimeObject): ModelIdentity {
  const meta = node[nodeMetadata];
  return {
    value: Object.fromEntries(
      meta.identity.map((key) => [
        key,
        (node as unknown as Record<string, ValueNode>)[key]?.value,
      ]),
    ),
    ancestors: [],
    concurrency: meta.concurrency,
  };
}
class StaleArrayRow extends Error {
  constructor() {
    super("数组行声明已失效，请重新读取。");
  }
}
type ValueArray = ModelNode & {
  items: ModelNode[];
  [nodeMetadata]: { element: ModelNode; create(): ModelNode };
};
const arrayRows = new WeakMap<object, Map<string, ModelNode>>();
const adoptedRows = new WeakMap<object, { array: object; key: string }>();
const createdRows = new WeakSet<object>();
function rememberRow(array: ValueArray, row: ModelNode, value?: unknown) {
  let known = arrayRows.get(toRaw(array));
  if (!known) arrayRows.set(toRaw(array), (known = new Map()));
  known.set(rowKey(row, value), row);
  return row;
}
function newArrayRow(array: ValueArray, value?: unknown) {
  const row = array[nodeMetadata].create();
  createdRows.add(toRaw(row));
  return rememberRow(array, row, value);
}
function declaredRow(
  array: ValueArray,
  value: unknown,
  index?: number,
  snapshot = false,
): ModelNode {
  const current = new Map(
    array.items.map((row) => {
      createdRows.delete(toRaw(row));
      rememberRow(array, row);
      return [rowKey(row), row] as const;
    }),
  );
  const association =
    value && typeof value === "object" ? adoptedRows.get(value) : undefined;
  const explicitKey =
    value && typeof value === "object"
      ? Reflect.get(value, "$modelRowKey")
      : undefined;
  const key =
    typeof explicitKey === "string"
      ? explicitKey
      : association?.array === toRaw(array)
        ? association.key
        : undefined;
  if (key !== undefined) {
    const authoritative = current.get(key);
    if (authoritative) return authoritative;
    const created = arrayRows.get(toRaw(array))?.get(key);
    if (created && (snapshot || createdRows.has(toRaw(created))))
      return created;
    throw new StaleArrayRow();
  }
  const element = array[nodeMetadata].element;
  if (isObject(element) && asObject(element)[nodeMetadata].identity.length) {
    const existing = [...current.values()].find(
      (row) => rowKey(row, value) === rowKey(row),
    );
    if (existing) return existing;
  } else if (index !== undefined && array.items[index])
    return array.items[index]!;
  return newArrayRow(array, value);
}
const rowKeys = new WeakMap<object, string>();
function rowKey(node: ModelNode, value?: unknown): string {
  const meta = asObject(node)[nodeMetadata];
  const identity = (meta.identity ?? []).map((key) =>
    value && typeof value === "object"
      ? Reflect.get(value, key)
      : (node as unknown as Record<string, ValueNode>)[key]?.value,
  );
  if (
    identity.length &&
    identity.every(
      (value) => value !== undefined && value !== null && value !== "",
    )
  )
    return JSON.stringify(identity);
  let key = rowKeys.get(toRaw(node));
  if (!key) {
    key = crypto.randomUUID();
    rowKeys.set(toRaw(node), key);
  }
  return key;
}
function flat(
  node: ModelNode,
  prefix: readonly string[] = [],
  target: Values = {},
): Values {
  if (!isObject(node) && node[nodeMetadata].kind !== "application")
    return { [JSON.stringify(["$value"])]: clone(modelValue(node)) };
  for (const [key, child] of members(node)) {
    if (independent(child)) continue;
    const path = [...prefix, key];
    if (isObject(child)) flat(child, path, target);
    else if (child[nodeMetadata].kind === "array")
      target[JSON.stringify(path)] = (
        child as unknown as { items: ModelNode[] }
      ).items.map((item) => ({
        ...flat(rememberRow(child as ValueArray, item)),
        $modelRowKey: rowKey(item),
      }));
    else target[JSON.stringify(path)] = clone(modelValue(child));
  }
  return target;
}
function unflat(
  node: ModelNode,
  value: Values,
  writable: boolean,
  prefix: readonly string[] = [],
): Values {
  return Object.fromEntries(
    members(node).flatMap(([key, child]) => {
      if (independent(child)) return [];
      const path = [...prefix, key],
        meta = (child as ValueNode)[nodeMetadata];
      if (
        writable &&
        (meta.options?.readOnly || asObject(child)[nodeMetadata].readOnly)
      )
        return [];
      const arrayElement =
        child[nodeMetadata].kind === "array"
          ? (child as unknown as { [nodeMetadata]: { element: ModelNode } })[
              nodeMetadata
            ].element
          : undefined;
      const input = value[JSON.stringify(path)];
      return [
        [
          key,
          isObject(child)
            ? unflat(child, value, writable, path)
            : arrayElement && Array.isArray(input)
              ? input.map((row) =>
                  isObject(arrayElement)
                    ? (() => {
                        const declaration = declaredRow(
                          child as ValueArray,
                          row,
                        );
                        const result = unflat(declaration, row, writable);
                        adoptedRows.set(result, {
                          array: toRaw(child),
                          key: rowKey(declaration),
                        });
                        return result;
                      })()
                    : row[JSON.stringify(["$value"])],
                )
              : input,
        ],
      ];
    }),
  );
}
export function flattenValue(
  node: ModelNode,
  value: unknown,
  prefix: readonly string[] = [],
  target: Values = {},
): Values {
  for (const [key, child] of members(node)) {
    if (independent(child)) continue;
    const path = [...prefix, key],
      next =
        value && typeof value === "object"
          ? Reflect.get(value, key)
          : undefined;
    if (isObject(child)) flattenValue(child, next, path, target);
    else if (child[nodeMetadata].kind === "array" && Array.isArray(next)) {
      const element = (
        child as unknown as { [nodeMetadata]: { element: ModelNode } }
      )[nodeMetadata].element;
      target[JSON.stringify(path)] = next.map((value, index) => {
        const row = declaredRow(child as ValueArray, value, index);
        return isObject(element)
          ? { ...flattenValue(row, value), $modelRowKey: rowKey(row, value) }
          : {
              [JSON.stringify(["$value"])]: clone(value),
              $modelRowKey: rowKey(row),
            };
      });
    } else target[JSON.stringify(path)] = clone(next);
  }
  return target;
}
const keyOf = (id: unknown) => JSON.stringify(id);
export function ownerKey(owner: ModelOwner | null) {
  return JSON.stringify(owner);
}
type RuntimeCacheEntry = {
  runtime: ModelRuntime;
  rebind(source: () => ApplicationNode): void;
};
const applicationRuntimes = new WeakMap<object, RuntimeCacheEntry>();
export function createModelRuntime(
  application: () => ApplicationNode,
): ModelRuntime {
  const key = toRaw(application()[nodeMetadata].options.navigation);
  const existing = applicationRuntimes.get(key);
  if (existing) {
    existing.rebind(application);
    return existing.runtime;
  }
  let source = application;
  type Boundary = {
    path: readonly string[];
    node(): ModelNode | undefined;
    rebind(getNode: () => ModelNode | undefined): void;
    page: PageDefinition;
    definition: CrudDefinition<Values, Values, Values, ModelIdentity, object>;
    pending(): boolean;
    requestLeave(): Promise<boolean>;
    answers(): import("./collaboration").InteractionAnswers;
    displayedIdentity(): ModelIdentity | undefined;
    records(): RuntimeObject[];
    stop(): void;
  };
  const cache = shallowReactive(new Map<string, Boundary>());
  const pendingRequests = shallowRef<readonly ModelPendingRequest[]>([]);
  async function restoreManifest() {
    const owner = options().owner,
      persistence = options().persistence;
    pendingRequests.value = [];
    if (!owner) return;
    const requested = ownerKey(owner),
      root = source();
    const pending = persistence
      ? [...(await persistence.pending(clone(owner)))]
      : [];
    for (const { node, path } of modelEntries(root)) {
      if (!isObject(node)) continue;
      const op = Reflect.get(
        asObject(node)[nodeMetadata].operations,
        "changePassword",
      ) as
        | {
            persistence: OperationPersistence<OperationModel, unknown, unknown>;
          }
        | undefined;
      if (!op || !(modelOperation in op)) continue;
      const operationOwner = {
        scope: requested,
        operator: owner.operator,
        resource: JSON.stringify([path, [], identity(asObject(node)).value]),
      };
      const journal = await modelOperationPersistence(op.persistence).load(
        operationOwner,
      );
      if (journal && !sameOperationOwner(journal.request.owner, operationOwner))
        throw Error("原请求归属不匹配，请保留证据。");
      if (journal && !journal.completed)
        pending.push({ node: path, ancestors: [] });
    }
    if (ownerKey(options().owner) === requested && source() === root)
      pendingRequests.value = pending;
  }

  const options = () => source()[nodeMetadata].options;
  function context(id: ModelIdentity, signal: AbortSignal): Context {
    if (!options().owner) throw Error("会话已失效。");
    return {
      owner: clone(options().owner!),
      identity: clone(id.value),
      ancestors: clone(id.ancestors),
      signal,
    };
  }
  function fields(
    node: ModelNode,
    prefix: readonly string[] = [],
    inheritedReadonly = false,
    projection: "form" | "list" | "all" = "form",
  ): AnyField[] {
    const form =
      projection === "form" && isObject(node)
        ? asObject(node)[nodeMetadata].form
        : undefined;
    const entries: [string, ModelNode][] =
      isObject(node) || node[nodeMetadata].kind === "application"
        ? members(node)
        : [["$value", node]];
    const ordered = form
      ? form.flatMap((key) => entries.filter(([name]) => name === key))
      : entries;
    const projected = ordered.flatMap(([key, child]): AnyField[] => {
      if (independent(child)) return [];
      const path = [...prefix, key],
        meta = child[nodeMetadata];
      if (meta.kind === "object")
        return fields(
          child,
          path,
          inheritedReadonly || !!asObject(child)[nodeMetadata].readOnly,
          projection === "form" ? "form" : "all",
        );
      const fieldMeta = (child as ValueNode)[nodeMetadata];
      const common = {
        key: JSON.stringify(path),
        label: meta.name,
        required: fieldMeta.options?.required,
        readonly: inheritedReadonly || fieldMeta.options?.readOnly,
      };
      if (meta.kind === "reference") {
        const operations = fieldMeta.operations as ReferenceOperations;
        const invoke = async (
          op: "search" | "resolve",
          input: unknown,
          page = 1,
          pageSize = 20,
        ) => {
          const operation = operations[op],
            run = operation.run,
            owner = ownerKey(options().owner);
          if (operation.disabledReason) throw Error(operation.disabledReason);
          const result = await run({
            owner: clone(options().owner),
            identity: null,
            signal: new AbortController().signal,
            ancestors: [] as const,
            input: input as never,
            page,
            pageSize,
          });
          if (
            ownerKey(options().owner) !== owner ||
            fieldMeta.operations !== operations ||
            operations[op] !== operation ||
            operation.run !== run ||
            operation.disabledReason
          )
            throw Error("引用读取已失效。");
          return result;
        };
        return [
          {
            ...common,
            type: "reference",
            valueMode: "id",
            disabledReason: operations.search.disabledReason,
            adapter: {
              search: ({ keyword, ancestor, page, pageSize }) =>
                invoke(
                  "search",
                  { keyword, ancestor },
                  page,
                  pageSize,
                ) as Promise<Page<import("./contracts").ReferenceValue>>,
              resolve: ({ ids }) =>
                invoke("resolve", { ids }) as Promise<
                  readonly import("./contracts").ReferenceValue[]
                >,
            },
          },
        ];
      }
      if (meta.kind === "array") {
        const array = child as ValueArray;
        const unavailableFields: AnyField[] = [];
        const projections = new WeakMap<
          ModelNode,
          import("vue").ComputedRef<AnyField[]>
        >();
        return [
          bindArrayFields(
            {
              ...common,
              type: "rows",
              fields: fields(array[nodeMetadata].element),
              empty: () => {
                const row = newArrayRow(array);
                return { ...flat(row), $modelRowKey: rowKey(row) };
              },
            },
            (value) => {
              const key = Reflect.get(value, "$modelRowKey");
              if (
                typeof key === "string" &&
                !array.items.some((item) => rowKey(item) === key) &&
                !arrayRows.get(toRaw(array))?.has(key)
              )
                return unavailableFields;
              const row = declaredRow(array, value, undefined, true);
              let projected = projections.get(row);
              if (!projected) {
                projected = computed(() => fields(row));
                projections.set(row, projected);
              }
              return projected.value;
            },
          ),
        ];
      }
      if (meta.kind === "enum")
        return [
          {
            ...common,
            type: "enum",
            options: (fieldMeta.options?.options ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            })),
          },
        ];
      return [
        {
          ...common,
          type:
            meta.kind === "longText"
              ? "textarea"
              : meta.kind === "secret"
                ? "secret"
                : ["boolean", "integer", "decimal", "date"].includes(meta.kind)
                  ? meta.kind
                  : "text",
        } as AnyField,
      ];
    });
    const list =
      projection === "list" && isObject(node)
        ? asObject(node)[nodeMetadata].list
        : undefined;
    if (!list) return projected;
    const seen = new Set<string>();
    return list.flatMap((key) => {
      const path = [...prefix, ...(typeof key === "string" ? [key] : key)];
      return projected.filter((field) => {
        const fieldPath = JSON.parse(field.key) as string[];
        if (
          seen.has(field.key) ||
          !path.every((segment, index) => fieldPath[index] === segment)
        )
          return false;
        seen.add(field.key);
        return true;
      });
    });
  }
  type NavigationStep = {
    node: ModelNode;
    path: readonly string[];
    ancestors: readonly unknown[];
    identity?: unknown;
    section?: string;
  };
  function locate(
    target: { node: ModelNode; identity?: unknown } | null | undefined,
  ): NavigationStep[] {
    if (!target) return [];
    const seen = new Set<ModelNode>();
    function visit(
      node: ModelNode,
      path: readonly string[],
      ancestors: readonly unknown[],
    ): NavigationStep[] {
      if (seen.has(toRaw(node))) return [];
      seen.add(toRaw(node));
      const step = { node, path, ancestors };
      if (toRaw(node) === toRaw(target!.node))
        return [{ ...step, identity: target!.identity }];
      const known = cache.get(JSON.stringify([path, ancestors]));
      const rows =
        known && toRaw(known.node() ?? {}) === toRaw(node)
          ? known.records()
          : node[nodeMetadata].kind === "collection"
            ? asCollection(node).items
            : isObject(node)
              ? [asObject(node)]
              : [];
      for (const row of rows) {
        const id = identity(row);
        if (id.value === null) continue;
        for (const child of independentMembers(row)) {
          const nested = visit(
            child.node,
            [...path, ...child.path],
            [...ancestors, id.value],
          );
          if (nested.length)
            return [
              { ...step, identity: id.value, section: child.key },
              ...nested,
            ];
        }
      }
      return [];
    }
    for (const entry of modelEntries(source())) {
      if (!independent(entry.node)) continue;
      const found = visit(entry.node, entry.path, []);
      if (found.length) return found;
    }
    return [];
  }
  function boundary(
    getNode: () => ModelNode | undefined,
    path: readonly string[],
    ancestors: readonly unknown[] = [],
  ): Boundary {
    const first = getNode()!;
    const collection = first[nodeMetadata].kind === "collection";
    const sample = shallowRef<RuntimeObject>(
      collection
        ? asCollection(first)[nodeMetadata].element()
        : asObject(first),
    );
    const hasQueried = shallowRef(false);
    const resource = JSON.stringify([path, ancestors]);
    const selection = shallowRef<RuntimeObject>(
      reactive(sample.value) as RuntimeObject,
    );
    let requestController = new AbortController();
    let detailGeneration = 0;
    let readingNavigation = options().navigation.current;
    let displayed: ModelIdentity | undefined;
    const draftAnswers = new WeakMap<
      RuntimeObject,
      import("./collaboration").InteractionAnswers
    >();
    const currentNode = () => getNode();
    const detached = new WeakMap<ModelNode, Map<string, RuntimeObject>>();
    const rowNode = (id?: ModelIdentity): RuntimeObject | undefined => {
      if (!id || id.value === null) return selection.value;
      const node = currentNode();
      if (!node) return undefined;
      return collection
        ? (asCollection(node).items.find(
            (row) => keyOf(identity(row).value) === keyOf(id.value),
          ) ?? detached.get(node)?.get(keyOf(id.value)))
        : asObject(node);
    };
    const qualify = (node: RuntimeObject) => ({
      ...identity(node),
      ancestors: clone(ancestors),
    });
    function collectionOperations() {
      return currentNode() && collection
        ? asCollection(currentNode()!)[nodeMetadata].operations
        : undefined;
    }
    function operation(name: string, id?: ModelIdentity): Write | undefined {
      if (!currentNode()) return undefined;
      return name === "create"
        ? collectionOperations()?.create
        : rowNode(id)?.[nodeMetadata].operations[name as "update"];
    }
    function request(
      attempt: Attempt<Values, ModelIdentity>,
    ): ModelRequest<unknown, unknown, readonly unknown[]> {
      return Object.freeze({
        requestId: attempt.id,
        owner: clone(
          attempt.identity?.original?.owner ??
            (JSON.parse(attempt.scope) as ModelOwner),
        ),
        node: clone(attempt.identity?.original?.node ?? path),
        operation:
          attempt.identity?.original?.operation ??
          (attempt.operation === "save" ? "update" : attempt.operation),
        input: clone(attempt.identity?.original?.input),
        answers: clone(attempt.identity?.original?.answers ?? {}),
        identity: clone(attempt.identity?.value),
        ancestors: clone(attempt.identity?.ancestors ?? ancestors),
        concurrency: attempt.identity?.concurrency ?? null,
      });
    }
    const callbacks = new Map<
      string,
      {
        operation: Write;
        run: Write["run"];
        node: ModelNode | undefined;
        record: RuntimeObject | undefined;
      }
    >();
    async function execute(attempt: Attempt<Values, ModelIdentity>) {
      const name = attempt.operation === "save" ? "update" : attempt.operation;
      const op = operation(name, attempt.identity);
      const frozen = request(attempt);
      if (
        attempt.input &&
        !equalValues(
          unflat(
            rowNode(attempt.identity) ?? sample.value,
            attempt.input,
            true,
          ),
          frozen.input,
        )
      )
        return { status: "failure" as const, message: "字段写入资格已变化。" };
      if (
        ownerKey(options().owner) !== attempt.scope ||
        !op ||
        op !== callbacks.get(attempt.operation)?.operation ||
        op.run !== callbacks.get(attempt.operation)?.run ||
        rowNode(attempt.identity) !==
          callbacks.get(attempt.operation)?.record ||
        currentNode() !== callbacks.get(attempt.operation)?.node ||
        op.disabledReason ||
        asObject(rowNode(attempt.identity) ?? sample.value)[nodeMetadata]
          .readOnly ||
        !equalValues(attempt.identity?.ancestors, ancestors)
      )
        return {
          status: "failure" as const,
          message: "业务身份或操作资格已变化。",
        };
      if (
        attempt.identity &&
        !equalValues(
          {
            ...qualify(rowNode(attempt.identity)!),
            ...(name === "create" ? { value: null } : {}),
          },
          {
            value: attempt.identity.value,
            ancestors: attempt.identity.ancestors,
            concurrency: attempt.identity.concurrency,
          },
        )
      )
        return {
          status: "failure" as const,
          message: "并发基线已变化，请重新读取。",
        };
      const result = await op.run(frozen);
      if (
        name === "create" &&
        result.status === "success" &&
        (!result.snapshot ||
          !result.snapshot.identity ||
          Object.values(result.snapshot.identity as object).some(
            (value) => value === null || value === undefined || value === "",
          ))
      )
        return {
          status: "unknown" as const,
          message: "新增结果缺少最终身份，请核实原请求。",
        };
      if (result.status === "success")
        return {
          status: "success" as const,
          ...(result.snapshot
            ? {
                identity: {
                  value: clone(result.snapshot.identity),
                  ancestors: clone(ancestors),
                  concurrency: result.snapshot.concurrency,
                },
              }
            : {}),
        };
      if (result.status === "failure")
        return {
          status: "failure" as const,
          message: result.fields?.[0]?.message ?? result.message,
          field: result.fields?.[0]
            ? JSON.stringify(
                Array.isArray(result.fields[0].field)
                  ? result.fields[0].field
                  : [result.fields[0].field],
              )
            : undefined,
        };
      return result;
    }
    const queryInput = () => collectionOperations()?.query?.input;
    const adapter: CrudDefinition<
      Values,
      Values,
      Values,
      ModelIdentity,
      object
    >["adapter"] = {
      async query({ filters, page, pageSize, scope }) {
        detailGeneration++;
        requestController.abort();
        requestController = new AbortController();
        const controller = requestController,
          node = currentNode(),
          query = collectionOperations()?.query,
          run = query?.run;
        if (!node) return { items: [], total: 0 };
        if (query?.disabledReason) throw Error(query.disabledReason);
        let result: Page<RuntimeObject>;
        if (collection) {
          if (!query) return { items: [], total: 0 };
          result = (await run!({
            ...context(
              { value: null, ancestors, concurrency: null },
              controller.signal,
            ),
            input: queryInput() ? unflat(queryInput()!, filters, false) : {},
            page,
            pageSize,
          })) as Page<RuntimeObject>;
        } else result = { items: [asObject(node)], total: 1 };
        if (
          controller.signal.aborted ||
          currentNode() !== node ||
          collectionOperations()?.query !== query ||
          query?.run !== run ||
          !!query?.disabledReason ||
          ownerKey(options().owner) !== scope
        )
          throw Error("读取已失效。");
        if (collection) {
          const keys = result.items.map((row) => {
            const value = identity(row).value as object;
            if (
              !Object.keys(value).length ||
              Object.values(value).some(
                (value) =>
                  value === null || value === undefined || value === "",
              )
            )
              throw Error("集合记录缺少稳定业务身份。");
            return keyOf(value);
          });
          if (new Set(keys).size !== keys.length)
            throw Error("集合记录身份重复。");
          asCollection(node).items = [...result.items];
        }
        hasQueried.value = true;
        return {
          ...result,
          items: result.items.map((row) => ({
            ...flat(row),
            $identity: qualify(row),
          })),
        };
      },
      empty() {
        selection.value = collection
          ? asCollection(currentNode()!)[nodeMetadata].element()
          : asObject(currentNode()!);
        return flat(selection.value);
      },
      async get({ identity: id, scope }) {
        const generation = ++detailGeneration;
        let node = rowNode(id);
        if (!node && collection && currentNode()) {
          const candidate = reactive(
            asCollection(currentNode()!)[nodeMetadata].element(),
          ) as RuntimeObject;
          if (!candidate[nodeMetadata].operations.get)
            throw Error("记录已不可读取。");
          adopt(candidate, id.value);
          if (keyOf(identity(candidate).value) !== keyOf(id.value))
            throw Error("记录身份无效。");
          const records =
            detached.get(currentNode()!) ?? new Map<string, RuntimeObject>();
          records.set(keyOf(id.value), candidate);
          detached.set(currentNode()!, records);
          node = candidate;
        }
        if (!node) throw Error("记录已不可读取。");
        selection.value = node;
        readingNavigation = options().navigation.current;
        const get = node[nodeMetadata].operations.get,
          run = get?.run,
          controller = requestController,
          source = currentNode();
        if (get?.disabledReason) throw Error(get.disabledReason);
        const snapshot =
          get && !get.disabledReason
            ? ((await run!({
                ...context(id, controller.signal),
                input: undefined,
                page: 1,
                pageSize: 20,
              })) as ModelSnapshot<object, unknown>)
            : null;
        if (
          ownerKey(options().owner) !== scope ||
          currentNode() !== source ||
          generation !== detailGeneration ||
          controller.signal.aborted ||
          node[nodeMetadata].operations.get !== get ||
          get?.run !== run ||
          !!get?.disabledReason ||
          rowNode(id) !== node
        )
          throw Error("读取已失效。");
        if (snapshot) {
          if (keyOf(snapshot.identity) !== keyOf(id.value))
            throw Error("读取结果身份不匹配。");
          adopt(node, snapshot.value);
          node[nodeMetadata].concurrency = snapshot.concurrency;
        }
        return {
          values: flat(node),
          identity: snapshot
            ? {
                value: snapshot.identity,
                concurrency: snapshot.concurrency,
                ancestors,
              }
            : qualify(node),
          writable:
            !!node[nodeMetadata].operations.update &&
            !node[nodeMetadata].readOnly,
        };
      },
      async prepare(attempt) {
        const name =
          attempt.operation === "save" ? "update" : attempt.operation;
        const op = operation(name, attempt.identity);
        if (!op || op.disabledReason)
          throw Error(op?.disabledReason ?? "操作已撤销。");
        if (
          attempt.input &&
          options().persistence &&
          options().persistence?.secrets !== "encrypted" &&
          containsSecrets(
            fields(rowNode(attempt.identity) ?? sample.value),
            attempt.input,
          )
        )
          throw Error("秘密输入需要消费者加密的原请求存储。");
        callbacks.set(attempt.operation, {
          operation: op,
          run: op.run,
          node: currentNode(),
          record: rowNode(attempt.identity),
        });
        return clone({
          ...(attempt.identity ?? {
            value: null,
            ancestors,
            concurrency: qualify(selection.value).concurrency,
          }),
          original: {
            answers: clone(
              draftAnswers.get(
                toRaw(rowNode(attempt.identity) ?? selection.value),
              ) ?? {},
            ),
            input: attempt.input
              ? unflat(
                  rowNode(attempt.identity) ?? sample.value,
                  attempt.input,
                  true,
                )
              : undefined,
            node: path,
            owner: options().owner!,
            operation: name as ModelRequest<unknown, unknown>["operation"],
          },
        });
      },
      create: execute,
      save: execute,
      delete: execute,
      setEnabled: execute,
    };
    const projectedFields = computed(() => fields(selection.value));
    const projectedFilters = computed(() =>
      queryInput() ? fields(queryInput()!) : [],
    );
    let interactionTargets = new Map<string, ModelLocalIntent>();
    let previousInteractions: readonly import("./collaboration").Interaction<ModelLocalIntent>[] =
      [];
    let collaborationCache: CrudDefinition<
      Values,
      Values,
      Values,
      ModelIdentity
    >["collaboration"];
    let requestLeave = () => Promise.resolve(true);
    const definition: CrudDefinition<
      Values,
      Values,
      Values,
      ModelIdentity,
      object
    > = {
      [modelBinding]: {
        guard(check) {
          requestLeave = check;
          return () => {
            if (requestLeave === check) {
              requestLeave = () => Promise.resolve(true);
              displayed = undefined;
            }
          };
        },
        key: (row) => keyOf((row.$identity as ModelIdentity).value),
        recordKey: (id) => keyOf([id.value, id.ancestors]),
        navigationActive: () => !!navigationStep(),
        ready: () => hasQueried.value,
        draft: (values, id) => {
          const node = rowNode(id) ?? selection.value;
          try {
            adopt(node, unflat(node, values, false));
          } catch (error) {
            if (!(error instanceof StaleArrayRow)) throw error;
          }
        },
        row: (row) => {
          const node = rowNode(row.$identity as ModelIdentity);
          return node && currentNode()
            ? { ...flat(node), $identity: qualify(node) }
            : undefined;
        },
        detail: (id) => {
          const node = rowNode(id);
          return node && currentNode() ? flat(node) : undefined;
        },
        disabled: (action, id) =>
          action === "query"
            ? collectionOperations()?.query?.disabledReason
            : action === "create"
              ? collectionOperations()?.create?.disabledReason
              : (operation("update", id)?.disabledReason ??
                (!operation("update", id) ? "操作已撤销。" : undefined)),
      },
      resource,
      get title() {
        return currentNode()?.[nodeMetadata].name ?? first[nodeMetadata].name;
      },
      adapter,
      get fields() {
        return projectedFields.value as unknown as import("./contracts").Fields<Values>;
      },
      get filters() {
        return projectedFilters.value as unknown as import("./contracts").Fields<Values>;
      },
      initialFilters: () => (queryInput() ? flat(queryInput()!) : {}),
      get columns() {
        return fields(sample.value, [], false, "list")
          .filter((field) => field.type !== "secret")
          .map((field) => ({ key: field.key, label: field.label }));
      },
      identity: (row) => row.$identity as ModelIdentity,
      actions(row) {
        const operations = rowNode(row.$identity as ModelIdentity)?.[
          nodeMetadata
        ].operations;
        return [
          "view",
          ...(["update", "delete", "enable", "disable"] as const)
            .filter((key) => operations?.[key])
            .map((key) => (key === "update" ? "edit" : key)),
        ] as CrudAction[];
      },
      disabledActions(row) {
        const ops = rowNode(row.$identity as ModelIdentity)?.[nodeMetadata]
          .operations;
        return {
          edit: ops?.update?.disabledReason,
          delete: ops?.delete?.disabledReason,
          enable: ops?.enable?.disabledReason,
          disable: ops?.disable?.disabledReason,
        };
      },
      get collaboration() {
        if (
          !selection.value[nodeMetadata].operations.initialize &&
          !selection.value[nodeMetadata].operations.calculate
        )
          return undefined;
        return (collaborationCache ??= {
          change: async (
            input: Parameters<
              NonNullable<
                CrudDefinition<
                  Values,
                  Values,
                  Values,
                  ModelIdentity
                >["collaboration"]
              >["change"]
            >[0],
          ) => {
            const node = selection.value,
              operation =
                input.event === "initialize"
                  ? (node[nodeMetadata].operations.initialize ??
                    node[nodeMetadata].operations.calculate)
                  : node[nodeMetadata].operations.calculate;
            if (!operation || operation.disabledReason)
              return discardedCollaboration(input.value);
            const admittedOwner = ownerKey(options().owner),
              active = options().navigation.current?.node;
            const target =
              typeof input.target === "string"
                ? interactionTargets.get(input.target)
                : undefined;
            if (
              input.event === "action" &&
              target &&
              target.kind !== "calculate"
            ) {
              if (target.kind === "related") {
                options().navigation.visit(target.node, target.identity);
              } else {
                const download = await target.read({
                  owner: clone(options().owner!),
                  signal: input.signal,
                });
                if (
                  !input.signal.aborted &&
                  ownerKey(options().owner) === admittedOwner &&
                  node === selection.value
                ) {
                  const url = URL.createObjectURL(download.content),
                    anchor = document.createElement("a");
                  try {
                    anchor.href = url;
                    anchor.download = download.filename;
                    anchor.click();
                  } finally {
                    URL.revokeObjectURL(url);
                  }
                }
              }
              return discardedCollaboration(input.value);
            }

            const contextInput = unflat(node, input.value, false),
              inputFields = fields(node),
              calculate = operation.run,
              local = target?.kind === "calculate" ? target.run : undefined;
            const activeCalculation = () =>
              admittedOwner === ownerKey(options().owner) &&
              options().navigation.current?.node === active &&
              !input.signal.aborted &&
              node === selection.value &&
              (!target ||
                interactionTargets.get(input.target as string) === target) &&
              (target?.kind !== "calculate" || target.run === local) &&
              [
                node[nodeMetadata].operations.initialize,
                node[nodeMetadata].operations.calculate,
              ].includes(operation) &&
              operation.run === calculate &&
              !operation.disabledReason;
            let result: ModelCalculationResult<object>;
            try {
              result = local
                ? await local({
                    owner: clone(options().owner!),
                    input: contextInput,
                    answers: clone(input.answers),
                    signal: input.signal,
                  })
                : await calculate({
                    ...context(qualify(node), input.signal),
                    input: contextInput,
                    event: input.event,
                    answers: input.answers,
                  });
            } catch (error) {
              if (!activeCalculation())
                return discardedCollaboration(input.value);
              throw Error(
                redactSecrets(inputFields, input.value, message(error)),
              );
            }
            if (!activeCalculation())
              return discardedCollaboration(input.value);
            const accepted: Record<string, string | boolean> = {};
            for (const item of result.interactions ?? [])
              if (
                (item.kind === "confirm" || item.kind === "input") &&
                input.answers[item.id] !== undefined &&
                equalValues(
                  item,
                  previousInteractions.find(
                    (previous) => previous.id === item.id,
                  ),
                )
              )
                accepted[item.id] = input.answers[item.id]!;
            draftAnswers.set(toRaw(node), accepted);
            previousInteractions = result.interactions ?? [];
            interactionTargets = new Map();
            const register = (target: ModelLocalIntent) => {
              const key = crypto.randomUUID();
              interactionTargets.set(key, target);
              return key;
            };
            const interactions = result.interactions?.map((item) => {
              if (item.kind === "menu" || item.kind === "tree")
                return {
                  ...item,
                  items: item.items.map((entry) => ({
                    ...entry,
                    target: register(entry.target),
                    children: entry.children?.map((child) => ({
                      ...child,
                      target: register(child.target),
                    })),
                  })),
                };
              if (item.kind === "related" || item.kind === "download")
                return { ...item, target: register(item.target) };
              return item;
            });
            return {
              value: { ...input.value, ...flattenValue(node, result.value) },
              interactions,
            };
          },
        });
      },
      get persistence() {
        return options().persistence as
          | import("./write-recovery").WritePersistence<
              Attempt<Values, ModelIdentity>
            >
          | undefined;
      },
      async reconcile(attempt) {
        const op = operation(
          attempt.operation === "save" ? "update" : attempt.operation,
          attempt.identity,
        );
        if (
          !op?.reconcile ||
          op.disabledReason ||
          ownerKey(options().owner) !== attempt.scope
        )
          return { status: "unknown" };
        const outcome = await op.reconcile(request(attempt));
        if (
          outcome.status !== "unknown" &&
          (!outcome.evidence?.concurrency ||
            (attempt.operation !== "create" &&
              !equalValues(
                outcome.evidence.identity,
                attempt.identity?.value,
              )) ||
            (outcome.snapshot &&
              !equalValues(
                outcome.snapshot.identity,
                outcome.evidence.identity,
              )))
        )
          return { status: "unknown" };
        return outcome.status === "unknown"
          ? outcome
          : {
              status: outcome.status,
              attemptId: outcome.requestId,
              evidence: outcome.evidence,
              ...(outcome.snapshot
                ? {
                    identity: {
                      value: outcome.snapshot.identity,
                      ancestors,
                      concurrency: outcome.snapshot.concurrency,
                    },
                  }
                : {}),
            };
      },
      get export() {
        const op = collectionOperations()?.export;
        return op
          ? async ({ filters }: { filters: Values }) => {
              if (op.disabledReason) throw Error(op.disabledReason);
              const node = currentNode(),
                active = options().navigation.current?.node,
                owner = ownerKey(options().owner),
                generation = detailGeneration,
                controller = requestController,
                run = op.run;
              const artifact = await run({
                ...context(
                  { value: null, ancestors, concurrency: null },
                  controller.signal,
                ),
                input: queryInput()
                  ? unflat(queryInput()!, filters, false)
                  : {},
                page: 1,
                pageSize: 20,
              });
              if (
                controller.signal.aborted ||
                currentNode() !== node ||
                options().navigation.current?.node !== active ||
                ownerKey(options().owner) !== owner ||
                generation !== detailGeneration ||
                collectionOperations()?.export !== op ||
                op.run !== run ||
                op.disabledReason
              )
                throw Error("导出已失效。");
              if (artifact) {
                const url = URL.createObjectURL(artifact.content);
                try {
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = artifact.filename;
                  link.click();
                } finally {
                  URL.revokeObjectURL(url);
                }
              }
            }
          : undefined;
      },
    };
    const permissions = computed(() => ({
      query:
        !!currentNode() && (!collection || !!collectionOperations()?.query),
      create: !!collectionOperations()?.create,
      write: !!currentNode(),
      reconcile: !!currentNode(),
    }));
    const navigationStep = () =>
      locate(options().navigation.current).find(
        (step) =>
          equalValues(step.path, path) &&
          equalValues(step.ancestors, ancestors),
      );
    const crudPage: PageDefinition = defineCrudPage(() => ({
      definition,
      permissions: permissions.value,
      initialRow:
        navigationStep()?.identity !== undefined
          ? {
              $identity: {
                value: navigationStep()!.identity,
                ancestors,
                concurrency: null,
              },
            }
          : undefined,
      section: navigationStep()?.section ?? "$basic",
      onRecord: (id) => {
        displayed = id;
        if (id && options().navigation.current !== readingNavigation) return;
        const step = navigationStep();
        if (!step && options().navigation.current) return;
        if (step && equalValues(step.identity, id?.value)) return;
        const node = currentNode();
        if (node) options().navigation.visit(node, id?.value);
      },
      onSection: (key) => {
        const row = selection.value;
        const child = independentMembers(row).find(
          (member) => member.key === key,
        )?.node;
        const node = child ?? currentNode();
        if (node)
          options().navigation.visit(
            node,
            child ? undefined : identity(row).value,
          );
      },
      retainEditor: true,
      collaborateOnRead: true,
      viewHref: (row) => {
        const node = currentNode();
        return node
          ? options().navigation.href(
              node,
              (row.$identity as ModelIdentity).value,
            )
          : undefined;
      },
      rowLinks: (row) => {
        const record = rowNode(row.$identity as ModelIdentity);
        return record
          ? members(record).flatMap(([key, child]) => {
              if (child[nodeMetadata].kind !== "reference") return [];
              const target = (child as ValueNode)[nodeMetadata].options as {
                target?: ModelNode;
              };
              return target.target
                ? [
                    {
                      key,
                      label: `打开${child[nodeMetadata].name}`,
                      href: options().navigation.href(
                        target.target,
                        (child as ValueNode).value,
                      ),
                    },
                  ]
                : [];
            })
          : [];
      },
      onQueried: (filters) => {
        if (queryInput())
          adopt(queryInput()!, unflat(queryInput()!, filters, false));
      },
      related: (id: ModelIdentity) => {
        const row = rowNode(id);
        if (!row || id.value === null) return [];
        const ownOperations = Object.values(row[nodeMetadata].operations).some(
          (op) => op && modelOperation in op,
        );
        const related = independentMembers(row).map((child) => ({
          key: child.key,
          label: child.node[nodeMetadata].name,
          page: resolve(
            () => memberAt(rowNode(id), child.path),
            [...path, ...child.path],
            [...ancestors, id.value],
          ).page,
        }));
        return ownOperations
          ? [
              {
                key: "$operations",
                label: "业务办理",
                page: resolve(
                  () => rowNode(id),
                  [...path, "$operations"],
                  ancestors,
                ).page,
              },
              ...related,
            ]
          : related;
      },
    }));
    const hasOperations = () =>
      !collection &&
      Object.values(
        asObject(currentNode() ?? first)[nodeMetadata].operations,
      ).some((op) => op && modelOperation in op);
    const operationProtection =
      shallowRef<import("./edit-guard").EditProtection>();
    let operationProtectionOwner = "";
    const operationDefinition = {};
    const operationPage: PageDefinition<"task"> = {
      kind: "task",
      title: first[nodeMetadata].name,
      [snapshotPage]: () => ({
        title: currentNode()?.[nodeMetadata].name ?? first[nodeMetadata].name,
        definition: operationDefinition,
        record: [
          resource,
          currentNode() ? identity(asObject(currentNode()!)).value : null,
        ],
        security: ownerKey(options().owner),
        render: (context) =>
          h(ModelOperations, {
            node: () => currentNode() as RuntimeObject | undefined,
            application: () => source(),
            runtime,
            path,
            ancestors,
            discardVersion: context.discardVersion,
            requestLeave: context.requestLeave,
            onProtection: (value) => {
              operationProtectionOwner = context.scope;
              operationProtection.value = value;
              context.protection(value);
            },
          }),
      }),
    };
    const projections = new Map<
      symbol | string,
      { node: ModelNode | undefined; metadata: unknown; page: PageDefinition }
    >();
    let lastProjection: PageDefinition | undefined;
    function projection(): PageDefinition {
      if (
        lastProjection &&
        operationProtectionOwner === ownerKey(options().owner) &&
        operationProtection.value &&
        ["pending", "unknown", "seal", "refresh"].includes(
          operationProtection.value.writeState,
        )
      )
        return lastProjection;
      const facts = currentNode()
        ? asObject(currentNode()!)[nodeMetadata].operations
        : undefined;
      const kind =
        facts && modelWorkflow in facts
          ? modelWorkflow
          : facts && modelSubmission in facts
            ? modelSubmission
            : facts && modelBatch in facts
              ? modelBatch
              : collection && "page" in (collectionOperations()?.query ?? {})
                ? "query"
                : hasOperations()
                  ? modelOperation
                  : undefined;
      if (!kind) return lastProjection ?? crudPage;
      const metadata =
        typeof kind === "symbol"
          ? Reflect.get(facts!, kind)
          : collectionOperations()?.query;
      const cached = projections.get(kind);
      let result =
        cached && cached.node === currentNode() && cached.metadata === metadata
          ? cached.page
          : undefined;
      const protect = (value: import("./edit-guard").EditProtection) => {
        operationProtectionOwner = ownerKey(options().owner);
        operationProtection.value = value;
      };
      if (!result) {
        result =
          kind === modelWorkflow
            ? modelWorkflowPage(
                currentNode,
                () => source(),
                runtime,
                path,
                ancestors,
                protect,
              )
            : kind === modelSubmission
              ? modelSubmissionPage(
                  currentNode,
                  () => source(),
                  runtime,
                  path,
                  ancestors,
                  protect,
                )
              : kind === modelBatch
                ? modelBatchPage(
                    currentNode,
                    () => source(),
                    path,
                    ancestors,
                    protect,
                  )
                : kind === "query"
                  ? modelQueryPage(
                      currentNode,
                      () => source(),
                      runtime,
                      path,
                      ancestors,
                    )
                  : operationPage;
        projections.set(kind, { node: currentNode(), metadata, page: result });
      }
      lastProjection = result;
      return result;
    }
    const page: PageDefinition = {
      get kind() {
        return projection().kind;
      },
      get title() {
        return projection().title;
      },
      [snapshotPage]: () => projection()[snapshotPage](),
    };
    return {
      path,
      node: currentNode,
      rebind(next) {
        const previous = getNode();
        getNode = next;
        const current = getNode();
        if (current && current !== previous) {
          hasQueried.value = false;
          requestController.abort();
          sample.value = collection
            ? asCollection(current)[nodeMetadata].element()
            : asObject(current);
          selection.value = reactive(sample.value) as RuntimeObject;
        }
      },
      page,
      definition,
      requestLeave: () => requestLeave(),
      answers: () => clone(draftAnswers.get(toRaw(selection.value)) ?? {}),
      displayedIdentity: () => displayed,
      records: () => {
        const node = currentNode();
        if (!node) return [];
        if (!collection) return [asObject(node)];
        return [
          ...new Set([
            ...asCollection(node).items,
            ...(detached.get(node)?.values() ?? []),
            selection.value,
          ]),
        ];
      },
      pending: () =>
        writeLock(adapter, resource, ownerKey(options().owner)).phase !==
          "idle" ||
        (operationProtectionOwner === ownerKey(options().owner) &&
          !!operationProtection.value &&
          operationProtection.value.writeState !== "idle"),
      stop: () => requestController.abort(),
    };
  }
  function resolve(
    getNode: () => ModelNode | undefined,
    path: readonly string[],
    ancestors: readonly unknown[] = [],
  ): Boundary {
    const key = JSON.stringify([path, ancestors]);
    let result = cache.get(key);
    if (!result) {
      result = boundary(getNode, path, ancestors);
      cache.set(key, result);
    } else result.rebind(getNode);
    return result;
  }
  const runtime: ModelRuntime = {
    locate,
    async requestNavigation(next, leave) {
      const previous = locate(options().navigation.current),
        following = locate(next);
      const root = previous[0],
        nextRoot = following[0];
      if (!root || !nextRoot || toRaw(root.node) !== toRaw(nextRoot.node))
        return leave();
      const catchesUp = (step: typeof root, target: typeof root) => {
        const shown = cache
          .get(JSON.stringify([step.path, step.ancestors]))
          ?.displayedIdentity();
        return shown !== undefined && equalValues(shown.value, target.identity);
      };
      if (!equalValues(root.identity, nextRoot.identity))
        return catchesUp(root, nextRoot) ? true : leave();
      for (const step of previous.slice(1)) {
        const target = following.find(
          (item) =>
            toRaw(item.node) === toRaw(step.node) &&
            equalValues(item.ancestors, step.ancestors),
        );
        if (target && !equalValues(step.identity, target.identity)) {
          if (catchesUp(step, target)) return true;
          return resolve(
            () => step.node,
            step.path,
            step.ancestors,
          ).requestLeave();
        }
      }
      // Sections stay mounted under the same saved parent; their drafts and
      // unknown originals remain owned by those independent runtimes.
      return true;
    },
    restoreManifest,
    pendingRequests: () =>
      pendingRequests.value.filter(
        (item) => !cache.has(JSON.stringify([item.node, item.ancestors])),
      ),
    resolve,
    fields,
    flatten: flattenValue,
    adopt,
    flat,
    unflat,
    stop: () => {
      for (const item of cache.values()) item.stop();
    },
    recoveries: () => [...cache.values()].filter((entry) => entry.pending()),
    pending: () => [...cache.values()].some((entry) => entry.pending()),
  };
  applicationRuntimes.set(key, {
    runtime,
    rebind: (next) => {
      source = next;
    },
  });
  return runtime;
}
export type ModelRuntime = {
  requestNavigation(
    next: { node: ModelNode; identity?: unknown } | null | undefined,
    leave: () => Promise<boolean>,
  ): Promise<boolean>;
  locate(target: { node: ModelNode; identity?: unknown } | null | undefined): {
    node: ModelNode;
    path: readonly string[];
    ancestors: readonly unknown[];
    identity?: unknown;
    section?: string;
  }[];
  restoreManifest(): Promise<void>;
  pendingRequests(): readonly ModelPendingRequest[];
  resolve(
    getNode: () => ModelNode | undefined,
    path: readonly string[],
    ancestors?: readonly unknown[],
  ): {
    path: readonly string[];
    node(): ModelNode | undefined;
    rebind(getNode: () => ModelNode | undefined): void;
    page: PageDefinition;
    definition: CrudDefinition<Values, Values, Values, ModelIdentity, object>;
    pending(): boolean;
    answers(): import("./collaboration").InteractionAnswers;
    stop(): void;
  };
  fields(
    node: ModelNode,
    prefix?: readonly string[],
    inheritedReadonly?: boolean,
    projection?: "form" | "list",
  ): AnyField[];
  flatten: typeof flattenValue;
  adopt: typeof adopt;
  flat: typeof flat;
  unflat: typeof unflat;
  stop(): void;
  recoveries(): ReturnType<ModelRuntime["resolve"]>[];
  pending(): boolean;
};
