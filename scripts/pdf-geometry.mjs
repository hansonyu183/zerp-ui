import assert from "node:assert/strict";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PNG } from "pngjs";
import zxing from "@zxing/library";

const mm = 72 / 25.4;

/** Inspect actual PDF operators and rendered ink, never the screen DOM. */
export async function checkRotatedPdf(data, rotation) {
  const task = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, 3);
    const reports = [];
    const bitmaps = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const swapped = rotation === 90 || rotation === 270;
      assert.ok(Math.abs(viewport.width / mm - (swapped ? 160 : 120)) < 0.4);
      assert.ok(Math.abs(viewport.height / mm - (swapped ? 120 : 160)) < 0.4);
      const logical = (x, y) => {
        switch (rotation) {
          case 90:
            return [y, 160 - x];
          case 180:
            return [120 - x, 160 - y];
          case 270:
            return [120 - y, x];
          default:
            return [x, y];
        }
      };
      const items = (await page.getTextContent()).items.filter(
        (item) => item.str,
      );
      const text = items
        .map((item) => item.str.normalize("NFKC").replaceAll("⻚", "页"))
        .join("");
      const anchor = (label) => {
        const index = text.indexOf(label);
        assert.ok(index >= 0, `page ${number}: missing ${label}: ${text}`);
        let offset = 0;
        for (const item of items) {
          const length = item.str
            .normalize("NFKC")
            .replaceAll("⻚", "页").length;
          if (offset === index) {
            return logical(
              item.transform[4] / mm,
              (viewport.height - item.transform[5]) / mm,
            );
          }
          offset += length;
        }
        throw Error(`No text anchor for ${label}`);
      };
      const first = anchor("中文第一行");
      const second = anchor("中文第二行");
      const footer = anchor(`页脚 PAGE ${number}`);
      for (const [x, y] of [first, second]) {
        assert.ok(
          Math.abs(x - 10.2) < 0.6,
          `rotation ${rotation} page ${number}: line x=${x}`,
        );
        assert.ok(
          y > 11 && y < 21,
          `rotation ${rotation} page ${number}: line y=${y}`,
        );
      }
      assert.ok(
        Math.abs(second[1] - first[1] - 14 / mm) < 0.4,
        `rotation ${rotation} page ${number}: 14pt baseline gap ${second[1] - first[1]}mm`,
      );
      assert.ok(
        Math.abs(footer[0] - 10) < 0.6 && footer[1] > 147 && footer[1] < 150,
        `rotation ${rotation} page ${number}: footer ${footer}`,
      );
      assert.ok(text.includes("水印"));
      const renderViewport = page.getViewport({ scale: 96 / 72 });
      const canvas = createCanvas(
        Math.ceil(renderViewport.width),
        Math.ceil(renderViewport.height),
      );
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d"),
        viewport: renderViewport,
      }).promise;
      const bitmap = PNG.sync.read(canvas.toBuffer("image/png"));
      const luminance = new Uint8ClampedArray(bitmap.width * bitmap.height);
      let footerInk = 0;
      for (let y = 0; y < bitmap.height; y++) {
        for (let x = 0; x < bitmap.width; x++) {
          const i = y * bitmap.width + x;
          luminance[i] =
            (bitmap.data[4 * i] +
              2 * bitmap.data[4 * i + 1] +
              bitmap.data[4 * i + 2]) /
            4;
          const [lx, ly] = logical((x * 25.4) / 96, (y * 25.4) / 96);
          if (lx > 10 && lx < 100 && ly > 145 && ly < 155 && luminance[i] < 160)
            footerInk++;
        }
      }
      assert.ok(
        footerInk > 100,
        `rotation ${rotation} page ${number}: footer clipped (${footerInk} ink pixels)`,
      );
      const decoded = new zxing.QRCodeReader().decode(
        new zxing.BinaryBitmap(
          new zxing.HybridBinarizer(
            new zxing.RGBLuminanceSource(
              luminance,
              bitmap.width,
              bitmap.height,
            ),
          ),
        ),
        new Map(),
      );
      assert.equal(
        decoded.getText(),
        "ZERP-SYNTHETIC-58",
        "QR decodes from actual PDF rendering",
      );
      reports.push({
        number,
        first,
        second,
        footer,
        footerInk,
        decoded: decoded.getText(),
        mediaBox: [viewport.width, viewport.height],
      });
      bitmaps.push(canvas.toBuffer("image/png"));
      page.cleanup();
    }
    return { reports, bitmaps };
  } finally {
    await task.destroy();
  }
}
