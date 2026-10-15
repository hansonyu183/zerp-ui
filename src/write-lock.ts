import { shallowReactive } from "vue";
import type { Attempt } from "./contracts";
type Lock<D, I> = {
  phase: "idle" | "pending" | "unknown" | "refresh";
  attempt: Attempt<D, I> | null;
};
// Keep unresolved writes across component removal and scope changes. Adapter identity
// must remain stable for the lifetime of a consumer session; no public unlock API.
const locks = new WeakMap<object, Map<string, Lock<unknown, unknown>>>();
export function writeLock<D, I>(
  adapter: object,
  resource: string,
  scope: string,
): Lock<D, I> {
  let entries = locks.get(adapter);
  if (!entries) {
    entries = new Map();
    locks.set(adapter, entries);
  }
  const key = JSON.stringify([resource, scope]);
  let lock = entries.get(key);
  if (!lock) {
    lock = shallowReactive<Lock<unknown, unknown>>({
      phase: "idle",
      attempt: null,
    });
    entries.set(key, lock);
  }
  return lock as Lock<D, I>;
}
