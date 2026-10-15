import { toRaw } from "vue";
export function clone<T>(value: T): T {
  return structuredClone(toRaw(value));
}
export function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}
