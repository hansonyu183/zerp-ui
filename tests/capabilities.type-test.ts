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
