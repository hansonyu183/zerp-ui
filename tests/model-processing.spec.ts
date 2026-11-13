import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import {
  application,
  object,
  collection,
  operation,
  text,
  type ModelOperationJournal,
  type ModelActionModel,
  type ModelNode,
} from "../src/model";
beforeEach(() =>
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: async (_key: string, work: () => unknown) => work() },
  }),
);
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = "";
});
async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (button) =>
      button.textContent?.trim() === label ||
      button.getAttribute("aria-label") === label,
  );
  expect(button, label + document.body.textContent).toBeTruthy();
  button!.click();
  await flushPromises();
}
async function fixture(
  withPrompt = false,
  initialize?: {
    run: () => Promise<{ value: { note: string } }>;
    disabledReason?: string;
  },
) {
  const input = object(
    "处理输入",
    {
      note: text("说明", { value: "原始说明" }),
    },
    {
      operations: {
        ...(initialize ? { initialize } : {}),
        calculate: {
          async run({ input }) {
            return {
              value: input,
              interactions: withPrompt
                ? [
                    {
                      kind: "confirm" as const,
                      id: "business-check",
                      label:
                        input.note === "changed"
                          ? "确认变更依据"
                          : "确认业务依据",
                      required: true,
                    },
                  ]
                : [],
            };
          },
        },
      },
    },
  );
  type M = ModelActionModel<"process", typeof input, { digest: string }>;
  let journal: ModelOperationJournal<
    M,
    { id: string },
    string,
    readonly [{ parentId: string }]
  > | null = null;
  const run = vi.fn(async () => ({ status: "unknown" as const }));
  const reconcile = vi.fn(
    async (request: NonNullable<typeof journal>["request"]) => ({
      status: "applied" as const,
      owner: request.owner,
      action: request.action,
      requestId: request.requestId,
      binding: request.binding,
      evidence: { digest: "exact" },
    }),
  );
  const refresh = vi.fn(async () => {});
  const action = operation<
    "process",
    typeof input,
    { id: string },
    string,
    { digest: string },
    M,
    readonly [{ parentId: string }]
  >("process", input, {
    async prepare(intent) {
      return {
        ...intent,
        requestId: "original",
        concurrency: "1",
        binding: "binding",
        preview: { title: "权威预览", sections: [] },
      };
    },
    acceptsPreparation: () => true,
    run,
    reconcile,
    seal: async (_request, receipt) => receipt,
    refresh,
    accepts: (_request, receipt) => receipt.evidence.digest === "exact",
    persistence: {
      async load() {
        return journal;
      },
      async save(value, expected) {
        expect(journal?.request.requestId ?? null).toBe(expected);
        journal = structuredClone(value);
      },
      async remove(_owner, expected) {
        expect(journal?.request.requestId).toBe(expected);
        journal = journal ? { ...journal, completed: true } : null;
      },
    },
  });
  const target = object(
    "处理",
    { id: text("编号", { value: "a", readOnly: true }) },
    { identity: ["id"], operations: { process: action } },
  );
  const parent = object(
    "父业务",
    { parentId: text("父编号", { value: "parent-original" }), target },
    {
      identity: ["parentId"],
      operations: {
        update: {
          async run() {
            return { status: "success" };
          },
        },
      },
    },
  );
  const parents = collection("父业务列表", () => parent, {
    operations: {
      query: {
        async run() {
          return { items: [parent], total: 1 };
        },
      },
    },
  });
  const model = reactive(
    application(
      "合成办理",
      { parents },
      {
        owner: { ledger: "test", operator: "user", generation: "1" },
        brand: {
          productName: "合成",
          enterpriseName: "合成",
          home: "/",
          mark: { kind: "text", text: "例" },
        },
        navigation: {
          current: { node: parents },
          href: () => "/",
          visit() {},
          guard: () => () => {},
        },
      },
    ),
  );
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: {} }],
  });
  await router.push("/");
  await router.isReady();
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
    global: { plugins: [router] },
  });
  wrappers.push(wrapper);
  await flushPromises();
  await click("编辑");
  await click("处理");
  return {
    parent: model.parents.items[0]!,
    wrapper,
    model,
    action,
    run,
    reconcile,
    refresh,
    async reload() {
      wrapper.unmount();
      const next = mount(BusinessApplication, {
        props: { model },
        attachTo: document.body,
        global: { plugins: [router] },
      });
      wrappers.push(next);
      await flushPromises();
      await click("编辑");
      await click("处理");
    },
    journal: () => journal,
  };
}
it("initializes operation inputs once after journal loading and keeps the original locked on reload", async () => {
  const initialize = vi.fn(async () => ({
    value: { note: "从业务读取的说明" },
  }));
  const f = await fixture(false, { run: initialize });
  expect(initialize).toHaveBeenCalledTimes(1);
  const note = document.querySelector<HTMLInputElement>(
    'input[aria-label="说明"]',
  )!;
  expect(note.value).toBe("从业务读取的说明");
  note.value = "用户修改";
  note.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  expect(initialize).toHaveBeenCalledTimes(1);
  await click("准备执行处理");
  await click("确认执行处理");
  expect(f.journal()!.request.input.note).toBe("用户修改");
  await f.reload();
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(f.run).toHaveBeenCalledTimes(1);
  await click("核实原请求");
  expect(f.reconcile.mock.calls[0]![0].input.note).toBe("用户修改");
  expect(f.run).toHaveBeenCalledTimes(1);
});

