import { afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { watch } from "vue";
import { click, input, render } from "./fixtures/static-host";
import { field, fixture, object } from "./fixtures/static-model";
import type { ObjectNode, RecordsNode } from "../src/model";

let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

const section = (key: string, items: ObjectNode[] = []): RecordsNode => ({
  kind: "records",
  key,
  label: key,
  items,
  readOnly: true,
  operations: {},
  selected: null,
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

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
  const load = vi.fn(async () => {
    name.value = "读取后的名称";
  });
  record.load = load;
  const loadSecond = vi.fn(async () => {});
  second.load = loadSecond;
  const other = object("contact", "联系人详情", [
    field("name", "姓名", "合成客户"),
  ]);
  const loadOther = vi.fn(async () => {});
  other.load = loadOther;
  rows.items.push(other);
  const shortcut = (key: string, title: string) =>
    object(key, title, [field("title", "名称", title)]);
  const aa = shortcut("aa", "第一张单据");
  const next = shortcut("next", "第二张单据");
  const contact = shortcut("contact-link", "联系人入口");
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
  const openAA = (index: number) =>
    wrapper!
      .findAll('.zerp-workbench [aria-label="单据"] button')
      [index]!.trigger("click");
  const confirmation = () =>
    document.querySelector('[role="dialog"][aria-label="切换记录？"]');
  await openAA(0);
  await flushPromises();
  expect(window.location.href).toBe(originalUrl);
  expect(load).toHaveBeenCalledExactlyOnceWith("r1");
  expect(readPage).not.toHaveBeenCalled();

  const observed = vi.fn();
  const stop = watch(() => name.value, observed, { flush: "sync" });
  await click("编辑");
  await input("名称").setValue("未保存");
  stop();
  expect(observed.mock.calls[0]?.slice(0, 2)).toEqual([
    "未保存",
    "读取后的名称",
  ]);
  expect(name.value).toBe("未保存");
  await openAA(1);
  expect(confirmation()).not.toBeNull();
  expect(loadSecond).not.toHaveBeenCalled();
  await click("取消");
  expect(input("名称").element.value).toBe("未保存");

  await input("名称").setValue("读取后的名称");
  await openAA(1);
  await flushPromises();
  expect(confirmation()).toBeNull();
  expect(loadSecond).toHaveBeenCalledExactlyOnceWith("r2");
  await openAA(0);
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(2);
  await click("编辑");
  await input("名称").setValue("修改后继续切换");
  await openAA(1);
  await click("继续切换");
  expect(input("名称").element.value).toBe("第二张");
  expect(name.value).toBe("修改后继续切换");
  expect(loadSecond).toHaveBeenCalledTimes(2);
  await openAA(0);
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(3);
  expect(name.value).toBe("读取后的名称");
  await openAA(0);
  expect(load).toHaveBeenCalledTimes(3);
  expect(window.location.href).toBe(originalUrl);

  await wrapper
    .get('.zerp-workbench [aria-label="资料"] button')
    .trigger("click");
  await flushPromises();
  await click("记录");
  await click("联系人详情");
  expect(load).toHaveBeenCalledTimes(3);
  expect(loadOther).toHaveBeenCalledExactlyOnceWith("contact");
});

it("serializes reads when a record is closed and reopened before its first read completes", async () => {
  const { model, rows, record, name } = fixture();
  const first = deferred();
  const second = deferred();
  const load = vi
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(async () => {
      await second.promise;
      name.value = "本次读取";
    });
  record.load = load;
  const row = object("shortcut", "记录入口", [
    field("title", "名称", "记录入口"),
  ]);
  model.work.workbench = {
    key: "home",
    label: "工作台",
    information: section("信息"),
    vouchers: section("单据", [row]),
    reports: section("报表"),
    masters: section("资料"),
    targets: new Map([[row, { collection: rows, record }]]),
  };
  wrapper = await render(model);
  const open = () =>
    wrapper!.get('.zerp-workbench [aria-label="单据"] button').trigger("click");
  await open();
  await flushPromises();
  const locked = () => input("名称").element.closest("[inert]");
  expect(locked()).not.toBeNull();
  await click("关闭");
  await open();
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(1);
  expect(locked()).not.toBeNull();
  first.resolve();
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(2);
  expect(locked()).not.toBeNull();
  second.resolve();
  await flushPromises();
  expect(locked()).toBeNull();
  expect(input("名称").element.value).toBe("本次读取");
});

it("keeps a failed save dirty and compares against the confirmed value after saving", async () => {
  const { model, rows, record, name } = fixture();
  const second = object("r2", "第二条", [field("name", "名称", "第二条")]);
  second.businessType = record.businessType;
  second.operations.update = { disabled: false, run: vi.fn() };
  rows.items.push(second);
  const pending = deferred();
  const save = vi
    .fn()
    .mockRejectedValueOnce(Error("合成保存失败"))
    .mockImplementationOnce(async () => {
      await pending.promise;
      name.value = "确认值";
    });
  record.operations.update = { disabled: false, run: save };
  wrapper = await render(model);
  const openSecond = () =>
    wrapper!.findAll('button[aria-label="编辑"]')[1]!.trigger("click");
  const confirmation = () =>
    document.querySelector('[role="dialog"][aria-label="切换记录？"]');
  await click("编辑");
  await input("名称").setValue("提交值");
  await click("保存");
  expect(name.value).toBe("提交值");
  await openSecond();
  expect(confirmation()).not.toBeNull();
  await click("取消");
  await click("保存");
  expect(save.mock.calls[1]?.[0]).toBe(record);
  expect(input("名称").element.closest("[inert]")).not.toBeNull();
  await openSecond();
  expect(rows.selected).toBe(record);
  expect(confirmation()).toBeNull();
  pending.resolve();
  await flushPromises();
  expect(input("名称").element.value).toBe("确认值");
  await openSecond();
  expect(rows.selected).toBe(second);
  expect(confirmation()).toBeNull();
});

it("updates only the nested object's comparison values after a nested save", async () => {
  const { model, rows, record, name } = fixture();
  const child = object("child", "子对象", [field("detail", "子字段")]);
  const saveChild = vi.fn();
  child.operations.update = { disabled: false, run: saveChild };
  record.members.push(child);
  const second = object("r2", "第二条", [field("name")]);
  second.businessType = record.businessType;
  second.operations.update = { disabled: false, run: vi.fn() };
  rows.items.push(second);
  wrapper = await render(model);
  await click("编辑");
  await input("名称").setValue("父字段已改");
  await input("子字段").setValue("子字段已改");
  const dialog = wrapper.get('[role="dialog"]');
  const childSave = dialog
    .get('[aria-label="子对象操作"]')
    .findAll("button")
    .find((button) => button.text() === "保存")!;
  await childSave.trigger("click");
  await flushPromises();
  expect(saveChild).toHaveBeenCalledExactlyOnceWith(child);

  const editRecord = (index: number) =>
    wrapper!.findAll('button[aria-label="编辑"]')[index]!.trigger("click");
  await editRecord(1);
  expect(document.querySelector('[aria-label="切换记录？"]')).not.toBeNull();
  await click("取消");
  await input("名称").setValue("initial");
  expect(name.value).toBe("initial");
  await editRecord(1);
  expect(rows.selected).toBe(second);
  expect(document.querySelector('[aria-label="切换记录？"]')).toBeNull();

  await editRecord(0);
  await input("子字段").setValue("子对象再次修改");
  const parentSave = wrapper
    .get('[role="dialog"] [aria-label="记录操作"]')
    .findAll("button")
    .find((button) => button.text() === "保存")!;
  await parentSave.trigger("click");
  await flushPromises();
  await editRecord(1);
  expect(document.querySelector('[aria-label="切换记录？"]')).not.toBeNull();
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
  window.history.replaceState(null, "", "/app/right/rows");
  wrapper = await render(first.model);
  expect(loadFirst).not.toHaveBeenCalled();
  expect(loadSecond).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20 });
  await wrapper.get('a[href="/app/left/rows"]').trigger("click");
  await flushPromises();
  await wrapper.get('a[href="/app/right/rows"]').trigger("click");
  await flushPromises();
  expect(window.location.pathname).toBe("/app/right/rows");
  expect(loadFirst).toHaveBeenCalledTimes(1);
  expect(loadSecond).toHaveBeenCalledTimes(1);
});

