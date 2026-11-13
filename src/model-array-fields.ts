import type { AnyField } from "./contracts";

type RowsField = Extract<AnyField, { type: "rows" }>;
const projection = Symbol("model-array-fields");

/** Private projection metadata follows internal field copies without adding a public option. */
export function bindArrayFields(
  field: RowsField,
  read: (row: object) => readonly AnyField[],
) {
  return Object.assign(field, { [projection]: read });
}
export function modelArrayFields(field: object, row: object) {
  const read = Reflect.get(field, projection) as
    ((row: object) => readonly AnyField[]) | undefined;
  return read?.(row);
}

export function arrayFields(
  field: RowsField,
  row: object,
): readonly AnyField[] {
  return modelArrayFields(field, row) ?? field.fields;
}

const childProjection = Symbol("model-array-child");
export function bindArrayChild<T extends object>(
  column: T,
  read: (parent: object) => RowsField,
) {
  return Object.assign(column, { [childProjection]: read });
}
export function childArray(
  column: { label: string; fields: readonly AnyField[]; empty(): object },
  parent: object,
): RowsField {
  const read = Reflect.get(column, childProjection) as
    ((parent: object) => RowsField) | undefined;
  return read
    ? read(parent)
    : {
        key: "items",
        label: column.label,
        type: "rows",
        fields: column.fields,
        empty: column.empty,
      };
}
