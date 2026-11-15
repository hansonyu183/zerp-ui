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
it("projects record operations into the second column and does not save when entering edit", async () => {
  const { model, update, submit } = fixture();
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.findAll("th").map((cell) => cell.text())).toEqual([
    "编号",
    "操作",
    "名称",
  ]);
  const row = wrapper.get("tbody tr");
  expect(row.find('[aria-label="查看"]').exists()).toBe(false);
  expect(row.get('[aria-label="审批"]').attributes("disabled")).toBeDefined();
  expect(row.get('[aria-label="审批"]').attributes("aria-description")).toBe(
    "待提交",
  );
  expect(row.find('[aria-label="更多操作"]').exists()).toBe(true);
  await row.get('[aria-label="提交"]').trigger("click");
  await flushPromises();
  expect(submit).toHaveBeenCalledTimes(1);
  await row.get('[aria-label="编辑"]').trigger("click");
  await flushPromises();
  expect(update).not.toHaveBeenCalled();
  expect((model.rows as { selected: unknown }).selected).not.toBeNull();
  wrapper.unmount();
});

it("keeps read access when editing is disabled and removes revoked row operations", async () => {
  const { model, submit } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { items: unknown[]; selected: unknown }
  >;
  const rows = model.rows as Collection;
  const record = rows.items[0]!;
  record[meta].operations.update!.disabledReason = "已锁定";
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  const row = wrapper.get("tbody tr");
  expect(row.find('[aria-label="查看"]').exists()).toBe(true);
  expect(row.get('[aria-label="编辑"]').attributes("disabled")).toBeDefined();
  const owner = model[meta].owner!;
  model[meta].userPermissions = {
    owner,
    administrator: false,
    grants: [{ node: rows, read: true, write: false }],
  };
  await flushPromises();
  expect(row.find('[aria-label="编辑"]').exists()).toBe(false);
  expect(row.find('[aria-label="提交"]').exists()).toBe(false);
  expect(row.find('[aria-label="查看"]').exists()).toBe(true);
  expect(row.get('[aria-label="查看"]').attributes("href")).toBe("/");
  await row.get('[aria-label="查看"]').trigger("click", { ctrlKey: true });
  expect(rows.selected).toBeNull();
  expect(submit).not.toHaveBeenCalled();
  wrapper.unmount();
});
it("keeps short mobile action labels and all workflow actions directly reachable", async () => {
  const width = window.innerWidth;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  window.dispatchEvent(new Event("resize"));
  const { model } = fixture();
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  try {
    await flushPromises();
    const card = wrapper.get('article[aria-label="记录 1"]');
    expect(card.get('[aria-label="编辑"]').text()).toBe("编辑");
    expect(card.get('[aria-label="提交"]').text()).toBe("提交");
    expect(card.get('[aria-label="更多操作"]').text()).toBe("更多");
    expect(card.text()).toContain("编号");
    expect(card.text()).toContain("SYN-1");
    type Collection = Extract<
      BusinessModel[string],
      { items: unknown[]; selected: unknown }
    >;
    const record = (model.rows as Collection).items[0]!;
    record[meta] = {
      kind: "object",
      name: "流程",
      family: "workflow",
      operations: {
        start: { run: async () => {} },
        advance: { run: async () => {} },
        createChild: { run: async () => {} },
        audit: { run: async () => {} },
      },
    };
    await flushPromises();
    const workflowCard = wrapper.get('article[aria-label="记录 1"]');
    expect(workflowCard.find('[aria-label="更多操作"]').exists()).toBe(false);
    for (const label of ["启动", "推进", "新增子项", "查看记录"])
      expect(workflowCard.get(`[aria-label="${label}"]`).text()).toBe(label);
  } finally {
    wrapper.unmount();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  }
});
