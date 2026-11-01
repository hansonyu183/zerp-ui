export type PrintItem = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  foreground?: string;
  background?: string;
  border?: boolean;
} & (
  | {
      kind: "text";
      text: string;
      font?: "sans-serif" | "serif" | "monospace";
      size?: number;
      bold?: boolean;
      align?: "left" | "center" | "right";
    }
  | { kind: "image"; src: string; alt: string }
  | { kind: "line" | "rect" }
);
/** Fixed output facts, in millimetres. Expressions, pagination and barcode generation belong to the consumer. */
export type PrintDocument = {
  id: string;
  title: string;
  width: number;
  height: number;
  pages: readonly { key: string; items: readonly PrintItem[] }[];
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const finite = (n: number, min = 0, max = 2000) =>
  Number.isFinite(n) && n >= min && n <= max;
/** Only library-generated markup enters the isolated preview; raw HTML/CSS is never accepted. */
export function printMarkup(document: PrintDocument): string {
  if (
    !document.id ||
    !finite(document.width, 1) ||
    !finite(document.height, 1) ||
    !document.pages.length ||
    document.pages.length > 10000
  )
    throw Error("打印页尺寸或页数无效。");
  const pages = new Set<string>();
  const html = document.pages
    .map((page) => {
      if (!page.key || pages.has(page.key)) throw Error("打印页标识重复。");
      pages.add(page.key);
      const keys = new Set<string>();
      const items = page.items
        .map((item) => {
          if (
            !["text", "image", "line", "rect"].includes(item.kind) ||
            !item.key ||
            keys.has(item.key) ||
            ![item.x, item.y, item.width, item.height].every((n) =>
              finite(n),
            ) ||
            item.x + item.width > document.width ||
            item.y + item.height > document.height
          )
            throw Error("打印内容超出纸张或标识重复。");
          keys.add(item.key);
          let style = `position:absolute;left:${item.x}mm;top:${item.y}mm;width:${item.width}mm;height:${item.height}mm;box-sizing:border-box;`;
          for (const color of [item.foreground, item.background])
            if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color))
              throw Error("打印颜色无效。");
          style += `color:${item.foreground ?? "#000000"};background:${item.background ?? "transparent"};${item.border ? "border:1px solid currentColor;" : ""}`;
          if (item.kind === "text") {
            if (item.size !== undefined && !finite(item.size, 1, 200))
              throw Error("打印字号无效。");
            if (item.align && !["left", "center", "right"].includes(item.align))
              throw Error("打印对齐无效。");
            if (
              item.font &&
              !["sans-serif", "serif", "monospace"].includes(item.font)
            )
              throw Error("打印字体无效。");
            style += `font-family:${item.font ?? "sans-serif"};white-space:pre-wrap;overflow:hidden;font-size:${item.size ?? 10}pt;font-weight:${item.bold ? "bold" : "normal"};text-align:${item.align ?? "left"};`;
            return `<div style="${style}">${escape(item.text)}</div>`;
          }
          if (item.kind === "image") {
            if (
              !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(
                item.src,
              )
            )
              throw Error("打印图像须为内嵌位图。");
            return `<img style="${style}object-fit:contain" alt="${escape(item.alt)}" src="${escape(item.src)}">`;
          }
          return `<div style="${style}${item.kind === "line" ? "border-top" : "border"}:1px solid currentColor"></div>`;
        })
        .join("");
      return `<section class="page">${items}</section>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"><title>${escape(document.title)}</title><style>@page{size:${document.width}mm ${document.height}mm;margin:0}body{margin:0;background:#ddd}.page{position:relative;width:${document.width}mm;height:${document.height}mm;background:white;break-after:page;overflow:hidden}.page:last-child{break-after:auto}@media screen{.page{margin:8px auto}}@media print{body{background:white}}</style></head><body>${html}</body></html>`;
}
