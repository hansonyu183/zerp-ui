import { afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { domainOf, fixture } from "./fixtures/static-model";
import { render, click, input } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("uses array order for root links and domain tabs even with numeric keys", async () => {
  const f = fixture();
  const second = fixture().rows;
  const other = fixture().rows;
  f.rows.key = "20";
  second.key = "3";
  second.label = "第二集合";
  other.key = "1";
  other.label = "第二领域";
  f.model.members = [
    { ...domainOf(f.rows, "第一领域"), members: [f.rows, second] },
    domainOf(other),
  ];
  f.model.navigation.current = null;
  wrapper = await render(f.model);
  expect(f.model.navigation.current).toBe(f.rows);
  expect(wrapper.findAll("nav a").map((link) => link.text())).toEqual([
    "第一领域",
    "第二领域",
  ]);
  expect(wrapper.get("nav a").attributes("href")).toBe("/20");
  expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
    "记录集合",
    "第二集合",
  ]);
});
it("derives ordered domain links and folded sections, preserving page titles and real links", async () => {
  const f = fixture();
  const second = { ...f.rows, key: "second", label: "AC 业务入口" };
  const stopped = { ...f.rows, key: "history", label: "历史集合" };
  f.model.members = [
    { ...f.rows, key: "historyContext", label: "历史上下文" },
    {
      kind: "category",
      key: "main",
      label: "单据",
      members: [
        {
          kind: "section",
          key: "a",
          label: "A 分类",
          members: [
            { ...domainOf(stopped), hiddenFromNavigation: true },
            domainOf(f.rows, "AB 业务入口"),
            domainOf(second),
          ],
        },
      ],
    },
  ];
  f.model.navigation.current = null;
  wrapper = await render(f.model);
  expect(f.model.navigation.current).toBe(f.rows);
  const section = wrapper.find(".zerp-navigation-section");
  expect(section.exists()).toBe(true);
  expect(section.attributes("open")).toBeUndefined();
  expect(section.find("summary").text()).toBe("A 分类");
  expect(wrapper.findAll("nav a").map((item) => item.text())).toEqual([
    "AB 业务入口",
    "AC 业务入口",
  ]);
  const link = section.find("a");
  expect(link.text()).toBe("AB 业务入口");
  expect(link.attributes("href")).toBe("/rows");
  expect(link.attributes("aria-current")).toBe("page");
  expect(wrapper.find("h1").text()).toBe("记录集合");
  const visit = vi.fn();
  f.model.navigation.visit = visit;
  await link.trigger("click", { ctrlKey: true });
  expect(visit).not.toHaveBeenCalled();
  await link.trigger("click");
  expect(visit).toHaveBeenCalledWith(f.rows);
  f.model.navigation.current = stopped;
  await flushPromises();
  expect(wrapper.get("h1").text()).toBe("历史集合");
  expect(wrapper.find("nav [aria-current]").exists()).toBe(false);
});
it("rechecks stale links against permissions and owner without remapping removed indexes", async () => {
  const f = fixture();
  const second = { ...f.rows, key: "second", label: "第二集合" };
  f.model.members.push(domainOf(second));
  wrapper = await render(f.model);
  const oldLink = wrapper
    .findAll("nav a")
    .find((a) => a.text() === "记录集合")!;
  const visit = vi.fn();
  f.model.navigation.visit = visit;
  f.model.session.userPermissions = {
    owner: f.owner,
    administrator: false,
    grants: [
      {
        node: second,
        read: true,
        write: false,
        operations: {},
      },
    ],
  };
  // Click before the queued DOM patch: the old key must never map to the next root.
  await oldLink.trigger("click");
  expect(visit.mock.calls.some(([root]) => root === f.rows)).toBe(false);
  expect(
    visit.mock.calls.filter(([root]) => root?.key === second.key),
  ).toHaveLength(1); // authorized fallback only
  visit.mockClear();
  f.model.session.owner = { ...f.owner, generation: "2" };
  await oldLink.trigger("click");
  expect(visit).not.toHaveBeenCalled();
  await flushPromises();
  expect(wrapper.findAll("nav a")).toHaveLength(0);
});
it("prunes unauthorized roots, empty sections and groups, and falls back through sections in declared order", async () => {
  const f = fixture();
  const blocked = { ...f.rows, key: "blocked", label: "不可见集合" };
  f.model.members = [
    {
      kind: "category",
      key: "hidden",
      label: "空组",
      members: [domainOf(blocked)],
    },
    {
      kind: "category",
      key: "visible",
      label: "有权组",
      members: [
        { kind: "section", key: "empty", label: "空分类", members: [] },
        {
          kind: "section",
          key: "denied",
          label: "撤权分类",
          members: [domainOf(blocked)],
        },
        {
          kind: "section",
          key: "allowed",
          label: "获权分类",
          members: [domainOf(f.rows)],
        },
      ],
    },
  ];
  f.model.session.userPermissions = {
    owner: f.owner,
    administrator: false,
    grants: [{ node: f.rows, read: true, write: false, operations: {} }],
  };
  f.model.navigation.current = null;
  wrapper = await render(f.model);
  expect(f.model.navigation.current).toBe(f.rows);
  expect(wrapper.find("nav").text()).toContain("获权分类");
  expect(wrapper.find("nav").text()).not.toMatch(
    /空组|空分类|撤权分类|不可见集合/,
  );
  f.model.session.userPermissions.grants = [];
  await flushPromises();
  expect(wrapper.findAll("nav a")).toHaveLength(0);
  expect(wrapper.text()).toContain("暂无可用内容。");
});

