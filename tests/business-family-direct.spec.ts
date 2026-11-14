import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import { modelMetadata as meta, type BusinessModel } from "../src/model";
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
  await click("calculate");
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
