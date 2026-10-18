import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { ReportView, defineReport } from "../src/index";

const definition = () =>
  defineReport({
    resource: "synthetic-report",
    title: "合成报表",
    parameters: [{ key: "keyword", type: "text", label: "关键字" }],
    initialParameters: () => ({ keyword: "初始" }),
    columns: [
      { key: "amount", label: "金额", type: "decimal", width: "12rem" },
    ],
    adapter: {
      query: vi.fn(
        async (_input: {
          scope: string;
          parameters: { keyword: string };
          page: number;
          pageSize: number;
        }) => ({ items: [{ amount: "9007199254740993.0100" }], hasMore: true }),
      ),
    },
  });
const button = (w: ReturnType<typeof mount>, name: string) =>
  w.findAll("button").find((b) => b.text() === name)!;
const click = async (w: ReturnType<typeof mount>, name: string) => {
  await button(w, name).trigger("click");
  await flushPromises();
};
const start = (d = definition()) =>
  mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: true },
      pageSize: 2,
    },
  });
it("submits parameters explicitly and pages using the submitted snapshot without inventing a total", async () => {
  const d = definition(),
    w = start(d);
  expect(d.adapter.query).not.toHaveBeenCalled();
  await w.get('input[aria-label="关键字"]').setValue("已提交");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(w.text()).toContain("9007199254740993.0100");
  expect(w.text()).not.toContain("共 ");
  expect(w.get("th").attributes("style")).toContain("width: 12rem");
  await w.get('input[aria-label="关键字"]').setValue("未提交");
  await click(w, "下一页");
  expect(d.adapter.query).toHaveBeenLastCalledWith({
    scope: "a",
    parameters: { keyword: "已提交" },
    page: 2,
    pageSize: 2,
  });
  w.unmount();
});
it("renders Chinese enums and visible columns, and validates a date range before a total query", async () => {
  const d = defineReport({
    resource: "range",
    title: "范围报表",
    parameters: [
      { key: "range", type: "date-range", label: "期间", required: true },
    ],
    initialParameters: () => ({ range: ["2026-10-01", "2026-10-31"] }),
    columns: [
      {
        key: "state",
        label: "状态",
        type: "enum",
        options: [{ value: "ok", label: "已完成" }],
      },
      { key: "secret", label: "隐藏列", visible: false },
    ],
    adapter: {
      query: vi.fn(async () => ({
        items: [{ state: "ok", secret: "不可见" }],
        total: 1,
      })),
    },
  });
  const w = mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: false },
    },
  });
  await w.get('input[aria-label="期间止"]').setValue("2026-09-30");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(d.adapter.query).not.toHaveBeenCalled();
  expect(w.get('[role="alert"]').text()).toContain("期间");
  await w.get('input[aria-label="期间止"]').setValue("2026-10-31");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(w.text()).toContain("已完成");
  expect(w.text()).toContain("共 1 条");
  expect(w.text()).not.toContain("隐藏列");
  expect(w.text()).not.toContain("不可见");
  expect(button(w, "下一页").attributes("disabled")).toBeDefined();
  w.unmount();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
