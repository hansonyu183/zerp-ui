import { computed, reactive, shallowReactive, shallowRef, toRaw } from "vue";
import type {
  BusinessModel,
  BusinessNode,
  ListCollection,
  Operation,
  ObjectNode,
  RecordsNode,
  Workbench,
} from "./business-model";
import {
  allowed,
  ancestors,
  available,
  isCollection,
  operations,
  readable,
  type Node,
  workbenchReadable,
} from "./business-nodes";
import { currentModel, sessionScope } from "./business-session";
import { draftOrigin, registerDraftRows } from "./record-draft";
import { directFeedback } from "./direct-feedback";
import { clearReportPositions, saveReportPosition } from "./report-position";

export type QueryView =
  | { state: "loading" | "success"; page: number }
  | {
      state: "failure";
      page: number;
      retryPage: number;
      explicit: boolean;
      canRetry: () => boolean;
      error: string;
    };
type ExecutionOptions = {
  readsRecord?: boolean;
  query?: ListCollection;
  requestedPage?: number;
  explicit?: boolean;
  recordWindow?: boolean;
  cacheRead?: boolean;
  target?: Node;
};
// Track only the live condition values. The token invalidates retry without
// copying the query payload or writing a previous value back into the model.
function trackConditions(node: BusinessNode) {
  if (node.kind === "object") {
    node.members.forEach(trackConditions);
  } else if (node.kind === "records") {
    node.items.forEach(trackConditions);
  } else if (node.kind !== "output") {
    const value = node.value;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if ("id" in entry) void entry.id;
      }
    } else if (value && typeof value === "object") {
      Object.values(value);
    }
  }
}
function retryGuard(collection: ListCollection) {
  const revision = computed(() => {
    trackConditions(collection.conditions);
    return Symbol();
  });
  const requested = revision.value;
  return () => revision.value === requested;
}
function createOperations(model: () => BusinessModel) {
  const busy = reactive(new Map<object, (() => boolean) | undefined>());
  const executions = new Map<object, symbol>();
  const feedbackExecutions = new Set<symbol>();
  const queries = shallowRef(
    shallowReactive(new WeakMap<ListCollection, QueryView>()),
  );
  let epoch = 0;
  let initialReads = new WeakMap<object, Promise<boolean | undefined>>();
  const failedRecords = shallowReactive(new Set<ObjectNode>());
  const feedback = directFeedback(
    model,
    sessionScope,
    readable,
    ancestors,
    (node) =>
      available(node, "reconcile") ||
      Object.entries(operations(node)).some(
        ([action, operation]) => operation.disabled && allowed(node, action),
      ),
    () =>
      feedbackExecutions.size === 1
        ? feedbackExecutions.values().next().value
        : undefined,
  );
  async function execute(
    key: object,
    op: Operation,
    valid: () => boolean,
    options: ExecutionOptions = {},
  ) {
    key = toRaw(key);
    if (op.disabled || busy.has(key) || !valid()) return;
    const root = model(),
      start = epoch,
      owner = sessionScope.value,
      execution = Symbol(),
      messages = feedback.start(),
      queryViews = queries.value,
      collection = options.query && toRaw(options.query),
      previous = collection && queryViews.get(collection),
      retryPage = options.requestedPage ?? collection?.page,
      canRetry = options.query && retryGuard(options.query),
      stillPresent = feedback.capture(options.target),
      reading: QueryView | undefined = collection && {
        state: "loading",
        page: previous?.state === "failure" ? previous.page : collection.page,
      },
      resourceCurrent = () =>
        model() === root && owner === sessionScope.value && valid(),
      current = () =>
        (options.recordWindow || start === epoch) &&
        resourceCurrent() &&
        stillPresent();
    if (collection && reading) queryViews.set(collection, reading);
    executions.set(key, execution);
    feedbackExecutions.add(execution);
    busy.set(key, options.readsRecord ? current : undefined);
    try {
      await op.run();
      if (collection && current())
        queryViews.set(collection, { state: "success", page: collection.page });
      return options.cacheRead ? resourceCurrent() : current();
    } catch {
      if (current()) {
        const notice = feedback.specific(
          messages,
          options.target,
          execution,
          !!collection,
        );
        if (collection && reading && canRetry && retryPage !== undefined) {
          const queryNotice = notice?.blocking ? undefined : notice;
          if (queryNotice) feedback.place(queryNotice, collection, true);
          queryViews.set(collection, {
            state: "failure",
            page: reading.page,
            retryPage,
            explicit: !!options.explicit,
            canRetry,
            error: queryNotice
              ? `查询失败：${queryNotice.text}`
              : notice?.blocking
                ? "查询失败。"
                : "查询失败，请重试。",
          });
        } else if (notice) {
          feedback.place(notice, notice.target ?? options.target ?? null);
        } else {
          feedback.fail(options.target ?? null);
        }
      }
    } finally {
      if (
        !current() &&
        (!executions.has(key) || executions.get(key) === execution)
      )
        feedback.discard(messages, options.target, execution);
      feedbackExecutions.delete(execution);
      if (collection && queryViews.get(collection) === reading) {
        if (previous) queryViews.set(collection, previous);
        else queryViews.delete(collection);
      }
      if (executions.get(key) === execution) {
        executions.delete(key);
        busy.delete(key);
      }
    }
  }
  async function run(
    node: Node,
    action: string,
    publicAuth = false,
    input?: ObjectNode | RecordsNode,
  ) {
    const op = operations(node)[action] as
        Operation<ObjectNode | RecordsNode | void> | undefined,
      identity = "identity" in node ? node.identity : node.key;
    const valid = () =>
      operations(node)[action] === op &&
      ("identity" in node ? node.identity : node.key) === identity &&
      allowed(node, action, publicAuth);
    if (op)
      return await execute(
        isCollection(node) ? node : draftOrigin(node),
        {
          get disabled() {
            return op.disabled;
          },
          async run() {
            await op.run(
              input ??
                (isCollection(node)
                  ? undefined
                  : node.kind === "object" || node.kind === "records"
                    ? node
                    : undefined),
            );
            if (!isCollection(node) && node.kind === "records")
              registerDraftRows(node);
          },
        },
        valid,
        {
          recordWindow: !!input,
          target: publicAuth ? undefined : node,
        },
      );
  }
  function invalidate(scopeChanged = false) {
    epoch++;
    feedback.clear();
    if (scopeChanged) {
      queries.value = shallowReactive(new WeakMap());
      initialReads = new WeakMap();
      failedRecords.clear();
      executions.clear();
      busy.clear();
    }
    clearReportPositions(scopeChanged);
  }
  function read(
    node: ListCollection | Workbench | ObjectNode,
    request?: { page: number; pageSize: number },
    first = false,
    explicit = false,
    windowCurrent?: () => boolean,
  ) {
    const load = node.load;
    const key = toRaw(node);
    const collection = "conditions" in node ? node : undefined;
    const action = explicit ? collection?.operations.query : undefined;
    if (first && initialReads.has(key)) return initialReads.get(key);
    if ((!load && !action) || action?.disabled || busy.has(key)) return;
    const record = "kind" in node ? node : undefined;
    const id = record?.identity;
    const valid = () =>
      windowCurrent?.() !== false &&
      node.load === load &&
      (!action || collection?.operations.query === action) &&
      (collection
        ? readable(collection)
        : record
          ? id != null && record.identity === id && readable(record)
          : currentModel.value?.work.workbench === node &&
            workbenchReadable(node as Workbench));
    if (!valid()) return;
    const operation: Operation = {
      disabled: false,
      run: () => {
        if (collection) {
          const params = request ?? {
            page: collection.page,
            pageSize: collection.pageSize,
          };
          return action ? action.run(params) : collection.load!(params);
        }
        return record ? record.load!(id!) : (load as () => Promise<void>)();
      },
    };
    if (record) failedRecords.delete(toRaw(record));
    const owner = sessionScope.value;
    const reads = initialReads;
    const pending = execute(node, operation, valid, {
      query: collection,
      requestedPage: request?.page,
      explicit,
      readsRecord: !!record,
      recordWindow: !!windowCurrent,
      cacheRead: true,
      target: collection ?? record,
    }).then((loaded) => {
      if (!loaded && !valid() && reads.get(key) === pending) reads.delete(key);
      if (
        loaded &&
        collection?.report &&
        owner === sessionScope.value &&
        request
      )
        saveReportPosition(collection, { left: 0, top: 0 });
      if (record && !loaded && owner === sessionScope.value && valid())
        failedRecords.add(toRaw(record));
      return loaded;
    });
    reads.set(key, pending);
    return pending;
  }
  return {
    execute,
    run,
    read,
    invalidate,
    feedback,
    busy,
    queries,
    failedRecords,
  };
}

