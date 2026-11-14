import { toRaw } from "vue";
import type { ReferenceAdapter, ReferenceValue } from "./contracts";

type Directory = {
  scope: string;
  controller: AbortController;
  value: Promise<readonly ReferenceValue[]>;
  readers: number;
  settled: boolean;
};
type Cache = Map<string, Directory>;
const directories = new WeakMap<object, Cache>();
const caches = new Set<WeakRef<Cache>>();
function key(
  adapter: ReferenceAdapter,
  scope: string,
  parent?: ReferenceValue | null,
) {
  return JSON.stringify([
    scope,
    adapter.dependencies ?? [],
    parent?.id ?? null,
  ]);
}
/** A complete directory, shared by fields in the same owner/dependency scope. */
export function readReferenceDirectory(
  adapter: ReferenceAdapter,
  scope: string,
  parent?: ReferenceValue | null,
) {
  const identity = toRaw(adapter.directory);
  let cache = directories.get(identity);
  if (!cache) {
    directories.set(identity, (cache = new Map()));
    caches.add(new WeakRef(cache));
  }
  const cacheKey = key(adapter, scope, parent);
  let entry = cache.get(cacheKey);
  if (!entry) {
    const controller = new AbortController();
    entry = {
      scope,
      controller,
      readers: 0,
      settled: false,
      value: Promise.resolve([]),
    };
    const current = entry;
    current.value = Promise.resolve()
      .then(() => adapter.load({ scope, parent, signal: controller.signal }))
      .catch((error) => {
        if (cache!.get(cacheKey) === current) cache!.delete(cacheKey);
        throw error;
      })
      .finally(() => {
        current.settled = true;
      });
    cache.set(cacheKey, current);
  }
  entry.readers++;
  const current = entry;
  let released = false;
  return {
    value: current.value,
    release() {
      if (released) return;
      released = true;
      current.readers--;
      if (!current.readers && !current.settled) {
        current.controller.abort();
        if (cache!.get(cacheKey) === current) cache!.delete(cacheKey);
      }
    },
  };
}
export function clearReferenceDirectory(
  adapter: ReferenceAdapter,
  scope: string,
  parent?: ReferenceValue | null,
) {
  const cache = directories.get(toRaw(adapter.directory));
  const cacheKey = key(adapter, scope, parent);
  cache?.get(cacheKey)?.controller.abort();
  cache?.delete(cacheKey);
}
export function clearReferenceScope(scope: string) {
  for (const reference of caches) {
    const cache = reference.deref();
    if (!cache) {
      caches.delete(reference);
      continue;
    }
    for (const [key, entry] of cache)
      if (entry.scope === scope) {
        entry.controller.abort();
        cache.delete(key);
      }
  }
}
