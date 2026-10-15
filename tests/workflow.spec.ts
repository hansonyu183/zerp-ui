import { mount, flushPromises } from "@vue/test-utils";
import { it, expect, vi } from "vitest";
import type { Component } from "vue";
import {
  WorkflowRuntime,
  defineWorkflow,
  type WorkflowAdapter,
} from "../src/index";
const permissions = {
  read: true,
  audit: true,
  reconcile: true,
  actions: ["APPROVE_CHILD", "OPEN_DOCUMENT", "CREATE_CHILD"] as const,
  targets: ["allowed"],
};
function definition() {
  const adapter: WorkflowAdapter<
    string,
    string,
    string,
    { entity: string },
    { id: string },
    { event: string }
  > = {
    list: vi.fn(async () => ({
      items: [
        { identity: "one", label: "流程一" },
        { identity: "two", label: "流程二" },
      ],
      total: 2,
    })),
    get: vi.fn(async ({ identity }) => ({
      identity,
      label: identity,
      nodes: [
        {
          identity: "n1",
          revision: "r7",
          label: "合成节点",
          state: "待处理",
          document: { id: "doc1" },
          eligible: [
            "APPROVE_CHILD",
            "OPEN_DOCUMENT",
            "CREATE_CHILD",
            "CANCEL_CHILD",
          ] as const,
          targets: [
            { key: "allowed", label: "目标甲", identity: { entity: "a" } },
            { key: "denied", label: "目标乙", identity: { entity: "b" } },
          ],
        },
      ],
    })),
    audit: vi.fn(async () => [{ event: "历史审批" }]),
    act: vi.fn(async () => ({ status: "success" as const })),
  };
  return defineWorkflow({
    resource: "workflow",
    title: "合成流程",
    adapter,
    auditColumns: [{ key: "event", label: "事件" }],
  });
}
const button = (w: ReturnType<typeof mount>, label: string) =>
  w.findAll("button").find((b) => b.text() === label)!;
const click = async (w: ReturnType<typeof mount>, label: string) => {
  await button(w, label).trigger("click");
  await flushPromises();
};
const start = async (
  d: import("../src/index").WorkflowDefinition<
    string,
    string,
    string,
    { entity: string },
    { id: string },
    { event: string },
    unknown
  > = definition(),
) => {
  const w = mount(WorkflowRuntime as Component, {
    props: { definition: d, scope: "a", permissions },
  });
  await flushPromises();
  return w;
};
it("shows backend/permission action and target intersections, sends exact node revision and refreshes", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "查看 流程一");
  expect(w.text()).toContain("历史审批");
  expect(w.text()).not.toContain("取消下级");
  expect(w.text()).not.toContain("目标乙");
  await w.get('input[aria-label="操作原因"]').setValue("合成原因");
  await click(w, "批准下级");
  expect(d.adapter.act).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: "a",
      instance: "one",
      node: "n1",
      revision: "r7",
      operation: "APPROVE_CHILD",
      reason: "合成原因",
    }),
  );
  expect(w.text()).toContain("节点动作已成功");
  w.unmount();
});

