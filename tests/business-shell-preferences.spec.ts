import { mount, flushPromises, config } from "@vue/test-utils";
import { reactive } from "vue";
import { expect, it, vi } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { BusinessApplication } from "../src/index";
import { modelMetadata as meta, type BusinessModel } from "../src/model";
config.global.plugins.push(
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  }),
);
type ObjectNode = Extract<
  BusinessModel[string],
  { [meta]: { kind: "object" } }
>;
function fixture() {
  const root: ObjectNode = {
    text: { value: "值", [meta]: { kind: "text", name: "内容" } },
    [meta]: { kind: "object", name: "首页", operations: {} },
  };
  const owner = { ledger: "synthetic", operator: "test", generation: "1" };
  const visit = vi.fn();
  const model = reactive({
    root,
    [meta]: {
      kind: "application",
      name: "合成应用",
      brand: { productName: "合成应用", companyName: "合成企业" },
      owner,
      userPermissions: { owner, administrator: true },
      navigation: { current: root, href: () => "/synthetic", visit },
      navigationProjection: [
        { key: "business", name: "业务", items: [{ node: root }] },
      ],
      messages: [],
    },
  } satisfies BusinessModel);
  return { model, visit };
}
it("keeps selected navigation groups collapsed and preserves modified links", async () => {
  const { model, visit } = fixture();
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(
    wrapper.get('nav[aria-label="主导航"] details').attributes("open"),
  ).toBeUndefined();
  await wrapper
    .get('nav[aria-label="主导航"] a')
    .trigger("click", { altKey: true });
  expect(visit).not.toHaveBeenCalled();
  wrapper.unmount();
});
it("renders workbench semantic sections together as cards and follows allowed model links", async () => {
  const { model, visit } = fixture();
  type Collection = Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  function shortcuts(name: string): Collection {
    const row: ObjectNode = {
      caption: { value: "合成入口", [meta]: { kind: "text", name: "名称" } },
      [meta]: { kind: "object", name: "入口", identity: name, operations: {} },
    };
    return {
      items: [row],
      selected: null,
      draft: null,
      query: { [meta]: { kind: "object", name: "查询", operations: {} } },
      page: 1,
      pageSize: 20,
      total: 1,
      [meta]: {
        kind: "collection",
        name,
        element: row,
        list: ["caption"],
        operations: {},
        report: {
          cells: [
            {
              row,
              field: "caption",
              kind: "record",
              target: model.root,
              label: "打开",
            },
          ],
        },
      },
    };
  }
  const information: ObjectNode = {
    notice: {
      value: "合成通知",
      [meta]: { kind: "text", name: "提醒", readOnly: true },
    },
    [meta]: { kind: "object", name: "重要信息", operations: {} },
  };
  const vouchers = shortcuts("单据"),
    reports = shortcuts("报表"),
    documents = shortcuts("资料"),
    manageReports = shortcuts("常用报表管理");
  const get = vi.fn(async () => {});
  const dashboard = {
    information,
    vouchers,
    reports,
    documents,
    manageReports,
    [meta]: {
      kind: "object",
      name: "工作台",
      family: "workbench",
      workbench: { information, vouchers, reports, documents, manageReports },
      operations: { get: { run: get } },
    },
  } as unknown as ObjectNode;
  Object.assign(model, { dashboard });
  model[meta].navigation.current = dashboard;
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(
    wrapper
      .findAll(".zerp-workbench-grid > section")
      .map((section) => section.attributes("aria-label")),
  ).toEqual(["重要信息", "单据", "报表", "资料"]);
  expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
  expect(get).toHaveBeenCalledTimes(1);
  await wrapper.get(".zerp-workbench-links a").trigger("click");
  expect(visit).toHaveBeenCalledWith(model.root);
  const management = wrapper
    .findAll("a")
    .find((a) => a.text() === "管理常用报表");
  expect(management).toBeDefined();
  await management!.trigger("click");
  expect(visit).toHaveBeenLastCalledWith(
    ((model as BusinessModel).dashboard as ObjectNode).manageReports,
  );
  const app: BusinessModel = model;
  app[meta].userPermissions = {
    owner: app[meta].owner!,
    administrator: false,
    grants: [
      { node: dashboard, read: true },
      { node: reports, read: true },
      { node: manageReports, read: false },
    ],
  };
  await flushPromises();
  expect(wrapper.findAll("a").some((a) => a.text() === "管理常用报表")).toBe(
    false,
  );
  wrapper.unmount();
});
