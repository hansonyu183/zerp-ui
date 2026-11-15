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
  printable: true,
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
  it("refuses unauthorized and secret bindings instead of leaking raw values", () => {
    const denied = collection.items[0]!.members[0]!;
    expect(() =>
      bindPrintTemplate(template, collection, (node) => node !== denied),
    ).toThrow("无权读取");
    const single = row("formal");
    single.members = [
      {
        key: "secret",
        label: "密码",
        kind: "secret",
        readOnly: true,
        required: false,
        value: { intent: "keep" },
      },
    ];
    const secretTemplate: PrintTemplate = {
      ...template,
      body: [
        {
          kind: "record",
          height: 10,
          items: [
            {
              kind: "field",
              path: ["secret"],
              key: "value",
              x: 0,
              y: 0,
              width: 30,
              height: 5,
            },
          ],
        },
      ],
    };
    expect(() => bindPrintTemplate(secretTemplate, single, () => true)).toThrow(
      "字段不可打印",
    );
    expect(() =>
      bindPrintTemplate(
        {
          ...secretTemplate,
          body: [
            {
              kind: "record",
              height: 10,
              items: [
                {
                  kind: "field",
                  path: ["missing"],
                  key: "value",
                  x: 0,
                  y: 0,
                  width: 30,
                  height: 5,
                },
              ],
            },
          ],
        },
        single,
        () => true,
      ),
    ).toThrow("字段不存在");
  });
  it("fails oversized bands, impossible rows, invalid colors and remote images", () => {
    expect(() =>
      bindPrintTemplate(
        {
          ...template,
          body: [
            {
              kind: "records",
              path: [],
              headerHeight: 5,
              rowHeight: 99,
              columns: [{ path: ["amount"], label: "金额", width: 50 }],
            },
          ],
        },
        collection,
        () => true,
      ),
    ).toThrow("无法放入纸张");
    const single = row("formal");
    expect(() =>
      bindPrintTemplate(
        { ...template, body: [{ kind: "record", height: 99, items: [] }] },
        single,
        () => true,
      ),
    ).toThrow("无法放入纸张");
    expect(() =>
      bindPrintTemplate(
        {
          ...template,
          header: {
            height: 5,
            items: [
              {
                kind: "text",
                key: "bad",
                text: "bad",
                foreground: "red",
                x: 0,
                y: 0,
                width: 30,
                height: 5,
              },
            ],
          },
        },
        collection,
        () => true,
      ),
    ).toThrow("打印颜色无效");
    expect(() =>
      bindPrintTemplate(
        {
          ...template,
          header: {
            height: 5,
            items: [
              {
                kind: "image",
                key: "bad",
                src: "https://example.com/image.png",
                alt: "",
                x: 0,
                y: 0,
                width: 30,
                height: 5,
              },
            ],
          },
        },
        collection,
        () => true,
      ),
    ).toThrow("内嵌位图");
  });
  it("binds local detail rows and rejects collection header fields or unsaved roots", () => {
    const single = row("formal");
    single.members.push({
      kind: "records",
      key: "lines",
      label: "明细",
      readOnly: false,
      columns: collection.columns,
      items: collection.items,
      selected: null,
      operations: {},
    });
    const detailTemplate: PrintTemplate = {
      ...template,
      body: [
        {
          kind: "records",
          path: ["lines"],
          headerHeight: 5,
          rowHeight: 10,
          columns: [{ path: ["amount"], label: "金额", width: 50 }],
        },
      ],
    };
    expect(
      bindPrintTemplate(detailTemplate, single, () => true).pages,
    ).toHaveLength(2);
    expect(() =>
      bindPrintTemplate(
        {
          ...template,
          header: {
            height: 5,
            items: [
              {
                kind: "field",
                path: ["amount"],
                key: "bad",
                x: 0,
                y: 0,
                width: 30,
                height: 5,
              },
            ],
          },
        },
        collection,
        () => true,
      ),
    ).toThrow("不能绑定记录字段");
    single.identity = null;
    expect(() => bindPrintTemplate(detailTemplate, single, () => true)).toThrow(
      "正式记录",
    );
  });
  it("rejects unconfirmed formal values without dropping current-page rows", () => {
    const dirty = row("dirty");
    dirty.printable = false;
    expect(() =>
      bindPrintTemplate(
        { ...template, body: [{ kind: "record", height: 10, items: [] }] },
        dirty,
        () => true,
      ),
    ).toThrow("尚未确认保存");
    expect(() =>
      bindPrintTemplate(
        template,
        { ...collection, items: [row("saved"), dirty] },
        () => true,
      ),
    ).toThrow("尚未确认保存");
  });
});
