import { route } from "./fixtures/static-host";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/index";
import { domainOf, field } from "./fixtures/static-model";
import type { BusinessModel, ObjectNode, ListCollection } from "../src/model";
enableAutoUnmount(afterEach);
const operation = (run = vi.fn(async () => {})) => ({
  disabled: false,
  run,
});
function object(key: string, label = key): ObjectNode {
  return {
    kind: "object",
    businessType: key,
    family: "standard",
    key,
    label,
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  };
}
function fixture() {
  const query = operation();
  const collection: ListCollection = {
    key: "customers",
    label: "客户",
    columns: [{ key: "code", label: "编号" }],
    conditions: object("conditions", "条件"),
    items: [],
    selected: null,
    draft: null,
    page: 1,
    pageSize: 20,
    total: 0,
    operations: { query },
  };
  const owner = { ledger: "synthetic", operator: "tester", generation: "1" };
  const model = reactive<BusinessModel>({
    kind: "application",
    label: "合成应用",
    brand: { productName: "合成", companyName: "测试" },
    authentication: {
      form: object("login", "登录"),
      operations: { signIn: operation(), recover: operation() },
    },
    session: {
      state: "ready",
      owner,
    },
    work: {
      members: [domainOf(collection)],
      account: {
        label: "测试用户",
        profile: object("profile", "个人资料"),
        password: object("password", "修改密码"),
        operations: { changePassword: operation(), signOut: operation() },
      },
    },
    messages: [],
  });
  return { model, collection: reactive(collection), query: query.run };
}
it("shows declared columns for an empty collection without querying the first authorized collection", async () => {
  const { model, collection, query } = fixture();
  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  expect(wrapper.findAll("th").map((x) => x.text())).toContain("编号");
  expect(query).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/business/" + collection.key);
  wrapper.unmount();
});
it("reads the selected record only after the user opens its window", async () => {
  const { model, collection, query } = fixture();
  const record = object("customer", "合成详情");
  record.identity = "c1";
  record.load = vi.fn(async () => {});
  collection.items = [record];
  collection.total = 1;
  collection.selected = record;
  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  expect(query).not.toHaveBeenCalled();
  expect(record.load).not.toHaveBeenCalled();
  await wrapper.get('button[aria-label="查看"]').trigger("click");
  expect(wrapper.get('[role="dialog"]').text()).toContain("合成详情");
  expect(record.load).toHaveBeenCalledExactlyOnceWith("c1");
  wrapper.unmount();
});