let activeOperations: ReturnType<typeof createOperations> | undefined;

export function startBusinessOperations(model: () => BusinessModel) {
  const operations = createOperations(model);
  activeOperations = operations;
  return {
    blocking: operations.feedback.blocking,
    invalidate: operations.invalidate,
    dispose() {
      operations.invalidate(true);
      activeOperations = undefined;
    },
  };
}

export function feedbackForApplication() {
  return activeOperations!.feedback;
}

export function isPending(node: object) {
  return (
    activeOperations?.busy.has(toRaw(draftOrigin(node as BusinessNode))) ??
    false
  );
}

export function isReading(node: object) {
  return activeOperations?.busy.get(toRaw(node))?.() ?? false;
}

export function queryView(collection: ListCollection) {
  return activeOperations?.queries.value.get(toRaw(collection));
}

export function executeOperation(
  node: object,
  operation: Operation,
  valid: () => boolean,
  options?: ExecutionOptions,
) {
  return activeOperations?.execute(node, operation, valid, options);
}

export function runOperation(
  node: Node,
  action: string,
  publicAuth = false,
  input?: ObjectNode | RecordsNode,
) {
  return activeOperations?.run(node, action, publicAuth, input);
}

export function invalidateOperations() {
  activeOperations?.invalidate();
}

export function loadFirst(
  node: ListCollection | Workbench | ObjectNode,
  windowCurrent?: () => boolean,
) {
  return activeOperations?.read(node, undefined, true, false, windowCurrent);
}
export function loadPage(node: ListCollection, page: number, explicit = false) {
  return activeOperations?.read(
    node,
    { page, pageSize: node.pageSize },
    false,
    explicit,
  );
}
export function reloadWorkbench(node: Workbench) {
  return activeOperations?.read(node);
}

export function recordLoadFailed(node: ObjectNode) {
  return activeOperations?.failedRecords.has(toRaw(node)) ?? false;
}
export function retryRecord(node: ObjectNode, windowCurrent: () => boolean) {
  return activeOperations?.read(node, undefined, false, false, windowCurrent);
}
