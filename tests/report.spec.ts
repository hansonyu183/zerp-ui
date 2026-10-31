import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { defineReport } from "../src/index";
import DataList from "../src/DataList.vue";
import ReportView from "../src/ReportView.vue";

const definition = () =>
  defineReport({
    kind: "parameter",
    rowKey: (row: { amount: string }) => row.amount,
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
  w
    .findAll("button")
    .find((b) => b.text() === name || b.attributes("aria-label") === name)!;
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
    kind: "parameter",
    rowKey: (row: { state: string; secret: string }) => row.secret,
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
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
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
    kind: "parameter",
    rowKey: (row: { amount: string }) => row.amount,
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
    kind: "parameter",
    rowKey: (row) => row.name,
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

it("keeps a fixed result and authoritative totals tied to applied inputs across paging and failed replacement", async () => {
  const d = defineReport({
    kind: "fixed",
    resource: "fixed",
    title: "固定报表",
    parameters: [{ key: "keyword", type: "text", label: "关键字" }],
    initialParameters: () => ({ keyword: "原条件" }),
    rowKey: (r: { id: string; amount: string }) => r.id,
    columns: [{ key: "amount", label: "金额", type: "decimal" }],
    adapter: {
      query: vi.fn(async () => ({
        id: "result-1",
        items: [{ id: "row-1", amount: "1.0000" }],
        total: 4,
        summary: { caption: "全结果合计", values: { amount: "999.0000" } },
        context: "业务日期 10-22",
      })),
      page: vi.fn(async () => ({
        items: [{ id: "row-2", amount: "2.0000" }],
        total: 4,
      })),
      revalidate: vi.fn(async () => ({ status: "valid" as const })),
    },
  });
  const w = mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: true },
      pageSize: 1,
    },
  });
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(w.text()).toContain("999.0000");
  await w.get('input[aria-label="关键字"]').setValue("未查询");
  await click(w, "下一页");
  expect(d.adapter.page).toHaveBeenCalledWith(
    expect.objectContaining({ resultId: "result-1", page: 2, scope: "a" }),
  );
  vi.mocked(d.adapter.query).mockRejectedValueOnce(new Error("新查询失败"));
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(w.text()).toContain("2.0000");
  expect(w.text()).toContain("原条件");
  expect(w.text()).toContain("999.0000");
  expect(w.text()).toContain("仍显示上次成功结果");
  w.unmount();
});

type FixedParameters = { keyword: string };
type FixedRow = {
  id: string;
  name: string;
  amount: string;
  flag: boolean;
  empty: string;
  missing: string | null;
};
const fixedDefinition = () =>
  defineReport<
    FixedParameters,
    FixedRow,
    { token: string },
    string,
    { record: string }
  >({
    kind: "fixed",
    resource: "snapshot",
    title: "固定结果",
    parameters: [{ key: "keyword", type: "text", label: "关键字" }],
    initialParameters: () => ({ keyword: "初始" }),
    rowKey: (row) => row.id,
    columns: [
      { key: "name", label: "名称", width: "30rem" },
      { key: "amount", label: "金额", type: "decimal", width: "25rem" },
      { key: "flag", label: "标记", type: "boolean" },
      { key: "empty", label: "空文本" },
      { key: "missing", label: "缺失" },
      { key: "id", label: "隐藏", visible: false },
    ],
    cell: (row, key) =>
      key === "name"
        ? {
            kind: "record",
            target: { record: row.id },
            href: `#${row.id}`,
            label: `查看 ${row.id}`,
          }
        : key === "amount"
          ? {
              kind: "detail",
              target: { record: row.id },
              label: `明细 ${row.id}`,
            }
          : key === "flag"
            ? {
                kind: "select",
                target: { record: row.id },
                label: `选择 ${row.id}`,
              }
            : undefined,
    adapter: {
      query: vi.fn(async () => ({
        id: { token: "result-1" },
        items: [
          {
            id: "r1",
            name: "异常原值 -.x",
            amount: "9007199254740993.0100",
            flag: false,
            empty: "",
            missing: null,
          },
        ],
        hasMore: true,
        summary: {
          caption: "全结果 · 按查询时口径",
          values: { amount: "99999999999999999.0100" },
        },
        context: "查询时业务日期",
      })),
      page: vi.fn(async () => ({
        items: [
          {
            id: "r2",
            name: "第二页",
            amount: "0",
            flag: false,
            empty: "",
            missing: null,
          },
        ],
        hasMore: false,
      })),
      export: vi.fn(async () => ({
        content: new Blob(["完整固定结果"]),
        filename: "fixed.csv",
      })),
      revalidate: vi.fn(async () => ({ status: "valid" as const })),
      cancel: vi.fn(async () => ({ status: "cancelled" as const })),
    },
  });
