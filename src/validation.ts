import type { AnyField } from "./contracts";
export function validate(
  fields: readonly AnyField[],
  values: object,
  mode: "create" | "edit",
): string | undefined {
  const record = values as Record<string, unknown>;
  for (const field of fields) {
    if (
      field.readonly ||
      (field.mode && field.mode !== mode) ||
      (field.when && record[field.when.key] !== field.when.equals)
    )
      continue;
    const value = record[field.key];
    if (
      field.required &&
      (value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && !value.length))
    )
      return `请填写${field.label}。`;
    if (value === null || value === undefined || value === "") continue;
    if (
      field.type === "decimal" &&
      (typeof value !== "string" || !/^[-+]?\d+(\.\d+)?$/.test(value))
    )
      return `${field.label}应为完整十进制数。`;
    if (
      field.type === "integer" &&
      (!Number.isInteger(value) ||
        (field.min !== undefined && Number(value) < field.min) ||
        (field.max !== undefined && Number(value) > field.max))
    )
      return `${field.label}应为有效整数。`;
    if (field.type === "rows")
      for (const row of value as object[]) {
        const error = validate(field.fields, row, mode);
        if (error) return error;
      }
  }
}
