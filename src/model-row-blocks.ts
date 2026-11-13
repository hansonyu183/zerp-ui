import { arrayFields, bindArrayChild } from "./model-array-fields";
import { nodeMetadata } from "./model-node";
import type { ModelNode } from "./reactive-model";
import type { ModelRuntime } from "./model-runtime";
import { domainBlocks, type DomainBlock } from "./domain-blocks";
import type { VoucherEditorDefinition } from "./voucher-editor";

type Values = Record<string, unknown>;
/** Project value arrays into the existing row/child draft boundary, using the same nodes. */
export function modelRowBlocks(
  node: ModelNode,
  runtime: ModelRuntime,
): DomainBlock<Values>[] {
  return runtime.fields(node).flatMap((field) => {
    if (field.type !== "rows") return [];
    let array: unknown = node;
    for (const key of JSON.parse(field.key) as string[])
      array = Reflect.get(array as object, key);
    const metadata = (
      array as { [nodeMetadata]: { element: ModelNode; create(): ModelNode } }
    )[nodeMetadata];
    const fields = runtime.fields(metadata.element);
    const columns = fields.map((child) =>
      child.type === "rows"
        ? bindArrayChild(
            {
              key: child.key,
              label: child.label,
              type: "children",
              fields: child.fields,
              empty: child.empty,
              summary: (rows: readonly object[]) => `${rows.length} 项`,
            },
            (parent) => {
              const declared = arrayFields(field, parent).find(
                (f) => f.key === child.key,
              );
              if (declared?.type !== "rows")
                throw Error("子行声明已失效，请重新读取。");
              return declared;
            },
          )
        : { key: child.key, label: child.label },
    );
    const editor = {
      headerFields: [],
      rowFields: (row: Values) =>
        arrayFields(field, row).filter((child) => child.type !== "rows"),
      columns,
      rowKey: (row: Values) => String(row.$modelRowKey),
      emptyRow: () => field.empty(),
    } as unknown as VoucherEditorDefinition<Values, Values, Values>;
    return [
      domainBlocks<Values>().voucher({
        key: field.key,
        label: field.label,
        editor,
        get: (value) => ({
          header: {},
          rows: Array.isArray(value) ? value : [],
        }),
        set: (_value, content) => content.rows,
      }),
    ];
  });
}