const fixedStart = (d = fixedDefinition()) =>
  mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: true },
      pageSize: 1,
    },
  });
const submit = async (w: ReturnType<typeof mount>) => {
  await w.get("form").trigger("submit");
  await flushPromises();
};
it("uses stable rows, raw values, typed drill intents and original result definition for a complete fixed export", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  const anchor = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:fixed");
      static revokeObjectURL = vi.fn();
    },
  );
  try {
    await submit(w);
    expect(w.findAll("th").map((x) => x.text())).toEqual([
      "名称",
      "金额",
      "标记",
      "空文本",
      "缺失",
    ]);
    expect(w.text()).toContain("异常原值 -.x");
    expect(w.text()).toContain("否");
    expect(w.text()).toContain("（空字符串）");
    expect(w.text()).toContain("—");
    expect(w.get("a").attributes("href")).toBe("#r1");
    await w.get("a").trigger("click", { metaKey: true });
    expect(w.emitted("drill")).toBeUndefined();
    await w.get("a").trigger("click");
    await click(w, "9007199254740993.0100");
    await click(w, "否");
    expect(w.emitted("drill")?.map((x) => x[0])).toEqual(
      ["record", "detail", "select"].map((kind) =>
        expect.objectContaining({
          scope: "a",
          resource: "snapshot",
          resultId: { token: "result-1" },
          rowId: "r1",
          cell: expect.objectContaining({ kind, target: { record: "r1" } }),
        }),
      ),
    );
    await w.get('input[aria-label="关键字"]').setValue("未查询的新输入");
    await w.setProps({
      definition: { ...d, columns: [{ key: "amount", label: "新的解释" }] },
    });
    expect(w.text()).toContain("按查询时口径");
    expect(w.text()).not.toContain("新的解释");
    await click(w, "导出");
    expect(d.adapter.export).toHaveBeenCalledWith({
      scope: "a",
      resultId: { token: "result-1" },
      signal: expect.any(AbortSignal),
    });
    expect(anchor).toHaveBeenCalledTimes(1);
  } finally {
    w.unmount();
    anchor.mockRestore();
    vi.unstubAllGlobals();
  }
});
it("restores the applied page and both scroll axes only after revalidation, and clears authoritative expiry", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  await submit(w);
  await click(w, "下一页");
  const scroller = w.get(".zerp-report-scroll").element;
  scroller.scrollLeft = 231;
  scroller.scrollTop = 83;
  await w.setProps({ active: false });
  const saved = w.emitted("snapshot")!.at(-1)![0];
  w.unmount();
  const check = deferred<{ status: "valid" }>();
  vi.mocked(d.adapter.revalidate).mockReturnValueOnce(check.promise);
  const restored = mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      pageSize: 1,
      permissions: { query: true, export: true },
      restore: saved,
    },
  });
  expect(restored.text()).not.toContain("第二页");
  expect(restored.text()).toContain("结果待重验");
  expect(button(restored, "导出").attributes("disabled")).toBeDefined();
  expect(restored.find("table").exists()).toBe(false);
  expect(restored.find("a").exists()).toBe(false);
  check.resolve({ status: "valid" });
  await flushPromises();
  expect(restored.get(".zerp-report-scroll").element.scrollLeft).toBe(231);
  expect(restored.get(".zerp-report-scroll").element.scrollTop).toBe(83);
  expect(restored.text()).toContain("第 2 页");
  await restored.setProps({ active: false });
  vi.mocked(d.adapter.revalidate).mockResolvedValueOnce({
    status: "expired",
  });
  await restored.setProps({ active: true });
  await flushPromises();
  expect(restored.text()).not.toContain("第二页");
  expect(restored.text()).toContain("结果已失效");
  restored.unmount();
});
it("retains a pending revalidation screen on transport failure and rejects responses after a scope change", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  await submit(w);
  await w.setProps({ active: false });
  vi.mocked(d.adapter.revalidate).mockRejectedValueOnce(new Error("连接中断"));
  await w.setProps({ active: true });
  await flushPromises();
  expect(w.text()).toContain("连接中断");
  expect(w.text()).not.toContain("异常原值 -.x");
  expect(button(w, "导出").attributes("disabled")).toBeDefined();
  const check = deferred<{ status: "valid" }>();
  vi.mocked(d.adapter.revalidate).mockReturnValueOnce(check.promise);
  await button(w, "重验结果").trigger("click");
  await w.setProps({ scope: "b" });
  check.resolve({ status: "valid" });
  await flushPromises();
  expect(w.text()).not.toContain("异常原值 -.x");
  expect(w.text()).not.toContain("结果待重验");
  w.unmount();
});
it.each(["cancelled", "completed", "failed", "cleanup-unconfirmed"] as const)(
  "separates local abort from server cancellation: %s",
  async (status) => {
    const d = fixedDefinition(),
      w = fixedStart(d);
    const waiting = deferred<Awaited<ReturnType<typeof d.adapter.query>>>();
    vi.mocked(d.adapter.query).mockReturnValueOnce(waiting.promise);
    const cancellation = deferred<{ status: typeof status }>();
    vi.mocked(d.adapter.cancel!).mockReturnValueOnce(cancellation.promise);
    await w.get("form").trigger("submit");
    const request = vi.mocked(d.adapter.query).mock.calls[0][0];
    await click(w, "停止等待");
    expect(request.signal.aborted).toBe(true);
    expect(w.text()).toContain("服务端执行未确认取消");
    expect(d.adapter.cancel).not.toHaveBeenCalled();
    await button(w, "取消服务端查询").trigger("click");
    expect(w.text()).toContain("正在请求服务端取消");
    expect(d.adapter.cancel).toHaveBeenCalledWith({
      scope: "a",
      requestId: request.requestId,
    });
    cancellation.resolve({ status });
    await flushPromises();
    expect(w.text()).toContain(
      {
        cancelled: "服务端已取消",
        completed: "服务端已完成，未取消",
        failed: "服务端执行失败",
        "cleanup-unconfirmed": "服务端清理未确认",
      }[status],
    );
    waiting.resolve({
      id: { token: "late" },
      items: [],
      hasMore: false,
      summary: { caption: "迟到合计", values: {} },
      context: "迟到",
    });
    await flushPromises();
    expect(w.text()).not.toContain("迟到合计");
    w.unmount();
  },
);
it("clears revoked results on export and isolates late page and download responses from replacement results", async () => {
  const { ReportUnavailable } = await import("../src/index");
  const d = fixedDefinition(),
    w = fixedStart(d);
  await submit(w);
  const oldPage = deferred<Awaited<ReturnType<typeof d.adapter.page>>>();
  vi.mocked(d.adapter.page).mockReturnValueOnce(oldPage.promise);
  await button(w, "下一页").trigger("click");
  await submit(w);
  oldPage.resolve({
    items: [
      {
        id: "wrong",
        name: "迟到旧页",
        amount: "0",
        flag: false,
        empty: "",
        missing: null,
      },
    ],
    hasMore: false,
  });
  await flushPromises();
  expect(w.text()).not.toContain("迟到旧页");
  vi.mocked(d.adapter.export!).mockRejectedValueOnce(
    new ReportUnavailable("forbidden", "撤权"),
  );
  await click(w, "导出");
  expect(w.text()).not.toContain("异常原值 -.x");
  expect(w.text()).toContain("撤权");
  w.unmount();
});

