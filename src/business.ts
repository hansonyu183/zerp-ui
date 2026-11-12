import { computed, h, toValue, type MaybeRefOrGetter } from "vue";
import type { BusinessType, BusinessValue, BusinessObject } from "./model";
import { formSections, propertyAt, setValueAt, valueAt } from "./model";
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
  defineAccountPage,
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

export function projectBusinessFields(
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
      return projectBusinessFields(
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
            fields: projectBusinessFields(node.element, reference),
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
      projectBusinessFields(
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
      projectBusinessColumns<R>(current.model).map((column) => ({
        ...column,
        key: (current.rowValue ? current.rowValue + "." : "") + column.key,
      })),
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

/** Project a standalone account form without creating a business collection. */
export function defineBusinessAccountPage<T extends BusinessObject>(
  model: MaybeRefOrGetter<T>,
  source: PageSource<
    Omit<
      import("./pages").AccountPage<BusinessValue<NoInfer<T>>>,
      "fields" | "title"
    > & {
      interactions?: Readonly<Record<string, Pick<AnyField, "when" | "mode">>>;
    }
  >,
): PageDefinition {
  return defineAccountPage(() => {
    const value = toValue(source);
    const fields = projectBusinessFields(toValue(model), undefined).map(
      (field) => ({
        ...field,
        ...(field.type === "secret" ? { type: "password" as const } : {}),
        ...value.interactions?.[field.key],
      }),
    ) as unknown as Fields<BusinessValue<T>>;
    return { ...value, title: toValue(model).name, fields };
  });
}

/** List columns share the exact same field names, enum choices and order. */
export function projectBusinessColumns<R extends object>(
  model: BusinessType,
): Column<R>[] {
  return (model.list?.fields ?? []).map((key) => {
    const field = propertyAt(model, key);
    if (!field) throw Error(`未定义列表字段：${key}`);
    return {
      key,
      label: field.name,
      ...(["boolean", "integer", "decimal"].includes(field.kind)
        ? { type: field.kind }
        : {}),
      ...(field.kind === "enum"
        ? {
            type: "enum" as const,
            options: (field.options ?? []).map((o) => ({
              value: o.id,
              label: o.name,
            })),
          }
        : {}),
    };
  }) as Column<R>[];
}

/** Native voucher semantics and row identity remain in the consumer. */
export type BusinessVoucherInteraction = {
  when?: AnyField["when"];
  initial?: object;
  children?: Readonly<Record<string, BusinessVoucherInteraction>>;
};
export function projectBusinessVoucherEditor<
  H extends object,
  R extends object,
  C extends object = object,
>(
  model: BusinessObject,
  options: {
    rowKey: (row: R) => string;
    emptyRow: () => R;
    reference?: BusinessDefinition<
      BusinessObject,
      object,
      object,
      unknown
    >["reference"];
    interactions?: {
      header?: Readonly<Record<string, BusinessVoucherInteraction>>;
      rows?: Readonly<Record<string, BusinessVoucherInteraction>>;
    };
  },
): Pick<
  import("./voucher-editor").VoucherEditorDefinition<H, R, C>,
  "headerFields" | "rowFields" | "columns" | "rowKey"
> & { emptyRow: () => R } {
  const header = model.properties.header;
  const rows = model.properties.rows;
  if (
    header?.kind !== "object" ||
    rows?.kind !== "array" ||
    rows.element?.kind !== "object"
  )
    throw Error("单据模型必须定义表头和明细。");
  function fields(
    node: BusinessType,
    interactions: Readonly<Record<string, BusinessVoucherInteraction>> = {},
  ): AnyField[] {
    return projectBusinessFields(node, options.reference).map((field) => {
      const interaction = interactions[field.key];
      if (!interaction) return field;
      return {
        ...field,
        ...(interaction.when ? { when: interaction.when } : {}),
        ...(field.type === "rows" && interaction.initial
          ? {
              empty: () => structuredClone(interaction.initial!),
              fields: fields(
                propertyAt(node, field.key)!.element!,
                interaction.children,
              ),
            }
          : {}),
      };
    });
  }
  return {
    headerFields: fields(
      header,
      options.interactions?.header,
    ) as unknown as Fields<H>,
    rowFields: fields(
      rows.element,
      options.interactions?.rows,
    ) as unknown as Fields<R>,
    columns: projectBusinessColumns<R>(rows.element),
    rowKey: options.rowKey,
    emptyRow: options.emptyRow,
  };
}

/** Project the immutable item identity before the existing batch runtime owns it. */
export function projectBusinessBatchEntries<
  T extends BusinessObject,
  Intent extends {
    owner: import("./operation").OperationOwner;
    action: import("./operation").OperationAction;
    identity: unknown;
    input: unknown;
  },
>(
  model: T,
  entries: readonly { key: string; value: BusinessValue<T>; intent: Intent }[],
): { key: string; label: string; intent: Intent }[] {
  const paths = model.list?.fields;
  if (!paths?.length) throw Error("批量办理项必须声明身份显示字段。");
  for (const path of paths)
    if (!propertyAt(model, path)) throw Error(`未定义字段：${path}`);
  return entries.map((entry) => ({
    key: entry.key,
    intent: entry.intent,
    label: paths
      .map((path) => {
        const value = valueAt(entry.value, path);
        return value === null || value === undefined ? "" : String(value);
      })
      .join(" · "),
  }));
}
