import { toRaw } from "vue";

// A plain DTO can contain a Vue proxy even when its root is not reactive.
// Remove those wrappers throughout the graph before letting the platform clone
// retain native values, aliases and cycles. Native objects are not serialized.
function rawGraph(value: unknown, seen: WeakMap<object, object>): unknown {
  if (!value || typeof value !== "object") return value;
  const raw = toRaw(value);
  const previous = seen.get(raw);
  if (previous) return previous;
  if (value instanceof Map) {
    const target = new Map<unknown, unknown>();
    seen.set(raw, target);
    value.forEach((entry: unknown, key: unknown) => {
      target.set(rawGraph(key, seen), rawGraph(entry, seen));
    });
    return target;
  }
  if (value instanceof Set) {
    const target = new Set<unknown>();
    seen.set(raw, target);
    value.forEach((entry: unknown) => target.add(rawGraph(entry, seen)));
    return target;
  }
  if (Array.isArray(value)) {
    const target: unknown[] = [];
    target.length = value.length;
    seen.set(raw, target);
    for (const key of Object.keys(value))
      Object.defineProperty(target, key, {
        value: rawGraph(Reflect.get(value, key), seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    return target;
  }
  if (Object.prototype.toString.call(raw) === "[object Object]") {
    const target = {};
    seen.set(raw, target);
    // Read through proxies so snapshot callers also observe nested changes.
    for (const key of Object.keys(value))
      Object.defineProperty(target, key, {
        value: rawGraph(Reflect.get(value, key), seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    return target;
  }
  // Date, File, Blob, RegExp, buffers and other native structured-clone values
  // retain their platform semantics. Unsupported values still fail natively.
  return raw;
}
export function clone<T>(value: T): T;
export function clone(value: unknown): unknown {
  return structuredClone(rawGraph(value, new WeakMap()));
}
export function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}
