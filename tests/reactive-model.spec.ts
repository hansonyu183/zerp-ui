import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import {
  application,
  object,
  collection,
  text,
  array,
  secret,
  reference,
  type ModelNode,
  type ApplicationNode,
  decimal,
  boolean,
  messages,
  type ModelNavigation,
  type ModelApplicationOptions,
  type ModelRequest,
} from "../src/model";
const mounted: VueWrapper[] = [];
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});
async function click(name: string, root: ParentNode = document) {
  const button = [...root.querySelectorAll("button")].find(
    (el) =>
      el.textContent?.trim() === name || el.getAttribute("aria-label") === name,
  );
  expect(button, name).toBeDefined();
  button!.click();
  await flushPromises();
}
async function input(name: string, value: string) {
  const element = document.querySelector<HTMLInputElement>(
    `input[aria-label="${name}"]`,
  )!;
  expect(element, name).toBeTruthy();
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
}
async function fixture(
  unknown = false,
  persistence?: ModelApplicationOptions["persistence"],
) {
  const run = vi.fn(async (_request: unknown) =>
    unknown ? { status: "unknown" as const } : { status: "success" as const },
  );
  const reconcile = vi.fn(async (request: { requestId: string }) => ({
    status: "not-applied" as const,
    requestId: request.requestId,
    evidence: {
      value: { id: "a", name: "合成", credit: "0.00", enabled: false },
      identity: { id: "a" },
      concurrency: "1",
    },
  }));
  const update = reactive({ run, reconcile, disabledReason: "" });
  const childRun = vi.fn(
    async (
      _request: ModelRequest<
        { phone: string | null },
        { id: string | null },
        readonly [{ id: string }]
      >,
    ) => ({ status: "success" as const }),
  );
  const contactNode = () =>
    object(
      "联系人",
      {
        id: text("联系人编号", { value: "c", readOnly: true }),
        phone: text("联系人电话", { value: "100" }),
      },
      { identity: ["id"], operations: { update: { run: childRun } } },
    );
  const contact = contactNode();
  const contacts = collection("联系人", contactNode, {
    operations: {
      query: {
        async run() {
          return { items: [contact], total: 1 };
        },
      },
    },
  });
  const customer = () =>
    object(
      "客户",
      {
        id: text("编号", { readOnly: true, value: "a" }),
        name: text("名称", { value: "合成" }),
        credit: decimal("额度", { value: "0.00" }),
        enabled: boolean("启用", { value: false }),
        contacts,
      },
      { identity: ["id"], concurrency: "1", operations: { update } },
    );
  const row = customer();
  const customers = collection("客户", customer, {
    operations: {
      query: {
        async run() {
          return { items: [row], total: 1 };
        },
      },
    },
  });
  const navigation: ModelNavigation = {
    current: { node: customers },
    href: () => "/customers",
    visit: vi.fn(),
    guard: () => () => {},
  };
  const settings = reactive({
    owner: { ledger: "demo", operator: "u", generation: "1" },
    navigation,
    persistence,
    brand: {
      productName: "合成",
      enterpriseName: "合成",
      home: "/",
      mark: { kind: "text" as const, text: "例" },
    },
  });
  const model = reactive(
    application("合成应用", { customers, notifications: messages() }, settings),
  );
  const wrapper = await mountApplication(model);
  return { wrapper, model, run, row, reconcile, update, settings, childRun };
}
it("binds only a model and preserves zero/false and exact decimal on a customer update", async () => {
  const { run } = await fixture();
  await click("编辑");
  await input("名称", "修改");
  await click("保存");
  expect(run).toHaveBeenCalledOnce();
  expect(run.mock.calls[0]?.[0]).toMatchObject({
    operation: "update",
    identity: { id: "a" },
    input: { name: "修改", credit: "0.00", enabled: false },
    concurrency: "1",
    ancestors: [],
  });
  expect(run.mock.calls[0]?.[0]).not.toHaveProperty("input.id");
});
it("ordinary query and dismissed feedback cannot unlock an unknown original", async () => {
  const { run, reconcile } = await fixture(true);
  await click("编辑");
  await input("名称", "未知修改");
  await click("保存");
  await click("查询");
  expect(run).toHaveBeenCalledOnce();
  expect(reconcile).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("未知");
  await click("核实本次请求");
  expect(reconcile).toHaveBeenCalledOnce();
  expect(run).toHaveBeenCalledOnce();
});

