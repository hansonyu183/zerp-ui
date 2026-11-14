/** Compile-only example of BusinessModel. The declared consumer callbacks have no implementation. */
import { modelMetadata as meta, type BusinessModel } from "@zerp/ui/model";

declare function queryCustomers(): Promise<void>;
declare function createCustomer(): Promise<void>;
declare function getCustomer(): Promise<void>;
declare function updateCustomer(): Promise<void>;
declare function deleteCustomer(): Promise<void>;
declare function queryHistory(): Promise<void>;
declare const href: BusinessModel[typeof meta]["navigation"]["href"];
declare const visit: BusinessModel[typeof meta]["navigation"]["visit"];

// Ordinary business names and sample values, never requirements on UI consumers.
const customer = {
  id: { value: "C1", [meta]: { kind: "text", name: "编号", readOnly: true } },
  name: {
    value: "合成客户甲",
    [meta]: { kind: "text", name: "名称", required: true },
  },
  credit: { value: "100.00", [meta]: { kind: "decimal", name: "额度" } },
  enabled: { value: true, [meta]: { kind: "boolean", name: "启用" } },
  [meta]: {
    kind: "object",
    name: "客户资料",
    identity: "C1",
    form: ["id", "name", "credit", "enabled"],
    operations: {
      get: { run: getCustomer },
      update: { run: updateCustomer },
      delete: { run: deleteCustomer, disabledReason: "该记录当前不可删除。" },
    },
  },
} satisfies BusinessModel[string];

const customers = {
  items: [customer],
  selected: customer,
  draft: null,
  query: {
    keyword: { value: "", [meta]: { kind: "text", name: "关键词" } },
    [meta]: {
      kind: "object",
      name: "查询条件",
      form: ["keyword"],
      operations: {},
    },
  },
  page: 1,
  pageSize: 20,
  total: 1,
  [meta]: {
    kind: "collection",
    name: "客户",
    // The same model supplies column definitions; no duplicate columns schema.
    element: customer,
    list: ["id", "name", "credit", "enabled"],
    operations: {
      query: { run: queryCustomers },
      create: { run: createCustomer },
    },
  },
} satisfies BusinessModel[string];

const historyEntry = {
  id: { value: "", [meta]: { kind: "text", name: "编号", readOnly: true } },
  text: { value: "", [meta]: { kind: "text", name: "内容", readOnly: true } },
  [meta]: {
    kind: "object",
    name: "变更内容",
    form: ["id", "text"],
    readOnly: true,
    operations: {},
  },
} satisfies BusinessModel[string];

const history = {
  items: [],
  selected: null,
  draft: null,
  query: {
    [meta]: { kind: "object", name: "查询条件", operations: {} },
  },
  page: 1,
  pageSize: 20,
  total: 0,
  [meta]: {
    kind: "collection",
    name: "变更记录",
    // Fields and names remain available even though there are no records.
    element: historyEntry,
    list: ["id", "text"],
    operations: { query: { run: queryHistory } },
  },
} satisfies BusinessModel[string];

const directory = {
  overview: {
    description: {
      value: "输入直接绑定模型，业务操作由消费者提供。",
      [meta]: { kind: "text", name: "说明", readOnly: true },
    },
    [meta]: {
      kind: "object",
      name: "说明",
      form: ["description"],
      operations: {},
    },
  },
  customers,
  history,
  [meta]: {
    kind: "object",
    name: "往来资料",
    form: ["overview", "customers", "history"],
    operations: {},
  },
} satisfies BusinessModel[string];

const owner = { ledger: "demo", operator: "demo", generation: "1" };

// This object illustrates the type only. Do not import it as a running application.
export const exampleModel = {
  directory,
  [meta]: {
    kind: "application",
    name: "模型驱动应用",
    brand: { productName: "合成示例", companyName: "示例企业" },
    owner,
    userPermissions: { owner, administrator: true },
    navigation: { current: directory, href, visit },
    navigationProjection: [
      { key: "business", name: "业务", items: [{ node: directory }] },
    ],
    messages: [{ id: "example", level: "info", text: "这是类型示例。" }],
  },
} satisfies BusinessModel;
