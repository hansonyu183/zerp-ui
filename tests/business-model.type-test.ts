// These checks also compile from a physically independent installed tarball.
import type {
  BusinessModel,
  Collection,
  ObjectNode,
  Operation,
  RecordsNode,
  FieldNode,
} from "@zerp/ui/model";
// @ts-expect-error Symbol metadata is no longer a public protocol.
import { modelMetadata } from "@zerp/ui/model";
declare const model: BusinessModel;
declare const collection: Collection;
declare const object: ObjectNode;
declare const records: RecordsNode;
const operation: Operation = { disabled: false, async run() {} };
// @ts-expect-error disabled is required.
const missingDisabled: Operation = { async run() {} };
// @ts-expect-error Old disabledReason has no compatibility path.
const oldOperation = {
  ...operation,
  disabledReason: "old",
} satisfies Operation;
// @ts-expect-error Global navigation accepts root collections only.
model.navigation.current = object;
// @ts-expect-error Root members cannot be objects.
model.members.object = object;
// @ts-expect-error Owned records cannot submit independently.
const recordsSave = {
  ...records,
  operations: { update: operation },
} satisfies RecordsNode;
// @ts-expect-error Object members are an ordered array.
const unordered = { ...object, members: { name: object } } satisfies ObjectNode;
// @ts-expect-error Collections are not object child nodes.
const childCollection = {
  ...object,
  members: [collection],
} satisfies ObjectNode;
// @ts-expect-error element templates no longer exist.
const oldElement = { ...collection, element: object } satisfies Collection;
// @ts-expect-error form projections no longer exist.
const oldForm = { ...object, form: [] } satisfies ObjectNode;
// @ts-expect-error Explicit columns require labels, even with no rows.
const missingColumnLabel = {
  ...collection,
  columns: [{ key: "name" }],
} satisfies Collection;
// @ts-expect-error Single reference values cannot be arrays.
const badReference = {
  kind: "reference",
  key: "r",
  label: "引用",
  required: false,
  readOnly: false,
  multiple: false,
  options: [],
  value: [],
} satisfies FieldNode;
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