it("does not invoke a reserved write after reactive operation withdrawal", async () => {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saved: unknown;
  const persistence: NonNullable<ModelApplicationOptions["persistence"]> = {
    async pending() {
      return [];
    },
    async load() {
      return (saved as never) ?? null;
    },
    async save(journal) {
      saved = structuredClone(journal);
      await barrier;
    },
    async complete() {},
  };
  const { run, update } = await fixture(true, persistence);
  await click("编辑");
  await input("名称", "撤权前");
  await click("保存");
  update.disabledReason = "授权已撤销";
  release();
  await flushPromises();
  expect(run).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("授权已撤销");
});
it("restores the frozen original after remount without resending it", async () => {
  const journals = new Map<string, unknown>();
  let current = "";
  const persistence: NonNullable<ModelApplicationOptions["persistence"]> = {
    async pending() {
      return [];
    },
    async load(_owner, id) {
      return (journals.get(id ?? current) ?? null) as never;
    },
    async save(journal, expected) {
      if (expected !== null && expected !== current) throw Error("CAS");
      current = journal.attempt.id;
      journals.set(current, structuredClone(journal));
    },
    async complete(_owner, id) {
      const journal = journals.get(id) as object;
      journals.set(id, { ...journal, completed: true });
    },
  };
  const first = await fixture(true, persistence);
  await click("编辑");
  await input("名称", "冻结输入");
  await click("保存");
  first.wrapper.unmount();
  mounted.splice(mounted.indexOf(first.wrapper), 1);
  document.body.innerHTML = "";
  const second = await fixture(true, persistence);
  await click("核实本次请求");
  expect(second.run).not.toHaveBeenCalled();
  expect(second.reconcile.mock.calls[0]?.[0]).toMatchObject({
    input: { name: "冻结输入" },
    operation: "update",
    concurrency: "1",
  });
});

it("reactive authoritative values update visible facts without replacing an unsaved draft", async () => {
  const { model, run } = await fixture();
  model.customers.items[0]!.name.value = "新权威值";
  await flushPromises();
  expect(document.body.textContent).toContain("新权威值");
  await click("编辑");
  await input("名称", "未保存草稿");
  expect(model.customers.items[0]!.name.value).toBe("未保存草稿");
  model.customers.items[0]!.name.value = "后台更新";
  await flushPromises();
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="名称"]')!.value,
  ).toBe("未保存草稿");
  expect(run).not.toHaveBeenCalled();
});
it("independent contact commits survive cancelling the parent draft", async () => {
  const { model, childRun, run } = await fixture();
  await click("编辑");
  await input("名称", "父草稿");
  await click("联系人");
  const child = document.querySelector('.zerp-ui[aria-label="联系人"]')!;
  await click("编辑", child);
  await input("联系人电话", "200");
  await click("保存", child);
  expect(childRun).toHaveBeenCalledOnce();
  expect(childRun.mock.calls[0]![0]).toMatchObject({
    identity: { id: "c" },
    ancestors: [{ id: "a" }],
    input: { phone: "200" },
  });
  await click("取消编辑", child);
  await click("基本资料");
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].filter((el) => el.textContent?.trim() === "取消编辑");
  buttons.at(-1)!.click();
  await flushPromises();
  await click("放弃本地修改");
  expect(run).not.toHaveBeenCalled();
  expect(model.customers.items[0]!.name.value).toBe("合成");
  expect(model.customers.items[0]!.contacts.items[0]!.phone.value).toBe("200");
});

it("isolates active notifications across owner generations", async () => {
  const { model, settings } = await fixture();
  model.notifications.items = [
    { id: "same", level: "warning", text: "旧会话通知" },
  ];
  await flushPromises();
  expect(document.body.textContent).toContain("旧会话通知");
  settings.owner = { ledger: "demo", operator: "u", generation: "2" };
  await flushPromises();
  expect(document.body.textContent).not.toContain("旧会话通知");
  model.notifications.items = [
    { id: "same", level: "warning", text: "新会话通知" },
  ];
  await flushPromises();
  expect(document.body.textContent).toContain("新会话通知");
});
it("node removal and restoration retain the unknown request lock", async () => {
  const { model, run } = await fixture(true);
  await click("编辑");
  await input("名称", "未知敏感草稿");
  await click("保存");
  const node = model.customers;
  Reflect.deleteProperty(model, "customers");
  await flushPromises();
  expect(document.body.textContent).not.toContain("未知敏感草稿");
  expect(document.body.textContent).toContain("未完成的原请求");
  Reflect.set(model, "customers", node);
  await flushPromises();
  expect(document.body.textContent).toContain("请求结果未知");
  expect(run).toHaveBeenCalledOnce();
});