it("discards a late fixed download when a replacement query adopts another result", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  const create = vi.fn(() => "blob:late");
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = vi.fn();
    },
  );
  try {
    await submit(w);
    const download = deferred<{ content: Blob; filename: string }>();
    vi.mocked(d.adapter.export!).mockReturnValueOnce(download.promise);
    await button(w, "导出").trigger("click");
    await submit(w);
    download.resolve({ content: new Blob(["旧结果"]), filename: "old.csv" });
    await flushPromises();
    expect(create).not.toHaveBeenCalled();
    expect(w.text()).not.toContain("导出已准备");
    expect(w.text()).toContain("9007199254740993.0100");
  } finally {
    w.unmount();
    vi.unstubAllGlobals();
  }
});
it.each(["forbidden", "identity-invalid"] as const)(
  "clears authoritative %s on return and cannot restore a foreign session",
  async (status) => {
    const d = fixedDefinition(),
      w = fixedStart(d);
    await submit(w);
    await w.setProps({ active: false });
    const saved = w.emitted("snapshot")!.at(-1)![0];
    vi.mocked(d.adapter.revalidate).mockResolvedValueOnce({ status });
    await w.setProps({ active: true });
    await flushPromises();
    expect(w.text()).not.toContain("异常原值 -.x");
    w.unmount();
    vi.mocked(d.adapter.revalidate).mockClear();
    const other = mount(ReportView as Component, {
      props: {
        definition: d,
        scope: "other",
        pageSize: 1,
        permissions: { query: true, export: true },
        restore: saved,
      },
    });
    expect(other.text()).not.toContain("异常原值 -.x");
    expect(d.adapter.revalidate).not.toHaveBeenCalled();
    other.unmount();
  },
);
it("keeps a successful parameter page and its context when the next page fails", async () => {
  const d = definition(),
    w = start(d);
  await submit(w);
  vi.mocked(d.adapter.query!).mockRejectedValueOnce(new Error("分页失败"));
  await click(w, "下一页");
  expect(w.text()).toContain("第 1 页");
  expect(w.text()).toContain("9007199254740993.0100");
  expect(w.text()).toContain("仍显示上次成功结果");
  await w.get('input[aria-label="关键字"]').setValue("未采用");
  await click(w, "重试查询");
  expect(d.adapter.query).toHaveBeenLastCalledWith({
    scope: "a",
    parameters: { keyword: "初始" },
    page: 2,
    pageSize: 2,
  });
  w.unmount();
});