it("retries a failed first input initialization before accepting ordinary changes", async () => {
  const initialize = vi
    .fn()
    .mockRejectedValueOnce(Error("读取办理参数失败"))
    .mockResolvedValue({ value: { note: "重读后的说明" } });
  await fixture(false, { run: initialize });
  expect(document.body.textContent).toContain("读取办理参数失败");
  expect(initialize).toHaveBeenCalledTimes(1);
  await click("重试业务计算");
  expect(initialize).toHaveBeenCalledTimes(2);
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="说明"]')?.value,
  ).toBe("重读后的说明");
});
it("retries initialization when its first response was discarded after qualification changed", async () => {
  let finish!: (value: { value: { note: string } }) => void;
  const first = new Promise<{ value: { note: string } }>((resolve) => {
    finish = resolve;
  });
  const run = vi
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValue({ value: { note: "重新读取" } });
  const initialize = reactive({ run, disabledReason: "" });
  await fixture(false, initialize);
  expect(run).toHaveBeenCalledTimes(1);
  initialize.disabledReason = "暂时不可读取";
  finish({ value: { note: "迟到内容" } });
  await flushPromises();
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="说明"]')?.value,
  ).not.toBe("迟到内容");
  initialize.disabledReason = "";
  const note = document.querySelector<HTMLInputElement>(
    'input[aria-label="说明"]',
  )!;
  note.value = "触发重新读取";
  note.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  expect(run).toHaveBeenCalledTimes(2);
  expect(note.value).toBe("重新读取");
});
it("confirms an authoritative preview and reconciles the original unknown request without resending", async () => {
  const f = await fixture();
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="说明"]')?.value,
  ).toBe("原始说明");
  await click("准备执行处理");
  expect(f.run).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("权威预览");
  await click("确认执行处理");
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(f.journal()!.request.ancestors).toEqual([
    { parentId: "parent-original" },
  ]);
  f.parent.parentId.value = "parent-later";
  await flushPromises();
  expect(f.journal()!.request.ancestors).toEqual([
    { parentId: "parent-original" },
  ]);
  f.parent.parentId.value = "parent-original";
  await f.reload();
  await click("核实原请求");
  expect(f.reconcile.mock.calls[0]![0].ancestors).toEqual([
    { parentId: "parent-original" },
  ]);
  expect(f.reconcile).toHaveBeenCalledTimes(1);
  expect(f.refresh).toHaveBeenCalledTimes(1);
  expect(f.run).toHaveBeenCalledTimes(1);
});
it("keeps the original operation recoverable while another family replaces its model node", async () => {
  const f = await fixture();
  await click("准备执行处理");
  await click("确认执行处理");
  const { workflowOperations } = await import("../src/model");
  const audit = object("审计", {});
  const query = vi.fn(async () => ({ items: [], total: 0 }));
  const replacement = object(
    "新流程",
    {},
    {
      operations: workflowOperations<
        string,
        string,
        string,
        string,
        string,
        typeof audit
      >(audit, {
        query: { run: query },
        get: {
          async run() {
            return { identity: "new", label: "new", nodes: [] };
          },
        },
        audit: {
          async run() {
            return [];
          },
        },
      }),
    },
  );
  (f.parent as unknown as { target: ModelNode }).target = replacement;
  await flushPromises();
  expect(query).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("核实原请求");
  await click("核实原请求");
  expect(f.reconcile).toHaveBeenCalledTimes(1);
  expect(f.refresh).toHaveBeenCalledTimes(1);
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenCalledTimes(1);
});

