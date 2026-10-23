import { mount } from "@vue/test-utils";
import type { Component } from "vue";
import { it, expect } from "vitest";
import { DataList } from "../src/index";
it("selects only eligible current-page identities and blocks changes while pending", async () => {
  const w = mount(DataList as Component, {
    props: {
      columns: [{ key: "id", label: "编号" }],
      result: { items: [{ id: "one" }, { id: "two" }], total: 2 },
      page: 1,
      pageSize: 20,
      rowKey: (r: { id: string }) => r.id,
      selectedKeys: [],
      selectable: (r: { id: string }) => r.id !== "two",
    },
  });
  try {
    await w.get('input[aria-label="全选当前页"]').setValue(true);
    expect(w.emitted("update:selectedKeys")?.[0]).toEqual([["one"]]);
    await w.setProps({ selectedKeys: ["one"], disabled: true });
    expect(
      w.get('input[aria-label="选择 one"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      w.get('input[aria-label="选择 two"]').attributes("disabled"),
    ).toBeDefined();
  } finally {
    w.unmount();
  }
});