it("retains an unknown lock across component removal without a persistence port", async () => {
  const first = await fixture(true);
  await click("编辑");
  await input("名称", "内存原请求");
  await click("保存");
  first.wrapper.unmount();
  mounted.splice(mounted.indexOf(first.wrapper), 1);
  document.body.innerHTML = "";
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: {} }],
  });
  const second = mount(BusinessApplication, {
    attachTo: document.body,
    props: { model: first.model },
    global: { plugins: [router] },
  });
  mounted.push(second);
  await flushPromises();
  expect(document.body.textContent).toContain("请求结果未知");
  expect(first.run).toHaveBeenCalledOnce();
  await click("核实本次请求");
  expect(first.reconcile).toHaveBeenCalledOnce();
});

async function mountApplication(model: ApplicationNode) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<span />" } }],
  });
  await router.push("/customers");
  const wrapper = mount(BusinessApplication, {
    attachTo: document.body,
    props: { model },
    global: { plugins: [router] },
  });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
}
async function renderNode(
  node: ModelNode,
  extra: Partial<ModelApplicationOptions> = {},
) {
  const settings = reactive({
    owner: { ledger: "demo", operator: "u", generation: "1" },
    brand: {
      productName: "合成",
      enterpriseName: "合成",
      home: "/",
      mark: { kind: "text" as const, text: "例" },
    },
    navigation: {
      current: { node },
      href: () => "/customers",
      visit: vi.fn(),
      guard: () => () => {},
    } as ModelNavigation,
    ...extra,
  });
  await mountApplication(
    reactive(application("合成应用", { records: node }, settings)),
  );
  return settings;
}
it("reads an off-page deep-link identity through the element get and retains its write boundary", async () => {
  const get = vi.fn(async ({ identity }: { identity: { id: string } }) => ({
    value: { id: identity.id, name: "页外详情" },
    identity,
    concurrency: "2",
  }));
  const run = vi.fn(
    async (
      _request: ModelRequest<{ name: string | null }, { id: string }>,
    ) => ({ status: "success" as const }),
  );
  const element = () =>
    object(
      "客户",
      { id: text("编号", { readOnly: true, value: "" }), name: text("名称") },
      {
        identity: ["id"] as const,
        operations: {
          get: { run: (context) => get(context) },
          update: { run: (request) => run(request) },
        },
      },
    );
  const customers = collection("客户", element, {
    operations: {
      query: {
        async run() {
          return { items: [], total: 0 };
        },
      },
    },
  });
  const settings = await renderNode(customers);
  settings.navigation.current = {
    node: customers,
    identity: { id: "off-page" },
  };
  await flushPromises();
  expect(get).toHaveBeenCalled();
  expect(document.body.textContent).toContain("页外详情");
  await click("编辑");
  await input("名称", "页外修改");
  await click("保存");
  expect(run.mock.calls[0]?.[0]).toMatchObject({
    identity: { id: "off-page" },
    concurrency: "2",
    input: { name: "页外修改" },
  });
});
it("does not call disabled reference operations and presents their business reason", async () => {
  const search = vi.fn(async () => ({ items: [], total: 0 }));
  const resolve = vi.fn(async () => []);
  const node = object(
    "设置",
    {
      category: reference("分类", {
        value: "old",
        operations: {
          search: { disabledReason: "分类搜索已停用", run: search },
          resolve: { disabledReason: "分类解析已停用", run: resolve },
        },
      }),
    },
    {
      operations: {
        update: {
          async run() {
            return { status: "success" };
          },
        },
      },
    },
  );
  await renderNode(node);
  await click("编辑");
  expect(search).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("分类搜索已停用");
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="分类"]')
      ?.disabled,
  ).toBe(true);
});
it("discards a query response after its operation is withdrawn", async () => {
  let release!: (value: {
    items: ReturnType<typeof element>[];
    total: number;
  }) => void;
  const pending = new Promise<{
    items: ReturnType<typeof element>[];
    total: number;
  }>((resolve) => {
    release = resolve;
  });
  const element = () =>
    object(
      "客户",
      {
        id: text("编号", { value: "x", readOnly: true }),
        name: text("名称", { value: "过期记录" }),
      },
      {
        identity: ["id"],
        operations: {
          update: {
            async run() {
              return { status: "success" };
            },
          },
        },
      },
    );
  const query = reactive({
    disabledReason: "",
    run: async () => await pending,
  });
  await renderNode(collection("客户", element, { operations: { query } }));
  query.disabledReason = "查询已撤销";
  release({ items: [element()], total: 1 });
  await flushPromises();
  expect(document.body.textContent).not.toContain("过期记录");
});
it("discards a detail response after the get operation changes", async () => {
  let release!: (value: {
    value: { id: string; name: string };
    identity: { id: string };
    concurrency: string;
  }) => void;
  const pending = new Promise<{
    value: { id: string; name: string };
    identity: { id: string };
    concurrency: string;
  }>((resolve) => {
    release = resolve;
  });
  const get = reactive({ run: async () => await pending });
  const element = () =>
    object(
      "客户",
      {
        id: text("编号", { value: "x", readOnly: true }),
        name: text("名称", { value: "当前记录" }),
      },
      { identity: ["id"], operations: { get } },
    );
  const row = element();
  await renderNode(
    collection("客户", element, {
      operations: {
        query: {
          async run() {
            return { items: [row], total: 1 };
          },
        },
      },
    }),
  );
  await click("查看");
  get.run = async () => ({
    value: { id: "x", name: "新读取" },
    identity: { id: "x" },
    concurrency: "3",
  });
  release({
    value: { id: "x", name: "过期详情" },
    identity: { id: "x" },
    concurrency: "2",
  });
  await flushPromises();
  expect(document.body.textContent).not.toContain("过期详情");
  expect(row.name.value).toBe("当前记录");
});
it("clears nested read secrets and rejects unencrypted durable originals before reservation", async () => {
  const run = vi.fn(async () => ({ status: "success" as const }));
  const save = vi.fn(async () => {});
  const node = object(
    "设置",
    {
      credentials: array(
        "凭证行",
        () =>
          object("凭证", {
            token: secret("令牌", { value: "must-not-adopt" }),
          }),
        [
          object("凭证", {
            token: secret("令牌", { value: "must-not-adopt" }),
          }),
        ],
      ),
    },
    { operations: { update: { run } } },
  );
  await renderNode(node, {
    persistence: {
      async pending() {
        return [];
      },
      async load() {
        return null;
      },
      save,
      async complete() {},
    },
  });
  await click("编辑");
  expect(document.querySelector('input[type="password"]')).toBeNull();
  const select = document.querySelector<HTMLInputElement>(
    'input[aria-label="令牌"]',
  )!;
  select.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  await flushPromises();
  const change = [
    ...document.querySelectorAll<HTMLElement>(".v-list-item"),
  ].find((el) => el.textContent?.trim() === "修改")!;
  change.click();
  await flushPromises();
  await input("新的令牌", "nested-secret");
  await click("保存");
  expect(save).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain(
    "秘密输入需要消费者加密的原请求存储",
  );
});