it("retries a failed query with its original page and parameters, and shows an empty result", async () => {
  const d = definition(),
    w = start(d);
  vi.mocked(d.adapter.query!).mockRejectedValueOnce(new Error("合成查询失败"));
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(w.get('[role="alert"]').text()).toContain("合成查询失败");
  expect(w.text()).not.toContain("暂无数据");
  await w.get('input[aria-label="关键字"]').setValue("未提交修改");
  vi.mocked(d.adapter.query!).mockResolvedValueOnce({
    items: [],
    hasMore: false,
  });
  await click(w, "重试查询");
  expect(d.adapter.query).toHaveBeenLastCalledWith(
    expect.objectContaining({ parameters: { keyword: "初始" }, page: 1 }),
  );
  expect(w.text()).toContain("暂无数据");
  expect(button(w, "下一页").attributes("disabled")).toBeDefined();
  w.unmount();
});
it("ignores out-of-order queries and invalidates requests on scope, resource and permission changes", async () => {
  const d = definition(),
    w = start(d);
  const old = deferred<{ items: { amount: string }[]; hasMore: boolean }>();
  vi.mocked(d.adapter.query!).mockReturnValueOnce(old.promise);
  await w.get("form").trigger("submit");
  expect(w.text()).toContain("正在查询");
  await w.get('input[aria-label="关键字"]').setValue("新查询");
  await w.get("form").trigger("submit");
  await flushPromises();
  old.resolve({ items: [{ amount: "迟到" }], hasMore: false });
  await flushPromises();
  expect(w.text()).not.toContain("迟到");
  for (const change of [
    { scope: "b" },
    { definition: { ...d, resource: "other" } },
    { permissions: { query: false, export: false } },
  ]) {
    const late = deferred<{ items: { amount: string }[]; hasMore: boolean }>();
    vi.mocked(d.adapter.query!).mockReturnValueOnce(late.promise);
    await w.get("form").trigger("submit");
    await w.setProps(change);
    late.resolve({ items: [{ amount: "跨界旧结果" }], hasMore: false });
    await flushPromises();
    expect(w.text()).not.toContain("跨界旧结果");
    expect(w.text()).not.toContain("正在查询");
  }
  expect(w.text()).toContain("没有可用的报表操作");
  w.unmount();
});
it("exports validated current input with export-only eligibility and isolates a late download", async () => {
  const createURL = vi.fn(() => "blob:synthetic");
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createURL;
      static revokeObjectURL = vi.fn();
    },
  );
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  try {
    const exported = vi.fn(
      async (_input: { scope: string; parameters: { keyword: string } }) => ({
        content: new Blob(["合成内容"]),
        filename: "report.csv",
      }),
    );
    const d = { ...definition(), adapter: { export: exported } };
    const w = mount(ReportView as Component, {
      props: {
        definition: d,
        scope: "a",
        permissions: { query: false, export: true },
      },
    });
    expect(w.findAll("button").some((b) => b.text() === "查询")).toBe(false);
    await w.get('input[aria-label="关键字"]').setValue("导出输入");
    await click(w, "导出");
    expect(exported).toHaveBeenLastCalledWith({
      scope: "a",
      parameters: { keyword: "导出输入" },
    });
    expect(download).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:synthetic");
    const late = deferred<import("../src/index").ReportExport>();
    exported.mockReturnValueOnce(late.promise);
    await click(w, "导出");
    expect(button(w, "导出").attributes("disabled")).toBeDefined();
    await w.setProps({ scope: "b" });
    late.resolve({ content: new Blob(["旧"]), filename: "old.csv" });
    await flushPromises();
    expect(download).toHaveBeenCalledTimes(1);
    expect(w.text()).not.toContain("导出已准备");
    exported.mockRejectedValueOnce(new Error("合成导出失败"));
    await click(w, "导出");
    expect(w.get('[role="alert"]').text()).toContain("合成导出失败");
    await click(w, "导出");
    expect(download).toHaveBeenCalledTimes(2);
    w.unmount();
  } finally {
    download.mockRestore();
    vi.unstubAllGlobals();
  }
});
it("keeps incomplete decimals in the input and rejects malformed result values with stable feedback", async () => {
  const query = vi.fn(async () => ({
    items: [{ amount: "not-a-decimal" }],
    total: 1,
  }));
  const d = defineReport({
    resource: "decimal",
    title: "十进制",
    parameters: [{ key: "minimum", type: "decimal", label: "下限" }],
    initialParameters: () => ({ minimum: "0.0100" }),
    columns: [{ key: "amount", label: "金额", type: "decimal" }],
    adapter: { query },
  });
  const w = mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: false },
    },
  });
  await w.get('input[aria-label="下限"]').setValue("-.");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(query).not.toHaveBeenCalled();
  expect(w.get('input[aria-label="下限"]').element).toHaveProperty(
    "value",
    "-.",
  );
  await w.get('input[aria-label="下限"]').setValue("9007199254740993.0100");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(w.get('[role="alert"]').text()).toContain("金额");
  expect(w.text()).not.toContain("not-a-decimal");
  query.mockResolvedValueOnce({
    items: [{ amount: "9007199254740993.0100" }],
    total: 1,
  });
  await click(w, "重试查询");
  expect(w.text()).toContain("9007199254740993.0100");
  w.unmount();
});
it("restores an optional date range to null after clearing, while rejecting a partial range", async () => {
  const query = vi.fn(
    async (_input: {
      scope: string;
      parameters: { range: string[] | null };
      page: number;
      pageSize: number;
    }) => ({ items: [], hasMore: false }),
  );
  const d = defineReport<{ range: string[] | null }, { name: string }>({
    resource: "optional-range",
    title: "可选范围",
    parameters: [{ key: "range", type: "date-range", label: "日期" }],
    initialParameters: () => ({ range: null }),
    columns: [{ key: "name", label: "名称" }],
    adapter: { query },
  });
  const w = mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: false },
    },
  });
  await w.get('input[aria-label="日期起"]').setValue("2026-10-01");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(query).not.toHaveBeenCalled();
  await w.get('input[aria-label="日期止"]').setValue("2026-10-31");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({
      parameters: { range: ["2026-10-01", "2026-10-31"] },
    }),
  );
  await w.get('input[aria-label="日期起"]').setValue("");
  await w.get('input[aria-label="日期止"]').setValue("");
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(query).toHaveBeenLastCalledWith(
    expect.objectContaining({ parameters: { range: null } }),
  );
  expect(w.find('[role="alert"]').exists()).toBe(false);
  w.unmount();
});
