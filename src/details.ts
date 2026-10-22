import type { AnyField, ReferenceValue } from "./contracts";

type DetailKind<V, I> =
  NonNullable<V> extends ReferenceValue
    ? { type: "reference"; related?: (value: NonNullable<V>) => I }
    : NonNullable<V> extends readonly (infer R)[]
      ? R extends object
        ? {
            type: "records";
            fields: DetailFields<R, I>;
            rowKey: (row: R) => string;
            rowLabel: (row: R) => string;
          }
        : { type: "texts" }
      : NonNullable<V> extends boolean
        ? { type: "boolean" | "text" }
        : NonNullable<V> extends number
          ? { type: "integer" | "text" }
          : NonNullable<V> extends string
            ? {
                type: "text" | "decimal" | "date" | "enum";
                options?: readonly { value: string; label: string }[];
              }
            : never;

export type DetailFields<T extends object, I = never> = readonly {
  [K in Extract<keyof T, string>]-?: { key: K; label: string } & DetailKind<
    T[K],
    I
  >;
}[Extract<keyof T, string>][];
export type DetailGroup<T extends object, I = never> = {
  key: string;
  label: string;
  fields: DetailFields<T, I>;
};

// Internal rendering shape; the public mapped type pairs each key with its value.
export type FactField = {
  key: string;
  label: string;
  type: string;
  options?: readonly { value: string; label: string }[];
  fields?: readonly FactField[];
  rowKey?: (row: object) => string;
  rowLabel?: (row: object) => string;
  related?: (value: ReferenceValue) => unknown;
};
export function factText(
  value: unknown,
  field: Pick<FactField, "type" | "options">,
): string {
  if (value === undefined || value === null) return "—";
  if (value === "") return "（空字符串）";
  if (field.type === "boolean" && typeof value === "boolean")
    return value ? "是" : "否";
  if (field.type === "enum")
    return (
      field.options?.find((o) => o.value === value)?.label ?? String(value)
    );
  if (
    field.type === "reference" &&
    typeof value === "object" &&
    "label" in value
  )
    return String(value.label);
  return String(value);
}
export function formFacts(fields: readonly AnyField[]): readonly FactField[] {
  return fields
    .filter((f) => f.type !== "password")
    .map((field) =>
      field.type === "rows"
        ? { ...field, type: "records", fields: formFacts(field.fields) }
        : {
            ...field,
            type:
              field.type === "references"
                ? "reference-list"
                : field.type === "multi-enum" || field.type === "date-range"
                  ? "texts"
                  : field.type,
          },
    );
}
