import {
  defineOperation,
  defineTaskPage,
  defineBatchPage,
  type OperationDefinition,
  type OperationIntent,
  type OperationPreview,
  type PrintDocument,
  type DraftCollaboration,
  type WritePersistence,
  type Attempt,
  type TaskPage,
} from "../src/index";
type Model = {
  process: {
    input: { quantity: string };
    preview: OperationPreview;
    evidence: { calculation: string };
  };
  publish: {
    input: { revision: number };
    preview: OperationPreview;
    evidence: { release: number };
  };
};
declare const definition: OperationDefinition<Model, { id: string }, number>;
const process: OperationIntent<Model, { id: string }> = {
  action: "process",
  owner: { scope: "s", operator: "op", resource: "calculation" },
  identity: { id: "one" },
  input: { quantity: "0.0001" },
};
const invalid: OperationIntent<Model, { id: string }> = {
  ...process,
  // @ts-expect-error Input and action are paired, including newly added actions.
  input: { revision: 3 },
};
const command: OperationIntent<Model, { id: string }> = {
  ...process,
  // @ts-expect-error Arbitrary commands are not operation actions.
  action: "run-custom-script",
};
const valid = defineTaskPage<
  { quantity: string },
  Model,
  { id: string },
  number
>({
  title: "计算",
  instance: "one",
  definition,
  owner: process.owner,
  identity: process.identity,
  values: { quantity: "1.00" },
  fields: [{ key: "quantity", label: "数量", type: "decimal" }],
  actions: ["process"],
  toIntent: (value, _action, base) => ({
    ...base,
    action: "process",
    input: value,
  }),
  eligible: true,
  recoveryAllowed: true,
});
const wrongField: TaskPage<
  { quantity: string },
  Model,
  { id: string },
  number
>["fields"] = [
  // @ts-expect-error Decimal input must remain a string, not an integer field.
  { key: "quantity", label: "数量", type: "integer" },
];
const wrongAction: TaskPage<
  { quantity: string },
  Model,
  { id: string },
  number
>["actions"] = [
  // @ts-expect-error No approval alias for a calculation-only model.
  "approve",
];
// @ts-expect-error Layout does not belong to the consumer.
const layout: TaskPage<
  { quantity: string },
  Model,
  { id: string },
  number
>["layout"] = "grid";
const print: PrintDocument = {
  id: "one",
  title: "输出",
  width: 210,
  height: 297,
  pages: [
    {
      key: "page",
      items: [
        {
          key: "one",
          // @ts-expect-error Consumer markup is never an output unit.
          kind: "html",
          html: "<script />",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ],
    },
  ],
};
const collaboration: DraftCollaboration<{ quantity: string }> = {
  change: async ({ value }) => ({ value }),
};
declare const persistence: WritePersistence<
  Attempt<{ quantity: string }, { id: string }>
>;
void [
  defineOperation,
  defineBatchPage,
  valid,
  invalid,
  command,
  wrongField,
  wrongAction,
  layout,
  print,
  collaboration,
  persistence,
];
// Print geometry and typography are finite facts, never consumer CSS.
const badRotation: PrintDocument = {
  id: "rotation",
  title: "输出",
  width: 100,
  height: 100,
  pages: [],
  // @ts-expect-error Only clockwise right angles are supported.
  rotation: 45,
};
const badFont: PrintDocument = {
  id: "font",
  title: "输出",
  width: 100,
  height: 100,
  pages: [
    {
      key: "one",
      items: [
        {
          key: "text",
          kind: "text",
          text: "中文",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          // @ts-expect-error A consumer cannot supply an arbitrary font-family string.
          font: "Arial, sans-serif",
        },
      ],
    },
  ],
};
void [badRotation, badFont];

// Complex drafts keep nested field/value types and collaboration on the public contract.
import { domainBlocks, type Fields } from "../src/index";
type ComplexValues = {
  profile: { count: number; amount: string };
  rows: { ratio: string }[];
};
const complexBlocks = domainBlocks<ComplexValues>();
complexBlocks.fields({
  key: "profile",
  label: "嵌套",
  fields: [
    { key: "count", label: "零数量", type: "integer" },
    { key: "amount", label: "精确金额", type: "decimal" },
  ],
});
complexBlocks.rows({
  key: "rows",
  label: "单位",
  get: (rows) => rows,
  set: (_rows, rows) => [...rows],
  empty: () => ({ ratio: "1.0000" }),
  fields: [{ key: "ratio", label: "换算比", type: "decimal" }],
});
const invalidComplexFields: Fields<ComplexValues["profile"]> = [
  // @ts-expect-error Nested decimal facts remain strings, not integer fields.
  { key: "amount", label: "金额", type: "integer" },
];
const invalidCollaboration: DraftCollaboration<ComplexValues> = {
  // @ts-expect-error Calculation adoption must preserve the full nested draft shape.
  change: async () => ({ value: { profile: { count: 0, amount: "1.0000" } } }),
};
void [invalidComplexFields, invalidCollaboration];
