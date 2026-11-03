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

const asynchronous = {
  ...valid,
  emptyRow: async () => ({ id: "async", name: "默认", formula: [] }),
} satisfies VoucherEditorDefinition<Header, Row, Child>;
void asynchronous;
const invalidAsync: VoucherEditorDefinition<Header, Row, Child> = {
  ...valid,
  // @ts-expect-error async defaults must return the same complete row
  emptyRow: async () => ({ id: "missing-fields" }),
};
void invalidAsync;
const transformed: VoucherEditorDefinition<Header, Row, Child> = {
  ...asynchronous,
  transformRow: async ({ value, previous }: { value: Row; previous: Row }) => ({
    ...value,
    name: previous.name,
  }),
  rowOperations: { insert: true, update: false, delete: false },
};
void transformed;
const invalidTransform: VoucherEditorDefinition<Header, Row, Child> = {
  ...valid,
  // @ts-expect-error transformed rows retain the full row contract
  transformRow: async () => ({ id: "incomplete" }),
};
void invalidTransform;
const fullDraft: VoucherEditorDefinition<Header, Row, Child> = {
  headerFields: valid.headerFields,
  rowFields: valid.rowFields,
  columns: valid.columns,
  rowKey: valid.rowKey,
  rowDraft: {
    prepare: async ({ candidate }) => ({
      rowKey: "prepared",
      candidate: {
        ...candidate,
        rows: [
          ...candidate.rows,
          { id: "prepared", name: "新行", formula: [] },
        ],
      },
    }),
    change: async ({ value, previous, candidate }) => ({
      ...candidate,
      rows: candidate.rows.map((row) => (row.id === previous.id ? value : row)),
    }),
  },
};
void fullDraft;
// @ts-expect-error full candidates and simple row-only preparation are separate contracts
const mixedDraft: VoucherEditorDefinition<Header, Row, Child> = {
  ...fullDraft,
  emptyRow: valid.emptyRow,
};
void mixedDraft;
// @ts-expect-error full candidates cannot silently ignore a row-only transformation
const mixedTransform: VoucherEditorDefinition<Header, Row, Child> = {
  ...fullDraft,
  transformRow: ({ value }: { value: Row }) => value,
};
void mixedTransform;
const invalidCandidate: VoucherEditorDefinition<Header, Row, Child> = {
  ...fullDraft,
  rowDraft: {
    // @ts-expect-error a full preparation must return the matching full header and row types
    prepare: async () => ({
      rowKey: "bad",
      candidate: { header: { other: true }, rows: [] },
    }),
  },
};
void invalidCandidate;

const activeFields: VoucherEditorDefinition<Header, Row, Child> = {
  ...valid,
  rowFields: (row) => [
    {
      key: "name",
      label: row.name,
      type: "text",
      readonly: row.id === "locked",
    },
  ],
};
void activeFields;
const invalidActiveFields: VoucherEditorDefinition<Header, Row, Child> = {
  ...valid,
  // @ts-expect-error factory fields must still name fields of the matching row
  rowFields: (row) => [{ key: "absent", label: row.name, type: "text" }],
};
void invalidActiveFields;
