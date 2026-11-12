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
import { clone } from "./clone";
import { equalValues, containsSecrets } from "./editor-values";
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
type Read = {
  disabledReason?: string;
  input?: ModelNode;
  run(
    context: Context & { input: unknown; page: number; pageSize: number },
  ): Promise<unknown>;
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
    list?: readonly string[];
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
    operations: { query?: Read; create?: Write; export?: Read };
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
function adopt(node: ModelNode, value: unknown) {
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
      const child = arrayNode.items[index] ?? arrayNode[nodeMetadata].create();
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
function flat(
  node: ModelNode,
  prefix: readonly string[] = [],
  target: Values = {},
): Values {
  for (const [key, child] of members(node)) {
    if (independent(child)) continue;
    const path = [...prefix, key];
    if (isObject(child)) flat(child, path, target);
    else if (child[nodeMetadata].kind === "array")
      target[JSON.stringify(path)] = (
        child as unknown as { items: ModelNode[] }
      ).items.map((item) => (isObject(item) ? flat(item) : modelValue(item)));
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
            : arrayElement && isObject(arrayElement) && Array.isArray(input)
              ? input.map((row) => unflat(arrayElement, row, writable))
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
      target[JSON.stringify(path)] = next.map((value) =>
        isObject(element) ? flattenValue(element, value) : clone(value),
      );
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
    stop(): void;
  };
  const cache = shallowReactive(new Map<string, Boundary>());
  const pendingRequests = shallowRef<readonly ModelPendingRequest[]>([]);
  async function restoreManifest() {
    const owner = options().owner,
      persistence = options().persistence;
    pendingRequests.value = [];
    if (!owner || !persistence) return;
    const requested = ownerKey(owner);
    const pending = await persistence.pending(clone(owner));
    if (ownerKey(options().owner) === requested)
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
  ): AnyField[] {
    const form = isObject(node) ? asObject(node)[nodeMetadata].form : undefined;
    const ordered = form
      ? form.flatMap((key) => members(node).filter(([name]) => name === key))
      : members(node);
    return ordered.flatMap(([key, child]): AnyField[] => {
      if (independent(child)) return [];
      const path = [...prefix, key],
        meta = child[nodeMetadata];
      if (meta.kind === "object")
        return fields(
          child,
          path,
          inheritedReadonly || !!asObject(child)[nodeMetadata].readOnly,
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
        const array = child as unknown as {
          [nodeMetadata]: { element: ModelNode; create(): ModelNode };
        };
        return [
          {
            ...common,
            type: "rows",
            fields: fields(array[nodeMetadata].element),
            empty: () => flat(array[nodeMetadata].create()),
          },
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
    const currentNode = () => getNode();
    const detached = new WeakMap<ModelNode, Map<string, RuntimeObject>>();
    const rowNode = (id?: ModelIdentity): RuntimeObject | undefined => {
      if (!id) return selection.value;
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
        (name !== "create" &&
          rowNode(attempt.identity) !==
            callbacks.get(attempt.operation)?.record) ||
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
        name !== "create" &&
        !equalValues(qualify(rowNode(attempt.identity)!), {
          value: attempt.identity.value,
          ancestors: attempt.identity.ancestors,
          concurrency: attempt.identity.concurrency,
        })
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
            concurrency: null,
          }),
          original: {
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
    let collaborationCache: CrudDefinition<
      Values,
      Values,
      Values,
      ModelIdentity
    >["collaboration"];
    const definition: CrudDefinition<
      Values,
      Values,
      Values,
      ModelIdentity,
      object
    > = {
      [modelBinding]: {
        key: (row) => keyOf((row.$identity as ModelIdentity).value),
        ready: () => hasQueried.value,
        draft: (values, id) => {
          const node = rowNode(id) ?? selection.value;
          adopt(node, unflat(node, values, false));
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
        const list = sample.value[nodeMetadata].list;
        return fields(sample.value)
          .filter(
            (field) =>
              field.type !== "secret" &&
              (!list ||
                list.some((key) => field.key === JSON.stringify([key]))),
          )
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
              return { value: input.value };
            const admittedOwner = ownerKey(options().owner);
            const target =
              typeof input.target === "string"
                ? interactionTargets.get(input.target)
                : undefined;
            if (input.event === "action" && target) {
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
              return { value: input.value };
            }

            const result = await operation.run({
              ...context(qualify(node), input.signal),
              input: unflat(node, input.value, true),
              event: input.event,
              answers: input.answers,
            });
            if (
              admittedOwner !== ownerKey(options().owner) ||
              input.signal.aborted ||
              node !== selection.value ||
              ![
                node[nodeMetadata].operations.initialize,
                node[nodeMetadata].operations.calculate,
              ].includes(operation) ||
              operation.disabledReason
            )
              return { value: input.value };
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
              await op.run({
                ...context(
                  { value: null, ancestors, concurrency: null },
                  requestController.signal,
                ),
                input: queryInput()
                  ? unflat(queryInput()!, filters, false)
                  : {},
                page: 1,
                pageSize: 20,
              });
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
    const crudPage: PageDefinition = defineCrudPage(() => ({
      definition,
      permissions: permissions.value,
      initialRow:
        options().navigation.current?.node === currentNode() &&
        options().navigation.current?.identity !== undefined
          ? {
              $identity: {
                value: options().navigation.current!.identity,
                ancestors,
                concurrency: null,
              },
            }
          : undefined,
      retainEditor: true,
      collaborateOnRead: true,
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
        const related = members(row)
          .filter(([, child]) => independent(child))
          .map(([key, child]) => ({
            key,
            label: child[nodeMetadata].name,
            page: resolve(
              () =>
                (
                  rowNode(id) as unknown as
                    Record<string, ModelNode> | undefined
                )?.[key],
              [...path, key],
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
    const fixedQuery =
      collection && "page" in (collectionOperations()?.query ?? {});
    const opFacts = asObject(first)[nodeMetadata].operations;
    const page: PageDefinition =
      modelWorkflow in opFacts
        ? modelWorkflowPage(
            currentNode,
            () => source(),
            runtime,
            path,
            ancestors,
          )
        : modelSubmission in opFacts
          ? modelSubmissionPage(
              currentNode,
              () => source(),
              runtime,
              path,
              ancestors,
            )
          : modelBatch in opFacts
            ? modelBatchPage(currentNode, () => source(), path, ancestors)
            : fixedQuery
              ? modelQueryPage(
                  currentNode,
                  () => source(),
                  runtime,
                  path,
                  ancestors,
                )
              : hasOperations()
                ? {
                    kind: "task",
                    title: first[nodeMetadata].name,
                    [snapshotPage]: () => ({
                      title:
                        currentNode()?.[nodeMetadata].name ??
                        first[nodeMetadata].name,
                      definition: adapter,
                      record: resource,
                      security: ownerKey(options().owner),
                      render: (context) =>
                        h(ModelOperations, {
                          node: () =>
                            currentNode() as RuntimeObject | undefined,
                          application: () => source(),
                          runtime,
                          path,
                          ancestors,
                          discardVersion: context.discardVersion,
                          onProtection: context.protection,
                        }),
                    }),
                  }
                : crudPage;
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
      pending: () =>
        writeLock(adapter, resource, ownerKey(options().owner)).phase !==
        "idle",
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
    restoreManifest,
    pendingRequests: () =>
      pendingRequests.value.filter(
        (item) => !cache.has(JSON.stringify([item.node, item.ancestors])),
      ),
    resolve,
    fields,
    flatten: flattenValue,
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
    stop(): void;
  };
  fields(
    node: ModelNode,
    prefix?: readonly string[],
    inheritedReadonly?: boolean,
  ): AnyField[];
  flatten: typeof flattenValue;
  flat: typeof flat;
  unflat: typeof unflat;
  stop(): void;
  recoveries(): ReturnType<ModelRuntime["resolve"]>[];
  pending(): boolean;
};
