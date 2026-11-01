import { DOMWrapper } from "@vue/test-utils";
import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { describe, it, expect, vi } from "vitest";
import { defineCrud } from "../src/index";
import CrudView from "../src/CrudView.vue";
const definition = () =>
  defineCrud({
    resource: "sample",
    title: "合成资料",
    fields: [{ key: "name", type: "text", label: "名称" }],
    filters: [{ key: "keyword", type: "text", label: "关键字" }],
    initialFilters: () => ({ keyword: "" }),
    columns: [{ key: "name", label: "名称" }],
    identity: (r: { id: string; name: string }) => r.id,
    actions: () => ["edit", "delete"] as const,
    adapter: {
      empty: () => ({ name: "" }),
      query: vi.fn(async () => ({
        items: [{ id: "one", name: "原名称" }],
        total: 1,
      })),
      get: async () => ({ values: { name: "原名称" }, identity: "one" }),
      create: vi.fn(async () => ({ status: "success" as const })),
      save: vi.fn(async () => ({ status: "success" as const })),
      delete: vi.fn(async () => ({ status: "success" as const })),
    },
  });
const click = async (w: ReturnType<typeof mount>, name: string) => {
  if (name === "查询") await w.get("form").trigger("submit");
  else
    await w
      .findAll("button")
      .concat(
        Array.from(
          document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
        ).map((el) => new DOMWrapper(el)),
      )
      .find((b) => b.text() === name || b.attributes("aria-label") === name)!
      .trigger("click");
  await flushPromises();
};
describe("public direct runtime", () => {
  it("submits filters explicitly and saves a detached draft with one refresh", async () => {
    const d = definition(),
      w = mount(CrudView as Component, {
        props: {
          definition: d,
          scope: "account-a",
          permissions: { query: true, create: true, write: true },
        },
      });
    await flushPromises();
    await w.get('input[aria-label="关键字"]').setValue("新");
    expect(d.adapter.query).toHaveBeenCalledTimes(1);
    await click(w, "查询");
    expect(d.adapter.query).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { keyword: "新" }, page: 1 }),
    );
    await click(w, "编辑");
    await w.get('input[aria-label="名称"]').setValue("新名称");
    expect(w.text()).toContain("原名称");
    await click(w, "保存");
    expect(d.adapter.save).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "account-a",
        identity: "one",
        input: { name: "新名称" },
      }),
    );
    expect(d.adapter.query).toHaveBeenCalledTimes(3);
    w.unmount();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const permissions = { query: true, create: true, write: true, reconcile: true };
const start = async (
  d: Omit<ReturnType<typeof definition>, "reconcile"> & {
    reconcile?: (
      a: import("../src/index").Attempt<{ name: string }, string>,
    ) => Promise<import("../src/index").ReconcileResult<unknown>>;
  },
  scope = "a",
) => {
  const w = mount(CrudView as Component, {
    props: { definition: d, scope, permissions },
  });
  await flushPromises();
  return w;
};
const button = (w: ReturnType<typeof mount>, name: string) =>
  w
    .findAll("button")
    .concat(
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
      ).map((el) => new DOMWrapper(el)),
    )
    .find((b) => b.text() === name || b.attributes("aria-label") === name)!;
