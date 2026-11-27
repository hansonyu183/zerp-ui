// 同一目标只执行一个回调。仅在等待 Promise 时向界面呈现忙碌。
import { computed, shallowReactive, toRaw } from "vue";
import { sessionVersion } from "./session";

const executions = computed(() => {
  void sessionVersion.value;
  return shallowReactive(new WeakMap<object, boolean>());
});

export function run<T>(target: object, callback: () => T | Promise<T>) {
  const key = toRaw(target);
  const active = executions.value;
  if (active.has(key)) return;

  active.set(key, false);
  let pending = false;
  try {
    const result = callback();
    if (result && typeof (result as Promise<T>).then === "function") {
      pending = true;
      active.set(key, true);
      return Promise.resolve(result).finally(() => active.delete(key));
    }
    return result;
  } finally {
    if (!pending) active.delete(key);
  }
}

export function isPending(target: object) {
  return executions.value.get(toRaw(target)) === true;
}
