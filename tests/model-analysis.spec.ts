import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import {
  application,
  object,
  collection,
  text,
  array,
  documentOperations,
  type ApplicationNode,
  type ModelNode,
} from "../src/model";
const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = "";
});
async function click(name: string) {
  const button = [...document.querySelectorAll("button")].find(
    (el) =>
      el.textContent?.trim() === name || el.getAttribute("aria-label") === name,
  );
  expect(button, name).toBeTruthy();
  button!.click();
  await flushPromises();
}
async function input(name: string, value: string) {
  const el = document.querySelector<HTMLInputElement>(
    `input[aria-label="${name}"]`,
  )!;
  expect(el, name).toBeTruthy();
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
}
async function start<N extends ModelNode>(node: N) {
  const visit = vi.fn();
  const model = reactive(
    application(
      "合成分析",
      { node: node as ModelNode },
      {
        owner: { ledger: "s", operator: "u", generation: "1" },
        brand: {
          home: "/",
          productName: "合成",
          enterpriseName: "合成",
          mark: { kind: "text", text: "例" },
        },
        navigation: {
          current: { node },
          href: () => "/",
          visit,
          guard: () => () => {},
        },
      },
    ) as ApplicationNode<{ node: N }>,
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
  mounted.push(wrapper);
  await flushPromises();
  return { wrapper, model, visit };
}
it("discards an aborted query before it can replace model rows or adopted export parameters", async () => {
  const row = (name = "") =>
    object(
      "结果",
      {
        id: text("编号", { value: name }),
        name: text("名称", { value: name }),
      },
      {
        identity: ["id"],
        operations: {
          update: {
            async run() {
              return { status: "success" };
            },
          },
        },
      },
    );
  const parameters = object("参数", { search: text("条件", { value: "A" }) });
  type Result = {
    items: ReturnType<typeof row>[];
    total: number;
    id: string;
    summary: { caption: string; values: {} };
    context: string;
  };
  let resolve!: (value: Result) => void;
  const deferred = new Promise<Result>((r) => {
    resolve = r;
  });
  const result = (name: string): Result => ({
    items: [row(name)],
    total: 1,
    id: name,
    summary: { caption: "权威合计", values: {} },
    context: name,
  });
  const exported = vi.fn(async () => ({
    content: new Blob(["synthetic"]),
    filename: "test.csv",
  }));
  const node = collection("分析", () => row(), {
    operations: {
      query: {
        input: parameters,
        async run({ input }) {
          return input.search === "A" ? deferred : result("B");
        },
        async page() {
          return result("B");
        },
        async revalidate() {
          return { status: "valid" as const };
        },
      },
      export: { run: exported },
    },
  });
  const f = await start(node);
  await click("查询");
  await click("停止等待");
  await input("条件", "B");
  await click("查询");
  expect(f.model.node.items[0].name.value).toBe("B");
  resolve(result("A"));
  await flushPromises();
  expect(f.model.node.items[0].name.value).toBe("B");
  expect(document.body.textContent).toContain("B");
});
it("adopts authoritative formal, candidate and exact history content into the declared model hierarchy", async () => {
  const content = () =>
    object("内容", { name: text("名称", { value: "local" }) });
  const versions = {
    official: content(),
    candidate: content(),
    history: array("历史", content),
  };
  const audit = object("审计", {});
  const snap = (name: string, state: string) => ({
    label: state,
    identity: { id: "one", revision: state },
    state,
    owner: "owner",
    values: { name },
    attachments: [] as { label: string; handle: string }[],
    eligible: { edit: true, approve: true },
  });
  const approve = vi.fn(async () => ({ status: "success" as const }));
  const node = object("档案", versions, {
    operations: documentOperations<
      typeof versions.candidate,
      { id: string; revision: string },
      string,
      string,
      string,
      typeof audit
    >(versions, audit, {
      get: {
        async run() {
          return {
            official: snap("正式权威值", "v2"),
            candidate: snap("候选权威值", "v3"),
            history: [snap("精确历史值", "v1")],
            audit: [],
          };
        },
      },
      submit: {
        async run() {
          return { status: "success" };
        },
      },
      approve: { run: approve },
    }),
  });
  const f = await start(node);
  expect(f.model.node.official.name.value).toBe("正式权威值");
  expect(f.model.node.candidate.name.value).toBe("候选权威值");
  expect(f.model.node.history.items[0].name.value).toBe("精确历史值");
  await click("开放候选");
  await click("审批通过");
  expect(approve).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: { id: "one", revision: "v3" },
      state: "v3",
      operation: "approve",
    }),
  );
});
it("keeps disabled voucher preparation visible without invoking new or clone callbacks", async () => {
  const c = object("单据内容", { name: text("名称") });
  const audit = object("审计", {});
  const snapshot = {
    identity: { voucher: "v", revision: "1", submission: null },
    number: "V1",
    handler: "经办",
    state: "draft",
    owner: "owner",
    values: { name: "权威值" },
    attachments: [] as { label: string; handle: string }[],
    eligible: { edit: true, clone: true, approve: false },
  };
  const create = reactive({
      disabledReason: "禁止新增",
      run: vi.fn(() => snapshot),
    }),
    clone = reactive({
      disabledReason: "禁止克隆",
      run: vi.fn(() => snapshot),
    });
  const { voucherOperations } = await import("../src/model");
  const node = object(
    "单据",
    { content: c },
    {
      operations: voucherOperations<
        typeof c,
        string,
        string,
        null,
        string,
        string,
        string,
        typeof audit
      >(c, audit, {
        query: {
          async run() {
            return {
              items: [
                { identity: snapshot.identity, number: "V1", handler: "经办" },
              ],
              total: 1,
            };
          },
        },
        get: {
          async run() {
            return { current: snapshot, history: [], audit: [] };
          },
        },
        create,
        clone,
        submit: {
          async run() {
            return { status: "success" };
          },
        },
      }),
    },
  );
  await start(node);
  const button = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (el) => el.textContent?.trim() === label,
    )!;
  expect(button("新增").disabled).toBe(true);
  expect(button("新增").title).toBe("禁止新增");
  await click("查看");
  expect(button("克隆").disabled).toBe(true);
  expect(button("克隆").title).toBe("禁止克隆");
  button("新增").click();
  button("克隆").click();
  await flushPromises();
  expect(create.run).not.toHaveBeenCalled();
  expect(clone.run).not.toHaveBeenCalled();
  create.disabledReason = "";
  await flushPromises();
  expect(button("新增").disabled).toBe(false);
});
it("rebinds a replacement archive and retains unchanged historical node identities across rereads", async () => {
  let order = ["a", "b"];
  const content = () => object("内容", { name: text("名称") });
  const audit = object("审计", {});
  function archive(label: string) {
    const versions = {
      official: content(),
      candidate: content(),
      history: array("历史", content),
    };
    const snap = (name: string) => ({
      label: name,
      identity: name,
      state: "v1",
      owner: "owner",
      values: { name },
      attachments: [] as { label: string; handle: string }[],
      eligible: { edit: true },
    });
    return object("档案", versions, {
      operations: documentOperations<
        typeof versions.candidate,
        string,
        string,
        string,
        string,
        typeof audit
      >(versions, audit, {
        get: {
          async run() {
            return {
              official: snap(label),
              candidate: null,
              history: order.map(snap),
              audit: [],
            };
          },
        },
        submit: {
          async run() {
            return { status: "success" };
          },
        },
      }),
    });
  }
  const first = archive("first"),
    f = await start(first);
  const a = f.model.node.history.items[0],
    b = f.model.node.history.items[1];
  order = ["b", "a"];
  await click("重试读取");
  expect(f.model.node.history.items[0]).toBe(b);
  expect(f.model.node.history.items[1]).toBe(a);
  f.model.node = archive("second");
  await flushPromises();
  expect(f.model.node.official.name.value).toBe("second");
  expect(first.official.name.value).toBe("first");
});

