/**
 * Target BusinessModel example, using the public model entry.
 * Synthetic backend only; the existing application runtime is not yet migrated.
 */
import { reactive } from "vue";
import { modelMetadata as meta, type BusinessModel } from "@zerp/ui/model";

// All local aliases come from the one public contract, never a parallel schema.
type Node = BusinessModel[string];
type ObjectNode = Extract<Node, { [meta]: { kind: "object" } }>;
type CollectionNode = Extract<Node, { [meta]: { kind: "collection" } }>;
type Target = ObjectNode | CollectionNode;
type ApplicationOptions = BusinessModel[typeof meta];
type Owner = NonNullable<ApplicationOptions["owner"]>;
type Navigation = ApplicationOptions["navigation"];

// These are illustrative model constructors, not additional UI props.
function text(name: string, value = "", readOnly = false) {
  return reactive({
    value,
    [meta]: { kind: "text" as const, name, readOnly },
  });
}
function object<const S extends Record<string, Node>>(
  name: string,
  members: S,
  form?: readonly Extract<keyof S, string>[],
) {
  return reactive(
    Object.assign(members, {
      [meta]: {
        kind: "object" as const,
        name,
        form,
        operations: {} as ObjectNode[typeof meta]["operations"],
      },
    }),
  ) as S & ObjectNode;
}

type Customer = { id: string; name: string; credit: string };
type History = { id: string; text: string };

// Stand-in for consumer-owned API calls. No UI request journal or baseline.
const backend = {
  customers: new Map<string, Customer>([
    ["C1", { id: "C1", name: "合成客户甲", credit: "100.00" }],
    ["C2", { id: "C2", name: "合成客户乙", credit: "200.00" }],
  ]),
  history: [] as History[],
  nextId: 3,
  async query(keyword: string, page: number, pageSize: number) {
    const rows = [...this.customers.values()].filter((row) =>
      row.name.includes(keyword),
    );
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
    };
  },
  async get(id: string) {
    const row = this.customers.get(id);
    if (!row) throw Error("记录不存在。");
    return { ...row };
  },
  async save(input: Customer) {
    if (!input.name.trim()) throw Error("名称不能为空。");
    const row = { ...input, id: input.id || `C${this.nextId++}` };
    this.customers.set(row.id, row);
    this.history.push({ id: String(this.history.length + 1), text: row.name });
    return { ...row };
  },
  async remove(id: string) {
    if (!this.customers.delete(id)) throw Error("记录不存在。");
  },
  async readHistory() {
    return this.history.map((entry) => ({ ...entry }));
  },
};

function customerRecord(value: Customer) {
  const record = object(
    "客户资料",
    {
      id: text("编号", value.id, true),
      name: text("名称", value.name),
      credit: reactive({
        value: value.credit,
        [meta]: { kind: "decimal" as const, name: "额度" },
      }),
    },
    ["id", "name", "credit"],
  );
  record[meta].identity = value.id || undefined;

  function adopt(result: Customer) {
    record.id.value = result.id;
    record.name.value = result.name;
    record.credit.value = result.credit;
    record[meta].identity = result.id;
  }

  record[meta].operations = {
    get: {
      async run() {
        adopt(await backend.get(record.id.value));
      },
    },
    update: {
      async run() {
        // This callback defines this write boundary. No child collection is saved.
        const result = await backend.save({
          id: record.id.value,
          name: record.name.value,
          credit: record.credit.value,
        });
        adopt(result);
        if (customers.draft === record) customers.draft = null;
        if (!customers.items.includes(record)) customers.items.push(record);
        customers.selected = record;
      },
    },
    delete: {
      get disabledReason() {
        return record.id.value ? undefined : "尚未保存。";
      },
      async run() {
        await backend.remove(record.id.value);
        customers.items = customers.items.filter((item) => item !== record);
        if (customers.selected === record) customers.selected = null;
      },
    },
  };
  return record;
}

const customers = reactive<CollectionNode>({
  items: [],
  selected: null,
  draft: null,
  query: object("查询条件", { keyword: text("关键词") }, ["keyword"]),
  page: 1,
  pageSize: 20,
  total: 0,
  [meta]: {
    kind: "collection",
    name: "客户",
    list: ["id", "name", "credit"],
    operations: {
      query: {
        async run() {
          const keyword = customers.query.keyword as ReturnType<typeof text>;
          const result = await backend.query(
            keyword.value,
            customers.page,
            customers.pageSize,
          );
          // Explicit query adopts backend results. Tab switching does not query.
          customers.items = result.items.map(customerRecord);
          customers.total = result.total;
        },
      },
      create: {
        async run() {
          customers.draft ??= customerRecord({ id: "", name: "", credit: "0" });
          customers.selected = customers.draft;
        },
      },
    },
  },
});

const history = reactive<CollectionNode>({
  items: [],
  selected: null,
  draft: null,
  query: object("查询条件", {}),
  page: 1,
  pageSize: 20,
  total: 0,
  [meta]: {
    kind: "collection",
    name: "变更记录",
    list: ["id", "text"],
    operations: {
      query: {
        async run() {
          const result = await backend.readHistory();
          history.items = result.map((entry) =>
            object("变更内容", {
              id: text("编号", entry.id, true),
              text: text("内容", entry.text, true),
            }),
          );
          history.total = result.length;
        },
      },
    },
  },
});

const directory = object(
  "往来资料",
  {
    overview: object("说明", {
      description: text("说明", "合成模型，输入直接修改 value。", true),
    }),
    customers,
    history,
  },
  ["overview", "customers", "history"],
);
const owner: Owner = { ledger: "demo", operator: "demo", generation: "1" };
const navigation: Navigation = reactive({
  current: directory,
  href(node: Target) {
    // In a real consumer these functions bridge its Router.
    if (node === directory) return "/directory";
    if (node === customers) return "/directory/customers";
    if (node === history) return "/directory/history";
    const id = node[meta].kind === "object" ? node[meta].identity : undefined;
    return `/directory/customers/${encodeURIComponent(id ?? "new")}`;
  },
  visit(node: Target) {
    navigation.current = node;
  },
});

// Widen business keys here so the exported UI contract does not require
// "directory", "customers", "history", or any other example business name.
const members: Record<string, Node> = { directory };
const options: ApplicationOptions = {
  kind: "application",
  name: "模型驱动应用",
  brand: { productName: "合成示例", companyName: "示例企业" },
  owner,
  userPermissions: { owner, administrator: true },
  navigation,
  navigationProjection: [
    { key: "business", name: "业务", items: [{ node: directory }] },
  ],
  messages: [],
};

/** Complete sample object: structure, values, operations, navigation, permission. */
export const exampleModel: BusinessModel = reactive(
  Object.assign(members, { [meta]: options }),
);
