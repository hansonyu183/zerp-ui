import type {
  ObjectNode,
  Operation,
  OutputNode,
  InteractionNode,
} from "@zerp/ui/model";
declare const object: ObjectNode;
declare const operation: Operation;
const capabilities = {
  ...object,
  workflow: { operations: { start: operation, advance: operation } },
  batch: { operations: { executeBatch: operation } },
  processing: { operations: { validate: operation, run: operation } },
  document: { operations: { submit: operation } },
  output: { operations: { preview: operation } },
  report: { operations: { calculate: operation } },
} satisfies ObjectNode;
// @ts-expect-error Workflow facets cannot accept arbitrary commands.
const commands = {
  ...object,
  workflow: { operations: { arbitrary: operation } },
} satisfies ObjectNode;
// @ts-expect-error CRUD operations cannot silently carry workflow actions.
const wrongLevel = {
  ...object,
  family: "standard",
  operations: { start: operation },
} satisfies ObjectNode;
// @ts-expect-error Ordinary objects cannot provide voucher operations.
const voucherLevel = {
  ...object,
  family: "standard",
  operations: { approve: operation },
} satisfies ObjectNode;
declare const output: OutputNode;
declare const interaction: InteractionNode;
void [capabilities, commands, wrongLevel, voucherLevel, output, interaction];
