import {
  mount,
  flushPromises,
  config,
  DOMWrapper,
  type VueWrapper,
} from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { layoutPrintTemplate } from "../src/components/printing/print-layout";
import { App } from "../src/index";
import type {
  BusinessModel,
  ObjectNode,
  ListCollection,
  FieldNode,
  PrintTemplate,
} from "../src/model";
// jsdom has no font/layout engine; browser PDF smoke covers real measurement.
vi.mock("../src/components/printing/print-layout", async () => {
  const { bindPrintTemplate } =
    await import("../src/components/printing/model-print");
  return {
    layoutPrintTemplate: vi.fn(
      async (...args: Parameters<typeof bindPrintTemplate>) =>
        bindPrintTemplate(args[0], args[1], args[2], () => ({
          height: 0,
          insetTop: 0,
        })),
    ),
  };
});
config.global.plugins.push(
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  }),
);
const op = (run = vi.fn(async () => {})) => ({
  disabled: false,
  run,
});
const object = (
  key: string,
  members: ObjectNode["members"] = [],
): ObjectNode => ({
  kind: "object",
  businessType: key,
  family: "standard",
  key,
  label: key,
  identity: null,
  printable: false,
  readOnly: false,
  members,
  operations: {},
});
const text = (
  key: string,
  value: string,
): Extract<FieldNode, { kind: "text" | "longText" | "password" }> => ({
  kind: "text",
  key,
  label: key,
  value,
  readOnly: false,
  required: false,
});
function fixture(fields: FieldNode[] = []) {
  const collection: ListCollection = {
    key: "records",
    label: "记录",
    columns: [{ key: "code", label: "编号" }],
    conditions: object("条件", fields),
    items: [],
    selected: null,
    draft: null,
    page: 1,
    pageSize: 20,
    total: 0,
    operations: { query: op() },
  };
  const owner = { ledger: "synthetic", operator: "tester", generation: "1" };
  const model = reactive<BusinessModel>({
    kind: "application",
    label: "合成",
    brand: { productName: "合成", companyName: "测试" },
    authentication: {
      form: object("登录"),
      operations: { signIn: op(), recover: op() },
    },
    session: {
      state: "ready",
      owner,
    },
    work: {
      members: [
        {
          kind: "domain",
          key: "records",
          label: collection.label,
          members: [collection],
        },
      ],
      account: {
        label: "测试用户",
        profile: object("个人资料"),
        password: object("密码"),
        operations: { changePassword: op(), signOut: op() },
      },
    },
    messages: [],
  });
  return { model, collection: reactive(collection) };
}
let mounted: VueWrapper | undefined;
afterEach(async () => {
  mounted?.unmount();
  mounted = undefined;
  await flushPromises();
  document.body.innerHTML = "";
});
async function show(model: BusinessModel) {
  mounted = mount(App, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  return mounted;
}
async function clickText(text: string) {
  const button = [...document.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
  expect(button, `button ${text}`).toBeTruthy();
  await new DOMWrapper(button!).trigger("click");
  await flushPromises();
}
async function openReference(label: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  )!;
  expect(input).toBeTruthy();
  input
    .closest(".v-field")!
    .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  input.click();
  await flushPromises();
}
it("keeps password inputs masked when they become read-only", async () => {
  const password: FieldNode = {
    kind: "password",
    key: "password",
    label: "密码",
    value: "synthetic-password",
    readOnly: false,
    required: false,
  };
  const { model, collection } = fixture([password]);
  const wrapper = await show(model);
  const input = () => wrapper.get('input[aria-label="密码"]');
  expect(input().attributes("type")).toBe("password");

  collection.conditions.members[0]!.readOnly = true;
  await flushPromises();
  expect(input().attributes("readonly")).toBeDefined();
  expect(input().attributes("type")).toBe("password");

  collection.conditions.members[0]!.readOnly = false;
  collection.conditions.readOnly = true;
  await flushPromises();
  expect(input().attributes("readonly")).toBeDefined();
  expect(input().attributes("type")).toBe("password");
});
function reference(
  kind: "reference" | "treeReference",
  multiple: boolean,
): FieldNode {
  const common = {
    kind,
    key: "ref",
    label: "选择客户",
    required: false,
    readOnly: false,
    options: [
      {
        id: "parent",
        label: "客户组",
        selectable: false,
        children: [
          { id: "child", label: "有效客户", selectable: true, children: [] },
        ],
      },
    ],
  };
  return multiple
    ? {
        ...common,
        multiple: true,
        value: [{ id: "history", label: "历史客户" }],
      }
    : {
        ...common,
        multiple: false,
        value: { id: "history", label: "历史客户" },
      };
}
it("presents synchronous reference candidates without showing a loader", async () => {
  const { model, collection } = fixture([reference("reference", false)]);
  const field = collection.conditions.members[0]!;
  if (field.kind !== "reference") throw Error("fixture");
  let loading = true;
  const run = vi.fn(() => {
    field.options = [{ id: "local", label: "本地候选", selectable: true }];
    void nextTick(() => {
      loading = !!document.querySelector(".zerp-reference .v-field--loading");
    });
  });
  field.load = { disabled: false, run };
  await show(model);
  await openReference("选择客户");
  expect(run).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain("本地候选");
  expect(loading).toBe(false);
});

it("reuses an in-flight directory after the same dropdown is reopened", async () => {
  const { model, collection } = fixture([reference("reference", false)]);
  const field = collection.conditions.members[0]!;
  if (field.kind !== "reference") throw Error("fixture");
  let finish!: () => void;
  const load = vi.fn(async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    field.options = [{ id: "ready", label: "目录客户", selectable: true }];
  });
  field.load = op(load);
  const wrapper = await show(model);
  await openReference("选择客户");
  const input = wrapper.get('input[aria-label="选择客户"]');
  await input.trigger("keydown", { key: "Escape" });
  expect(input.attributes("aria-expanded")).toBe("false");
  await openReference("选择客户");
  expect(input.attributes("aria-expanded")).toBe("true");
  expect(load).toHaveBeenCalledTimes(1);
  finish();
  await flushPromises();
  expect(document.body.textContent).toContain("目录客户");
});
it("updates an open reference from new model options without a directory reload", async () => {
  const ref = reference("reference", false);
  if (ref.kind !== "reference") throw Error("fixture");
  ref.value = { id: "history", label: "" };
  ref.options = [{ id: "before", label: "旧候选", selectable: true }];
  const { model, collection } = fixture([ref]);
  const field = collection.conditions.members[0]!;
  if (field.kind !== "reference") throw Error("fixture");
  field.load = op();
  await show(model);
  expect(field.load.run).not.toHaveBeenCalled();
  await openReference("选择客户");
  expect(document.body.textContent).toContain("旧候选");
  field.options = [{ id: "after", label: "新候选", selectable: true }];
  await flushPromises();
  expect(document.body.textContent).toContain("新候选");
  expect(document.body.textContent).not.toContain("旧候选");
  expect(field.load.run).toHaveBeenCalledTimes(1);
});

