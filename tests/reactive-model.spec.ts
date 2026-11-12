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
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<span />" } }],
  });
  await router.push("/customers");
  await router.isReady();
  const wrapper = mount(BusinessApplication, {
    attachTo: document.body,
    props: { model },
    global: { plugins: [router] },
  });
  mounted.push(wrapper);
  await flushPromises();
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
  settings.owner.generation = "2";
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