it("keeps unknown requests across refresh, close and remount; only exact evidence unlocks", async () => {
  const d = definition();
  vi.mocked(d.adapter.act).mockResolvedValue({ status: "unknown" });
  const verify = vi.fn(async (_attempt: unknown) => ({
    status: "applied" as const,
    attemptId: "historical",
    evidence: { audit: "old" },
  }));
  const defined = defineWorkflow({ ...d, reconcile: verify });
  let w = await start(defined);
  await click(w, "查看 流程一");
  await click(w, "批准下级");
  const original = vi.mocked(d.adapter.act).mock.calls[0]![0];
  await click(w, "重试读取");
  await click(w, "关闭实例");
  w.unmount();
  w = await start(defined);
  await click(w, "查看 流程二");
  expect(button(w, "批准下级").attributes("disabled")).toBeDefined();
  await click(w, "核实本次请求");
  expect(verify).toHaveBeenCalledWith(original);
  expect(w.text()).toContain("证据不足");
  verify.mockResolvedValueOnce({
    status: "applied",
    attemptId: original.id,
    evidence: { audit: "exact" },
  });
  await click(w, "核实本次请求");
  expect(button(w, "批准下级").attributes("disabled")).toBeUndefined();
  expect(d.adapter.act).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("invalidates late verification when selecting another instance", async () => {
  const d = definition();
  vi.mocked(d.adapter.act).mockResolvedValue({ status: "unknown" });
  let resolve!: (value: {
    status: "applied";
    attemptId: string;
    evidence: string;
  }) => void;
  const defined = defineWorkflow({
    ...d,
    reconcile: () =>
      new Promise<{ status: "applied"; attemptId: string; evidence: string }>(
        (r) => {
          resolve = r;
        },
      ),
  });
  const w = await start(defined);
  await click(w, "查看 流程一");
  await click(w, "批准下级");
  await click(w, "核实本次请求");
  await click(w, "查看 流程二");
  resolve({
    status: "applied",
    attemptId: vi.mocked(d.adapter.act).mock.calls[0]![0].id,
    evidence: "exact",
  });
  await flushPromises();
  expect(button(w, "批准下级").attributes("disabled")).toBeDefined();
  w.unmount();
});
it("refresh failure retries reads without replay; failures retain actionable facts", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "查看 流程一");
  vi.mocked(d.adapter.act).mockResolvedValueOnce({
    status: "failure",
    message: "修订冲突",
  });
  await click(w, "批准下级");
  expect(w.text()).toContain("修订冲突");
  vi.mocked(d.adapter.get).mockRejectedValueOnce(new Error("刷新失败"));
  await click(w, "批准下级");
  expect(w.text()).toContain("刷新失败");
  expect(w.find('[aria-label="流程节点"]').exists()).toBe(false);
  await click(w, "重试读取");
  expect(button(w, "批准下级").attributes("disabled")).toBeUndefined();
  expect(d.adapter.act).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("sends a typed target and emits document navigation only after an applied open action", async () => {
  const d = definition(),
    w = await start(d);
  await click(w, "查看 流程一");
  await w.get('select[aria-label="合成节点创建目标"]').setValue("allowed");
  await click(w, "创建下级");
  expect(d.adapter.act).toHaveBeenLastCalledWith(
    expect.objectContaining({
      operation: "CREATE_CHILD",
      target: { entity: "a" },
    }),
  );
  vi.mocked(d.adapter.act).mockResolvedValueOnce({ status: "unknown" });
  await click(w, "打开单据");
  expect(w.emitted("open-document")).toBeUndefined();
  w.unmount();
  const d2 = definition(),
    w2 = await start(d2);
  await click(w2, "查看 流程一");
  await click(w2, "打开单据");
  expect(w2.emitted("open-document")).toEqual([[{ id: "doc1" }]]);
  w2.unmount();
});
it("isolates out-of-order instance/scope reads and preserves pending writes in their original scope", async () => {
  const d = definition(),
    w = await start(d);
  const original = d.adapter.get;
  let finish!: (value: Awaited<ReturnType<typeof original>>) => void;
  vi.mocked(d.adapter.get).mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  await click(w, "查看 流程一");
  await click(w, "查看 流程二");
  finish({ identity: "old", label: "迟到实例", nodes: [] });
  await flushPromises();
  expect(w.text()).not.toContain("迟到实例");
  let complete!: (value: { status: "unknown" }) => void;
  vi.mocked(d.adapter.act).mockImplementationOnce(
    () =>
      new Promise((r) => {
        complete = r;
      }),
  );
  await click(w, "批准下级");
  await w.setProps({ scope: "b" });
  await flushPromises();
  complete({ status: "unknown" });
  await flushPromises();
  await click(w, "查看 流程二");
  expect(button(w, "批准下级").attributes("disabled")).toBeUndefined();
  await w.setProps({ scope: "a" });
  await flushPromises();
  await click(w, "查看 流程一");
  expect(button(w, "批准下级").attributes("disabled")).toBeDefined();
  w.unmount();
});
it("handles empty/error/retry without leaving stale actionable details", async () => {
  const d = definition();
  vi.mocked(d.adapter.list).mockRejectedValueOnce(new Error("查询失败"));
  const w = await start(d);
  expect(w.text()).toContain("查询失败");
  vi.mocked(d.adapter.list).mockResolvedValueOnce({ items: [], total: 0 });
  await click(w, "重试读取");
  expect(w.text()).toContain("暂无数据");
  await click(w, "重试读取");
  await click(w, "查看 流程一");
  vi.mocked(d.adapter.audit).mockRejectedValueOnce(new Error("审计失败"));
  await click(w, "重试读取");
  expect(w.text()).toContain("审计失败");
  expect(w.find('[aria-label="流程节点"]').exists()).toBe(false);
  w.unmount();
});
it("accepts confirmed not-applied but never unlocks without audit/reconcile permission", async () => {
  const d = definition();
  vi.mocked(d.adapter.act).mockResolvedValue({ status: "unknown" });
  const verify = vi.fn(async (a: { id: string }) => ({
    status: "not-applied" as const,
    attemptId: a.id,
    evidence: "precise authoritative absence",
  }));
  const w = await start(defineWorkflow({ ...d, reconcile: verify }));
  await click(w, "查看 流程一");
  await click(w, "批准下级");
  await w.setProps({ permissions: { ...permissions, audit: false } });
  await flushPromises();
  expect(button(w, "核实本次请求")).toBeUndefined();
  expect(verify).not.toHaveBeenCalled();
  await w.setProps({ permissions });
  await flushPromises();
  await click(w, "核实本次请求");
  await click(w, "查看 流程一");
  expect(button(w, "批准下级").attributes("disabled")).toBeUndefined();
  w.unmount();
});
