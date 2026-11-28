import { afterEach, expect, it, vi } from "vitest";
import { watch } from "vue";
import { flushPromises } from "@vue/test-utils";
import type { ObjectNode, RecordsNode } from "../src/model";
import { domainOf, field, fixture, object } from "./fixtures/static-model";
import { click, input, render, route } from "./fixtures/static-host";

let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

function setup() {
  const f = fixture();
  const offPage = object("off-page", "外页记录", [
    field("name", "名称", "外页"),
  ]);
  const shortcut = object("shortcut", "快捷入口", [
    field("title", "名称", "最近记录"),
  ]);
  const records = (key: string, items: ObjectNode[] = []): RecordsNode => ({
    kind: "records",
    key,
    label: key,
    items,
    readOnly: true,
    selected: null,
    operations: {},
  });
  f.model.work.workbench = {
    key: "home",
    label: "工作台",
    information: records("信息"),
    vouchers: records("单据", [shortcut]),
    reports: records("报表"),
    masters: records("资料"),
    targets: new Map([[shortcut, { collection: f.rows, record: offPage }]]),
    manageReports: { collection: f.rows },
  };
  return { ...f, offPage, shortcut, workbench: f.model.work.workbench };
}

it("builds the workbench caption in readable member order", async () => {
  const f = setup();
  f.shortcut.members = [
    field("z-name", "名称", "最近记录"),
    field("a-count", "数量", "0"),
    { ...field("restricted", "权限字段", "无权摘要"), readable: false },
  ];
  wrapper = await render(f.model);
  expect(wrapper.get('.zerp-workbench [aria-label="单据"] button').text()).toBe(
    "最近记录 · 0",
  );
});

it("opens an off-page workbench record without navigating or reading its list", async () => {
  const f = setup();
  const read = vi.fn(async () => {});
  const list = vi.fn(async () => {});
  f.offPage.load = read;
  f.rows.load = list;
  wrapper = await render(f.model);
  expect(f.rows.selected).toBeNull();
  const manage = wrapper.findAll("a").find((a) => a.text() === "管理常用报表");
  expect(manage?.attributes("href")).toBe("/app/rows");
  await click("最近记录");
  expect(window.location.pathname).toBe("/app/");
  expect(f.rows.items).not.toContain(f.offPage);
  expect(read).toHaveBeenCalledExactlyOnceWith("off-page");
  expect(list).not.toHaveBeenCalled();
  expect(
    document.querySelector('[role="dialog"][aria-label="外页记录"]'),
  ).not.toBeNull();
});

it("drops an off-page window when selection synchronously changes the session", async () => {
  const f = setup();
  const stop = watch(
    () => f.rows.selected,
    (record) => {
      if (record === f.offPage)
        f.model.session = { state: "recovering", owner: null };
    },
    { flush: "sync" },
  );
  const read = vi.fn(async () => {});
  f.offPage.load = read;
  try {
    wrapper = await render(f.model);
    await click("最近记录");
    expect(read).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.location.pathname).toBe("/app/");
  } finally {
    stop();
  }
});

it.each(["revoked", "removed", "replaced", "renamed"] as const)(
  "rechecks the rendered workbench target when it is %s",
  async (change) => {
    const f = setup();
    wrapper = await render(f.model);
    const oldButton = wrapper.get('.zerp-workbench [aria-label="单据"] button');
    if (change === "revoked") f.offPage.readable = false;
    if (change === "removed") f.workbench.targets = new Map();
    if (change === "replaced")
      f.workbench.targets = new Map([
        [f.shortcut, { collection: f.rows, record: f.record }],
      ]);
    if (change === "renamed") f.offPage.identity = "changed";
    await oldButton.trigger("click");
    expect(f.rows.selected).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.location.pathname).toBe("/app/");
  },
);

it("rejects a window target owned by a different root", async () => {
  const f = setup();
  const other = fixture().rows;
  other.key = "other";
  other.items = [f.offPage];
  f.model.work.members.push(domainOf(other));
  wrapper = await render(f.model);
  expect(wrapper.text()).not.toContain("最近记录");
  expect(f.rows.selected).toBeNull();
});

