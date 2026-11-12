import { shallowRef } from "vue";
import { modelReportBinding } from "./model-report-binding";
import { modelOperation } from "./model-operation";
import { defineReportPage, type PageDefinition } from "./pages";
import type {
  ReportDefinition,
  ReportPage,
  ReportSummary,
  ReportAppearance,
  ReportResultRequest,
} from "./report";
import type { ModelQuery } from "./model-query";
import type {
  ModelNode,
  ObjectShape,
  ApplicationNode,
  ModelOwner,
} from "./reactive-model";
import { nodeMetadata } from "./model-node";
import type { ModelRuntime, RuntimeObject } from "./model-runtime";
import { clone } from "./clone";

type Values = Record<string, unknown>;
type Query = ModelQuery<ObjectShape, ObjectShape>;
type QueryCollection = ModelNode & {
  items: RuntimeObject[];
  [nodeMetadata]: {
    element(): RuntimeObject;
    operations: {
      query?: Query;
      export?: {
        disabledReason?: string;
        run(
          context: unknown,
        ): Promise<void | { content: Blob; filename: string }>;
      };
    };
  };
};
export function modelQueryPage(
  source: () => ModelNode | undefined,
  application: () => ApplicationNode,
  runtime: ModelRuntime,
  path: readonly string[],
  ancestors: readonly unknown[],
): PageDefinition {
  const first = source() as QueryCollection;
  const sample = first[nodeMetadata].element();
  const current = () => source() as QueryCollection | undefined;
  const query = () => current()?.[nodeMetadata].operations.query;
  const owner = () => application()[nodeMetadata].options.owner;
  const resource = JSON.stringify([path, ancestors]);
  const fields = () =>
    runtime
      .fields(sample)
      .filter((field) => field.type !== "secret" && field.type !== "rows");
  const rowKey = (row: RuntimeObject) =>
    JSON.stringify(
      Object.fromEntries(
        row[nodeMetadata].identity.map((key) => [
          key,
          (row as unknown as Record<string, { value: unknown }>)[key]?.value,
        ]),
      ),
    );
  function result(
    page: ReportPage<RuntimeObject, string>,
  ): ReportPage<Values, string> {
    const keys = page.items.map(rowKey);
    targets.clear();
    epoch++;
    if (new Set(keys).size !== keys.length) throw Error("集合记录身份重复。");
    return {
      ...page,
      items: page.items.map((row) => ({
        ...runtime.flat(row),
        $key: rowKey(row),
      })),
      presentation: page.presentation && {
        ...page.presentation,
        groups: page.presentation.groups.map((group) => ({
          ...group,
          summary: summary(group.summary),
        })),
        rows: page.presentation.rows.map((row) => ({
          ...row,
          cells:
            row.cells &&
            Object.fromEntries(
              Object.entries(row.cells).map(([key, value]) => [
                JSON.stringify([key]),
                value as ReportAppearance,
              ]),
            ),
        })),
      },
    };
  }
  function summary(value: ReportSummary<unknown>): ReportSummary<Values> {
    return {
      caption: value.caption,
      values: Object.fromEntries(
        Object.entries(value.values as object).map(([key, value]) => [
          JSON.stringify([key]),
          value,
        ]),
      ),
    };
  }
  async function read<T>(
    work: (q: Query) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const q = query(),
      node = current(),
      admittedOwner = JSON.stringify(owner());
    if (!q || q.disabledReason || !owner())
      throw Error(q?.disabledReason ?? "查询已撤销。");
    const result = await work(q);
    if (
      q !== query() ||
      node !== current() ||
      q.disabledReason ||
      signal?.aborted ||
      JSON.stringify(owner()) !== admittedOwner
    )
      throw Error("读取已失效。");
    return result;
  }
  let applied: Values = {};
  let epoch = 0;
  const targets = new Map<
    string,
    { node: ModelNode; identity?: unknown; page?: PageDefinition<"task"> }
  >();
  const related = shallowRef<PageDefinition<"task">>();
  const definition: Extract<
    ReportDefinition<Values, Values, string, string, string>,
    { kind: "fixed" }
  > = {
    kind: "fixed",
    [modelReportBinding]: {
      get collaboration() {
        return query()?.input
          ? runtime.resolve(
              () => query()?.input,
              [...path, "$query"],
              ancestors,
            ).definition.collaboration
          : undefined;
      },
      row: (row) => {
        const node = current()?.items.find((node) => rowKey(node) === row.$key);
        return node ? { ...runtime.flat(node), $key: row.$key } : undefined;
      },
    },
    resource,
    get title() {
      return current()?.[nodeMetadata].name ?? first[nodeMetadata].name;
    },
    get parameters() {
      return (query()?.input
        ? runtime.fields(query()!.input!)
        : []) as unknown as typeof definition.parameters;
    },
    initialParameters: () =>
      query()?.input ? runtime.flat(query()!.input!) : {},
    get columns() {
      return fields().map((field) => ({
        key: field.key,
        label: field.label,
        type: ["decimal", "integer", "date", "boolean"].includes(field.type)
          ? field.type
          : "text",
      })) as unknown as typeof definition.columns;
    },
    rowKey: (row) => row.$key as string,
    adapter: {
      query: async (context) => {
        const response = await read(
          (q) =>
            q.run({
              owner: clone(owner() as ModelOwner),
              identity: null,
              ancestors: clone(ancestors),
              signal: context.signal,
              input: (q.input
                ? runtime.unflat(q.input, context.parameters, false)
                : {}) as never,
              page: context.page,
              pageSize: context.pageSize,
              requestId: context.requestId,
            }),
          context.signal,
        );
        applied = clone(context.parameters);
        current()!.items = response.items as RuntimeObject[];
        return {
          ...result(response as unknown as ReportPage<RuntimeObject, string>),
          id: response.id,
          summary: summary(response.summary),
          context: response.context,
        };
      },
      page: async (context) => {
        const response = await read((q) => q.page(context), context.signal);
        current()!.items = response.items as RuntimeObject[];
        return result(response as unknown as ReportPage<RuntimeObject, string>);
      },
      revalidate: (context) =>
        read((q) => q.revalidate(context), context.signal),
      get cancel() {
        return query()?.cancel
          ? (context: { scope: string; requestId: string }) =>
              read((q) => q.cancel!(context))
          : undefined;
      },
      get export() {
        return current()?.[nodeMetadata].operations.export
          ? async (context: ReportResultRequest<string>) => {
              const op = current()![nodeMetadata].operations.export!,
                admittedOwner = JSON.stringify(owner());
              if (op.disabledReason) throw Error(op.disabledReason);
              const value = await op.run({
                ...context,
                owner: clone(owner()),
                identity: null,
                ancestors: clone(ancestors),
                input: query()?.input
                  ? runtime.unflat(query()!.input!, applied, false)
                  : {},
                page: 1,
                pageSize: 20,
              });
              if (
                !value ||
                admittedOwner !== JSON.stringify(owner()) ||
                op !== current()?.[nodeMetadata].operations.export ||
                op.disabledReason
              )
                throw Error("导出已失效。");
              return value;
            }
          : undefined;
      },
    },
    cell: (row, key) => {
      const field = JSON.parse(key) as string[];
      const node = current()?.items.find((node) => rowKey(node) === row.$key);
      const target =
        field.length === 1 && node
          ? query()?.drill?.(node as ObjectShape, field[0])
          : undefined;
      if (
        !target &&
        node &&
        Object.values(node[nodeMetadata].operations).some(
          (op) => op && modelOperation in op,
        )
      ) {
        const token = `${epoch}:${String(row.$key)}:operation`;
        targets.set(token, {
          node,
          page: runtime.resolve(
            () => current()?.items.find((node) => rowKey(node) === row.$key),
            [...path, "$operations", String(row.$key)],
            ancestors,
          ).page as PageDefinition<"task">,
        });
        return { kind: "detail", target: token, label: "业务办理" };
      }
      const token = `${epoch}:${String(row.$key)}:${key}`;
      if (target) targets.set(token, target);
      return target
        ? {
            kind: "record",
            target: token,
            label: "打开业务",
            href: application()[nodeMetadata].options.navigation.href(
              target.node,
              target.identity,
            ),
          }
        : undefined;
    },
  };
  return defineReportPage(() => ({
    definition,
    onParameters: (value) => {
      if (query()?.input)
        runtime.adopt(
          query()!.input!,
          runtime.unflat(query()!.input!, value, false),
        );
    },
    related: related.value
      ? {
          page: related.value,
          onClose: () => {
            related.value = undefined;
          },
        }
      : undefined,
    permissions: {
      query: !!query() && !query()?.disabledReason && !!owner(),
      export:
        !!current()?.[nodeMetadata].operations.export &&
        !current()?.[nodeMetadata].operations.export?.disabledReason,
    },
    onDrill: (drill) => {
      const target = targets.get(drill.cell.target);
      if (target?.page) related.value = target.page;
      else if (target)
        application()[nodeMetadata].options.navigation.visit(
          target.node,
          target.identity,
        );
    },
  }));
}
