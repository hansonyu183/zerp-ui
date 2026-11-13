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
  enumeration,
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
  const button = [
    ...root.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("button,a"),
  ].find(
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
  followNavigation = false,
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
  let check: Parameters<ModelNavigation["guard"]>[0] | undefined;
  const navigation: ModelNavigation = reactive({
    current: { node: customers },
    href: () => "/customers",
    visit: followNavigation
      ? async (node: ModelNode, identity?: unknown) => {
          if (!check || (await check({ node, identity })))
            navigation.current = { node, identity };
        }
      : vi.fn(),
    guard: (guard: Parameters<ModelNavigation["guard"]>[0]) => {
      check = guard;
      return () => {
        if (check === guard) check = undefined;
      };
    },
  });
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
  return {
    wrapper,
    model,
    run,
    row,
    reconcile,
    update,
    settings,
    childRun,
    leave: () => check!(null),
  };
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
      value: { id: null, name: "" },
      identity: null,
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

it.each(["menu", "tree"] as const)(
  "calculates a %s item against the current draft without submitting",
  async (kind) => {
    const run = vi.fn(async (_request: unknown) => ({
      status: "success" as const,
    }));
    const action = vi.fn(
      async ({ input }: { input: { name: string | null } }) => ({
        value: { name: input.name + " · 计算" },
      }),
    );
    const node = object(
      "客户",
      { name: text("名称", { value: "原名称" }) },
      {
        operations: {
          update: { run },
          calculate: {
            async run({ input }) {
              return {
                value: { ...input },
                interactions: [
                  {
                    kind,
                    id: "business-menu",
                    label: "脚本菜单",
                    items: [
                      {
                        key: "calculate",
                        label: "更新名称",
                        target: { kind: "calculate" as const, run: action },
                      },
                    ],
                  },
                ],
              };
            },
          },
        },
      },
    );
    await renderNode(node);
    await click("编辑");
    await input("名称", "未保存的名称");
    await click("更新名称");
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]![0]).toMatchObject({
      input: { name: "未保存的名称" },
      owner: { ledger: "demo", operator: "u", generation: "1" },
    });
    expect(
      document.querySelector<HTMLInputElement>('input[aria-label="名称"]')
        ?.value,
    ).toBe("未保存的名称 · 计算");
    expect(run).not.toHaveBeenCalled();
    await click("保存");
    expect(run.mock.calls[0]![0]).toMatchObject({
      input: { name: "未保存的名称 · 计算" },
    });
  },
);

it.each([
  "owner",
  "node",
  "withdraw",
  "replace",
  "target-callback",
  "operation-callback",
] as const)(
  "rejects a late local calculation after %s changes",
  async (change) => {
    let release!: (value: { value: { name: string | null } }) => void;
    const pending = new Promise<{ value: { name: string | null } }>(
      (resolve) => {
        release = resolve;
      },
    );
    const action = vi.fn(async () => pending);
    const target = reactive({ kind: "calculate" as const, run: action });
    const calculate = reactive({
      disabledReason: "",
      async run({ input }: { input: { name: string | null } }) {
        return {
          value: { ...input },
          interactions: [
            {
              kind: "menu" as const,
              id: "menu",
              label: "菜单",
              items: [
                {
                  key: "calculate",
                  label: "计算",
                  target,
                },
              ],
            },
          ],
        };
      },
    });
    const operations = reactive({
      calculate,
      update: {
        async run() {
          return { status: "success" as const };
        },
      },
    });
    const node = object(
      "客户",
      { name: text("名称", { value: "当前名称" }) },
      { operations },
    );
    const settings = await renderNode(node);
    await click("编辑");
    await click("计算");
    expect(action).toHaveBeenCalledTimes(1);
    if (change === "owner")
      settings.owner = {
        ledger: "other",
        operator: "other",
        generation: "other",
      };
    if (change === "node")
      settings.navigation.current = {
        node: object("其它", { name: text("其它值") }),
      };
    if (change === "withdraw") calculate.disabledReason = "计算已撤权";
    if (change === "replace") operations.calculate = { ...calculate };
    if (change === "target-callback") target.run = vi.fn(async () => pending);
    if (change === "operation-callback") {
      const prior = calculate.run;
      calculate.run = async (ctx) => prior(ctx);
    }
    await flushPromises();
    release({ value: { name: "不应采用的旧计算" } });
    await flushPromises();
    expect(document.body.textContent).not.toContain("不应采用的旧计算");
    expect(
      document.querySelector<HTMLInputElement>('input[aria-label="名称"]')
        ?.value,
    ).not.toBe("不应采用的旧计算");
  },
);

