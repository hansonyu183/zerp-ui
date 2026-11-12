import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import {
  application,
  object,
  operation,
  text,
  type OperationJournal,
  type ModelActionModel,
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
    (button) => button.textContent?.trim() === label,
  );
  expect(button, label).toBeTruthy();
  button!.click();
  await flushPromises();
}
async function fixture() {
  const input = object("处理输入", {
    note: text("说明", { value: "原始说明" }),
  });
  type M = ModelActionModel<"process", typeof input, { digest: string }>;
  let journal: OperationJournal<M, { id: string }, string> | null = null;
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
    { digest: string }
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
  const model = reactive(
    application(
      "合成办理",
      { target },
      {
        owner: { ledger: "test", operator: "user", generation: "1" },
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
  await router.isReady();
  const wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
    global: { plugins: [router] },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return {
    wrapper,
    model,
    action,
    run,
    reconcile,
    refresh,
    journal: () => journal,
  };
}
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
  await click("核实原请求");
  expect(f.reconcile).toHaveBeenCalledTimes(1);
  expect(f.refresh).toHaveBeenCalledTimes(1);
  expect(f.run).toHaveBeenCalledTimes(1);
});
