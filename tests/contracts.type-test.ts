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

// Independent validation has the same field/value pairing as runtime fields.
import {
  validateFields,
  type FormValidationState,
  type EditProtection,
} from "../src/index";
const validated = validateFields<Draft>(good, {
  name: "",
  enabled: false,
  amount: "0.0100",
  rows: [],
});
const resultKey: keyof Draft | undefined = validated.issues[0]?.key;
const invalidLength: Fields<{ count: number }> = [
  // @ts-expect-error Text lengths cannot be applied to integer fields.
  { key: "count", type: "integer", label: "数量", maxLength: 2 },
];
validateFields<Draft>(good, {
  name: "",
  enabled: false,
  // @ts-expect-error Exact decimal fields remain strings, not floats.
  amount: 1.01,
  rows: [],
});
const formState: FormValidationState<Draft> = { ...validated, pending: true };
const protection: EditProtection = {
  dirty: false,
  localPending: true,
  invalid: false,
  writeState: "refresh",
};
void [resultKey, invalidLength, formState, protection];