it.each(["opens", "disables", "removes", "replaces", "renames"] as const)(
  "guards the rendered report record action when it %s",
  async (change) => {
    const f = setup();
    const cell = {
      row: f.record,
      field: "name",
      kind: "record" as const,
      label: "打开凭证",
      target: { collection: f.rows, record: f.offPage },
      disabled: false,
    };
    f.rows.report = { cells: [cell] };
    route(f.rows);
    wrapper = await render(f.model);
    const action = wrapper.get('button[aria-label="打开凭证"]');
    if (change === "disables") f.rows.report.cells![0]!.disabled = true;
    if (change === "removes") f.rows.report.cells = [];
    if (change === "replaces")
      f.rows.report.cells = [
        { ...cell, target: { collection: f.rows, record: f.record } },
      ];
    if (change === "renames") f.offPage.identity = "changed";
    await action.trigger("click");
    await flushPromises();
    expect(window.location.pathname).toBe("/app/rows");
    expect(f.rows.selected).toBe(change === "opens" ? f.offPage : null);
  },
);

it("dispatches app URLs to page navigation or existing record windows", async () => {
  const f = setup();
  const voucher = fixture().rows;
  voucher.key = "AB";
  voucher.label = "AB 单据";
  voucher.items = [];
  f.model.work.members.push(voucher);
  const cell = field("name", "单据名称", "原值");
  const row: ObjectNode = {
    ...object("560009", "AB 记录", [cell]),
    family: "voucher",
    type: "AB",
    businessType: "voucher.AB",
  };
  row.operations.update = { disabled: false, run: vi.fn() };
  const other = {
    ...row,
    key: "560010",
    identity: "560010",
    label: "另一张 AB",
  };
  row.load = vi.fn(async () => {});
  other.load = vi.fn(async () => {});
  voucher.resolveRecord = vi.fn((id) =>
    id === "560009" ? row : id === "560010" ? other : undefined,
  );
  voucher.load = vi.fn(async () => {});
  f.rows.resolveRecord = vi.fn((id) =>
    id === "off-page" ? f.offPage : undefined,
  );

  wrapper = await render(f.model);
  const historyLength = window.history.length;
  expect(wrapper.vm.openUrl("/app/AB?id=560009")).toBe(true);
  await flushPromises();
  expect(window.location.pathname).toBe("/app/");
  expect(window.history.length).toBe(historyLength);
  expect(row.load).toHaveBeenCalledExactlyOnceWith("560009");
  expect(voucher.load).not.toHaveBeenCalled();
  expect(voucher.items).toHaveLength(0);
  await click("编辑");
  await input("单据名称").setValue("未保存");
  expect(wrapper.vm.openUrl("/app/AB?id=560010")).toBe(true);
  await flushPromises();
  expect(other.load).not.toHaveBeenCalled();
  await click("取消");
  expect(input("单据名称").element.value).toBe("未保存");
  expect(window.location.pathname).toBe("/app/");

  expect(wrapper.vm.openUrl("/app/rows?id=off-page")).toBe(true);
  await flushPromises();
  expect(f.rows.selected).toBe(f.offPage);
  expect(window.location.pathname).toBe("/app/");
  await click("关闭");

  expect(wrapper.vm.openUrl("/app/rows")).toBe(true);
  await flushPromises();
  expect(window.location.pathname).toBe("/app/rows");
  expect(wrapper.vm.openUrl("/app/AB?id=560009&id=560010")).toBe(false);
  expect(wrapper.vm.openUrl("/app/AB?id=560009&tab=other")).toBe(false);
  expect(wrapper.vm.openUrl("https://example.invalid/app/AB?id=560010")).toBe(
    false,
  );
  expect(wrapper.vm.openUrl("/app/missing?id=560010")).toBe(false);
  voucher.readable = false;
  expect(wrapper.vm.openUrl("/app/AB?id=560010")).toBe(false);
  expect(other.load).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/app/rows");
});
