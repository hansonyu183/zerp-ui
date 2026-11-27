// 比较草稿与基准时忽略对象属性顺序，保留数组顺序及 null、false、空字符串等值的差异。
export function equalValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (typeof File !== "undefined" && (a instanceof File || b instanceof File))
    return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => equalValues(value, b[i]))
    );
  if (a instanceof Date || b instanceof Date)
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && equalValues(left[key], right[key]),
    )
  );
}
