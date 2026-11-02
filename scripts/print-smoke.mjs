import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { PNG } from "pngjs";
import zxing from "@zxing/library";

/** The rendered public AppPage preview is the only source of the exported output. */
export async function printOutputSmoke(page, evidence) {
  const frame = page.frameLocator('iframe[title="打印预览"]');
  const iframe = await page.locator('iframe[title="打印预览"]').elementHandle();
  const content = await iframe.contentFrame();
  const output = await page.context().newPage();
  try {
    await output.setContent(await iframe.getAttribute("srcdoc"));
    await output.evaluate(async () => {
      const loaded = await document.fonts.load(
        "10pt zerp-print-cjk-sans",
        "中文",
      );
      if (!loaded.length) throw Error("Install controlled Chinese print font");
      await Promise.all(Array.from(document.images, (image) => image.decode()));
    });
    const geometry = await output.evaluate(() => {
      const sheet = document.querySelector(".page");
      const wrapped = Array.from(
        document.querySelectorAll(".sheet > div"),
      ).find((e) => e.textContent.startsWith("中文长文本"));
      const clipped = Array.from(
        document.querySelectorAll(".sheet > div"),
      ).find((e) => e.textContent.startsWith("单行裁切"));
      const watermark = Array.from(
        document.querySelectorAll(".sheet > div"),
      ).find((e) => e.textContent === "合成水印");
      const line = Array.from(document.querySelectorAll(".sheet > div")).find(
        (e) => e.style.borderTopWidth === "0.5mm",
      );
      return {
        width: sheet.getBoundingClientRect().width,
        height: sheet.getBoundingClientRect().height,
        wrapHeight: wrapped.clientHeight,
        wrapScroll: wrapped.scrollHeight,
        clipWidth: clipped.clientWidth,
        clipScroll: clipped.scrollWidth,
        line: parseFloat(getComputedStyle(line).borderTopWidth),
        declaredLineWidth: line.style.borderTopWidth,
        opacity: getComputedStyle(watermark).opacity,
        font: getComputedStyle(wrapped).fontFamily,
      };
    });
    assert.ok(
      Math.abs(geometry.width - 604.72) < 0.1 &&
        Math.abs(geometry.height - 377.95) < 0.1,
      "rotated 160mm × 100mm output",
    );
    assert.ok(
      geometry.wrapScroll > 30 && geometry.wrapHeight > 60,
      "Chinese wrapped multiline text has real layout",
    );
    assert.ok(
      geometry.clipScroll > geometry.clipWidth,
      "unwrapped long text clips to its fixed box",
    );
    assert.ok(
      Math.abs(geometry.line - 1) < 0.01,
      "0.5mm stroke quantizes to one CSS pixel in this browser",
    );
    assert.equal(geometry.declaredLineWidth, "0.5mm");
    assert.equal(geometry.opacity, "0.2");
    assert.equal(geometry.font, "zerp-print-cjk-sans");
    const bitmap = PNG.sync.read(
      await output.locator(".page").first().screenshot(),
    );
    const luminance = new Uint8ClampedArray(bitmap.width * bitmap.height);
    for (let i = 0; i < luminance.length; i++)
      luminance[i] =
        (bitmap.data[4 * i] +
          2 * bitmap.data[4 * i + 1] +
          bitmap.data[4 * i + 2]) /
        4;
    const decoded = new zxing.QRCodeReader().decode(
      new zxing.BinaryBitmap(
        new zxing.HybridBinarizer(
          new zxing.RGBLuminanceSource(luminance, bitmap.width, bitmap.height),
        ),
      ),
      new Map(),
    );
    assert.equal(
      decoded.getText(),
      "ZERP-SYNTHETIC-58",
      "QR decodes from the rotated rendered page bitmap",
    );
    const pdf = await output.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });
    const pdfText = pdf.toString("latin1");
    const pages = [...pdfText.matchAll(/\/Type\s*\/Page\b/g)].length;
    assert.equal(pages, 2, "one physical PDF page per supplied page");
    const boxes = [
      ...pdfText.matchAll(
        /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g,
      ),
    ];
    assert.equal(boxes.length, 2);
    for (const [, w, h] of boxes) {
      assert.ok(
        Math.abs(Number(w) - 453.54) < 1 && Math.abs(Number(h) - 283.46) < 1,
        "160mm × 100mm PDF MediaBox",
      );
    }
    const directory = evidence.directory;
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "synthetic.pdf"), pdf);
    await writeFile(
      resolve(directory, "synthetic.png"),
      PNG.sync.write(bitmap),
    );
    await writeFile(
      resolve(directory, "evidence.json"),
      JSON.stringify(
        {
          ...evidence,
          pdfSha256: createHash("sha256").update(pdf).digest("hex"),
          bitmapSha256: createHash("sha256")
            .update(PNG.sync.write(bitmap))
            .digest("hex"),
          geometry,
          pages,
          mediaBoxes: boxes.map(([, w, h]) => [Number(w), Number(h)]),
          decoded: decoded.getText(),
          boundary:
            "AppPage preview browser bitmap/PDF; mode identifies installed tgz versus built example; no physical printer or production API",
        },
        null,
        2,
      ),
    );
    // Browser boundary was intercepted before AppPage and its frame loaded.
    assert.equal(
      await content.evaluate(() => window.__printCalls),
      0,
      "reload does not automatically print",
    );
    await page
      .getByRole("button", { name: "打开打印窗口", exact: true })
      .click();
    assert.equal(await content.evaluate(() => window.__printCalls), 1);
    await expect(
      page.getByRole("button", { name: "打开打印窗口", exact: true }),
    ).toBeEnabled();
    await expect(
      frame.getByText("第二页分页验证", { exact: true }),
    ).toBeVisible();
  } finally {
    await output.close();
  }
}
