import type { Component } from "vue";
import { ref, defineComponent, h } from "vue";
import { mount, flushPromises, DOMWrapper } from "@vue/test-utils";
import { it, expect, vi } from "vitest";
import {
  validateFields,
  type Fields,
  type ReferenceValue,
  type ReferenceAdapter,
} from "./fixtures/assembly";
import DynamicForm from "../src/DynamicForm.vue";
import ReferencePicker from "../src/ReferencePicker.vue";
const click = async (
  w: ReturnType<typeof mount> | DOMWrapper<Element>,
  text: string,
) => {
  await w
    .findAll("button")
    .find(
      (b) =>
        b.text() === text &&
        (text !== "新增" || b.attributes("disabled") === undefined),
    )!
    .trigger("click");
  await flushPromises();
};
function form<T extends object>(fields: Fields<T>, initial: T) {
  const value = ref(initial);
  const w = mount(
    defineComponent({
      setup: () => () =>
        h(DynamicForm as Component, {
          fields,
          modelValue: value.value,
          scope: "a",
          "onUpdate:modelValue": (next: T) => (value.value = next),
        }),
    }),
  );
  return { w, value };
}
it("keeps decimal strings and incomplete numeric input, zero, false and null distinct", async () => {
  const { w, value } = form<{
    amount: string;
    count: number | null;
    enabled: boolean;
    empty: string | null;
  }>(
    [
      { key: "amount", type: "decimal", label: "金额" },
      { key: "count", type: "integer", label: "数量" },
      { key: "enabled", type: "boolean", label: "启用" },
      { key: "empty", type: "text", label: "空值" },
    ],
    { amount: "0", count: 0, enabled: false, empty: null },
  );
  await w.get('input[aria-label="金额"]').setValue("-");
  expect(value.value.amount).toBe("-");
  await w
    .get('input[aria-label="金额"]')
    .setValue("123456789012345678.123456789012345678");
  expect(value.value.amount).toBe("123456789012345678.123456789012345678");
  await w.get('input[aria-label="数量"]').setValue("-");
  expect(w.get('input[aria-label="数量"]').element).toHaveProperty(
    "value",
    "-",
  );
  expect(value.value.count).toBe(0);
  expect(value.value.enabled).toBe(false);
  expect(value.value.empty).toBeNull();
  w.unmount();
});
it("edits recursive rows directly and removes their entire subtree", async () => {
  type D = { rows: { name: string; children: { name: string }[] }[] };
  const { w, value } = form<D>(
    [
      {
        key: "rows",
        type: "rows",
        label: "行",
        empty: () => ({ name: "", children: [] }),
        fields: [
          { key: "name", type: "text", label: "名称" },
          {
            key: "children",
            type: "rows",
            label: "子行",
            empty: () => ({ name: "" }),
            fields: [{ key: "name", type: "text", label: "子名称" }],
          },
        ],
      },
    ],
    { rows: [] },
  );
  await click(w, "新增");
  await w.get('input[aria-label="名称"]').setValue("父");
  await click(w, "新增");
  await w.get('input[aria-label="子名称"]').setValue("子");
  expect(value.value.rows).toEqual([
    { name: "父", children: [{ name: "子" }] },
  ]);
  await click(w, "删除行 1");
  expect(value.value.rows).toEqual([]);
  await click(w, "新增");
  await w.get('input[aria-label="名称"]').setValue("确认");
  expect(value.value.rows).toEqual([{ name: "确认", children: [] }]);
  w.unmount();
});
it("keeps historical snapshots and toggles multiple values in the same dropdown", async () => {
  const selected: ReferenceValue = {
    id: "old",
    label: "历史采用名",
    snapshot: { revision: "old" },
    selectable: false,
  };
  const adapter: ReferenceAdapter = {
    directory: {},
    load: vi.fn(async () => [
      { id: "new", label: "新候选" },
      { id: "old", label: "当前新名", selectable: false },
    ]),
  };
  const value = ref<readonly ReferenceValue[]>([selected]);
  const w = mount(
    defineComponent({
      setup: () => () =>
        h(ReferencePicker, {
          adapter,
          modelValue: value.value,
          scope: "a",
          label: "引用",
          multiple: true,
          "onUpdate:modelValue": (next) =>
            (value.value = next as readonly ReferenceValue[]),
        }),
    }),
    { attachTo: document.body },
  );
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  expect(document.body.textContent).toContain("历史采用名");
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.includes("新候选"))!;
  option.click();
  await flushPromises();
  expect(value.value).toEqual([selected, { id: "new", label: "新候选" }]);
  option.click();
  await flushPromises();
  expect(value.value).toEqual([selected]);
  w.unmount();
});
it("retries a failed complete directory without losing historical selections", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("读取候选失败"))
    .mockResolvedValue([{ id: "new", label: "新候选" }]);
  const w = mount(ReferencePicker, {
    attachTo: document.body,
    props: {
      adapter: { directory: {}, load },
      modelValue: { id: "old", label: "历史" },
      scope: "a",
      label: "引用",
    },
  });
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  expect(document.body.textContent).toContain("读取候选失败");
  expect(document.body.textContent).toContain("历史");
  await click(new DOMWrapper(document.body), "重试引用");
  expect(document.body.textContent).toContain("新候选");
  expect(load).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("ignores a late directory after owner change and does not preload unused fields", async () => {
  let finish!: (v: readonly ReferenceValue[]) => void;
  const load = vi
    .fn()
    .mockImplementationOnce(() => new Promise((r) => (finish = r)))
    .mockResolvedValue([{ id: "new", label: "新作用域候选" }]);
  const w = mount(ReferencePicker, {
    attachTo: document.body,
    props: {
      adapter: { directory: {}, load },
      modelValue: null,
      scope: "a",
      label: "引用",
    },
  });
  await flushPromises();
  expect(load).not.toHaveBeenCalled();
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  await w.setProps({ scope: "b" });
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  finish([{ id: "old", label: "旧候选" }]);
  await flushPromises();
  expect(document.body.textContent).toContain("新作用域候选");
  expect(document.body.textContent).not.toContain("旧候选");
  w.unmount();
});
it("paginates a complete local directory and prevents unavailable choices", async () => {
  const load = vi.fn(async () => [
    { id: "blocked", label: "禁止选择", selectable: false },
    ...Array.from({ length: 44 }, (_, i) => ({
      id: String(i),
      label: `候选${i}`,
    })),
  ]);
  const w = mount(ReferencePicker, {
    attachTo: document.body,
    props: {
      adapter: { directory: {}, load },
      modelValue: null,
      scope: "a",
      label: "引用",
    },
  });
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  const blocked = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.includes("禁止选择"))!;
  blocked.click();
  await flushPromises();
  expect(w.emitted("update:modelValue")).toBeUndefined();
  await click(new DOMWrapper(document.body), "下一页引用");
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.trim() === "候选20")!;
  option.click();
  await flushPromises();
  expect(w.emitted("update:modelValue")?.[0]?.[0]).toMatchObject({
    id: "20",
    label: "候选20",
  });
  expect(load).toHaveBeenCalledOnce();
  w.unmount();
});
it("adopts controlled integers without remounting and retains incomplete local input until adoption", async () => {
  const { w, value } = form<{ count: number | null }>(
    [{ key: "count", type: "integer", label: "数量" }],
    { count: 0 },
  );
  const input = w.get('input[aria-label="数量"]');
  await input.setValue("12");
  expect(value.value.count).toBe(12);
  value.value = { count: 20 };
  await flushPromises();
  expect(input.element).toHaveProperty("value", "20");
  await input.setValue("-");
  expect(value.value.count).toBe(20);
  expect(input.element).toHaveProperty("value", "-");
  value.value = { count: null };
  await flushPromises();
  expect(input.element).toHaveProperty("value", "");
  value.value = { count: 0 };
  await flushPromises();
  expect(input.element).toHaveProperty("value", "0");
  w.unmount();
});
it("publishes shared field validation with visible feedback separately from unfinished input", async () => {
  const fields: Fields<{ name: string; count: number | null }> = [
    {
      key: "name",
      type: "text",
      label: "名称",
      required: true,
      minLength: 2,
      maxLength: 4,
    },
    { key: "count", type: "integer", label: "数量", min: 0, max: 20 },
  ];
  const { w, value } = form(fields, { name: "", count: 0 });
  const component = w.findComponent(DynamicForm as Component);
  expect(component.emitted("validation")?.at(-1)?.[0]).toMatchObject({
    valid: false,
    pending: false,
    issues: [{ key: "name" }],
  });
  expect(w.text()).toContain("请填写名称");
  await w.get('input[aria-label="名称"]').setValue("甲");
  expect(w.text()).toContain("名称长度应为至少 2 字符");
  await w.get('input[aria-label="名称"]').setValue("甲乙");
  expect(component.emitted("validation")?.at(-1)?.[0]).toMatchObject({
    valid: true,
    pending: false,
  });
  await w.get('input[aria-label="数量"]').setValue("-");
  expect(component.emitted("validation")?.at(-1)?.[0]).toMatchObject({
    valid: true,
    pending: true,
  });
  await w.get('input[aria-label="数量"]').setValue("21");
  expect(value.value.count).toBe(21);
  expect(component.emitted("validation")?.at(-1)?.[0]).toMatchObject({
    valid: false,
    pending: false,
  });
  expect(w.text()).toContain("数量应为有效整数");
  w.unmount();
});

