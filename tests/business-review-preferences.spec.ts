import { flushPromises, mount, config } from "@vue/test-utils";
import { reactive } from "vue";
import { expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { BusinessApplication } from "../src/index";
import { modelMetadata as meta, type BusinessModel } from "../src/model";
config.global.plugins.push(
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  }),
);
function fixture() {
  const update = vi.fn(async () => {});
  const submit = vi.fn(async () => {});
  const row = {
    code: { value: "SYN-1", [meta]: { kind: "text", name: "编号" } },
    name: { value: "合成记录", [meta]: { kind: "text", name: "名称" } },
    [meta]: {
      kind: "object",
      name: "单据",
      family: "voucher",
      identity: "1",
      operations: {
        update: { run: update },
        submit: { run: submit },
        approve: { disabledReason: "待提交", run: vi.fn(async () => {}) },
        clone: { run: vi.fn(async () => {}) },
      },
    },
  };
  const rows = {
    items: [row],
    selected: null,
    draft: null,
    page: 1,
    pageSize: 20,
    total: 1,
    query: { [meta]: { kind: "object", name: "条件", operations: {} } },
    [meta]: {
      kind: "collection",
      name: "单据",
      element: row,
      list: ["code", "name"],
      operations: {},
    },
  };
  const owner = { ledger: "synthetic", operator: "test", generation: "1" };
  const model = reactive({
    rows,
    [meta]: {
      kind: "application",
      name: "测试",
      brand: { productName: "测试", companyName: "合成" },
      owner,
      userPermissions: { owner, administrator: true },
      navigation: { current: rows, href: () => "/", visit: () => {} },
      navigationProjection: [
        { key: "main", name: "业务", items: [{ node: rows }] },
      ],
      messages: [],
    },
  }) as unknown as BusinessModel;
  return { model, update, submit };
}
it("lets a processing record edit its own input and run its qualified action without a fake save", async () => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const rows = model.rows as Collection;
  const record = rows.items[0]!;
  const process = vi.fn(async () => {});
  record[meta] = {
    kind: "object",
    name: "办理",
    family: "processing",
    operations: { process: { run: process } },
  };
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('tbody [aria-label="编辑"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  await dialog.get('input[aria-label="名称"]').setValue("input for process");
  expect((record.name as { value: string }).value).toBe("input for process");
  expect(dialog.findAll("button").some((b) => b.text() === "保存")).toBe(false);
  await dialog
    .findAll("button")
    .find((b) => b.text() === "处理")!
    .trigger("click");
  expect(process).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
it("keeps an independent child operable when the parent is viewed, but keeps inline parent fields readonly", async () => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const rows = model.rows as Collection;
  const record = rows.items[0]!;
  record[meta] = { kind: "object", name: "父项", operations: {} };
  const saveChild = vi.fn(async () => {});
  record.child = {
    value: { value: "child", [meta]: { kind: "text", name: "独立内容" } },
    [meta]: {
      kind: "object",
      name: "独立子项",
      operations: { update: { run: saveChild } },
    },
  };
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('tbody [aria-label="查看"]').trigger("click");
  await flushPromises();
  expect(
    wrapper.get('input[aria-label="编号"]').attributes("readonly"),
  ).toBeDefined();
  expect(wrapper.find('[role="tab"][data-member="child"]').exists()).toBe(
    false,
  );
  await wrapper.get('input[aria-label="独立内容"]').setValue("changed child");
  await wrapper
    .get('[role="dialog"]')
    .findAll("button")
    .find((b) => b.text() === "保存")!
    .trigger("click");
  expect(saveChild).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
it("returns to a report without requerying retained results or changing model query and page", async () => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const report = model.rows as Collection;
  const query = vi.fn(async () => {});
  report[meta].report = {};
  report[meta].operations.query = { run: query };
  report.page = 3;
  report.query.filter = {
    value: "kept",
    [meta]: { kind: "text", name: "筛选" },
  };
  const target = {
    [meta]: { kind: "object" as const, name: "下钻", operations: {} },
  };
  model.target = target;
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  model[meta].navigation.current = target;
  await flushPromises();
  model[meta].navigation.current = report;
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  expect(report.page).toBe(3);
  expect(report.query.filter.value).toBe("kept");
  expect(wrapper.get("tbody").text()).toContain("合成记录");
  wrapper.unmount();
});
it("retries a failed initial report read when returning", async () => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const report = model.rows as Collection;
  const query = vi.fn(async () => {
    throw Error("initial failure");
  });
  report[meta].report = {};
  report[meta].operations.query = { run: query };
  const target = {
    [meta]: { kind: "object" as const, name: "其他", operations: {} },
  };
  model.target = target;
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  model[meta].navigation.current = target;
  await flushPromises();
  model[meta].navigation.current = report;
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(2);
  wrapper.unmount();
});
it("loads visible workbench roles once when there is no root reader, and leaves root orchestration exclusive", async () => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  type ObjectNode = Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const query = vi.fn(async () => {}),
    infoGet = vi.fn(async () => {});
  const rows = model.rows as Collection;
  rows[meta].operations.query = { run: query };
  const information: ObjectNode = {
    [meta]: {
      kind: "object",
      name: "提醒",
      operations: { get: { run: infoGet } },
    },
  };
  const dashboard: ObjectNode = {
    information,
    rows,
    [meta]: {
      kind: "object",
      name: "工作台",
      family: "workbench",
      operations: {},
      workbench: {
        information,
        vouchers: rows,
        reports: rows,
        documents: rows,
      },
    },
  };
  model.dashboard = dashboard;
  model[meta].navigation.current = dashboard;
  let wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  expect(infoGet).toHaveBeenCalledTimes(1);
  wrapper.unmount();
  query.mockClear();
  infoGet.mockClear();
  const rootGet = vi.fn(async () => {});
  dashboard[meta].operations.get = { run: rootGet };
  wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(rootGet).toHaveBeenCalledTimes(1);
  expect(query).not.toHaveBeenCalled();
  expect(infoGet).not.toHaveBeenCalled();
  wrapper.unmount();
});
it.each([
  ["send", "发送"],
  ["withdraw", "撤回"],
  ["uncomplete", "取消完成"],
  ["unvoid", "取消作废"],
])("uses the same %s caption in row and detail", async (action, caption) => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const record = (model.rows as Collection).items[0]!;
  record[meta] = {
    kind: "object",
    name: "单据",
    family: "voucher",
    operations: { update: { run: async () => {} } },
  };
  Reflect.set(record[meta].operations, action!, { run: async () => {} });
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  expect(wrapper.find(`tbody [aria-label="${caption}"]`).exists()).toBe(true);
  await wrapper.get('tbody [aria-label="编辑"]').trigger("click");
  await flushPromises();
  expect(
    wrapper
      .get('[role="dialog"]')
      .findAll("button")
      .some((b) => b.text() === caption),
  ).toBe(true);
  wrapper.unmount();
});
it("keeps scalar fields together while tabbing only contiguous structural groups in projection order", async () => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const rows = model.rows as Collection;
  const record = rows.items[0]!;
  record.contact = {
    city: { value: "city", [meta]: { kind: "text", name: "城市" } },
    [meta]: { kind: "object", name: "联系", operations: {} },
  };
  record.settings = {
    enabled: { value: true, [meta]: { kind: "boolean", name: "启用设置" } },
    [meta]: { kind: "object", name: "设置", operations: {} },
  };
  record.tail = { value: "end", [meta]: { kind: "text", name: "末尾" } };
  record[meta].form = ["code", "name", "contact", "settings", "tail"];
  rows.selected = record;
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  expect(dialog.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
    "联系",
    "设置",
  ]);
  const code = dialog.get('input[aria-label="编号"]').element;
  const name = dialog.get('input[aria-label="名称"]').element;
  expect(code.closest(".zerp-direct-form")).toBe(
    name.closest(".zerp-direct-form"),
  );
  expect(dialog.find('input[aria-label="末尾"]').exists()).toBe(true);
  await dialog.get('[role="tab"][data-member="settings"]').trigger("click");
  expect(dialog.get('input[aria-label="名称"]').isVisible()).toBe(true);
  wrapper.unmount();
});
it("opens writable inputs while execution is disabled, even if update is denied", async () => {
  const { model } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const rows = model.rows as Collection;
  const record = rows.items[0]!;
  const process = vi.fn(async () => {});
  record[meta] = {
    kind: "object",
    name: "办理",
    family: "processing",
    operations: {
      update: { run: async () => {} },
      process: { run: process, disabledReason: "请填写名称" },
    },
  };
  model[meta].userPermissions = {
    owner: model[meta].owner!,
    administrator: false,
    grants: [
      { node: rows, read: true, write: true, operations: { process: true } },
    ],
  };
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper.get('tbody [aria-label="编辑"]').trigger("click");
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"]');
  await dialog.get('input[aria-label="名称"]').setValue("ready");
  const action = dialog.findAll("button").find((b) => b.text() === "处理")!;
  expect(action.attributes("disabled")).toBeDefined();
  expect(action.attributes("title")).toBe("请填写名称");
  expect(dialog.findAll("button").some((b) => b.text() === "保存")).toBe(false);
  expect((record.name as { value: string }).value).toBe("ready");
  expect(process).not.toHaveBeenCalled();
  wrapper.unmount();
});
it.each(["root", "role"])(
  "activates a %s workbench reader after its initial restriction clears",
  async (reader) => {
    const { model } = fixture();
    type Collection = Extract<
      BusinessModel[string],
      { [meta]: { kind: "collection" } }
    >;
    type ObjectNode = Extract<
      BusinessModel[string],
      { [meta]: { kind: "object" } }
    >;
    const rows = model.rows as Collection;
    const load = vi.fn(async () => {});
    rows[meta].operations.query = { run: load, disabledReason: "准备中" };
    const information: ObjectNode = {
      [meta]: { kind: "object", name: "提醒", operations: {} },
    };
    const dashboard: ObjectNode = {
      information,
      rows,
      [meta]: {
        kind: "object",
        name: "工作台",
        family: "workbench",
        operations:
          reader === "root"
            ? { get: { run: load, disabledReason: "准备中" } }
            : {},
        workbench: {
          information,
          vouchers: rows,
          reports: rows,
          documents: rows,
        },
      },
    };
    model.dashboard = dashboard;
    model[meta].navigation.current = dashboard;
    const wrapper = mount(BusinessApplication, { props: { model } });
    await flushPromises();
    expect(load).not.toHaveBeenCalled();
    if (reader === "root")
      delete (model.dashboard as ObjectNode)[meta].operations.get!
        .disabledReason;
    else delete rows[meta].operations.query!.disabledReason;
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  },
);
