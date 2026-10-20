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
  expect(
    wrapper.get('input[aria-label="供应商"]').attributes("disabled"),
  ).toBeDefined();
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
