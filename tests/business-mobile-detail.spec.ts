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

it("closes a record from its title area and returns focus without clearing the query", async () => {
  const { model, rows, record, term } = fixture();
  viewport(390);
  record.readOnly = true;
  rows.page = 2;
  rows.total = 21;
  term.value = "保留的条件";
  wrapper = await render(model);
  const view = wrapper.get<HTMLButtonElement>('button[aria-label="查看"]');
  view.element.focus();
  await view.trigger("click");
  await flushPromises();

  const dialog = document.querySelector('[role="dialog"]')!;
  const title = dialog.querySelector("header")!;
  expect(title.textContent).toContain("记录");
  const close = Array.from(title.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "关闭",
  );
  expect(close).toBeDefined();
  close!.click();
  await flushPromises();

  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(view.element);
  expect(input("条件").element.value).toBe("保留的条件");
  expect(rows.page).toBe(2);
  expect(rows.selected).toBeNull();
});

it("presents a mobile read-only text value in a wrapping labeled field", async () => {
  viewport(390);
  const { model, record, name } = fixture();
  record.readOnly = true;
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
