// 管理工作区集合、工作台和记录的读取方式，集合和工作台按会话复用。
import { computed, shallowReactive, shallowRef, toRaw } from "vue";
import type {
  ListCollection,
  Node,
  ObjectNode,
  Workbench,
} from "../../model/business-model";
import { feedbackForApplication, runWithFeedback, settle } from "../feedback";
import { run } from "../usePending";
import { readable, workbenchReadable } from "../nodes";
import { currentModel } from "../session";

export type QueryView =
  | { state: "loading" | "success"; page: number }
  | {
      state: "failure";
      page: number;
      retryPage: number;
      explicit: boolean;
      canRetry: () => boolean;
      notice?: string;
      blocking: boolean;
    };
// Track only the live condition values. The token invalidates retry without
// copying the query payload or writing a previous value back into the model.
function trackConditions(node: Node) {
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

const queries = shallowRef(
  shallowReactive(new WeakMap<ListCollection, QueryView>()),
);
let reads = new WeakMap<object, Promise<boolean>>();
let windowReads = new WeakMap<ObjectNode, Promise<boolean>>();

export function clearReads() {
  queries.value = shallowReactive(new WeakMap());
  windowReads = new WeakMap();
  reads = new WeakMap();
}

function cachedRead(
  node: ListCollection | Workbench | ObjectNode,
  first: boolean,
  start: (
    sameSession: () => boolean,
  ) => boolean | null | Promise<boolean | null> | undefined,
) {
  const key = toRaw(node);
  const cache = reads;
  if (first && cache.has(key)) return cache.get(key);
  const result = start(() => cache === reads);
  if (result === undefined) return;
  // 对象或窗口已失效时丢弃缓存，让下次打开可以重读。
  const pending = Promise.resolve(result).then((success) => {
    if (success === null && cache.get(key) === pending) cache.delete(key);
    return success === true;
  });
  cache.set(key, pending);
  return pending;
}

export function readCollection(
  collection: ListCollection,
  page?: number,
  explicit = false,
) {
  return cachedRead(collection, page === undefined, (sameSession) => {
    const action = explicit ? collection.operations.query : undefined;
    const load = collection.load;
    if ((!load && !action) || action?.disabled || !readable(collection)) return;

    return run(collection, () => {
      const params = {
        page: page ?? collection.page,
        pageSize: collection.pageSize,
      };
      const feedback = feedbackForApplication();
      const receipt = feedback.begin(collection, collection);
      const key = toRaw(collection);
      const views = queries.value;
      const previous = views.get(key);
      const canRetry = retryGuard(collection);
      const reading = {
        state: "loading" as const,
        page: previous?.state === "failure" ? previous.page : collection.page,
      };
      return settle(
        () => {
          const result = action ? action.run(params) : collection.load!(params);
          if (typeof result?.then === "function" && sameSession())
            views.set(key, reading);
          return result;
        },
        (success) => {
          const valid =
            sameSession() &&
            collection.load === load &&
            (!action || collection.operations.query === action) &&
            readable(collection);
          const visible = valid && receipt.visible();
          if (visible && success)
            views.set(key, { state: "success", page: collection.page });
          else if (visible) {
            const notice = receipt.queryFailure();
            const local = notice?.blocking ? undefined : notice;
            views.set(key, {
              state: "failure",
              page: reading.page,
              retryPage: params.page,
              explicit,
              canRetry,
              notice: local?.text,
              blocking: !!notice?.blocking,
            });
          } else if (views.get(key) === reading) {
            if (previous) views.set(key, previous);
            else views.delete(key);
          }
          receipt.finish(visible);
          return valid ? success : null;
        },
      );
    });
  });
}

export function readWorkbench(node: Workbench, first = true) {
  return cachedRead(node, first, (sameSession) => {
    const load = node.load;
    const valid = () =>
      sameSession() &&
      node.load === load &&
      currentModel.value?.work.workbench === node &&
      workbenchReadable(node);
    if (!load || !valid()) return;
    return run(node, () => {
      const feedback = feedbackForApplication();
      const receipt = feedback.begin(node);
      return settle(
        () => load(),
        (success) => {
          const current = valid();
          const visible = current && receipt.visible();
          if (!success && visible) receipt.reportFailure();
          receipt.finish(visible);
          return current ? success : null;
        },
      );
    });
  });
}

export function readRecord(record: ObjectNode, windowCurrent?: () => boolean) {
  const load = record.load;
  const id = record.identity;
  if (!load || id === null) return;
  const sessionReads = reads;
  const valid = () =>
    sessionReads === reads &&
    windowCurrent?.() !== false &&
    record.load === load &&
    record.identity === id &&
    readable(record);
  const start = () =>
    runWithFeedback(
      record,
      () => load.call(record, id),
      valid,
      record,
      !!windowCurrent,
    );
  if (!windowCurrent)
    return cachedRead(record, true, () => {
      const result = start();
      if (result === undefined) return;
      return Promise.resolve(result).then((success) =>
        valid() ? success : null,
      );
    });

  const key = toRaw(record);
  const queue = windowReads;
  const previous = queue.get(key);
  const pending = Promise.resolve(previous)
    .then(start)
    .then((result) => result === true)
    .finally(() => {
      if (queue.get(key) === pending) queue.delete(key);
    });
  queue.set(key, pending);
  return pending;
}

export function queryView(collection: ListCollection) {
  return queries.value.get(toRaw(collection));
}