it("freezes the actual new element concurrency baseline in a create request", async () => {
  let sequence = 0;
  const element = () =>
    object(
      "客户",
      {
        id: text("编号", { readOnly: true, value: "" }),
        name: text("名称"),
      },
      { identity: ["id"], concurrency: `dependencies-${++sequence}` },
    );
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
    snapshot: {
      value: { id: "created", name: "新增" },
      identity: { id: "created" },
      concurrency: "saved",
    },
  }));
  const records = collection("客户", element, {
    operations: {
      query: {
        async run() {
          return { items: [], total: 0 };
        },
      },
      create: { run },
    },
  });
  await renderNode(records);
  await click("新增");
  const actualBaseline = `dependencies-${sequence}`;
  await input("名称", "新增");
  await click("保存");
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]![0]).toMatchObject({
    identity: null,
    concurrency: actualBaseline,
    input: { name: "新增" },
  });
});

it("rechecks new element dependencies after durable reservation", async () => {
  const baseline = reactive({
    concurrency: "before",
    identity: ["id"] as const,
  });
  const element = () =>
    object(
      "客户",
      { id: text("编号", { readOnly: true }), name: text("名称") },
      baseline,
    );
  const run = vi.fn(async (_request: unknown) => ({
    status: "unknown" as const,
  }));
  const records = collection("客户", element, {
    operations: {
      query: {
        async run() {
          return { items: [], total: 0 };
        },
      },
      create: { run },
    },
  });
  let saved: unknown;
  await renderNode(records, {
    persistence: {
      async pending() {
        return [];
      },
      async load() {
        return (saved as never) ?? null;
      },
      async save(journal) {
        saved = structuredClone(journal);
        baseline.concurrency = "after";
      },
      async complete() {},
    },
  });
  await click("新增");
  await input("名称", "新增");
  await click("保存");
  expect(run).not.toHaveBeenCalled();
  expect(saved).toMatchObject({
    attempt: { identity: { concurrency: "before" } },
  });
  expect(document.body.textContent).toContain("并发基线已变化");
});

