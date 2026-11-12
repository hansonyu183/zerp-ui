import { computed, h, toValue, type MaybeRefOrGetter } from "vue";
import type { BusinessType, BusinessValue, BusinessObject } from "./model";
import { formSections, propertyAt, setValueAt } from "./model";
import type {
  AnyField,
  Column,
  CrudDefinition,
  Fields,
  FieldGroup,
  ReferenceAdapter,
} from "./contracts";
import {
  defineCrudPage,
  snapshotPage,
  type CrudPage,
  type PageDefinition,
  type PageSource,
  type PageContext,
} from "./pages";
import ModulePage from "./ModulePage.vue";

/** IDs, domain data, requests and authority stay in the consumer's typed adapter. */
export type BusinessDefinition<
  T extends BusinessObject,
  F extends object,
  R extends object,
  I,
  E = never,
> = Omit<
  CrudDefinition<BusinessValue<T>, F, R, I, E>,
  "fields" | "groups" | "columns" | "labels"
> & {
  model: T;
  labels?: (row: R) => Readonly<Record<string, string>>;
  /** Ordered list paths are relative to this business value in a row. */
  rowValue?: Extract<keyof R, string>;
  reference?: (field: BusinessType, path: string) => ReferenceAdapter;
};

function initialRow(type: BusinessType): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const path of type.form?.fields ?? []) {
    const field = propertyAt(type, path);
    if (!field || field.readOnly || field.secret || field.kind === "collection")
      continue;
    if (field.kind === "object") setValueAt(result, path, initialRow(field));
    else if (field.kind === "array") setValueAt(result, path, []);
    else if (field.initialValue !== undefined)
      setValueAt(result, path, field.initialValue);
  }
  return result;
}

function projectedFields(
  model: BusinessType,
  reference: BusinessDefinition<
    BusinessObject,
    object,
    object,
    unknown
  >["reference"],
  prefix = "",
  inheritedReadonly = false,
  independent: ReadonlySet<string> = new Set(),
  section?: { key: string; label: string },
): AnyField[] {
  return (model.form?.fields ?? []).flatMap((path): AnyField[] => {
    const node = propertyAt(model, path);
    if (!node) throw Error(`未定义字段：${path}`);
    if (independent.has(prefix + path)) {
      if (node.kind !== "object" && node.kind !== "collection")
        throw Error(`独立资源必须是对象或集合：${path}`);
      return [];
    }
    const key = prefix + path;
    if (node.kind === "collection")
      throw Error(`请提供${node.name}的独立资源定义。`);
    if (node.kind === "object")
      return projectedFields(
        node,
        reference,
        key + ".",
        inheritedReadonly || !!node.readOnly,
        independent,
        prefix
          ? {
              key,
              label: section ? `${section.label} / ${node.name}` : node.name,
            }
          : undefined,
      );
    const common = {
      key,
      section,
      label: node.name + (node.unit ? `（${node.unit}）` : ""),
      required: node.required,
      readonly: inheritedReadonly || node.readOnly,
    };
    if (node.secret)
      return [{ ...common, type: "secret", maxLength: node.max ?? undefined }];
    if (node.kind === "array" && node.options)
      return [
        {
          ...common,
          type: "multi-enum",
          options: node.options.map((option) => ({
            value: option.id,
            label: option.name,
          })),
        },
      ];
    const ref =
      node.kind === "reference"
        ? node
        : node.element?.kind === "reference"
          ? node.element
          : undefined;
    if (ref) {
      if (!reference) throw Error(`请提供${node.name}的引用 Adapter。`);
      return [
        {
          ...common,
          type: node.kind === "array" ? "references" : "reference",
          valueMode: "id",
          adapter: reference(ref, key),
          parentKey: ref.dependsOn,
          hierarchical: ref.hierarchical,
        },
      ];
    }
    if (node.kind === "array") {
      if (node.element?.kind === "object")
        return [
          {
            ...common,
            type: "rows",
            fields: projectedFields(node.element, reference),
            empty: () => initialRow(node.element!),
          },
        ];
      return [
        {
          ...common,
          type: "multi-enum",
          options: (node.options ?? node.element?.options ?? []).map(
            (option) => ({ value: option.id, label: option.name }),
          ),
        },
      ];
    }
    if (node.kind === "enum")
      return [
        {
          ...common,
          type: "enum",
          options: (node.options ?? []).map((option) => ({
            value: option.id,
            label: option.name,
          })),
        },
      ];
    if (node.kind === "boolean") return [{ ...common, type: "boolean" }];
    if (node.kind === "integer") return [{ ...common, type: "integer" }];
    if (node.kind === "decimal") return [{ ...common, type: "decimal" }];
    if (node.kind === "date") return [{ ...common, type: "date" }];
    return [
      {
        ...common,
        type: node.kind === "longText" ? "textarea" : "text",
        maxLength: node.max ?? undefined,
      },
    ];
  });
}

export type BusinessPage<
  T extends BusinessObject,
  F extends object,
  R extends object,
  I,
  E = never,
