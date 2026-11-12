import type { AnyField } from "./contracts";
import { valueAt, setValueAt } from "./model";

function secretSlots(
  fields: readonly AnyField[],
  values: object,
  visit: (values: object, key: string) => void,
) {
  for (const field of fields) {
    if (field.type === "secret") visit(values, field.key);
    else if (field.type === "rows") {
      const rows = valueAt(values, field.key);
      if (Array.isArray(rows))
        for (const row of rows)
          if (row && typeof row === "object")
            secretSlots(field.fields, row, visit);
    }
  }
}
export function clearSecrets(fields: readonly AnyField[], values: object) {
  secretSlots(fields, values, (row, key) => setValueAt(row, key, undefined));
}
export function containsSecrets(
  fields: readonly AnyField[],
  values: object,
): boolean {
  let found = false;
  secretSlots(fields, values, (row, key) => {
    const value = valueAt(row, key);
    if (typeof value === "string" && value !== "") found = true;
  });
  return found;
}

// Draft values are structural business data. Object key order has no meaning;
// array order and exact primitives (including null, false and empty text) do.
export function equalValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
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

export function freezeValues<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeValues(child);
    Object.freeze(value);
  }
  return value;
}