it("redacts raw and JSON-escaped secret input from local calculation errors", async () => {
  const secretValue = 'secret"\\value';
  const node = object(
    "客户",
    { token: secret("令牌") },
    {
      operations: {
        update: {
          async run() {
            return { status: "success" };
          },
        },
        calculate: {
          async run({ input }) {
            return {
              value: { ...input },
              interactions: [
                {
                  kind: "menu",
                  id: "menu",
                  label: "菜单",
                  items: [
                    {
                      key: "calculate",
                      label: "计算",
                      target: {
                        kind: "calculate",
                        async run() {
                          throw Error(
                            `business ${secretValue} ${JSON.stringify(secretValue)}`,
                          );
                        },
                      },
                    },
                  ],
                },
              ],
            };
          },
        },
      },
    },
  );
  await renderNode(node);
  await click("编辑");
  document
    .querySelector<HTMLInputElement>('input[aria-label="令牌"]')!
    .dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  await flushPromises();
  [...document.querySelectorAll<HTMLElement>(".v-list-item")]
    .find((el) => el.textContent?.trim() === "修改")!
    .click();
  await flushPromises();
  await input("新的令牌", secretValue);
  await click("计算");
  expect(document.body.textContent).toContain("business [已隐藏]");
  expect(document.body.textContent).not.toContain(secretValue);
  expect(document.body.textContent).not.toContain(
    JSON.stringify(secretValue).slice(1, -1),
  );
});

it.each(["withdraw", "replace"] as const)(
  "discards a late local calculation error after %s",
  async (change) => {
    let reject!: (error: Error) => void;
    const pending = new Promise<{ value: { name: string | null } }>(
      (_resolve, fail) => {
        reject = fail;
      },
    );
    const calculate = reactive({
      disabledReason: "",
      async run({ input }: { input: { name: string | null } }) {
        return {
          value: input,
          interactions: [
            {
              kind: "menu" as const,
              id: "menu",
              label: "菜单",
              items: [
                {
                  key: "calculate",
                  label: "计算",
                  target: {
                    kind: "calculate" as const,
                    run: async () => pending,
                  },
                },
              ],
            },
          ],
        };
      },
    });
    const operations = reactive({
      calculate,
      update: {
        async run() {
          return { status: "success" as const };
        },
      },
    });
    await renderNode(
      object(
        "客户",
        { name: text("名称", { value: "当前名称" }) },
        { operations },
      ),
    );
    await click("编辑");
    await click("计算");
    if (change === "withdraw") calculate.disabledReason = "已撤权";
    else operations.calculate = { ...calculate };
    reject(Error("不应显示的旧异常"));
    await flushPromises();
    expect(document.body.textContent).not.toContain("不应显示的旧异常");
    const save = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent?.trim() === "保存")!;
    expect(save.disabled).toBe(false);
  },
);

it("retains value-array rows when a calculated draft is saved and reread", async () => {
  let calculations = 0;
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const node = object(
    "客户",
    {
      name: text("名称", { value: "原名" }),
      rows: array("行", () => object("明细", { label: text("内容") }), [
        object("明细", { label: text("内容", { value: "必须保留" }) }),
      ]),
    },
    {
      operations: {
        update: { run },
        calculate: {
          async run({ input }) {
            if (++calculations > 12) throw Error("业务计算未能稳定");
            return {
              value: input,
              interactions: [
                {
                  kind: "menu",
                  id: "menu",
                  label: "菜单",
                  items: [
                    {
                      key: "calculate",
                      label: "整理",
                      target: {
                        kind: "calculate",
                        async run({ input }) {
                          return {
                            value: {
                              ...input,
                              name: "计算名称",
                              rows: [
                                ...input.rows,
                                { label: "新增一" },
                                { label: "新增二" },
                              ],
                            },
                          };
                        },
                      },
                    },
                  ],
                },
              ],
            };
          },
        },
      },
    },
  );
  await renderNode(node);
  await click("编辑");
  await click("整理");
  await click("保存");
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]![0]).toMatchObject({
    input: {
      name: "计算名称",
      rows: [{ label: "必须保留" }, { label: "新增一" }, { label: "新增二" }],
    },
  });
  expect(document.body.textContent).not.toContain("业务计算未能稳定");
});

