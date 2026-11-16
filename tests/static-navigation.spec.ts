import { afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { fixture } from "./fixtures/static-model";
import { render } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("projects direct roots and fixed second-level sections, preserving page titles and real links", async () => {
  const f = fixture();
  f.rows.navigationLabel = "AB 业务入口";
  f.model.navigation.groups = [
    {
      key: "main",
      label: "业务",
      items: [],
      sections: [{ key: "a", label: "A 分类", items: [f.rows] }],
    },
  ];
  f.model.navigation.current = null;
  wrapper = await render(f.model);
  expect(f.model.navigation.current).toBe(f.rows);
  const section = wrapper.find(".zerp-navigation-section");
  expect(section.exists()).toBe(true);
  expect(section.attributes("open")).toBeUndefined();
  expect(section.find("summary").text()).toBe("A 分类");
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
});
it("rechecks stale links against permissions and owner without remapping removed indexes", async () => {
  const f = fixture();
  const second = { ...f.rows, key: "second", label: "第二集合" };
  f.model.members.second = second;
  f.model.navigation.groups[0]!.items.push(f.model.members.second);
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
        node: f.model.members.second,
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
    visit.mock.calls.filter(([root]) => root === f.model.members.second),
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
  f.model.members.blocked = blocked;
  f.model.navigation.groups = [
    {
      key: "hidden",
      label: "空组",
      items: [f.model.members.blocked],
      sections: [{ key: "empty", label: "空分类", items: [] }],
    },
    {
      key: "visible",
      label: "有权组",
      items: [],
      sections: [
        { key: "denied", label: "撤权分类", items: [f.model.members.blocked] },
        { key: "allowed", label: "获权分类", items: [f.rows] },
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
