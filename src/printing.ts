/** Physical clockwise rotation, around the centre of the content sheet. */
type Rotation = 0 | 90 | 180 | 270;
type PrintFont = "sans-serif" | "serif" | "monospace" | "cjk-sans";
type TextStyle = {
  font?: PrintFont;
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  /** Unitless line height; default 1.2. */
  lineHeight?: number;
  /** Explicit newlines are preserved. word breaks long words; none clips a single line. */
  wrap?: "word" | "none";
};
export type PrintItem = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  foreground?: string;
  background?: string;
  border?: boolean;
  /** Physical stroke width in mm, including text/image borders; default 0.2. */
  lineWidth?: number;
} & (
  | ({ kind: "text"; text: string } & TextStyle)
  | { kind: "image"; src: string; alt: string }
  | { kind: "line" | "rect" }
);
/** Fixed output facts in millimetres. Coordinates remain in the unrotated sheet; 90/270 swap output dimensions. */
export type PrintDocument = {
  id: string;
  title: string;
  width: number;
  height: number;
  rotation?: Rotation;
  /** Library-owned overlay, clipped to the sheet, above all page content. */
  watermark?: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: Rotation;
    opacity: number;
    foreground?: string;
  } & TextStyle;
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
const rotations = [0, 90, 180, 270];
function color(value: string | undefined, fallback: string) {
  if (value !== undefined && !/^#[0-9a-fA-F]{6}$/.test(value))
    throw Error("打印颜色无效。");
  return value ?? fallback;
}
function textStyle(item: TextStyle) {
  if (item.size !== undefined && !finite(item.size, 1, 200))
    throw Error("打印字号无效。");
  if (item.lineHeight !== undefined && !finite(item.lineHeight, 1, 3))
    throw Error("打印行高无效。");
  if (
    item.align !== undefined &&
    !["left", "center", "right"].includes(item.align)
  )
    throw Error("打印对齐无效。");
  if (
    item.font !== undefined &&
    !["sans-serif", "serif", "monospace", "cjk-sans"].includes(item.font)
  )
    throw Error("打印字体无效。");
  if (item.wrap !== undefined && !["word", "none"].includes(item.wrap))
    throw Error("打印换行无效。");
  return `font-family:${item.font === "cjk-sans" ? "zerp-print-cjk-sans" : (item.font ?? "sans-serif")};white-space:${item.wrap === "none" ? "pre" : "pre-wrap"};overflow-wrap:anywhere;overflow:hidden;font-size:${item.size ?? 10}pt;font-weight:${item.bold ? "bold" : "normal"};text-align:${item.align ?? "left"};line-height:${item.lineHeight ?? 1.2};`;
}
/** Only library-generated markup enters the isolated preview; raw HTML/CSS is never accepted. */
export function printMarkup(document: PrintDocument): string {
  if (
    !document.id ||
    !finite(document.width, 1) ||
    !finite(document.height, 1) ||
    !document.pages.length ||
    document.pages.length > 10000 ||
    !rotations.includes(document.rotation ?? 0)
  )
    throw Error("打印页尺寸、旋转或页数无效。");
  function geometry(item: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    if (
      ![item.x, item.y, item.width, item.height].every((n) => finite(n)) ||
      item.x + item.width > document.width ||
      item.y + item.height > document.height
    )
      throw Error("打印内容超出纸张。");
    return `position:absolute;left:${item.x}mm;top:${item.y}mm;width:${item.width}mm;height:${item.height}mm;box-sizing:border-box;`;
  }
  let watermark = "";
  if (document.watermark) {
    const w = document.watermark;
    if (!finite(w.opacity, 0, 1) || !rotations.includes(w.rotation ?? 0))
      throw Error("打印水印无效。");
    watermark = `<div style="${geometry(w)}${textStyle(w)}color:${color(w.foreground, "#000000")};opacity:${w.opacity};transform:rotate(${w.rotation ?? 0}deg);transform-origin:center;pointer-events:none;">${escape(w.text)}</div>`;
  }
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
            keys.has(item.key)
          )
            throw Error("打印内容标识重复或类型无效。");
          keys.add(item.key);
          if (item.lineWidth !== undefined && !finite(item.lineWidth, 0.05, 10))
            throw Error("打印线宽无效。");
          const stroke = `${item.lineWidth ?? 0.2}mm solid currentColor`;
          let style = `${geometry(item)}color:${color(item.foreground, "#000000")};background:${color(item.background, "transparent")};${item.border ? `border:${stroke};` : ""}`;
          if (item.kind === "text")
            return `<div style="${style}${textStyle(item)}">${escape(item.text)}</div>`;
          if (item.kind === "image") {
            if (
              !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(
                item.src,
              )
            )
              throw Error("打印图像须为内嵌位图。");
            return `<img style="${style}object-fit:contain" alt="${escape(item.alt)}" src="${escape(item.src)}">`;
          }
          return `<div style="${style}${item.kind === "line" ? "border-top" : "border"}:${stroke}"></div>`;
        })
        .join("");
      return `<section class="page"><div class="sheet">${items}${watermark}</div></section>`;
    })
    .join("");
  const rotation = document.rotation ?? 0,
    swapped = rotation === 90 || rotation === 270;
  const width = swapped ? document.height : document.width,
    height = swapped ? document.width : document.height;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src 'self'; style-src 'unsafe-inline';"><title>${escape(document.title)}</title><style>@font-face{font-family:zerp-print-cjk-sans;src:local("NotoSansCJKsc-Regular"),local("Noto Sans CJK SC"),local("PingFangSC-Regular"),local("MicrosoftYaHei"),local("Microsoft YaHei")}@page{size:${width}mm ${height}mm;margin:0}body{margin:0;background:#ddd}.page{position:relative;width:${width}mm;height:${height}mm;background:white;break-after:page;overflow:hidden}.sheet{position:absolute;left:50%;top:50%;width:${document.width}mm;height:${document.height}mm;transform:translate(-50%,-50%) rotate(${rotation}deg);transform-origin:center;overflow:hidden}.page:last-child{break-after:auto}@media screen{.page{margin:8px auto}}@media print{body{background:white}}</style></head><body>${html}</body></html>`;
}
