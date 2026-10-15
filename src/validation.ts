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
    if (
      field.type === "enum" &&
      !field.options.some((option) => option.value === value)
    )
      return `${field.label}应为可选值。`;
    if (field.type === "date" && !validDate(value))
      return `${field.label}应为有效日期。`;
    if (
      field.type === "date-range" &&
      (!Array.isArray(value) ||
        value.length !== 2 ||
        !value.every(validDate) ||
        value[0] > value[1])
    )
      return `${field.label}应为有效日期范围（起日不晚于止日）。`;
    if (field.type === "rows")
      for (const row of value as object[]) {
        const error = validate(field.fields, row, mode);
        if (error) return error;
      }
  }
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
