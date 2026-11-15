import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { fixture, field, object, operation } from "./fixtures/static-model";
import { render, click, input } from "./fixtures/static-host";
import type { RecordsNode } from "../src/model";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("uses ordered Material groups and keeps input when switching tabs", async () => {
  const { model, record } = fixture();
  const first = field("first", "第一字段", "one"),
    second = field("second", "第二字段", "two");
  record.members = [
    object("second-group", "第二组", [second]),
    object("first-group", "第一组", [first]),
    object("hidden-group", "隐藏组", [field("secret", "不可见", "hidden")]),
  ];
  record.members[2]!.label = null;
  wrapper = await render(model);
  await click("编辑");
  const tabs = Array.from(
    document.querySelectorAll<HTMLElement>('[role="tab"]'),
  );
  expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
    "第二组",
    "第一组",
  ]);
  expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
  await input("第二字段").setValue("changed");
  tabs[1]!.click();
  await flushPromises();
  tabs[0]!.click();
  await flushPromises();
  expect(input("第二字段").element.value).toBe("changed");
  expect(document.body.textContent).not.toContain("不可见");
});
it("does not manufacture Tabs for zero or a single visible group", async () => {
  const { model, record } = fixture();
  record.members = [object("only", "唯一组", [field()])];
  wrapper = await render(model);
  await click("编辑");
  expect(document.querySelector('[role="tablist"]')).toBeNull();
  expect(input("名称").exists()).toBe(true);
  record.members = [];
  await flushPromises();
  expect(document.querySelector('[role="tablist"]')).toBeNull();
});
it("keeps owned detail edits local until the parent save", async () => {
  const { model, record } = fixture();
  const quantity = field("quantity", "数量", "2");
  const rows: RecordsNode = {
    kind: "records",
    key: "lines",
    label: "明细",
    readOnly: false,
    columns: [{ key: "quantity", label: "数量" }],
    items: [object("line", "明细行", [quantity])],
    selected: null,
    operations: {
      create: operation(
        vi.fn(async () => {
          rows.items.push(
            object("new", "明细行", [field("quantity", "数量", "1")]),
          );
        }),
      ),
    },
  };
  record.members = [rows];
  wrapper = await render(model);
  await click("编辑");
  await input("数量").setValue("3");
  expect(quantity.value).toBe("3");
  expect(record.operations.update!.run).not.toHaveBeenCalled();
  await click("保存");
  expect(record.operations.update!.run).toHaveBeenCalledTimes(1);
});