it("keeps a document original locked when workflow operations replace the authority", async () => {
  const content = () =>
    object("内容", { name: text("名称", { value: "local" }) });
  const versions = {
    official: content(),
    candidate: content(),
    history: array("历史", content),
  };
  const audit = object("审计", {});
  const snap = (name: string, state: string) => ({
    label: state,
    identity: { id: "one", revision: state },
    state,
    owner: "owner",
    values: { name },
    attachments: [] as { label: string; handle: string }[],
    eligible: { edit: true, approve: true },
  });
  const approve = vi.fn(async () => ({ status: "unknown" as const }));
  const node = object("档案", versions, {
    operations: documentOperations<
      typeof versions.candidate,
      { id: string; revision: string },
      string,
      string,
      string,
      typeof audit
    >(versions, audit, {
      get: {
        async run() {
          return {
            official: snap("正式权威值", "v2"),
            candidate: snap("候选权威值", "v3"),
            history: [snap("精确历史值", "v1")],
            audit: [],
          };
        },
      },
      submit: {
        async run() {
          return { status: "success" };
        },
      },
      approve: { run: approve },
    }),
  });
  const f = await start(node);
  expect(f.model.node.official.name.value).toBe("正式权威值");
  expect(f.model.node.candidate.name.value).toBe("候选权威值");
  expect(f.model.node.history.items[0].name.value).toBe("精确历史值");
  await click("开放候选");
  await click("审批通过");
  const { workflowOperations } = await import("../src/model");
  const foreignReconcile = vi.fn(async () => ({ status: "unknown" as const }));
  const foreignGet = vi.fn(async () => ({
    identity: "flow",
    label: "flow",
    nodes: [],
  }));
  const replacement = object(
    "流程",
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
        query: {
          async run() {
            return { items: [], total: 0 };
          },
        },
        get: { run: foreignGet },
        audit: {
          async run() {
            return [];
          },
        },
        reconcile: foreignReconcile,
      }),
    },
  );
  (f.model as unknown as { node: ModelNode }).node = replacement;
  await flushPromises();
  expect(document.body.textContent).toContain("请求结果未知");
  const recovery = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.trim() === "核实本次请求");
  if (recovery && !recovery.disabled) {
    recovery.click();
    await flushPromises();
  }
  expect(foreignReconcile).not.toHaveBeenCalled();
  expect(foreignGet).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("请求结果未知");
});

