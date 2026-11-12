import {
  defineCrud,
  defineCrudPage,
  domainBlocks,
  type DraftCollaboration,
  type ReferenceAdapter,
  type ReferenceValue,
  type VoucherEditorValue,
} from "../assembly";

export type Part = { ingredient: string; ratio: string };
export type ComplexDraft = {
  name: string;
  amount: string;
  zero: number;
  enabled: boolean;
  note: string | null;
  profile: {
    region: ReferenceValue | null;
    warehouse: ReferenceValue | null;
    extra: boolean;
    reason: string;
  };
  units: { code: string; ratio: string; count: number }[];
  prices: { tier: string; amount: string }[];
  sheet: VoucherEditorValue<
    { memo: string },
    { id: string; name: string; quantity: string; parts: Part[] }
  >;
  calculation: {
    basis: string;
    result: string;
    confirmation: boolean;
    answer: string;
  };
};
const copy = <T>(value: T): T => structuredClone(value);
const regions = [
  { id: "north", label: "合成北区" },
  { id: "south", label: "合成南区" },
];
export function complexValues(): ComplexDraft {
  return {
    name: "合成复杂资料",
    amount: "9007199254740993.0100",
    zero: 0,
    enabled: false,
    note: null,
    profile: {
      region: copy(regions[0]),
      warehouse: {
        id: "old-warehouse",
        label: "历史仓库",
        snapshot: { revision: "r1" },
      },
      extra: false,
      reason: "",
    },
    units: [
      { code: "each", ratio: "1.0000", count: 0 },
      { code: "box", ratio: "12.0000", count: 1 },
    ],
    prices: [{ tier: "标准", amount: "1.2300" }],
    sheet: {
      header: { memo: "合成配方" },
      rows: [
        {
          id: "first",
          name: "合成甲品",
          quantity: "0.0100",
          parts: [{ ingredient: "原配料", ratio: "1.0000" }],
        },
        { id: "second", name: "合成乙品", quantity: "2.0000", parts: [] },
      ],
    },
    calculation: { basis: "", result: "", confirmation: false, answer: "" },
  };
}
const regionCatalog: ReferenceAdapter = {
  search: async () => ({ items: copy(regions), total: 2 }),
  resolve: async ({ ids }) => copy(regions.filter((r) => ids.includes(r.id))),
};
const warehouseCatalog: ReferenceAdapter = {
  search: async ({ parent }) => ({
    items: parent
      ? [
          {
            id: `${parent.id}-warehouse`,
            label: `${parent.label}仓库`,
            snapshot: { revision: "r2", region: parent.id },
          },
        ]
      : [],
    hasMore: false,
  }),
  resolve: async ({ ids }) =>
    ids.map((id) => ({
      id,
      label: "目录新仓库名",
      snapshot: { revision: "r2" },
    })),
};
/** Synthetic calculation is exact decimal addition, owned by the consumer. */
function sum(values: readonly string[]) {
  const scale = Math.max(
    0,
    ...values.map((value) => value.split(".")[1]?.length ?? 0),
  );
  const total = values
    .reduce((result, value) => {
      const [whole, fraction = ""] = value.split(".");
      return result + BigInt(whole + fraction.padEnd(scale, "0"));
    }, 0n)
    .toString()
    .padStart(scale + 1, "0");
  return scale ? `${total.slice(0, -scale)}.${total.slice(-scale)}` : total;
}
export const complexCollaboration: DraftCollaboration<ComplexDraft, unknown> = {
  change: async ({ value, answers }) => {
    // The sample's supported calculation domain is nonnegative complete decimals.
    const amounts = value.prices.map((row) => row.amount);
    if (amounts.some((amount) => !/^\d+(\.\d+)?$/.test(amount)))
      throw Error("合成计算需要非负完整价格。");
    value.calculation = {
      basis: JSON.stringify({
        units: value.units,
        prices: value.prices,
        rows: value.sheet.rows,
      }),
      result: sum(amounts),
      confirmation: answers.checked === true,
      answer: typeof answers.reason === "string" ? answers.reason : "",
    };
    return {
      value,
      interactions: [
        {
          kind: "confirm",
          id: "checked",
          label: "核对计算结果",
          required: true,
        },
        { kind: "input", id: "reason", label: "计算说明", required: true },
        {
          kind: "grid",
          id: "result",
          label: "已采用计算",
          columns: [{ key: "amount", label: "合成价格合计" }],
          rows: [{ key: "one", values: { amount: value.calculation.result } }],
        },
      ],
    };
  },
};
export function createComplexDraft(
  options: {
    save?: (value: ComplexDraft) => Promise<void>;
    collaboration?: DraftCollaboration<ComplexDraft, unknown>;
    warehouse?: ReferenceAdapter;
  } = {},
) {
  let stored = complexValues();
  const definition = defineCrud<
    ComplexDraft,
    {},
    { id: string; name: string },
    string
  >({
    resource: "synthetic-complex",
    title: "复杂资料协作",
    fields: [
      { key: "name", label: "资料名称", type: "text", required: true },
      { key: "amount", label: "精确金额", type: "decimal" },
      { key: "zero", label: "零数量", type: "integer" },
      { key: "enabled", label: "启用", type: "boolean" },
      { key: "note", label: "空备注", type: "text" },
    ],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "资料名称" }],
    identity: (row) => row.id,
    actions: () => ["view", "edit"],
    collaboration: options.collaboration ?? complexCollaboration,
    adapter: {
      query: async () => ({
        items: [{ id: "one", name: stored.name }],
        total: 1,
      }),
      get: async () => ({ identity: "one", values: copy(stored) }),
      empty: complexValues,
      create: async () => ({ status: "failure", message: "仅演示修改。" }),
      save: async (attempt) => {
        const value = copy(attempt.input!);
        // A real server revalidates all values and authorization independently.
        if (!value.calculation.confirmation || !value.calculation.answer.trim())
          return { status: "failure", message: "缺少计算核对事实。" };
        await options.save?.(copy(value));
        stored = value;
        return { status: "success" };
      },
    },
  });
  const blocks = domainBlocks<ComplexDraft>();
  const page = defineCrudPage({
    definition,
    permissions: { query: true, create: false, write: true },
    initialRow: { id: "one", name: stored.name },
    readOnly: false,
    blocks: [
      blocks.fields({
        key: "profile",
        label: "嵌套资料",
        fields: [
          {
            key: "region",
            label: "地区",
            type: "reference",
            adapter: regionCatalog,
          },
          {
            key: "warehouse",
            label: "仓库",
            type: "reference",
            adapter: options.warehouse ?? warehouseCatalog,
            parentKey: "region",
          },
          { key: "extra", label: "补充说明", type: "boolean" },
          {
            key: "reason",
            label: "地区说明",
            type: "text",
            when: { key: "extra", equals: true },
          },
        ],
      }),
      blocks.rows({
        key: "units",
        label: "单位",
        fields: [
          { key: "code", label: "单位代码", type: "text", required: true },
          { key: "ratio", label: "换算比", type: "decimal", required: true },
          { key: "count", label: "单位数量", type: "integer" },
        ],
        empty: () => ({ code: "", ratio: "1.0000", count: 0 }),
        get: (rows) => rows,
        set: (_rows, rows) => [...rows],
      }),
      blocks.rows({
        key: "prices",
        label: "价格",
        fields: [
          { key: "tier", label: "价格类别", type: "text", required: true },
          { key: "amount", label: "价格金额", type: "decimal", required: true },
        ],
        empty: () => ({ tier: "", amount: "0.0000" }),
        get: (rows) => rows,
        set: (_rows, rows) => [...rows],
      }),
      blocks.voucher({
        key: "sheet",
        label: "配方明细",
        get: (value) => value,
        set: (_value, content) => content,
        editor: {
          headerFields: [{ key: "memo", label: "配方说明", type: "text" }],
          rowFields: [
            { key: "id", label: "明细代码", type: "text", required: true },
            { key: "name", label: "品名", type: "text", required: true },
            { key: "quantity", label: "配方数量", type: "decimal" },
          ],
          rowKey: (row) => row.id,
          emptyRow: () => ({
            id: crypto.randomUUID(),
            name: "",
            quantity: "0.0000",
            parts: [] as Part[],
          }),
          columns: [
            { key: "name", label: "品名" },
            { key: "quantity", label: "配方数量", type: "decimal" },
            {
              key: "parts",
              label: "配料",
              type: "children",
              fields: [
                {
                  key: "ingredient",
                  label: "配料名",
                  type: "text",
                  required: true,
                },
                {
                  key: "ratio",
                  label: "配料比例",
                  type: "decimal",
                  required: true,
                },
              ],
              empty: () => ({ ingredient: "", ratio: "1.0000" }),
              summary: (rows: readonly Part[]) => `${rows.length} 项`,
            },
          ],
        },
      }),
      blocks.fields({
        key: "calculation",
        label: "计算事实",
        fields: [
          { key: "result", label: "合计结果", type: "decimal", readonly: true },
          {
            key: "confirmation",
            label: "已核对",
            type: "boolean",
            readonly: true,
          },
          { key: "answer", label: "已采用说明", type: "text", readonly: true },
        ],
      }),
    ],
  });
  return { page };
}