it("loads reference directories once, retries a failed load, and searches locally without clearing historical labels", async () => {
  const ref = reference("reference", false);
  if (ref.kind !== "reference") throw Error("fixture");
  ref.options = [];
  const { model, collection } = fixture([ref]);
  const field = collection.conditions.members[0] as Extract<
    FieldNode,
    { kind: "reference" | "treeReference" }
  >;
  let attempt = 0;
  const load = vi.fn(async () => {
    if (++attempt === 1) throw Error("目录读取失败");
    field.options = Array.from({ length: 25 }, (_, i) => ({
      id: `c${i}`,
      label: `客户${i}`,
      selectable: i !== 0,
    }));
  });
  field.load = op(load);
  const wrapper = await show(model);
  expect(wrapper.text()).toContain("历史客户");
  expect(load).not.toHaveBeenCalled();
  expect(
    wrapper.findAll("button").some((button) => button.text() === "load"),
  ).toBe(false);
  await openReference("选择客户");
  expect(load).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain("目录读取失败");
  expect(
    wrapper.get(".zerp-reference").find(".v-input__details").exists(),
  ).toBe(false);
  const referenceInput = wrapper.get('input[aria-label="选择客户"]');
  const descriptions =
    referenceInput.attributes("aria-describedby")?.split(" ") ?? [];
  expect(
    descriptions.some((id) =>
      document.getElementById(id)?.textContent?.includes("目录读取失败"),
    ),
  ).toBe(true);
  await new DOMWrapper(
    document.querySelector('button[aria-label="选择客户错误详情"]')!,
  ).trigger("click");
  await flushPromises();
  await clickText("重试引用");
  expect(load).toHaveBeenCalledTimes(2);
  const disabledOption = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.trim() === "客户0")!;
  disabledOption.click();
  await flushPromises();
  expect(field.value).toEqual({ id: "history", label: "历史客户" });
  await clickText("下一页引用");
  expect(document.body.textContent).toContain("客户20");
  const input = wrapper.get('input[aria-label="选择客户"]');
  await input.setValue("客户24");
  await new Promise((resolve) => setTimeout(resolve, 180));
  await flushPromises();
  expect(load).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toContain("客户24");
  expect(field.value).toEqual({ id: "history", label: "历史客户" });
});
it("expands tree candidates and selects multiple values in one dropdown while preserving history", async () => {
  const { model, collection } = fixture([reference("treeReference", true)]);
  const wrapper = await show(model);
  const field = collection.conditions.members[0] as Extract<
    FieldNode,
    { kind: "reference" | "treeReference" }
  >;
  await openReference("选择客户");
  const expand = document.querySelector<HTMLButtonElement>(
    'button[aria-label="展开客户组"]',
  );
  expect(expand).toBeTruthy();
  expand!.click();
  await flushPromises();
  const child = [...document.querySelectorAll('[role="option"]')].find(
    (option) => option.textContent?.includes("有效客户"),
  ) as HTMLElement;
  expect(child).toBeTruthy();
  child.click();
  await flushPromises();
  expect(field.value).toEqual([
    { id: "history", label: "历史客户" },
    { id: "child", label: "有效客户" },
  ]);
  expect(wrapper.text()).toContain("历史客户");
  expect(document.querySelector('[role="listbox"]')).toBeTruthy();
  child.click();
  await flushPromises();
  expect(field.value).toEqual([{ id: "history", label: "历史客户" }]);
});
it("formats readonly precise values while retaining raw model input", async () => {
  const value = "9007199254740993123.995";
  const { model, collection } = fixture([
    {
      key: "amount",
      label: "金额",
      kind: "decimal",
      readOnly: true,
      required: false,
      value,
      format: { locale: "en-US", maximumFractionDigits: 2, useGrouping: true },
    },
  ]);
  const wrapper = await show(model);
  expect(
    (wrapper.get('input[aria-label="金额"]').element as HTMLInputElement).value,
  ).toBe("9,007,199,254,740,993,124.00");
  expect((collection.conditions.members[0] as { value: string }).value).toBe(
    value,
  );
});
const template: PrintTemplate = {
  label: "当前页合成打印",
  page: { width: 80, height: 80, margin: 5 },
  header: { height: 0, items: [] },
  footer: { height: 0, items: [] },
  body: [
    {
      kind: "records",
      path: [],
      headerHeight: 5,
      rowHeight: 8,
      columns: [{ path: ["code"], label: "编号", width: 50 }],
    },
  ],
};
it("generates template-controlled current-page printing without querying more records or confirming physical output", async () => {
  const { model, collection } = fixture();
  const row = object("formal", [text("code", "current-only")]);
  row.identity = "formal";
  row.printable = true;
  collection.items = [row];
  collection.total = 999;
  const query = collection.operations.query!.run;
  const wrapper = await show(model);
  expect(
    wrapper.findAll("button").some((button) => button.text() === "当前页打印"),
  ).toBe(false);
  collection.printTemple = template;
  await flushPromises();
  await clickText("当前页打印");
  expect(query).not.toHaveBeenCalled();
  const iframe = wrapper.get('iframe[title="打印预览"]');
  expect(iframe.attributes("srcdoc")).toContain("current-only");
  expect(wrapper.text()).not.toContain("已打印");
  const frame = iframe.element as HTMLIFrameElement;
  Object.defineProperty(frame.contentDocument!, "fonts", {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
  const print = vi.fn();
  Object.defineProperty(frame.contentWindow!, "print", {
    value: print,
    configurable: true,
  });
  await iframe.trigger("load");
  await flushPromises();
  await clickText("打开打印窗口");
  expect(print).toHaveBeenCalledTimes(1);
  expect(query).not.toHaveBeenCalled();
  expect(model.messages).toHaveLength(0);
  const printButton = wrapper
    .findAll("button")
    .find((button) => button.text() === "打开打印窗口")!;
  collection.items[0]!.members[0]!.readable = false;
  (printButton.element as HTMLButtonElement).click();
  await flushPromises();
  expect(wrapper.find('iframe[title="打印预览"]').exists()).toBe(false);
  expect(wrapper.text()).toContain("打印字段不存在或无权读取");
  expect(print).toHaveBeenCalledTimes(1);
  collection.items[0]!.printable = false;
  await flushPromises();
  expect(wrapper.find('iframe[title="打印预览"]').exists()).toBe(false);
  expect(print).toHaveBeenCalledTimes(1);
});
it("never offers single-record printing for an unsaved draft", async () => {
  const { model, collection } = fixture();
  collection.itemPrintTemple = {
    ...template,
    body: [
      {
        kind: "record",
        height: 10,
        items: [
          {
            kind: "field",
            key: "code",
            path: ["code"],
            x: 0,
            y: 0,
            width: 50,
            height: 5,
          },
        ],
      },
    ],
  };
  collection.draft = object("draft", [text("code", "unsaved")]);
  const wrapper = await show(model);
  await clickText("继续编辑");
  await flushPromises();
  expect(wrapper.get('[role="dialog"]').text()).toContain("新增");
  expect(
    wrapper.findAll("button").some((button) => button.text() === "单条打印"),
  ).toBe(false);
  expect(wrapper.find("iframe").exists()).toBe(false);
});

it("selects a single tree value and closes the dropdown", async () => {
  const { model, collection } = fixture([reference("treeReference", false)]);
  await show(model);
  await openReference("选择客户");
  document
    .querySelector<HTMLButtonElement>('button[aria-label="展开客户组"]')!
    .click();
  await flushPromises();
  const parent = [...document.querySelectorAll('[role="option"]')].find(
    (option) => option.textContent?.includes("客户组"),
  ) as HTMLElement;
  parent.click();
  await flushPromises();
  const field = collection.conditions.members[0] as Extract<
    FieldNode,
    { kind: "reference" | "treeReference" }
  >;
  expect(field.value).toEqual({ id: "history", label: "历史客户" });
  const child = [...document.querySelectorAll('[role="option"]')].find(
    (option) => option.textContent?.includes("有效客户"),
  ) as HTMLElement;
  child.click();
  await flushPromises();
  expect(field.value).toEqual({ id: "child", label: "有效客户" });
  expect(
    document
      .querySelector('[role="listbox"]')
      ?.closest(".v-overlay")
      ?.classList.contains("v-overlay--active") ?? false,
  ).toBe(false);
});
it("isolates an old candidate read across an owner change and reloads the new scope", async () => {
  const { model, collection } = fixture([reference("reference", false)]);
  const field = collection.conditions.members[0] as Extract<
    FieldNode,
    { kind: "reference" | "treeReference" }
  >;
  field.options = [];
  let finishOld: () => void = () => {};
  let attempt = 0;
  field.load = op(
    vi.fn(async () => {
      const generation = model.session.owner?.generation;
      if (++attempt === 1)
        await new Promise<void>((resolve) => {
          finishOld = resolve;
        });
      if (model.session.owner?.generation !== generation) return;
      field.options = [{ id: "new", label: "新客户", selectable: true }];
    }),
  );
  await show(model);
  await openReference("选择客户");
  const owner = { ledger: "synthetic", operator: "next", generation: "2" };
  model.session = {
    state: "ready",
    owner,
  };
  field.options = [];
  await flushPromises();
  expect(field.options).toEqual([]);
  await openReference("选择客户");
  expect(field.load.run).toHaveBeenCalledTimes(2);
  finishOld();
  await flushPromises();
  expect(document.body.textContent).toContain("新客户");
  expect(field.value).toEqual({ id: "history", label: "历史客户" });
});
it("keeps generated output printing separate from explicit physical-result confirmation", async () => {
  const { model, collection } = fixture();
  const printed = op(),
    confirmed = op();
  const row = object("正式输出", [
    {
      kind: "output",
      key: "output",
      label: "输出",
      readOnly: false,
      value: {
        id: "synthetic-output",
        title: "输出",
        width: 80,
        height: 80,
        pages: [
          {
            key: "page",
            items: [
              {
                kind: "text",
                key: "text",
                text: "合成输出",
                x: 5,
                y: 5,
                width: 50,
                height: 5,
              },
            ],
          },
        ],
      },
      operations: { print: printed, confirmPrinted: confirmed },
    },
  ]);
  row.identity = "formal";
  row.printable = true;
  collection.selected = row;
  collection.items = [row];
  collection.total = 1;
  const wrapper = await show(model);
  await wrapper.get('button[aria-label="查看"]').trigger("click");
  await flushPromises();
  expect(
    wrapper.findAll("button").filter((button) => button.text() === "打印"),
  ).toHaveLength(0);
  const iframe = wrapper.get('iframe[title="打印预览"]');
  expect(printed.run).not.toHaveBeenCalled();
  expect(confirmed.run).not.toHaveBeenCalled();
  const frame = iframe.element as HTMLIFrameElement;
  Object.defineProperty(frame.contentDocument!, "fonts", {
    value: { ready: Promise.resolve() },
    configurable: true,
  });
  const nativePrint = vi.fn();
  Object.defineProperty(frame.contentWindow!, "print", {
    value: nativePrint,
    configurable: true,
  });
  await iframe.trigger("load");
  await flushPromises();
  await clickText("打开打印窗口");
  expect(nativePrint).toHaveBeenCalledTimes(1);
  expect(printed.run).toHaveBeenCalledTimes(1);
  expect(confirmed.run).not.toHaveBeenCalled();
});

it("blocks edited and uncertain values from printing until consumer confirms the same formal record", async () => {
  const { model, collection } = fixture();
  const facts = reactive({ accepted: "saved", state: "confirmed" });
  const row = object("正式记录", [text("code", "saved")]);
  row.identity = "formal";
  Object.defineProperty(row, "printable", {
    get() {
      return (
        facts.state === "confirmed" &&
        (this.members[0] as { value: string }).value === facts.accepted
      );
    },
    enumerable: true,
  });
  let attempt = 0;
  row.operations.update = {
    disabled: false,
    run: vi.fn(async (edited: ObjectNode) => {
      attempt++;
      if (attempt === 1) throw Error("保存失败");
      if (attempt === 2) {
        facts.state = "unknown";
        throw Error("未知结果");
      }
      facts.accepted = (edited.members[0] as { value: string }).value;
      facts.state = "confirmed";
    }),
  };
  collection.items = [row];
  collection.selected = row;
  collection.total = 1;
  collection.printTemple = template;
  const wrapper = await show(model);
  await wrapper.get('button[aria-label="编辑"]').trigger("click");
  await flushPromises();
  const pagePrint = () =>
    wrapper.findAll("button").find((button) => button.text() === "当前页打印");
  expect(pagePrint()?.element.disabled).toBe(false);
  await wrapper
    .get('[role="dialog"] input[aria-label="code"]')
    .setValue("unsaved");
  expect(collection.selected!.printable).toBe(false);
  expect(pagePrint()).toBeUndefined();
  expect(collection.operations.query!.run).not.toHaveBeenCalled();
  await clickText("保存");
  expect(pagePrint()).toBeUndefined();
  await clickText("保存");
  expect(facts.state).toBe("unknown");
  expect(pagePrint()).toBeUndefined();
  await clickText("保存");
  expect(collection.selected!.printable).toBe(true);
  expect(pagePrint()?.element.disabled).toBe(false);
  expect(collection.operations.query!.run).not.toHaveBeenCalled();
});

it("disables a previously confirmed current-page print while a row operation is pending", async () => {
  const { model, collection } = fixture();
  const row = object("正式记录", [text("code", "saved")]);
  row.identity = "formal";
  row.printable = true;
  let finish: () => void = () => {};
  row.operations.update = op(
    vi.fn(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    }),
  );
  collection.items = [row];
  collection.selected = row;
  collection.total = 1;
  collection.printTemple = template;
  const wrapper = await show(model);
  await wrapper.get('button[aria-label="编辑"]').trigger("click");
  await flushPromises();
  const pagePrint = () =>
    wrapper.findAll("button").find((button) => button.text() === "当前页打印")!;
  expect(pagePrint().attributes("disabled")).toBeUndefined();
  await clickText("保存");
  expect(pagePrint().attributes("disabled")).toBeDefined();
  expect(wrapper.text()).toContain("正在处理，请稍后打印");
  finish();
  await flushPromises();
  expect(pagePrint().attributes("disabled")).toBeUndefined();
});
it("opens a requested row print after its pending read and does not reopen a closed preview", async () => {
  const { model, collection } = fixture();
  const row = object("正式记录", [text("code", "saved")]);
  row.identity = "formal";
  row.printable = true;
  let finishRead: () => void = () => {};
  row.load = op(
    vi.fn(async () => {
      await new Promise<void>((resolve) => {
        finishRead = resolve;
      });
    }),
  ).run;
  collection.items = [row];
  collection.total = 1;
  collection.itemPrintTemple = {
    ...template,
    label: "单条合成打印",
    body: [
      {
        kind: "record",
        height: 10,
        items: [
          {
            kind: "field",
            key: "code",
            path: ["code"],
            x: 0,
            y: 0,
            width: 50,
            height: 5,
          },
        ],
      },
    ],
  };
  const wrapper = await show(model);
  await wrapper.get('button[aria-label="打印"]').trigger("click");
  await flushPromises();
  expect(row.load).toHaveBeenCalledTimes(1);
  expect(wrapper.find('iframe[title="打印预览"]').exists()).toBe(false);
  finishRead();
  await flushPromises();
  expect(
    wrapper.get('iframe[title="打印预览"]').attributes("srcdoc"),
  ).toContain("saved");
  const printDialog = wrapper.get('[role="dialog"][aria-label="单条合成打印"]');
  await printDialog
    .findAll("button")
    .find((button) => button.text() === "关闭")!
    .trigger("click");
  await flushPromises();
  expect(wrapper.find('iframe[title="打印预览"]').exists()).toBe(false);
  collection.selected!.printable = false;
  await flushPromises();
  collection.selected!.printable = true;
  await flushPromises();
  expect(wrapper.find('iframe[title="打印预览"]').exists()).toBe(false);
});
it("invalidates a reference directory when its consumer dependency scope changes", async () => {
  const ref = reference("reference", false);
  if (ref.kind !== "reference") throw Error("fixture");
  const { model, collection } = fixture([ref]);
  const field = collection.conditions.members[0] as Extract<
    FieldNode,
    { kind: "reference" | "treeReference" }
  >;
  field.options = [];
  field.scopeKey = "first";
  const load = vi.fn(async () => {
    field.options = [
      {
        id: field.scopeKey!,
        label: field.scopeKey === "first" ? "第一目录客户" : "第二目录客户",
        selectable: true,
      },
    ];
  });
  field.load = op(load);
  await show(model);
  await openReference("选择客户");
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.includes("第一目录客户"))!;
  expect(option).toBeTruthy();
  option.click();
  await flushPromises();
  field.scopeKey = "second";
  field.options = [];
  await flushPromises();
  await openReference("选择客户");
  expect(load).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toContain("第二目录客户");
  expect(field.value).toEqual({ id: "first", label: "第一目录客户" });
});
it("can load a new dependency scope before the old directory resolves", async () => {
  const ref = reference("reference", false);
  if (ref.kind !== "reference") throw Error("fixture");
  const { model, collection } = fixture([ref]);
  const field = collection.conditions.members[0] as Extract<
    FieldNode,
    { kind: "reference" | "treeReference" }
  >;
  field.options = [];
  field.scopeKey = "old";
  let finish!: () => void;
  const load = vi.fn(async () => {
    const scope = field.scopeKey;
    if (scope === "old")
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    if (field.scopeKey === scope)
      field.options = [
        {
          id: scope!,
          label: scope === "old" ? "旧目录" : "新目录",
          selectable: true,
        },
      ];
  });
  field.load = op(load);
  await show(model);
  await openReference("选择客户");
  field.scopeKey = "new";
  await flushPromises();
  await openReference("选择客户");
  expect(load).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toContain("新目录");
  finish();
  await flushPromises();
  expect(document.body.textContent).not.toContain("旧目录");
});

