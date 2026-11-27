import { afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { click, input, render } from "./fixtures/static-host";
import { field, fixture, object } from "./fixtures/static-model";
import type { ObjectNode, RecordsNode } from "../src/model";

let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

it("opens an AA window directly from the workbench and confirms switching dirty AA records", async () => {
  const { model, rows, record, name } = fixture();
  record.businessType = "voucher.AA";
  const second = object("r2", "第二张 AA 单", [
    field("name", "名称", "第二张"),
  ]);
  second.businessType = "voucher.AA";
  rows.items.push(second);
  const readPage = vi.fn(async () => {});
  rows.load = readPage;
  const load = vi.fn(async () => {});
  record.load = load;
  const other = object("contact", "联系人详情", [
    field("name", "姓名", "合成客户"),
  ]);
  rows.items.push(other);
  const shortcut = (key: string, title: string) =>
    object(key, title, [field("title", "名称", title)]);
  const aa = shortcut("aa", "第一张单据");
  const next = shortcut("next", "第二张单据");
  const contact = shortcut("contact-link", "联系人入口");
  const section = (key: string, items: ObjectNode[] = []): RecordsNode => ({
    kind: "records",
    key,
    label: key,
    items,
    readOnly: true,
    operations: {},
    selected: null,
  });
  model.work.workbench = {
    key: "home",
    label: "工作台",
    information: section("信息"),
    vouchers: section("单据", [aa, next]),
    reports: section("报表"),
    masters: section("资料", [contact]),
    targets: new Map([
      [aa, { collection: rows, record }],
      [next, { collection: rows, record: second }],
      [contact, { collection: rows, record: other }],
    ]),
  };
  wrapper = await render(model);
  const originalUrl = window.location.href;
  await wrapper
    .get('.zerp-workbench [aria-label="单据"] button')
    .trigger("click");
  await flushPromises();
  expect(window.location.href).toBe(originalUrl);
  expect(load).toHaveBeenCalledExactlyOnceWith("r1");
  expect(readPage).not.toHaveBeenCalled();
  // Workbench links are viewing entries; move to the explicit edit action in its window.
  await click("编辑");
  await input("名称").setValue("未保存");
  expect(name.value).toBe("initial");
  await wrapper
    .findAll('.zerp-workbench [aria-label="单据"] button')[1]!
    .trigger("click");
  await flushPromises();
  expect(
    document.querySelector('[role="dialog"][aria-label="丢弃未保存的编辑？"]'),
  ).not.toBeNull();
  await click("取消");
  expect(input("名称").element.value).toBe("未保存");
  await wrapper
    .findAll('.zerp-workbench [aria-label="单据"] button')[1]!
    .trigger("click");
  await click("丢弃并切换");
  expect(input("名称").element.value).toBe("第二张");
  expect(name.value).toBe("initial");
  expect(window.location.href).toBe(originalUrl);
  await wrapper
    .get('.zerp-workbench [aria-label="资料"] button')
    .trigger("click");
  await flushPromises();
  expect(wrapper.get('[aria-label="记录窗口"]').text()).toContain(
    "第二张 AA 单",
  );
  expect(wrapper.get('[aria-label="记录窗口"]').text()).toContain("联系人详情");
});

it("does not traverse another collection again when the current collection changes", async () => {
  const current = fixture();
  const other = fixture();
  other.rows.key = "other";
  current.model.work.members.push(other.rows);
  const members = other.record.members;
  const readMembers = vi.fn(() => members);
  Object.defineProperty(other.record, "members", { get: readMembers });

  wrapper = await render(current.model);
  expect(readMembers).toHaveBeenCalled();
  readMembers.mockClear();

  current.rows.items.push(
    object("new", "新记录", [field("name", "名称", "新增测试记录")]),
  );
  await flushPromises();
  expect(wrapper.text()).toContain("新增测试记录");
  await click("编辑");
  expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
  expect(readMembers).not.toHaveBeenCalled();
});

it("loads only the deep-linked collection and reuses it across page changes", async () => {
  const first = fixture();
  const second = fixture();
  second.rows.label = "第二集合";
  const loadFirst = vi.fn(async () => {});
  const loadSecond = vi.fn(async () => {});
  first.rows.load = loadFirst;
  second.rows.load = loadSecond;
  first.model.work.members = [
    { kind: "domain", key: "left", label: "第一个领域", members: [first.rows] },
    {
      kind: "domain",
      key: "right",
      label: "第二个领域",
      members: [second.rows],
    },
  ];
  window.history.replaceState(null, "", "/business/right/rows");
  wrapper = await render(first.model);
  expect(loadFirst).not.toHaveBeenCalled();
  expect(loadSecond).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20 });
  await wrapper.get('a[href="/business/left/rows"]').trigger("click");
  await flushPromises();
  await wrapper.get('a[href="/business/right/rows"]').trigger("click");
  await flushPromises();
  expect(window.location.pathname).toBe("/business/right/rows");
  expect(loadFirst).toHaveBeenCalledTimes(1);
  expect(loadSecond).toHaveBeenCalledTimes(1);
});

it("requests a page without committing its page number when the load fails", async () => {
  const { model, rows } = fixture();
  rows.page = 2;
  rows.total = 60;
  rows.operations.query!.disabled = true;
  const load = vi.fn(async ({ page }: { page: number; pageSize: number }) => {
    if (page === 3 && load.mock.calls.length === 2) throw Error("合成失败");
    rows.page = page;
  });
  rows.load = load;
  wrapper = await render(model);
  expect(load).toHaveBeenCalledExactlyOnceWith({ page: 2, pageSize: 20 });
  await click("下一页");
  expect(rows.page).toBe(2);
  expect(
    document.querySelector('nav[aria-label="分页"]')?.textContent,
  ).toContain("第 2 页");
  await click("重试");
  expect(load.mock.calls.map(([request]) => request.page)).toEqual([2, 3, 3]);
  expect(rows.page).toBe(3);
});
