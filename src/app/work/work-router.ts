// 把静态集合结构映射为浏览器页面路由，管理路由的挂载和释放。
import { computed, onBeforeUnmount, shallowRef } from "vue";
import { createRouter, createWebHistory, type Router } from "vue-router";
import type {
  CollectionTarget,
  ListCollection,
} from "../../model/business-model";
import { collectionEntries } from "./structure";
import { readableTarget } from "../target";

const activeRouter = shallowRef<Router>();
const ready = shallowRef(false);
export const routeReady = computed(() => ready.value);
export const routePath = computed(
  () => activeRouter.value?.currentRoute.value.path ?? "/",
);
// 唯一集合键使用短路径，键冲突时使用完整业务路径区分。
const routesForWork = computed(() => {
  const entries = new Map(
    collectionEntries.value.map(({ collection, path }) => [collection, path]),
  );
  const count = new Map<string, number>();
  for (const collection of entries.keys())
    count.set(collection.key, (count.get(collection.key) ?? 0) + 1);
  const byPath = new Map<string, ListCollection>();
  const byCollection = new Map<ListCollection, string>();
  for (const [collection, keys] of entries) {
    const slug = (count.get(collection.key) === 1 ? [collection.key] : keys)
      .map(encodeURIComponent)
      .join("/");
    const path = `/business/${slug}`;
    byPath.set(path, collection);
    byCollection.set(collection, path);
  }
  return { byPath, byCollection };
});
export const routedCollection = computed(() =>
  routesForWork.value.byPath.get(routePath.value),
);

// 页面内部路由使用未包含 base 的路径，原生链接由 Router 生成。
export const homeHref = computed(() => activeRouter.value!.resolve("/").href);

export function collectionHref(collection: ListCollection) {
  const path = routesForWork.value.byCollection.get(collection);
  return path && activeRouter.value?.resolve(path).href;
}

// 已授权的记录在窗口中打开，只有集合目标拥有页面链接。
export function resolveTarget(target: CollectionTarget) {
  if (!readableTarget(target)) return;
  return {
    available: !target.record || !!target.record.businessType,
    href: target.record ? undefined : collectionHref(target.collection),
  };
}

export function targetHref(target: CollectionTarget) {
  if (!target.record && readableTarget(target))
    return collectionHref(target.collection);
}

export function goToCollection(collection?: ListCollection) {
  const path = collection
    ? routesForWork.value.byCollection.get(collection)
    : "/";
  if (path) void activeRouter.value?.push(path);
}

export function useWorkRouter() {
  const history = createWebHistory();
  const router = createRouter({
    history,
    routes: [{ path: "/:pathMatch(.*)*", component: {} }],
  });
  activeRouter.value = router;
  ready.value = false;
  void router.replace(history.location).then(() => {
    if (activeRouter.value === router) ready.value = true;
  });
  onBeforeUnmount(() => {
    router.listening = false;
    history.destroy();
    activeRouter.value = undefined;
    ready.value = false;
  });
}
