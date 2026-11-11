// Business types contain business facts only. Transport and controls belong to adapters.
export type BusinessType = {
  kind:
    | "text"
    | "longText"
    | "integer"
    | "decimal"
    | "date"
    | "datetime"
    | "boolean"
    | "enum"
    | "reference"
    | "object"
    | "array"
    | "collection";
  name: string;
  max?: number | null;
  nullable?: boolean;
  readOnly?: boolean;
  required?: boolean;
  secret?: boolean;
  numericText?: "integer" | "decimal";
  unit?: string;
  semantic?: "money" | "price";
  scale?: number;
  target?: string;
  dependsOn?: string;
  hierarchical?: boolean;
  options?: readonly { id: string; name: string }[];
  properties?: Record<string, BusinessType>;
  element?: BusinessType;
  list?: { fields: readonly string[] };
  form?: { fields: readonly string[] };
};
export type BusinessObject = BusinessType & {
  kind: "object";
  properties: Record<string, BusinessType>;
};
export type BusinessValue<T extends BusinessType> = T extends {
  kind: "object";
  properties: infer P extends Record<string, BusinessType>;
}
  ? { [K in keyof P]?: BusinessValue<P[K]> | null }
  : T extends {
        kind: "array" | "collection";
        element: infer E extends BusinessType;
      }
    ? BusinessValue<E>[]
    : T extends { kind: "integer" }
      ? number
      : T extends { kind: "boolean" }
        ? boolean
        : BusinessType extends T
          ? unknown
          : string;
export function propertyAt(
  type: BusinessType,
  path: string,
): BusinessType | undefined {
  return path
    .split(".")
    .reduce<BusinessType | undefined>(
      (node, key) => node?.properties?.[key],
      type,
    );
}
export function valueAt(value: unknown, path: string): unknown {
  if (value && typeof value === "object" && Object.hasOwn(value, path))
    return Reflect.get(value, path);
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" && Object.hasOwn(node, key)
          ? (node as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}
/** Update a declared business path without interpreting prototype properties. */
export function setValueAt(value: object, path: string, next: unknown): void {
  if (Object.hasOwn(value, path)) {
    Object.defineProperty(value, path, {
      value: next,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    return;
  }
  const keys = path.split(".");
  if (
    keys.some(
      (key) => !key || ["__proto__", "constructor", "prototype"].includes(key),
    )
  )
    throw Error("字段路径无效。");
  let parent = value as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    const current = parent[key];
    if (!current || typeof current !== "object" || Array.isArray(current))
      parent[key] = {};
    parent = parent[key] as Record<string, unknown>;
  }
  parent[keys.at(-1)!] = next;
}
export function formSections(type: BusinessType) {
  const fields = type.form?.fields ?? [];
  const ordinary = fields.filter(
    (path) =>
      !["object", "collection"].includes(propertyAt(type, path)?.kind ?? ""),
  );
  return [
    ...(ordinary.length
      ? [{ key: "$basic", name: "基本资料", fields: ordinary }]
      : []),
    ...fields
      .filter((path) =>
        ["object", "collection"].includes(propertyAt(type, path)?.kind ?? ""),
      )
      .map((path) => ({
        key: path,
        name: propertyAt(type, path)!.name,
        fields: [path],
      })),
  ].filter((section) =>
    section.fields.some((path) => {
      const node = propertyAt(type, path);
      return node?.kind !== "object" || !!node.form?.fields.length;
    }),
  );
}
export function leafFields(
  type: BusinessType,
  prefix = "",
): { path: string; field: BusinessType }[] {
  return Object.entries(type.properties ?? {}).flatMap(([key, field]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return field.kind === "object"
      ? leafFields(field, path)
      : [{ path, field }];
  });
}

export type BusinessInput<T extends BusinessType> = T extends {
  kind: "object";
  properties: infer P extends Record<string, BusinessType>;
}
  ? {
      [
        K in keyof P as P[K] extends { readOnly: true } | { kind: "collection" }
          ? never
          : K
      ]?:
        BusinessInput<P[K]> | (P[K] extends { nullable: true } ? null : never);
    }
  : T extends { kind: "array"; element: infer E extends BusinessType }
    ? BusinessInput<E>[]
    : T extends { kind: "integer" }
      ? number
      : T extends { kind: "boolean" }
        ? boolean
        : BusinessType extends T
          ? unknown
          : string;
export function writableType(type: BusinessType): BusinessType {
  if (type.kind !== "object") return type;
  const properties = Object.fromEntries(
    Object.entries(type.properties ?? {})
      .filter(([, field]) => !field.readOnly && field.kind !== "collection")
      .map(([key, field]) => [key, writableType(field)]),
  );
  return {
    kind: "object",
    name: type.name,
    properties,
    form: {
      fields: (type.form?.fields ?? []).filter(
        (path) => !!propertyAt({ ...type, properties }, path),
      ),
    },
  };
}