it("does not treat a reentrant record retry as another read failure", async () => {
  const { model, record } = fixture();
  let retry: HTMLButtonElement;
  const load = vi.fn(() => {
    if (load.mock.calls.length === 1) return Promise.reject(Error("synthetic"));
    retry.click();
    return Promise.resolve();
  });
  record.load = load;
  wrapper = await render(model);
  await click("编辑");
  const dialog = wrapper.get('[role="dialog"]');
  const retryButton = () =>
    dialog.findAll("button").find((item) => item.text() === "重试读取");
  retry = retryButton()!.element as HTMLButtonElement;
  await retryButton()!.trigger("click");
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(2);
  expect(retryButton()).toBeUndefined();
  expect(input("名称").element.closest("[inert]")).toBeNull();
});

it("offers a retry when permission returns after invalidating a pending read", async () => {
  const { model, record, name } = fixture();
  const pending = deferred();
  const read = vi
    .fn()
    .mockImplementationOnce(() => pending.promise)
    .mockImplementationOnce(async () => {
      name.value = "重试后的值";
    });
  record.load = read;
  wrapper = await render(model);
  await click("编辑");
  record.readable = false;
  await flushPromises();
  pending.resolve();
  await flushPromises();
  record.readable = true;
  await flushPromises();
  await click("重试读取");
  expect(read).toHaveBeenCalledTimes(2);
  expect(input("名称").element.value).toBe("重试后的值");
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