it("captures columns and cell actions when querying, before an in-place definition edit", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  const waiting = deferred<Awaited<ReturnType<typeof d.adapter.query>>>();
  vi.mocked(d.adapter.query).mockReturnValueOnce(waiting.promise);
  await w.get("form").trigger("submit");
  d.columns[0].label = "后来改名";
  d.cell = (row) => ({
    kind: "record",
    href: "#wrong",
    target: { record: row.id },
    label: "后来改动作",
  });
  waiting.resolve({
    id: { token: "original" },
    items: [
      {
        id: "r1",
        name: "原结果",
        amount: "1.0100",
        flag: false,
        empty: "",
        missing: null,
      },
    ],
    total: 1,
    summary: { caption: "原口径", values: { amount: "100.0100" } },
    context: "原上下文",
  });
  await flushPromises();
  expect(w.findAll("th")[0].text()).toBe("名称");
  expect(w.get("a").attributes("href")).toBe("#r1");
  expect(w.text()).not.toContain("后来改名");
  w.unmount();
});
it("does not restore scroll from a stale revalidation into a replacement scope result", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  await submit(w);
  await w.setProps({ active: false });
  const check = deferred<{ status: "valid" }>();
  vi.mocked(d.adapter.revalidate).mockReturnValueOnce(check.promise);
  await w.setProps({ active: true });
  await w.setProps({ scope: "new-session" });
  await submit(w);
  const scroller = w.get(".zerp-report-scroll").element;
  scroller.scrollLeft = 70;
  scroller.scrollTop = 31;
  check.resolve({ status: "valid" });
  await flushPromises();
  expect(scroller.scrollLeft).toBe(70);
  expect(scroller.scrollTop).toBe(31);
  w.unmount();
});

it("requeries a returning parameter report at the applied page and restores both scroll axes", async () => {
  const d = definition(),
    w = start(d);
  await submit(w);
  await click(w, "下一页");
  await w.get('input[aria-label="关键字"]').setValue("尚未查询");
  const scroller = w.get(".zerp-report-scroll").element;
  scroller.scrollLeft = 123;
  scroller.scrollTop = 56;
  await w.setProps({ active: false });
  await w.setProps({ active: true });
  await flushPromises();
  expect(d.adapter.query).toHaveBeenLastCalledWith({
    scope: "a",
    parameters: { keyword: "初始" },
    page: 2,
    pageSize: 2,
  });
  expect(w.get(".zerp-report-scroll").element.scrollLeft).toBe(123);
  expect(w.get(".zerp-report-scroll").element.scrollTop).toBe(56);
  expect(w.get('input[aria-label="关键字"]').element).toHaveProperty(
    "value",
    "尚未查询",
  );
  w.unmount();
});

it("adopts query columns and isolated result notifications while input and later definitions remain separate", async () => {
  const d = fixedDefinition();
  const original = await d.adapter.query({
    scope: "a",
    parameters: { keyword: "初始" },
    page: 1,
    pageSize: 1,
    requestId: "fixture",
    signal: new AbortController().signal,
  });
  const columns = [
    { key: "amount" as const, label: "本次精确额", type: "decimal" as const },
  ];
  vi.mocked(d.adapter.query).mockResolvedValueOnce({ ...original, columns });
  const w = fixedStart(d);
  try {
    await submit(w);
    expect(w.get("th").text()).toBe("本次精确额");
    const adopted = w.emitted("adopted")!.at(-1)![0] as {
      parameters: FixedParameters;
      resultId: { token: string };
    };
    expect(adopted).toEqual({
      parameters: { keyword: "初始" },
      resultId: { token: "result-1" },
    });
    adopted.parameters.keyword = "外部修改";
    adopted.resultId.token = "外部身份";
    columns[0]!.label = "改变返回对象";
    d.columns[0]!.label = "改变当前定义";
    await w.get('input[aria-label="关键字"]').setValue("未查询条件");
    expect(w.emitted("parameters")!.at(-1)).toEqual([
      { keyword: "未查询条件" },
    ]);
    expect(w.text()).toContain("当前条件尚未查询");
    await click(w, "下一页");
    expect(d.adapter.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ resultId: { token: "result-1" } }),
    );
    expect(w.get("th").text()).toBe("本次精确额");
    expect(w.emitted("adopted")!.at(-1)![0]).toEqual({
      parameters: { keyword: "初始" },
      resultId: { token: "result-1" },
    });
    await w.setProps({ scope: "other" });
    expect(w.emitted("adopted")!.at(-1)).toEqual([null]);
  } finally {
    w.unmount();
  }
});

