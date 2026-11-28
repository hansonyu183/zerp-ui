import "./fixtures/private-vuetify";
import type { Component } from "vue";
import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import DataList from "../src/app/work/views/list/DataList.vue";

it("renders finite presentation and authoritative group segments using exact numeric and string row identities", async () => {
  const w = mount(DataList as Component, {
    props: {
      columns: [{ key: "amount", label: "金额" }],
      result: {
        items: [
          { id: 1, amount: "1.00" },
          { id: "1", amount: "2.00" },
        ],
        total: 2,
      },
      rowKey: (row: { id: string | number }) => row.id,
      page: 1,
      pageSize: 2,
      presentation: {
        rows: [
          {
            rowId: 1,
            appearance: { foreground: "#112233", bold: true },
            cells: { amount: { bold: false, italic: true, align: "right" } },
          },
          { rowId: "1", cells: { amount: { background: "#ddeeff" } } },
        ],
        groups: [
          {
            id: "outer",
            label: "全部",
            level: 0,
            firstKey: 1,
            lastKey: "1",
            continuedBefore: true,
            continuedAfter: true,
            summary: { caption: "权威全组", values: { amount: "99.00" } },
          },
          {
            id: "inner",
            label: "子组",
            level: 1,
            firstKey: 1,
            lastKey: 1,
            continuedBefore: true,
            continuedAfter: false,
            summary: { caption: "权威子组", values: { amount: "44.00" } },
          },
        ],
      },
    },
  });
  try {
    expect(w.findAll("tbody th").map((node) => node.text())).toEqual([
      "全部（续）",
      "子组（续）",
    ]);
    const cells = w.findAll('td[data-label="金额"]');
    expect(cells[0]!.attributes("style")).toContain("color: rgb(17, 34, 51)");
    expect(cells[0]!.attributes("style")).toContain("font-weight: normal");
    expect(cells[0]!.attributes("style")).toContain("font-style: italic");
    expect(cells[0]!.attributes("style")).toContain("text-align: right");
    expect(w.text()).toContain("权威全组（续）99.00");
    expect(w.text()).toContain("权威子组44.00");
    expect(
      cells.find((cell) => cell.text() === "2.00")!.attributes("style"),
    ).toContain("background-color: rgb(221, 238, 255)");
  } finally {
    w.unmount();
  }
});

const validPresentation = () => ({
  rows: [{ rowId: "r1", cells: { amount: { foreground: "#112233" } } }],
  groups: [
    {
      id: "group",
      label: "分组",
      level: 0,
      firstKey: "r1",
      lastKey: "r2",
      continuedBefore: false,
      continuedAfter: false,
      summary: { caption: "权威小计", values: { amount: "9.00" } },
    },
  ],
});
it("keeps the list and valid report facts when row and column references disappear", async () => {
  const presentation = validPresentation();
  const group = presentation.groups[0]!;
  const w = mount(DataList as Component, {
    props: {
      columns: [{ key: "amount", label: "金额" }],
      result: {
        items: [
          { id: "r1", amount: "1.00" },
          { id: "r2", amount: "2.00" },
        ],
        total: 2,
      },
      rowKey: (row: { id: string }) => row.id,
      page: 1,
      pageSize: 2,
      summary: {
        caption: "合计",
        values: { amount: 3, missing: Infinity },
      },
      presentation: {
        rows: [
          {
            rowId: "r1",
            cells: {
              amount: { bold: true },
              missing: { foreground: "url(bad)" },
            },
          },
          { rowId: "missing", appearance: { foreground: "url(bad)" } },
        ],
        groups: [
          {
            ...group,
            summary: {
              caption: "权威小计",
              values: { amount: "9.00", missing: "omit" },
            },
          },
          {
            ...group,
            id: "missing-first",
            firstKey: "missing",
            label: "忽略起始行",
          },
          {
            ...group,
            id: "missing-last",
            lastKey: "missing",
            label: "忽略结束行",
          },
          { ...group, level: 2, label: "忽略缺失父组" },
        ],
      },
    },
  });
  try {
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.findAll("tbody tr[data-record-key]")).toHaveLength(2);
    expect(w.get('td[data-label="金额"]').attributes("style")).toContain(
      "font-weight: bold",
    );
    expect(w.findAll("tbody th").map((row) => row.text())).toEqual(["分组"]);
    expect(w.get(".zerp-report-group-summary").text()).toContain("权威小计");
    expect(w.get("tfoot").text()).toContain("3");
    expect(w.text()).not.toContain("omit");
    await w.setProps({
      result: { items: [{ id: "r1", amount: "1.00" }], total: 1 },
    });
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.get("tbody tr[data-record-key]").text()).toContain("1.00");
    expect(w.find(".zerp-report-group-summary").exists()).toBe(false);
  } finally {
    w.unmount();
  }
});

for (const [name, mutate] of [
  [
    "malformed row fact",
    (p: any) => {
      p.rows.push(null);
    },
  ],
  [
    "malformed group",
    (p: any) => {
      p.groups.push(null);
    },
  ],
  [
    "duplicate row fact",
    (p: any) => {
      p.rows.push(p.rows[0]);
    },
  ],
  [
    "unsafe color",
    (p: any) => {
      p.rows[0].cells.amount.foreground = "url(bad)";
    },
  ],
  [
    "nonboolean emphasis",
    (p: any) => {
      p.rows[0].cells.amount.bold = "yes";
    },
  ],
  [
    "arbitrary CSS",
    (p: any) => {
      p.rows[0].cells.amount.position = "fixed";
    },
  ],
  [
    "invalid subtotal value",
    (p: any) => {
      p.groups[0].summary.values.amount = Number.POSITIVE_INFINITY;
    },
  ],
  [
    "reversed group",
    (p: any) => {
      p.groups[0].firstKey = "r2";
      p.groups[0].lastKey = "r1";
    },
  ],
  [
    "duplicate group",
    (p: any) => {
      p.groups.push(p.groups[0]);
    },
  ],
  [
    "overlapping peer groups",
    (p: any) => {
      p.groups.push({ ...p.groups[0], id: "peer" });
    },
  ],
  [
    "nonboolean continuation",
    (p: any) => {
      p.groups[0].continuedAfter = "yes";
    },
  ],
] as const) {
  it(`rejects ${name} through the DataList presentation boundary`, () => {
    const presentation = validPresentation();
    mutate(presentation);
    const w = mount(DataList as Component, {
      props: {
        columns: [{ key: "amount", label: "金额" }],
        result: {
          items: [
            { id: "r1", amount: "1.00" },
            { id: "r2", amount: "2.00" },
          ],
          total: 2,
        },
        rowKey: (row: { id: string }) => row.id,
        page: 1,
        pageSize: 2,
        presentation,
      },
    });
    try {
      expect(w.find('[role="alert"]').exists()).toBe(true);
      expect(w.find("table").exists()).toBe(false);
    } finally {
      w.unmount();
    }
  });
}
