import { defineComponent, h, ref, type Component } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { VoucherEditor, type VoucherEditorValue } from "../src/index";

type Header = { supplier: string; date: string };
type Row = { id: string; name: string; quantity: string };
const initial: VoucherEditorValue<Header, Row> = {
  header: { supplier: "合成供应商", date: "2026-10-20" },
  rows: [{ id: "one", name: "合成商品", quantity: "9007199254740993.0100" }],
};
function editor(mode: "read" | "edit" = "edit") {
  const value = ref<VoucherEditorValue<Header, Row>>(structuredClone(initial));
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(VoucherEditor as Component, {
          modelValue: value.value,
          scope: "synthetic",
          mode,
          headerFields: [
            { key: "supplier", label: "供应商", type: "text" },
            { key: "date", label: "单据日期", type: "date" },
          ],
          rowFields: [
            { key: "name", label: "品名", type: "text" },
            { key: "quantity", label: "数量", type: "decimal" },
          ],
          columns: [
            { key: "name", label: "品名" },
            { key: "quantity", label: "数量", type: "decimal" },
          ],
          rowKey: (row: Row) => row.id,
          emptyRow: () => ({ id: "two", name: "", quantity: "" }),
          "onUpdate:modelValue": (next: VoucherEditorValue<Header, Row>) =>
            (value.value = next),
        }),
    }),
  );
  return { wrapper, value };
}
async function click(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper
    .findAll("button")
    .find((b) => b.text() === text)!
    .trigger("click");
  await flushPromises();
}
it("shows a voucher header and detail table and edits a row without changing decimal text", async () => {
  const { wrapper, value } = editor();
  expect(wrapper.get('input[aria-label="供应商"]').element).toHaveProperty(
    "value",
    "合成供应商",
  );
  expect(wrapper.find("table").text()).toContain("9007199254740993.0100");
  await wrapper.get('input[aria-label="供应商"]').setValue("合成供应商乙");
  expect(value.value.header.supplier).toBe("合成供应商乙");
  await click(wrapper, "编辑明细行 1");
  await wrapper.get('input[aria-label="品名"]').setValue("修改品名");
  await click(wrapper, "取消明细行");
  expect(value.value.rows[0].name).toBe("合成商品");
  await click(wrapper, "编辑明细行 1");
  await wrapper.get('input[aria-label="品名"]').setValue("修改品名");
  await click(wrapper, "确定明细行");
  expect(value.value.rows).toEqual([
    { id: "one", name: "修改品名", quantity: "9007199254740993.0100" },
  ]);
  wrapper.unmount();
});
it("shows the same details without editing actions in read mode", () => {
  const { wrapper } = editor("read");
  expect(wrapper.find("table").text()).toContain("合成商品");
  expect(wrapper.findAll("button")).toHaveLength(0);
  expect(wrapper.findAll("input")).toHaveLength(0);
  expect(wrapper.get('[aria-label="单据表头"]').text()).toContain("合成供应商");
  wrapper.unmount();
});
it("adds and confirms deletion of a detail row", async () => {
  const { wrapper, value } = editor();
  await click(wrapper, "新增明细行");
  await wrapper.get('input[aria-label="品名"]').setValue("第二商品");
  await click(wrapper, "确定明细行");
  expect(value.value.rows).toHaveLength(2);
  await click(wrapper, "删除明细行 1");
  expect(value.value.rows).toHaveLength(2);
  await click(wrapper, "确认删除明细行 1");
  expect(value.value.rows.map((row) => row.id)).toEqual(["two"]);
  wrapper.unmount();
});
type Formula = { material: string; amount: string };
type FormulaRow = Row & { formula: Formula[] };
function formulaEditor(mode: "read" | "edit" = "edit") {
  const value = ref<VoucherEditorValue<Header, FormulaRow>>({
    header: initial.header,
    rows: [
      { id: "one", name: "甲", quantity: "1", formula: [] },
      { id: "two", name: "乙", quantity: "2", formula: [] },
    ],
  });
  const scope = ref("synthetic");
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(VoucherEditor as Component, {
          modelValue: value.value,
          scope: scope.value,
          mode,
          headerFields: [],
          rowFields: [{ key: "name", label: "品名", type: "text" }],
          columns: [
            { key: "name", label: "品名" },
            {
              key: "formula",
              label: "配方",
              type: "children",
              fields: [
                { key: "material", label: "原料", type: "text" },
                { key: "amount", label: "用量", type: "decimal" },
              ],
              empty: () => ({ material: "", amount: "" }),
              summary: (children: readonly Formula[]) =>
                `${children.length} 项`,
            },
          ],
          rowKey: (row: FormulaRow) => row.id,
          emptyRow: () => ({ id: "new", name: "", quantity: "", formula: [] }),
          "onUpdate:modelValue": (
            next: VoucherEditorValue<Header, FormulaRow>,
          ) => (value.value = next),
        }),
    }),
    { attachTo: document.body },
  );
  return { wrapper, value, scope };
}
it("edits only the selected row's formula children and discards cancelled changes", async () => {
  const { wrapper, value } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 2");
  await click(wrapper, "新增配方");
  await wrapper.get('input[aria-label="原料"]').setValue("合成原料");
  await wrapper.get('input[aria-label="用量"]').setValue("0.0100");
  await click(wrapper, "确定子项");
  await click(wrapper, "取消配方");
  expect(value.value.rows[1].formula).toEqual([]);
  await click(wrapper, "编辑配方 · 明细行 2");
  await click(wrapper, "新增配方");
  await wrapper.get('input[aria-label="原料"]').setValue("合成原料");
  await wrapper.get('input[aria-label="用量"]').setValue("0.0100");
  await click(wrapper, "确定子项");
  await click(wrapper, "确定配方");
  expect(value.value.rows[0].formula).toEqual([]);
  expect(value.value.rows[1].formula).toEqual([
    { material: "合成原料", amount: "0.0100" },
  ]);
  expect(wrapper.find("table").text()).toContain("1 项");
  wrapper.unmount();
});
it("discards an open formula draft on scope change and allows read-only inspection", async () => {
  const { wrapper, value, scope } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 2");
  await click(wrapper, "新增配方");
  await wrapper.get('input[aria-label="原料"]').setValue("迟到原料");
  scope.value = "other";
  await flushPromises();
  expect(
    wrapper.find('[role="dialog"][aria-label="配方 · 明细行 2"]').exists(),
  ).toBe(false);
  expect(value.value.rows[1].formula).toEqual([]);
  wrapper.unmount();
  const read = formulaEditor("read");
  await click(read.wrapper, "查看配方 · 明细行 1");
  expect(
    read.wrapper.find('[role="dialog"][aria-label="配方 · 明细行 1"]').exists(),
  ).toBe(true);
  expect(
    read.wrapper.findAll("button").some((b) => b.text() === "确定配方"),
  ).toBe(false);
  read.wrapper.unmount();
});
it("moves focus into the formula dialog and restores it on close", async () => {
  const { wrapper } = formulaEditor();
  const trigger = wrapper
    .findAll("button")
    .find((b) => b.text() === "编辑配方 · 明细行 1")!;
  await trigger.trigger("click");
  await flushPromises();
  expect(document.activeElement?.textContent).toContain("取消配方");
  await click(wrapper, "取消配方");
  expect(document.activeElement).toBe(trigger.element);
  wrapper.unmount();
});
it("keeps the formula draft pending while a child row is being edited", async () => {
  const { wrapper, value } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 1");
  await click(wrapper, "新增配方");
  expect(
    wrapper
      .findAll("button")
      .find((b) => b.text() === "确定配方")!
      .attributes("disabled"),
  ).toBeDefined();
  await click(wrapper, "取消子项");
  await click(wrapper, "确定配方");
  expect(value.value.rows[0].formula).toEqual([]);
  wrapper.unmount();
});
it("drops a formula draft if the parent rows change while it is open", async () => {
  const { wrapper, value } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 1");
  value.value = { ...value.value, rows: [...value.value.rows].reverse() };
  await flushPromises();
  expect(
    wrapper.find('[role="dialog"][aria-label="配方 · 明细行 1"]').exists(),
  ).toBe(false);
  expect(value.value.rows.map((row) => row.formula)).toEqual([[], []]);
  wrapper.unmount();
});
it("reports unfinished local row input until it is confirmed or discarded", async () => {
  const { wrapper, value } = editor();
  await click(wrapper, "编辑明细行 1");
  const component = wrapper.findComponent({ name: "VoucherEditor" });
  expect(component.emitted("pending")?.at(-1)).toEqual([true]);
  await wrapper.get('input[aria-label="品名"]').setValue("未确认的输入");
  expect(value.value.rows[0].name).toBe("合成商品");
  await click(wrapper, "取消明细行");
  expect(component.emitted("pending")?.at(-1)).toEqual([false]);
  wrapper.unmount();
});