it("preserves an unknown write after closing, querying and remounting", async () => {
  const d = definition();
  vi.mocked(d.adapter.save).mockResolvedValue({ status: "unknown" });
  let w = await start(d);
  await click(w, "编辑");
  await click(w, "保存");
  expect(w.text()).toContain("写入结果未知");
  await click(w, "取消编辑");
  await click(w, "查询");
  expect(button(w, "新增").attributes("disabled")).toBeDefined();
  w.unmount();
  w = await start(d);
  expect(button(w, "新增").attributes("disabled")).toBeDefined();
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("retries only the read after a successful write whose refresh fails", async () => {
  const d = definition(),
    w = await start(d);
  vi.mocked(d.adapter.query).mockRejectedValueOnce(new Error("读取失败"));
  await click(w, "编辑");
  await click(w, "保存");
  expect(w.text()).toContain("写入已成功");
  expect(button(w, "新增").attributes("disabled")).toBeDefined();
  await click(w, "重试读取");
  expect(button(w, "新增").attributes("disabled")).toBeUndefined();
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("keeps explicit failures retryable without losing the draft", async () => {
  const d = definition(),
    w = await start(d);
  vi.mocked(d.adapter.save).mockResolvedValueOnce({
    status: "failure",
    message: "修订冲突",
  });
  await click(w, "编辑");
  await w.get('input[aria-label="名称"]').setValue("保留输入");
  await click(w, "保存");
  expect(w.text()).toContain("修订冲突");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "保留输入",
  );
  expect(button(w, "保存").attributes("disabled")).toBeUndefined();
  w.unmount();
});
it("isolates old scope reads and records late unknown writes in the original scope", async () => {
  const d = definition(),
    w = await start(d),
    pending = deferred<import("../src/index").WriteResult>();
  vi.mocked(d.adapter.save).mockReturnValueOnce(pending.promise);
  await click(w, "编辑");
  await click(w, "保存");
  await w.setProps({ scope: "b" });
  await flushPromises();
  expect(button(w, "新增").attributes("disabled")).toBeUndefined();
  pending.reject(new Error("连接断开"));
  await flushPromises();
  expect(w.text()).not.toContain("写入结果未知");
  await w.setProps({ scope: "a" });
  await flushPromises();
  expect(w.text()).toContain("写入结果未知");
  w.unmount();
});
it("ignores an out-of-order query after changing scope", async () => {
  const d = definition(),
    pending =
      deferred<import("../src/index").Page<{ id: string; name: string }>>();
  vi.mocked(d.adapter.query).mockReturnValueOnce(pending.promise);
  const w = await start(d);
  await w.setProps({ scope: "b" });
  await flushPromises();
  pending.resolve({ items: [{ id: "old", name: "旧账号资料" }], total: 1 });
  await flushPromises();
  expect(w.text()).toContain("原名称");
  expect(w.text()).not.toContain("旧账号资料");
  w.unmount();
});
it("requires evidence for the exact original attempt to reconcile", async () => {
  const base = definition(),
    reconcile = vi.fn(
      async (a: import("../src/index").Attempt<{ name: string }, string>) => ({
        status: "applied" as const,
        attemptId: "wrong",
        evidence: { id: a.id },
      }),
    ),
    d = { ...base, reconcile };
  vi.mocked(d.adapter.save).mockResolvedValueOnce({ status: "unknown" });
  const w = await start(d);
  await click(w, "编辑");
  await click(w, "保存");
  await click(w, "核实本次请求");
  expect(w.text()).toContain("证据不足");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  reconcile.mockImplementationOnce(async (a) => ({
    status: "applied",
    attemptId: a.id,
    evidence: { id: a.id },
  }));
  await click(w, "核实本次请求");
  expect(w.text()).not.toContain("写入结果未知");
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  expect(d.adapter.query).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("requires confirmation for destructive writes and preserves identity and revision", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "删除");
  expect(d.adapter.delete).not.toHaveBeenCalled();
  await click(w, "确认删除");
  expect(d.adapter.delete).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: "delete",
      identity: "one",
      scope: "a",
    }),
  );
  w.unmount();
});
it("hides actions when the consumer denies permission", async () => {
  const d = definition(),
    w = await start(d);
  await w.setProps({
    permissions: { query: true, write: false, create: false },
  });
  expect(
    w
      .findAll("button")
      .concat(
        Array.from(
          document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
        ).map((el) => new DOMWrapper(el)),
      )
      .map((b) => b.text()),
  ).not.toContain("编辑");
  expect(
    w
      .findAll("button")
      .concat(
        Array.from(
          document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
        ).map((el) => new DOMWrapper(el)),
      )
      .map((b) => b.text()),
  ).not.toContain("新增");
  w.unmount();
});
it("rejects an incomplete decimal without calling the write adapter", async () => {
  const d = defineCrud({
    resource: "decimal",
    title: "金额",
    fields: [{ key: "amount", label: "金额", type: "decimal" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: (row: { id: string; name: string }) => row.id,
    actions: () => ["edit"] as const,
    adapter: {
      empty: () => ({ amount: "0" }),
      query: async () => ({ items: [{ id: "one", name: "合成" }], total: 1 }),
      get: async () => ({
        identity: "one",
        values: { amount: "123456789012345678.123456789012345678" },
      }),
      create: async () => ({ status: "success" as const }),
      save: vi.fn(async () => ({ status: "success" as const })),
    },
  });
  const w = mount(CrudView as Component, {
    props: { definition: d, scope: "a", permissions },
  });
  await flushPromises();
  await click(w, "编辑");
  await w.get('input[aria-label="金额"]').setValue("-");
  await click(w, "保存");
  expect(w.text()).toContain("应为完整十进制数");
  expect(d.adapter.save).not.toHaveBeenCalled();
  expect(w.get('input[aria-label="金额"]').element).toHaveProperty(
    "value",
    "-",
  );
  w.unmount();
});
it("reports actual draft changes and blocks closing an unknown write", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "编辑");
  const protection = () => w.emitted("protection")?.at(-1)?.[0];
  expect(protection()).toEqual({
    dirty: false,
    localPending: false,
    invalid: false,
    writeState: "idle",
  });
  await w.get('input[aria-label="名称"]').setValue("改变");
  expect(protection()).toMatchObject({ dirty: true });
  await w.get('input[aria-label="名称"]').setValue("原名称");
  expect(protection()).toMatchObject({ dirty: false });
  vi.mocked(d.adapter.save).mockResolvedValueOnce({ status: "unknown" });
  await click(w, "保存");
  expect(protection()).toMatchObject({
    writeState: "unknown",
    localPending: false,
  });
  await click(w, "取消编辑");
  expect(w.find('[role="region"][aria-label="编辑资料"]').exists()).toBe(true);
  w.unmount();
});
it("does not validate readonly historical fields when saving other edits", async () => {
  const base = definition();
  const d = defineCrud({
    ...base,
    fields: [{ key: "name", type: "text", label: "名称", required: true }],
    adapter: {
      ...base.adapter,
      get: async () => ({
        values: { name: "" },
        identity: "one",
        readonlyFields: ["name"] as const,
      }),
    },
  });
  const w = await start(d);
  await click(w, "编辑");
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    invalid: false,
  });
  await click(w, "保存");
  expect(d.adapter.save).toHaveBeenCalledWith(
    expect.objectContaining({ input: { name: "" } }),
  );
  w.unmount();
});
it("notifies only adopted filter snapshots and preserves them after query failure", async () => {
  const d = definition(),
    w = await start(d);
  await w.get('input[aria-label="关键字"]').setValue("采用条件");
  await click(w, "查询");
  const adopted = w.emitted("queried")?.at(-1)?.[0] as { keyword: string };
  adopted.keyword = "外部污染";
  vi.mocked(d.adapter.query).mockRejectedValueOnce(new Error("失败"));
  await w.get('input[aria-label="关键字"]').setValue("失败条件");
  await click(w, "查询");
  expect(w.emitted("queried")).toHaveLength(2);
  await click(w, "重试读取");
  expect(d.adapter.query).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { keyword: "采用条件" } }),
  );
  w.unmount();
});
