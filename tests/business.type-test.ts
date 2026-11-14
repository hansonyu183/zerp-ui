import {
  defineBusinessPage,
  type BusinessDefinition,
  type Fields,
  type ReferenceAdapter,
} from "./fixtures/assembly";
import type {
  BusinessInput,
  BusinessValue,
  BusinessType,
} from "../src/business-type";
const model = {
  kind: "object",
  name: "示例",
  properties: {
    id: { kind: "text", name: "编号", readOnly: true },
    enabled: { kind: "boolean", name: "启用" },
    children: { kind: "collection", name: "所属记录" },
  },
  form: { fields: ["enabled", "children"] },
} as const satisfies BusinessType;
const value: BusinessValue<typeof model> = { id: "a", enabled: false };
const input: BusinessInput<typeof model> = { enabled: false };
// @ts-expect-error read-only identity is not a write input
const readonlyInput: BusinessInput<typeof model> = { id: "a" };
// @ts-expect-error independent collections are not part of their parent's write input
const collectionInput: BusinessInput<typeof model> = { children: "x" };
const reference: ReferenceAdapter = { directory: {}, load: async () => [] };
const ids: Fields<{ selected: string }> = [
  {
    key: "selected",
    label: "引用",
    type: "reference",
    valueMode: "id",
    adapter: reference,
  },
];
const badIds: Fields<{ selected: string }> = [
  // @ts-expect-error raw string references require explicit ID value semantics
  { key: "selected", label: "引用", type: "reference", adapter: reference },
];
declare const definition: BusinessDefinition<
  typeof model,
  {},
  { id: string },
  string
>;
defineBusinessPage({
  definition,
  permissions: { query: true, create: true, write: true },
});
// @ts-expect-error identity remains paired with its business adapter
const badIdentity: BusinessDefinition<
  typeof model,
  {},
  { id: string },
  number
> = definition;
void [value, input, readonlyInput, collectionInput, ids, badIds, badIdentity];