it("keeps the same root through anonymous authentication and hides business collections during session recovery", async () => {
  const { model, query } = fixture();
  model.session = { state: "anonymous", owner: null };
  model.authentication.form.members = [
    {
      kind: "password",
      key: "password",
      label: "密码",
      value: "",
      readOnly: false,
      required: true,
    },
    field("user", "账号", ""),
    {
      kind: "reference",
      key: "ledger",
      label: "账套",
      value: null,
      readOnly: false,
      required: false,
      multiple: false,
      options: [],
    },
    object("child", "业务区块"),
  ];
  const signIn = vi.fn(async () => {
    const owner = { ledger: "synthetic", operator: "next", generation: "2" };
    model.session = {
      state: "ready",
      owner,
    };
  });
  model.authentication.operations.signIn.run = signIn;
  const wrapper = mount(App, { props: { model }, attachTo: document.body });
  await flushPromises();
  expect(wrapper.findAll("th")).toHaveLength(0);
  expect(query).not.toHaveBeenCalled();
  const form = wrapper.get("form");
  expect(
    form
      .findAll("input[aria-label]")
      .map((input) => input.attributes("aria-label")),
  ).toEqual(["账套", "账号", "密码"]);
  expect(form.text()).not.toContain("业务区块");
  model.authentication.operations.signIn.disabled = true;
  await flushPromises();
  expect(form.find('button[type="submit"]').exists()).toBe(false);
  await form.trigger("submit");
  expect(signIn).not.toHaveBeenCalled();
  model.authentication.operations.signIn.disabled = false;
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "登录")!
    .trigger("click");
  await flushPromises();
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(window.location.pathname).toBe("/business/customers");
  expect(wrapper.findAll("th").map((x) => x.text())).toContain("编号");
  model.session = { state: "recovering", owner: null };
  await flushPromises();
  expect(wrapper.findAll("th")).toHaveLength(0);
  expect(wrapper.find('form button[type="submit"]').exists()).toBe(false);
  wrapper.unmount();
});
it("updates collection readability without deleting structure", async () => {
  const { model, collection } = fixture();
  collection.readable = false;
  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  expect(wrapper.findAll("th")).toHaveLength(0);
  collection.readable = true;
  await flushPromises();
  expect(wrapper.findAll("th").map((x) => x.text())).toContain("编号");
  expect(model.work.members[0]).toMatchObject({
    members: [collection],
  });
  wrapper.unmount();
});
it("loads the workbench once per session and retries only on request", async () => {
  const { model, collection } = fixture();
  const records = (key: string) => ({
    kind: "records" as const,
    key,
    label: key,
    readOnly: true,
    items: [],
    selected: null,
    operations: {},
  });
  const load = vi.fn(async () => {
    throw Error("offline");
  });
  model.work.workbench = {
    key: "home",
    label: "工作台",
    load,
    information: records("重要信息"),
    vouchers: records("单据"),
    reports: records("报表"),
    masters: records("资料"),
  };
  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(1);
  expect(wrapper.text()).toContain("操作失败");
  route(collection);
  await flushPromises();
  route(null);
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(1);
  const session = model.session;
  model.session = { state: "recovering", owner: null };
  await flushPromises();
  model.session = session;
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(2);
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "刷新")!
    .trigger("click");
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(3);
  expect(wrapper.text()).toContain("操作失败");
  wrapper.unmount();
});
it("reserves synchronous operations without showing pending and guards later async runs", async () => {
  const { model, collection } = fixture();
  let button: HTMLButtonElement;
  let localPending = true;
  const local = vi.fn(() => {
    if (local.mock.calls.length === 1) button.click();
    void nextTick(() => {
      localPending = button.disabled;
    });
  });
  collection.operations.export = { disabled: false, run: local };

  const wrapper = mount(App, { props: { model }, attachTo: document.body });
  await flushPromises();
  const exportButton = () =>
    wrapper.findAll("button").find((item) => item.text() === "导出")!;
  button = exportButton().element as HTMLButtonElement;
  await exportButton().trigger("click");
  await flushPromises();
  expect(local).toHaveBeenCalledTimes(1);
  expect(localPending).toBe(false);

  const release: Array<() => void> = [];
  const remote = vi.fn(
    () => new Promise<void>((resolve) => release.push(resolve)),
  );
  collection.operations.export.run = remote;
  await exportButton().trigger("click");
  expect((exportButton().element as HTMLButtonElement).disabled).toBe(true);
  await exportButton().trigger("click");
  expect(remote).toHaveBeenCalledTimes(1);

  model.session = {
    state: "ready",
    owner: { ledger: "synthetic", operator: "tester", generation: "2" },
  };
  await flushPromises();
  await exportButton().trigger("click");
  expect(remote).toHaveBeenCalledTimes(2);
  release[0]!();
  await flushPromises();
  expect((exportButton().element as HTMLButtonElement).disabled).toBe(true);
  release[1]!();
  await flushPromises();
  expect((exportButton().element as HTMLButtonElement).disabled).toBe(false);
});

