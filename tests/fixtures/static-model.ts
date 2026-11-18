import { reactive } from "vue";
import { vi } from "vitest";
import type {
  BusinessModel,
  BusinessNode,
  Collection,
  DomainGroup,
  FieldNode,
  ObjectNode,
  Operation,
} from "../../src/model";
export const operation = (run = vi.fn(async () => {})): Operation =>
  reactive({ disabled: false, run });
export const field = (
  key = "name",
  label: string | null = "名称",
  value = "initial",
) =>
  reactive({
    kind: "text" as const,
    key,
    label,
    value,
    readOnly: false,
    required: false,
  });
export const object = (
  key: string,
  label: string,
  members: BusinessNode[] = [],
): ObjectNode =>
  reactive({
    kind: "object",
    printable: false,
    family: "standard",
    key,
    label,
    identity: key,
    readOnly: false,
    members,
    operations: {},
  });
export function domainOf(
  collection: Collection,
  label = collection.label,
): DomainGroup {
  return {
    kind: "domain",
    key: collection.key,
    label,
    members: [collection],
  };
}
export function fixture() {
  const name = field();
  const record = object("r1", "记录", [name]);
  record.operations.update = operation();
  const term = field("term", "条件", "");
  const rows: Collection = reactive({
    key: "rows",
    label: "记录集合",
    columns: [{ key: "name", label: "名称" }],
    conditions: object("conditions", "查询条件", [term]),
    items: [record],
    selected: null,
    draft: null,
    page: 1,
    pageSize: 20,
    total: 1,
    operations: { query: operation(), create: operation() },
  });
  const owner = { ledger: "test", operator: "test", generation: "1" };
  const model: BusinessModel = reactive({
    kind: "application",
    label: "公开模型测试",
    brand: { productName: "Test", companyName: "Synthetic" },
    members: [domainOf(rows)],
    authentication: {
      form: object("login", "登录", [field("username", "登录名", "")]),
      operations: { signIn: operation(), recover: operation() },
    },
    account: {
      label: "Tester",
      profile: object("profile", "个人资料", [
        field("displayName", "姓名", "Tester"),
      ]),
      password: object("password", "密码", []),
      operations: { changePassword: operation(), signOut: operation() },
    },
    session: {
      state: "ready",
      owner,
      userPermissions: { owner, administrator: true },
    },
    navigation: {
      current: rows,
      href(collection) {
        return collection ? `/${collection.key}` : "/";
      },
      visit(collection) {
        model.navigation.current = collection;
      },
    },
    messages: [],
  });
  return {
    model,
    rows,
    record,
    name,
    term,
    owner,
  };
}
export function asField(node: BusinessNode): FieldNode {
  if ("value" in node && node.kind !== "interactions" && node.kind !== "output")
    return node;
  throw Error("Expected field");
}
