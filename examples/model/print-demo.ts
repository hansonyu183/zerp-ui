import { reactive } from "vue";
import type {
  Collection,
  ObjectNode,
  PrintTemplate,
  FieldNode,
} from "@zerp/ui/model";
const field = (key: string, value: string, label: string = key): FieldNode => ({
  kind: "text",
  key,
  label,
  value,
  required: false,
  readOnly: true,
});
const object = (key: string, members: ObjectNode["members"]): ObjectNode => ({
  kind: "object",
  family: "standard",
  key,
  label: "合成送货单",
  identity: key,
  printable: true,
  readOnly: true,
  operations: {},
  members,
});
const template: PrintTemplate = {
  label: "合成送货单打印",
  page: { width: 210, height: 297, margin: 10 },
  header: {
    height: 15,
    items: [
      {
        kind: "text",
        key: "title",
        text: "合成送货单",
        x: 0,
        y: 0,
        width: 190,
        height: 8,
        font: "cjk-sans",
        lineHeight: 1.5,
        size: 16,
        align: "center",
      },
      {
        kind: "field",
        key: "number",
        path: ["number"],
        x: 0,
        y: 9,
        width: 190,
        height: 6,
        font: "cjk-sans",
        lineHeight: 1.5,
      },
    ],
  },
  footer: {
    height: 8,
    items: [
      {
        kind: "pageNumber",
        key: "page",
        x: 0,
        y: 0,
        width: 190,
        height: 8,
        font: "cjk-sans",
        lineHeight: 1.5,
        align: "center",
      },
    ],
  },
  body: [
    {
      kind: "records",
      path: ["lines"],
      headerHeight: 8,
      rowHeight: 8,
      columns: [
        { path: ["code"], label: "编号", width: 30, font: "cjk-sans" },
        {
          path: ["description"],
          label: "商品名称、规格及备注",
          width: 130,
          font: "cjk-sans",
        },
        {
          path: ["quantity"],
          label: "数量",
          width: 30,
          font: "cjk-sans",
          align: "right",
        },
      ],
    },
    {
      kind: "record",
      height: 30,
      items: [
        {
          kind: "field",
          key: "total",
          path: ["total"],
          x: 0,
          y: 3,
          width: 190,
          height: 8,
          font: "cjk-sans",
          lineHeight: 1.5,
        },
        {
          kind: "text",
          key: "signature",
          text: "收货人签字：________________",
          x: 0,
          y: 15,
          width: 190,
          height: 10,
          font: "cjk-sans",
          lineHeight: 1.5,
        },
      ],
    },
  ],
};
function voucher(): ObjectNode {
  const rows = Array.from({ length: 35 }, (_, i) =>
    object(`line-${i + 1}`, [
      field("code", `L${String(i + 1).padStart(3, "0")}`, "编号"),
      field(
        "description",
        i % 3 === 0
          ? `合成商品${i + 1}：` +
              "长规格与完整备注自动换行，保留所有内容。".repeat(5) +
              "\n换行备注结束"
          : i === 1
            ? ""
            : `合成商品${i + 1}`,
        "商品",
      ),
      field("quantity", "1", "数量"),
    ]),
  );
  return object("delivery-demo", [
    field("number", "DEMO-001"),
    field("total", "数量合计：35（合成业务值）"),
    {
      kind: "records",
      key: "lines",
      label: "明细",
      readOnly: true,
      items: rows,
      selected: null,
      operations: {},
    },
  ]);
}
export const printDemo: Collection = reactive({
  key: "print-demo",
  label: "打印示例",
  columns: [{ key: "number", label: "单号" }],
  conditions: object("print-demo-conditions", []),
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {
    query: {
      disabled: false,
      run: async () => {
        printDemo.items = [voucher()];
        printDemo.total = 1;
      },
    },
  },
  itemPrintTemple: template,
});
