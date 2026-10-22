import type {
  DetailGroup,
  ReferenceValue,
  VoucherEditorDefinition,
  VoucherEditorValue,
} from "@zerp/ui";
export type Header = { name: string; amount: string };
export type Child = { material: string; amount: string };
export type Row = {
  id: string;
  name: string;
  quantity: string;
  children: Child[];
};
export type Facts = {
  reference: ReferenceValue;
  missing?: string;
  empty: string;
  zero: number;
  enabled: boolean;
  history: { id: string; amount: string }[];
};
export type Related = { kind: "reference"; id: string };
export type RecordValue = {
  voucher: VoucherEditorValue<Header, Row>;
  facts: Facts;
};
export type DetailsAdapter = {
  read(input: { scope: string; id: string }): Promise<RecordValue>;
};
export const adapter: DetailsAdapter = {
  async read({ id }) {
    return {
      voucher: {
        header: { name: `合成资料 ${id}`, amount: "9007199254740993.0100" },
        rows: [
          {
            id: "row-one",
            name: "合成明细甲",
            quantity: "0.0100",
            children: [{ material: "合成原料", amount: "历史异常 1.x" }],
          },
        ],
      },
      facts: {
        reference: {
          id: "adopted-one",
          label: "采用时名称",
          snapshot: { revision: 1 },
        },
        empty: "",
        zero: 0,
        enabled: false,
        history: [{ id: "history-one", amount: "历史金额 ?" }],
      },
    };
  },
};
export const editor: VoucherEditorDefinition<Header, Row, Child> = {
  headerFields: [
    { key: "name", label: "名称", type: "text" },
    { key: "amount", label: "金额", type: "decimal" },
  ],
  rowFields: [
    { key: "name", label: "明细名称", type: "text" },
    { key: "quantity", label: "数量", type: "decimal" },
  ],
  columns: [
    { key: "name", label: "明细名称" },
    { key: "quantity", label: "数量", type: "decimal" },
    {
      key: "children",
      label: "原料",
      type: "children",
      fields: [
        { key: "material", label: "原料名称", type: "text" },
        { key: "amount", label: "原料用量", type: "decimal" },
      ],
      empty: () => ({ material: "", amount: "" }),
      summary: (rows) => `${rows.length} 项`,
    },
  ],
  rowKey: (row) => row.id,
  emptyRow: () => ({
    id: crypto.randomUUID(),
    name: "",
    quantity: "",
    children: [],
  }),
};
export const groups: readonly DetailGroup<Facts, Related>[] = [
  {
    key: "facts",
    label: "采用事实",
    fields: [
      {
        key: "reference",
        label: "历史引用",
        type: "reference",
        related: (value) => ({ kind: "reference", id: value.id }),
      },
      { key: "missing", label: "缺失值", type: "text" },
      { key: "empty", label: "空文本", type: "text" },
      { key: "zero", label: "零值", type: "integer" },
      { key: "enabled", label: "启用", type: "boolean" },
      {
        key: "history",
        label: "历史记录",
        type: "records",
        fields: [{ key: "amount", label: "原始金额", type: "decimal" }],
        rowKey: (row) => row.id,
        rowLabel: (row) => row.id,
      },
    ],
  },
];
