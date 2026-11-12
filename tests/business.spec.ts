import { ref } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import {
  AppPage,
  defineBusinessPage,
  defineModulePage,
  type Attempt,
  type AppPageHandle,
  type BusinessObject,
  type PageDefinition,
} from "../src/index";
const model = {
  kind: "object",
  name: "合成资料",
  properties: {
    name: { kind: "text", name: "名称" },
    children: { kind: "collection", name: "所属资料" },
  },
  list: { fields: ["name"] },
  form: { fields: ["name", "children"] },
} satisfies BusinessObject;
type Data = { name?: string | null };
const permissions = { query: true, create: true, write: true, reconcile: true };
const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = "";
});
function fixture(resource: string, unknown = false) {
  const save = vi.fn(async (_attempt: Attempt<Data, string>) => ({
    status: unknown ? ("unknown" as const) : ("success" as const),
    identity: resource,
  }));
  const adapter = {
    empty: (): Data => ({ name: "" }),
    query: vi.fn(async () => ({ items: [{ name: resource }], total: 1 })),
    get: async () => ({ values: { name: resource }, identity: resource }),
    create: save,
    save,
  };
  const definition = {
    resource,
    title: resource,
    model: { ...model, form: { fields: ["name"] } },
    filters: [],
    initialFilters: () => ({}),
    identity: () => resource,
    actions: () => ["edit"] as const,
    adapter,
  };
  return { definition, adapter, save };
}
function host(page: PageDefinition, scope = "a") {
  const wrapper = mount(AppPage, {
    attachTo: document.body,
    props: {
      page,
      scope,
      brand: {
        home: "/",
        productName: "合成",
        enterpriseName: "合成",
        mark: { kind: "text" as const, text: "例" },
      },
      brandState: { kind: "ready" },
      navigation: [],
      navigationState: { kind: "ready" },
      footer: "",
    },
    global: {
      plugins: [
        createRouter({
          history: createMemoryHistory(),
          routes: [{ path: "/", component: { template: "<span />" } }],
        }),
      ],
    },
  });
  mounted.push(wrapper);
  return wrapper;
}
async function click(root: Element | Document, name: string) {
  const button = [...root.querySelectorAll("button")].find(
    (element) =>
      element.textContent?.trim() === name ||
      element.getAttribute("aria-label") === name,
  );
  expect(button, name).toBeDefined();
  button!.click();
  await flushPromises();
}
function input(root: Element | Document, name: string, value: string) {
  const element = root.querySelector<HTMLInputElement>(
    `input[aria-label="${name}"]`,
  )!;
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
it("keeps independent child uncertainty out of sibling write permissions while protecting departure", async () => {
  const first = fixture("first", true),
    second = fixture("second"),
    parent = fixture("parent");
  const child = defineBusinessPage({
    definition: first.definition,
    permissions,
  });
  const sibling = defineBusinessPage({
    definition: second.definition,
    permissions,
  });
  const parentModel = {
    ...model,
    properties: {
      ...model.properties,
      sibling: { kind: "collection" as const, name: "其他所属资料" },
    },
    form: { fields: ["name", "children", "sibling"] },
  };
  const page = defineBusinessPage({
    definition: { ...parent.definition, model: parentModel },
    permissions,
    related: { children: () => child, sibling: () => sibling },
  });
  const wrapper = host(page);
  await flushPromises();
  await click(document, "编辑");
  const dialog = document.querySelector('[role="dialog"]')!;
  input(dialog, "名称", "保留父输入");
  await flushPromises();
  await click(dialog, "所属资料");
  const firstRegion = dialog.querySelector('.zerp-ui[aria-label="first"]')!;
  await click(firstRegion, "编辑");
  await click(firstRegion, "保存");
  expect(first.save).toHaveBeenCalledTimes(1);
  await click(dialog, "其他所属资料");
  const secondRegion = dialog.querySelector('.zerp-ui[aria-label="second"]')!;
  await click(secondRegion, "编辑");
  const siblingSave = [
    ...secondRegion.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.trim() === "保存")!;
  expect(siblingSave.disabled).toBe(false);
  await click(secondRegion, "保存");
  expect(second.save).toHaveBeenCalledTimes(1);
  expect(parent.save).not.toHaveBeenCalled();
  expect(
    dialog.querySelector<HTMLInputElement>('input[aria-label="名称"]')!.value,
  ).toBe("保留父输入");
  expect(await (wrapper.vm as unknown as AppPageHandle).requestLeave()).toBe(
    false,
  );
});
it("adopts a created identity so a subsequent edit uses save rather than create", async () => {
  const f = fixture("new-record");
  const created = vi.fn(async () => ({
    status: "success" as const,
    identity: "new-record",
  }));
  const adapter = {
    ...f.adapter,
    create: created,
    get: async () => ({
      values: { name: "created" },
      identity: "new-record",
      writable: true,
      row: { name: "created" },
    }),
  };
  host(
    defineBusinessPage({
      definition: { ...f.definition, adapter },
      permissions,
    }),
  );
  await flushPromises();
  await click(document, "新增");
  let dialog = document.querySelector('[role="dialog"]')!;
  input(dialog, "名称", "created");
  await flushPromises();
  await click(dialog, "保存");
  await click(dialog, "编辑");
  await click(dialog, "保存");
  expect(created).toHaveBeenCalledTimes(1);
  expect(f.save).toHaveBeenCalledWith(
    expect.objectContaining({ operation: "save", identity: "new-record" }),
  );
});
it("does not send a prepared write after the session scope has changed", async () => {
  const f = fixture("deferred");
  let done!: (identity: string) => void;
  const prepared = new Promise<string>((resolve) => {
    done = resolve;
  });
  const wrapper = host(
    defineBusinessPage({
      definition: {
        ...f.definition,
        adapter: { ...f.adapter, prepare: () => prepared },
      },
      permissions,
    }),
  );
  await flushPromises();
  await click(document, "编辑");
  await click(document.querySelector('[role="dialog"]')!, "保存");
  await wrapper.setProps({ scope: "b" });
  await flushPromises();
  done("deferred");
  await flushPromises();
  expect(f.save).not.toHaveBeenCalled();
});
it("adopts an authoritative identity when an uncertain creation is reconciled", async () => {
  const f = fixture("created");
  const create = vi.fn(async () => ({ status: "unknown" as const }));
  const get = vi.fn(async ({ identity }: { identity: string }) => ({
    values: { name: "created" },
    identity,
    writable: true,
  }));
  const page = defineBusinessPage({
    definition: {
      ...f.definition,
      adapter: { ...f.adapter, create, get },
      reconcile: async (attempt) => ({
        status: "applied" as const,
        attemptId: attempt.id,
        evidence: "receipt",
        identity: "assigned",
      }),
    },
    permissions,
  });
  const wrapper = host(page);
  await flushPromises();
  await click(document, "新增");
  await click(document.querySelector('[role="dialog"]')!, "保存");
  wrapper.unmount();
  mounted.splice(mounted.indexOf(wrapper), 1);
  host(page);
  await flushPromises();
  await click(document, "核实本次请求");
  expect(get).toHaveBeenCalledWith({ scope: "a", identity: "assigned" });
  expect(create).toHaveBeenCalledTimes(1);
});
it("loads normal module collections only when visited and keeps their model order", async () => {
  const first = fixture("first"),
    second = fixture("second");
  const module = {
    kind: "object",
    name: "模块",
    properties: {
      first: { kind: "collection", name: "甲组" },
      second: { kind: "collection", name: "乙组" },
    },
    form: { fields: ["second", "first"] },
  } as const satisfies BusinessObject;
  const wrapper = host(
    defineModulePage({
      model: module,
      collections: {
        first: defineBusinessPage({
          definition: first.definition,
          permissions,
        }),
        second: defineBusinessPage({
          definition: second.definition,
          permissions,
        }),
      },
    }),
  );
  await flushPromises();
  expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
    "乙组",
    "甲组",
  ]);
  expect(first.adapter.query).not.toHaveBeenCalled();
  expect(second.adapter.query).toHaveBeenCalledTimes(1);
  await click(document, "编辑");
  const editor = document.querySelector(".zerp-related-editor")!;
  input(editor, "名称", "保留乙组草稿");
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await click(document, "甲组");
  expect(first.adapter.query).toHaveBeenCalledTimes(1);
  await click(document, "乙组");
  expect(second.adapter.query).toHaveBeenCalledTimes(1);
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="名称"]')!.value,
  ).toBe("保留乙组草稿");
});
it("locates a rejected nested field in its owning tab and preserves the input", async () => {
  const f = fixture("validation");
  const nestedModel = {
    ...model,
    properties: {
      ...model.properties,
      contact: {
        kind: "object" as const,
        name: "联系信息",
        properties: { mobile: { kind: "text" as const, name: "手机" } },
        form: { fields: ["mobile"] },
      },
    },
    form: { fields: ["name", "contact"] },
  };
  const save = vi.fn(async () => ({
    status: "failure" as const,
    message: "请检查手机。",
    field: "contact.mobile",
  }));
  host(
    defineBusinessPage({
      definition: {
        ...f.definition,
        model: nestedModel,
        adapter: {
          ...f.adapter,
          save,
          get: async () => ({
            values: { name: "draft", contact: { mobile: "keep" } },
            identity: "validation",
          }),
        },
      },
      permissions,
    }),
  );
  await flushPromises();
  await click(document, "编辑");
  const dialog = document.querySelector('[role="dialog"]')!;
  await click(dialog, "保存");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("手机");
  expect(
    dialog.querySelector<HTMLInputElement>('input[aria-label="手机"]')!.value,
  ).toBe("keep");
  expect(dialog.textContent).toContain("请检查手机。");
  expect(save).toHaveBeenCalledTimes(1);
});
it("keeps eligible but disabled actions visible without dispatching a write", async () => {
  const f = fixture("disabled");
  host(
    defineBusinessPage({
      definition: {
        ...f.definition,
        disabledActions: () => ({ edit: "当前期间不能修改。" }),
      },
      permissions,
    }),
  );
  await flushPromises();
  const button = document.querySelector<HTMLButtonElement>(
    'button[aria-label="编辑"]',
  )!;
  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-description")).toBe("当前期间不能修改。");
  button.click();
  await flushPromises();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(f.save).not.toHaveBeenCalled();
});
it("opens mobile module records in a dialog with the authorized edit entry", async () => {
  const width = window.innerWidth;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  window.dispatchEvent(new Event("resize"));
  try {
    const f = fixture("mobile-record");
    const record = defineBusinessPage({
      definition: { ...f.definition, actions: () => ["view", "edit"] as const },
      permissions,
    });
    host(
      defineModulePage({
        model: {
          kind: "object",
          name: "手机模块",
          properties: { records: { kind: "collection", name: "资料" } },
          form: { fields: ["records"] },
        },
        collections: { records: record },
      }),
    );
    await flushPromises();
    await click(document, "查看");
    const dialog = document.querySelector(
      '[role="dialog"][aria-label="查看资料"]',
    );
    expect(dialog, "手机详情必须在弹窗内").not.toBeNull();
    await click(dialog!, "编辑");
    expect(dialog!.querySelector('input[aria-label="名称"]')).not.toBeNull();
    expect(f.save).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  }
});