it("renders finite presentation and authoritative group segments using exact numeric and string row identities", async () => {
  const w = mount(DataList as Component, {
    props: {
      columns: [{ key: "amount", label: "金额", type: "decimal" }],
      result: {
        items: [
          { id: 1, amount: "1.00" },
          { id: "1", amount: "2.00" },
        ],
        total: 2,
      },
      rowKey: (row: { id: string | number }) => row.id,
      page: 1,
      pageSize: 2,
      presentation: {
        rows: [
          {
            rowId: 1,
            appearance: { foreground: "#112233", bold: true },
            cells: { amount: { bold: false, italic: true, align: "right" } },
          },
          { rowId: "1", cells: { amount: { background: "#ddeeff" } } },
        ],
        groups: [
          {
            id: "outer",
            label: "全部",
            level: 0,
            firstKey: 1,
            lastKey: "1",
            continuedBefore: true,
            continuedAfter: true,
            summary: { caption: "权威全组", values: { amount: "99.00" } },
          },
          {
            id: "inner",
            label: "子组",
            level: 1,
            firstKey: 1,
            lastKey: 1,
            continuedBefore: true,
            continuedAfter: false,
            summary: { caption: "权威子组", values: { amount: "44.00" } },
          },
        ],
      },
    },
  });
  try {
    expect(w.findAll("tbody th").map((node) => node.text())).toEqual([
      "全部（续）",
      "子组（续）",
    ]);
    const cells = w.findAll('td[data-label="金额"]');
    expect(cells[0]!.attributes("style")).toContain("color: rgb(17, 34, 51)");
    expect(cells[0]!.attributes("style")).toContain("font-weight: normal");
    expect(cells[0]!.attributes("style")).toContain("font-style: italic");
    expect(cells[0]!.attributes("style")).toContain("text-align: right");
    expect(w.text()).toContain("权威全组（续）99.00");
    expect(w.text()).toContain("权威子组44.00");
    expect(
      cells.find((cell) => cell.text() === "2.00")!.attributes("style"),
    ).toContain("background-color: rgb(221, 238, 255)");
  } finally {
    w.unmount();
  }
});

const validPresentation = () => ({
  rows: [{ rowId: "r1", cells: { amount: { foreground: "#112233" } } }],
  groups: [
    {
      id: "group",
      label: "分组",
      level: 0,
      firstKey: "r1",
      lastKey: "r2",
      continuedBefore: false,
      continuedAfter: false,
      summary: { caption: "权威小计", values: { amount: "9.00" } },
    },
  ],
});
for (const [name, mutate] of [
  [
    "unknown row",
    (p: any) => {
      p.rows[0].rowId = "foreign";
    },
  ],
  [
    "duplicate row fact",
    (p: any) => {
      p.rows.push(p.rows[0]);
    },
  ],
  [
    "unknown cell",
    (p: any) => {
      p.rows[0].cells.foreign = {};
    },
  ],
  [
    "unsafe color",
    (p: any) => {
      p.rows[0].cells.amount.foreground = "url(bad)";
    },
  ],
  [
    "nonboolean emphasis",
    (p: any) => {
      p.rows[0].cells.amount.bold = "yes";
    },
  ],
  [
    "arbitrary CSS",
    (p: any) => {
      p.rows[0].cells.amount.position = "fixed";
    },
  ],
  [
    "unknown subtotal column",
    (p: any) => {
      p.groups[0].summary.values.foreign = "1";
    },
  ],
  [
    "invalid subtotal value",
    (p: any) => {
      p.groups[0].summary.values.amount = 9;
    },
  ],
  [
    "reversed group",
    (p: any) => {
      p.groups[0].firstKey = "r2";
      p.groups[0].lastKey = "r1";
    },
  ],
  [
    "duplicate group",
    (p: any) => {
      p.groups.push(p.groups[0]);
    },
  ],
  [
    "overlapping peer groups",
    (p: any) => {
      p.groups.push({ ...p.groups[0], id: "peer" });
    },
  ],
  [
    "missing parent",
    (p: any) => {
      p.groups[0].level = 1;
    },
  ],
  [
    "nonboolean continuation",
    (p: any) => {
      p.groups[0].continuedAfter = "yes";
    },
  ],
] as const) {
  it(`rejects ${name} through the public DataList presentation boundary`, () => {
    const presentation = validPresentation();
    mutate(presentation);
    const w = mount(DataList as Component, {
      props: {
        columns: [{ key: "amount", label: "金额", type: "decimal" }],
        result: {
          items: [
            { id: "r1", amount: "1.00" },
            { id: "r2", amount: "2.00" },
          ],
          total: 2,
        },
        rowKey: (row: { id: string }) => row.id,
        page: 1,
        pageSize: 2,
        presentation,
      },
    });
    try {
      expect(w.find('[role="alert"]').exists()).toBe(true);
      expect(w.find("table").exists()).toBe(false);
    } finally {
      w.unmount();
    }
  });
}