it("freezes draft answers in an existing record's original request across reload without changing concurrency", async () => {
  let saved: unknown;
  const persistence: NonNullable<ModelApplicationOptions["persistence"]> = {
    pending: async () => [],
    load: async () => (saved as never) ?? null,
    async save(journal) {
      saved = structuredClone(journal);
    },
    async complete() {},
  };
  const run = vi.fn(async (_request: unknown) => ({
    status: "unknown" as const,
  }));
  const reconcile = vi.fn(async (_request: unknown) => ({
    status: "unknown" as const,
  }));
  const record = () =>
    object(
      "客户",
      {
        id: text("编号", { readOnly: true, value: "a" }),
        name: text("名称", { value: "原客户" }),
      },
      {
        identity: ["id"],
        concurrency: "authority-snapshot",
        operations: {
          update: { run, reconcile },
          calculate: {
            async run({ input }) {
              return {
                value: input,
                interactions: [
                  {
                    kind: "confirm" as const,
                    id: "approve",
                    label: "核对业务资料",
                  },
                  { kind: "input" as const, id: "reason", label: "业务原因" },
                ],
              };
            },
          },
        },
      },
    );
  await renderNode(record(), { persistence });
  await click("编辑");
  await input("名称", "已确认客户");
  const confirm = document.querySelector<HTMLInputElement>(
    'input[aria-label="核对业务资料"]',
  )!;
  expect(confirm).toBeTruthy();
  confirm.click();
  await flushPromises();
  await input("业务原因", "合成确认理由");
  document
    .querySelector<HTMLInputElement>('input[aria-label="业务原因"]')!
    .dispatchEvent(new Event("change", { bubbles: true }));
  await flushPromises();
  await click("保存");
  expect(run).toHaveBeenCalledOnce();
  const original = structuredClone(run.mock.calls[0]![0]);
  expect(original).toMatchObject({
    answers: { approve: true, reason: "合成确认理由" },
    concurrency: "authority-snapshot",
    identity: { id: "a" },
  });
  mounted.pop()!.unmount();
  document.body.innerHTML = "";
  await renderNode(record(), { persistence });
  await click("核实本次请求");
  expect(reconcile.mock.calls[0]![0]).toEqual(original);
  expect(run).toHaveBeenCalledOnce();
});

it("projects an actual independent child node and identity into its parent's mounted record", async () => {
  const { row, settings, wrapper } = await fixture();
  settings.navigation.current = { node: row.contacts, identity: { id: "c" } };
  await flushPromises();
  expect(wrapper.text()).toContain("联系人电话");
  expect(wrapper.text()).toContain("100");
  expect(
    document
      .querySelector('[role="tab"][aria-label="联系人"]')
      ?.getAttribute("aria-selected"),
  ).toBe("true");
});

it("updates Router node projections while retaining a parent's unsaved draft across child navigation", async () => {
  const { settings, model, run, childRun, leave } = await fixture(
    false,
    undefined,
    true,
  );
  await click("编辑");
  await input("名称", "父草稿仍在");
  await click("联系人");
  expect(settings.navigation.current?.node).toBe(
    model.customers.items[0]!.contacts,
  );
  expect(document.body.textContent).not.toContain("是否放弃");
  const child = document.querySelector('.zerp-ui[aria-label="联系人"]')!;
  await click("编辑", child);
  expect(settings.navigation.current?.identity).toEqual({ id: "c" });
  await input("联系人电话", "300");
  await click("保存", child);
  await click("基本资料");
  expect(settings.navigation.current?.node).toBe(model.customers);
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="名称"]')!.value,
  ).toBe("父草稿仍在");
  expect(childRun).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
  const leaving = leave();
  await flushPromises();
  expect(document.body.textContent).toContain("是否放弃");
  await click("继续编辑");
  expect(await leaving).toBe(false);
});

