import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { expect, it, vi, beforeEach } from "vitest";
import {
  AppPage,
  defineCrud,
  defineCrudPage,
  defineConfiguration,
  defineConfigurationPage,
  defineTaskPage,
  defineBatchPage,
  type PageDefinition,
  type OperationPreview,
  type OperationDefinition,
  type OperationJournal,
  type OperationRequest,
  type OperationReceipt,
  type BatchJournal,
  type WritePersistence,
  type WriteJournal,
  type Attempt,
  type DraftCollaboration,
} from "../src/index";
const owner = { scope: "s", operator: "op", resource: "processing" };
type Model = {
  process: {
    input: { value: string };
    preview: OperationPreview;
    evidence: { binding: string };
  };
};
beforeEach(() => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: async (_key: string, work: () => unknown) => work() },
  });
});
async function start(page: PageDefinition) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  const w = mount(AppPage, {
    props: {
      page,
      scope: "s",
      brand: {
        home: "/",
        productName: "合成库",
        enterpriseName: "合成公司",
        mark: { kind: "text", text: "合" },
      },
      brandState: { kind: "ready" },
      navigationState: { kind: "ready" },
      navigation: [],
      footer: "合成验证",
    },
    global: { plugins: [router] },
  });
  await flushPromises();
  return w;
}
function button(w: VueWrapper, name: string) {
  return w
    .findAll("button")
    .find((b) => b.text() === name || b.attributes("aria-label") === name)!;
}
async function click(w: VueWrapper, name: string) {
  expect(button(w, name), name).toBeDefined();
  await button(w, name).trigger("click");
  await flushPromises();
}
function operation() {
  let journal: OperationJournal<Model, string, number> | null = null;
  const archive = new Map<string, OperationJournal<Model, string, number>>();
  let request: OperationRequest<Model, string, number> | undefined;
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
  const execute = vi.fn(async (r: OperationRequest<Model, string, number>) => {
    request = r;
    return { status: "unknown" as const };
  });
  const refresh = vi.fn(async () => {});
  const definition: OperationDefinition<Model, string, number> = {
    protocol: "operation",
    persistence: {
      load: async (_owner, id) =>
        structuredClone(id ? (archive.get(id) ?? null) : journal),
      save: async (value, expected) => {
        if (
          expected === null
            ? journal && !journal.completed
            : journal?.request.requestId !== expected
        )
          throw Error("CAS");
        journal = structuredClone(value);
        archive.set(value.request.requestId, journal);
      },
      remove: async (_owner, id) => {
        if (journal?.request.requestId !== id || !journal.refreshed)
          throw Error("CAS");
        journal = { ...journal, completed: true };
        archive.set(id, journal);
      },
    },
    adapter: {
      prepare: async (intent) => ({
        ...intent,
        requestId: crypto.randomUUID(),
        binding: JSON.stringify(intent),
        concurrency: 1,
        preview: { title: "完整处理预览", sections: [] },
      }),
      acceptsPreparation: (intent, r) => r.binding === JSON.stringify(intent),
      execute,
      reconcile: async (r) => receipt(r),
      seal: async (r) => receipt(r),
      refresh,
      accepts: (r, proof) => proof.evidence.binding === r.binding,
    },
  };
  return {
    definition,
    execute,
    refresh,
    get request() {
      return request;
    },
  };
}
function writeStore<A, C = unknown>(initial: WriteJournal<A, C> | null = null) {
  let value = initial;
  const port: WritePersistence<A, C> = {
    load: vi.fn(async () => structuredClone(value)),
    save: vi.fn(async (journal) => {
      value = structuredClone(journal);
    }),
    complete: vi.fn(async () => {
      value = value ? { ...value, completed: true } : null;
    }),
  };
  return {
    port,
    get value() {
      return value;
    },
  };
}
function crud(
  persistence: WritePersistence<Attempt<{ name: string }, string>>,
) {
  return defineCrud<
    { name: string },
    {},
    { id: string; name: string },
    string,
    { id: string }
  >({
    resource: "records",
    title: "资料维护",
    fields: [{ key: "name", label: "名称", type: "text" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: (r) => r.id,
    actions: () => ["view", "edit"],
    persistence,
    adapter: {
      query: vi.fn(async () => ({
        items: [{ id: "one", name: "原值" }],
        total: 1,
      })),
      get: async () => ({ values: { name: "原值" }, identity: "one" }),
      empty: () => ({ name: "" }),
      create: vi.fn(async () => ({ status: "unknown" as const })),
      save: vi.fn(async () => ({ status: "unknown" as const })),
    },
    reconcile: vi.fn(async (a) => ({
      status: "applied" as const,
      attemptId: a.id,
      evidence: { id: a.id },
    })),
  });
}
it("restores a durable CRUD original across fresh adapter identities without replay; reads never unlock it", async () => {
  const original: Attempt<{ name: string }, string> = {
    id: "original",
    scope: "s",
    resource: "records",
    operation: "save",
    identity: "one",
    input: { name: "未确认" },
  };
  const store = writeStore({ attempt: original });
  const d = crud(store.port);
  const w = await start(
    defineCrudPage({
      definition: d,
      permissions: { query: true, create: true, write: true, reconcile: true },
    }),
  );
  expect(w.text()).toContain("请求结果未知");
  expect(button(w, "新增").attributes("disabled")).toBeDefined();
  await click(w, "查询");
  expect(w.text()).toContain("请求结果未知");
  expect(d.adapter.save).not.toHaveBeenCalled();
  await click(w, "核实本次请求");
  expect(store.port.complete).toHaveBeenCalledWith(
    { scope: "s", resource: "records" },
    "original",
  );
  expect(button(w, "新增").attributes("disabled")).toBeUndefined();
  w.unmount();
  const fresh = crud(store.port),
    next = await start(
      defineCrudPage({
        definition: fresh,
        permissions: {
          query: true,
          create: true,
          write: true,
          reconcile: true,
        },
      }),
    );
  expect(next.text()).not.toContain("请求结果未知");
  expect(fresh.adapter.save).not.toHaveBeenCalled();
  next.unmount();
});
it("blocks a corrupt/failed recovery and retries recovery rather than sending a write", async () => {
  const store = writeStore<Attempt<{ name: string }, string>>();
  vi.mocked(store.port.load).mockRejectedValueOnce(Error("读取失败"));
  const d = crud(store.port),
    w = await start(
      defineCrudPage({
        definition: d,
        permissions: {
          query: true,
          create: true,
          write: true,
          reconcile: true,
        },
      }),
    );
  expect(button(w, "新增").attributes("disabled")).toBeDefined();
  await click(w, "重试恢复原请求");
  expect(button(w, "新增").attributes("disabled")).toBeUndefined();
  expect(d.adapter.save).not.toHaveBeenCalled();
  w.unmount();
});
it("does not execute a CRUD write if durable reservation fails", async () => {
  const store = writeStore<Attempt<{ name: string }, string>>();
  vi.mocked(store.port.save).mockRejectedValueOnce(Error("存储失败"));
  const d = crud(store.port),
    w = await start(
      defineCrudPage({
        definition: d,
        permissions: {
          query: true,
          create: true,
          write: true,
          reconcile: true,
        },
        initialRow: { id: "one", name: "原值" },
        readOnly: false,
      }),
    );
  await click(w, "保存");
  expect(d.adapter.save).not.toHaveBeenCalled();
  expect(w.text()).toContain("请先恢复原请求");
  w.unmount();
});
it("restores configuration requests and preserves authoritative identity through reconcile and refresh", async () => {
  const store = writeStore<
    import("../src/index").ConfigurationAttempt<{ name: string }, string>,
    { retain: boolean; identity?: string }
  >({
    attempt: {
      id: "config-original",
      scope: "s",
      resource: "config",
      operation: "save",
      input: { name: "值" },
      identity: "one",
    },
  });
  const get = vi.fn(async () => ({
    values: { name: "权威值" },
    identity: "one",
  }));
  const d = defineConfiguration<
    { name: string },
    {},
    { id: string },
    string,
    { id: string }
  >({
    resource: "config",
    title: "配置",
    fields: [{ key: "name", label: "名称", type: "text" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "id", label: "编号" }],
    identity: (r) => r.id,
    persistence: store.port,
    adapter: {
      query: async () => ({ items: [{ id: "one" }], total: 1 }),
      get,
      save: vi.fn(async () => ({ status: "unknown" as const })),
    },
    reconcile: async (a) => ({
      status: "applied" as const,
      attemptId: a.id,
      evidence: { id: a.id },
      identity: "one",
    }),
  });
  const w = await start(
    defineConfigurationPage({
      definition: d,
      permissions: { read: true, write: true, reconcile: true },
    }),
  );
  await click(w, "核实本次请求");
  expect(store.port.complete).toHaveBeenCalled();
  expect(d.adapter.save).not.toHaveBeenCalled();
  w.unmount();
});
it("rejects late draft calculations, holds submission through calculation failure, and retries visibly", async () => {
  const op = operation();
  const requests: {
    value: { value: string };
    resolve: (v: { value: { value: string } }) => void;
    reject: (e: Error) => void;
  }[] = [];
  const collaboration: DraftCollaboration<{ value: string }, unknown> = {
    change: ({ value }) =>
      new Promise((resolve, reject) =>
        requests.push({ value, resolve, reject }),
      ),
  };
  const page = defineTaskPage<{ value: string }, Model, string, number>({
    title: "业务处理",
    instance: "one",
    owner,
    identity: "one",
    definition: op.definition,
    values: { value: "原值" },
    fields: [{ key: "value", label: "内容", type: "text" }],
    actions: ["process"],
    toIntent: (value, action, base) => ({ ...base, action, input: value }),
    eligible: true,
    recoveryAllowed: true,
    collaboration,
  });
  const w = await start(page);
  expect(requests.length).toBeGreaterThan(0);
  await w.get('input[aria-label="内容"]').setValue("新值");
  await flushPromises();
  requests.at(-1)!.resolve({ value: { value: "新计算值" } });
  await flushPromises();
  requests[0]!.resolve({ value: { value: "迟到旧值" } });
  await flushPromises();
  expect(
    (w.get('input[aria-label="内容"]').element as HTMLInputElement).value,
  ).toBe("新计算值");
  await w.get('input[aria-label="内容"]').setValue("异常输入");
  await flushPromises();
  requests.at(-1)!.reject(Error("计算失败"));
  await flushPromises();
  expect(button(w, "准备执行处理").attributes("disabled")).toBeDefined();
  await click(w, "重试业务计算");
  requests.at(-1)!.resolve({ value: { value: "恢复值" } });
  await flushPromises();
  expect(button(w, "准备执行处理").attributes("disabled")).toBeUndefined();
  w.unmount();
});
it("collects required prompt answers in a library-owned form before preparing the typed business input", async () => {
  const op = operation();
  const collaboration: DraftCollaboration<{ value: string }, unknown> = {
    change: async ({ value, answers }) => ({
      value: { value: answers.ok === true ? "已确认" : value.value },
      interactions: [
        { kind: "confirm", id: "ok", label: "确认输入", required: true },
      ],
    }),
  };
  const w = await start(
    defineTaskPage<{ value: string }, Model, string, number>({
      title: "交互",
      instance: "one",
      owner,
      identity: "one",
      definition: op.definition,
      values: { value: "未确认" },
      fields: [{ key: "value", label: "内容", type: "text" }],
      actions: ["process"],
      toIntent: (value, action, base) => ({ ...base, action, input: value }),
      eligible: true,
      recoveryAllowed: true,
      collaboration,
    }),
  );
  expect(button(w, "准备执行处理").attributes("disabled")).toBeDefined();
  await w.get('input[type="checkbox"]').setValue(true);
  await flushPromises();
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  expect(op.execute).toHaveBeenCalledWith(
    expect.objectContaining({ input: { value: "已确认" } }),
  );
  w.unmount();
});
it("retains a batch and original request after unknown, restores without execute, then advances explicitly", async () => {
  const op = operation();
  let saved: BatchJournal<Model, string, number> | null = null;
  const getSaved = (): BatchJournal<Model, string, number> | null => saved;
  const persistence = {
    load: async () => structuredClone(saved),
    save: async (value: BatchJournal<Model, string, number>) => {
      saved = structuredClone(value);
    },
  };
  const options = {
    title: "批量",
    owner,
    definition: op.definition,
    persistence,
    entries: ["one", "two"].map((key) => ({
      key,
      label: key,
      intent: {
        owner,
        identity: key,
        action: "process" as const,
        input: { value: key },
      },
    })),
    eligible: true,
    recoveryAllowed: true,
  };
  let w = await start(defineBatchPage(options));
  await click(w, "建立批次");
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  expect(button(w, "继续下一项").attributes("disabled")).toBeDefined();
  w.unmount();
  w = await start(defineBatchPage(options));
  expect(op.execute).toHaveBeenCalledTimes(1);
  await click(w, "核实原请求");
  expect(op.execute).toHaveBeenCalledTimes(1);
  await click(w, "继续下一项");
  expect(w.find("h2").text()).toBe("two");
  expect(getSaved()?.entries[0]?.settlement?.request.requestId).toBe(
    op.request?.requestId,
  );
  await click(w, "停止剩余操作");
  expect(getSaved()?.completed).toBe(true);
  expect(getSaved()?.entries[1]?.skipped).toBe(true);
  w.unmount();
});
it("renders an escaped print preview and never opens printing merely by loading or restoring the page", async () => {
  const op = operation();
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  const w = await start(
    defineTaskPage<{ value: string }, Model, string, number>({
      title: "输出",
      instance: "print",
      owner,
      identity: "one",
      definition: op.definition,
      values: { value: "输出" },
      fields: [],
      actions: ["process"],
      toIntent: (value, action, base) => ({ ...base, action, input: value }),
      eligible: true,
      recoveryAllowed: true,
      printing: {
        state: "preview",
        document: {
          id: "fixed-output",
          title: "<script>bad</script>",
          width: 210,
          height: 297,
          pages: [
            {
              key: "one",
              items: [
                {
                  key: "text",
                  kind: "text",
                  text: "<script>bad</script> 0.0000001",
                  x: 0,
                  y: 0,
                  width: 100,
                  height: 20,
                },
              ],
            },
          ],
        },
      },
    }),
  );
  expect(button(w, "打开打印窗口").attributes("disabled")).toBeDefined();
  const html = w.get("iframe").attributes("srcdoc");
  expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(print).not.toHaveBeenCalled();
  w.unmount();
  print.mockRestore();
});
it("refuses out-of-bounds or active-content image facts instead of rendering unsafe output", async () => {
  const op = operation();
  const w = await start(
    defineTaskPage<{ value: string }, Model, string, number>({
      title: "输出",
      instance: "print",
      owner,
      identity: "one",
      definition: op.definition,
      values: { value: "输出" },
      fields: [],
      actions: ["process"],
      toIntent: (value, action, base) => ({ ...base, action, input: value }),
      eligible: true,
      recoveryAllowed: true,
      printing: {
        state: "opened",
        document: {
          id: "fixed-output",
          title: "输出",
          width: 210,
          height: 297,
          pages: [
            {
              key: "one",
              items: [
                {
                  key: "image",
                  kind: "image",
                  src: "javascript:alert(1)",
                  alt: "图像",
                  x: 0,
                  y: 0,
                  width: 100,
                  height: 20,
                },
              ],
            },
          ],
        },
      },
    }),
  );
  expect(w.find("iframe").exists()).toBe(false);
  expect(button(w, "打开打印窗口").attributes("disabled")).toBeDefined();
  expect(w.text()).toContain("打印内容无效");
  w.unmount();
});
