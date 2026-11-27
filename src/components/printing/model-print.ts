import type {
  Node,
  ListCollection,
  FieldNode,
  ObjectNode,
  PrintElement,
  PrintTemplate,
} from "../../model/business-model";
import { formatField } from "../forms/model-format";
import { printMarkup, type PrintDocument, type PrintItem } from "./printing";

export type MeasuredPrintText = Extract<PrintItem, { kind: "text" }>;
export type MeasurePrintText = (item: MeasuredPrintText) => {
  height: number;
  insetTop: number;
};

type Printable = ListCollection | ObjectNode;
export type PreparedPrint = { document: PrintDocument; markup: string };
/** Bind the finite JSON template to held records only; no transport or system printing. */
export function bindPrintTemplate(
  template: PrintTemplate,
  source: Printable,
  readable: (node: ListCollection | Node) => boolean,
  measure: MeasurePrintText,
): PreparedPrint {
  const { width, height, margin, rotation } = template.page;
  const contentWidth = width - 2 * margin;
  const contentHeight =
    height - 2 * margin - template.header.height - template.footer.height;
  if (
    ![
      width,
      height,
      margin,
      template.header.height,
      template.footer.height,
    ].every(Number.isFinite) ||
    margin < 0 ||
    template.header.height < 0 ||
    template.footer.height < 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  )
    throw Error("打印纸张或页眉页脚尺寸无效。");
  if (!readable(source)) throw Error("没有读取打印内容的权限。");
  const record = "kind" in source ? source : null;
  if (record && record.identity === null) throw Error("只能打印正式记录。");
  const roots = record
    ? [record]
    : (source as ListCollection).items.filter(readable);
  if (roots.some((row) => row.identity === null || !row.printable))
    throw Error(record ? "此记录当前不可打印。" : "当前页有不可打印的记录。");
  function resolve(current: ObjectNode, path: readonly string[]): Node {
    if (!readable(current)) throw Error("没有读取打印记录的权限。");
    let node: Node = current;
    for (const key of path) {
      if (node.kind !== "object")
        throw Error(`打印字段路径无效：${path.join(".")}。`);
      const matches: Node[] = node.members.filter(
        (member) => member.key === key,
      );
      if (matches.length !== 1 || !readable(matches[0]!))
        throw Error(`打印字段不存在或无权读取：${path.join(".")}。`);
      node = matches[0]!;
    }
    return node;
  }
  function field(current: ObjectNode | null, path: readonly string[]) {
    if (!current || !path.length) throw Error("此打印区域不能绑定记录字段。");
    const node = resolve(current, path);
    if (
      [
        "object",
        "records",
        "password",
        "secret",
        "attachments",
        "output",
        "interactions",
      ].includes(node.kind)
    )
      throw Error(`字段不可打印：${path.join(".")}。`);
    return formatField(node as FieldNode);
  }
  function region(
    items: readonly PrintElement[],
    regionHeight: number,
    offsetY: number,
    prefix: string,
  ): PrintItem[] {
    const keys = new Set<string>();
    return items.map((item) => {
      if (keys.has(item.key) || !item.key)
        throw Error("打印区域内容标识重复。");
      keys.add(item.key);
      if (
        ![item.x, item.y, item.width, item.height].every(Number.isFinite) ||
        item.x < 0 ||
        item.y < 0 ||
        item.width < 0 ||
        item.height < 0 ||
        item.x + item.width > contentWidth ||
        item.y +
          (item.kind === "line" ? (item.lineWidth ?? 0.2) : item.height) >
          regionHeight
      )
        throw Error("打印内容超出所属区域。");
      const placed = {
        ...item,
        key: `${prefix}:${item.key}`,
        x: margin + item.x,
        y: offsetY + item.y,
      };
      if (item.kind === "pageNumber") {
        const output: MeasuredPrintText = { ...placed, kind: "text", text: "" };
        pageNumbers.add(output);
        return output;
      }
      return item.kind === "field"
        ? ({
            ...placed,
            kind: "text",
            text: field(record, item.path),
          } as PrintItem)
        : (placed as PrintItem);
    });
  }
  const pageNumbers = new Set<MeasuredPrintText>();
  const pages: { key: string; items: PrintItem[] }[] = [];
  let page: { key: string; items: PrintItem[] };
  let used = 0;
  const top = margin + template.header.height;
  function nextPage() {
    if (pages.length >= 10000) throw Error("打印页数过多。");
    page = {
      key: `page-${pages.length + 1}`,
      items: [
        ...region(
          template.header.items,
          template.header.height,
          margin,
          "header",
        ),
        ...region(
          template.footer.items,
          template.footer.height,
          height - margin - template.footer.height,
          "footer",
        ),
      ],
    };
    pages.push(page);
    used = 0;
  }
  nextPage();
  for (const [index, band] of template.body.entries()) {
    if (band.kind === "record") {
      if (!record) throw Error("集合模板不能绑定单条记录区域。");
      if (
        !Number.isFinite(band.height) ||
        band.height <= 0 ||
        band.height > contentHeight
      )
        throw Error("单条打印区域无法放入纸张。");
      if (used + band.height > contentHeight) nextPage();
      page!.items.push(
        ...region(band.items, band.height, top + used, `band-${index}`),
      );
      used += band.height;
    } else {
      const { headerHeight, rowHeight, columns } = band;
      if (
        !Number.isFinite(headerHeight) ||
        !Number.isFinite(rowHeight) ||
        headerHeight <= 0 ||
        rowHeight <= 0 ||
        headerHeight + rowHeight > contentHeight ||
        !columns.length ||
        columns.some(
          (column) => !Number.isFinite(column.width) || column.width <= 0,
        ) ||
        columns.reduce((sum, column) => sum + column.width, 0) > contentWidth
      )
        throw Error("打印表格列宽或单行无法放入纸张。");
      let rows: ObjectNode[];
      if (!band.path.length) {
        if (record) throw Error("单条模板的明细路径不能为空。");
        rows = roots;
      } else {
        if (!record) throw Error("集合模板只能打印当前页记录。");
        const node = resolve(record, band.path);
        if (node.kind !== "records")
          throw Error("打印明细路径未指向所属明细。");
        rows = node.items.filter(readable);
      }
      function cells(values: string[], key: string, heading = false) {
        let x = margin;
        return columns.map((column, columnIndex) => {
          const { path: _path, label: _label, ...style } = column;
          const cell: MeasuredPrintText = {
            ...style,
            kind: "text",
            key: `band-${index}:${key}:${columnIndex}`,
            x,
            y: 0,
            width: column.width,
            height: 0,
            text: values[columnIndex]!,
            bold: heading || column.bold,
            wrap: column.wrap ?? "word",
            border: true,
          };
          const measured = measure(cell);
          if (
            !Number.isFinite(measured.height) ||
            !Number.isFinite(measured.insetTop) ||
            measured.height < 0 ||
            measured.insetTop < 0 ||
            measured.insetTop > measured.height
          )
            throw Error("无法测量打印文字，请重新生成预览。");
          x += column.width;
          return { text: cell, ...measured };
        });
      }
      const headings = cells(
        columns.map((column) => column.label),
        "heading",
        true,
      );
      const headingHeight = Math.max(
        headerHeight,
        ...headings.map((cell) => cell.height),
      );
      if (headingHeight > contentHeight)
        throw Error(`第 ${index + 1} 个打印区域的表头无法放入纸张。`);
      function place(cells: typeof headings, h: number) {
        page!.items.push(
          ...cells.map(({ text, insetTop }) => ({
            ...text,
            insetTop,
            y: top + used,
            height: h,
          })),
        );
        used += h;
      }
      let hasHeading = false;
      if (!rows.length) {
        if (used + headingHeight > contentHeight) nextPage();
        place(headings, headingHeight);
      }
      for (const [rowIndex, row] of rows.entries()) {
        const items = cells(
          columns.map((column) => field(row, column.path)),
          `row-${rowIndex}`,
        );
        const h = Math.max(rowHeight, ...items.map((cell) => cell.height));
        if (headingHeight + h > contentHeight)
          throw Error(
            `第 ${index + 1} 个打印区域的第 ${rowIndex + 1} 条明细（${row.key}）过高，无法与表头放入一页。`,
          );
        if (used + (hasHeading ? 0 : headingHeight) + h > contentHeight) {
          nextPage();
          hasHeading = false;
        }
        if (!hasHeading) {
          place(headings, headingHeight);
          hasHeading = true;
        }
        place(items, h);
      }
    }
  }
  const document: PrintDocument = {
    id: `model-print:${source.key}`,
    title: template.label,
    width,
    height,
    rotation,
    pages,
  };
  for (const [index, page] of pages.entries()) {
    for (const item of page.items) {
      if (pageNumbers.has(item as MeasuredPrintText))
        (item as MeasuredPrintText).text =
          `第 ${index + 1} / ${pages.length} 页`;
    }
  }
  // The existing printer is the single authority for finite styles and embedded bitmap validation.
  return { document, markup: printMarkup(document) };
}