it.each([
  ["contact.phone", "含点字面字段"],
  [["contact", "phone"], "嵌套电话字段"],
] as const)(
  "keeps literal and nested dynamic field feedback distinct: %s",
  async (field, label) => {
    const children: Record<string, ModelNode> = {
      "contact.phone": text("含点字面字段", { value: "literal" }),
      contact: object("联系信息", {
        phone: text("嵌套电话字段", { value: "nested" }),
      }),
    };
    const node = object<typeof children, readonly [], readonly []>(
      "动态业务字段",
      children,
      {
        operations: {
          update: {
            async run() {
              return {
                status: "failure" as const,
                message: "业务字段无效",
                fields: [{ field, message: "此业务字段无效" }],
              };
            },
          },
        },
      },
    );
    await renderNode(node);
    await click("编辑");
    await click("保存");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(label);
  },
);

it.each(["root", "child", "embedded-child"] as const)(
  "keeps an external A to B record navigation at its target: %s",
  async (kind) => {
    let check: Parameters<ModelNavigation["guard"]>[0] | undefined;
    function recordCollection<P extends readonly unknown[]>() {
      const row = (id: string) =>
        object(
          "记录",
          {
            id: text("编号", { value: id, readOnly: true }),
            name: text("名称", { value: "记录" + id }),
          },
          {
            identity: ["id"],
            operations: {
              update: {
                async run(
                  _request: ModelRequest<
                    { name: string | null },
                    { id: string },
                    P
                  >,
                ) {
                  return { status: "success" };
                },
              },
            },
          },
        );
      return collection("记录", () => row(""), {
        operations: {
          query: {
            async run() {
              return { items: [row("A"), row("B")], total: 2 };
            },
          },
        },
      });
    }
    const rootRecords = recordCollection<readonly []>();
    const childRecords = recordCollection<readonly [{ id: string }]>();
    const records = kind === "root" ? rootRecords : childRecords;
    const parentFields = {
      id: text("父编号", { value: "p", readOnly: true }),
      name: text("父名称", { value: "父资料" }),
    };
    const parentOperations = {
      identity: ["id"] as const,
      operations: {
        update: {
          async run() {
            return { status: "success" as const };
          },
        },
      },
    };
    const parentRow =
      kind === "embedded-child"
        ? object(
            "父记录",
            {
              ...parentFields,
              details: object("内嵌业务", { records: childRecords }),
            },
            parentOperations,
          )
        : object(
            "父记录",
            { ...parentFields, records: childRecords },
            parentOperations,
          );
    const parents = collection("父记录", () => parentRow, {
      operations: {
        query: {
          async run() {
            return { items: [parentRow], total: 1 };
          },
        },
      },
    });
    const navigation = reactive<ModelNavigation>({
      current: { node: records, identity: { id: "A" } },
      href: () => "/records",
      async visit(node, identity) {
        if (!check || (await check({ node, identity })))
          navigation.current = { node, identity };
      },
      guard(guard) {
        check = guard;
        return () => {
          check = undefined;
        };
      },
    });
    await renderNode(kind === "root" ? records : parents, { navigation });
    await flushPromises();
    expect(document.body.textContent).toContain("记录A");
    await navigation.visit(records, { id: "B" });
    await flushPromises();
    expect(navigation.current?.identity).toEqual({ id: "B" });
    const views = [...document.querySelectorAll('[aria-label="查看资料"]')];
    expect(views.some((view) => view.textContent?.includes("记录B"))).toBe(
      true,
    );
  },
);