it("keeps domain collections independently authorized, queried and saved", async () => {
  const f = fixture();
  const other = fixture();
  other.rows.key = "contacts";
  other.rows.label = "联系人";
  const standalone = fixture().rows;
  standalone.key = "standalone";
  const domain = reactive({
    kind: "domain" as const,
    key: "customers",
    label: "客户领域",
    members: [f.rows, other.rows],
  });
  f.model.members = [domain, standalone];
  f.model.session.userPermissions = {
    owner: f.owner,
    administrator: false,
    grants: [
      {
        node: f.rows,
        read: true,
        write: true,
        operations: { query: true, update: true },
      },
    ],
  };
  wrapper = await render(f.model);
  expect(wrapper.findAll("nav a").map((a) => a.text())).toEqual(["客户领域"]);
  expect(f.rows.operations.query!.run).toHaveBeenCalledTimes(1);
  expect(other.rows.operations.query!.run).not.toHaveBeenCalled();
  expect(standalone.operations.query!.run).not.toHaveBeenCalled();
  await click("编辑");
  await input("名称").setValue("changed in customer domain");
  await click("保存");
  expect(f.record.operations.update!.run).toHaveBeenCalledTimes(1);
  expect(other.record.operations.update!.run).not.toHaveBeenCalled();
  expect(other.name.value).toBe("initial");
  f.model.session.userPermissions.grants.push({
    node: other.rows,
    read: true,
    write: false,
    operations: { query: true },
  });
  await flushPromises();
  const link = wrapper.get("nav a");
  expect(wrapper.findAll("nav a").map((a) => a.text())).toEqual(["客户领域"]);
  expect(link.attributes("href")).toBe("/rows");
  expect(other.rows.operations.query!.run).not.toHaveBeenCalled();
  await wrapper
    .get('[role="tablist"]')
    .findAll('[role="tab"]')[1]!
    .trigger("click");
  await flushPromises();
  expect(f.model.navigation.current).toBe(other.rows);
  expect(link.attributes("aria-current")).toBe("page");
  expect(other.rows.operations.query!.run).toHaveBeenCalledTimes(1);
  expect(wrapper.find('button[aria-label="编辑"]').exists()).toBe(false);
  f.model.session.userPermissions.grants.shift();
  await flushPromises();
  expect(wrapper.get("nav a").attributes("href")).toBe("/contacts");
  expect(wrapper.get("nav a").attributes("aria-current")).toBe("page");
  expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
  f.model.session.userPermissions.grants = [];
  await flushPromises();
  expect(wrapper.findAll("nav a")).toHaveLength(0);
  expect(wrapper.text()).toContain("暂无可用内容。");
  expect(domain.members[0]).toBe(f.rows);
});

it("invalidates removed domain collections and their stale navigation links", async () => {
  const f = fixture();
  const domain = reactive({
    kind: "domain" as const,
    key: "domain",
    label: "领域",
    members: [f.rows],
  });
  f.model.members = [domain];
  wrapper = await render(f.model);
  const oldLink = wrapper.find("nav a");
  const visit = vi.fn();
  f.model.navigation.visit = visit;
  f.model.members = [];
  await oldLink.trigger("click");
  await flushPromises();
  expect(visit).not.toHaveBeenCalled();
  expect(wrapper.findAll("nav a")).toHaveLength(0);
  expect(wrapper.text()).toContain("暂无可用内容。");
});

it("uses Material domain tabs with real links and preserves each collection context", async () => {
  const f = fixture();
  const second = fixture();
  second.rows.key = "contacts";
  second.rows.label = "联系人";
  f.model.members = [
    {
      kind: "domain",
      key: "customerDomain",
      label: "客户领域",
      members: [f.rows, second.rows],
    },
  ];
  wrapper = await render(f.model);
  const tabs = wrapper.get('[role="tablist"][aria-label="客户领域"]');
  expect(tabs.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
    "记录集合",
    "联系人",
  ]);
  expect(tabs.findAll('[role="tab"]')[0]!.attributes("aria-selected")).toBe(
    "true",
  );
  expect(second.rows.operations.query!.run).not.toHaveBeenCalled();
  f.term.value = "keep customer search";
  f.rows.page = 3;
  const contactTab = tabs.findAll('[role="tab"]')[1]!;
  expect(contactTab.attributes("href")).toBe("/contacts");
  await contactTab.trigger("click", { ctrlKey: true });
  expect(f.model.navigation.current).toBe(f.rows);
  await contactTab.trigger("keydown", { key: " ", code: "Space" });
  await flushPromises();
  expect(f.model.navigation.current).toBe(second.rows);
  expect(second.rows.operations.query!.run).toHaveBeenCalledTimes(1);
  second.term.value = "keep contact search";
  second.rows.page = 4;
  await wrapper
    .get('[role="tablist"]')
    .findAll('[role="tab"]')[0]!
    .trigger("click");
  await flushPromises();
  expect(f.rows.page).toBe(3);
  expect(f.term.value).toBe("keep customer search");
  expect(f.rows.operations.query!.run).toHaveBeenCalledTimes(1);
  await wrapper
    .get('[role="tablist"]')
    .findAll('[role="tab"]')[1]!
    .trigger("click");
  await flushPromises();
  expect(second.rows.page).toBe(4);
  expect(second.term.value).toBe("keep contact search");
  expect(second.rows.operations.query!.run).toHaveBeenCalledTimes(1);
  const oldTab = wrapper.get('[role="tablist"]').findAll('[role="tab"]')[0]!;
  const visit = vi.fn();
  f.model.navigation.visit = visit;
  f.model.session.userPermissions = {
    owner: f.owner,
    administrator: false,
    grants: [
      {
        node: second.rows,
        read: true,
        write: false,
        operations: { query: true },
      },
    ],
  };
  await oldTab.trigger("click");
  await flushPromises();
  expect(visit).not.toHaveBeenCalled();
  expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
});