it("edits the selected record directly, preserves failed input, and prevents disabled or duplicate saves", async () => {
  const { model, collection } = fixture();
  const row = object("customer", "客户详情");
  row.identity = "c1";
  row.printable = true;
  row.members = [
    {
      kind: "text",
      key: "code",
      label: "编号",
      readOnly: false,
      required: true,
      value: "before",
    },
  ];
  let release: () => void = () => {};
  const update = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        release = () => reject(Error("rejected"));
      }),
  );
  row.operations.update = { disabled: false, run: update };
  collection.items = [row];
  collection.selected = row;
  collection.total = 1;
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('button[aria-label="编辑"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  collection.selected!.operations.update!.disabled = true;
  await flushPromises();
  const input = dialog.get('input[aria-label="编号"]');
  await input.setValue("changed");
  expect((collection.selected!.members[0] as { value: string }).value).toBe(
    "changed",
  );
  const save = () =>
    dialog.findAll("button").find((button) => button.text() === "保存");
  expect(save()).toBeUndefined();
  expect(dialog.text()).toContain("当前无法保存。");
  expect(update).not.toHaveBeenCalled();
  collection.selected!.operations.update!.disabled = false;
  await flushPromises();
  expect(dialog.text()).not.toContain("当前无法保存。");
  await save()!.trigger("click");
  await save()!.trigger("click");
  expect(update).toHaveBeenCalledTimes(1);
  release();
  await flushPromises();
  expect((input.element as HTMLInputElement).value).toBe("changed");
  expect(wrapper.text()).toContain("操作失败");
  wrapper.unmount();
});
it("hides null-label detail nodes while preserving explicit list columns and ordered Material groups", async () => {
  const { model, collection } = fixture();
  const row = object("customer", "客户详情");
  row.identity = "c1";
  row.printable = true;
  const hidden = {
    kind: "text" as const,
    key: "code",
    label: "编号",
    readOnly: false,
    required: false,
    readable: false,
    value: "hidden-column",
  };
  const first = object("first", "第一组"),
    second = object("second", "第二组");
  first.members = [
    {
      kind: "text",
      key: "one",
      label: "字段一",
      readOnly: false,
      required: false,
      value: "one",
    },
  ];
  second.members = [
    {
      kind: "text",
      key: "two",
      label: "字段二",
      readOnly: false,
      required: false,
      value: "two",
    },
  ];
  row.members = [hidden, first, second];
  collection.items = [row];
  collection.selected = row;
  collection.total = 1;
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('button[aria-label="查看"]').trigger("click");
  await flushPromises();
  expect(wrapper.get("table").text()).not.toContain("hidden-column");
  const dialog = wrapper.get('[role="dialog"]');
  expect(
    dialog.findAll("input").map((input) => input.attributes("aria-label")),
  ).not.toContain("编号");
  const tabs = dialog.findAll('[role="tab"]');
  expect(tabs.map((tab) => tab.text())).toEqual(["第一组", "第二组"]);
  (tabs[0]!.element as HTMLElement).focus();
  await tabs[0]!.trigger("keydown", { key: "ArrowRight" });
  await flushPromises();
  expect(tabs[1]!.attributes("aria-selected")).toBe("true");
  collection.selected!.members = [first];
  await flushPromises();
  expect(dialog.find('[role="tablist"]').exists()).toBe(false);
  collection.selected!.members = [];
  await flushPromises();
  expect(dialog.find('[role="tablist"]').exists()).toBe(false);
  wrapper.unmount();
});
it("suppresses stale query feedback after a session change and lets the consumer reject old writes", async () => {
  const { model, collection } = fixture();
  let rejectOld: (reason: Error) => void = () => {};
  const owner = model.session.owner!;
  collection.operations.query!.run = vi.fn(async () => {
    if (model.session.owner !== owner) return;
    const pending = new Promise<void>((_, reject) => {
      rejectOld = reject;
    });
    await pending;
    if (model.session.owner !== owner) return;
    collection.total = 99;
  });
  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "查询")!
    .trigger("click");
  expect(collection.operations.query!.run).toHaveBeenCalledTimes(1);
  const nextOwner = { ledger: "synthetic", operator: "other", generation: "2" };
  model.session = {
    state: "ready",
    owner: nextOwner,
  };
  await flushPromises();
  rejectOld(Error("old failure"));
  await flushPromises();
  expect(wrapper.text()).not.toContain("操作失败");
  expect(collection.total).toBe(0);
  wrapper.unmount();
});
it("edits owned detail rows in a compact desktop table and saves through the parent boundary only", async () => {
  const { model, collection } = fixture();
  const parent = object("customer", "客户详情");
  parent.identity = "c1";
  parent.printable = true;
  const child = object("line", "明细");
  child.identity = "l1";
  child.printable = true;
  child.members = [
    {
      kind: "text",
      key: "name",
      label: "名称",
      readOnly: false,
      required: false,
      value: "原值",
    },
  ];
  const save = vi.fn(async (_record: ObjectNode) => {});
  parent.operations.update = { disabled: false, run: save };
  parent.members = [
    {
      kind: "records",
      key: "lines",
      label: "联系明细",
      readOnly: false,
      items: [child],
      selected: null,
      operations: { create: operation(), remove: operation() },
    },
  ];
  collection.items = [parent];
  collection.selected = parent;
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('button[aria-label="编辑"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  expect(dialog.findAll("th").map((header) => header.text())).toContain("名称");
  await dialog.get('input[aria-label="名称"]').setValue("修改后");
  expect(child.members[0]).toMatchObject({ value: "修改后" });
  expect(save).not.toHaveBeenCalled();
  await dialog
    .findAll("button")
    .find((button) => button.text() === "保存")!
    .trigger("click");
  await flushPromises();
  expect(save).toHaveBeenCalledExactlyOnceWith(collection.selected);
  expect(
    (
      (collection.selected!.members[0] as { items: ObjectNode[] }).items[0]!
        .members[0] as { value: string }
    ).value,
  ).toBe("修改后");
  wrapper.unmount();
});
it("discards failure feedback when a pending operation is replaced on the same business record", async () => {
  const { model, collection } = fixture();
  const row = object("customer", "客户详情");
  row.identity = "c1";
  row.printable = true;
  let rejectOld: (reason: Error) => void = () => {};
  row.operations.update = operation(
    vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectOld = reject;
        }),
    ),
  );
  collection.items = [row];
  collection.selected = row;
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('button[aria-label="编辑"]').trigger("click");
  await flushPromises();
  await wrapper
    .get('[role="dialog"]')
    .findAll("button")
    .find((button) => button.text() === "保存")!
    .trigger("click");
  collection.selected!.operations.update = operation();
  rejectOld(Error("obsolete"));
  await flushPromises();
  expect(wrapper.text()).not.toContain("操作失败");
  wrapper.unmount();
});
it("opens processing-only records for direct input and executes supplied actions without a manufactured update", async () => {
  const { model, collection } = fixture();
  const row = object("process", "处理");
  row.identity = "p1";
  row.printable = true;
  row.members = [
    {
      kind: "text",
      key: "code",
      label: "编号",
      readOnly: false,
      required: true,
      value: "before",
    },
  ];
  const process = vi.fn(async () => {}),
    validate = vi.fn(async () => {});
  row.processing = {
    operations: { process: operation(process), validate: operation(validate) },
  };
  collection.items = [row];
  collection.total = 1;
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  expect(wrapper.find('button[aria-label="编辑"]').exists()).toBe(false);
  await wrapper.get('button[aria-label="查看"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  const input = dialog.get('input[aria-label="编号"]');
  expect(input.attributes("readonly")).toBeUndefined();
  await input.setValue("edited");
  expect((collection.selected!.members[0] as { value: string }).value).toBe(
    "edited",
  );
  expect(
    dialog.findAll("button").some((button) => button.text() === "保存"),
  ).toBe(false);
  await dialog
    .findAll("button")
    .find((button) => button.text() === "处理")!
    .trigger("click");
  await flushPromises();
  expect(process).toHaveBeenCalledTimes(1);
  expect(validate).not.toHaveBeenCalled();
  wrapper.unmount();
});
it("reports a missing explicit column member with a stable collection, record, and field location", async () => {
  const { model, collection } = fixture();
  const row = object("customer", "客户详情");
  row.identity = "missing-1";
  row.printable = true;
  collection.items = [row];
  collection.total = 1;
  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  expect(wrapper.text()).toContain(
    "客户 / missing-1 / code：列引用的成员不存在",
  );
  expect(wrapper.get("table").text()).toContain("编号");
  wrapper.unmount();
});
it("lets a readonly collection user enter query criteria while preserving narrower field write restrictions", async () => {
  const { model, collection } = fixture();
  collection.conditions.members = [
    {
      kind: "text",
      key: "name",
      label: "查询名称",
      readOnly: false,
      required: false,
      value: "",
    },
  ];

  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  const input = wrapper.get('input[aria-label="查询名称"]');
  expect(input.attributes("readonly")).toBeUndefined();
  await input.setValue("客户");
  expect((collection.conditions.members[0] as { value: string }).value).toBe(
    "客户",
  );
  collection.conditions.members[0]!.readOnly = true;
  await flushPromises();
  expect(input.attributes("readonly")).toBeDefined();
  wrapper.unmount();
});
it("uses the framework homepage URL and preserves modified links", async () => {
  const { model, collection } = fixture();
  const records = (key: string) => ({
    kind: "records" as const,
    key,
    label: key,
    readOnly: true,
    items: [],
    selected: null,
    operations: {},
  });
  model.work.workbench = {
    key: "home",
    label: "工作台",
    information: records("重要信息"),
    vouchers: records("单据"),
    reports: records("报表"),
    masters: records("资料"),
  };
  route(collection);
  const wrapper = mount(App, { props: { model } });
  await flushPromises();
  const home = wrapper.get('a[aria-label="合成：首页"]');
  expect(home.attributes("href")).toBe("/");
  const workbench = wrapper.get('nav a[href="/"]');
  expect(workbench.text()).toContain("工作台");
  expect(wrapper.findAll("nav a")[0]!.element).toBe(workbench.element);
  await workbench.trigger("click", { ctrlKey: true });
  expect(window.location.pathname).toBe("/business/customers");
  await workbench.trigger("click");
  await flushPromises();
  expect(window.location.pathname).toBe("/");
  expect(workbench.attributes("aria-current")).toBe("page");
  route(collection);
  await flushPromises();
  await home.trigger("click", { ctrlKey: true });
  expect(window.location.pathname).toBe("/business/customers");
  expect(window.location.pathname).toBe("/business/" + collection.key);
  await home.trigger("click");
  await flushPromises();
  expect(window.location.pathname).toBe("/");
  expect(wrapper.text()).toContain("重要信息");
  wrapper.unmount();
});
it("keeps qualified workflow row actions directly visible while ordinary actions retain the three-item limit", async () => {
  const { model, collection } = fixture();
  const row = object("workflow", "流程");
  row.identity = "w1";
  row.printable = true;
  row.members = [
    {
      kind: "text",
      key: "code",
      label: "编号",
      readOnly: false,
      required: false,
      value: "w1",
    },
  ];
  const start = operation(),
    advance = operation(),
    approveChild = operation(),
    rejectChild = operation();
  row.workflow = { operations: { start, advance, approveChild, rejectChild } };
  collection.items = [row];
  collection.total = 1;
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  for (const label of ["启动", "推进", "批准子项", "拒绝子项"])
    expect(
      wrapper.get("table").find(`button[aria-label="${label}"]`).exists(),
    ).toBe(true);
  await wrapper
    .get("table")
    .get('button[aria-label="批准子项"]')
    .trigger("click");
  await flushPromises();
  expect(approveChild.run).toHaveBeenCalledTimes(1);
  collection.items[0]!.workflow = undefined;
  collection.items[0]!.processing = {
    operations: {
      process: operation(),
      validate: operation(),
      run: operation(),
      stop: operation(),
    },
  };
  await flushPromises();
  const labels = wrapper
    .get("table")
    .findAll("button[aria-label]")
    .map((button) => button.attributes("aria-label"));
  expect(
    labels.filter(
      (label) =>
        label !== undefined &&
        ["查看", "处理", "校验", "运行", "停止"].includes(label),
    ),
  ).toHaveLength(3);
  wrapper.unmount();
});
it("keeps an unprintable record detail quiet until printing is available", async () => {
  const { model, collection } = fixture();
  const row = object("external", "外部记录");
  row.identity = "external-1";
  row.printable = false;
  row.readOnly = true;
  row.members = [
    {
      kind: "text",
      key: "code",
      label: "编号",
      readOnly: true,
      required: false,
      value: "outside",
    },
  ];
  collection.selected = row;
  model.messages.push({
    id: "open",
    level: "warning",
    text: "查看外部记录",
    target: row,
  });
  collection.itemPrintTemple = {
    label: "记录打印",
    page: { width: 100, height: 100, margin: 5 },
    header: { height: 0, items: [] },
    footer: { height: 0, items: [] },
    body: [
      {
        kind: "record",
        height: 20,
        items: [
          {
            kind: "field",
            key: "code",
            path: ["code"],
            x: 0,
            y: 0,
            width: 20,
            height: 10,
          },
        ],
      },
    ],
  };
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('[aria-label="页面消息"] button').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  expect(dialog.text()).not.toContain("尚未确认保存");
  expect(
    dialog.findAll("button").some((button) => button.text() === "单条打印"),
  ).toBe(false);
  collection.selected!.printable = true;
  await flushPromises();
  expect(
    dialog.findAll("button").some((button) => button.text() === "单条打印"),
  ).toBe(true);
  expect(collection.items).toHaveLength(0);
  wrapper.unmount();
});
it("captures report scroll before navigation clears the old page and restores it without querying", async () => {
  const { model, collection, query } = fixture();
  collection.report = {};
  route(collection);
  const other: ListCollection = {
    ...collection,
    key: "other",
    label: "其他",
    conditions: object("other-conditions", "条件"),
    report: undefined,
  };
  model.work.members.push(domainOf(other));
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const descriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  const frame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  const wrapper = mount(App, { props: { model } });
  try {
    await flushPromises();
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 640,
    });
    route(other);
    await flushPromises();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    route(collection);
    await flushPromises();
    expect(scroll).toHaveBeenLastCalledWith(0, 640);
    expect(query).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    scroll.mockRestore();
    globalThis.requestAnimationFrame = frame;
    if (descriptor) Object.defineProperty(window, "scrollY", descriptor);
  }
});
it("keeps authorized preview and print reachable from a read-only output view while hiding write confirmations", async () => {
  const { model, collection } = fixture();
  const row = object("output", "输出");
  row.identity = "o1";
  row.printable = true;
  row.readOnly = true;
  const output: import("../src/model").OutputNode = {
    kind: "output",
    key: "preview",
    label: "输出预览",
    readOnly: true,
    value: null,
    operations: {
      print: operation(),
      confirmPrinted: { ...operation(), disabled: true },
    },
  };
  row.members = [output];
  row.output = {
    operations: {
      preview: operation(
        vi.fn(async () => {
          const current = collection.items[0]!
            .members[0] as import("../src/model").OutputNode;
          current.value = {
            id: "o1",
            title: "合成输出",
            width: 100,
            height: 100,
            pages: [{ key: "p1", items: [] }],
          };
        }),
      ),
    },
  };
  collection.items = [row];
  collection.total = 1;
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get("table").get('button[aria-label="查看"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  const preview = dialog
    .findAll("button")
    .find((button) => button.text() === "预览");
  expect(preview).toBeDefined();
  await preview!.trigger("click");
  await flushPromises();
  expect(dialog.find("iframe").exists()).toBe(true);
  const previewFrame = dialog.get("iframe").element as HTMLIFrameElement;
  Object.defineProperty(previewFrame.contentDocument!, "fonts", {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
  await dialog.get("iframe").trigger("load");
  await flushPromises();
  expect(
    dialog.findAll("button").some((button) => button.text() === "确认已打印"),
  ).toBe(false);
  const print = dialog
    .findAll("button")
    .find((button) => button.text() === "打开打印窗口");
  expect(print).toBeDefined();
  expect(print!.attributes("disabled")).toBeUndefined();
  wrapper.unmount();
});
it("updates nested output confirmation from its operation availability", async () => {
  const { model, collection } = fixture();
  const row = object("output", "输出");
  row.identity = "o1";
  row.printable = true;
  const confirmed = reactive(operation()),
    notPrinted = operation();
  const output: import("../src/model").OutputNode = {
    kind: "output",
    key: "preview",
    label: "输出预览",
    readOnly: false,
    value: null,
    operations: {
      print: operation(),
      confirmPrinted: confirmed,
      confirmNotPrinted: notPrinted,
    },
  };
  row.members = [output];
  row.output = {
    operations: {
      preview: operation(
        vi.fn(async () => {
          const node = collection.items[0]!
            .members[0] as import("../src/model").OutputNode;
          node.value = {
            id: "o1",
            title: "合成输出",
            width: 100,
            height: 100,
            pages: [{ key: "p1", items: [] }],
          };
        }),
      ),
    },
  };
  collection.items = [row];
  collection.total = 1;

  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get("table").get('button[aria-label="查看"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  const confirmation = () =>
    dialog.findAll("button").find((button) => button.text() === "确认已打印");
  expect(confirmation()).toBeDefined();
  await dialog
    .findAll("button")
    .find((button) => button.text() === "预览")!
    .trigger("click");
  await flushPromises();
  const previewFrame = dialog.get("iframe").element as HTMLIFrameElement;
  Object.defineProperty(previewFrame.contentDocument!, "fonts", {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
  await dialog.get("iframe").trigger("load");
  await flushPromises();
  expect(confirmed.run).not.toHaveBeenCalled();
  expect(notPrinted.run).not.toHaveBeenCalled();
  await confirmation()!.trigger("click");
  await flushPromises();
  expect(confirmed.run).toHaveBeenCalledTimes(1);
  confirmed.disabled = true;
  await flushPromises();
  expect(confirmation()).toBeUndefined();
  confirmed.disabled = false;
  await flushPromises();
  expect(confirmation()).toBeDefined();
  wrapper.unmount();
});
it("keeps a nested object own update boundary editable from a view-only parent without granting business read-only overrides", async () => {
  const { model, collection } = fixture();
  const parent = object("parent", "父对象");
  parent.identity = "p1";
  const child = object("child", "子对象");
  child.identity = "nested-1";
  const direct = {
    kind: "text" as const,
    key: "code",
    label: "父字段",
    readOnly: false,
    required: false,
    value: "parent",
  };
  const nested = {
    kind: "text" as const,
    key: "nested",
    label: "子字段",
    readOnly: false,
    required: false,
    value: "child",
  };
  child.members = [nested];
  const update = vi.fn(async (_record: ObjectNode) => {});
  child.operations.update = { disabled: false, run: update };
  parent.members = [direct, child];
  collection.items = [parent];
  collection.selected = parent;
  collection.total = 1;

  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('button[aria-label="查看"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  expect(
    dialog.get('input[aria-label="父字段"]').attributes("readonly"),
  ).toBeDefined();
  expect(
    dialog.get('input[aria-label="子字段"]').attributes("readonly"),
  ).toBeUndefined();
  await dialog.get('input[aria-label="子字段"]').setValue("changed");
  await dialog
    .findAll("button")
    .find((button) => button.text() === "保存")!
    .trigger("click");
  await flushPromises();
  expect(update).toHaveBeenCalledTimes(1);
  expect((collection.selected!.members[0] as { value: string }).value).toBe(
    "parent",
  );
  expect(collection.selected!.operations.update).toBeUndefined();
  const currentChild = collection.selected!.members[1] as ObjectNode;
  expect(update).toHaveBeenCalledWith(currentChild);
  expect((currentChild.members[0] as { value: string }).value).toBe("changed");
  currentChild.readOnly = true;
  currentChild.operations.update!.disabled = true;
  await flushPromises();
  expect(
    dialog.get('input[aria-label="子字段"]').attributes("readonly"),
  ).toBeDefined();
  expect(
    dialog.findAll("button").some((button) => button.text() === "保存"),
  ).toBe(false);
  currentChild.readOnly = false;
  collection.selected!.readOnly = true;
  await flushPromises();
  expect(
    dialog.get('input[aria-label="子字段"]').attributes("readonly"),
  ).toBeDefined();
  wrapper.unmount();
});
it("projects known finite domain icons and renders other domains as text links", async () => {
  const { model, collection } = fixture();
  model.work.members[0] = { ...domainOf(collection), icon: "catalog" };
  const unknown: ListCollection = {
    ...collection,
    key: "custom",
    label: "未知业务",
    conditions: object("custom-conditions"),
    items: [],
  };
  model.work.members.push(domainOf(unknown));
  const wrapper = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  const knownLink = wrapper
    .findAll("a")
    .find((link) => link.text().endsWith("客户"))!;
  const unknownLink = wrapper
    .findAll("a")
    .find((link) => link.text() === "未知业务")!;
  expect(knownLink.find(".zerp-ui-icon").text()).toBe("\u{F0219}");
  expect(unknownLink.exists()).toBe(true);
  expect(unknownLink.find(".zerp-ui-icon").exists()).toBe(false);
  wrapper.unmount();
});

it("displays scalar summary values and opens a target from the exact readable report cell", async () => {
  const { model, collection } = fixture();
  const record = object("customer", "报表详情");
  record.identity = "c1";
  record.members = [
    field("code", "编号", "C1"),
    { ...field("hidden", "隐藏列", "secret"), readable: false },
    {
      kind: "decimal",
      key: "amount",
      label: "金额",
      value: "0",
      readOnly: false,
      required: false,
    },
    {
      kind: "boolean",
      key: "approved",
      label: "已审批",
      value: false,
      readOnly: false,
    },
  ];
  collection.items = [record];
  collection.total = 1;
  collection.columns = [
    { key: "code", label: "编号" },
    { key: "amount", label: "金额" },
    { key: "approved", label: "已审批" },
  ];
  const target = { collection, record };
  collection.report = {
    summary: {
      caption: "合计",
      values: { code: undefined, amount: 0, approved: false },
    },
    presentation: {
      rows: [{ rowId: "previous-page", appearance: { bold: true } }],
      groups: [
        {
          id: "previous-group",
          label: "缺失边界的小计",
          level: 0,
          firstKey: "previous-page",
          lastKey: "c1",
          continuedBefore: false,
          continuedAfter: false,
          summary: { caption: "忽略该小计", values: { amount: 99 } },
        },
      ],
    },
    cells: [
      {
        row: record,
        field: "hidden",
        kind: "detail",
        target,
        label: "隐藏详情",
        disabled: false,
      },
      {
        row: record,
        field: "code",
        kind: "detail",
        target,
        label: "查看报表详情",
        disabled: false,
      },
    ],
  };
  const wrapper = mount(App, { props: { model }, attachTo: document.body });
  await flushPromises();
  expect(wrapper.get("tfoot").attributes("aria-label")).toBe("合计");
  expect(wrapper.findAll("tfoot td").map((cell) => cell.text())).toEqual([
    "—",
    "",
    "0",
    "false",
  ]);
  expect(wrapper.find('[aria-label="隐藏详情"]').exists()).toBe(false);
  expect(wrapper.find(".zerp-report-group-summary").exists()).toBe(false);
  const path = window.location.pathname;
  await wrapper.get('[aria-label="查看报表详情"]').trigger("click");
  expect(wrapper.get('[role="dialog"]').text()).toContain("报表详情");
  expect(window.location.pathname).toBe(path);
});