it.each(["collection", "fixed"] as const)(
  "projects ordered nested and literal list fields independently of the form for %s queries",
  async (kind) => {
    const element = () =>
      object(
        "主资料",
        {
          id: text("编号", { value: "A1", readOnly: true }),
          "values.name": text("字面字段", { value: "字面内容" }),
          values: object("资料", {
            name: text("嵌套名称", { value: "业务名称" }),
            password: secret("所属秘密", { value: "secret-child" }),
          }),
          password: secret("秘密", { value: "secret-root" }),
        },
        {
          identity: ["id"],
          form: ["values"],
          list: [
            "values.name",
            ["values", "name"],
            "id",
            "password",
            ["values", "password"],
          ],
          operations: {
            update: {
              async run() {
                return { status: "success" };
              },
            },
          },
        },
      );
    const records = collection("主资料", element, {
      operations: {
        query:
          kind === "fixed"
            ? {
                async run() {
                  return {
                    id: "query1",
                    context: "合成",
                    summary: { caption: "合计", values: {} },
                    items: [element()],
                    total: 1,
                  };
                },
                async page() {
                  return { items: [element()], total: 1 };
                },
                async revalidate() {
                  return { status: "valid" };
                },
              }
            : {
                async run() {
                  return { items: [element()], total: 1 };
                },
              },
      },
    });
    await renderNode(records);
    if (kind === "fixed") await click("查询");
    const headings = [...document.querySelectorAll("th")]
      .map((el) => el.textContent?.trim())
      .filter((label) =>
        ["编号", "字面字段", "嵌套名称", "秘密", "所属秘密"].includes(
          label ?? "",
        ),
      );
    expect(headings).toEqual(["字面字段", "嵌套名称", "编号"]);
    const table = document.querySelector("table")!;
    expect(table.textContent).toContain("字面内容");
    expect(table.textContent).toContain("业务名称");
    expect(table.textContent).toContain("A1");
    expect(table.textContent).not.toContain("secret-child");
    expect(table.textContent).not.toContain("secret-root");
    if (kind === "collection") {
      await click("编辑");
      expect(
        document.querySelector('input[aria-label="嵌套名称"]'),
      ).toBeTruthy();
      expect(document.querySelector('input[aria-label="编号"]')).toBeNull();
      expect(document.querySelector('input[aria-label="字面字段"]')).toBeNull();
    }
  },
);

it("selects an ordinary object for the list without admitting its independent children or secrets", async () => {
  const childQuery = vi.fn(async () => ({ items: [], total: 0 }));
  const child = collection(
    "独立子集合",
    () =>
      object(
        "子记录",
        {
          id: text("子编号", { value: "c" }),
        },
        { identity: ["id"] },
      ),
    { operations: { query: { run: childQuery } } },
  );
  const row = () =>
    object(
      "主记录",
      {
        id: text("父编号", { value: "p", readOnly: true }),
        details: object("普通对象", {
          name: text("所属名称", { value: "名称内容" }),
          password: secret("所属秘密", { value: "list-secret" }),
          child,
        }),
      },
      { identity: ["id"], form: ["details"], list: ["id", "details"] },
    );
  await renderNode(
    collection("主记录", row, {
      operations: {
        query: {
          async run() {
            return { items: [row()], total: 1 };
          },
        },
      },
    }),
  );
  expect(
    [...document.querySelectorAll("th")]
      .map((el) => el.textContent?.trim())
      .filter((label) => label && label !== "操作"),
  ).toEqual(["父编号", "所属名称"]);
  expect(document.querySelector("table")?.textContent).toContain("名称内容");
  expect(document.querySelector("table")?.textContent).not.toContain(
    "list-secret",
  );
  expect(childQuery).not.toHaveBeenCalled();
});