it("offers a fixed reconcile operation on a read-only historical original without a business write", async () => {
  const input = object("核对", {});
  type M = ModelActionModel<"reconcile", typeof input, { originalId: string }>;
  let journal: ModelOperationJournal<M, { requestId: string }, string> | null =
    null;
  const run = vi.fn(
    async (request: NonNullable<typeof journal>["request"]) => ({
      status: "applied" as const,
      owner: request.owner,
      action: request.action,
      requestId: request.requestId,
      binding: request.binding,
      evidence: { originalId: request.identity.requestId },
    }),
  );
  const action = operation<
    "reconcile",
    typeof input,
    { requestId: string },
    string,
    { originalId: string }
  >("reconcile", input, {
    async prepare(intent) {
      return {
        ...intent,
        requestId: "verification-1",
        concurrency: "original-digest",
        binding: "verification-binding",
        preview: { title: "核对历史原件", sections: [] },
      };
    },
    acceptsPreparation: () => true,
    run,
    reconcile: run,
    seal: async (_request, receipt) => receipt,
    async refresh() {},
    accepts: (request, receipt) =>
      receipt.evidence.originalId === request.identity.requestId,
    persistence: {
      async load() {
        return journal;
      },
      async save(value) {
        journal = structuredClone(value);
      },
      async remove() {
        if (journal) journal = { ...journal, completed: true };
      },
    },
  });
  const target = object(
    "历史原件",
    {
      requestId: text("原请求号", {
        value: "historical-original",
        readOnly: true,
      }),
    },
    {
      readOnly: true,
      identity: ["requestId"],
      operations: { reconcile: action },
    },
  );
  const model = reactive(
    application(
      "历史",
      { target },
      {
        owner: { ledger: "test", operator: "u", generation: "1" },
        brand: {
          productName: "合成",
          enterpriseName: "合成",
          home: "/",
          mark: { kind: "text", text: "例" },
        },
        navigation: {
          current: { node: target },
          href: () => "/",
          visit() {},
          guard: () => () => {},
        },
      },
    ),
  );
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: {} }],
  });
  await router.push("/");
  wrappers.push(
    mount(BusinessApplication, {
      props: { model },
      attachTo: document.body,
      global: { plugins: [router] },
    }),
  );
  await flushPromises();
  await click("准备核对原请求");
  await click("确认核对原请求");
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]![0]).toMatchObject({
    action: "reconcile",
    identity: { requestId: "historical-original" },
    concurrency: "original-digest",
  });
  expect(journal).toMatchObject({
    completed: true,
    request: { requestId: "verification-1" },
    receipt: { evidence: { originalId: "historical-original" } },
  });
});

it("freezes accepted script answers in a fixed operation and keeps them on reload", async () => {
  const f = await fixture(true);
  const checkbox = document.querySelector<HTMLInputElement>(
    'input[aria-label="确认业务依据"]',
  );
  expect(checkbox).toBeTruthy();
  checkbox!.click();
  await flushPromises();
  const note = document.querySelector<HTMLInputElement>(
    'input[aria-label="说明"]',
  )!;
  note.value = "changed";
  note.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  const changed = document.querySelector<HTMLInputElement>(
    'input[aria-label="确认变更依据"]',
  )!;
  expect(changed.checked).toBe(false);
  const prepare = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.trim() === "准备执行处理")!;
  expect(prepare.disabled).toBe(true);
  changed.click();
  await flushPromises();
  await click("准备执行处理");
  await click("确认执行处理");
  expect(f.journal()!.request.answers).toEqual({ "business-check": true });
  await f.reload();
  await click("核实原请求");
  expect(f.reconcile.mock.calls[0]![0].answers).toEqual({
    "business-check": true,
  });
  expect(f.run).toHaveBeenCalledTimes(1);
});

it("rejects a preparation that changes the accepted answers", async () => {
  const f = await fixture();
  const prepare = f.action.prepare;
  f.action.prepare = async (intent) => ({
    ...(await prepare(intent)),
    answers: { invented: true },
  });
  await click("准备执行处理");
  expect(document.body.textContent).toContain("准备结果改变了问题回答");
  expect(f.journal()).toBeNull();
  expect(f.run).not.toHaveBeenCalled();
});
