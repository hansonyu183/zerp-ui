import { toRaw } from "vue";

export type ReferenceAdapter = {
  directory: object;
  scopeKey?: string;
  load(): void | Promise<void>;
};

type Directory = {
  result?: true | Promise<void>;
  readers: number;
};
type Cache = Map<string, Directory>;
// 先按会话隔离，再按字段引用和业务依赖复用候选目录。
const scopes = new Map<string, WeakMap<object, Cache>>();

/** A complete directory, shared by fields in the same owner/dependency scope. */
export function readReferenceDirectory(
  adapter: ReferenceAdapter,
  scope: string,
) {
  let directories = scopes.get(scope);
  if (!directories) scopes.set(scope, (directories = new WeakMap()));
  const identity = toRaw(adapter.directory);
  let cache = directories.get(identity);
  if (!cache) directories.set(identity, (cache = new Map()));
  const cacheKey = adapter.scopeKey ?? "";
  let entry = cache.get(cacheKey);
  if (!entry) {
    entry = { readers: 0 };
    const current = entry;
    cache.set(cacheKey, current);
    const remove = () => {
      if (cache.get(cacheKey) === current) cache.delete(cacheKey);
    };
    try {
      const result = adapter.load();
      current.result =
        typeof result?.then === "function"
          ? Promise.resolve(result).then(
              () => {
                current.result = true;
              },
              (error: unknown) => {
                remove();
                throw error;
              },
            )
          : true;
    } catch (error) {
      remove();
      throw error;
    }
  }
  if (!entry.result) return;
  entry.readers++;
  const current = entry;
  let released = false;
  return {
    pending: entry.result === true ? undefined : entry.result,
    release() {
      if (released) return;
      released = true;
      current.readers--;
      if (
        !current.readers &&
        current.result !== true &&
        cache.get(cacheKey) === current
      )
        cache.delete(cacheKey);
    },
  };
}
export function clearReferenceDirectory(
  directory: object,
  scope: string,
  scopeKey: string,
) {
  scopes.get(scope)?.get(toRaw(directory))?.delete(scopeKey);
}

export function clearReferenceScope(scope: string) {
  scopes.delete(scope);
}
