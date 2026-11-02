import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { beforeEach, expect, it, vi } from "vitest";
import { AppPage, defineTaskPage } from "../src/index";
import { operation, type Model } from "../examples/capabilities/adapters";
const owner = {
  scope: "fresh-session",
  operator: "operator",
  resource: "whole-original",
};
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: async (_: string, work: () => unknown) => work() },
  });
});
async function start(definition: ReturnType<typeof operation>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  const page = defineTaskPage<{ value: string }, Model, string, number>({
    title: "完整原请求恢复",
    instance: "fresh",
    owner,
    identity: "original-target",
    definition,
    values: { value: "unknown" },
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
async function click(w: VueWrapper, name: string | RegExp) {
  const button = w
    .findAll("button")
    .find((b) =>
      typeof name === "string" ? b.text() === name : name.test(b.text()),
    );
  expect(button).toBeDefined();
  await button!.trigger("click");
  await flushPromises();
}
it.each(["input", "concurrency", "preview", "rebound-input"] as const)(
  "keeps changed durable %s locked after a fresh AppPage load instead of accepting the old authority receipt",
  async (change) => {
    const refresh = vi.fn();
    const original = operation(owner, refresh);
    let w = await start(original);
    await click(w, "准备执行处理");
    await click(w, "确认执行处理");
    const journal = (await original.persistence.load(owner))!;
    expect(journal.receipt).toBeUndefined();
    w.unmount();
    // Fault injection at the consumer storage boundary; the authority ledger is untouched.
    const key = `capabilities:${JSON.stringify([owner.scope, owner.operator, owner.resource])}`;
    const stored = JSON.parse(localStorage.getItem(key)!);
    const request = stored.records[journal.request.requestId].request;
    if (change === "input" || change === "rebound-input")
      request.input.value = "corrupt-input";
    if (change === "concurrency") request.concurrency = 99;
    if (change === "preview") request.preview.title = "corrupt-preview";
    if (change === "rebound-input") {
      // A self-consistent copied binding is still not the independently prepared original.
      const binding = JSON.parse(request.binding);
      binding.input.value = "corrupt-input";
      request.binding = JSON.stringify(binding);
    }
    localStorage.setItem(key, JSON.stringify(stored));
    // New Adapter and persistence identities ensure no in-memory original survives.
    w = await start(operation(owner, refresh));
    await click(w, /^(核实原请求|重试恢复)$/);
    expect(refresh).not.toHaveBeenCalled();
    expect(
      w
        .findAll("button")
        .find((b) => b.text() === "准备执行处理")!
        .attributes("disabled"),
    ).toBeDefined();
    expect(w.text()).toContain("合成权威原请求不匹配");
    w.unmount();
  },
);

it("rejects altered authoritative preparation before exposing a confirmation", async () => {
  const definition = operation(owner);
  const prepare = definition.adapter.prepare;
  definition.adapter.prepare = async (intent) => {
    const original = await prepare(intent);
    return { ...original, concurrency: 99 };
  };
  const w = await start(definition);
  await click(w, "准备执行处理");
  expect(w.text()).toContain("准备结果不匹配");
  expect(w.findAll("button").some((b) => b.text() === "确认执行处理")).toBe(
    false,
  );
  expect(await definition.persistence.load(owner)).toBeNull();
  w.unmount();
});