it("downloads a collection export artifact and releases its object URL", async () => {
  const content = new Blob(["synthetic export"], { type: "text/csv" });
  const createURL = vi.fn(() => "blob:synthetic");
  const revokeURL = vi.fn();
  const originalURL = URL;
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createURL;
      static revokeObjectURL = revokeURL;
    },
  );
  const downloaded: { href: string; filename: string }[] = [];
  const clickAnchor = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloaded.push({ href: this.href, filename: this.download });
    });
  try {
    const records = collection(
      "客户",
      () => object("客户", { id: text("编号") }, { identity: ["id"] }),
      {
        operations: {
          query: {
            async run() {
              return { items: [], total: 0 };
            },
          },
          export: {
            async run() {
              return { content, filename: "synthetic.csv" };
            },
          },
        },
      },
    );
    await renderNode(records);
    await click("导出");
    expect(createURL).toHaveBeenCalledWith(content);
    expect(downloaded).toEqual([
      { href: "blob:synthetic", filename: "synthetic.csv" },
    ]);
    expect(revokeURL).toHaveBeenCalledWith("blob:synthetic");
  } finally {
    clickAnchor.mockRestore();
    vi.stubGlobal("URL", originalURL);
  }
});

it.each([
  "owner",
  "operation",
  "callback",
  "qualification",
  "node",
  "query",
] as const)("discards a late export after %s changes", async (change) => {
  let release!: (value: { content: Blob; filename: string }) => void;
  const pending = new Promise<{ content: Blob; filename: string }>(
    (resolve) => {
      release = resolve;
    },
  );
  const exportOp = reactive({ disabledReason: "", run: async () => pending });
  const operations = reactive({
    query: {
      async run() {
        return { items: [], total: 0 };
      },
    },
    export: exportOp,
  });
  const records = collection(
    "客户",
    () => object("客户", { id: text("编号") }, { identity: ["id"] }),
    { operations },
  );
  const settings = await renderNode(records);
  const createURL = vi.fn(() => "blob:stale");
  const originalURL = URL;
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createURL;
    },
  );
  try {
    await click("导出");
    if (change === "owner")
      settings.owner = { ledger: "demo", operator: "u", generation: "2" };
    if (change === "operation")
      operations.export = {
        disabledReason: "",
        async run() {
          return pending;
        },
      };
    if (change === "callback") exportOp.run = async () => pending;
    if (change === "qualification") exportOp.disabledReason = "导出撤权";
    if (change === "node")
      settings.navigation.current = {
        node: object("其它", { value: text("值") }),
      };
    if (change === "query") await click("查询");
    await flushPromises();
    release({ content: new Blob(["stale"]), filename: "stale.csv" });
    await flushPromises();
    expect(createURL).not.toHaveBeenCalled();
  } finally {
    vi.stubGlobal("URL", originalURL);
  }
});

it("recovers a create using its original input and dependencies without sending it again", async () => {
  const baseline = reactive({
    concurrency: "original-dependencies",
    identity: ["id"] as const,
  });
  const element = () =>
    object(
      "客户",
      { id: text("编号", { readOnly: true }), name: text("名称") },
      baseline,
    );
  const run = vi.fn(async (_request: unknown) => ({
    status: "unknown" as const,
  }));
  const reconcile = vi.fn(async (request: { requestId: string }) => ({
    status: "not-applied" as const,
    requestId: request.requestId,
    evidence: {
      value: { id: "uncreated", name: "" },
      identity: { id: "uncreated" },
      concurrency: "sealed",
    },
  }));
  const records = collection("客户", element, {
    operations: {
      query: {
        async run() {
          return { items: [], total: 0 };
        },
      },
      create: { run, reconcile },
    },
  });
  let saved: unknown;
  const persistence: NonNullable<ModelApplicationOptions["persistence"]> = {
    async pending() {
      return [];
    },
    async load() {
      return (saved as never) ?? null;
    },
    async save(journal) {
      saved = structuredClone(journal);
    },
    async complete() {},
  };
  await renderNode(records, { persistence });
  await click("新增");
  await input("名称", "冻结的新客户");
  await click("保存");
  const original = structuredClone(run.mock.calls[0]![0]);
  mounted.pop()!.unmount();
  document.body.innerHTML = "";
  baseline.concurrency = "later-dependencies";
  await renderNode(records, { persistence });
  await click("核实本次请求");
  expect(run).toHaveBeenCalledTimes(1);
  expect(reconcile.mock.calls[0]![0]).toEqual(original);
  expect(original).toMatchObject({
    identity: null,
    input: { name: "冻结的新客户" },
    concurrency: "original-dependencies",
  });
});
