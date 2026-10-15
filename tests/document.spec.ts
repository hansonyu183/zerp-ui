import { mount, flushPromises } from "@vue/test-utils";
import { it, expect, vi } from "vitest";
import type { Component } from "vue";
import {
  DocumentRuntime,
  defineDocument,
  type DocumentSnapshot,
  type DocumentAdapter,
} from "../src/index";
type D = { name: string; amount: string };
type Snap = DocumentSnapshot<
  D,
  string,
  string,
  { id: string; payload: string },
  string,
  string,
  string
>;
const snapshot = (document = "one", revision = "r2"): Snap => ({
  identity: {
    document,
    revision,
    submission: { id: "immutable-s1", payload: "original" },
  },
  number: "DOC-001",
  handler: "合成人员",
  state: "open",
  values: { name: "原单据", amount: "9007199254740993.0100" },
  owner: "owner",
  attachments: [],
  eligible: { edit: true, approve: true, clone: true },
});
function definition() {
  const adapter: DocumentAdapter<
    D,
    string,
    string,
    { id: string; payload: string },
    string,
    string,
    string,
    { event: string }
  > = {
    list: vi.fn(async () => ({
      items: [
        {
          identity: snapshot().identity,
          number: "DOC-001",
          handler: "合成人员",
        },
      ],
      total: 1,
    })),
    get: vi.fn(async () => ({
      current: snapshot(),
      history: [snapshot("one", "r1")],
      audit: [{ event: "合成审计" }],
    })),
    empty: () => ({
      ...snapshot("new", "r0"),
      identity: { document: "new", revision: "r0", submission: null },
      number: "未编号",
      values: { name: "新草稿", amount: "0.0100" },
    }),
    clone: ({ source }) => ({
      ...source,
      identity: { document: "clone", revision: "r0", submission: null },
      number: "克隆草稿",
      attachments: [],
    }),
    submit: vi.fn(async () => ({ status: "success" as const })),
    approve: vi.fn(async () => ({ status: "success" as const })),
  };
  return defineDocument({
    resource: "documents",
    title: "合成单据",
    fields: [
      { key: "name", type: "text", label: "名称" },
      { key: "amount", type: "decimal", label: "金额" },
    ],
    auditColumns: [{ key: "event", label: "事件" }],
    adapter,
  });
}
const permissions = { read: true, write: true, reconcile: true };
const button = (w: ReturnType<typeof mount>, name: string) =>
  w.findAll("button").find((b) => b.text() === name)!;