for (const [name, change] of [
  [
    "duplicate columns",
    () => ({
      columns: [
        { key: "amount", label: "金额", type: "decimal" },
        { key: "amount", label: "重复", type: "decimal" },
      ],
    }),
  ],
  [
    "unsupported column type",
    () => ({ columns: [{ key: "amount", label: "金额", type: "html" }] }),
  ],
  [
    "foreign summary column",
    () => ({ summary: { caption: "坏合计", values: { foreign: "3.00" } } }),
  ],
  [
    "foreign presentation row",
    () => ({
      presentation: {
        rows: [{ rowId: "foreign", appearance: { bold: true } }],
        groups: [],
      },
    }),
  ],
] as const) {
  it(`retains the previous accepted result when new ${name} are rejected`, async () => {
    const d = fixedDefinition();
    const original = await d.adapter.query({
      scope: "a",
      parameters: { keyword: "初始" },
      page: 1,
      pageSize: 1,
      requestId: "fixture",
      signal: new AbortController().signal,
    });
    const w = fixedStart(d);
    try {
      await submit(w);
      vi.mocked(d.adapter.query).mockResolvedValueOnce({
        ...original,
        id: { token: "invalid" },
        ...change(),
      } as any);
      await submit(w);
      expect(w.find('[role="alert"]').exists()).toBe(true);
      expect(w.emitted("adopted")!.at(-1)![0]).toMatchObject({
        resultId: { token: "result-1" },
      });
      expect(w.text()).toContain("9007199254740993.0100");
    } finally {
      w.unmount();
    }
  });
}

it("allows reads of the valid original result while a replacement search and its paging complete independently", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  const anchor = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:old");
      static revokeObjectURL = vi.fn();
    },
  );
  try {
    await submit(w);
    const next = deferred<Awaited<ReturnType<typeof d.adapter.query>>>();
    vi.mocked(d.adapter.query).mockReturnValueOnce(next.promise);
    await w.get('input[aria-label="关键字"]').setValue("新的查询");
    await w.get("form").trigger("submit");
    const signal = vi.mocked(d.adapter.query).mock.calls.at(-1)![0].signal;
    expect(button(w, "导出").attributes("disabled")).toBeUndefined();
    await click(w, "导出");
    expect(d.adapter.export).toHaveBeenLastCalledWith(
      expect.objectContaining({ resultId: { token: "result-1" } }),
    );
    await w.get("a").trigger("click");
    expect(w.emitted("drill")!.at(-1)![0]).toMatchObject({
      resultId: { token: "result-1" },
      rowId: "r1",
    });
    await click(w, "下一页");
    expect(w.text()).toContain("第二页");
    expect(w.text()).toContain("正在查询");
    expect(signal.aborted).toBe(false);
    next.reject(new Error("新查询普通失败"));
    await flushPromises();
    expect(w.text()).toContain("第二页");
    expect(w.text()).toContain("仍显示上次成功结果");
    expect(w.text()).not.toContain("结果待重验");
    expect(d.adapter.revalidate).not.toHaveBeenCalled();
  } finally {
    w.unmount();
    anchor.mockRestore();
    vi.unstubAllGlobals();
  }
});

