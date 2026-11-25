import { afterEach, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import type { Collection, InteractionNode } from "../src/model";
import { fixture, object } from "./fixtures/static-model";
import { click, input, render } from "./fixtures/static-host";

let wrapper: Awaited<ReturnType<typeof render>> | undefined;
const originalWidth = window.innerWidth;
function viewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  viewport(originalWidth);
  document.body.innerHTML = "";
});

it("presents a mobile read-only text value in a wrapping labeled field", async () => {
  viewport(390);
  const { model, record, name } = fixture();
  record.readOnly = true;
  record.operations.update!.disabled = true;
  name.value = "需要完整阅读的单据内容".repeat(30);
  wrapper = await render(model);
  await click("查看");

  const value = input("名称").element;
  expect(value.readOnly).toBe(true);
  expect(value.value).toBe(name.value);
  expect(value).toBeInstanceOf(HTMLTextAreaElement);

  viewport(1440);
  await flushPromises();
  expect(input("名称").element).toBeInstanceOf(HTMLInputElement);
});

it("shows the target collection title after following a related link inside a domain", async () => {
  const { model, record, rows } = fixture();
  const invoices: Collection = reactive({
    ...rows,
    key: "invoices",
    label: "发票",
    conditions: object("invoice-conditions", "查询条件"),
    items: [],
    operations: {},
  });
  model.members = [
    { kind: "domain", key: "ledger", label: "账务", members: [rows, invoices] },
  ];
  const links: InteractionNode = {
    kind: "interactions",
    key: "related",
    label: "关联",
    readOnly: true,
    value: {},
    items: [
      {
        id: "invoices",
        kind: "related",
        label: "查看关联发票",
        target: { collection: invoices },
      },
    ],
  };
  record.members.push(links);
  wrapper = await render(model);
  await click("编辑");
  const dialog = document.querySelector('[role="dialog"]')!;
  const link = dialog.querySelector<HTMLAnchorElement>('a[href="/invoices"]')!;
  expect(link.textContent?.trim()).toBe("查看关联发票");
  link.click();
  await flushPromises();

  expect(model.navigation.current).toBe(invoices);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(wrapper.get("h1").text()).toBe("账务");
  expect(wrapper.get('[role="tabpanel"] h2').text()).toBe("发票");
});
