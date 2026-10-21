import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import OperationPrototype from "../examples/voucher-operation-prototype/OperationPrototype.vue";
import {
  synthetic,
  type SyntheticModel,
  type Identity,
  type Scenario,
  type Store,
  type SyntheticRequest,
} from "../examples/voucher-operation-prototype/synthetic";
import type { Intent } from "../examples/voucher-operation-prototype/contract";
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
  const intent: Intent<SyntheticModel, Identity> = {
    action: "void",
    owner: { operator: "a", scope: "session-1", resource: "voucher" },
    identity: { voucher: "one" },
    input: { note: "原输入" },
  };
  const start = () =>
    mount(OperationPrototype as Component, {
      props: { definition, intent, eligible: true },
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
  expect(w.text()).toContain("可显式开始新请求");
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
  await f.definition.adapter.refresh({
    owner: f.intent.owner,
    identity: f.intent.identity,
  });
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
  expect(w.text()).toContain("可显式开始新请求");
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
  expect(w.text()).toContain("可显式开始新请求");
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
  f.definition.adapter.execute = async (value) => {
    request = value;
    return pending.promise;
  };
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
  f.definition.persistence.save = async (record, expected) => {
    await save(record, expected);
    throw new Error("保存响应丢失");
  };
  const w = f.start();
  await flushPromises();
  await click(w, "准备作废");
  await click(w, "确认作废");
  expect(w.text()).toContain("本次未发送写入");
  expect(button(w, "准备作废").attributes("disabled")).toBeDefined();
  f.definition.persistence.save = save;
  await click(w, "重试恢复");
  expect(w.text()).toContain("已恢复原请求");
  expect(f.events.some((e) => e.startsWith("execute:"))).toBe(false);
  await click(w, "核实原请求");
  expect(w.text()).toContain("必须封存原请求");
  await click(w, "封存原请求");
  expect(w.text()).toContain("可显式开始新请求");
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
  expect(w.text()).toContain("可显式开始新请求");
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
      return prepare({
        ...intent,
        identity: { voucher: "another" },
        input: { note: "changed" },
      });
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
