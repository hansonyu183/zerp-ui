// These checks also compile from a physically independent installed tarball.
import type {
  BusinessModel,
  Collection,
  ObjectNode,
  Operation,
  RecordsNode,
  FieldNode,
  PrintElement,
} from "@zerp/ui/model";
// prettier-ignore
// @ts-expect-error Symbol metadata is no longer a public protocol.
import { modelMetadata } from "@zerp/ui/model";
declare const model: BusinessModel;
declare const collection: Collection;
declare const object: ObjectNode;
declare const records: RecordsNode;
const operation: Operation = { disabled: false, async run() {} };
// prettier-ignore
// @ts-expect-error disabled is required.
const missingDisabled: Operation = { async run() {} };
// prettier-ignore
// @ts-expect-error Old disabledReason has no compatibility path.
const oldOperation = { ...operation, disabledReason: "old", } satisfies Operation;
// prettier-ignore
// @ts-expect-error Global navigation accepts root collections only.
model.work.navigation.current = object;
// prettier-ignore
// @ts-expect-error Root members cannot be objects.
model.work.members.push(object);
// @ts-expect-error Navigation belongs to the workspace model.
void model.navigation;
// @ts-expect-error Workbench belongs to the workspace model.
void model.workbench;
// @ts-expect-error Account belongs to the workspace model.
void model.account;
// @ts-expect-error Business members belong to the workspace model.
void model.members;
// prettier-ignore
// @ts-expect-error Owned records cannot submit independently.
const recordsSave = { ...records, operations: { update: operation }, } satisfies RecordsNode;
// prettier-ignore
// @ts-expect-error Object members are an ordered array.
const unordered = { ...object, members: { name: object } } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error Collections are not object child nodes.
const childCollection = { ...object, members: [collection], } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error element templates no longer exist.
const oldElement = { ...collection, element: object } satisfies Collection;
// prettier-ignore
// @ts-expect-error form projections no longer exist.
const oldForm = { ...object, form: [] } satisfies ObjectNode;
// prettier-ignore
// @ts-expect-error Explicit columns require labels, even with no rows.
const missingColumnLabel = { ...collection, columns: [{ key: "name" }], } satisfies Collection;
// prettier-ignore
// @ts-expect-error Single reference values cannot be arrays.
const badReference = { kind: "reference", key: "r", label: "引用", required: false, readOnly: false, multiple: false, options: [], value: [], } satisfies FieldNode;
void [
  modelMetadata,
  missingDisabled,
  oldOperation,
  recordsSave,
  unordered,
  childCollection,
  oldElement,
  oldForm,
  missingColumnLabel,
  badReference,
];

const pageNumber = {
  kind: "pageNumber",
  key: "page",
  x: 0,
  y: 0,
  width: 100,
  height: 8,
  font: "cjk-sans",
  align: "center",
} satisfies PrintElement;
// prettier-ignore
// @ts-expect-error Finite page numbering does not accept expressions.
const expressionPage = { ...pageNumber, expression: "page + 1" } satisfies PrintElement;
// prettier-ignore
// @ts-expect-error Templates do not accept raw HTML.
const htmlPage = { kind: "html", key: "html", x: 0, y: 0, width: 100, height: 8, html: "<b>unsafe</b>" } satisfies PrintElement;
void [pageNumber, expressionPage, htmlPage];
