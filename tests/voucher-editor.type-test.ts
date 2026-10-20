import type { VoucherEditorDefinition } from "../src/index";

type Header = { date: string };
type Child = { amount: string };
type Row = { id: string; name: string; formula: Child[] };
const valid: VoucherEditorDefinition<Header, Row, Child> = {
  headerFields: [{ key: "date", label: "日期", type: "date" }],
  rowFields: [{ key: "name", label: "品名", type: "text" }],
  columns: [
    { key: "name", label: "品名" },
    {
      key: "formula",
      label: "配方",
      type: "children",
      fields: [{ key: "amount", label: "用量", type: "decimal" }],
      empty: () => ({ amount: "" }),
      summary: (children) => `${children.length} 项`,
    },
  ],
  rowKey: (row) => row.id,
  emptyRow: () => ({ id: "new", name: "", formula: [] }),
};
void valid;
const badKey: VoucherEditorDefinition<Header, Row, Child> = {
  ...valid,
  columns: [
    // @ts-expect-error child entry must name a child-array field
    {
      key: "name",
      label: "错误子条目",
      type: "children",
      fields: [{ key: "amount", label: "用量", type: "decimal" }],
      empty: () => ({ amount: "" }),
      summary: () => "",
    },
  ],
};
void badKey;
const badField: VoucherEditorDefinition<Header, Row, Child> = {
  ...valid,
  columns: [
    {
      key: "formula",
      label: "错误配方",
      type: "children",
      fields: [
        // @ts-expect-error decimal string field cannot use boolean editor
        { key: "amount", label: "用量", type: "boolean" },
      ],
      empty: () => ({ amount: "" }),
      summary: () => "",
    },
  ],
};
void badField;
