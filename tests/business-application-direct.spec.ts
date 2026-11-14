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
    rows,
    [meta]: {
      kind: "object",
      name: "Partners",
      form: ["intro", "rows"],
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
it("keeps aggregate context and opens empty collection only when its tab becomes visible", async () => {
  const { model, query } = fixture();
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.text()).toContain("Partners");
  expect(query).not.toHaveBeenCalled();
  await wrapper.get('[role="tab"][data-member="rows"]').trigger("click");
  await flushPromises();
  expect(wrapper.findAll("th").map((x) => x.text())).toContain("Code");
  expect(query).toHaveBeenCalledTimes(1);
  expect(model[meta].navigation.current).toBe(model.group);
  wrapper.unmount();
});
it("edits model values directly and retains failed input without automatic writes", async () => {
  const { model } = fixture();
  const update = vi.fn(async () => {
    throw Error("business rejection");
  });
  const record = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  record[meta].form = ["intro"];
  record[meta].operations = { update: { run: update } };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  await wrapper.get('input[aria-label="Introduction"]').setValue("edited");
  expect((record.intro as { value: string }).value).toBe("edited");
  expect(update).not.toHaveBeenCalled();
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "保存")!
    .trigger("click");
  await flushPromises();
  expect(update).toHaveBeenCalledTimes(1);
  expect(wrapper.get("input").element.value).toBe("edited");
  expect(wrapper.text()).toContain("操作失败");
  wrapper.unmount();
});
it("does not display workspace or old messages after owner permissions cease to match", async () => {
  const { model } = fixture();
  model[meta].messages = [
    { id: "old", level: "info", text: "old owner notification" },
  ];
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  model[meta].owner = { ledger: "new", operator: "next", generation: "2" };
  await flushPromises();
  expect(wrapper.text()).not.toContain("Partners");
  expect(wrapper.text()).not.toContain("old owner notification");
  wrapper.unmount();
});
it("inherits collection grants for records and narrows field writes for ordinary users", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const rows = group.rows as Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const save = vi.fn(async () => {});
  const record = {
    code: {
      value: "original",
      [meta]: { kind: "text" as const, name: "Code" },
    },
    [meta]: {
      kind: "object" as const,
      name: "Record",
      operations: { update: { run: save } },
    },
  };
  rows.items = [record];
  rows.selected = record;
  group[meta].form = ["rows"];
  model[meta].userPermissions = {
    owner: model[meta].owner!,
    administrator: false,
    grants: [
      {
        node: rows,
        read: true,
        write: true,
        operations: { query: true, update: true },
      },
    ],
  };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  await wrapper.get('input[aria-label="Code"]').setValue("changed");
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "保存")!
    .trigger("click");
  await flushPromises();
  expect(save).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
it("shows an unprojected deep linked record inside its owning aggregate", async () => {
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
      value: "deep link",
      [meta]: { kind: "text" as const, name: "Code" },
    },
    [meta]: { kind: "object" as const, name: "Record", operations: {} },
  };
  rows.items = [record];
  group[meta].form = ["intro"];
  model[meta].navigation.current = record;
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.text()).toContain("Partners");
  expect(
    (wrapper.get('input[aria-label="Code"]').element as HTMLInputElement).value,
  ).toBe("deep link");
  wrapper.unmount();
});
it("uses consumer drafts and one query for each page action", async () => {
  const { model, query } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const rows = group.rows as Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  group[meta].form = ["rows"];
  rows.total = 45;
  const save = vi.fn(async () => {});
  const create = vi.fn(async () => {
    rows.draft = {
      code: { value: "new", [meta]: { kind: "text", name: "New code" } },
      [meta]: {
        kind: "object",
        name: "Draft",
        operations: { update: { run: save } },
      },
    };
  });
  rows[meta].operations.create = { run: create };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "下一页")!
    .trigger("click");
  await flushPromises();
  expect(rows.page).toBe(2);
  expect(query).toHaveBeenCalledTimes(2);
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "新增")!
    .trigger("click");
  await flushPromises();
  expect(create).toHaveBeenCalledTimes(1);
  await wrapper.get('input[aria-label="New code"]').setValue("draft input");
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "保存")!
    .trigger("click");
  await flushPromises();
  expect(save).toHaveBeenCalledTimes(1);
  expect((rows.draft!.code as { value: string }).value).toBe("draft input");
  wrapper.unmount();
});
it("retains an in-flight write guard across navigation and rejects late consumer owner writes", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  group[meta].form = ["intro"];
  let release!: () => void;
  const result = new Promise<void>((resolve) => (release = resolve));
  const owner = model[meta].owner;
  const save = vi.fn(async () => {
    await result;
    if (model[meta].owner !== owner) return;
    (group.intro as { value: string }).value = "late";
  });
  group[meta].operations = { update: { run: save } };
  const other = {
    note: { value: "other", [meta]: { kind: "text" as const, name: "Note" } },
    [meta]: { kind: "object" as const, name: "Other", operations: {} },
  };
  model.other = other;
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "保存")!
    .trigger("click");
  model[meta].navigation.current = other;
  await flushPromises();
  model[meta].navigation.current = group;
  await flushPromises();
  expect(
    wrapper
      .findAll("button")
      .find((b) => b.text() === "保存")!
      .attributes("disabled"),
  ).toBeDefined();
  expect(save).toHaveBeenCalledTimes(1);
  model[meta].owner = { ledger: "next", operator: "next", generation: "2" };
  release();
  await flushPromises();
  expect((group.intro as { value: string }).value).toBe("hello");
  wrapper.unmount();
});
