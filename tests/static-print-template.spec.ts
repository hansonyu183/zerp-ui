import { describe, expect, it } from "vitest";
import { bindPrintTemplate } from "../src/model-print";
import type { Collection, ObjectNode, PrintTemplate } from "../src/model";
const row = (id: string): ObjectNode => ({
  kind: "object",
  key: id,
  label: "记录",
  readOnly: false,
  family: "standard",
  identity: id,
  operations: {},
  members: [
    {
      key: "amount",
      label: null,
      kind: "decimal",
      value: "9007199254740993.995",
      required: false,
      readOnly: false,
      format: { locale: "en-US", maximumFractionDigits: 2 },
    },
  ],
});
const collection: Collection = {
  key: "rows",
  label: "记录",
  conditions: row("conditions"),
  columns: [{ key: "amount", label: "金额" }],
  items: [row("1"), row("2"), row("3")],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 999,
  operations: {},
};
const template: PrintTemplate = {
  label: "当前页",
  page: { width: 80, height: 50, margin: 5 },
  header: {
    height: 5,
    items: [
      {
        kind: "text",
        key: "title",
        text: "合成",
        x: 0,
        y: 0,
        width: 30,
        height: 5,
      },
    ],
  },
  footer: {
    height: 5,
    items: [
      {
        kind: "text",
        key: "footer",
        text: "页脚",
        x: 0,
        y: 0,
        width: 30,
        height: 5,
      },
    ],
  },
  body: [
    {
      kind: "records",
      path: [],
      headerHeight: 5,
      rowHeight: 10,
      columns: [{ path: ["amount"], label: "金额", width: 50 }],
    },
  ],
};
describe("finite model print template binding", () => {
  it("prints only current items with repeated table headings and fixed header/footer", () => {
    const document = bindPrintTemplate(template, collection, () => true);
    expect(document.pages).toHaveLength(2);
    for (const page of document.pages) {
      expect(
        page.items.filter(
          (item) => item.kind === "text" && item.text === "金额",
        ),
      ).toHaveLength(1);
      expect(
        page.items.some((item) => item.kind === "text" && item.text === "页脚"),
      ).toBe(true);
    }
    expect(
      document.pages
        .flatMap((page) => page.items)
        .filter(
          (item) => item.kind === "text" && item.text === "9007199254740994.00",
        ),
    ).toHaveLength(3);
  });
});
