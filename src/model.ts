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
  /** Applied only when a projected object-array row is newly created. */
  initialValue?: string | number | boolean | null;
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
  if (type.properties && Object.hasOwn(type.properties, path))
    return type.properties[path];
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
  const basic = ordinary.length
    ? { key: "$basic", name: "基本资料", fields: ordinary }
    : undefined;
  return fields
    .flatMap((path) => {
      const node = propertyAt(type, path);
      if (["object", "collection"].includes(node?.kind ?? ""))
        return [{ key: path, name: node!.name, fields: [path] }];
      return path === ordinary[0] && basic ? [basic] : [];
    })
    .filter((section) =>
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

/** Application properties are module references, not loaded business records. */
export type ApplicationObject = BusinessObject & {
  navigation: {
    groups: readonly {
      id: string;
      name: string;
      ungrouped?: boolean;
      modules: readonly string[];
    }[];
  };
};
export function applicationGroups(model: ApplicationObject) {
  const groups = new Set<string>();
  const modules = new Set<string>();
  const result = model.navigation.groups.flatMap((group) => {
    if (groups.has(group.id)) throw Error(`重复导航分组：${group.id}`);
    groups.add(group.id);
    const projected = group.modules.map((id) => {
      if (modules.has(id)) throw Error(`重复模块引用：${id}`);
      const module = Object.hasOwn(model.properties, id)
        ? model.properties[id]
        : undefined;
      if (module?.kind !== "object" || !module.target)
        throw Error(`未定义模块引用：${id}`);
      modules.add(id);
      return { id, name: module.name, target: module.target };
    });
    return projected.length ? [{ ...group, modules: projected }] : [];
  });
  for (const id of Object.keys(model.properties))
    if (!modules.has(id)) throw Error(`模块未投影：${id}`);
  return result;
}

export {
  application,
  object,
  collection,
  array,
  reference,
  text,
  longText,
  integer,
  decimal,
  boolean,
  date,
  datetime,
  secret,
  enumeration,
  messages,
} from "./reactive-model";
export type {
  ModelOwner,
  ModelRequest,
  ModelSnapshot,
  ModelWriteResult,
  ModelEvidence,
  ModelWrite,
  ModelRead,
  ModelContext,
  ModelValue,
  ModelInput,
  ObjectNode,
  CollectionNode,
  ApplicationNode,
  ValueNode,
  ModelNode,
  ModelNavigation,
  ModelApplicationOptions,
  ModelIdentity,
  ModelPersistence,
  ModelPendingRequest,
  ModelFieldPath,
  ModelCalculation,
  ModelLocalIntent,
} from "./reactive-model";

export { operation } from "./model-operation";
export type { ModelOperation, ModelActionModel } from "./model-operation";
export type {
  OperationModel,
  OperationPreview,
  OperationRequest,
  OperationIntent,
  OperationReceipt,
  OperationSettlement,
  OperationJournal,
  OperationPersistence,
} from "./operation";
export type { PrintDocument, PrintItem } from "./printing";

export type { ModelQuery } from "./model-query";

export { documentOperations, voucherOperations } from "./model-submission";

export { batchOperations } from "./model-batch";
export type { ModelBatchOperation } from "./model-batch";
export type { BatchEntry, BatchJournal, BatchPersistence } from "./batch";

export { workflowOperations } from "./model-workflow";
