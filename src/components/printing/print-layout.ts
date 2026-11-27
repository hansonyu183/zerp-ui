import type {
  Node,
  ListCollection,
  ObjectNode,
  PrintTemplate,
} from "../../model/business-model";
import { bindPrintTemplate, type PreparedPrint } from "./model-print";
import { printMarkup, printTextStyle } from "./printing";

/** Browser-only measurement stays private; callers cancel it when their UI scope changes. */
export async function layoutPrintTemplate(
  template: PrintTemplate,
  source: ListCollection | ObjectNode,
  readable: (node: ListCollection | Node) => boolean,
  signal: AbortSignal,
): Promise<PreparedPrint> {
  signal.throwIfAborted();
  const frame = document.createElement("iframe");
  frame.title = "打印排版测量";
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;visibility:hidden;pointer-events:none;";
  // The same controlled document supplies the exact local font faces as the final output.
  const loaded = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () =>
      reject(Error("打印排版容器加载失败，请重新生成预览。"));
  });
  let cancel: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => reject(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
  });
  try {
    frame.srcdoc = printMarkup({
      id: "measurement",
      title: "打印排版测量",
      width: 210,
      height: 297,
      pages: [{ key: "measurement", items: [] }],
    });
    document.body.append(frame);
    await Promise.race([loaded, aborted]);
    signal.throwIfAborted();
    const doc = frame.contentDocument;
    if (!doc) throw Error("打印排版容器不可用，请重新生成预览。");
    const needsCjk = template.body.some(
      (band) =>
        band.kind === "records" &&
        band.columns.some((column) => column.font === "cjk-sans"),
    );
    if (needsCjk) {
      const fonts = await Promise.race([
        doc.fonts.load("10pt zerp-print-cjk-sans", "中文"),
        aborted,
      ]);
      if (!fonts.length) throw Error("打印字体不可用，请安装指定字体后重试。");
    }
    await Promise.race([doc.fonts.ready, aborted]);
    signal.throwIfAborted();
    const box = doc.createElement("div");
    doc.body.append(box);
    return bindPrintTemplate(template, source, readable, (item) => {
      const padding = item.border ? (item.lineWidth ?? 0.2) : 0;
      box.style.cssText = `${printTextStyle(item)}width:${item.width}mm;height:auto;box-sizing:border-box;padding:${padding}mm;`;
      box.textContent = item.text;
      const bounds = box.getBoundingClientRect();
      if (!box.firstChild)
        return {
          height: Math.ceil(((bounds.height * 25.4) / 96) * 1000) / 1000,
          insetTop: 0,
        };
      const range = doc.createRange();
      range.selectNodeContents(box);
      // CJK glyphs can extend below CSS line boxes; include the actual text
      // rectangles and bottom inset so the last line remains fully visible.
      const glyphs = range.getBoundingClientRect();
      const insetTop = Math.max(
        0,
        bounds.top + (padding * 96) / 25.4 - glyphs.top,
      );
      const insetMm = Math.ceil(((insetTop * 25.4) / 96) * 1000) / 1000;
      const height = Math.max(
        bounds.height,
        glyphs.bottom - bounds.top + (padding * 96) / 25.4,
      );
      return {
        height: Math.ceil(((height * 25.4) / 96) * 1000) / 1000 + insetMm,
        insetTop: insetMm,
      };
    });
  } finally {
    signal.removeEventListener("abort", cancel);
    frame.onload = null;
    frame.onerror = null;
    frame.remove();
  }
}
