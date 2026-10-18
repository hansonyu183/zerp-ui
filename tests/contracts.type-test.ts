import { defineCrud, type Fields, type CrudAdapter } from "../src/index";
type Draft = {
  name: string;
  enabled: boolean;
  amount: string;
  rows: { quantity: string }[];
};
const good: Fields<Draft> = [
  { key: "amount", type: "decimal", label: "金额" },
  {
    key: "rows",
    type: "rows",
    label: "子项",
    empty: () => ({ quantity: "0" }),
    fields: [{ key: "quantity", type: "decimal", label: "数量" }],
  },
];
const wrongBoolean: Fields<Draft> = [
  // @ts-expect-error Boolean fields cannot be text inputs.
  { key: "enabled", type: "text", label: "启用" },
];
const wrongNested: Fields<Draft> = [
  {
    key: "rows",
    type: "rows",
    label: "子项",
    empty: () => ({ quantity: "0" }),
    fields: [
      // @ts-expect-error Recursive row fields are checked against their own draft.
      { key: "missing", type: "text", label: "错误" },
    ],
  },
];
declare const adapter: CrudAdapter<
  Draft,
  { keyword: string },
  { id: string },
  string
>;
// Compile only: never execute this fixture.
export function inference() {
  return defineCrud({
    resource: "synthetic",
    title: "示例",
    fields: good,
    filters: [{ key: "keyword", type: "text", label: "查找" }],
    columns: [{ key: "id", label: "编号" }],
    initialFilters: () => ({ keyword: "" }),
    identity: (row: { id: string }) => row.id,
    actions: () => [],
    adapter,
  });
}
// @ts-expect-error Draft and adapter types must remain paired.
const wrongAdapter: CrudAdapter<
  { different: number },
  { keyword: string },
  { id: string },
  string
> = adapter;
void wrongBoolean;
void wrongNested;
void wrongAdapter;
