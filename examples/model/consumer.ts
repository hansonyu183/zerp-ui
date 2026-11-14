import { reactive } from "vue";
import { modelMetadata as meta, type BusinessModel } from "@zerp/ui/model";
import { router } from "./router";
import { document, voucher, workflow, batch, report, output } from "./families";

const trace = (name: string) => console.log(`synthetic-call:${name}`);
const owner = { ledger: "synthetic", operator: "demo", generation: "1" };
const catalog = reactive({
  value: null as { id: string; label: string } | null,
  [meta]: {
    kind: "reference",
    name: "客户分类",
    options: [] as { id: string; label: string }[],
    load: {
      async run() {
        trace("catalog.load");
        catalog[meta].options = Array.from({ length: 45 }, (_, i) => ({
          id: String(i + 1),
          label: `分类${i + 1}`,
        }));
      },
    },
  },
} satisfies BusinessModel[string]);
const record = {
  category: catalog,
  code: { value: "C1", [meta]: { kind: "text", name: "编号", readOnly: true } },
  name: { value: "合成客户甲", [meta]: { kind: "text", name: "客户名称" } },
  credit: { value: "100.00", [meta]: { kind: "decimal", name: "额度" } },
  [meta]: {
    kind: "object",
    name: "客户资料",
    identity: "C1",
    form: ["code", "name", "credit", "category"],
    operations: {
      get: {
        async run() {
          trace("customer.get");
        },
      },
      update: {
        async run() {
          trace("customer.update");
          model[meta].messages.push({
            id: String(Date.now()),
            level: "info",
            text: `已保存：${model.directory.customers.items[0]!.name.value}`,
          });
        },
      },
    },
  },
} satisfies BusinessModel[string];
const customers = {
  items: [record],
  selected: null,
  draft: null,
  query: {
    keyword: { value: "", [meta]: { kind: "text", name: "关键词" } },
    [meta]: { kind: "object", name: "查询条件", operations: {} },
  },
  page: 1,
  pageSize: 20,
  total: 1,
  [meta]: {
    kind: "collection",
    name: "客户",
    element: record,
    list: ["code", "name", "credit"],
    operations: {
      query: {
        async run() {
          trace("customers.query");
          if (model.directory.customers.query.keyword.value === "失败")
            throw Error("合成查询失败");
        },
      },
    },
  },
} satisfies BusinessModel[string];
const emptyHistory = {
  items: [],
  selected: null,
  draft: null,
  query: { [meta]: { kind: "object", name: "记录查询条件", operations: {} } },
  page: 1,
  pageSize: 20,
  total: 0,
  [meta]: {
    kind: "collection",
    name: "变更记录",
    element: record,
    list: ["code", "name"],
    operations: {},
  },
} satisfies BusinessModel[string];
const directory = {
  emptyHistory,
  overview: {
    note: {
      value: "输入直接更新模型；操作读取当前值。",
      [meta]: { kind: "text", name: "说明", readOnly: true },
    },
    [meta]: { kind: "object", name: "概览", operations: {} },
  },
  customers,
  [meta]: {
    kind: "object",
    name: "往来资料",
    form: ["overview", "customers", "emptyHistory"],
    operations: {},
  },
} satisfies BusinessModel[string];
type Target = NonNullable<BusinessModel[typeof meta]["navigation"]["current"]>;
const source = {
  directory,
  document,
  voucher,
  workflow,
  batch,
  report,
  output,
  [meta]: {
    kind: "application",
    name: "直接业务模型",
    brand: { productName: "合成业务示例", companyName: "示例企业" },
    owner,
    userPermissions: { owner, administrator: true },
    navigation: {
      current: directory as Target | null,
      href(node: Target) {
        return `/business/${encodeURIComponent(node[meta].name)}`;
      },
      visit(node: Target) {
        void router.push(this.href(node));
      },
    },
    navigationProjection: [
      {
        key: "business",
        name: "业务",
        items: [
          { node: directory },
          { node: document },
          { node: voucher },
          { node: workflow },
          { node: batch },
          { node: report },
          { node: output },
        ],
      },
    ],
    messages: [] as BusinessModel[typeof meta]["messages"],
  },
} satisfies BusinessModel;
export const model = reactive(source);
router.afterEach((to) => {
  model[meta].navigation.current =
    Object.values(model).find(
      (node) => `/business/${encodeURIComponent(node[meta].name)}` === to.path,
    ) ?? model.directory;
});
