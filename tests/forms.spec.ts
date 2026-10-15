import type { Component } from "vue";
import { ref, defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { it, expect, vi } from "vitest";
import {
  DynamicForm,
  ReferencePicker,
  type Fields,
  type ReferenceValue,
  type ReferenceAdapter,
} from "../src/index";
const click = async (w: ReturnType<typeof mount>, text: string) => {
  await w
    .findAll("button")
    .find((b) => b.text() === text)!
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
it("cancels a parent draft including confirmed recursive children", async () => {
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
  await click(w, "新增行");
  await w.get('input[aria-label="名称"]').setValue("父");
  await click(w, "新增子行");
  await w.get('input[aria-label="子名称"]').setValue("子");
  await click(w, "确定子项");
  expect(value.value.rows).toEqual([]);
  await click(w, "取消子项");
  expect(value.value.rows).toEqual([]);
  await click(w, "新增行");
  await w.get('input[aria-label="名称"]').setValue("确认");
  await click(w, "确定子项");
  expect(value.value.rows).toEqual([{ name: "确认", children: [] }]);
  w.unmount();
});
it("keeps historical snapshots when resolve returns changed labels and retains unavailable page-out values", async () => {
  const adapter: ReferenceAdapter = {
    search: vi.fn(async () => ({
      items: [{ id: "new", label: "新候选" }],
      hasMore: false,
    })),
    resolve: vi.fn(async () => [
      {
        id: "old",
        label: "当前新名",
        snapshot: { revision: "new" },
        selectable: false,
      },
    ]),
  };
  const selected: ReferenceValue = {
    id: "old",
    label: "历史采用名",
    snapshot: { revision: "old" },
    selectable: false,
  };
  const w = mount(ReferencePicker, {
    props: {
      adapter,
      modelValue: [selected],
      scope: "a",
      label: "引用",
      multiple: true,
    },
  });
  await flushPromises();
  expect(w.text()).toContain("历史采用名");
  expect(w.text()).not.toContain("当前新名");
  expect(w.emitted("update:modelValue")).toBeUndefined();
  await click(w, "新候选");
  expect(w.emitted("update:modelValue")?.[0]?.[0]).toEqual([
    selected,
    { id: "new", label: "新候选" },
  ]);
  w.unmount();
});
it("surfaces resolve failure and keeps selected values instead of replacing them with empty options", async () => {
  const adapter: ReferenceAdapter = {
    search: async () => ({ items: [], total: 0 }),
    resolve: async () => {
      throw new Error("读取已选失败");
    },
  };
  const w = mount(ReferencePicker, {
    props: {
      adapter,
      modelValue: { id: "old", label: "已选" },
      scope: "a",
      label: "引用",
    },
  });
  await flushPromises();
  expect(w.text()).toContain("读取已选失败");
  expect(w.text()).toContain("已选");
  expect(w.emitted("update:modelValue")).toBeUndefined();
  w.unmount();
});
it("ignores reference search and resolve responses from the previous scope", async () => {
  let finish!: (v: readonly ReferenceValue[]) => void,
    searchFinish!: (v: { items: ReferenceValue[]; total: number }) => void;
  const adapter: ReferenceAdapter = {
    search: vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (searchFinish = r)))
      .mockResolvedValue({
        items: [{ id: "new", label: "新作用域候选" }],
        total: 1,
      }),
    resolve: vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (finish = r)))
      .mockResolvedValue([]),
  };
  const w = mount(ReferencePicker, {
    props: { adapter, modelValue: null, scope: "a", label: "引用" },
  });
  await w.setProps({ scope: "b" });
  await flushPromises();
  finish([{ id: "old", label: "旧已选" }]);
  searchFinish({ items: [{ id: "old", label: "旧候选" }], total: 1 });
  await flushPromises();
  expect(w.text()).toContain("新作用域候选");
  expect(w.text()).not.toContain("旧候选");
  w.unmount();
});
it("supports single select, server paging and prevents choosing unavailable candidates", async () => {
  const adapter: ReferenceAdapter = {
    search: vi.fn(async ({ page }) => ({
      items: [
        { id: String(page), label: `候选${page}` },
        { id: "blocked", label: "禁止选择", selectable: false },
      ],
      hasMore: page === 1,
    })),
    resolve: async () => [],
  };
  const w = mount(ReferencePicker, {
    props: { adapter, modelValue: null, scope: "a", label: "引用" },
  });
  await flushPromises();
  expect(
    w
      .findAll("button")
      .find((b) => b.text() === "禁止选择")!
      .attributes("disabled"),
  ).toBeDefined();
  await click(w, "下一页引用");
  await click(w, "候选2");
  expect(w.emitted("update:modelValue")?.[0]?.[0]).toEqual({
    id: "2",
    label: "候选2",
  });
  expect(adapter.search).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2, pageSize: 20 }),
  );
  w.unmount();
});
it("aggregates pending from two references until both resolve", async () => {
  let finishA!: (v: readonly ReferenceValue[]) => void,
    finishB!: (v: readonly ReferenceValue[]) => void;
  const a: ReferenceAdapter = {
      search: async () => ({ items: [], total: 0 }),
      resolve: () => new Promise((r) => (finishA = r)),
    },
    b: ReferenceAdapter = {
      search: async () => ({ items: [], total: 0 }),
      resolve: () => new Promise((r) => (finishB = r)),
    };
  const w = mount(DynamicForm as Component, {
    props: {
      fields: [
        { key: "a", label: "A", type: "reference", adapter: a },
        { key: "b", label: "B", type: "reference", adapter: b },
      ],
      modelValue: { a: null, b: null },
      scope: "a",
    },
  });
  await flushPromises();
  expect(w.emitted("pending")?.at(-1)).toEqual([true]);
  finishA([]);
  await flushPromises();
  expect(w.emitted("pending")?.at(-1)).toEqual([true]);
  finishB([]);
  await flushPromises();
  expect(w.emitted("pending")?.at(-1)).toEqual([false]);
  w.unmount();
});
