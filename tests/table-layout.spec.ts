import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DataList from "../src/DataList.vue";

const row = { id: "one", amount: "12.34", detail: "详情", settings: "设置" };
const props = {
  columns: [
    { key: "id", label: "编号" },
    { key: "amount", label: "金额", type: "decimal", width: "20rem" },
    { key: "detail", label: "详情", role: "action" },
    { key: "settings", label: "设置", role: "action" },
  ],
  result: { items: [row], total: 1 },
  page: 1,
  pageSize: 20,
  rowKey: (r: typeof row) => r.id,
  summary: { caption: "合计", values: { amount: "12.34" } },
  presentation: {
    rows: [],
    groups: [
      {
        id: "g",
        label: "组",
        level: 0,
        firstKey: "one",
        lastKey: "one",
        continuedBefore: false,
        continuedAfter: false,
        summary: { caption: "小计", values: { amount: "12.34" } },
      },
    ],
  },
  cell: (_r: typeof row, key: string) =>
    key === "detail" || key === "settings"
      ? {
          kind: "detail",
          label: key === "detail" ? "客户详情" : "客户设置",
          target: key,
        }
      : undefined,
};

describe("compact table actions", () => {
  for (const selectedKeys of [undefined, []]) {
    it(`places one operation column physically second with selection=${!!selectedKeys}`, async () => {
      const w = mount(DataList as Component, {
        attachTo: document.body,
        props: { ...props, selectedKeys },
      });
      try {
        const headers = w.findAll("thead th");
        expect(headers[1]!.text()).toBe("操作");
        expect(headers.filter((h) => h.text() === "操作")).toHaveLength(1);
        expect(w.find(".zerp-report-group th").attributes("colspan")).toBe(
          String(headers.length),
        );
        const grouped = w.get(".zerp-report-group-summary").findAll("td");
        expect(grouped).toHaveLength(headers.length);
        expect(grouped[1]!.text()).toBe("");
        expect(grouped[grouped.length - 1]!.text()).toBe("12.34");
        const total = w.findAll("tfoot td");
        expect(total).toHaveLength(headers.length);
        expect(total[1]!.text()).toBe("");
        expect(total[total.length - 1]!.text()).toBe("12.34");
        await w.get('[aria-label="客户详情"]').trigger("click");
        expect(w.emitted("cell")?.[0]?.[0]).toMatchObject({ target: "detail" });
        await w.get('[aria-label="更多操作"]').trigger("click");
        await flushPromises();
        const item = document.querySelector('[role="menuitem"]') as HTMLElement;
        expect(item.textContent).toContain("客户设置");
        item.click();
        await flushPromises();
        expect(w.emitted("cell")?.[1]?.[0]).toMatchObject({
          target: "settings",
        });
      } finally {
        w.unmount();
      }
    });
  }
});
