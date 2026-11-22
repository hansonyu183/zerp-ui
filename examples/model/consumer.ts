import { reactive, ref } from "vue";
import type {
  BusinessModel,
  DomainGroup,
  Collection,
  FieldNode,
  InteractionNode,
  ObjectNode,
  Operation,
  Owner,
  PrintTemplate,
  RecordsNode,
} from "@zerp/ui/model";
import { printDemo } from "./print-demo";
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
const loginLedger: FieldNode = reactive({
  kind: "reference",
  key: "ledger",
  label: "账套",
  value: null,
  multiple: false,
  readOnly: false,
  required: true,
  options: [{ id: "synthetic", label: "合成账套", selectable: true }],
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
  get scopeKey() {
    return name.value;
  },
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
  let failedScope: string | undefined;
  const field: Extract<FieldNode, { kind: "reference" }> = reactive({
    kind: "reference",
    key,
    label,
    scopeKey: "0",
    readOnly: false,
    required: false,
    multiple: false,
    value: null,
    options: [],
    load: operation(async () => {
      const owner = JSON.stringify(model.session.owner);
      const scope = field.scopeKey;
      await Promise.resolve();
      if (
        model.session.state !== "ready" ||
        JSON.stringify(model.session.owner) !== owner ||
        field.scopeKey !== scope
      )
        return;
      if (failedScope !== scope) {
        failedScope = scope;
        throw Error(
          "目录读取失败：" +
            "合成目录暂不可用，请重试以重新读取候选；这是一条用于检验有限滚动区域的合成长消息。\n".repeat(
              50,
            ),
        );
      }
      field.options = [
        { id: "ready", label: "重试后的候选", selectable: true },
      ];
    }),
  });
  return field;
}
function contactLine(key: string, name = "") {
  return object(key, "联系人", [
    text("contact", "联系人姓名", name),
    feedbackReference("feedback-role", "明细引用"),
  ]);
}
let nextContact = 1;
const lines: RecordsNode = reactive({
  kind: "records",
  key: "contacts",
  label: "联系人",
  readOnly: false,
  items: [contactLine("contact-1", "合成联系人")],
  selected: null,
  operations: {},
});
lines.operations.create = operation(async () => {
  trace("contacts.create");
  lines.items.push(contactLine(`contact-${++nextContact}`));
});
lines.operations.remove = operation(async () => {
  trace("contacts.remove");
  if (lines.selected)
    lines.items.splice(lines.items.indexOf(lines.selected), 1);
  lines.selected = null;
});
const settlementAccount = text("account", "结算账户", "合成账户");
const feedbackForm = feedbackReference("feedback-reference", "表单引用");
function resetFeedbackForm() {
  feedbackForm.scopeKey = String(Number(feedbackForm.scopeKey) + 1);
  feedbackForm.options = [];
  feedbackForm.value = null;
}
const customer = object("customer", "客户", [
  text("code", "编号", "C1", true),
  name,
  credit,
  category,
  groups,
  feedbackForm,
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
      row.members.flatMap((member) =>
        member.kind === "text" && member.key === "contact"
          ? [member.value]
          : [],
      ),
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
    {
      kind: "reference",
      key: "ledger-filter",
      label: "账套条件",
      value: null,
      multiple: false,
      readOnly: false,
      required: false,
      options: [{ id: "synthetic", label: "合成账套", selectable: true }],
    },
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
  if (filter.value === "引用反馈") resetFeedbackForm();
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
    contactLine(`contact-${index + 1}`, values[0]),
  );
  nextContact = Math.max(nextContact, lines.items.length);
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
const contacts: Collection = reactive({
  key: "contacts",
  label: "联系人",
  columns: [{ key: "name", label: "姓名" }],
  conditions: object("contact-conditions", "查询条件", [
    text("contact-term", "联系人关键词"),
  ]),
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {
    query: operation(async () => {
      trace("contacts.query");
      contacts.items = [
        object("contact-1", "联系人", [text("name", "姓名", "合成联系人")]),
      ];
      contacts.total = 1;
    }),
  },
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
const voucherKeyword = text("keyword", "单据筛选");
const voucherDetailLinks: InteractionNode = {
  kind: "interactions",
  key: "links",
  label: "单据关联",
  readOnly: true,
  value: {},
  items: (
    [
      ["关联联系人", contacts],
      ["客户资料", customers],
      ["资料办理", familyCollections.documents],
      ["流程办理", familyCollections.workflows],
      ["批量办理", familyCollections.batches],
      ["经营报表", reports],
    ] as const
  ).map(([label, collection]) => ({
    id: collection.key,
    kind: "related",
    label,
    target: { collection },
  })),
};
const voucherDetails = Array.from({ length: 24 }, (_, index) => {
  const code = `MD${String(index + 1).padStart(3, "0")}`;
  const record = object(code, "合成手机详情", [
    text("number", "单据编号", code, true),
    text("status", "单据状态", "已核实", true),
  ]);
  record.family = "voucher";
  record.identity = code;
  record.readOnly = true;
  if (code === "MD017") {
    const details = text(
      "details",
      "完整办理记录",
      Array.from(
        { length: 28 },
        (_, line) => `第 ${line + 1} 行：这项合成操作已核实。`,
      ).join("\n") + "\n办理记录结尾",
      true,
    );
    details.kind = "longText";
    record.members.push(
      text(
        "remark",
        "单据备注",
        "这是一条手机上需要完整阅读的单据备注。".repeat(8) + "备注结尾",
        true,
      ),
      details,
      voucherDetailLinks,
    );
  }
  return record;
});
const vouchers: Collection = reactive({
  key: "vouchers",
  label: "单据",
  icon: "voucher",
  columns: [
    { key: "number", label: "单据编号" },
    { key: "status", label: "单据状态" },
  ],
  conditions: object("voucher-conditions", "查询条件", [voucherKeyword]),
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 12,
  total: 0,
  operations: {
    query: operation(async () => {
      trace("vouchers.query");
      const records =
        voucherKeyword.value === "手机详情" ? voucherDetails : [voucher];
      const offset = (vouchers.page - 1) * vouchers.pageSize;
      vouchers.items = records.slice(offset, offset + vouchers.pageSize);
      vouchers.total = records.length;
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
function asDomain(
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
function collections(): Collection[] {
  return model.members.flatMap((member) => {
    if (!("kind" in member)) return [member];
    if (member.kind === "domain") return member.members;
    return member.members.flatMap((child) =>
      child.kind === "domain"
        ? child.members
        : child.members.flatMap((domain) => domain.members),
    );
  });
}
let generation = 0;
function resetBusiness() {
  clearFamilyInputs();
  for (const { role } of workbenchSeeds) {
    model.workbench![role].items = [];
    model.workbench![role].selected = null;
  }
  for (const collection of collections()) {
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
  resetFeedbackForm();
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
                node: customers,
                read: true,
                write: false,
                operations: { query: true, get: true },
              },
              { node: credit, read: false, write: false, operations: {} },
            ],
          }
        : { owner, administrator: true },
  };
  model.navigation.current = loginName.value === "viewer" ? customers : null;
});
export const model: BusinessModel = reactive({
  kind: "application",
  label: "静态业务模型",
  brand: { productName: "合成业务示例", companyName: "示例企业" },
  members: [
    {
      kind: "category",
      key: "business",
      label: "业务",
      members: [
        {
          kind: "domain",
          key: "customerDomain",
          label: "客户",
          members: [customers, contacts],
        },
        asDomain(vouchers),
        asDomain(printDemo),
        ...Object.values(familyCollections).map((collection) =>
          asDomain(collection),
        ),
        {
          kind: "section",
          key: "examples",
          label: "示例分类",
          members: [asDomain(empty, "E 空集合")],
        },
      ],
    },
  ],
  authentication: {
    form: object("login", "登录", [loginLedger, loginName, loginPassword]),
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
    href(collection, record) {
      return collection
        ? `/business/${encodeURIComponent(collection.key)}${record ? `?id=${encodeURIComponent(record.identity ?? record.key)}` : ""}`
        : "/";
    },
    visit(collection, record) {
      if (collection && record) collection.selected = record;
      model.navigation.current = collection;
      void router.push(this.href(collection, record));
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
const recentCustomer = object("customer-off-page", "客户", [
  text("name", "客户名称", "外页合成客户", true),
]);
model.workbench!.targets = new Map([
  [
    workbenchSeeds.find(({ role }) => role === "vouchers")!.items[0]!,
    { collection: vouchers, record: vouchers.items[0]! },
  ],
  [
    workbenchSeeds.find(({ role }) => role === "reports")!.items[0]!,
    { collection: reports },
  ],
  [
    workbenchSeeds.find(({ role }) => role === "masters")!.items[0]!,
    { collection: customers, record: recentCustomer },
  ],
]);
model.workbench!.manageReports = { collection: reports };
for (const { role } of workbenchSeeds) model.workbench![role].items = [];
bindFamilyQueries(() => model.session.owner);
router.afterEach((to) => {
  model.navigation.current =
    collections().find(
      (collection) => model.navigation.href(collection) === to.path,
    ) ?? null;
});
