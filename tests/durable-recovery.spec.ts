import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { beforeEach, expect, it, vi } from "vitest";
import {
  AppPage,
  defineOperation,
  defineTaskPage,
  type OperationJournal,
  type OperationPreview,
  type OperationRequest,
  type OperationReceipt,
} from "../src/index";
type Model = {
  process: {
    input: { value: string };
    preview: OperationPreview;
    evidence: { binding: string };
  };
};
const owner = { scope: "session", operator: "operator", resource: "recovery" };
beforeEach(() => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: async (_: string, work: () => unknown) => work() },
  });
});
function fixture() {
  const records = new Map<string, OperationJournal<Model, string, number>>();
  let head: string | undefined;
  let failReceipt = false;
  const receipt = (
    r: OperationRequest<Model, string, number>,
  ): OperationReceipt<Model> => ({
    action: r.action,
    owner: r.owner,
    requestId: r.requestId,
    binding: r.binding,
    status: "applied",
    evidence: { binding: r.binding },
  });
  const execute = vi.fn(async (r: OperationRequest<Model, string, number>) =>
    receipt(r),
  );
  const reconcile = vi.fn(async (r: OperationRequest<Model, string, number>) =>
    receipt(r),
  );
  const refresh = vi.fn(async () => {});
  const definition = defineOperation<Model, string, number>({
    protocol: "operation",
    persistence: {
      load: vi.fn(async (_owner, id) =>
        structuredClone(records.get(id ?? head ?? "") ?? null),
      ),
      save: async (j) => {
        if (j.receipt && failReceipt) {
          failReceipt = false;
          throw Error("终态保存失败");
        }
        head = j.request.requestId;
        records.set(head, structuredClone(j));
      },
      remove: async (_owner, id) => {
        records.set(id, { ...records.get(id)!, completed: true });
      },
    },
    adapter: {
      prepare: async (intent) => ({
        ...intent,
        requestId: crypto.randomUUID(),
        binding: "original-binding",
        concurrency: 1,
        preview: { title: "原请求预览", sections: [] },
      }),
      acceptsPreparation: () => true,
      execute,
      reconcile,
      seal: async (r) => receipt(r),
      refresh,
      accepts: (r, proof) => r.binding === proof.evidence.binding,
    },
  });
  return {
    definition,
    records,
    execute,
    reconcile,
    refresh,
    failReceipt() {
      failReceipt = true;
    },
  };
}
async function start(f: ReturnType<typeof fixture>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  const page = defineTaskPage<{ value: string }, Model, string, number>({
    title: "恢复验证",
    instance: "recovery",
    owner,
    identity: "one",
    definition: f.definition,
    values: { value: "原输入" },
    fields: [],
    actions: ["process"],
    toIntent: (input, action, base) => ({ ...base, action, input }),
    eligible: true,
    recoveryAllowed: true,
  });
  const w = mount(AppPage, {
    props: {
      page,
      scope: owner.scope,
      brand: {
        home: "/",
        productName: "合成",
        enterpriseName: "合成",
        mark: { kind: "text", text: "合" },
      },
      brandState: { kind: "ready" },
      navigationState: { kind: "ready" },
      navigation: [],
      footer: "合成",
    },
    global: { plugins: [router] },
  });
  await flushPromises();
  return w;
}
function button(w: VueWrapper, name: string) {
  return w.findAll("button").find((b) => b.text() === name)!;
}
async function click(w: VueWrapper, name: string) {
  expect(button(w, name), name).toBeDefined();
  await button(w, name).trigger("click");
  await flushPromises();
}
it("retries saving an accepted terminal receipt without re-verifying or executing the original", async () => {
  const f = fixture();
  f.failReceipt();
  const w = await start(f);
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  expect(w.text()).toContain("终态保存失败");
  await click(w, "重试读取");
  expect(f.reconcile).not.toHaveBeenCalled();
  expect(f.execute).toHaveBeenCalledTimes(1);
  expect(f.refresh).toHaveBeenCalledTimes(1);
  expect(w.text()).toContain("可显式准备新请求");
  w.unmount();
});
it.each(["input", "association", "concurrency", "preview"] as const)(
  "rejects changed original %s even when a corrupt store repeats its ID and binding",
  async (change) => {
    const f = fixture();
    f.execute.mockResolvedValue({ status: "unknown" } as never);
    const w = await start(f);
    await click(w, "准备执行处理");
    await click(w, "确认执行处理");
    const original = [...f.records.values()][0]!;
    let changed = structuredClone(original);
    if (change === "input")
      changed = {
        ...changed,
        request: {
          ...changed.request,
          input: { value: "被替换的输入" },
        },
      };
    if (change === "concurrency")
      changed = {
        ...changed,
        request: { ...changed.request, concurrency: 99 },
      };
    if (change === "preview")
      changed = {
        ...changed,
        request: {
          ...changed.request,
          preview: { title: "替换预览", sections: [] },
        },
      };
    if (change === "association")
      changed = {
        ...changed,
        association: {
          kind: "batch",
          batchId: "other",
          entryKey: "other",
        },
      };
    f.records.set(original.request.requestId, changed);
    await click(w, "核实原请求");
    expect(f.reconcile).not.toHaveBeenCalled();
    expect(f.refresh).not.toHaveBeenCalled();
    expect(button(w, "准备执行处理").attributes("disabled")).toBeDefined();
    expect(w.text()).toContain("原请求或已确认终态已改变");
    w.unmount();
  },
);

it("keeps an accepted outcome locked when persistence returns contradictory terminal evidence", async () => {
  const f = fixture();
  f.failReceipt();
  const w = await start(f);
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  const original = [...f.records.values()][0]!;
  f.records.set(original.request.requestId, {
    ...original,
    receipt: {
      action: "process",
      owner,
      requestId: original.request.requestId,
      binding: original.request.binding,
      status: "not-applied",
      sealed: true,
      evidence: { binding: original.request.binding },
    },
  });
  await click(w, "重试读取");
  expect(f.reconcile).not.toHaveBeenCalled();
  expect(f.refresh).not.toHaveBeenCalled();
  expect(w.text()).toContain("原请求或已确认终态已改变");
  expect(button(w, "准备执行处理").attributes("disabled")).toBeDefined();
  w.unmount();
});
it("clears sensitive original content on session invalidation while retaining its late receipt under the old owner", async () => {
  const f = fixture();
  let finish!: (value: OperationReceipt<Model>) => void;
  f.execute.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const w = await start(f);
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  const original = [...f.records.values()][0]!;
  await w.setProps({ active: false, scope: "next-session" });
  await flushPromises();
  expect(w.text()).not.toContain(original.request.requestId);
  finish({
    action: "process",
    owner,
    requestId: original.request.requestId,
    binding: original.request.binding,
    status: "applied",
    evidence: { binding: original.request.binding },
  });
  await flushPromises();
  expect(f.refresh).not.toHaveBeenCalled();
  expect(f.records.get(original.request.requestId)?.receipt?.owner).toEqual(
    owner,
  );
  expect(w.text()).not.toContain(original.request.requestId);
  w.unmount();
});