it("projects authoritative dynamic fixed-query fields including empty results and enum labels", async () => {
  let current = "before";
  const element = () =>
    object(
      "结果",
      {
        id: text("编号", { value: "row1", readOnly: true }),
        ...(current === "before"
          ? { old: text("旧列", { value: "旧内容" }) }
          : {}),
        ...(current === "after"
          ? {
              amount: decimal("金额", { value: "12.50" }),
              state: enumeration("状态", {
                value: "A",
                options: [{ id: "A", name: "已完成" }],
              }),
            }
          : {}),
        ...(current === "empty"
          ? { empty: text("空结果列", { value: "" }) }
          : {}),
      },
      { identity: ["id"], readOnly: true },
    );
  const records = collection("动态结果", element, {
    operations: {
      query: {
        async run() {
          current = current === "before" ? "after" : "empty";
          return {
            id: current,
            items: current === "empty" ? [] : [element()],
            total: current === "empty" ? 0 : 1,
            context: "合成",
            summary: { caption: "合计", values: {} },
          };
        },
        async page() {
          return { items: [], total: 0 };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
    },
  });
  await renderNode(records);
  await click("查询");
  expect(document.querySelector("table")?.textContent).toContain("金额");
  expect(document.querySelector("table")?.textContent).toContain("12.50");
  expect(document.querySelector("table")?.textContent).toContain("已完成");
  expect(document.querySelector("table")?.textContent).not.toContain("旧列");
  await click("查询");
  expect(document.querySelector("table")?.textContent).toContain("空结果列");
  expect(document.querySelector("table")?.textContent).not.toContain("金额");
});

it("exports the currently adopted fixed result with its original query input", async () => {
  const exported: unknown[] = [];
  let count = 0;
  const filters = object("条件", {
    search: text("关键词", { value: "first" }),
  });
  const element = () =>
    object("记录", { id: text("编号", { value: "1" }) }, { identity: ["id"] });
  const run = vi.fn(async (context: unknown) => {
    exported.push(context);
    throw Error("合成下载中止");
  });
  const records = collection("冻结导出", element, {
    operations: {
      query: {
        input: filters,
        async run() {
          return {
            id: "result-" + ++count,
            items: [element()],
            total: 1,
            context: "合成",
            summary: { caption: "合计", values: {} },
          };
        },
        async page() {
          return { items: [element()], total: 1 };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
      export: { run },
    },
  });
  await renderNode(records);
  await click("查询");
  await input("关键词", "unsubmitted");
  await click("导出");
  expect(exported[0]).toMatchObject({
    resultId: "result-1",
    input: { search: "first" },
  });
  await click("查询");
  await click("导出");
  expect(exported[1]).toMatchObject({
    resultId: "result-2",
    input: { search: "unsubmitted" },
  });
});

it("updates fixed-query columns on a page and on an empty page", async () => {
  let mode = "first";
  const element = () =>
    object(
      "分页记录",
      {
        id: text("编号", { value: mode }),
        ...(mode === "first"
          ? { first: text("首列", { value: "首内容" }) }
          : mode === "second"
            ? { second: text("次列", { value: "次内容" }) }
            : { empty: text("空页列") }),
      },
      { identity: ["id"], readOnly: true },
    );
  const records = collection("动态分页", element, {
    operations: {
      query: {
        async run() {
          return {
            id: "pages",
            items: [element()],
            total: 100,
            context: "合成",
            summary: { caption: "合计", values: { first: "111" } },
          };
        },
        async page({ page }) {
          mode = page === 2 ? "second" : "empty";
          return {
            items: page === 2 ? [element()] : [],
            total: 100,
            summary: {
              caption: "合计",
              values: page === 2 ? { second: "222" } : {},
            },
          };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
    },
  });
  await renderNode(records);
  await click("查询");
  await click("下一页");
  expect(document.querySelector("table")?.textContent).toContain("次列");
  expect(document.querySelector("table")?.textContent).not.toContain("首列");
  await click("下一页");
  expect(document.querySelector("table")?.textContent).toContain("空页列");
  expect(document.querySelector("table")?.textContent).not.toContain("次列");
});

it("keeps the adopted rows and export input when a later query fails result validation", async () => {
  let query = 0;
  const exported: unknown[] = [];
  const filters = object("条件", {
    search: text("关键词", { value: "original" }),
  });
  const element = (name = "original-row") =>
    object(
      "记录",
      {
        id: text("编号", { value: "row" }),
        name: text("名称", { value: name }),
      },
      { identity: ["id"] },
    );
  const records = collection("原结果", element, {
    operations: {
      query: {
        input: filters,
        async run() {
          query++;
          return {
            id: "result-" + query,
            items: [element(query === 1 ? "original-row" : "rejected-row")],
            total: 1,
            context: "合成",
            summary: {
              caption: "合计",
              values: query === 1 ? {} : { wrong: "invalid" },
            },
          };
        },
        async page() {
          return { items: [], total: 0 };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
      export: {
        async run(context) {
          exported.push(context);
          throw Error("合成下载中止");
        },
      },
    },
  });
  await renderNode(records);
  await click("查询");
  await input("关键词", "rejected-input");
  await click("查询");
  await click("导出");
  expect(exported[0]).toMatchObject({
    resultId: "result-1",
    input: { search: "original" },
  });
  expect(document.querySelector("table")?.textContent).toContain(
    "original-row",
  );
  expect(document.querySelector("table")?.textContent).not.toContain(
    "rejected-row",
  );
});

it("rejects an invalid page expiry without replacing the adopted model rows", async () => {
  const element = (name = "original-row") =>
    object(
      "记录",
      {
        id: text("编号", { value: "row" }),
        name: text("名称", { value: name }),
      },
      { identity: ["id"] },
    );
  const records = collection("分页期限", element, {
    operations: {
      query: {
        async run() {
          return {
            id: "result",
            items: [element()],
            total: 100,
            context: "合成",
            summary: { caption: "合计", values: {} },
          };
        },
        async page() {
          return {
            items: [element("rejected-row")],
            total: 100,
            expiresAt: NaN,
          };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
    },
  });
  await renderNode(records);
  await click("查询");
  await click("下一页");
  expect(document.querySelector("table")?.textContent).toContain(
    "original-row",
  );
  expect(document.querySelector("table")?.textContent).not.toContain(
    "rejected-row",
  );
});

it("renders feedback returned by the adopted fixed query", async () => {
  const row = () =>
    object("结果", { id: text("编号", { value: "1" }) }, { identity: ["id"] });
  const records = collection("查询交互", row, {
    operations: {
      query: {
        async run() {
          return {
            id: "one",
            items: [row()],
            total: 1,
            summary: { caption: "", values: {} },
            context: "",
            interactions: [
              {
                kind: "message" as const,
                id: "query-note",
                message: "本次查询业务提示",
              },
            ],
          };
        },
        async page() {
          return { items: [row()], total: 1 };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
    },
  });
  await renderNode(records);
  await click("查询");
  expect(document.body.textContent).toContain("本次查询业务提示");
});

it("keeps adopted query prompts on failure and dispatches typed local calculations with their answers", async () => {
  let fail = false;
  const calculate = vi.fn(
    async (context: {
      input: { keyword: string | null };
      answers: Readonly<Record<string, string | boolean>>;
    }) => ({
      value: { keyword: context.input.keyword + "-computed" },
      interactions: [
        { kind: "message" as const, id: "done", message: "已计算查询条件" },
      ],
    }),
  );
  const filters = object("条件", {
    keyword: text("关键词", { value: "original" }),
  });
  const row = () =>
    object("结果", { id: text("编号", { value: "1" }) }, { identity: ["id"] });
  const records = collection("查询交互", row, {
    operations: {
      query: {
        input: filters,
        async run() {
          if (fail) throw Error("合成查询失败");
          return {
            id: "one",
            items: [row()],
            total: 1,
            summary: { caption: "", values: {} },
            context: "",
            interactions: [
              {
                kind: "confirm" as const,
                id: "query-check",
                label: "已核对查询条件",
              },
              {
                kind: "tree" as const,
                id: "tools",
                label: "查询工具",
                items: [
                  {
                    key: "calculate",
                    label: "计算条件",
                    target: { kind: "calculate" as const, run: calculate },
                  },
                ],
              },
            ],
          };
        },
        async page() {
          return {
            items: [row()],
            total: 1,
            interactions: [
              {
                kind: "message" as const,
                id: "page",
                message: "新分页业务提示",
              },
            ],
          };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
    },
  });
  await renderNode(records);
  await click("查询");
  fail = true;
  await click("查询");
  expect(document.body.textContent).toContain("已核对查询条件");
  document
    .querySelector<HTMLInputElement>('input[aria-label="已核对查询条件"]')!
    .click();
  await flushPromises();
  await click("计算条件");
  expect(calculate).toHaveBeenCalledTimes(1);
  expect(calculate.mock.calls[0]![0]).toMatchObject({
    input: { keyword: "original" },
    answers: { "query-check": true },
  });
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="关键词"]')!
      .value,
  ).toBe("original-computed");
  expect(document.body.textContent).toContain("已计算查询条件");
  expect(document.body.textContent).not.toContain("已核对查询条件");
});

it("removes expired result prompts without blocking a fresh query", async () => {
  vi.useFakeTimers();
  try {
    const row = () =>
      object(
        "结果",
        { id: text("编号", { value: "1" }) },
        { identity: ["id"] },
      );
    let count = 0;
    const records = collection("查询交互", row, {
      operations: {
        query: {
          async run() {
            return {
              id: String(++count),
              items: [row()],
              total: 1,
              expiresAt: Date.now() + 2000,
              summary: { caption: "", values: {} },
              context: "",
              interactions: [
                {
                  kind: "confirm" as const,
                  id: "required",
                  label: "核对已采用结果",
                  required: true,
                },
              ],
            };
          },
          async page() {
            return { items: [row()], total: 1 };
          },
          async revalidate() {
            return { status: "valid" };
          },
        },
      },
    });
    await renderNode(records);
    await click("查询");
    expect(document.body.textContent).toContain("核对已采用结果");
    await vi.advanceTimersByTimeAsync(2200);
    await flushPromises();
    expect(document.body.textContent).not.toContain("核对已采用结果");
    const query = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.trim() === "查询")!;
    expect(query.disabled).toBe(false);
    await click("查询");
    expect(count).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});

it("discards a late result calculation after its owner changes", async () => {
  let complete!: (value: { value: { keyword: string | null } }) => void;
  const filters = object("条件", {
    keyword: text("关键词", { value: "original" }),
  });
  const row = () =>
    object("结果", { id: text("编号", { value: "1" }) }, { identity: ["id"] });
  const records = collection("查询交互", row, {
    operations: {
      query: {
        input: filters,
        async run() {
          return {
            id: "one",
            items: [row()],
            total: 1,
            summary: { caption: "", values: {} },
            context: "",
            interactions: [
              {
                kind: "menu" as const,
                id: "tools",
                label: "业务工具",
                items: [
                  {
                    key: "late",
                    label: "延迟计算",
                    target: {
                      kind: "calculate" as const,
                      run: () =>
                        new Promise<{ value: { keyword: string | null } }>(
                          (resolve) => {
                            complete = resolve;
                          },
                        ),
                    },
                  },
                ],
              },
            ],
          };
        },
        async page() {
          return { items: [row()], total: 1 };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
    },
  });
  const settings = await renderNode(records);
  await click("查询");
  await click("延迟计算");
  settings.owner = { ...settings.owner!, generation: "later" };
  await flushPromises();
  complete({ value: { keyword: "late-other-owner" } });
  await flushPromises();
  expect(filters.keyword.value).toBe("original");
  expect(document.body.textContent).not.toContain("延迟计算");
});

it("adopts page interactions together with the new fixed page", async () => {
  const row = () =>
    object("结果", { id: text("编号", { value: "1" }) }, { identity: ["id"] });
  const records = collection("查询交互", row, {
    operations: {
      query: {
        async run() {
          return {
            id: "one",
            items: [row()],
            total: 21,
            summary: { caption: "", values: {} },
            context: "",
            interactions: [
              { kind: "message" as const, id: "first", message: "第一页提示" },
            ],
          };
        },
        async page() {
          return {
            items: [row()],
            total: 21,
            interactions: [
              { kind: "message" as const, id: "second", message: "第二页提示" },
            ],
          };
        },
        async revalidate() {
          return { status: "valid" };
        },
      },
    },
  });
  await renderNode(records);
  await click("查询");
  expect(document.body.textContent).toContain("第一页提示");
  await click("下一页");
  expect(document.body.textContent).toContain("第二页提示");
  expect(document.body.textContent).not.toContain("第一页提示");
});
