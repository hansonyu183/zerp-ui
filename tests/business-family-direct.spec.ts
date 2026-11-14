import { mount, flushPromises, config } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import { modelMetadata as meta, type BusinessModel } from "../src/model";
import { createRouter, createMemoryHistory } from "vue-router";
config.global.plugins.push(
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
  }),
);
type Node = BusinessModel[string];
type ObjectNode = Extract<Node, { [meta]: { kind: "object" } }>;
let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
async function render(target: ObjectNode) {
  const owner = { ledger: "synthetic", operator: "test", generation: "1" };
  const model: BusinessModel = reactive({
    target,
    [meta]: {
      kind: "application",
      name: "Family test",
      brand: { productName: "Synthetic", companyName: "Test" },
      owner,
      userPermissions: { owner, administrator: true },
      navigation: { current: target, href: () => "/", visit() {} },
      navigationProjection: [
        { key: "main", name: "Main", items: [{ node: target }] },
      ],
      messages: [],
    },
  });
  wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
  });
  await flushPromises();
  return model;
}
async function click(label: string) {
  const button = wrapper!
    .findAll("button")
    .find((node) => node.text() === label);
  expect(button, label).toBeDefined();
  await button!.trigger("click");
  await flushPromises();
}
it("keeps script answers on the direct model and calculates from those answers", async () => {
  const questions = reactive({
    value: {} as Record<string, string | boolean>,
    [meta]: {
      kind: "interactions" as const,
      name: "Questions",
      items: [{ kind: "input" as const, id: "factor", label: "Factor" }],
    },
  });
  const result = reactive({
    value: "",
    [meta]: { kind: "text" as const, name: "Result", readOnly: true },
  });
  const calculate = vi.fn(async () => {
    result.value = String(Number(questions.value.factor) * 3);
  });
  await render({
    questions,
    result,
    [meta]: {
      kind: "object",
      name: "Report",
      family: "report",
      operations: { calculate: { run: calculate } },
    },
  });
  await wrapper!.get('input[aria-label="Factor"]').setValue("4");
  await wrapper!.get('input[aria-label="Factor"]').trigger("change");
  expect(questions.value.factor).toBe("4");
  await click("计算");
  expect(calculate).toHaveBeenCalledTimes(1);
  expect(wrapper!.get('input[aria-label="Result"]').element).toHaveProperty(
    "value",
    "12",
  );
});
it("opens generated print content and records the explicit confirmation separately", async () => {
  const opened = vi.fn(async () => {}),
    confirmed = vi.fn(async () => {});
  const output: Node = {
    value: {
      id: "synthetic",
      title: "Preview",
      width: 100,
      height: 100,
      pages: [
        {
          key: "1",
          items: [
            {
              key: "t",
              kind: "text",
              x: 1,
              y: 1,
              width: 80,
              height: 10,
              text: "Synthetic output",
            },
          ],
        },
      ],
    },
    [meta]: {
      kind: "output",
      name: "Output",
      operations: {
        print: { run: opened },
        confirmPrinted: { run: confirmed },
      },
    },
  };
  await render({
    output,
    [meta]: { kind: "object", name: "Printing", operations: {} },
  });
  const frame = wrapper!.get("iframe");
  const print = vi.fn();
  Object.defineProperty(
    (frame.element as HTMLIFrameElement).contentWindow!,
    "print",
    { configurable: true, value: print },
  );
  await frame.trigger("load");
  await flushPromises();
  await click("打开打印窗口");
  expect(print).toHaveBeenCalledTimes(1);
  expect(opened).toHaveBeenCalledTimes(1);
  expect(confirmed).not.toHaveBeenCalled();
  await click("确认已打印");
  expect(confirmed).toHaveBeenCalledTimes(1);
});
it("submits explicit secret keep, replacement and clearing intents without an editor baseline", async () => {
  type Secret = Extract<Node, { [meta]: { kind: "secret" } }>;
  const secret = reactive({
    value: { intent: "keep" },
    [meta]: { kind: "secret", name: "API 密钥" },
  }) as unknown as Secret;
  const submitted: unknown[] = [];
  const target: ObjectNode = {
    secret,
    [meta]: {
      kind: "object",
      name: "Configuration",
      operations: {
        update: {
          async run() {
            submitted.push({ ...secret.value });
          },
        },
      },
    },
  };
  await render(target);
  await click("保存");
  expect(submitted).toEqual([{ intent: "keep" }]);
  expect(wrapper!.find('input[type="password"]').exists()).toBe(false);
  async function choose(label: string) {
    await wrapper!.get('input[aria-label="API 密钥"]').trigger("mousedown");
    await flushPromises();
    const option = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ].find((x) => x.textContent?.trim() === label);
    expect(option).toBeDefined();
    option!.click();
    await flushPromises();
  }
  await choose("修改");
  await wrapper!
    .get('input[aria-label="新的API 密钥"]')
    .setValue("synthetic-replacement");
  await click("保存");
  expect(submitted[1]).toEqual({
    intent: "replace",
    value: "synthetic-replacement",
  });
  await choose("保留");
  expect(secret.value).toEqual({ intent: "keep" });
  expect(wrapper!.find('input[type="password"]').exists()).toBe(false);
  await choose("清除");
  await click("保存");
  expect(submitted[2]).toEqual({ intent: "clear" });
  expect(wrapper!.text()).not.toContain("synthetic-replacement");
});
it("executes the existing export callback for a script download without navigating", async () => {
  const download = vi.fn(async () => {});
  const target: ObjectNode = {
    questions: {
      value: {},
      [meta]: { kind: "interactions", name: "Script result", items: [] },
    },
    [meta]: {
      kind: "object",
      family: "report",
      name: "Report export",
      operations: { export: { run: download } },
    },
  };
  const questions = target.questions as Extract<
    Node,
    { [meta]: { kind: "interactions" } }
  >;
  questions[meta].items = [
    { kind: "download", id: "file", label: "Download script result", target },
  ];
  const model = await render(target);
  const before = model[meta].navigation.current;
  await click("Download script result");
  expect(download).toHaveBeenCalledTimes(1);
  expect(model[meta].navigation.current).toBe(before);
  Reflect.get(
    (model.target as ObjectNode)[meta].operations,
    "export",
  ).disabledReason = "Unavailable";
  await flushPromises();
  expect(
    wrapper!
      .findAll("button")
      .find((b) => b.text() === "Download script result")!
      .attributes("disabled"),
  ).toBeDefined();
});
it("renders structured collection groups, exact totals and a cell drill from finite model facts", async () => {
  const detail: ObjectNode = {
    number: {
      value: "V-001",
      [meta]: { kind: "text", name: "Voucher number" },
    },
    [meta]: { kind: "object", name: "Voucher detail", operations: {} },
  };
  const row: ObjectNode = {
    name: {
      value: "Synthetic sale",
      [meta]: { kind: "text", name: "Description" },
    },
    amount: {
      value: "12345678901234567890.10",
      [meta]: { kind: "decimal", name: "Amount" },
    },
    [meta]: {
      kind: "object",
      identity: "sale-1",
      name: "Sale",
      operations: {},
    },
  };
  const collection = {
    items: [row],
    selected: null,
    draft: null,
    query: { [meta]: { kind: "object", name: "Filters", operations: {} } },
    page: 1,
    pageSize: 20,
    total: 1,
    [meta]: {
      kind: "collection",
      name: "Structured result",
      element: row,
      list: ["name", "amount"],
      operations: {},
      report: {
        summary: {
          caption: "Grand total",
          values: { amount: "12345678901234567890.10" },
        },
        presentation: {
          rows: [
            {
              rowId: "sale-1",
              appearance: { bold: true },
              cells: { amount: { align: "right" } },
            },
          ],
          groups: [
            {
              id: "sales",
              label: "Sales group",
              level: 0,
              firstKey: "sale-1",
              lastKey: "sale-1",
              continuedBefore: false,
              continuedAfter: false,
              summary: {
                caption: "Sales subtotal",
                values: { amount: "12345678901234567890.10" },
              },
            },
          ],
        },
        cells: [
          {
            row,
            field: "amount",
            kind: "record",
            target: detail,
            label: "Open voucher",
          },
        ],
      },
    },
  } as unknown as Extract<Node, { [meta]: { kind: "collection" } }>;
  const target: ObjectNode = {
    collection,
    detail,
    [meta]: {
      kind: "object",
      name: "Analysis",
      form: ["collection"],
      operations: {},
    },
  };
  const model = await render(target);
  model[meta].navigation.visit = (node) => {
    model[meta].navigation.current = node;
  };
  expect(wrapper!.text()).toContain("Sales group");
  expect(wrapper!.text()).toContain("Sales subtotal");
  expect(wrapper!.get('[aria-label="Grand total"]').text()).toContain(
    "12345678901234567890.10",
  );
  const link = wrapper!.get('a[aria-label="Open voucher"]');
  expect(link.text()).toBe("12345678901234567890.10");
  expect(link.attributes("style")).toContain("text-align: right");
  await link.trigger("click");
  await flushPromises();
  expect(
    (
      wrapper!.get('input[aria-label="Voucher number"]')
        .element as HTMLInputElement
    ).value,
  ).toBe("V-001");
});
it("allows authorized script downloads and related navigation while query answers are read-only", async () => {
  const download = vi.fn(async () => {});
  const related: ObjectNode = {
    code: {
      value: "read-only detail",
      [meta]: { kind: "text", name: "Related value" },
    },
    [meta]: {
      kind: "object",
      name: "Related record",
      operations: { get: { async run() {} } },
    },
  };
  const target: ObjectNode = {
    questions: {
      value: { answer: "fixed" },
      [meta]: {
        kind: "interactions",
        name: "Read-only interactions",
        items: [],
      },
    },
    related,
    [meta]: {
      kind: "object",
      family: "report",
      name: "Read-only report",
      form: ["questions"],
      operations: { export: { run: download } },
    },
  };
  const questions = target.questions as Extract<
    Node,
    { [meta]: { kind: "interactions" } }
  >;
  questions[meta].items = [
    { kind: "input", id: "answer", label: "Read-only answer" },
    { kind: "download", id: "file", label: "Authorized download", target },
    {
      kind: "related",
      id: "related",
      label: "Related navigation",
      target: related,
    },
  ];
  const model = await render(target);
  model[meta].userPermissions = {
    owner: model[meta].owner!,
    administrator: false,
    grants: [
      { node: target, read: true, write: false, operations: { export: true } },
      { node: related, read: true, operations: { get: true } },
    ],
  };
  model[meta].navigation.visit = (node) => {
    model[meta].navigation.current = node;
  };
  await flushPromises();
  expect(
    wrapper!.get('input[aria-label="Read-only answer"]').attributes("disabled"),
  ).toBeDefined();
  await click("Authorized download");
  expect(download).toHaveBeenCalledTimes(1);
  await click("Related navigation");
  expect(
    (
      wrapper!.get('input[aria-label="Related value"]')
        .element as HTMLInputElement
    ).value,
  ).toBe("read-only detail");
});