it("discards late template layout after model values change and after preview closes", async () => {
  const { model, collection } = fixture();
  const row = object("formal", [text("code", "old-value")]);
  row.identity = "formal";
  row.printable = true;
  collection.items = [row];
  collection.total = 1;
  collection.printTemple = template;
  let finish: (
    value: Awaited<ReturnType<typeof layoutPrintTemplate>>,
  ) => void = () => {};
  let previousSignal: AbortSignal | undefined;
  vi.mocked(layoutPrintTemplate).mockImplementationOnce(
    (_template, _source, _readable, signal) => {
      previousSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  );
  const wrapper = await show(model);
  await clickText("当前页打印");
  expect(wrapper.find('iframe[title="打印预览"]').exists()).toBe(false);
  (collection.items[0]!.members[0] as { value: string }).value = "new-value";
  await flushPromises();
  expect(previousSignal?.aborted).toBe(true);
  const frame = wrapper.get('iframe[title="打印预览"]');
  expect(frame.attributes("srcdoc")).toContain("new-value");
  const { bindPrintTemplate } =
    await import("../src/components/printing/model-print");
  finish(
    bindPrintTemplate(
      template,
      collection,
      () => true,
      () => ({ height: 0, insetTop: 0 }),
    ),
  );
  await flushPromises();
  const dialog = wrapper.get('[role="dialog"][aria-label="当前页合成打印"]');
  await dialog
    .findAll("button")
    .find((button) => button.text() === "关闭")!
    .trigger("click");
  await flushPromises();
  expect(wrapper.find('iframe[title="打印预览"]').exists()).toBe(false);
});

it("leaves nested record values untracked while template preview is closed", async () => {
  const { model, collection } = fixture();
  const value = vi.fn(() => "private");
  const hidden = {
    ...text("hidden", ""),
    readable: false,
    get value() {
      return value();
    },
  };
  const row = object("formal", [text("code", "initial"), hidden]);
  row.identity = "formal";
  row.printable = true;
  collection.items = [row];
  collection.total = 1;
  collection.printTemple = template;
  await show(model);
  value.mockClear();
  (collection.items[0]!.members[0] as { value: string }).value = "updated";
  await flushPromises();
  expect(value).not.toHaveBeenCalled();
});
