import { modelMetadata as meta, type BusinessModel } from "../src/model";

type Node = BusinessModel[string];
const login: Node = {
  username: { value: "", [meta]: { kind: "text", name: "账号" } },
  password: { value: "", [meta]: { kind: "password", name: "密码" } },
  ledger: {
    value: null,
    [meta]: {
      kind: "reference",
      name: "账套",
      options: [],
      load: { async run() {} },
    },
  },
  [meta]: {
    kind: "object",
    name: "登录",
    family: "authentication",
    operations: { signIn: { async run() {} } },
  },
};
const lines: Node = {
  items: [],
  [meta]: {
    kind: "array",
    name: "明细",
    element: {
      amount: { value: "0", [meta]: { kind: "decimal", name: "金额" } },
      [meta]: { kind: "object", name: "明细行", operations: {} },
    },
    operations: { create: { async run() {} } },
  },
};
const voucher: Node = {
  lines,
  attachments: {
    value: [],
    [meta]: { kind: "attachments", name: "附件", multiple: true },
  },
  [meta]: {
    kind: "object",
    name: "单据",
    family: "voucher",
    operations: {
      calculate: { async run() {} },
      stageAttachments: { async run() {} },
      submit: { async run() {} },
    },
  },
};
const invalid: Node = {
  [meta]: {
    kind: "object",
    name: "登录",
    family: "authentication",
    operations: {
      // @ts-expect-error Authentication cannot execute a batch.
      executeBatch: { async run() {} },
    },
  },
};
void [login, voucher, invalid];
const secretKeep: Node = {
  value: { intent: "keep" },
  [meta]: { kind: "secret", name: "Stored secret" },
};
const secretReplace: Node = {
  value: { intent: "replace", value: "synthetic" },
  [meta]: { kind: "secret", name: "Stored secret" },
};
const secretClear: Node = {
  value: { intent: "clear" },
  [meta]: { kind: "secret", name: "Stored secret" },
};
// @ts-expect-error Stored secrets require explicit intent; a string cannot distinguish keep and clear.
const secretString: Node = {
  value: "",
  [meta]: { kind: "secret", name: "Stored secret" },
};
// @ts-expect-error A replacement intent must contain its new value.
const secretMissing: Node = {
  value: { intent: "replace" },
  [meta]: { kind: "secret", name: "Stored secret" },
};
// @ts-expect-error A keep intent cannot carry a cached secret.
const secretLeak: Node = {
  value: { intent: "keep", value: "cached" },
  [meta]: { kind: "secret", name: "Stored secret" },
};
void [
  secretKeep,
  secretReplace,
  secretClear,
  secretString,
  secretMissing,
  secretLeak,
];
