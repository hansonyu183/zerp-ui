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

it.each([1440, 390])(
  "shares ordered readable detail members at width %i",
  async (width) => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
    try {
      const { model, rows: collection, record, owner } = fixture();
      const first = object("one", "第一项", [
        field("z-note", "备注", ""),
        field("a-quantity", "数量", "0"),
        field("hidden", null, "标签隐藏值"),
        field("restricted", "权限字段", "第一行的值"),
      ]);
      const second = object("two", "第二项", [
        field("z-note", "备注", "次行"),
        field("a-quantity", "数量", "2"),
        field("hidden", null, "另一个标签隐藏值"),
        field("restricted", "权限字段", "第二行的值"),
      ]);
      const detail: RecordsNode = {
        kind: "records",
        key: "lines",
        label: "明细",
        readOnly: false,
        items: [],
        selected: null,
        operations: {},
      };
      record.members.push(detail);
      model.session.userPermissions = {
        owner,
        administrator: false,
        grants: [
          {
            node: collection,
            read: true,
            write: true,
            operations: { update: true },
          },
          {
            node: second.members[3]!,
            read: false,
            write: false,
            operations: {},
          },
        ],
      };
      wrapper = await render(model);
      await click("编辑");
      const view = () => document.querySelector(".zerp-direct-records")!;
      expect(view().textContent).toContain("暂无记录");
      expect(view().querySelector("table, article")).toBeNull();

      const records = record.members.at(-1) as RecordsNode;
      records.items = [first, second];
      await flushPromises();
      const selector =
        width === 390 ? "article:first-child .zerp-owned-field > span" : "th";
      expect(
        Array.from(view().querySelectorAll(selector), (label) =>
          label.textContent?.trim(),
        ),
      ).toEqual(["备注", "数量"]);
      expect(input("备注").element.value).toBe("");
      expect(input("数量").element.value).toBe("0");
      expect(view().textContent).not.toMatch(
        /权限字段|隐藏值|行成员定义不一致/,
      );

      second.members.pop();
      await flushPromises();
      const error = document.querySelector('[role="alert"]');
      expect(error?.textContent).toContain(
        "第 1 项与第 2 项的行成员定义不一致",
      );
      expect(error?.textContent).not.toMatch(/权限字段|restricted/);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: previousWidth,
      });
      window.dispatchEvent(new Event("resize"));
    }
  },
);
