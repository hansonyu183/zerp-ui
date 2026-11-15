import { reactive, ref } from "vue";
import type {
  BusinessModel,
  Collection,
  FieldNode,
  ObjectNode,
  Operation,
  Owner,
  PrintTemplate,
  RecordsNode,
} from "@zerp/ui/model";
import { router } from "./router";
import {
  bindFamilyQueries,
  clearFamilyInputs,
  familyCollections,
  reports,
} from "./families";

export const trace = (name: string) => console.log(`synthetic-call:${name}`);
const operation = (run: () => Promise<void>): Operation => ({
  disabled: false,
  run,
});
const text = (
  key: string,
  label: string | null,
  value = "",
  readOnly = false,
): FieldNode & { kind: "text" | "longText" | "password" } =>
  reactive({
    kind: "text",
    key,
    label,
    value,
    required: false,
    readOnly,
  });
const object = (
  key: string,
  label: string,
  members: ObjectNode["members"],
): ObjectNode =>
  reactive({
    kind: "object",
    printable: false,
    family: "standard",
    key,
    label,
    identity: null,
    readOnly: false,
    members,
    operations: {},
  });
const loginName = text("username", "登录名");
const loginPassword: FieldNode = reactive({
  kind: "password",
  key: "password",
  label: "登录密码",
  value: "",
  required: true,
  readOnly: false,
});
const filter = text("keyword", "关键词");
const name = text("name", "客户名称", "合成客户甲");
const credit: FieldNode = reactive({
  kind: "decimal",
  key: "credit",
  label: "额度",
  value: "12345678901234567890.125",
  required: false,
  readOnly: false,
  format: { maximumFractionDigits: 2, useGrouping: true, locale: "en-US" },
});
const category: Extract<FieldNode, { kind: "reference" }> = reactive({
  kind: "reference",
  key: "category",
  label: "客户分类",
  required: false,
  readOnly: false,
  multiple: false,
  value: { id: "retired", label: "历史分类" },
  options: [],
  load: operation(async () => {
    trace("catalog.load");
    category.options = Array.from({ length: 45 }, (_, i) => ({
      id: String(i + 1),
      label: `分类${i + 1}`,
      selectable: true,
    }));
  }),
});
const groups: Extract<FieldNode, { kind: "treeReference" }> = reactive({
  kind: "treeReference",
  key: "groups",
  label: "客户分组",
  required: false,
  readOnly: false,
  multiple: true,
  value: [],
  options: [
    {
      id: "root",
      label: "全部分组",
      selectable: false,
      children: [
        { id: "north", label: "华北", selectable: true, children: [] },
        { id: "south", label: "华南", selectable: true, children: [] },
      ],
    },
  ],
});
// A finite synthetic failure/retry case exercised through the installed public UI.
function feedbackReference(
  key: string,
  label: string,
): Extract<FieldNode, { kind: "reference" }> {
  let attempt = 0;
  const field: Extract<FieldNode, { kind: "reference" }> = reactive({
    kind: "reference",
    key,
    label,
    readOnly: false,
    required: false,
    multiple: false,
    value: null,
    options: [],
    load: operation(async () => {
      const owner = JSON.stringify(model.session.owner);
      await Promise.resolve();
      if (
        model.session.state !== "ready" ||
        JSON.stringify(model.session.owner) !== owner
      )
        return;
      if (++attempt === 1)
        throw Error(
          "目录读取失败：" +
            "合成目录暂不可用，请重试以重新读取候选；这是一条用于检验有限滚动区域的合成长消息。\n".repeat(
              50,
            ),
        );
      field.options = [
        { id: "ready", label: "重试后的候选", selectable: true },
      ];
    }),
  });
  return field;
}
const lines: RecordsNode = reactive({
  kind: "records",
  key: "contacts",
  label: "联系人",
  readOnly: false,
  columns: [{ key: "contact", label: "姓名" }],
  items: [
    object("contact-1", "联系人", [
      text("contact", "联系人姓名", "合成联系人"),
    ]),
  ],
  selected: null,
  operations: {},
});
lines.operations.create = operation(async () => {
  trace("contacts.create");
  lines.items.push(
    object(`contact-${lines.items.length + 1}`, "联系人", [
      text("contact", "联系人姓名"),
    ]),
  );
});
lines.operations.remove = operation(async () => {
  trace("contacts.remove");
  if (lines.selected)
    lines.items.splice(lines.items.indexOf(lines.selected), 1);
  lines.selected = null;
});
const settlementAccount = text("account", "结算账户", "合成账户");
const customer = object("customer", "客户", [
  text("code", "编号", "C1", true),
  name,
  credit,
  category,
  groups,
  text("internal", null, "隐藏内部值"),
  object("settlement", "结算", [settlementAccount]),
  lines,
]);
customer.identity = "C1";
// These facts stand in for the synthetic backend's authoritative record.
const currentCustomerFacts = () =>
  JSON.stringify({
    name: name.value,
    credit: credit.value,
    account: settlementAccount.value,
    category: category.value,
    groups: groups.value,
    contacts: lines.items.map((row) =>
      row.members.map((member) => ("value" in member ? member.value : null)),
    ),
  });