> = Omit<
  CrudPage<BusinessValue<T>, F, R, I, E>,
  "definition" | "blocks" | "related" | "collaborateOnRead" | "retainEditor"
> & {
  definition: BusinessDefinition<T, F, R, I, E>;
  related?: Readonly<
    Record<string, (identity: I) => PageDefinition | undefined>
  >;
};
export function defineBusinessPage<
  T extends BusinessObject,
  F extends object,
  R extends object,
  I,
  E = never,
>(source: PageSource<BusinessPage<T, F, R, I, E>>): PageDefinition<"crud"> {
  // Keep the runtime definition stable while per-record effective types change.
  const value = computed(() => toValue(source));
  const definitions = new WeakMap<
    BusinessDefinition<T, F, R, I, E>,
    CrudDefinition<BusinessValue<T>, F, R, I, E>
  >();
  function runtime(current: BusinessDefinition<T, F, R, I, E>) {
    const previous = definitions.get(current);
    if (previous) return previous;
    const fields = computed(() =>
      projectedFields(
        current.model,
        current.reference,
        "",
        false,
        new Set(Object.keys(value.value.related ?? {})),
      ),
    );
    const groups = computed(() =>
      formSections(current.model).map((section) => ({
        key: section.key,
        label: section.name,
        fields: fields.value
          .filter((field) =>
            section.fields.some(
              (path) => field.key === path || field.key.startsWith(path + "."),
            ),
          )
          .map((field) => field.key),
      })),
    );
    const columns = computed(() =>
      (current.model.list?.fields ?? []).map((path) => {
        const field = propertyAt(current.model, path);
        if (!field) throw Error(`未定义列表字段：${path}`);
        return {
          key: (current.rowValue ? current.rowValue + "." : "") + path,
          label: field.name,
          type:
            field.kind === "boolean" ||
            field.kind === "integer" ||
            field.kind === "decimal"
              ? field.kind
              : "text",
        };
      }),
    );
    // Reflection turns a validated runtime model into the private rendering shape;
    // the public definition still pairs the exact model value, row and identity.
    const result: CrudDefinition<BusinessValue<T>, F, R, I, E> = {
      ...current,
      get fields() {
        return fields.value as unknown as Fields<BusinessValue<T>>;
      },
      get groups() {
        return groups.value as unknown as FieldGroup<BusinessValue<T>>[];
      },
      get columns() {
        return columns.value as Column<R>[];
      },
      get export() {
        return current.export;
      },
      labels: current.labels
        ? (row) =>
            Object.fromEntries(
              Object.entries(current.labels!(row)).map(([path, label]) => [
                (current.rowValue ? current.rowValue + "." : "") + path,
                label,
              ]),
            ) as Readonly<Partial<Record<Extract<keyof R, string>, string>>>
        : undefined,
    };
    definitions.set(current, result);
    return result;
  }
  return defineCrudPage<BusinessValue<T>, F, R, I, E>(() => ({
    ...value.value,
    definition: runtime(value.value.definition),
    collaborateOnRead: true,
    retainEditor: true,
    related: (identity: I) =>
      (value.value.definition.model.form?.fields ?? []).flatMap((key) => {
        const page = value.value.related?.[key]?.(identity);
        return page
          ? [
              {
                key,
                label: propertyAt(value.value.definition.model, key)!.name,
                page,
              },
            ]
          : [];
      }),
  }));
}

export type ModuleEntry = { key: string; label: string; page: PageDefinition };
export type ModuleDefinition<T extends BusinessObject = BusinessObject> = {
  component?: never;
  render?: never;
  template?: never;
  slots?: never;
  layout?: never;
  style?: never;
  class?: never;
  css?: never;
  model: T;
  collections: {
    [K in Extract<keyof T["properties"], string>]: PageDefinition;
  };
  title?: string;
  selected?: string;
  onSelect?: (key: string) => void;
};
/** Module tabs follow the authorized model's ordered collection projection. */
export function defineModulePage<T extends BusinessObject>(
  source: MaybeRefOrGetter<ModuleDefinition<T>>,
): PageDefinition<"module"> {
  return Object.freeze({
    kind: "module" as const,
    get title() {
      const value = toValue(source);
      return value.title ?? value.model.name;
    },
    [snapshotPage]: () => {
      const value = toValue(source);
      const entries = (value.model.form?.fields ?? []).map((key) => {
        const field = propertyAt(value.model, key),
          page = value.collections[key];
        if (field?.kind !== "collection" || !page)
          throw Error(`集合定义不完整：${key}`);
        return { key, label: field.name, page };
      });
      return {
        title: value.title ?? value.model.name,
        render: (context: PageContext) =>
          h(ModulePage, {
            entries,
            selected: value.selected,
            onSelect: value.onSelect,
            scope: context.scope,
            active: context.active,
            embedded: true,
            discard: context.discardVersion,
            onProtection: context.protection,
          }),
      };
    },
  });
}