it("validates exact field values through the public engine while retaining readonly history", async () => {
  type Draft = {
    amount: string;
    date: string;
    tags: string[];
    reference: ReferenceValue | null;
  };
  const fields: Fields<Draft> = [
    { key: "amount", type: "decimal", label: "金额" },
    { key: "date", type: "date", label: "日期" },
    {
      key: "tags",
      type: "multi-enum",
      label: "类别",
      options: [{ value: "a", label: "甲" }],
    },
    {
      key: "reference",
      type: "reference",
      label: "引用",
      adapter: {
        directory: {},
        load: async () => [],
      },
    },
  ];
  const values: Draft = {
    amount: "9007199254740993.0100",
    date: "2024-02-29",
    tags: ["a"],
    reference: { id: "old", label: "历史名", snapshot: { revision: "old" } },
  };
  expect(validateFields(fields, values).valid).toBe(true);
  expect(
    validateFields(fields, {
      ...values,
      amount: "1.",
      date: "2025-02-29",
      tags: ["unknown"],
    }).issues.map((issue) => issue.key),
  ).toEqual(["amount", "date", "tags"]);
  expect(
    validateFields([{ ...fields[2]!, readonly: true }], {
      ...values,
      tags: ["unknown"],
    }).valid,
  ).toBe(true);
  const { w, value } = form<{ tags: string[]; choice: string }>(
    [
      {
        key: "tags",
        type: "multi-enum",
        label: "多选",
        options: [
          { value: "a", label: "甲" },
          { value: "b", label: "乙" },
        ],
      },
      {
        key: "choice",
        type: "enum",
        label: "单选",
        options: [
          { value: "a", label: "甲" },
          { value: "b", label: "乙" },
        ],
      },
    ],
    { tags: ["a", "b"], choice: "b" },
  );
  expect(w.get('input[aria-label="多选"]').element).toHaveProperty(
    "value",
    "甲, 乙",
  );
  expect(w.get('input[aria-label="单选"]').element).toHaveProperty(
    "value",
    "乙",
  );
  value.value = { tags: ["b"], choice: "a" };
  await flushPromises();
  expect(w.get('input[aria-label="多选"]').element).toHaveProperty(
    "value",
    "乙",
  );
  expect(w.get('input[aria-label="单选"]').element).toHaveProperty(
    "value",
    "甲",
  );
  w.unmount();
});

