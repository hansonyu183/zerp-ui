import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { expect, it, vi } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { config } from "@vue/test-utils";
config.global.plugins.push(
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  }),
);
import { BusinessApplication } from "../src/index";
import { modelMetadata as meta, type BusinessModel } from "../src/model";
function fixture() {
  const query = vi.fn(async () => {});
  const rows = {
    items: [],
    selected: null,
    draft: null,
    query: { [meta]: { kind: "object", name: "Filters", operations: {} } },
    page: 1,
    pageSize: 20,
    total: 0,
    [meta]: {
      kind: "collection",
      name: "Changes",
      element: {
        code: { value: "", [meta]: { kind: "text", name: "Code" } },
        [meta]: { kind: "object", name: "Change", operations: {} },
      },
      list: ["code"],
      operations: { query: { run: query } },
    },
  };
  const group = {
    intro: { value: "hello", [meta]: { kind: "text", name: "Introduction" } },
    overview: {
      summary: {
        value: "hello",
        [meta]: { kind: "text", name: "Introduction" },
      },
      [meta]: { kind: "object", name: "Overview", operations: {} },
    },
    rows,
    [meta]: {
      kind: "object",
      name: "Partners",
      form: ["overview", "rows"],
      operations: {},
    },
  };
  const owner = { ledger: "synthetic", operator: "test", generation: "1" };
  const model = reactive({
    group,
    [meta]: {
      kind: "application",
      name: "Test",
      brand: { productName: "Test", companyName: "Synthetic" },
      owner,
      userPermissions: { owner, administrator: true },
      navigation: {
        current: group,
        href: () => "/",
        visit(node: unknown) {
          model[meta].navigation.current = node as NonNullable<
            BusinessModel[typeof meta]["navigation"]["current"]
          >;
        },
      },
      navigationProjection: [
        { key: "main", name: "Main", items: [{ node: group }] },
      ],
      messages: [],
    },
  }) as unknown as BusinessModel;
  return { model, query };
}
it("uses linked Material tabs and retains a visited query without rereading it", async () => {
  const { model, query } = fixture();
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  const tabs = wrapper.findAll('[role="tab"]');
  expect(tabs).toHaveLength(2);
  expect(tabs[0]!.attributes("aria-controls")).toBeTruthy();
  await tabs[1]!.trigger("click");
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  await tabs[0]!.trigger("click");
  await tabs[1]!.trigger("click");
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  const panel = wrapper.get(`#${tabs[1]!.attributes("aria-controls")}`);
  expect(panel.attributes("role")).toBe("tabpanel");
  wrapper.unmount();
});
it("opens selected records above a mounted list and closes without discarding model input", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const rows = group.rows as Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const record = {
    code: {
      value: "original",
      [meta]: { kind: "text" as const, name: "Code" },
    },
    [meta]: {
      kind: "object" as const,
      name: "Record",
      operations: { update: { run: async () => {} } },
    },
  };
  rows.items = [record];
  rows.selected = record;
  group[meta].form = ["rows"];
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
  const table = wrapper.get("table").element;
  const dialog = wrapper.get('[role="dialog"]');
  await dialog.get('input[aria-label="Code"]').setValue("changed");
  await dialog
    .findAll("button")
    .find((b) => b.text() === "关闭")!
    .trigger("click");
  await flushPromises();
  expect(rows.selected).toBeNull();
  expect((rows.items[0]!.code as { value: string }).value).toBe("changed");
  expect(wrapper.get("table").element).toBe(table);
  wrapper.unmount();
});
it("switches Material tabs by keyboard and removes tab chrome for one or zero visible groups", async () => {
  const { model } = fixture();
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  const tabs = wrapper.findAll('[role="tab"]');
  (tabs[0]!.element as HTMLElement).focus();
  await tabs[0]!.trigger("keydown", { key: "ArrowRight" });
  await flushPromises();
  expect(tabs[1]!.attributes("aria-selected")).toBe("true");
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  group[meta].form = ["rows"];
  await flushPromises();
  expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
  expect(wrapper.find("table").exists()).toBe(true);
  group[meta].form = [];
  await flushPromises();
  expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
  expect(wrapper.find("table").exists()).toBe(false);
  wrapper.unmount();
});
it("keeps a closed new record and its unknown-result restrictions reachable without creating again", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const rows = group.rows as Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const create = vi.fn(async () => {});
  const draft = {
    code: {
      value: "unsent input",
      [meta]: { kind: "text" as const, name: "Code" },
    },
    [meta]: {
      kind: "object" as const,
      name: "Record",
      operations: {
        update: { run: async () => {}, disabledReason: "结果待核实" },
        reconcile: { run: async () => {} },
      },
    },
  };
  rows.draft = draft;
  rows[meta].operations.create = { run: create, disabledReason: "结果待核实" };
  group[meta].form = ["rows"];
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  await wrapper
    .get('[role="dialog"]')
    .findAll("button")
    .find((b) => b.text() === "关闭")!
    .trigger("click");
  await flushPromises();
  expect(rows.draft?.[meta].operations.update?.disabledReason).toBe(
    "结果待核实",
  );
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "继续编辑")!
    .trigger("click");
  await flushPromises();
  expect(
    (
      wrapper.get('[role="dialog"]').get('input[aria-label="Code"]')
        .element as HTMLInputElement
    ).value,
  ).toBe("unsent input");
  expect(create).not.toHaveBeenCalled();
  wrapper.unmount();
});
it("keeps the active group and its read when the projection order changes", async () => {
  const { model, query } = fixture();
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  await wrapper.get('[role="tab"][data-member="rows"]').trigger("click");
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  group[meta].form = ["rows", "overview"];
  await flushPromises();
  expect(
    wrapper.get('[role="tab"][data-member="rows"]').attributes("aria-selected"),
  ).toBe("true");
  expect(query).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
