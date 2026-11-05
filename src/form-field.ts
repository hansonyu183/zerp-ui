import type { AnyField } from "./contracts";
// Internal rendering shape; only ReportParameters exposes enablement publicly.
export type FormField = AnyField & {
  enabledBy?: { key: string; label: string; readonly?: boolean };
};
export function fieldEnabled(field: FormField, value: object) {
  return (
    !field.enabledBy ||
    (value as Record<string, unknown>)[field.enabledBy.key] === true
  );
}
