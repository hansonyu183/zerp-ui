import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { ConfigurationView, defineConfiguration } from "../src/index";
const definition = () =>
  defineConfiguration({
    resource: "synthetic-config",
    title: "合成配置",
    fields: [{ key: "name", label: "名称", type: "text" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: (row: { name: string; revision: string }) => ({
      key: "one",
      revision: row.revision,
    }),
    adapter: {
      query: vi.fn(async () => ({
        items: [{ name: "当前值", revision: "r1" }],
        total: 1,
      })),
      get: async () => ({
        values: { name: "当前值" },
        identity: { key: "one", revision: "r1" },
      }),
      save: vi.fn(async () => ({ status: "success" as const })),
    },
  });
const permissions = { read: true, write: true, reconcile: true };
const button = (w: ReturnType<typeof mount>, name: string) =>
  w
    .findAll("button")
    .find((b) => b.text() === name || b.attributes("aria-label") === name)!;
const click = async (w: ReturnType<typeof mount>, name: string) => {
  await button(w, name).trigger("click");
  await flushPromises();
};
const start = async (
  d: import("../src/index").ConfigurationDefinition<
    { name: string },
    {},
    { name: string; revision: string },
    { key: string; revision: string },
    unknown
  > = definition(),
) => {
  const w = mount(ConfigurationView as Component, {
    props: { definition: d, scope: "a", permissions },
  });
  await flushPromises();
  return w;
};
it("reads current configuration and saves a detached draft with the original revision", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "编辑");
  await w.get('input[aria-label="名称"]').setValue("新值");
  expect(w.text()).toContain("当前值");
  await click(w, "保存");
  expect(d.adapter.save).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: "save",
      scope: "a",
      input: { name: "新值" },
      identity: { key: "one", revision: "r1" },
    }),
  );
  expect(d.adapter.query).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("retains a revision conflict draft and retries reads without replaying a successful save", async () => {
  const d = definition(),
    w = await start(d);
  vi.mocked(d.adapter.save).mockResolvedValueOnce({
    status: "failure",
    message: "修订冲突",
  });
  await click(w, "编辑");
  await w.get('input[aria-label="名称"]').setValue("待保存");
  await click(w, "保存");
  expect(w.text()).toContain("修订冲突");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "待保存",
  );
  vi.mocked(d.adapter.query).mockRejectedValueOnce(new Error("刷新失败"));
  await click(w, "保存");
  expect(w.text()).toContain("保存已成功");
  expect(button(w, "编辑").attributes("disabled")).toBeDefined();
  await click(w, "重试读取");
  expect(button(w, "编辑").attributes("disabled")).toBeUndefined();
  expect(d.adapter.save).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("keeps unknown locked through close, reads and remount, and consumes only exact request evidence", async () => {
  const base = definition(),
    verify = vi.fn(
      async (
        a: import("../src/index").ConfigurationAttempt<
          { name: string },
          { key: string; revision: string }
        >,
      ) => ({
        status: "applied" as const,
        attemptId: "wrong",
        evidence: { request: a.id },
      }),
    ),
    d = { ...base, reconcile: verify };
  vi.mocked(d.adapter.save).mockResolvedValueOnce({
    status: "unknown",
  });
  let w = await start(d);
  await click(w, "编辑");
  await click(w, "保存");
  const original = vi.mocked(d.adapter.save).mock.calls[0][0];
  await click(w, "关闭编辑");
  await click(w, "重试读取");
  w.unmount();
  w = await start(d);
  expect(button(w, "编辑").attributes("disabled")).toBeDefined();
  await click(w, "核实本次请求");
  expect(w.text()).toContain("证据不足");
  verify.mockImplementationOnce(async (a) => ({
    status: "applied",
    attemptId: a.id,
    evidence: { request: a.id },
  }));
  await click(w, "核实本次请求");
  expect(verify).toHaveBeenLastCalledWith(original);
  expect(button(w, "编辑").attributes("disabled")).toBeUndefined();
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("leaves unknown without a verifier and allows retry only on confirmed not-applied", async () => {
  const base = definition();
  vi.mocked(base.adapter.save).mockRejectedValueOnce(new Error("network"));
  const w = await start(base);
  await click(w, "编辑");
  await click(w, "保存");
  expect(w.text()).toContain("保存结果未知");
  expect(w.text()).not.toContain("核实本次请求");
  await click(w, "关闭编辑");
  await click(w, "重试读取");
  expect(button(w, "编辑").attributes("disabled")).toBeDefined();
  w.unmount();
  const d = {
    ...definition(),
    reconcile: vi.fn(
      async (
        a: import("../src/index").ConfigurationAttempt<
          { name: string },
          { key: string; revision: string }
        >,
      ) => ({
        status: "not-applied" as const,
        attemptId: a.id,
        evidence: false,
      }),
    ),
  };
  vi.mocked(d.adapter.save).mockResolvedValueOnce({
    status: "unknown",
  });
  const v = await start(d);
  await click(v, "编辑");
  await click(v, "保存");
  await click(v, "核实本次请求");
  expect(button(v, "保存").attributes("disabled")).toBeUndefined();
  v.unmount();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
it("isolates late reads and preserves late write results in the original scope", async () => {
  const d = definition(),
    read = deferred<{
      items: { name: string; revision: string }[];
      total: number;
    }>();
  vi.mocked(d.adapter.query).mockReturnValueOnce(read.promise);
  const w = await start(d);
  await w.setProps({ scope: "b" });
  await flushPromises();
  read.resolve({ items: [{ name: "过时资料", revision: "old" }], total: 1 });
  await flushPromises();
  expect(w.text()).not.toContain("过时资料");
  const write = deferred<import("../src/index").WriteResult>();
  vi.mocked(d.adapter.save).mockReturnValueOnce(write.promise);
  await click(w, "编辑");
  await click(w, "保存");
  await w.setProps({ scope: "c" });
  await flushPromises();
  write.resolve({ status: "unknown" });
  await flushPromises();
  expect(w.text()).not.toContain("保存结果未知");
  await w.setProps({ scope: "b" });
  await flushPromises();
  expect(w.text()).toContain("保存结果未知");
  w.unmount();
});
it("aggregates local pending and rejects events from a closed block instance", async () => {
  const { defineComponent, h } = await import("vue");
  const { configurationBlock } = await import("../src/index");
  const events: Array<{
    change: (value: string) => void;
    pending: (value: boolean) => void;
  }> = [];
  const Block = defineComponent({
    props: {
      modelValue: { type: String, required: true },
      catalog: { type: Array, required: true },
      mode: {
        type: String as import("vue").PropType<"read" | "edit">,
        required: true,
      },
      disabled: Boolean,
      "onUpdate:modelValue": {
        type: Function as import("vue").PropType<(value: string) => void>,
        required: true,
      },
      onPending: {
        type: Function as import("vue").PropType<(value: boolean) => void>,
        required: true,
      },
    },
    setup(p) {
      events.push({ change: p["onUpdate:modelValue"], pending: p.onPending });
      return () => h("p", "局部编辑");
    },
  });
  const base = definition();
  const d = defineConfiguration({
    ...base,
    fields: [],
    adapter: {
      ...base.adapter,
      get: async () => ({
        values: { name: "当前值", other: "另一个" },
        identity: { key: "one", revision: "r1" },
      }),
      save: vi.fn(async () => ({ status: "success" as const })),
    },
  });
  const blocks = [
    configurationBlock<{ name: string; other: string }>()({
      key: "name",
      component: Block,
      catalog: [],
    }),
    configurationBlock<{ name: string; other: string }>()({
      key: "other",
      component: Block,
      catalog: [],
    }),
  ];
  const w = mount(ConfigurationView as Component, {
    props: { definition: d, scope: "a", permissions, blocks },
  });
  await flushPromises();
  await click(w, "编辑");
  events[0].pending(true);
  events[1].pending(true);
  await flushPromises();
  events[0].pending(false);
  await flushPromises();
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await w.setProps({ permissions: { ...permissions, write: false } });
  events[1].pending(false);
  await flushPromises();
  await w.setProps({ permissions });
  await flushPromises();
  expect(button(w, "保存").attributes("disabled")).toBeUndefined();
  await click(w, "关闭编辑");
  await click(w, "编辑");
  events[0].change("迟到覆盖");
  events[0].pending(true);
  await flushPromises();
  expect(button(w, "保存").attributes("disabled")).toBeUndefined();
  await click(w, "保存");
  expect(d.adapter.save).toHaveBeenCalledWith(
    expect.objectContaining({ input: { name: "当前值", other: "另一个" } }),
  );
  w.unmount();
});
it("discards a cancelled draft and honors readonly details and revoked permissions", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "编辑");
  await w.get('input[aria-label="名称"]').setValue("取消的输入");
  await click(w, "关闭编辑");
  await click(w, "编辑");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "当前值",
  );
  await w.setProps({
    permissions: { read: true, write: false, reconcile: false },
  });
  await flushPromises();
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  expect(
    w.get('input[aria-label="名称"]').attributes("disabled"),
  ).toBeDefined();
  w.unmount();
  const readonly = { ...definition() };
  readonly.adapter.get = async () => ({
    values: { name: "只读" },
    identity: { key: "one", revision: "r1" },
    writable: false,
  });
  const v = await start(readonly);
  await click(v, "编辑");
  expect(button(v, "保存").attributes("disabled")).toBeDefined();
  v.unmount();
});
it("keeps explicit filters and latest query results isolated from older reads", async () => {
  const base = definition(),
    d = defineConfiguration({
      ...base,
      filters: [{ key: "keyword", type: "text", label: "关键字" }],
      initialFilters: () => ({ keyword: "" }),
      adapter: {
        ...base.adapter,
        query: vi.fn(
          async (_input: {
            scope: string;
            filters: { keyword: string };
            page: number;
            pageSize: number;
          }) => ({ items: [{ name: "查询结果", revision: "r2" }], total: 1 }),
        ),
      },
    });
  const w = mount(ConfigurationView as Component, {
    props: { definition: d, scope: "a", permissions },
  });
  await flushPromises();
  const old = deferred<{
    items: { name: string; revision: string }[];
    total: number;
  }>();
  vi.mocked(d.adapter.query).mockReturnValueOnce(old.promise);
  await w.get('input[aria-label="关键字"]').setValue("显式条件");
  expect(d.adapter.query).toHaveBeenCalledTimes(1);
  await w.get("form").trigger("submit");
  await click(w, "重试读取"); // disabled UI keeps one active read
  old.resolve({ items: [{ name: "筛选后", revision: "r3" }], total: 1 });
  await flushPromises();
  expect(d.adapter.query).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { keyword: "显式条件" } }),
  );
  expect(w.text()).toContain("筛选后");
  w.unmount();
});