it("expires old result reads without aborting a replacement search or allowing a late old page to revive it", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  const d = fixedDefinition();
  const original = await d.adapter.query({
    scope: "a",
    parameters: { keyword: "初始" },
    page: 1,
    pageSize: 1,
    requestId: "fixture",
    signal: new AbortController().signal,
  });
  vi.mocked(d.adapter.query).mockResolvedValueOnce({
    ...original,
    expiresAt: Date.now() + 1000,
  });
  const w = fixedStart(d);
  try {
    await submit(w);
    const page = deferred<Awaited<ReturnType<typeof d.adapter.page>>>();
    const next = deferred<typeof original>();
    vi.mocked(d.adapter.page).mockReturnValueOnce(page.promise);
    vi.mocked(d.adapter.query).mockReturnValueOnce(next.promise);
    await button(w, "下一页").trigger("click");
    const pageSignal = vi.mocked(d.adapter.page).mock.calls.at(-1)![0].signal;
    await w.get("form").trigger("submit");
    const querySignal = vi.mocked(d.adapter.query).mock.calls.at(-1)![0].signal;
    await vi.advanceTimersByTimeAsync(1001);
    expect(w.find("table").exists()).toBe(false);
    expect(w.emitted("adopted")!.at(-1)).toEqual([null]);
    expect(pageSignal.aborted).toBe(true);
    expect(querySignal.aborted).toBe(false);
    page.resolve({
      items: original.items,
      hasMore: false,
      expiresAt: Date.now() + 10000,
    });
    await flushPromises();
    expect(w.find("table").exists()).toBe(false);
    next.resolve({ ...original, id: { token: "result-2" } });
    await flushPromises();
    expect(w.get("table").text()).toContain("9007199254740993.0100");
    expect(w.emitted("adopted")!.at(-1)![0]).toMatchObject({
      resultId: { token: "result-2" },
    });
    expect(w.text()).not.toContain("结果已失效");
  } finally {
    w.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  }
});

it("adopts authoritative page and return-check expiry extensions and announces restoration only after qualification", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  const d = fixedDefinition();
  const initial = await d.adapter.query({
    scope: "a",
    parameters: { keyword: "初始" },
    page: 1,
    pageSize: 1,
    requestId: "fixture",
    signal: new AbortController().signal,
  });
  vi.mocked(d.adapter.query).mockResolvedValueOnce({
    ...initial,
    expiresAt: Date.now() + 1000,
  });
  const w = fixedStart(d);
  try {
    await submit(w);
    await vi.advanceTimersByTimeAsync(500);
    vi.mocked(d.adapter.page).mockResolvedValueOnce({
      items: initial.items,
      hasMore: true,
      expiresAt: Date.now() + 3000,
    });
    await click(w, "下一页");
    await vi.advanceTimersByTimeAsync(600);
    expect(w.find("table").exists()).toBe(true);
    const check = deferred<{ status: "valid"; expiresAt: number }>();
    vi.mocked(d.adapter.revalidate).mockReturnValueOnce(check.promise);
    await w.setProps({ active: false });
    expect(w.emitted("adopted")!.at(-1)).toEqual([null]);
    await w.setProps({ active: true });
    expect(w.find("table").exists()).toBe(false);
    expect(button(w, "导出").attributes("disabled")).toBeDefined();
    check.resolve({ status: "valid", expiresAt: Date.now() + 4000 });
    await flushPromises();
    expect(w.find("table").exists()).toBe(true);
    expect(w.emitted("adopted")!.at(-1)![0]).toMatchObject({
      resultId: { token: "result-1" },
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(w.find("table").exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(1001);
    expect(w.find("table").exists()).toBe(false);
    expect(w.emitted("snapshot")!.at(-1)![0]).toMatchObject({
      result: null,
      fixed: null,
    });
    expect(w.emitted("adopted")!.at(-1)).toEqual([null]);
  } finally {
    w.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  }
});

it("keeps a result unavailable after malformed revalidation expiry, then accepts a valid retry and clears its timer on scope change", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  const d = fixedDefinition(),
    w = fixedStart(d);
  try {
    await submit(w);
    vi.mocked(d.adapter.revalidate).mockResolvedValueOnce({
      status: "valid",
      expiresAt: Number.POSITIVE_INFINITY,
    });
    await w.setProps({ active: false });
    await w.setProps({ active: true });
    await flushPromises();
    expect(w.text()).toContain("报表结果期限无效");
    expect(w.find("table").exists()).toBe(false);
    expect(w.emitted("adopted")!.at(-1)).toEqual([null]);
    vi.mocked(d.adapter.revalidate).mockResolvedValueOnce({
      status: "valid",
      expiresAt: Date.now() + 10000,
    });
    await click(w, "重验结果");
    expect(w.find("table").exists()).toBe(true);
    expect(w.emitted("adopted")!.at(-1)![0]).toMatchObject({
      resultId: { token: "result-1" },
    });
    await w.setProps({ scope: "new" });
    expect(w.find("table").exists()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    w.unmount();
    vi.useRealTimers();
  }
});

it("preserves dynamic definitions, page presentation, group continuation and authoritative subtotal snapshots on return", async () => {
  const d = fixedDefinition();
  const initial = await d.adapter.query({
    scope: "a",
    parameters: { keyword: "初始" },
    page: 1,
    pageSize: 1,
    requestId: "fixture",
    signal: new AbortController().signal,
  });
  const presentation = (rowId: string) => ({
    rows: [{ rowId, cells: { amount: { foreground: "#112233", bold: true } } }],
    groups: [
      {
        id: "same-group",
        label: "跨页组",
        level: 0,
        firstKey: rowId,
        lastKey: rowId,
        continuedBefore: rowId === "r2",
        continuedAfter: rowId === "r1",
        summary: { caption: "全组权威小计", values: { amount: "88.0000" } },
      },
    ],
  });
  vi.mocked(d.adapter.query).mockResolvedValueOnce({
    ...initial,
    columns: [{ key: "amount", label: "动态精确额", type: "decimal" }],
    presentation: presentation("r1"),
  });
  vi.mocked(d.adapter.page).mockResolvedValueOnce({
    items: [{ ...initial.items[0]!, id: "r2" }],
    hasMore: false,
    presentation: presentation("r2"),
  });
  const w = fixedStart(d);
  await submit(w);
  expect(w.text()).toContain("全组权威小计（续）88.0000");
  await click(w, "下一页");
  expect(w.get("tbody th").text()).toBe("跨页组（续）");
  await w.setProps({ active: false });
  const saved = w.emitted("snapshot")!.at(-1)![0];
  w.unmount();
  const restored = mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: false },
      pageSize: 1,
      restore: saved,
    },
  });
  try {
    await flushPromises();
    expect(restored.get("thead th").text()).toBe("动态精确额");
    expect(restored.get("tbody th").text()).toBe("跨页组（续）");
    expect(restored.text()).toContain("全组权威小计88.0000");
    expect(restored.get("tbody td").attributes("style")).toContain(
      "rgb(17, 34, 51)",
    );
    expect(restored.emitted("adopted")!.at(-1)![0]).toMatchObject({
      resultId: { token: "result-1" },
    });
  } finally {
    restored.unmount();
  }
});

