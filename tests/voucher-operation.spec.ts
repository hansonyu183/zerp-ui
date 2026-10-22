import { reactive, type Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { VoucherView as OperationPrototype } from "../src/index";
import {
  synthetic,
  type SyntheticModel,
  type Identity,
  type Scenario,
  type Store,
  type SyntheticRequest,
} from "../examples/voucher/operation-adapter";
import type { VoucherOperationIntent } from "../src/index";
// Web Locks is the browser concurrency seam; real cross-page behavior is exercised in the installed consumer.
Object.defineProperty(navigator, "locks", {
  configurable: true,
  value: {
    request: async (_name: string, work: () => Promise<unknown>) => work(),
  },
});
function setup() {
  const values = new Map<string, string>();
  const storage: Store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  let scenario: Scenario = "success";
  const events: string[] = [];
  const definition = synthetic(
    storage,
    () => scenario,
    (event) => events.push(event),
  );
  definition.adapter.reconcile = vi.fn(definition.adapter.reconcile);
  definition.adapter.execute = vi.fn(definition.adapter.execute);
  const intent: VoucherOperationIntent<SyntheticModel, Identity> = {
    action: "void",
    owner: { operator: "a", scope: "session-1", resource: "voucher" },
    identity: { voucher: "one" },
    input: { note: "原输入" },
  };
  const start = () =>
    mount(OperationPrototype as Component, {
      props: { definition, intent, eligible: true, recoveryAllowed: true },
    });
  return {
    definition,
    intent,
    start,
    events,
    values,
    scenario: (value: Scenario) => {
      scenario = value;
    },
  };
}
const button = (w: ReturnType<typeof mount>, text: string) =>
  w.findAll("button").find((b) => b.text() === text)!;
const click = async (w: ReturnType<typeof mount>, text: string) => {
  await button(w, text).trigger("click");
  await flushPromises();
};

it("refreshes an authoritative created identity from the settled original request", async () => {
  const f = setup();
  const refresh = vi.fn<typeof f.definition.adapter.refresh>(async () => {});
  f.definition.adapter.refresh = refresh;
  const w = mount(OperationPrototype as Component, {
    props: {
      definition: f.definition,
      intent: {
        ...f.intent,
        action: "create",
        identity: { voucher: null },
        input: {
          note: "新单据",
          rows: [{ key: "r1", quantity: "9007199254740993.0100" }],
        },
      },
      eligible: true,
      recoveryAllowed: true,
    },
  });
  await flushPromises();
  await click(w, "准备创建");
  expect(w.get('[role="dialog"]').text()).toContain("新单据");
  await click(w, "确认创建");
  expect(w.text()).toContain("可显式准备新请求");
  const settlement = refresh.mock.calls[0]![0];
  expect(settlement).toMatchObject({
    request: {
      action: "create",
      identity: { voucher: null },
      input: { note: "新单据" },
    },
    receipt: {
      action: "create",
      status: "applied",
      evidence: { result: { deleted: false } },
    },
  });
  if (
    settlement.receipt.action !== "create" ||
    settlement.request.action !== "create"
  )
    throw new Error("创建契约不匹配");
  expect(settlement.receipt.evidence.result.voucher).toMatch(/^SYN-created-/);
  expect(settlement.request.input.rows).toEqual([
    { key: "r1", quantity: "9007199254740993.0100" },
  ]);
  expect(w.text()).toContain("可显式准备新请求");
  w.unmount();
});

it("delivers a durable created result on a fresh mount without repeating completed refresh", async () => {
  const f = setup();
  const remove = f.definition.persistence.remove;
  f.definition.persistence.remove = async () => {
    throw new Error("清理响应失败");
  };
  const refresh = vi.spyOn(f.definition.adapter, "refresh");
  const props = {
    definition: f.definition,
    intent: {
      action: "create",
      owner: f.intent.owner,
      identity: { voucher: null },
      input: { note: "可恢复结果", rows: [{ key: "r1", quantity: "1.0100" }] },
    },
    eligible: true,
    recoveryAllowed: true,
  };
  let w = mount(OperationPrototype as Component, { props });
  await flushPromises();
  await click(w, "准备创建");
  await click(w, "确认创建");
  const record = (await f.definition.persistence.load(f.intent.owner))!;
  expect(record.refreshed).toBe(true);
  w.unmount();
  // A fresh port over the same durable journal models a new JS session.
  props.definition = {
    ...f.definition,
    persistence: { ...f.definition.persistence, remove },
  };
  w = mount(OperationPrototype as Component, { props });
  await flushPromises();
  expect(w.emitted("settled")?.[0]).toEqual([
    { request: record.request, receipt: record.receipt },
  ]);
  await click(w, "重试读取");
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(w.text()).toContain("可显式准备新请求");
  w.unmount();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
it("shows a complete authoritative preview and cancels locally without persistence or execution", async () => {
  const f = setup(),
    w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  expect(w.get('[role="dialog"]').text()).toContain("全部明细与影响");
  expect(w.text()).toContain("9007199254740993.0100");
  expect(w.text()).toContain("原输入");
  expect(w.text()).toContain("r7 / c3");
  await click(w, "取消预览");
  expect(
    f.events.some((e) => e.startsWith("save:") || e.startsWith("execute:")),
  ).toBe(false);
  expect(w.text()).toContain("未发送写入");
  w.unmount();
});

it("invalidates a content preview when its input changes but keeps an executed original recoverable", async () => {
  const f = setup();
  const intent = reactive<
    VoucherOperationIntent<SyntheticModel, Identity, "edit">
  >({
    action: "edit",
    owner: f.intent.owner,
    identity: { voucher: "content-one" },
    input: { note: "原内容", rows: [{ key: "r1", quantity: "1.0100" }] },
  });
  const w = mount(OperationPrototype as Component, {
    props: {
      definition: f.definition,
      intent,
      eligible: true,
      recoveryAllowed: true,
    },
  });
  await flushPromises();
  await click(w, "准备保存修改");
  intent.input.rows[0]!.quantity = "2.0200";
  await flushPromises();
  expect(w.find('[role="dialog"]').exists()).toBe(false);
  expect(f.events.some((event) => event.startsWith("execute:"))).toBe(false);
  f.scenario("unknown");
  await click(w, "准备保存修改");
  await click(w, "确认保存修改");
  const original = (await f.definition.persistence.load(intent.owner))!.request;
  intent.input.note = "尚未采用的新输入";
  await flushPromises();
  expect(button(w, "准备保存修改").attributes("disabled")).toBeDefined();
  await click(w, "核实原请求");
  expect(f.definition.adapter.reconcile).toHaveBeenCalledWith(original);
  expect(f.events.some((event) => event === "content:content-one:原内容")).toBe(
    true,
  );
  w.unmount();
});
it("saves the original request before execution and blocks sending when persistence fails", async () => {
  const f = setup(),
    w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  f.scenario("save-failure");
  await click(w, "确认作废");
  expect(w.text()).toContain("本次未发送写入");
  expect(f.events.some((e) => e.startsWith("execute:"))).toBe(false);
  f.scenario("success");
  await click(w, "重试恢复");
  await click(w, "准备作废");
  await click(w, "确认作废");
  const saved = f.events.findIndex((e) => e.startsWith("save:")),
    execute = f.events.findIndex((e) => e.startsWith("execute:"));
  expect(saved).toBeLessThan(execute);
  expect(w.text()).toContain("可显式准备新请求");
  w.unmount();
});
it("recovers the exact original input after remount, isolates another operator and never re-executes", async () => {
  const f = setup();
  f.scenario("unknown");
  let w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  const original = (await f.definition.persistence.load(f.intent.owner))!
    .request;
  expect(w.text()).toContain("结果未知");
  await f.definition.adapter.prepare(f.intent);
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  w.unmount();
  w = f.start();
  await flushPromises();
  expect(w.text()).toContain(original.requestId);
  await w.setProps({
    intent: { ...f.intent, owner: { ...f.intent.owner, operator: "b" } },
  });
  await flushPromises();
  expect(w.text()).not.toContain(original.requestId);
  expect(button(w, "准备作废").attributes("disabled")).toBeUndefined();
  await w.setProps({
    intent: { ...f.intent, input: { note: "未采用的新输入" } },
  });
  await flushPromises();
  const reconcile = vi.spyOn(f.definition.adapter, "reconcile");
  await click(w, "核实原请求");
  expect(reconcile).toHaveBeenCalledWith(original);
  expect(f.events.filter((e) => e.startsWith("execute:"))).toHaveLength(1);
  expect(w.text()).toContain("可显式准备新请求");
  w.unmount();
});
it("rejects mismatched terminal proof and retains the original lock", async () => {
  const f = setup();
  f.scenario("wrong-proof");
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  await click(w, "核实原请求");
  expect(w.text()).toContain("证据不匹配");
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  expect(await f.definition.persistence.load(f.intent.owner)).not.toBeNull();
  w.unmount();
});
it("requires successful sealing of a not-applied request before a fresh request", async () => {
  const f = setup();
  f.scenario("seal-failure");
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  const original = (await f.definition.persistence.load(f.intent.owner))!
    .request;
  expect(w.text()).toContain("必须封存原请求");
  await click(w, "封存原请求");
  expect(w.text()).toContain("封存失败");
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  f.scenario("not-applied");
  await click(w, "封存原请求");
  expect(w.text()).toContain("可显式准备新请求");
  await click(w, "准备作废");
  expect(w.text()).not.toContain(original.requestId);
  w.unmount();
});
it("persists a successful receipt and retries only refresh after remount", async () => {
  const f = setup();
  f.scenario("refresh-failure");
  let w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  expect(w.text()).toContain("只允许重读");
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  w.unmount();
  w = f.start();
  await flushPromises();
  f.scenario("success");
  await click(w, "重试读取");
  expect(f.events.filter((e) => e.startsWith("execute:"))).toHaveLength(1);
  expect(f.events.filter((e) => e.startsWith("refresh:"))).toHaveLength(2);
  expect(f.events.some((e) => e.startsWith("reconcile:"))).toBe(false);
  w.unmount();
});
it("keeps a late execution receipt under its original owner instead of refreshing the next owner", async () => {
  const f = setup(),
    w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  const pending =
    deferred<Awaited<ReturnType<typeof f.definition.adapter.execute>>>();
  let request!: SyntheticRequest;
  vi.mocked(f.definition.adapter.execute).mockImplementation(async (value) => {
    request = value;
    return pending.promise;
  });
  await button(w, "确认作废").trigger("click");
  await flushPromises();
  await w.setProps({
    intent: { ...f.intent, owner: { ...f.intent.owner, operator: "b" } },
  });
  await flushPromises();
  pending.resolve({
    status: "applied",
    action: request.action,
    owner: request.owner,
    requestId: request.requestId,
    binding: request.binding,
    evidence: {
      action: request.action,
      receipt: `authority:${request.requestId}`,
    },
  } as Awaited<ReturnType<typeof f.definition.adapter.execute>>);
  await flushPromises();
  expect(
    (await f.definition.persistence.load(f.intent.owner))?.receipt?.status,
  ).toBe("applied");
  expect(f.events.some((e) => e.startsWith("refresh:"))).toBe(false);
  expect(w.text()).not.toContain(request.requestId);
  w.unmount();
});
it("keeps recovery failures locked instead of treating unreadable storage as an empty slot", async () => {
  const f = setup();
  f.definition.persistence.load = async () => {
    throw new Error("存储损坏");
  };
  const w = f.start();
  await flushPromises();
  expect(w.text()).toContain("存储损坏");
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  w.unmount();
});

it("recovers an ambiguously acknowledged reservation without sending a business write", async () => {
  const f = setup(),
    save = f.definition.persistence.save;
  const flakySave = vi.fn(
    async (
      record: Parameters<typeof save>[0],
      expected: Parameters<typeof save>[1],
    ): Promise<void> => {
      await save(record, expected);
      throw new Error("保存响应丢失");
    },
  );
  f.definition.persistence.save = flakySave;
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  expect(w.text()).toContain("本次未发送写入");
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  flakySave.mockImplementation(save);
  await click(w, "重试恢复");
  expect(w.text()).toContain("已恢复原请求");
  expect(f.events.some((e) => e.startsWith("execute:"))).toBe(false);
  await click(w, "核实原请求");
  expect(w.text()).toContain("必须封存原请求");
  await click(w, "封存原请求");
  expect(w.text()).toContain("可显式准备新请求");
  w.unmount();
});
it("keeps a sealed original request not-applied when a late delivery attempts execution", async () => {
  const f = setup();
  f.scenario("not-applied");
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  const original = (await f.definition.persistence.load(f.intent.owner))!
    .request;
  await click(w, "封存原请求");
  f.scenario("success");
  const late = await f.definition.adapter.execute(original);
  expect(late).toMatchObject({
    status: "not-applied",
    sealed: true,
    requestId: original.requestId,
  });
  expect(w.text()).toContain("可显式准备新请求");
  w.unmount();
});

it.each(["replacement", "mutation"])(
  "rejects preparation %s of the original target and input before persistence or execution",
  async (mode) => {
    const f = setup(),
      prepare = f.definition.adapter.prepare;
    f.definition.adapter.prepare = (intent) => {
      if (mode === "mutation") {
        intent.identity.voucher = "another";
        intent.input.note = "changed";
        return prepare(intent);
      }
      const replaced = structuredClone(intent);
      replaced.identity.voucher = "another";
      replaced.input.note = "changed";
      return prepare(replaced);
    };
    const w = f.start();
    await flushPromises();
    await click(w, "准备作废");
    expect(w.text()).toContain("准备结果不匹配");
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(
      f.events.some(
        (event) => event.startsWith("save:") || event.startsWith("execute:"),
      ),
    ).toBe(false);
    expect(await f.definition.persistence.load(f.intent.owner)).toBeNull();
    w.unmount();
  },
);
it("finds the same owner's unresolved journal regardless of property construction order", async () => {
  const f = setup();
  f.scenario("unknown");
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  const original = (await f.definition.persistence.load(f.intent.owner))!
    .request;
  const owner = {
    resource: f.intent.owner.resource,
    scope: f.intent.owner.scope,
    operator: f.intent.owner.operator,
  };
  expect((await f.definition.persistence.load(owner))?.request.requestId).toBe(
    original.requestId,
  );
  w.unmount();
});

it("shares the unresolved lock across mounted consumers and sends/refreshes only once", async () => {
  const f = setup();
  f.scenario("unknown");
  const execute = vi
    .mocked(f.definition.adapter.execute)
    .getMockImplementation()!;
  const response = deferred<Awaited<ReturnType<typeof execute>>>();
  vi.mocked(f.definition.adapter.execute).mockImplementation(
    async (request) => {
      await execute(request);
      return response.promise;
    },
  );
  const first = f.start(),
    second = f.start();
  await flushPromises();
  await click(first, "准备作废");
  await Promise.all([
    button(first, "确认作废").trigger("click"),
    button(second, "确认作废").trigger("click"),
  ]);
  await flushPromises();
  expect(f.events.filter((e) => e.startsWith("execute:"))).toHaveLength(1);
  response.resolve({ status: "unknown" });
  await flushPromises();
  first.unmount();
  expect(button(second, "准备作废").attributes("disabled")).toBeDefined();
  await click(second, "核实原请求");
  expect(f.events.filter((e) => e.startsWith("refresh:"))).toHaveLength(1);
  second.unmount();
});
it("does not send a reserved request if eligibility is revoked while saving", async () => {
  const f = setup(),
    save = f.definition.persistence.save,
    gate = deferred<void>();
  f.definition.persistence.save = async (record, expected) => {
    await save(record, expected);
    if (expected === null) await gate.promise;
  };
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await button(w, "确认作废").trigger("click");
  await flushPromises();
  await w.setProps({ eligible: false });
  gate.resolve();
  await flushPromises();
  expect(f.events.some((e) => e.startsWith("execute:"))).toBe(false);
  expect(w.text()).toContain("已保存但未发送");
  expect(await f.definition.persistence.load(f.intent.owner)).not.toBeNull();
  w.unmount();
});
it("keeps the request locked when recovery permission is absent or revoked during verification", async () => {
  const f = setup();
  f.scenario("unknown");
  const reconcile = f.definition.adapter.reconcile,
    proof = deferred<Awaited<ReturnType<typeof reconcile>>>();
  vi.mocked(reconcile).mockImplementation(() => proof.promise);
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  await w.setProps({ recoveryAllowed: false });
  expect(button(w, "核实原请求").attributes("disabled")).toBeDefined();
  await w.setProps({ recoveryAllowed: true });
  await button(w, "核实原请求").trigger("click");
  await flushPromises();
  await w.setProps({ recoveryAllowed: false });
  const original = (await f.definition.persistence.load(f.intent.owner))!
    .request;
  const raw = [...f.values.entries()].find(
    ([key]) =>
      key.startsWith("SYNTHETIC-OPERATIONS-authority:") &&
      key.endsWith(original.requestId),
  )![1];
  proof.resolve(JSON.parse(raw));
  await flushPromises();
  expect(f.events.some((e) => e.startsWith("refresh:"))).toBe(false);
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  await w.setProps({ recoveryAllowed: true });
  await click(w, "重试读取");
  expect(f.events.filter((e) => e.startsWith("execute:"))).toHaveLength(1);
  w.unmount();
});
it("keeps an applied result unresolved if its durable receipt cannot be saved", async () => {
  const f = setup(),
    save = f.definition.persistence.save;
  let fail = true;
  f.definition.persistence.save = async (record, expected) => {
    if (record.receipt && fail) {
      fail = false;
      throw new Error("终态保存失败");
    }
    await save(record, expected);
  };
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  expect(w.text()).toContain("终态保存失败");
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  await click(w, "核实原请求");
  expect(f.events.filter((e) => e.startsWith("execute:"))).toHaveLength(1);
  expect(f.events.filter((e) => e.startsWith("refresh:"))).toHaveLength(1);
  w.unmount();
});
it("retries journal cleanup without replaying a completed refresh or business action", async () => {
  const f = setup(),
    remove = f.definition.persistence.remove;
  let fail = true;
  f.definition.persistence.remove = async (owner, id) => {
    if (fail) {
      fail = false;
      throw new Error("清理失败");
    }
    await remove(owner, id);
  };
  let w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  expect(w.text()).toContain("清理失败");
  w.unmount();
  w = f.start();
  await flushPromises();
  await click(w, "重试读取");
  expect(f.events.filter((e) => e.startsWith("refresh:"))).toHaveLength(1);
  expect(f.events.filter((e) => e.startsWith("execute:"))).toHaveLength(1);
  w.unmount();
});

it.each(["no-evidence", "verification-failure"] as const)(
  "keeps the original request locked for %s",
  async (scenario) => {
    const f = setup();
    f.scenario("unknown");
    const w = f.start();
    await flushPromises();
    await click(w, "准备作废");
    await click(w, "确认作废");
    const original = (await f.definition.persistence.load(f.intent.owner))!
      .request;
    f.scenario(scenario);
    await click(w, "核实原请求");
    expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
    expect(w.text()).toContain(original.requestId);
    expect(f.events.filter((e) => e.startsWith("execute:"))).toHaveLength(1);
    w.unmount();
  },
);

it.each(["prepare", "execute"] as const)(
  "invalidates late %s when the target identity is mutated in place",
  async (kind) => {
    const f = setup();
    const intent = reactive({ ...f.intent, identity: { voucher: "one" } });
    const gate = deferred<void>();
    if (kind === "prepare") {
      const prepare = f.definition.adapter.prepare;
      f.definition.adapter.prepare = async (intent) => {
        const result = await prepare(intent);
        await gate.promise;
        return result;
      };
    } else {
      const execute = vi
        .mocked(f.definition.adapter.execute)
        .getMockImplementation()!;
      vi.mocked(f.definition.adapter.execute).mockImplementation(
        async (request) => {
          const result = await execute(request);
          await gate.promise;
          return result;
        },
      );
    }
    const w = mount(OperationPrototype as Component, {
      props: {
        definition: f.definition,
        intent,
        eligible: true,
        recoveryAllowed: true,
      },
    });
    await flushPromises();
    await button(w, "准备作废").trigger("click");
    await flushPromises();
    if (kind === "execute") {
      await button(w, "确认作废").trigger("click");
      await flushPromises();
    }
    intent.identity.voucher = "two";
    gate.resolve();
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(f.events.some((e) => e.startsWith("refresh:"))).toBe(false);
    w.unmount();
  },
);
