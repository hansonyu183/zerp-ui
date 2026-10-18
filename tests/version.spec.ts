import { mount, flushPromises } from "@vue/test-utils";
import type { Component } from "vue";
import { expect, it, vi } from "vitest";
import {
  VersionView,
  defineVersion,
  type VersionSnapshot,
  type VersionAdapter,
} from "../src/index";
type D = { name: string };
type I = { key: string; revision: string };
type Snapshot = VersionSnapshot<D, I, string, string, string>;
const snap = (name: string, revision: string): Snapshot => ({
  label: revision,
  identity: { key: "one", revision },
  state: "open",
  values: { name },
  owner: "owner-one",
  attachments: [],
  eligible: { edit: true, approve: true, disable: true },
});
function definition() {
  const adapter: VersionAdapter<
    D,
    I,
    string,
    string,
    string,
    { event: string }
  > = {
    query: vi.fn(async () => ({
      official: snap("正式值", "r2"),
      candidate: snap("候选值", "r3"),
      history: [snap("历史值", "r1")],
      audit: [{ event: "精确审计" }],
    })),
    submit: vi.fn(async () => ({ status: "success" as const })),
    approve: vi.fn(async () => ({ status: "success" as const })),
    disable: vi.fn(async () => ({ status: "success" as const })),
    attachments: {
      validate: () => undefined,
      stage: vi.fn(async () => ({
        status: "success" as const,
        handle: "staged-one",
      })),
      read: vi.fn(async () => ({
        content: new Blob(["synthetic"]),
        filename: "a.txt",
      })),
    },
  };
  return defineVersion({
    resource: "archive",
    title: "合成版本",
    fields: [{ key: "name", type: "text", label: "名称" }],
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
  d: import("../src/index").VersionDefinition<
    D,
    I,
    string,
    string,
    string,
    { event: string },
    unknown
  > = definition(),
) => {
  const w = mount(VersionView as Component, {
    props: { definition: d, scope: "a", permissions },
  });
  await flushPromises();
  return w;
};
it("separates formal, candidate, history snapshots and submits the exact detached revision", async () => {
  const d = definition(),
    w = await start(d);
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "正式值",
  );
  await click(w, "开放候选");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "候选值",
  );
  await click(w, "编辑版本");
  await w.get('input[aria-label="名称"]').setValue("新候选");
  await click(w, "提交版本");
  expect(d.adapter.submit).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: { key: "one", revision: "r3" },
      state: "open",
      input: { name: "新候选" },
      attachments: [],
    }),
  );
  expect(d.adapter.query).toHaveBeenCalledTimes(2);
  await click(w, "历史 r1");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "历史值",
  );
  expect(button(w, "编辑版本")).toBeUndefined();
  await click(w, "审计");
  expect(w.text()).toContain("精确审计");
  w.unmount();
});
async function add(w: ReturnType<typeof mount>, ...names: string[]) {
  const input = w.get('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    value: names.map(
      (name) => new File(["synthetic"], name, { type: "text/plain" }),
    ),
    configurable: true,
  });
  await input.trigger("change");
  await flushPromises();
}
it("stages only at submit and reuses successful artifacts after an explicit business failure", async () => {
  const d = definition(),
    w = await start(d);
  vi.mocked(d.adapter.submit).mockResolvedValueOnce({
    status: "failure",
    message: "修订冲突",
  });
  await click(w, "编辑版本");
  await add(w, "one.txt", "two.txt");
  expect(d.adapter.attachments!.stage).not.toHaveBeenCalled();
  expect(d.adapter.submit).not.toHaveBeenCalled();
  await click(w, "提交版本");
  expect(w.text()).toContain("修订冲突");
  expect(d.adapter.attachments!.stage).toHaveBeenCalledTimes(2);
  expect(w.text()).toContain("暂存成功，尚未业务提交");
  await click(w, "关闭编辑");
  await click(w, "编辑版本");
  await click(w, "提交版本");
  expect(d.adapter.attachments!.stage).toHaveBeenCalledTimes(2);
  expect(d.adapter.submit).toHaveBeenLastCalledWith(
    expect.objectContaining({ attachments: ["staged-one", "staged-one"] }),
  );
  w.unmount();
});
it("blocks unknown staging through close/read/remount and requires matching stage evidence before reuse", async () => {
  const base = definition();
  vi.mocked(base.adapter.attachments!.stage).mockResolvedValueOnce({
    status: "unknown",
  });
  const verify = vi.fn(
    async (
      _a: unknown,
    ): Promise<
      import("../src/index").VersionReconciliation<string, { receipt: string }>
    > => ({
      status: "applied",
      operation: "stage",
      attemptId: "wrong",
      handle: "verified-handle",
      evidence: { receipt: "exact" },
    }),
  );
  const d = { ...base, reconcile: verify },
    w = await start(d);
  await click(w, "编辑版本");
  await add(w, "unknown.txt");
  await click(w, "提交版本");
  const original = vi.mocked(d.adapter.attachments!.stage).mock.calls[0][0];
  expect(original).toMatchObject({
    identity: { key: "one", revision: "r2" },
    owner: "owner-one",
    operation: "stage",
  });
  await click(w, "关闭编辑");
  await click(w, "重试读取");
  w.unmount();
  const v = await start(d);
  expect(button(v, "编辑版本").attributes("disabled")).toBeDefined();
  await click(v, "核实本次请求");
  expect(v.text()).toContain("证据不足");
  verify.mockResolvedValueOnce({
    status: "applied",
    operation: "business",
    attemptId: original.id,
    evidence: { receipt: "wrong kind" },
  });
  await click(v, "核实本次请求");
  expect(button(v, "编辑版本").attributes("disabled")).toBeDefined();
  await v.setProps({ permissions: { ...permissions, reconcile: false } });
  expect(button(v, "核实本次请求")).toBeUndefined();
  await v.setProps({ permissions });
  verify.mockResolvedValueOnce({
    status: "applied",
    operation: "stage",
    attemptId: original.id,
    handle: "verified-handle",
    evidence: { receipt: "exact" },
  });
  await click(v, "核实本次请求");
  expect(verify).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: original.id,
      fileId: original.fileId,
      identity: original.identity,
    }),
  );
  expect(d.adapter.submit).not.toHaveBeenCalled();
  await click(v, "编辑版本");
  await click(v, "提交版本");
  expect(d.adapter.attachments!.stage).toHaveBeenCalledTimes(1);
  expect(d.adapter.submit).toHaveBeenCalledWith(
    expect.objectContaining({ attachments: ["verified-handle"] }),
  );
  v.unmount();
});
it("uses exact candidate identity for approval, locks unknown and retries successful refresh only", async () => {
  const base = definition();
  vi.mocked(base.adapter.approve!).mockRejectedValueOnce(new Error("network"));
  const verify = vi.fn(
    async (
      a:
        | import("../src/index").VersionAttempt<D, I, string, string>
        | import("../src/index").StageAttempt<I, string, string>,
    ): Promise<
      import("../src/index").VersionReconciliation<string, { revision: string }>
    > => ({
      status: "applied",
      operation: "business",
      attemptId: a.id,
      evidence: { revision: a.identity.revision },
    }),
  );
  const d = { ...base, reconcile: verify },
    w = await start(d);
  await click(w, "开放候选");
  await click(w, "审批通过");
  expect(d.adapter.approve).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: { key: "one", revision: "r3" },
      state: "open",
      operation: "approve",
    }),
  );
  await click(w, "重试读取");
  expect(button(w, "审批通过").attributes("disabled")).toBeDefined();
  vi.mocked(d.adapter.query).mockRejectedValueOnce(new Error("刷新失败"));
  await click(w, "核实本次请求");
  expect(w.text()).toContain("刷新失败");
  expect(button(w, "审批通过").attributes("disabled")).toBeDefined();
  await click(w, "重试读取");
  expect(button(w, "审批通过").attributes("disabled")).toBeUndefined();
  expect(d.adapter.approve).toHaveBeenCalledTimes(1);
  await click(w, "停用版本");
  expect(d.adapter.disable).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: "disable",
      identity: { key: "one", revision: "r3" },
    }),
  );
  w.unmount();
});
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
it("isolates late reads and stops after a late stage while preserving its original successful artifact", async () => {
  const d = definition(),
    read = deferred<Awaited<ReturnType<typeof d.adapter.query>>>();
  vi.mocked(d.adapter.query).mockReturnValueOnce(read.promise);
  const w = await start(d);
  await w.setProps({ scope: "b" });
  await flushPromises();
  read.resolve({
    official: snap("过时值", "old"),
    candidate: null,
    history: [],
    audit: [],
  });
  await flushPromises();
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "正式值",
  );
  const staged =
    deferred<
      Awaited<ReturnType<NonNullable<typeof d.adapter.attachments>["stage"]>>
    >();
  vi.mocked(d.adapter.attachments!.stage).mockReturnValueOnce(staged.promise);
  await click(w, "编辑版本");
  await add(w, "late.txt");
  await click(w, "提交版本");
  await w.setProps({ scope: "c" });
  await flushPromises();
  staged.resolve({ status: "success", handle: "late-handle" });
  await flushPromises();
  expect(d.adapter.submit).not.toHaveBeenCalled();
  await w.setProps({ scope: "b" });
  await flushPromises();
  await click(w, "编辑版本");
  await click(w, "提交版本");
  expect(d.adapter.attachments!.stage).toHaveBeenCalledTimes(1);
  expect(d.adapter.submit).toHaveBeenCalledWith(
    expect.objectContaining({ scope: "b", attachments: ["late-handle"] }),
  );
  w.unmount();
});
it("retains failed stage siblings, validates locally and permits retry after exact not-applied proof", async () => {
  const base = definition();
  base.adapter.attachments!.validate = (f) =>
    f.size > 10 ? "文件过大" : undefined;
  vi.mocked(base.adapter.attachments!.stage)
    .mockResolvedValueOnce({ status: "success", handle: "first" })
    .mockResolvedValueOnce({ status: "unknown" });
  const d = {
    ...base,
    reconcile: async (
      a:
        | import("../src/index").VersionAttempt<D, I, string, string>
        | import("../src/index").StageAttempt<I, string, string>,
    ) => ({
      status: "not-applied" as const,
      operation: "stage" as const,
      attemptId: a.id,
      evidence: { receipt: a.id },
    }),
  };
  const w = await start(d);
  await click(w, "编辑版本");
  await add(w, "a.txt", "b.txt");
  await click(w, "提交版本");
  await click(w, "核实本次请求");
  await click(w, "提交版本");
  expect(d.adapter.attachments!.stage).toHaveBeenCalledTimes(3);
  expect(d.adapter.submit).toHaveBeenCalledWith(
    expect.objectContaining({ attachments: ["first", "staged-one"] }),
  );
  w.unmount();
});
it("aggregates local pending, honors readonly detail mode and rejects closed instance events", async () => {
  const { defineComponent, h } = await import("vue");
  const { configurationBlock } = await import("../src/index");
  const events: Array<{
    change: (v: string) => void;
    pending: (v: boolean) => void;
  }> = [];
  const Block = defineComponent(
    (
      p: import("../src/index").ConfigurationBlockProps<
        string,
        readonly string[]
      >,
    ) => {
      events.push({ change: p["onUpdate:modelValue"]!, pending: p.onPending! });
      return () => h("p", `${p.mode}:${p.modelValue}`);
    },
    {
      props: [
        "modelValue",
        "catalog",
        "mode",
        "disabled",
        "onUpdate:modelValue",
        "onPending",
      ],
    },
  );
  const base = definition();
  const d = defineVersion({
    ...base,
    fields: [],
    adapter: {
      ...base.adapter,
      query: async () => ({
        official: {
          ...snap("当前值", "r1"),
          values: { name: "当前值", other: "另一值" },
        },
        candidate: null,
        history: [],
        audit: [],
      }),
      submit: vi.fn(async () => ({ status: "success" as const })),
    },
  });
  const blocks = [
    configurationBlock<{ name: string; other: string }>()({
      key: "name",
      component: Block,
      catalog: [] as readonly string[],
    }),
    configurationBlock<{ name: string; other: string }>()({
      key: "other",
      component: Block,
      catalog: [] as readonly string[],
    }),
  ];
  const w = mount(VersionView as Component, {
    props: { definition: d, scope: "a", permissions, blocks },
  });
  await flushPromises();
  expect(w.text()).toContain("read:当前值");
  events[0].change("非法详情修改");
  await click(w, "编辑版本");
  const first = events.at(-2)!,
    second = events.at(-1)!;
  first.pending(true);
  second.pending(true);
  await flushPromises();
  first.pending(false);
  await flushPromises();
  expect(button(w, "提交版本").attributes("disabled")).toBeDefined();
  await w.setProps({ permissions: { ...permissions, write: false } });
  second.pending(false);
  await flushPromises();
  await w.setProps({ permissions });
  expect(button(w, "提交版本").attributes("disabled")).toBeUndefined();
  await click(w, "关闭编辑");
  await click(w, "编辑版本");
  first.change("迟到覆盖");
  first.pending(true);
  await flushPromises();
  expect(button(w, "提交版本").attributes("disabled")).toBeUndefined();
  await click(w, "提交版本");
  expect(d.adapter.submit).toHaveBeenCalledWith(
    expect.objectContaining({ input: { name: "当前值", other: "另一值" } }),
  );
  w.unmount();
});
it("keeps unknown without evidence or a verifier and records late business results in the original scope", async () => {
  const d = definition(),
    w = await start(d),
    outcome = deferred<import("../src/index").WriteResult>();
  vi.mocked(d.adapter.submit).mockReturnValueOnce(outcome.promise);
  await click(w, "编辑版本");
  await click(w, "提交版本");
  await w.setProps({ scope: "b" });
  await flushPromises();
  outcome.resolve({ status: "unknown" });
  await flushPromises();
  expect(w.text()).not.toContain("业务写入结果未知");
  await w.setProps({ scope: "a" });
  await flushPromises();
  expect(w.text()).toContain("业务写入结果未知");
  expect(button(w, "核实本次请求")).toBeUndefined();
  await click(w, "重试读取");
  expect(button(w, "编辑版本").attributes("disabled")).toBeDefined();
  w.unmount();
});
it("rejects invalid local files and keeps historical attachment reads tied to exact owner/handle", async () => {
  const d = definition();
  d.adapter.attachments!.validate = () => "文件限制";
  const query = vi.mocked(d.adapter.query);
  query.mockResolvedValueOnce({
    official: snap("正式值", "r2"),
    candidate: null,
    history: [
      {
        ...snap("历史值", "r1"),
        owner: "historic-owner",
        attachments: [{ label: "old.txt", handle: "historic-handle" }],
      },
    ],
    audit: [],
  });
  const w = await start(d);
  await click(w, "编辑版本");
  await add(w, "invalid.txt");
  expect(w.text()).toContain("文件限制");
  expect(w.text()).not.toContain("invalid.txt");
  await click(w, "关闭编辑");
  const content = deferred<{ content: Blob; filename: string }>();
  vi.mocked(d.adapter.attachments!.read).mockReturnValueOnce(content.promise);
  const create = vi.fn(() => "blob:synthetic");
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
  await click(w, "历史 r1");
  await click(w, "读取附件 old.txt");
  expect(d.adapter.attachments!.read).toHaveBeenCalledWith({
    scope: "a",
    owner: "historic-owner",
    handle: "historic-handle",
  });
  await click(w, "正式资料");
  content.resolve({ content: new Blob(["old"]), filename: "old.txt" });
  await flushPromises();
  expect(create).not.toHaveBeenCalled();
  w.unmount();
  vi.unstubAllGlobals();
});
it("retains the selected exact historical snapshot when a refresh reorders version listings", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "历史 r1");
  vi.mocked(d.adapter.query).mockResolvedValueOnce({
    official: snap("新正式值", "r9"),
    candidate: null,
    history: [snap("别的历史", "r8"), snap("不应替换所选快照", "r1")],
    audit: [],
  });
  await click(w, "重试读取");
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "历史值",
  );
  w.unmount();
});
it("restores the retained staged draft's source view and caption before editing another version", async () => {
  const d = definition(),
    w = await start(d);
  vi.mocked(d.adapter.submit).mockResolvedValueOnce({
    status: "failure",
    message: "明确未应用",
  });
  await click(w, "开放候选");
  await click(w, "编辑版本");
  await add(w, "retained.txt");
  await click(w, "提交版本");
  await click(w, "关闭编辑");
  await click(w, "正式资料");
  await click(w, "编辑版本");
  expect(w.text()).toContain("版本：r3");
  expect(w.text()).not.toContain("版本：r2");
  await click(w, "提交版本");
  expect(d.adapter.submit).toHaveBeenLastCalledWith(
    expect.objectContaining({ identity: { key: "one", revision: "r3" } }),
  );
  expect(d.adapter.attachments!.stage).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("ignores late verification after permission revocation and scope changes", async () => {
  const base = definition();
  vi.mocked(base.adapter.submit).mockResolvedValueOnce({ status: "unknown" });
  const proof =
    deferred<
      import("../src/index").VersionReconciliation<string, { receipt: string }>
    >();
  const d = { ...base, reconcile: vi.fn(() => proof.promise) },
    w = await start(d);
  await click(w, "编辑版本");
  await click(w, "提交版本");
  const a = vi.mocked(d.adapter.submit).mock.calls[0][0];
  await click(w, "核实本次请求");
  await w.setProps({ permissions: { ...permissions, reconcile: false } });
  proof.resolve({
    status: "applied",
    operation: "business",
    attemptId: a.id,
    evidence: { receipt: a.id },
  });
  await flushPromises();
  expect(w.text()).toContain("业务写入结果未知");
  expect(button(w, "提交版本").attributes("disabled")).toBeDefined();
  w.unmount();
});