it("does not pair a stale detached cell with the identity of a replacement result", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  try {
    await submit(w);
    const oldLink = w.get("a").element;
    const oldDetail = button(w, "9007199254740993.0100").element;
    vi.mocked(d.adapter.query).mockResolvedValueOnce({
      id: { token: "replacement" },
      items: [
        {
          id: "different-row",
          name: "替换结果",
          amount: "2.00",
          flag: false,
          empty: "",
          missing: null,
        },
      ],
      hasMore: false,
      summary: { caption: "新合计", values: { amount: "2.00" } },
      context: "新查询",
    });
    await submit(w);
    oldLink.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    oldDetail.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(w.emitted("drill")).toBeUndefined();
    await w.get("a").trigger("click");
    expect(w.emitted("drill")!.at(-1)![0]).toMatchObject({
      resultId: { token: "replacement" },
      rowId: "different-row",
    });
  } finally {
    w.unmount();
  }
});

it("rejects invalid cached result facts before restoring or announcing adoption", async () => {
  const d = fixedDefinition(),
    w = fixedStart(d);
  await submit(w);
  await w.setProps({ active: false });
  const saved = w.emitted("snapshot")!.at(-1)![0] as any;
  saved.result.items[0].amount = 1.25;
  w.unmount();
  const restored = mount(ReportView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, export: true },
      pageSize: 1,
      restore: saved,
    },
  });
  try {
    await flushPromises();
    expect(restored.text()).toContain("值类型不匹配");
    expect(restored.find("table").exists()).toBe(false);
    expect(restored.emitted("adopted")!.at(-1)).toEqual([null]);
  } finally {
    restored.unmount();
  }
});

it("checks authority time before result operations even when the expiry timer has not run", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  const d = fixedDefinition();
  const initial = await d.adapter.query({
    scope: "a",
    parameters: { keyword: "初始" },
    page: 1,
    pageSize: 1,
    requestId: "fixture",
    signal: new AbortController().signal,
  });
  vi.mocked(d.adapter.query).mockResolvedValueOnce({
    ...initial,
    expiresAt: Date.now() + 1000,
  });
  const w = fixedStart(d);
  try {
    await submit(w);
    vi.setSystemTime(Date.now() + 1001);
    await w.get("a").trigger("click");
    expect(w.emitted("drill")).toBeUndefined();
    expect(w.find("table").exists()).toBe(false);
    expect(w.emitted("adopted")!.at(-1)).toEqual([null]);
  } finally {
    w.unmount();
    vi.useRealTimers();
  }
});
