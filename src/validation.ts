import type { AnyField, Fields } from "./contracts";
export type FieldValidationIssue<T extends object> = Readonly<{
  key: Extract<keyof T, string>;
  message: string;
}>;
export type FieldValidationResult<T extends object> = Readonly<{
  valid: boolean;
  issues: readonly FieldValidationIssue<T>[];
}>;
/** Model validity and unfinished local work are independent submission gates. */
export type FormValidationState<T extends object> = FieldValidationResult<T> &
  Readonly<{ pending: boolean }>;
export function validateFields<T extends object>(
  fields: Fields<T>,
  values: T,
  mode: "create" | "edit" = "edit",
): FieldValidationResult<T> {
  const issues: FieldValidationIssue<T>[] = [];
  for (const field of fields as readonly AnyField[]) {
    const message = validate([field], values, mode);
    if (message)
      issues.push({ key: field.key as Extract<keyof T, string>, message });
  }
  return { valid: issues.length === 0, issues };
}
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
      (!Number.isSafeInteger(value) ||
        (field.min !== undefined && Number(value) < field.min) ||
        (field.max !== undefined && Number(value) > field.max))
    )
      return `${field.label}应为有效整数。`;
    if (
      field.type === "enum" &&
      !field.options.some((option) => option.value === value)
    )
      return `${field.label}应为可选值。`;
    if (
      field.type === "multi-enum" &&
      (!Array.isArray(value) ||
        !value.every((item) =>
          field.options.some((option) => option.value === item),
        ))
    )
      return `${field.label}应为可选值。`;
    if (field.type === "reference" && !validReference(value))
      return `${field.label}应为有效引用。`;
    if (
      field.type === "references" &&
      (!Array.isArray(value) || !value.every(validReference))
    )
      return `${field.label}应为有效引用。`;
    if (
      field.type === "text" ||
      field.type === "textarea" ||
      field.type === "password"
    ) {
      if (typeof value !== "string") return `${field.label}应为文本。`;
      if (field.minLength !== undefined && value.length < field.minLength)
        return `${field.label}长度应为至少 ${field.minLength} 字符。`;
      if (field.maxLength !== undefined && value.length > field.maxLength)
        return `${field.label}长度应为至多 ${field.maxLength} 字符。`;
    }
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

function validReference(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    value.id !== "" &&
    "label" in value &&
    typeof value.label === "string"
  );
}