const click = async (w: ReturnType<typeof mount>, name: string) => {
  await button(w, name).trigger("click");
  await flushPromises();
};
const start = async (
  d: import("../src/index").DocumentDefinition<
    D,
    string,
    string,
    { id: string; payload: string },
    string,
    string,
    string,
    { event: string },
    unknown
  > = definition(),
) => {
  const w = mount(DocumentRuntime as Component, {
    props: { definition: d, scope: "a", permissions },
  });
  await flushPromises();
  return w;
};
it("creates and clones detached drafts, preserves document/revision/submission and refreshes without replay", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "创建 Draft");
  await w.get('input[aria-label="名称"]').setValue("创建值");
  await click(w, "提交单据");
  expect(d.adapter.submit).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: { document: "new", revision: "r0", submission: null },
      input: { name: "创建值", amount: "0.0100" },
    }),
  );
  await click(w, "查看 DOC-001");
  expect(w.text()).toContain("合成人员");
  await click(w, "克隆 Draft");
  await click(w, "提交单据");
  expect(d.adapter.submit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      identity: { document: "clone", revision: "r0", submission: null },
      input: { name: "原单据", amount: "9007199254740993.0100" },
    }),
  );
  await click(w, "查看 DOC-001");
  await click(w, "审批通过");
  expect(d.adapter.approve).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: {
        document: "one",
        revision: "r2",
        submission: { id: "immutable-s1", payload: "original" },
      },
      operation: "approve",
    }),
  );
  await click(w, "历史 DOC-001 · 合成人员");
  expect(button(w, "编辑单据")).toBeUndefined();
  w.unmount();
});
it("keeps script saves and document submissions independently identified and blocks unknown across close/remount", async () => {
  const { defineConfiguration } = await import("../src/index");
  const d = definition();
  const script = defineConfiguration({
    resource: "script",
    title: "计算脚本",
    fields: [{ key: "source", label: "脚本正文", type: "textarea" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: () => ({ script: "script-one", revision: "s3" }),
    adapter: {
      query: async () => ({ items: [{ name: "合成脚本" }], total: 1 }),
      get: async () => ({
        values: { source: "return 1" },
        identity: { script: "script-one", revision: "s3" },
        writable: true,
      }),
      save: vi.fn(async () => ({ status: "unknown" as const })),
    },
  });
  const props = {
    definition: d,
    scope: "a",
    permissions,
    script: { definition: script, permissions },
  };
  const w = mount(DocumentRuntime as Component, { props });
  await flushPromises();
  await click(w, "编辑");
  await click(w, "保存");
  const original = vi.mocked(script.adapter.save).mock.calls[0][0];
  expect(original).toMatchObject({
    operation: "save",
    identity: { script: "script-one", revision: "s3" },
    input: { source: "return 1" },
  });
  await click(w, "关闭编辑");
  expect(button(w, "创建 Draft").attributes("disabled")).toBeDefined();
  await click(w, "重试读取");
  expect(d.adapter.submit).not.toHaveBeenCalled();
  w.unmount();
  const v = mount(DocumentRuntime as Component, { props });
  await flushPromises();
  expect(button(v, "创建 Draft").attributes("disabled")).toBeDefined();
  v.unmount();
});
it("requires original business evidence; reading, closing and successful-refresh failures cannot replay", async () => {
  const base = definition();
  vi.mocked(base.adapter.submit).mockResolvedValueOnce({ status: "unknown" });
  const verify = vi.fn(
    async (
      _a: unknown,
    ): Promise<
      import("../src/index").DocumentReconciliation<string, { receipt: string }>
    > => ({
      status: "applied",
      operation: "business",
      attemptId: "wrong",
      evidence: { receipt: "wrong" },
    }),
  );
  const d = { ...base, reconcile: verify };
  const w = await start(d);
  await click(w, "查看 DOC-001");
  await click(w, "编辑单据");
  await click(w, "提交单据");
  const original = vi.mocked(d.adapter.submit).mock.calls[0][0];
  await click(w, "关闭编辑");
  await click(w, "重试读取");
  await click(w, "核实本次请求");
  expect(button(w, "创建 Draft").attributes("disabled")).toBeDefined();
  expect(verify).toHaveBeenCalledWith(original);
  verify.mockResolvedValueOnce({ status: "unknown" });
  await click(w, "核实本次请求");
  expect(w.text()).toContain("证据不足");
  verify.mockResolvedValueOnce({
    status: "not-applied",
    operation: "business",
    attemptId: original.id,
    evidence: { receipt: "exact-not-applied" },
  });
  await click(w, "核实本次请求");
  await click(w, "编辑单据");
  vi.mocked(d.adapter.list).mockRejectedValueOnce(new Error("刷新失败"));
  await click(w, "提交单据");
  expect(w.text()).toContain("刷新失败");
  expect(button(w, "创建 Draft").attributes("disabled")).toBeDefined();
  await click(w, "重试读取");
  expect(d.adapter.submit).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("does not offer create/clone/write actions for system documents and keeps exact history independent", async () => {
  const d = definition();
  delete d.adapter.empty;
  delete d.adapter.clone;
  delete d.adapter.approve;
  vi.mocked(d.adapter.get).mockResolvedValue({
    current: { ...snapshot(), eligible: {} },
    history: [snapshot("one", "r1")],
    audit: [],
  });
  const w = await start(d);
  expect(button(w, "创建 Draft")).toBeUndefined();
  await click(w, "查看 DOC-001");
  expect(button(w, "编辑单据")).toBeUndefined();
  expect(button(w, "克隆 Draft")).toBeUndefined();
  await click(w, "历史 DOC-001 · 合成人员");
  vi.mocked(d.adapter.get).mockResolvedValue({
    current: { ...snapshot(), eligible: {} },
    history: [
      { ...snapshot("one", "r9"), values: { name: "不应覆盖", amount: "1" } },
    ],
    audit: [],
  });
  await click(w, "重试读取");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "原单据",
  );
  w.unmount();
});
it("resumes a staged clone with its original source identity even after navigating away", async () => {
  const d = definition();
  d.adapter.attachments = {
    validate: () => undefined,
    stage: vi.fn(async () => ({
      status: "success" as const,
      handle: "retained",
    })),
    read: async () => ({ content: new Blob(), filename: "x" }),
  };
  vi.mocked(d.adapter.submit).mockResolvedValueOnce({
    status: "failure",
    message: "明确失败",
  });
  const w = await start(d);
  await click(w, "查看 DOC-001");
  await click(w, "克隆 Draft");
  const input = w.get('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    value: [new File(["x"], "x.txt")],
  });
  await input.trigger("change");
  await click(w, "提交单据");
  await click(w, "关闭编辑");
  await click(w, "查看 DOC-001");
  await click(w, "恢复 Draft");
  expect(w.text()).toContain("克隆草稿");
  await click(w, "提交单据");
  expect(d.adapter.submit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      identity: { document: "clone", revision: "r0", submission: null },
      attachments: ["retained"],
    }),
  );
  expect(d.adapter.attachments.stage).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("keeps recursive confirmations local, cancels the parent draft and adopts exact source snapshots in a dedicated block", async () => {
  const { sample } = await import("../examples/document/adapters");
  const { default: EntryBlock } =
    await import("../examples/document/EntryBlock.vue");
  const { configurationBlock } = await import("../src/index");
  const d = sample("opening", () => "success");
  const original = d.adapter.submit;
  const submitted = vi.fn(original);
  d.adapter.submit = submitted;
  const w = mount(DocumentRuntime as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions,
      blocks: [
        configurationBlock<import("../examples/document/adapters").Entry>()({
          key: "entry",
          component: EntryBlock,
          catalog: [
            { id: "source-one", label: "精确来源甲", revision: "source-r7" },
          ] as readonly { id: string; label: string; revision: string }[],
        }),
      ],
    },
  });
  await flushPromises();
  await click(w, "创建 Draft");
  await click(w, "新增期初行");
  await w.get('input[aria-label="行名称"]').setValue("取消父行");
  await click(w, "新增子项");
  await w.get('input[aria-label="子项金额"]').setValue("123.4500");
  const confirms = w.findAll("button").filter((b) => b.text() === "确定子项");
  await confirms[0]!.trigger("click");
  await flushPromises();
  await click(w, "取消子项");
  expect(w.text()).not.toContain("取消父行");
  await click(w, "新增期初行");
  await w.get('input[aria-label="行名称"]').setValue("保留行");
  await click(w, "确定子项");
  await click(w, "精确来源甲");
  await flushPromises();
  expect(w.text()).toContain("source-r7");
  await click(w, "提交单据");
  expect(submitted).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        name: "合成期初",
        entry: {
          amount: "9007199254740993.0100",
          source: {
            id: "source-one",
            label: "精确来源甲",
            snapshot: { revision: "source-r7", rate: "0.0100" },
          },
          rows: [{ name: "保留行", children: [] }],
        },
      },
    }),
  );
  await click(w, "创建 Draft");
  await w.get('input[aria-label="名称"]').setValue("取消整个草稿");
  await click(w, "关闭编辑");
  await click(w, "创建 Draft");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "合成期初",
  );
  w.unmount();
});
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
it("invalidates late list/detail reads and records late stages only in their original scope", async () => {
  const d = definition();
  const staged = deferred<{ status: "success"; handle: string }>();
  d.adapter.attachments = {
    validate: () => undefined,
    stage: vi.fn(() => staged.promise),
    read: async () => ({ content: new Blob(), filename: "x" }),
  };
  const late = deferred<Awaited<ReturnType<typeof d.adapter.get>>>();
  vi.mocked(d.adapter.get).mockReturnValueOnce(late.promise);
  const w = await start(d);
  await click(w, "查看 DOC-001");
  await w.setProps({ scope: "b" });
  await flushPromises();
  late.resolve({
    current: { ...snapshot(), values: { name: "过时详情", amount: "1" } },
    history: [],
    audit: [],
  });
  await flushPromises();
  expect(w.text()).not.toContain("过时详情");
  await click(w, "创建 Draft");
  const input = w.get('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    value: [new File(["x"], "late.txt")],
  });
  await input.trigger("change");
  await click(w, "提交单据");
  await w.setProps({ scope: "c" });
  await flushPromises();
  staged.resolve({ status: "success", handle: "late-handle" });
  await flushPromises();
  expect(d.adapter.submit).not.toHaveBeenCalled();
  await w.setProps({ scope: "b" });
  await flushPromises();
  await click(w, "恢复 Draft");
  await click(w, "提交单据");
  expect(d.adapter.attachments.stage).toHaveBeenCalledTimes(1);
  expect(d.adapter.submit).toHaveBeenCalledWith(
    expect.objectContaining({ scope: "b", attachments: ["late-handle"] }),
  );
  w.unmount();
});
it("clears the previous document when opening another detail fails", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "查看 DOC-001");
  vi.mocked(d.adapter.get).mockRejectedValueOnce(new Error("详情失败"));
  await click(w, "查看 DOC-001");
  expect(w.text()).toContain("详情失败");
  expect(button(w, "编辑单据")).toBeUndefined();
  await click(w, "创建 Draft");
  expect(w.find('[role="dialog"]').exists()).toBe(true);
  w.unmount();
});
it("switches the document definition and list adapter together", async () => {
  const d = definition(),
    other = definition();
  other.resource = "other-documents";
  other.title = "另一类单据";
  vi.mocked(other.adapter.list).mockResolvedValue({
    items: [
      {
        identity: { document: "other", revision: "r1", submission: null },
        number: "OTHER-001",
        handler: "另一经办人",
      },
    ],
    total: 1,
  });
  const w = await start(d);
  await w.setProps({ definition: other });
  await flushPromises();
  expect(w.text()).toContain("查看 OTHER-001");
  expect(w.text()).not.toContain("查看 DOC-001");
  w.unmount();
});
