import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { ref } from "vue";
import { expect, it, vi, beforeEach } from "vitest";
import {
  AppPage,
  defineReport,
  defineReportPage,
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
    replace(next: WriteJournal<A, C> | null) {
      value = structuredClone(next);
    },
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
  expect(
    w.get('[role="status"][aria-label="业务计算中"]').attributes("aria-busy"),
  ).toBe("true");
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
it("never adopts the previous completed receipt into a new identical batch after reload", async () => {
  const op = operation();
  let stored: BatchJournal<Model, string, number> | null = null;
  const get = (): BatchJournal<Model, string, number> | null => stored;
  const options = {
    title: "重复批次",
    owner,
    definition: op.definition,
    persistence: {
      load: async () => structuredClone(stored),
      save: async (value: BatchJournal<Model, string, number>) => {
        stored = structuredClone(value);
      },
    },
    entries: [
      {
        key: "one",
        label: "唯一项",
        intent: {
          owner,
          identity: "same",
          action: "process" as const,
          input: { value: "same" },
        },
      },
    ],
    eligible: true,
    recoveryAllowed: true,
  };
  let w = await start(defineBatchPage(options));
  await click(w, "建立批次");
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  await click(w, "核实原请求");
  await click(w, "继续下一项");
  const previous = get()!.id;
  await click(w, "建立批次");
  expect(get()!.id).not.toBe(previous);
  w.unmount();
  w = await start(defineBatchPage(options));
  expect(get()!.entries[0]!.settlement).toBeUndefined();
  expect(button(w, "继续下一项").attributes("disabled")).toBeDefined();
  expect(op.execute).toHaveBeenCalledTimes(1);
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  expect(op.execute).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("retries saving a known terminal outcome without reconcile or re-executing business", async () => {
  const store = writeStore<Attempt<{ name: string }, string>>();
  const d = crud(store.port);
  d.reconcile = undefined;
  d.adapter.save = vi.fn(async () => {
    vi.mocked(store.port.save).mockRejectedValueOnce(Error("终态存储失败"));
    return { status: "success" as const };
  });
  const w = await start(
    defineCrudPage({
      definition: d,
      permissions: { query: true, create: true, write: true },
      initialRow: { id: "one", name: "原值" },
      readOnly: false,
    }),
  );
  await click(w, "保存");
  expect(w.text()).toContain("结果已确认");
  expect(w.text()).not.toContain("写入结果未知，保持锁定");
  await click(w, "重试读取");
  expect(store.value?.completed).toBe(true);
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  expect(button(w, "新增").attributes("disabled")).toBeUndefined();
  w.unmount();
});
it("stores a reconciled configuration creation identity before an authoritative reread can fail", async () => {
  const store = writeStore<
    import("../src/index").ConfigurationAttempt<{ name: string }, string>,
    { retain: boolean; identity?: string }
  >({
    attempt: {
      id: "create-config",
      scope: "s",
      resource: "new-config",
      operation: "save",
      input: { name: "新配置" },
    },
    context: { retain: true },
  });
  const get = vi.fn(async () => ({
    values: { name: "权威配置" },
    identity: "created-one",
  }));
  get.mockRejectedValueOnce(Error("读取失败"));
  const definition = defineConfiguration<
    { name: string },
    {},
    { id: string },
    string,
    { id: string }
  >({
    resource: "new-config",
    title: "新配置",
    fields: [{ key: "name", label: "名称", type: "text" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "id", label: "编号" }],
    identity: (r) => r.id,
    persistence: store.port,
    adapter: {
      query: async () => ({ items: [{ id: "created-one" }], total: 1 }),
      get,
      save: async () => ({ status: "unknown" }),
    },
    reconcile: async (a) => ({
      status: "applied",
      attemptId: a.id,
      evidence: { id: a.id },
      identity: "created-one",
    }),
  });
  let w = await start(
    defineConfigurationPage({
      definition,
      permissions: { read: true, write: true, reconcile: true },
      retainEditor: true,
    }),
  );
  await click(w, "核实本次请求");
  expect(store.value?.context?.identity).toBe("created-one");
  w.unmount();
  w = await start(
    defineConfigurationPage({
      definition: { ...definition, adapter: { ...definition.adapter } },
      permissions: { read: true, write: true, reconcile: true },
      retainEditor: true,
    }),
  );
  expect(get).toHaveBeenLastCalledWith({ scope: "s", identity: "created-one" });
  expect(store.value?.completed).toBe(true);
  expect(
    (w.get('input[aria-label="名称"]').element as HTMLInputElement).value,
  ).toBe("权威配置");
  w.unmount();
});
it("invalidates old prompts while the next draft calculation is pending", async () => {
  const op = operation();
  const calls: { event: string; value: string; answers: unknown }[] = [];
  let resolve!: (value: { value: { value: string }; interactions: [] }) => void;
  const collaboration: DraftCollaboration<{ value: string }, unknown> = {
    change: async (input) => {
      calls.push({
        event: input.event,
        value: input.value.value,
        answers: input.answers,
      });
      if (input.value.value === "20")
        return await new Promise((r) => {
          resolve = r;
        });
      return {
        value: input.value,
        interactions: [
          {
            kind: "confirm",
            id: "amount",
            label: "确认金额10",
            required: true,
          },
        ],
      };
    },
  };
  const w = await start(
    defineTaskPage<{ value: string }, Model, string, number>({
      title: "提示隔离",
      instance: "one",
      owner,
      identity: "one",
      definition: op.definition,
      values: { value: "10" },
      fields: [{ key: "value", label: "金额", type: "text" }],
      actions: ["process"],
      toIntent: (value, action, base) => ({ ...base, action, input: value }),
      eligible: true,
      recoveryAllowed: true,
      collaboration,
    }),
  );
  const old = w.get('input[type="checkbox"]');
  await w.get('input[aria-label="金额"]').setValue("20");
  await flushPromises();
  expect(w.find('input[type="checkbox"]').exists()).toBe(false);
  await old.setValue(true);
  await flushPromises();
  expect(calls.some((c) => c.event === "answer")).toBe(false);
  resolve({ value: { value: "20" }, interactions: [] });
  await flushPromises();
  w.unmount();
});
it("preserves the durable read marker when completing a known request fails and is retried", async () => {
  const store = writeStore<Attempt<{ name: string }, string>>();
  const save = store.port.save;
  store.port.save = vi.fn(async (journal, expected) => {
    if (store.value?.refreshed && !journal.refreshed)
      throw Error("不能回退已完成读取");
    await save(journal, expected);
  });
  vi.mocked(store.port.complete).mockRejectedValueOnce(Error("完成标记失败"));
  const d = crud(store.port);
  d.reconcile = undefined;
  d.adapter.save = vi.fn(async () => ({ status: "success" as const }));
  const w = await start(
    defineCrudPage({
      definition: d,
      permissions: { query: true, create: true, write: true },
      initialRow: { id: "one", name: "原值" },
      readOnly: false,
    }),
  );
  await click(w, "保存");
  expect(store.value?.refreshed).toBe(true);
  expect(store.value?.completed).not.toBe(true);
  await click(w, "重试读取");
  expect(store.value?.completed).toBe(true);
  expect(button(w, "新增").attributes("disabled")).toBeUndefined();
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("recovers a read marker that persisted before the storage response was lost", async () => {
  const store = writeStore<Attempt<{ name: string }, string>>(),
    save = store.port.save;
  let lost = false;
  store.port.save = vi.fn(async (journal, expected) => {
    if (store.value?.refreshed && !journal.refreshed)
      throw Error("不能回退读取完成");
    await save(journal, expected);
    if (journal.refreshed && !lost) {
      lost = true;
      throw Error("保存已落盘，响应丢失");
    }
  });
  const d = crud(store.port);
  d.reconcile = undefined;
  d.adapter.save = vi.fn(async () => ({ status: "success" as const }));
  const w = await start(
    defineCrudPage({
      definition: d,
      permissions: { query: true, create: true, write: true },
      initialRow: { id: "one", name: "原值" },
      readOnly: false,
    }),
  );
  await click(w, "保存");
  expect(store.value?.refreshed).toBe(true);
  await click(w, "重试读取");
  expect(store.value?.completed).toBe(true);
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  expect(button(w, "新增").attributes("disabled")).toBeUndefined();
  w.unmount();
});
it("does not carry a previous request read marker into a newly restored original", async () => {
  const attempt = (id: string): Attempt<{ name: string }, string> => ({
    id,
    scope: "s",
    resource: "records",
    operation: "save",
    identity: "one",
    input: { name: id },
  });
  const store = writeStore({ attempt: attempt("first") });
  const d = crud(store.port);
  let w = await start(
    defineCrudPage({
      definition: d,
      permissions: { query: true, create: true, write: true, reconcile: true },
    }),
  );
  await click(w, "核实本次请求");
  expect(store.value?.completed).toBe(true);
  w.unmount();
  store.replace({ attempt: attempt("second") });
  w = await start(
    defineCrudPage({
      definition: d,
      permissions: { query: true, create: true, write: true, reconcile: true },
    }),
  );
  await click(w, "核实本次请求");
  expect(store.value?.outcome).toBe("applied");
  expect(store.value?.refreshed).toBe(true);
  expect(store.value?.completed).toBe(true);
  expect(store.value?.attempt.id).toBe("second");
  w.unmount();
});

it("keeps report interaction intents on the adopted result and invalidates old panels", async () => {
  const instance = ref("result-one"),
    seen: string[] = [];
  const definition = defineReport<{}, { name: string }, string, string, string>(
    {
      kind: "parameter",
      resource: "report",
      title: "报表交互",
      parameters: [],
      initialParameters: () => ({}),
      columns: [{ key: "name", label: "名称" }],
      rowKey: (row) => row.name,
      adapter: { query: async () => ({ items: [{ name: "记录" }], total: 1 }) },
    },
  );
  const page = defineReportPage(() => ({
    definition,
    permissions: { query: true, export: false },
    interactions: {
      instance: instance.value,
      enabled: true,
      items: [
        {
          kind: "menu" as const,
          id: "actions",
          label: "相关操作",
          items: [
            { key: "process", label: "处理本次结果", target: instance.value },
          ],
        },
      ],
      answers: {},
      onIntent: (target: string) => seen.push(target),
    },
  }));
  const w = await start(page);
  const old = button(w, "处理本次结果");
  instance.value = "result-two";
  await flushPromises();
  await old.trigger("click");
  expect(seen).toEqual([]);
  await click(w, "处理本次结果");
  expect(seen).toEqual(["result-two"]);
  w.unmount();
});
it("invalidates old report prompts and targets when items change within the same result", async () => {
  const version = ref("one"),
    seen: string[] = [],
    answers: string[] = [];
  const definition = defineReport<{}, { name: string }, string, string, string>(
    {
      kind: "parameter",
      resource: "same-report",
      title: "同结果提示",
      parameters: [],
      initialParameters: () => ({}),
      columns: [{ key: "name", label: "名称" }],
      rowKey: (r) => r.name,
      adapter: { query: async () => ({ items: [], total: 0 }) },
    },
  );
  const page = defineReportPage(() => ({
    definition,
    permissions: { query: true, export: false },
    interactions: {
      instance: "fixed-result",
      enabled: true,
      items: [
        {
          kind: "confirm" as const,
          id: "confirm",
          label: "确认" + version.value,
        },
        {
          kind: "menu" as const,
          id: "actions",
          label: "操作",
          items: [
            {
              key: version.value,
              label: "处理" + version.value,
              target: version.value,
            },
          ],
        },
      ],
      answers: {},
      onIntent: (target: string) => seen.push(target),
      onAnswer: (id: string) => answers.push(id),
    },
  }));
  const w = await start(page),
    old = button(w, "处理one"),
    oldConfirm = w.get('input[type="checkbox"]');
  version.value = "two";
  await flushPromises();
  await old.trigger("click");
  await oldConfirm.setValue(true);
  expect(seen).toEqual([]);
  expect(answers).toEqual([]);
  await click(w, "处理two");
  expect(seen).toEqual(["two"]);
  await w.get('input[type="checkbox"]').setValue(true);
  expect(answers).toEqual(["confirm"]);
  w.unmount();
});

it.each(["crud", "configuration"] as const)(
  "%s retains the reserved original and sends no save after session invalidation or permission revocation",
  async (kind) => {
    for (const invalidation of ["session", "write", "read", "scope"] as const) {
      const store = writeStore<
        import("../src/index").ConfigurationAttempt<{ name: string }, string>,
        { retain: boolean; identity?: string }
      >();
      let release!: () => void;
      const reserve = store.port.save;
      store.port.save = vi.fn(async (journal, expected) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await reserve(journal, expected);
      });
      const base = crud(store.port);
      const permissions = ref({
        query: true,
        create: true,
        read: true,
        write: true,
        reconcile: true,
      });
      const configuration = defineConfiguration({
        ...base,
        persistence: store.port,
      });
      const page =
        kind === "crud"
          ? defineCrudPage(() => ({
              definition: base,
              permissions: permissions.value,
              initialRow: { id: "one", name: "原值" },
              readOnly: false,
            }))
          : defineConfigurationPage(() => ({
              definition: configuration,
              permissions: permissions.value,
              initialRow: { id: "one", name: "原值" },
            }));
      const w = await start(page);
      await click(w, "保存");
      expect(store.port.save).toHaveBeenCalledTimes(1);
      if (invalidation === "session") await w.setProps({ active: false });
      else if (invalidation === "scope") await w.setProps({ scope: "other" });
      else
        permissions.value = {
          ...permissions.value,
          ...(invalidation === "write"
            ? { write: false }
            : { query: false, read: false }),
        };
      await flushPromises();
      release();
      await flushPromises();
      expect(
        base.adapter.save,
        `${kind}/${invalidation}`,
      ).not.toHaveBeenCalled();
      expect(store.value?.attempt.scope).toBe("s");
      expect(store.value?.attempt.id).toBeTruthy();
      expect(store.value?.outcome).toBeUndefined();
      expect(store.port.complete).not.toHaveBeenCalled();
      // Returning to the original owner restores the same reserved request, never a new write.
      permissions.value = {
        query: true,
        create: true,
        read: true,
        write: true,
        reconcile: true,
      };
      await w.setProps({ active: true, scope: "s" });
      await flushPromises();
      expect(w.text()).toMatch(/结果未知/);
      expect(base.adapter.save).not.toHaveBeenCalled();
      w.unmount();
    }
  },
);

it("adopts in-place edits to the isolated collaboration draft and releases pending", async () => {
  const op = operation();
  const collaboration: DraftCollaboration<{ value: string }> = {
    change: async ({ value }) => {
      await Promise.resolve();
      value.value = value.value + "计算完成";
      return { value };
    },
  };
  const w = await start(
    defineTaskPage<{ value: string }, Model, string, number>({
      title: "可变隔离草稿",
      instance: "one",
      owner,
      identity: "one",
      definition: op.definition,
      values: { value: "初始" },
      fields: [{ key: "value", label: "内容", type: "text" }],
      actions: ["process"],
      toIntent: (value, action, base) => ({ ...base, action, input: value }),
      eligible: true,
      recoveryAllowed: true,
      collaboration,
    }),
  );
  expect(
    (w.get('input[aria-label="内容"]').element as HTMLInputElement).value,
  ).toBe("初始计算完成");
  expect(button(w, "准备执行处理").attributes("disabled")).toBeUndefined();
  await w.get('input[aria-label="内容"]').setValue("新值");
  await flushPromises();
  expect(
    (w.get('input[aria-label="内容"]').element as HTMLInputElement).value,
  ).toBe("新值计算完成");
  await click(w, "准备执行处理");
  await click(w, "确认执行处理");
  expect(op.execute).toHaveBeenCalledWith(
    expect.objectContaining({ input: { value: "新值计算完成" } }),
  );
  w.unmount();
});

it.each(["eligible", "recoveryAllowed"] as const)(
  "recovers a batch when %s is granted after initial denial",
  async (permission) => {
    const op = operation();
    const allowed = ref(false);
    const load = vi.fn(async () => null);
    const persistence = { load, save: async () => {} };
    const w = await start(
      defineBatchPage(() => ({
        title: "批量获权",
        owner,
        definition: op.definition,
        persistence,
        entries: [
          {
            key: "one",
            label: "one",
            intent: {
              owner,
              identity: "one",
              action: "process" as const,
              input: { value: "one" },
            },
          },
        ],
        eligible: permission === "eligible" && allowed.value,
        recoveryAllowed: permission === "recoveryAllowed" && allowed.value,
      })),
    );
    expect(load).not.toHaveBeenCalled();
    expect(button(w, "重试恢复批次")).toBeDefined();
    expect(button(w, "建立批次").attributes("disabled")).toBeDefined();
    allowed.value = true;
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(1);
    if (permission === "eligible") {
      expect(button(w, "建立批次").attributes("disabled")).toBeUndefined();
      await click(w, "建立批次");
      expect(button(w, "准备执行处理").attributes("disabled")).toBeUndefined();
    } else {
      expect(button(w, "建立批次").attributes("disabled")).toBeDefined();
      expect(
        await (
          w.vm as unknown as import("../src/index").AppPageHandle
        ).requestLeave(),
      ).toBe(true);
    }
    expect(op.execute).not.toHaveBeenCalled();
    w.unmount();
  },
);

it("keeps a permanent business message reserve when messages are added, dismissed and removed", async () => {
  const op = operation();
  let messages: import("../src/index").Interaction<never>[] = [];
  const w = await start(
    defineTaskPage<{ value: string }, Model, string, number>({
      title: "固定反馈",
      instance: "one",
      owner,
      identity: "one",
      definition: op.definition,
      values: { value: "初始" },
      fields: [{ key: "value", label: "内容", type: "text" }],
      actions: ["process"],
      toIntent: (value, action, base) => ({ ...base, action, input: value }),
      eligible: true,
      recoveryAllowed: true,
      collaboration: {
        change: async ({ value }) => ({ value, interactions: messages }),
      },
    }),
  );
  const region = w.get('[aria-label="业务消息"]');
  expect(region.classes()).toContain("zerp-feedback-region");
  const reserve = region.element;
  messages = [
    { kind: "message", id: "one", level: "warning", message: "第一条" },
    { kind: "message", id: "two", level: "status", message: "第二条" },
  ];
  await w.get('input[aria-label="内容"]').setValue("触发消息");
  await flushPromises();
  expect(w.get('[aria-label="业务消息"]').element).toBe(reserve);
  expect(region.findAll(".zerp-feedback")).toHaveLength(2);
  await region.get('[aria-label="关闭警告提示"]').trigger("click");
  expect(w.get('[aria-label="业务消息"]').element).toBe(reserve);
  messages = [];
  await w.get('input[aria-label="内容"]').setValue("移除消息");
  await flushPromises();
  expect(w.get('[aria-label="业务消息"]').element).toBe(reserve);
  expect(region.findAll(".zerp-feedback")).toHaveLength(0);
  w.unmount();
});

it("commits required business input answers on change without sending partial edits", async () => {
  const seen: unknown[] = [];
  const definition = defineReport<{}, { name: string }, string, string, string>(
    {
      kind: "parameter",
      resource: "prompt-report",
      title: "合成业务输入",
      parameters: [],
      initialParameters: () => ({}),
      columns: [{ key: "name", label: "名称" }],
      rowKey: (row) => row.name,
      adapter: { query: async () => ({ items: [], total: 0 }) },
    },
  );
  const w = await start(
    defineReportPage({
      definition,
      permissions: { query: true, export: false },
      interactions: {
        instance: "one",
        enabled: true,
        items: [
          { kind: "input", id: "reason", label: "业务说明", required: true },
        ],
        answers: {},
        onAnswer: (id, value) => seen.push([id, value]),
      },
    }),
  );
  const input = w.get('input[aria-label="业务说明"]');
  expect(input.attributes("required")).toBeDefined();
  (input.element as HTMLInputElement).value = "  精确说明  ";
  await input.trigger("input");
  expect(seen).toEqual([]);
  await input.trigger("change");
  expect(seen).toEqual([["reason", "  精确说明  "]]);
  w.unmount();
});
