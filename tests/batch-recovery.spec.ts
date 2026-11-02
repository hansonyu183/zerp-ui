import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { expect, it, beforeEach, vi } from "vitest";
import {
  AppPage,
  defineBatchPage,
  type BatchJournal,
  type OperationDefinition,
  type OperationPreview,
} from "../src/index";
import { AppPage as InstalledAppPage } from "@zerp/ui";
import { migrationPage } from "../examples/capabilities/migration-consumer";
import {
  legacyBatch,
  migrationOwner,
} from "../examples/capabilities/migration-fixtures";
type Model = {
  process: {
    input: { value: string };
    preview: OperationPreview;
    evidence: { binding: string };
  };
};
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: async (_key: string, work: () => unknown) => work() },
  });
});
const owner = { scope: "s", operator: "op", resource: "batch" };
const entries = ["first", "second"].map((key) => ({
  key,
  label: key,
  intent: {
    owner,
    identity: key,
    action: "process" as const,
    input: { value: key },
  },
}));
const definition: OperationDefinition<Model, string, number> = {
  protocol: "operation",
  persistence: {
    load: async () => null,
    save: async () => {},
    remove: async () => {},
  },
  adapter: {
    prepare: async (intent) => ({
      ...intent,
      requestId: "id",
      binding: "binding",
      concurrency: 1,
      preview: { title: "preview", sections: [] },
    }),
    acceptsPreparation: () => true,
    execute: async () => ({ status: "unknown" }),
    reconcile: async () => ({ status: "unknown" }),
    seal: async () => ({ status: "unknown" }),
    refresh: async () => {},
    accepts: () => true,
  },
};
function button(w: VueWrapper, name: string) {
  return w.findAll("button").find((b) => b.text() === name)!;
}
async function start(
  load: () => Promise<BatchJournal<Model, string, number> | null>,
  save: () => Promise<void> = async () => {},
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span/>" } }],
  });
  const w = mount(AppPage, {
    props: {
      page: defineBatchPage({
        title: "Batch",
        owner,
        entries,
        definition,
        persistence: { load, save },
        eligible: true,
        recoveryAllowed: true,
      }),
      scope: "s",
      brand: {
        home: "/",
        productName: "Synthetic",
        enterpriseName: "Synthetic",
        mark: { kind: "text", text: "S" },
      },
      brandState: { kind: "ready" },
      navigationState: { kind: "ready" },
      navigation: [],
      footer: "Synthetic",
    },
    global: { plugins: [router] },
  });
  await flushPromises();
  return w;
}
it("refuses a restored index that bypasses an unresolved preceding entry", async () => {
  const w = await start(async () => ({
    id: "legacy",
    owner,
    entries,
    index: 1,
  }));
  expect(w.text()).toContain("批次记录不匹配");
  expect(w.text()).not.toContain("准备执行处理");
  w.unmount();
});
it("retains a known batch lock when retry storage loses its record", async () => {
  let loads = 0;
  const w = await start(
    async () =>
      ++loads === 1 ? { id: "known", owner, entries, index: 0 } : null,
    async () => {
      throw Error("write failed");
    },
  );
  await button(w, "停止剩余操作").trigger("click");
  await flushPromises();
  await button(w, "重试恢复批次").trigger("click");
  await flushPromises();
  expect(w.text()).toContain("批次记录缺失");
  expect(button(w, "建立批次")).toBeUndefined();
  w.unmount();
});
it.each([
  { completed: "yes" },
  { entries: entries.map((e) => ({ ...e, skipped: "yes" })) },
  { entries: entries.map((e) => ({ ...e, skipped: false })) },
  {
    entries: entries.map((e) => ({
      ...e,
      skipped: true,
      settlement: {
        request: {
          ...e.intent,
          requestId: "id",
          binding: "b",
          concurrency: 1,
          preview: { title: "preview", sections: [] },
        },
        receipt: {
          owner,
          action: "process",
          requestId: "id",
          binding: "b",
          status: "applied",
          evidence: { binding: "b" },
        },
        association: { kind: "batch", batchId: "legacy", entryKey: e.key },
      },
    })),
  },
])("refuses malformed terminal migration facts %j", async (patch) => {
  const w = await start(
    async () =>
      ({ id: "legacy", owner, entries, index: 0, ...patch }) as BatchJournal<
        Model,
        string,
        number
      >,
  );
  expect(w.text()).toContain("批次记录不匹配");
  expect(w.text()).not.toContain("准备执行处理");
  w.unmount();
});
it.each(["batchId", "entryKey"])(
  "refuses a copied settlement with a different %s",
  async (field) => {
    const intent = entries[0]!.intent;
    const settlement = {
      request: {
        ...intent,
        requestId: "id",
        binding: "b",
        concurrency: 1,
        preview: { title: "preview", sections: [] },
      },
      receipt: {
        owner,
        action: "process" as const,
        requestId: "id",
        binding: "b",
        status: "applied" as const,
        evidence: { binding: "b" },
      },
      association: {
        kind: "batch" as const,
        batchId: "legacy",
        entryKey: "first",
        [field]: "copied",
      },
    };
    const w = await start(async () => ({
      id: "legacy",
      owner,
      entries: [{ ...entries[0]!, settlement }, entries[1]!],
      index: 0,
    }));
    expect(w.text()).toContain("批次记录不匹配");
    w.unmount();
  },
);
async function migrated(kind: "batch" | "single", source?: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span/>" } }],
  });
  const w = mount(InstalledAppPage, {
    props: {
      page: migrationPage(kind, source),
      scope: migrationOwner.scope,
      brand: {
        home: "/",
        productName: "Synthetic",
        enterpriseName: "Synthetic",
        mark: { kind: "text", text: "S" },
      },
      brandState: { kind: "ready" },
      navigationState: { kind: "ready" },
      navigation: [],
      footer: "Synthetic",
    },
    global: { plugins: [router] },
  });
  await flushPromises();
  return w;
}
async function click(w: VueWrapper, name: string) {
  await button(w, name).trigger("click");
  await flushPromises();
}
it("converts a mixed frozen manifest, restores unknown, continues explicitly and stops only unsent entries", async () => {
  let w = await migrated("batch");
  expect(w.text()).toContain("applied · 已完成");
  expect(w.text()).toContain("sealed · 已确认未应用");
  expect(button(w, "继续下一项").attributes("disabled")).toBeDefined();
  expect(button(w, "停止剩余操作").attributes("disabled")).toBeDefined();
  w.unmount();
  w = await migrated("batch");
  await click(w, "核实原请求");
  expect(w.get("h2").text()).toBe("unknown");
  await click(w, "继续下一项");
  expect(w.get("h2").text()).toBe("never-sent");
  await click(w, "停止剩余操作");
  expect(w.text()).toContain("never-sent · 已停止");
  w.unmount();
  w = await migrated("batch");
  expect(button(w, "核实原请求")).toBeUndefined();
  expect(button(w, "准备执行处理")).toBeUndefined();
  expect(w.text()).toContain("unknown · 已完成");
  w.unmount();
});
it("converts a sent single original without preparation or execution", async () => {
  const w = await migrated("single");
  expect(button(w, "准备执行处理").attributes("disabled")).toBeDefined();
  await click(w, "核实原请求");
  expect(w.text()).toContain("已应用");
  w.unmount();
});
it.each([
  [
    "sent unknown disguised as never sent",
    (s: typeof legacyBatch) => {
      const e = s.entries[2]!;
      e.status = "never-sent";
      delete e.original;
      delete e.association;
    },
  ],
  [
    "contradictory terminal proof",
    (s: typeof legacyBatch) => {
      s.entries[0]!.status = "sealed";
      Object.assign(s.entries[0]!.receipt!, {
        status: "not-applied",
        sealed: true,
      });
    },
  ],
  [
    "changed unsent manifest",
    (s: typeof legacyBatch) => {
      s.entries[3]!.intent.input.value = "replaced";
    },
  ],
  [
    "missing terminal progress",
    (s: typeof legacyBatch) => {
      delete s.entries[0]!.refreshed;
    },
  ],
  [
    "copied batch id",
    (s: typeof legacyBatch) => {
      s.id = "new-id";
      for (const e of s.entries)
        if (e.association) Object.assign(e.association, { batchId: "new-id" });
    },
  ],
  [
    "wrong entry association",
    (s: typeof legacyBatch) => {
      Object.assign(s.entries[0]!.association!, { entryKey: "wrong" });
    },
  ],
  [
    "changed input",
    (s: typeof legacyBatch) => {
      s.entries[2]!.original!.input.value = "changed";
    },
  ],
  [
    "wrong owner",
    (s: typeof legacyBatch) => {
      Object.assign(s.owner, { operator: "other" });
    },
  ],
  [
    "missing full original",
    (s: typeof legacyBatch) => {
      delete (s.entries[2] as { original?: unknown }).original;
    },
  ],
  [
    "missing binding",
    (s: typeof legacyBatch) => {
      delete (s.entries[2]!.original as { binding?: unknown }).binding;
    },
  ],
  [
    "status only applied",
    (s: typeof legacyBatch) => {
      delete s.entries[0]!.receipt;
    },
  ],
  [
    "sent unknown called skipped",
    (s: typeof legacyBatch) => {
      s.entries[2]!.status = "skipped";
    },
  ],
] as const)(
  "refuses %s through the public page without recreating proof",
  async (_name, mutate) => {
    const source = structuredClone(legacyBatch);
    mutate(source);
    const w = await migrated("batch", JSON.stringify(source));
    expect(w.text()).toContain("拒绝转换");
    expect(button(w, "准备执行处理")).toBeUndefined();
    expect(button(w, "继续下一项")).toBeUndefined();
    w.unmount();
  },
);
