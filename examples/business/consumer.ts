import { reactive } from "vue";
import {
  defineBusinessPage,
  defineModulePage,
  type Attempt,
  type ReferenceAdapter,
  type WriteJournal,
  type WritePersistence,
  type PageDefinition,
  type ModuleEntry,
} from "@zerp/ui";
import type { BusinessType, BusinessValue } from "@zerp/ui/model";

export const sampleType = {
  kind: "object",
  name: "往来单位",
  properties: {
    id: { kind: "text", name: "编号", readOnly: true },
    name: { kind: "text", name: "名称", required: true },
    category: { kind: "reference", name: "分类", hierarchical: true },
    contact: {
      kind: "object",
      name: "联系信息",
      properties: { mobile: { kind: "text", name: "手机" } },
      form: { fields: ["mobile"] },
    },
    attributes: {
      kind: "object",
      name: "属性",
      properties: {
        credential: { kind: "text", name: "授权码", secret: true },
      },
      form: { fields: ["credential"] },
    },
    contacts: { kind: "collection", name: "联系人" },
    settings: {
      kind: "object",
      name: "账款设置",
      readOnly: true,
      properties: { limit: { kind: "decimal", name: "额度" } },
      form: { fields: ["limit"] },
    },
    empty: {
      kind: "object",
      name: "空内容",
      properties: {},
      form: { fields: [] },
    },
  },
  list: { fields: ["id", "name", "contact.mobile"] },
  form: {
    fields: [
      "name",
      "category",
      "contact",
      "attributes",
      "contacts",
      "settings",
      "empty",
    ],
  },
} as const satisfies BusinessType;
export type Sample = BusinessValue<typeof sampleType>;
export const reference: ReferenceAdapter = {
  async search({ ancestor }) {
    return {
      items: ancestor
        ? [{ id: "child", label: "子分类" }]
        : [{ id: "parent", label: "总分类", hasChildren: true }],
      total: 1,
    };
  },
  async resolve({ ids }) {
    return ids.map((id) => ({
      id,
      label: id === "child" ? "子分类" : "总分类",
    }));
  },
};
export const scenario = reactive({
  result: "success" as "success" | "unknown" | "failure",
  confirmed: false,
  refreshFailure: false,
});
export const writes: Attempt<Sample, string>[] = [];
const rows = reactive<Record<string, Sample>>({
  a: {
    id: "a",
    name: "示例单位",
    category: "parent",
    contact: { mobile: "123" },
    attributes: {},
  },
});
const journals = new Map<string, WriteJournal<Attempt<Sample, string>>>();
function persistence(
  resource: string,
): WritePersistence<Attempt<Sample, string>> {
  let current: string | null = null;
  return {
    async load(_owner, id) {
      return journals.get(`${resource}:${id ?? current}`) ?? null;
    },
    async save(journal, expected) {
      if (
        expected !== current &&
        !(
          expected === null && journals.get(`${resource}:${current}`)?.completed
        )
      )
        throw Error("原请求已变化。");
      current = journal.attempt.id;
      journals.set(`${resource}:${current}`, structuredClone(journal));
    },
    async complete(_owner, id) {
      const journal = journals.get(`${resource}:${id}`)!;
      journals.set(`${resource}:${id}`, { ...journal, completed: true });
    },
  };
}
function collection(
  resource: string,
  title: string,
  initial: Sample,
  related = false,
): PageDefinition<"crud"> {
  const data =
    resource === "parties"
      ? rows
      : reactive<Record<string, Sample>>({
          [resource]: { ...initial, id: resource },
        });
  const durable = persistence(resource);
  const adapter = {
    async query() {
      if (scenario.refreshFailure && writes.length)
        throw Error("暂时无法读取。");
      return { items: Object.values(data), total: Object.keys(data).length };
    },
    empty: (): Sample => ({ name: "", contact: {}, attributes: {} }),
    async initialize() {
      return { values: adapter.empty() };
    },
    async get({ identity }: { identity: string }) {
      return { values: JSON.parse(JSON.stringify(data[identity])), identity };
    },
    async create(attempt: Attempt<Sample, string>) {
      return save(attempt);
    },
    async save(attempt: Attempt<Sample, string>) {
      return save(attempt);
    },
  };
  async function save(attempt: Attempt<Sample, string>) {
    writes.push(structuredClone(attempt));
    if (scenario.result === "failure")
      return { status: "failure" as const, message: "请检查输入。" };
    const id = attempt.identity ?? "new";
    data[id] = { ...attempt.input, id };
    return scenario.result === "unknown"
      ? { status: "unknown" as const }
      : { status: "success" as const, identity: id };
  }
  return defineBusinessPage({
    definition: {
      resource,
      title,
      model: sampleType,
      filters: [],
      initialFilters: () => ({}),
      identity: (row: Sample) => row.id!,
      actions: () => ["view", "edit"] as const,
      adapter,
      persistence: durable,
      reference: () => reference,
      reconcile: async (attempt) =>
        scenario.confirmed
          ? {
              status: "applied" as const,
              attemptId: attempt.id,
              evidence: true,
            }
          : { status: "unknown" as const },
    },
    permissions: { query: true, create: true, write: true, reconcile: true },
    retainEditor: true,
    related: related
      ? {
          contacts: () => relatedEntries[0]!.page,
          settings: () => relatedEntries[1]!.page,
        }
      : undefined,
  });
}
const relatedEntries: ModuleEntry[] = [
  {
    key: "contacts",
    label: "联系人",
    page: collection("contacts", "联系人", { name: "示例联系人" }),
  },
  {
    key: "settings",
    label: "账款设置",
    page: collection("settings", "账款设置", { name: "示例设置" }),
  },
];
const catalogs = ["分类", "分组", "属性定义", "相关字典"];
const moduleModel: import("@zerp/ui").BusinessObject = {
  kind: "object",
  name: "往来单位",
  properties: Object.fromEntries(
    ["往来单位", ...catalogs].map((name, index) => [
      index ? `catalog-${index - 1}` : "parties",
      { kind: "collection" as const, name },
    ]),
  ),
  form: {
    fields: ["parties", ...catalogs.map((_, index) => `catalog-${index}`)],
  },
};
export const page = defineModulePage({
  model: moduleModel,
  collections: {
    parties: collection("parties", "往来单位", {}, true),
    ...Object.fromEntries(
      catalogs.map((label, index) => [
        `catalog-${index}`,
        collection(`catalog-${index}`, label, { name: `示例${label}` }),
      ]),
    ),
  },
});