const savedCustomerFacts = ref(currentCustomerFacts());
Object.defineProperty(customer, "printable", {
  enumerable: true,
  get: () =>
    customer.identity !== null &&
    currentCustomerFacts() === savedCustomerFacts.value,
});
customer.operations.get = operation(async () => {
  trace("customer.get");
});
customer.operations.update = operation(async () => {
  trace("customer.update");
  if (name.value === "失败") throw Error("合成保存失败，请修改名称后重试。");
  savedCustomerFacts.value = currentCustomerFacts();
  model.messages.push({
    id: String(Date.now()),
    level: "success",
    text: `已保存：${name.value}`,
    target: customer,
  });
});
const itemTemplate: PrintTemplate = reactive({
  label: "客户打印",
  page: { width: 100, height: 100, margin: 5 },
  header: {
    height: 8,
    items: [
      {
        kind: "text",
        key: "title",
        x: 0,
        y: 0,
        width: 90,
        height: 8,
        text: "合成客户",
      },
    ],
  },
  footer: { height: 0, items: [] },
  body: [
    {
      kind: "record",
      height: 20,
      items: [
        {
          kind: "field",
          key: "name",
          path: ["name"],
          x: 0,
          y: 0,
          width: 90,
          height: 10,
        },
        {
          kind: "field",
          key: "credit",
          path: ["credit"],
          x: 0,
          y: 10,
          width: 90,
          height: 10,
        },
      ],
    },
  ],
});
const customers: Collection = reactive({
  key: "customers",
  label: "客户",
  icon: "catalog",
  columns: [
    { key: "code", label: "编号" },
    { key: "name", label: "客户名称" },
    { key: "credit", label: "额度" },
  ],
  conditions: object("customer-conditions", "查询条件", [
    filter,
    text("region", "地区条件"),
    text("owner", "负责人条件"),
    text("status", "状态条件"),
    text("contact", "联系条件"),
  ]),
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {},
  itemPrintTemple: itemTemplate,
  printTemple: {
    ...itemTemplate,
    label: "当前页打印",
    body: [
      {
        kind: "records",
        path: [],
        headerHeight: 8,
        rowHeight: 10,
        columns: [
          { path: ["name"], label: "名称", width: 45 },
          { path: ["credit"], label: "额度", width: 45 },
        ],
      },
    ],
  },
});
customers.operations.query = operation(async () => {
  const owner = JSON.stringify(model.session.owner);
  trace("customers.query");
  await Promise.resolve();
  if (
    JSON.stringify(model.session.owner) !== owner ||
    model.session.state !== "ready"
  )
    return;
  if (filter.value === "失败") throw Error("合成查询失败");
  const feedbackCase = filter.value === "引用反馈";
  customer.members = customer.members.filter(
    (node) => node.key !== "feedback-reference",
  );
  if (feedbackCase)
    customer.members.push(feedbackReference("feedback-reference", "表单引用"));
  lines.columns = [
    { key: "contact", label: "姓名" },
    ...(feedbackCase ? [{ key: "feedback-role", label: "角色" }] : []),
  ];
  const facts = JSON.parse(savedCustomerFacts.value) as {
    name: string;
    credit: string;
    account: string;
    category: { id: string; label: string } | null;
    groups: { id: string; label: string }[];
    contacts: string[][];
  };
  name.value = facts.name;
  credit.value = facts.credit;
  settlementAccount.value = facts.account;
  category.value = facts.category;
  groups.value = facts.groups;
  lines.items = facts.contacts.map((values, index) =>
    object(`contact-${index + 1}`, "联系人", [
      text("contact", "联系人姓名", values[0] ?? ""),
    ]),
  );
  if (feedbackCase)
    for (const row of lines.items)
      row.members.push(feedbackReference("feedback-role", "明细引用"));
  customer.identity = "C1";
  customers.items = [customer];
  customers.total = 1;
});
customers.operations.create = operation(async () => {
  trace("customers.create");
  const draft = object("new-customer", "客户", [
    text("code", "编号"),
    text("name", "客户名称"),
  ]);
  draft.operations.update = operation(async () => {
    trace("customer.create");
    draft.identity = `C${Date.now()}`;
    customers.items.push(draft);
    customers.total++;
    customers.draft = null;
  });
  customers.draft = draft;
});
const empty: Collection = reactive({
  key: "empty",
  label: "空集合",
  columns: [{ key: "title", label: "空集合列标题" }],
  conditions: object("empty-conditions", "查询条件", []),
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {},
});
const quantity: FieldNode = reactive({
  kind: "decimal",
  key: "quantity",
  label: "数量",
  value: "2",
  required: true,
  readOnly: false,
});
const voucherStatus = text("status", "单据状态", "草稿", true);
const voucher: ObjectNode = reactive({
  kind: "object",
  printable: false,
  family: "voucher",
  type: "AA",
  key: "voucher-1",
  label: "单据",
  identity: "V001",
  readOnly: false,
  members: [
    text("number", "单据编号", "V001", true),
    voucherStatus,
    object("header", "表头", [text("note", "表头说明", "合成表头")]),
    {
      kind: "records",
      key: "rows",
      label: "单据明细",
      readOnly: false,
      columns: [{ key: "quantity", label: "数量" }],
      items: [object("line-1", "明细", [quantity])],
      selected: null,
      operations: {},
    },
  ],
  operations: {
    update: operation(async () => {
      trace("voucher.update");
      voucherStatus.value = `已保存数量 ${quantity.value}`;
    }),
    submit: operation(async () => {
      trace("voucher.submit");
      voucherStatus.value = "已提交";
    }),
    withdraw: operation(async () => {
      trace("voucher.withdraw");
      voucherStatus.value = "已撤回";
    }),
  },
});
const vouchers: Collection = reactive({
  key: "vouchers",
  label: "单据",
  icon: "voucher",
  columns: [
    { key: "number", label: "单据编号" },
    { key: "status", label: "单据状态" },
  ],
  conditions: object("voucher-conditions", "查询条件", []),
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {
    query: operation(async () => {
      trace("vouchers.query");
      vouchers.items = [voucher];
      vouchers.total = 1;
    }),
  },
});
const secret: Extract<FieldNode, { kind: "secret" }> = reactive({
  kind: "secret",
  key: "credential",
  label: "接口密钥",
  required: false,
  readOnly: false,
  value: { intent: "keep" },
});
const secretStatus = text(
  "secretStatus",
  "密钥提交结果",
  "未提交密钥意图",
  true,
);
const profile = object("profile", "个人资料", [
  text("displayName", "用户姓名", "合成用户"),
  secret,
  secretStatus,
]);
profile.operations.update = operation(async () => {
  trace(`account.secret.${secret.value.intent}`);
  secretStatus.value =
    secret.value.intent === "keep"
      ? "已保留密钥"
      : secret.value.intent === "replace"
        ? "已修改密钥"
        : "已清除密钥";
});
const nextPassword: FieldNode = reactive({
  kind: "password",
  key: "next",
  label: "新密码",
  value: "",
  readOnly: false,
  required: true,
});
const password = object("password", "密码管理", [nextPassword]);
const shortcut = (
  key: string,
  label: string,
  target: Collection | null,
): RecordsNode => ({
  kind: "records",
  key,
  label,
  readOnly: true,
  columns: [{ key: "title", label: "名称" }],
  items: [
    {
      ...object(`${key}-row`, "入口", [
        text("title", "名称", target?.label ?? "今日有一条合成提醒", true),
      ]),
      identity: key,
      operations: {
        get: operation(async () => {
          if (target) model.navigation.visit(target);
        }),
      },
    },
  ],
  selected: null,
  operations: {},
});
let generation = 0;
function resetBusiness() {
  clearFamilyInputs();
  for (const { role } of workbenchSeeds) {
    model.workbench![role].items = [];
    model.workbench![role].selected = null;
  }
  for (const collection of Object.values(model.members)) {
    collection.items = [];
    collection.selected = null;
    collection.draft = null;
    collection.total = 0;
    collection.page = 1;
    for (const condition of collection.conditions.members)
      if ("value" in condition && typeof condition.value === "string")
        condition.value = "";
  }
  filter.value = "";
  name.value = "";
  settlementAccount.value = "";
  lines.items = [];
  customer.identity = null;
  credit.value = "";
  category.options = [];
  category.value = null;
  groups.value = [];
  secret.value = { intent: "keep" };
  secretStatus.value = "";
  nextPassword.value = "";
  loginPassword.value = "";
  model.messages = [];
}
const signIn = operation(async () => {
  trace("session.signIn");
  const owner: Owner = reactive({
    ledger: "synthetic",
    operator: loginName.value,
    generation: String(++generation),
  });
  model.session = {
    state: "ready",
    owner,
    userPermissions:
      loginName.value === "viewer"
        ? {
            owner,
            administrator: false,
            grants: [
              {
                node: model.members.customers!,
                read: true,
                write: false,
                operations: { query: true, get: true },
              },
              { node: credit, read: false, write: false, operations: {} },
            ],
          }
        : { owner, administrator: true },
  };
  model.navigation.current =
    loginName.value === "viewer" ? model.members.customers! : null;
});
export const model: BusinessModel = reactive({
  kind: "application",
  label: "静态业务模型",
  brand: { productName: "合成业务示例", companyName: "示例企业" },
  members: { customers, vouchers, empty, ...familyCollections },
  authentication: {
    form: object("login", "登录", [loginName, loginPassword]),
    operations: {
      signIn,
      recover: operation(async () => {
        trace("session.recover");
      }),
    },
  },
  account: {
    label: "合成用户",
    profile,
    password,
    operations: {
      changePassword: operation(async () => {
        trace("account.changePassword");
        nextPassword.value = "";
        model.messages.push({
          id: "password",
          level: "success",
          text: "合成密码已更新",
          target: null,
        });
      }),
      signOut: operation(async () => {
        trace("session.signOut");
        model.session = {
          state: "anonymous",
          owner: null,
          userPermissions: null,
        };
        resetBusiness();
        void router.push("/");
      }),
    },
  },
  session: { state: "anonymous", owner: null, userPermissions: null },
  navigation: {
    current: null,
    groups: [
      {
        key: "business",
        label: "业务",
        items: [
          customers,
          vouchers,
          empty,
          ...Object.values(familyCollections),
        ],
      },
    ],
    href(collection) {
      return collection
        ? `/business/${encodeURIComponent(collection.key)}`
        : "/";
    },
    visit(collection) {
      model.navigation.current = collection;
      void router.push(this.href(collection));
    },
  },
  messages: [],
  workbench: {
    load: operation(async () => {
      const requestOwner = JSON.stringify(model.session.owner);
      trace("workbench.load");
      await Promise.resolve();
      if (
        model.session.state !== "ready" ||
        JSON.stringify(model.session.owner) !== requestOwner
      )
        return;
      const permissions = model.session.userPermissions;
      for (const { role, items } of workbenchSeeds) {
        const block = model.workbench![role];
        if (
          permissions.administrator ||
          permissions.grants.some((grant) => grant.node === block && grant.read)
        )
          block.items = items;
      }
    }),
    information: shortcut("information", "重要信息", null),
    vouchers: shortcut("vouchers", "单据", vouchers),
    reports: shortcut("reports", "报表", reports),
    masters: shortcut("masters", "资料", customers),
  },
});
const workbenchSeeds = (
  ["information", "vouchers", "reports", "masters"] as const
).map((role) => ({ role, items: model.workbench![role].items }));
for (const { role } of workbenchSeeds) model.workbench![role].items = [];
bindFamilyQueries(() => model.session.owner);
router.afterEach((to) => {
  model.navigation.current =
    Object.values(model.members).find(
      (collection) => model.navigation.href(collection) === to.path,
    ) ?? null;
});
