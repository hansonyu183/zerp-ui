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
it("keeps nested independent writes denied while inherited fields remain readable and private rows stay hidden", async () => {
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
  const child = {
    value: {
      value: "independent",
      [meta]: { kind: "text" as const, name: "Independent value" },
    },
    [meta]: {
      kind: "object" as const,
      name: "Independent",
      operations: { update: { run: save } },
    },
  };
  const record = {
    code: {
      value: "secret cell",
      [meta]: { kind: "text" as const, name: "Code" },
    },
    nested: {
      description: {
        value: "inherited",
        [meta]: { kind: "text" as const, name: "Inherited" },
      },
      [meta]: { kind: "object" as const, name: "Embedded", operations: {} },
    },
    child,
    [meta]: { kind: "object" as const, name: "Record", operations: {} },
  };
  rows.items = [record];
  rows.selected = record;
  group[meta].form = ["rows"];
  rows[meta].list = ["missing", "code"];
  model[meta].userPermissions = {
    owner: { generation: "1", operator: "test", ledger: "synthetic" },
    administrator: false,
    grants: [
      {
        node: rows,
        read: true,
        write: true,
        operations: { query: true, update: true },
      },
      { node: child, read: true, write: false },
      { node: record.code, read: false },
    ],
  };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.text()).not.toContain("secret cell");
  await wrapper.get('[role="tab"][data-member="nested"]').trigger("click");
  await flushPromises();
  expect(
    (wrapper.get('input[aria-label="Inherited"]').element as HTMLInputElement)
      .value,
  ).toBe("inherited");
  await wrapper.get('[role="tab"][data-member="child"]').trigger("click");
  await flushPromises();
  expect(wrapper.findAll("button").some((b) => b.text() === "保存")).toBe(
    false,
  );
  expect(save).not.toHaveBeenCalled();
  wrapper.unmount();
});
it("allows a read-only user to enter query criteria without granting record edits", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const rows = group.rows as Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  rows.query.term = {
    value: "",
    [meta]: { kind: "text", name: "Search term" },
  };
  group[meta].form = ["rows"];
  model[meta].userPermissions = {
    owner: model[meta].owner!,
    administrator: false,
    grants: [
      { node: rows, read: true, write: false, operations: { query: true } },
    ],
  };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(
    wrapper.get('input[aria-label="Search term"]').attributes("readonly"),
  ).toBeUndefined();
  await wrapper.get('input[aria-label="Search term"]').setValue("wanted");
  expect((rows.query.term as { value: string }).value).toBe("wanted");
  wrapper.unmount();
});
it("reads the newly navigated independent object once", async () => {
  const { model } = fixture();
  const get = vi.fn(async () => {});
  const other = {
    name: {
      value: "profile",
      [meta]: { kind: "text" as const, name: "Profile name" },
    },
    [meta]: {
      kind: "object" as const,
      name: "Profile",
      operations: { get: { run: get } },
    },
  };
  model.other = other;
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  model[meta].navigation.current = other;
  await flushPromises();
  expect(get).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
it("keeps consumer unknown-result restrictions after ordinary refresh and hides other work during forced password change", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const save = vi.fn(async () => {});
  group[meta].operations = {
    get: { run: vi.fn(async () => {}) },
    update: { run: save, disabledReason: "结果未知，请核对" },
  };
  group[meta].form = ["intro"];
  const password = {
    secret: {
      value: "",
      [meta]: { kind: "password" as const, name: "New password" },
    },
    [meta]: {
      kind: "object" as const,
      name: "Password",
      family: "account" as const,
      operations: { changePassword: { run: vi.fn(async () => {}) } },
    },
  };
  model[meta].account = { name: "Operator", password };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(
    wrapper
      .findAll("button")
      .find((b) => b.text() === "保存")!
      .attributes("disabled"),
  ).toBeDefined();
  model[meta].messages = [];
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "刷新")!
    .trigger("click");
  await flushPromises();
  expect(save).not.toHaveBeenCalled();
  model[meta].session = { state: "password-required" };
  await flushPromises();
  expect(wrapper.find('input[aria-label="Introduction"]').exists()).toBe(false);
  expect(wrapper.find('input[aria-label="New password"]').exists()).toBe(true);
  wrapper.unmount();
});
it("hides explicitly denied value-array members and leaves disabled query pagination unchanged", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const rows = group.rows as Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  const hidden = {
    value: "private array value",
    [meta]: { kind: "text" as const, name: "Private array" },
  };
  const array = {
    items: [hidden],
    [meta]: {
      kind: "array" as const,
      name: "Values",
      element: hidden,
      operations: {},
    },
  };
  group.values = array;
  group[meta].form = ["values", "rows"];
  rows.total = 50;
  rows[meta].operations.query!.disabledReason = "暂不可查询";
  model[meta].userPermissions = {
    owner: model[meta].owner!,
    administrator: false,
    grants: [
      { node: group, read: true, write: true },
      { node: rows, read: true, operations: { query: true } },
      { node: hidden, read: false },
    ],
  };
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.find('input[aria-label="Private array"]').exists()).toBe(
    false,
  );
  await wrapper.get('[role="tab"][data-member="rows"]').trigger("click");
  await flushPromises();
  const next = wrapper.findAll("button").find((b) => b.text() === "下一页")!;
  expect(next.attributes("disabled")).toBeDefined();
  await next.trigger("click");
  expect(rows.page).toBe(1);
  wrapper.unmount();
});
it.each(["owner", "model"] as const)(
  "clears old %s execution state without letting its completion unlock a newer write",
  async (change) => {
    const { model } = fixture();
    const record = model.group as Extract<
      BusinessModel[string],
      { [meta]: { kind: "object" } }
    >;
    record[meta].form = ["intro"];
    const releases: (() => void)[] = [];
    const save = vi.fn(
      () => new Promise<void>((resolve) => releases.push(resolve)),
    );
    record[meta].operations = { update: { run: save } };
    const wrapper = mount(BusinessApplication, { props: { model } });
    await flushPromises();
    const saveButton = () =>
      wrapper.findAll("button").find((b) => b.text() === "保存")!;
    await saveButton().trigger("click");
    expect(save).toHaveBeenCalledTimes(1);
    if (change === "owner") {
      const owner = { ledger: "new", operator: "next", generation: "2" };
      model[meta].owner = owner;
      model[meta].userPermissions = { owner, administrator: true };
    } else {
      await wrapper.setProps({
        model: reactive({
          ...model,
          [meta]: { ...model[meta] },
        }) as BusinessModel,
      });
    }
    await flushPromises();
    expect(saveButton().attributes("disabled")).toBeUndefined();
    await saveButton().trigger("click");
    expect(save).toHaveBeenCalledTimes(2);
    releases[0]!();
    await flushPromises();
    expect(saveButton().attributes("disabled")).toBeDefined();
    releases[1]!();
    await flushPromises();
    expect(saveButton().attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  },
);
it.each(["query", "subtree"] as const)(
  "honors explicit read-only %s grants within otherwise editable query criteria",
  async (target) => {
    const { model } = fixture();
    const group = model.group as Extract<
      BusinessModel[string],
      { [meta]: { kind: "object" } }
    >;
    const rows = group.rows as Extract<
      BusinessModel[string],
      { [meta]: { kind: "collection" } }
    >;
    const subtree = {
      term: {
        value: "fixed",
        [meta]: { kind: "text" as const, name: "Protected criteria" },
      },
      [meta]: { kind: "object" as const, name: "Criteria", operations: {} },
    };
    rows.query.criteria = subtree;
    group[meta].form = ["rows"];
    model[meta].userPermissions = {
      owner: model[meta].owner!,
      administrator: false,
      grants: [
        { node: rows, read: true, write: false, operations: { query: true } },
        {
          node: target === "query" ? rows.query : subtree,
          read: true,
          write: false,
        },
      ],
    };
    const wrapper = mount(BusinessApplication, { props: { model } });
    await flushPromises();
    expect(
      wrapper
        .get('input[aria-label="Protected criteria"]')
        .attributes("readonly"),
    ).toBeDefined();
    wrapper.unmount();
  },
);
it("does not advertise query when an administrator collection has no query operation", async () => {
  const { model } = fixture();
  const group = model.group as Extract<
    BusinessModel[string],
    { [meta]: { kind: "object" } }
  >;
  const rows = group.rows as Extract<
    BusinessModel[string],
    { [meta]: { kind: "collection" } }
  >;
  group[meta].form = ["rows"];
  rows[meta].operations = {};
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  expect(wrapper.findAll("button").some((b) => b.text() === "查询")).toBe(
    false,
  );
  wrapper.unmount();
});
it("shows fresh messages on atomic model-owner replacement while retaining old-message isolation", async () => {
  const { model } = fixture();
  const old = { id: "old", level: "info" as const, text: "Old owner message" };
  model[meta].messages = [old];
  const wrapper = mount(BusinessApplication, { props: { model } });
  await flushPromises();
  const owner = { ledger: "next", operator: "next", generation: "2" };
  const fresh = {
    id: "fresh",
    level: "info" as const,
    text: "New owner message",
  };
  await wrapper.setProps({
    model: reactive({
      ...model,
      [meta]: {
        ...model[meta],
        owner,
        userPermissions: { owner, administrator: true as const },
        messages: [old, fresh],
      },
    }) as BusinessModel,
  });
  await flushPromises();
  expect(wrapper.text()).toContain("New owner message");
  expect(wrapper.text()).not.toContain("Old owner message");
  wrapper.unmount();
});
