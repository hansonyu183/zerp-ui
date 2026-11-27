import { computed, onBeforeUnmount, provide, reactive, shallowRef } from "vue";
import {
  createRouter,
  createWebHistory,
  routeLocationKey,
  routerKey,
  type RouteLocationNormalizedLoaded,
  type Router,
} from "vue-router";
import type { ListCollection } from "./business-model";
import { currentModel } from "./business-session";

const activeRouter = shallowRef<Router>();
const ready = shallowRef(false);
export const routeReady = computed(() => ready.value);
export const routePath = computed(
  () => activeRouter.value?.currentRoute.value.path ?? "/",
);
const routesForWork = computed(() => {
  const entries = new Map<ListCollection, string[]>();
  for (const member of currentModel.value?.work.members ?? []) {
    if (!("kind" in member)) entries.set(member, [member.key]);
    else if (member.kind === "domain")
      for (const collection of member.members)
        entries.set(collection, [member.key, collection.key]);
    else
      for (const child of member.members) {
        const domains = child.kind === "section" ? child.members : [child];
        for (const domain of domains)
          for (const collection of domain.members)
            entries.set(
              collection,
              child.kind === "section"
                ? [member.key, child.key, domain.key, collection.key]
                : [member.key, domain.key, collection.key],
            );
      }
  }
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

export function collectionHref(collection?: ListCollection | null) {
  return collection ? routesForWork.value.byCollection.get(collection) : "/";
}

export function goToCollection(collection?: ListCollection | null) {
  const path = collectionHref(collection);
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
  provide(routerKey, router);
  const location = {} as RouteLocationNormalizedLoaded;
  for (const key of Object.keys(router.currentRoute.value)) {
    const property = key as keyof RouteLocationNormalizedLoaded;
    Object.defineProperty(location, property, {
      enumerable: true,
      get: () => router.currentRoute.value[property],
    });
  }
  provide(routeLocationKey, reactive(location));
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
