import { mount, flushPromises, config } from "@vue/test-utils";
import { reactive } from "vue";
import { expect, it, vi } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { BusinessApplication } from "../src/index";
import type {
  BusinessModel,
  ObjectNode,
  Collection,
  Operation,
} from "../src/model";
config.global.plugins.push(
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  }),
);
const operation = (run = vi.fn(async () => {})): Operation => ({
  disabled: false,
  run,
});
function object(key: string, label = key): ObjectNode {
  return {
    kind: "object",
    family: "standard",
    key,
    label,
    identity: null,
    readOnly: false,
    members: [],
    operations: {},
  };
}
function fixture() {
  const query = operation();
  const collection: Collection = {
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
    members: { customers: collection },
    authentication: {
      form: object("login", "登录"),
      operations: { signIn: operation(), recover: operation() },
    },
    account: {
      label: "测试用户",
      profile: object("profile", "个人资料"),
      password: object("password", "修改密码"),
      operations: { changePassword: operation(), signOut: operation() },
    },
    session: {
      state: "ready",
      owner,
      userPermissions: { owner, administrator: true },
    },
    navigation: {
      current: null,
      groups: [{ key: "main", label: "业务", items: [collection] }],
      href: () => "/customers",
      visit(node) {
        model.navigation.current = node;
      },
    },
    messages: [],
  });
  return { model, collection: model.members.customers!, query: query.run };
}
it("shows declared columns for an empty collection and queries the first authorized collection once", async () => {
  const { model, query } = fixture();
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.findAll("th").map((x) => x.text())).toContain("编号");
  expect(query).toHaveBeenCalledTimes(1);
  expect(model.navigation.current).toBe(model.members.customers);
  wrapper.unmount();
});
it("keeps the same root through anonymous authentication and isolates mismatched owners", async () => {
  const { model } = fixture();
  model.session = { state: "anonymous", owner: null, userPermissions: null };
  const signIn = vi.fn(async () => {
    const owner = { ledger: "synthetic", operator: "next", generation: "2" };
    model.session = {
      state: "ready",
      owner,
      userPermissions: { owner, administrator: true },
    };
  });
  model.authentication.operations.signIn.run = signIn;
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.findAll("th")).toHaveLength(0);
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "登录")!
    .trigger("click");
  await flushPromises();
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(wrapper.findAll("th").map((x) => x.text())).toContain("编号");
  if (model.session.owner)
    model.session.owner = { ...model.session.owner, generation: "3" };
  await flushPromises();
  expect(wrapper.findAll("th")).toHaveLength(0);
  wrapper.unmount();
});
it("denies ordinary collection access by default and restores granted collections without deleting structure", async () => {
  const { model, collection } = fixture();
  const owner = model.session.owner!;
  model.session = {
    state: "ready",
    owner,
    userPermissions: { owner, administrator: false, grants: [] },
  };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.findAll("th")).toHaveLength(0);
  model.session.userPermissions = {
    owner,
    administrator: false,
    grants: [
      {
        node: collection,
        read: true,
        write: true,
        operations: { query: true },
      },
    ],
  };
  await flushPromises();
  expect(wrapper.findAll("th").map((x) => x.text())).toContain("编号");
  expect(model.members.customers).toBe(collection);
  wrapper.unmount();
});
it("does not load a configured workbench again on return and retries a failed load explicitly", async () => {
  const { model, collection } = fixture();
  const records = (key: string) => ({
    kind: "records" as const,
    key,
    label: key,
    readOnly: true,
    columns: [],
    items: [],
    selected: null,
    operations: {},
  });
  const load = operation(
    vi.fn(async () => {
      throw Error("offline");
    }),
  );
  model.workbench = {
    load,
    information: records("重要信息"),
    vouchers: records("单据"),
    reports: records("报表"),
    masters: records("资料"),
  };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(load.run).toHaveBeenCalledTimes(1);
  expect(wrapper.text()).toContain("操作失败");
  model.navigation.current = collection;
  await flushPromises();
  model.navigation.current = null;
  await flushPromises();
  expect(load.run).toHaveBeenCalledTimes(1);
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "刷新")!
    .trigger("click");
  await flushPromises();
  expect(load.run).toHaveBeenCalledTimes(2);
  wrapper.unmount();
});
it("edits the selected record directly, preserves failed input, and prevents disabled or duplicate saves", async () => {
  const { model, collection } = fixture();
  const row = object("customer", "客户详情");
  row.identity = "c1";
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
  row.operations.update = { disabled: true, run: update };
  collection.items = [row];
  collection.selected = row;
  collection.total = 1;
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  const input = dialog.get('input[aria-label="编号"]');
  await input.setValue("changed");
  expect((collection.selected!.members[0] as { value: string }).value).toBe(
    "changed",
  );
  const save = () =>
    dialog.findAll("button").find((button) => button.text() === "保存")!;
  expect(save().attributes("disabled")).toBeDefined();
  await save().trigger("click");
  expect(update).not.toHaveBeenCalled();
  collection.selected!.operations.update!.disabled = false;
  await flushPromises();
  await save().trigger("click");
  await save().trigger("click");
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
  const hidden = {
    kind: "text" as const,
    key: "code",
    label: null,
    readOnly: false,
    required: false,
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
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  expect(wrapper.get("table").text()).toContain("hidden-column");
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
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  const nextOwner = { ledger: "synthetic", operator: "other", generation: "2" };
  model.session = {
    state: "ready",
    owner: nextOwner,
    userPermissions: { owner: nextOwner, administrator: true },
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
  const child = object("line", "明细");
  child.identity = "l1";
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
  const save = vi.fn(async () => {});
  parent.operations.update = operation(save);
  parent.members = [
    {
      kind: "records",
      key: "lines",
      label: "联系明细",
      readOnly: false,
      columns: [{ key: "name", label: "名称" }],
      items: [child],
      selected: null,
      operations: { create: operation(), remove: operation() },
    },
  ];
  collection.items = [parent];
  collection.selected = parent;
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  expect(dialog.findAll("th").map((header) => header.text())).toContain("名称");
  await dialog.get('input[aria-label="名称"]').setValue("修改后");
  expect(save).not.toHaveBeenCalled();
  await dialog
    .findAll("button")
    .find((button) => button.text() === "保存")!
    .trigger("click");
  await flushPromises();
  expect(save).toHaveBeenCalledTimes(1);
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
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
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
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  const edit = wrapper.find('button[aria-label="编辑"]');
  expect(edit.exists()).toBe(true);
  await edit.trigger("click");
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
  collection.items = [row];
  collection.total = 1;
  const wrapper = mount(BusinessApplication, { props: { model } });
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
  const owner = model.session.owner!;
  model.session = {
    state: "ready",
    owner,
    userPermissions: {
      owner,
      administrator: false,
      grants: [
        {
          node: collection,
          read: true,
          write: false,
          operations: { query: true },
        },
      ],
    },
  };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  const input = wrapper.get('input[aria-label="查询名称"]');
  expect(input.attributes("readonly")).toBeUndefined();
  await input.setValue("客户");
  expect((collection.conditions.members[0] as { value: string }).value).toBe(
    "客户",
  );
  if (!model.session.userPermissions.administrator)
    model.session.userPermissions.grants.push({
      node: collection.conditions.members[0]!,
      read: true,
      write: false,
      operations: {},
    });
  await flushPromises();
  expect(input.attributes("readonly")).toBeDefined();
  wrapper.unmount();
});
