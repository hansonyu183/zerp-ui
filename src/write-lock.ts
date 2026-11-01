import { shallowReactive } from "vue";
import type { Attempt } from "./contracts";
type Lock<A, C = unknown> = {
  phase: "idle" | "pending" | "unknown" | "refresh" | "blocked";
  attempt: A | null;
  context?: C;
  outcome?: "applied" | "not-applied";
};
// Keep unresolved writes across component removal and scope changes. Adapter identity
// must remain stable for the lifetime of a consumer session; no public unlock API.
const locks = new WeakMap<object, Map<string, Lock<unknown>>>();
export function writeLock<D, I, A = Attempt<D, I>, C = unknown>(
  adapter: object,
  resource: string,
  scope: string,
): Lock<A, C> {
  let entries = locks.get(adapter);
  if (!entries) {
    entries = new Map();
    locks.set(adapter, entries);
  }
  const key = JSON.stringify([resource, scope]);
  let lock = entries.get(key);
  if (!lock) {
    lock = shallowReactive<Lock<unknown>>({
      phase: "idle",
      attempt: null,
    });
    entries.set(key, lock);
  }
  return lock as Lock<A, C>;
}
