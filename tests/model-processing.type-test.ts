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