it("blocks invalid child drafts and preserves readonly historical values without applying edit constraints", async () => {
  const { w, value } = form<{
    rows: { name: string }[];
    history: string;
    oldDate: string;
  }>(
    [
      {
        key: "rows",
        type: "rows",
        label: "行",
        empty: () => ({ name: "" }),
        fields: [
          { key: "name", type: "text", label: "子名称", required: true },
        ],
      },
      {
        key: "history",
        type: "enum",
        label: "历史类别",
        readonly: true,
        required: true,
        options: [],
      },
      { key: "oldDate", type: "date", label: "历史日期", readonly: true },
    ],
    { rows: [], history: "retired", oldDate: "legacy-date" },
  );
  expect(w.get('input[aria-label="历史类别"]').element).toHaveProperty(
    "value",
    "retired",
  );
  expect(w.get('input[aria-label="历史日期"]').element).toHaveProperty(
    "value",
    "legacy-date",
  );
  await click(w, "新增");
  expect(
    w
      .findComponent(DynamicForm as Component)
      .emitted("validation")
      ?.at(-1)?.[0],
  ).toMatchObject({ valid: false });
  await w.get('input[aria-label="子名称"]').setValue("合成子项");
  expect(value.value.rows).toEqual([{ name: "合成子项" }]);
  w.unmount();
});
it("clears unfinished integer state when its context or visible field is replaced", async () => {
  const fields: Fields<{ count: number | null; show: boolean }> = [
    { key: "show", label: "显示", type: "boolean" },
    {
      key: "count",
      label: "整数",
      type: "integer",
      when: { key: "show", equals: true },
    },
  ];
  const w = mount(DynamicForm as Component, {
    props: { fields, modelValue: { count: 12, show: true }, scope: "one" },
  });
  await w.get('input[aria-label="整数"]').setValue("-");
  expect(w.emitted("pending")?.at(-1)).toEqual([true]);
  await w.setProps({ modelValue: { count: 12, show: false } });
  expect(w.emitted("pending")?.at(-1)).toEqual([false]);
  await w.setProps({ modelValue: { count: 12, show: true } });
  expect(w.get('input[aria-label="整数"]').element).toHaveProperty(
    "value",
    "12",
  );
  await w.get('input[aria-label="整数"]').setValue("-");
  await w.setProps({ scope: "two", modelValue: { count: 7, show: true } });
  expect(w.get('input[aria-label="整数"]').element).toHaveProperty(
    "value",
    "7",
  );
  expect(w.emitted("pending")?.at(-1)).toEqual([false]);
  await w.setProps({
    fields: [
      { key: "count", type: "integer", label: "整数", readonly: true, min: 10 },
    ],
  });
  expect(
    w.get('input[aria-label="整数"]').attributes("disabled"),
  ).toBeDefined();
  expect(w.emitted("validation")?.at(-1)?.[0]).toMatchObject({
    valid: true,
    pending: false,
  });
  w.unmount();
});

it("keeps unfinished input attached to its row when a preceding row is deleted", async () => {
  const { w, value } = form<{ rows: { count: number | null }[] }>(
    [
      {
        key: "rows",
        type: "rows",
        label: "数量行",
        fields: [{ key: "count", type: "integer", label: "行数量" }],
        empty: () => ({ count: 0 }),
      },
    ],
    { rows: [{ count: 1 }, { count: 2 }] },
  );
  await w.findAll('input[aria-label="行数量"]')[1].setValue("-");
  await click(w, "删除数量行 1");
  expect(w.get('input[aria-label="行数量"]').element).toHaveProperty(
    "value",
    "-",
  );
  expect(value.value.rows).toEqual([{ count: 2 }]);
  expect(
    w
      .findComponent(DynamicForm as Component)
      .emitted("pending")
      ?.at(-1),
  ).toEqual([true]);
  await w.get('input[aria-label="行数量"]').setValue("0");
  expect(value.value.rows).toEqual([{ count: 0 }]);
  expect(
    w
      .findComponent(DynamicForm as Component)
      .emitted("pending")
      ?.at(-1),
  ).toEqual([false]);
  w.unmount();
});
