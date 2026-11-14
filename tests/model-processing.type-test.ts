// Private legacy engine contract regression; not a public package contract.
import { operation, type ModelOperation } from "../src/model-operation";
import { object, text, decimal, secret } from "../src/reactive-model";
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
  import("../src/model-operation").ModelActionModel<
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

const { batchOperations } = await import("../src/model-batch");
const { collection } = await import("../src/reactive-model");
declare const batchProtocol: import("../src/model-batch").ModelBatchOperation<
  import("../src/model-operation").ModelActionModel<
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

const passwordInput = object("密码", {
  current: secret("当前密码"),
  next: secret("新密码"),
});
declare const passwordProtocol: ModelOperation<
  "changePassword",
  typeof passwordInput,
  {},
  string,
  { digest: string }
>;
object(
  "密码",
  {},
  {
    operations: {
      changePassword: operation(
        "changePassword",
        passwordInput,
        passwordProtocol,
      ),
    },
  },
);
// @ts-expect-error Password changes require the original-request operation protocol.
object(
  "密码",
  {},
  {
    operations: {
      changePassword: { run: async () => ({ status: "success" }) },
    },
  },
);

const fixedAnswers: Readonly<Record<string, string | boolean>> = (
  null as unknown as Parameters<typeof process.prepare>[0]
).answers;
void fixedAnswers;
declare const fixedRequest: Parameters<typeof process.run>[0];
// @ts-expect-error Answers are immutable original-request evidence.
fixedRequest.answers.check = true;
// @ts-expect-error Answer values remain finite business answers.
const invalidAnswer: typeof fixedRequest.answers = { check: 12 };
void invalidAnswer;