it("hides write actions while an original request is recovered without write qualification", async () => {
  const f = fixture("read-only-recovery", true),
    allowed = ref(true);
  const definition = {
    ...f.definition,
    reconcile: async (attempt: Attempt<Data, string>) => ({
      status: "not-applied" as const,
      attemptId: attempt.id,
      evidence: "original receipt",
    }),
  };
  host(
    defineBusinessPage(() => ({
      definition,
      permissions: { ...permissions, write: allowed.value },
    })),
  );
  await flushPromises();
  await click(document, "编辑");
  await click(document.querySelector('[role="dialog"]')!, "保存");
  allowed.value = false;
  await flushPromises();
  expect(
    Array.from(document.querySelectorAll("button")).some(
      (button) => button.textContent?.trim() === "保存",
    ),
  ).toBe(false);
  await click(document, "核实本次请求");
  expect(f.save).toHaveBeenCalledTimes(1);
});

it("initializes only new object-array rows and keeps cancellation and existing values intact", async () => {
  const save = vi.fn(async (_attempt: unknown) => ({
    status: "success" as const,
  }));
  const rowModel = {
    kind: "object",
    name: "合成产品",
    properties: {
      name: { kind: "text", name: "名称" },
      units: {
        kind: "array",
        name: "单位",
        element: {
          kind: "object",
          name: "单位",
          properties: {
            rate: { kind: "text", name: "比率", initialValue: "1" },
            order: { kind: "integer", name: "排序", initialValue: 0 },
            optional: { kind: "text", name: "备注", initialValue: null },
            secret: {
              kind: "text",
              name: "秘密",
              secret: true,
              initialValue: "must-not-copy",
            },
          },
          form: { fields: ["rate", "order", "optional", "secret"] },
        },
      },
    },
    form: { fields: ["name", "units"] },
    list: { fields: ["name"] },
  } as const satisfies BusinessObject;
  const wrapper = host(
    defineBusinessPage({
      definition: {
        resource: "initial-rows",
        title: "合成产品",
        model: rowModel,
        filters: [],
        initialFilters: () => ({}),
        identity: () => "one",
        actions: () => ["edit"] as const,
        adapter: {
          query: async () => ({ items: [{ name: "已有产品" }], total: 1 }),
          get: async () => ({
            values: { name: "已有产品", units: [{ rate: "7", order: 5 }] },
            identity: "one",
          }),
          empty: () => ({ name: "", units: [] }),
          create: save,
          save,
        },
      },
      permissions,
    }),
  );
  await flushPromises();
  await click(wrapper.element, "编辑");
  input(document, "名称", "更新产品");
  await flushPromises();
  await click(
    [...document.querySelectorAll("fieldset")].find(
      (e) => e.querySelector("legend")?.textContent === "单位",
    )!,
    "新增",
  );
  expect(
    document
      .querySelector<HTMLElement>('section[aria-label="单位 2"]')!
      .querySelector<HTMLInputElement>('input[aria-label="比率"]')!.value,
  ).toBe("1");
  expect(
    document
      .querySelector<HTMLElement>('section[aria-label="单位 2"]')!
      .querySelector<HTMLInputElement>('input[aria-label="排序"]')!.value,
  ).toBe("0");
  expect(document.body.textContent).not.toContain("must-not-copy");
  await click(document, "删除单位 2");
  await click(document, "保存");
  expect(save).toHaveBeenCalledOnce();
  expect(save.mock.calls[0]?.[0]).toMatchObject({
    input: { units: [{ rate: "7", order: 5 }] },
  });
});
