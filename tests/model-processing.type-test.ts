import {
  object,
  text,
  decimal,
  operation,
  type ModelOperation,
} from "../src/model";
const input = object("输入", { amount: decimal("金额") });
type Id = { id: string };
declare const protocol: ModelOperation<
  "process",
  typeof input,
  Id,
  string,
  { digest: string }
>;
const process = operation("process", input, protocol);
object(
  "业务",
  { id: text("身份") },
  { identity: ["id"], operations: { process } },
);
object(
  "错误身份",
  { number: text("编号") },
  {
    identity: ["number"],
    operations: {
      // @ts-expect-error The operation cannot receive another object's identity.
      process,
    },
  },
);
object(
  "错误操作",
  { id: text("编号") },
  {
    identity: ["id"],
    operations: {
      // @ts-expect-error A process protocol cannot be used as a publish protocol.
      publish: process,
    },
  },
);
operation("process", input, {
  ...protocol,
  // @ts-expect-error Evidence remains paired with the exact process receipt.
  run: async (request) => ({
    status: "applied",
    action: request.action,
    owner: request.owner,
    requestId: request.requestId,
    binding: request.binding,
    evidence: { other: 1 },
  }),
});
operation("process", input, {
  ...protocol,
  // @ts-expect-error Unknown commands cannot be registered.
  executeSql: async () => {},
});

// A child operation keeps its exact ancestor identity in preparation and recovery.
declare const childProtocol: ModelOperation<
  "process",
  typeof input,
  Id,
  string,
  { digest: string },
  import("../src/model").ModelActionModel<
    "process",
    typeof input,
    { digest: string }
  >,
  readonly [{ parentId: string }]
>;
const childProcess = operation("process", input, childProtocol);
const child = object(
  "子业务",
  { id: text("编号") },
  { identity: ["id"], operations: { process: childProcess } },
);
object(
  "父业务",
  { parentId: text("父编号"), child },
  {
    identity: ["parentId"],
    operations: {
      update: {
        async run() {
          return { status: "success" };
        },
      },
    },
  },
);
// @ts-expect-error A child operation cannot receive another parent's identity.
object(
  "错误父业务",
  { other: text("其他编号"), child },
  {
    identity: ["other"],
    operations: {
      update: {
        async run() {
          return { status: "success" };
        },
      },
    },
  },
);
childProcess.reconcile({
  ...({} as Parameters<typeof childProcess.reconcile>[0]),
  // @ts-expect-error Persisted ancestors retain the exact parent identity type.
  ancestors: [{ other: "wrong" }],
});

const { batchOperations, collection } = await import("../src/model");
declare const batchProtocol: import("../src/model").ModelBatchOperation<
  import("../src/model").ModelActionModel<
    "process",
    typeof input,
    { digest: string }
  >,
  Id,
  string
>;
const batch = batchOperations(batchProtocol);
collection(
  "合法批次",
  () => object("项目", { id: text("编号") }, { identity: ["id"] }),
  { operations: batch },
);
object(
  "错误批次",
  { id: text("编号") },
  // @ts-expect-error Batch execution belongs to a collection, not an object.
  { identity: ["id"], operations: batch },
);
collection(
  "错误批次身份",
  () => object("项目", { number: text("编号") }, { identity: ["number"] }),
  // @ts-expect-error Batch proposals must use the collection element's identity.
  { operations: batch },
);