it("creates registered model rows and nested child rows in the document block", async () => {
  let next = 0;
  const child = () => object("子行", { note: text("子行内容") });
  const line = () =>
    object(
      "行",
      {
        id: text("行号", { value: String(++next), readOnly: true }),
        note: text("行内容"),
        children: array("子明细", child),
      },
      { identity: ["id"] as const },
    );
  const content = () => object("内容", { rows: array("明细", line) });
  const versions = {
    official: content(),
    candidate: content(),
    history: array("历史", content),
  };
  const audit = object("审计", {});
  const snapshot = {
    label: "候选",
    identity: "one",
    state: "draft",
    owner: "owner",
    values: { rows: [] },
    attachments: [],
    eligible: { edit: true },
  };
  const node = object("档案", versions, {
    operations: documentOperations<
      typeof versions.candidate,
      string,
      string,
      string,
      string,
      typeof audit
    >(versions, audit, {
      get: {
        async run() {
          return {
            official: snapshot,
            candidate: snapshot,
            history: [],
            audit: [],
          };
        },
      },
      submit: {
        async run() {
          return { status: "success" };
        },
      },
    }),
  });
  await start(node);
  await click("编辑档案");
  await click("新增");
  await input("行内容", "合成父行");
  await click("确定明细行");
  expect(document.body.textContent).toContain("合成父行");
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.includes("编辑子明细"))!;
  expect(button).toBeTruthy();
  button.click();
  await flushPromises();
  const dialog = document.querySelector<HTMLElement>(
    ".zerp-voucher-child-dialog",
  )!;
  const add = [...dialog.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === "新增",
  )!;
  expect(add).toBeTruthy();
  add.click();
  await flushPromises();
  await input("子行内容", "合成子行");
  expect(document.body.textContent).not.toContain("数组行声明已失效");
});
