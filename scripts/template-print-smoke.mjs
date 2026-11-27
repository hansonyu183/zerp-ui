import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Public installed consumer and actual PDF, using synthetic facts only. */
export async function templatePrintSmoke(page, options) {
  await page
    .getByRole("textbox", { name: "登录名", exact: true })
    .fill("admin");
  await page
    .getByRole("textbox", { name: "登录密码", exact: true })
    .fill("synthetic-only");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await navigation.getByText("业务", { exact: true }).click();
  await navigation.getByRole("link", { name: "打印示例", exact: true }).click();
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await page.getByText("DEMO-001", { exact: true }).waitFor();
  await page.getByRole("button", { name: "打印", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "合成送货单打印",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: "打开打印窗口", exact: true }),
  ).toBeEnabled();
  await expect(page.locator('iframe[title="打印排版测量"]')).toHaveCount(0);
  const preview = page
    .frames()
    .find(
      (frame) => frame !== page.mainFrame() && frame.url() === "about:srcdoc",
    );
  assert.ok(preview);
  const geometry = await preview.evaluate(() => {
    const reports = [];
    for (const sheet of document.querySelectorAll(".sheet")) {
      const boxes = [...sheet.children].filter(
        (node) => node.tagName === "DIV",
      );
      for (const box of boxes) {
        if (!box.querySelector("svg")) continue;
        // Range rects inspect every actual text line, including the last wrapped line.
        const range = document.createRange();
        range.selectNodeContents(box.firstChild);
        const bottom = box.getBoundingClientRect().bottom;
        for (const rect of range.getClientRects()) {
          if (rect.height) {
            assertWithin(rect.bottom, bottom, box);
            if (rect.top < box.getBoundingClientRect().top - 0.1)
              throw Error(`Text clipped at top: ${box.textContent}`);
          }
        }
      }
      function assertWithin(textBottom, boxBottom, box) {
        if (textBottom > boxBottom + 0.1)
          throw Error(
            `Text clipped: ${textBottom} > ${boxBottom}; ${box.textContent}; ${box.style.cssText}`,
          );
      }
      reports.push({
        text: sheet.textContent,
        rowHeights: boxes
          .filter((box) => /^L\d{3}$/.test(box.firstChild?.textContent ?? ""))
          .map((box) => box.getBoundingClientRect().height),
      });
    }
    return reports;
  });
  assert.ok(geometry.length > 1);
  const heights = geometry.flatMap((sheet) => sheet.rowHeights);
  assert.equal(heights.length, 35);
  assert.ok(Math.max(...heights) > Math.min(...heights) * 2, "long rows grow");
  const markup = await dialog
    .locator('iframe[title="打印预览"]')
    .getAttribute("srcdoc");
  const output = await page.context().newPage();
  try {
    await output.setContent(markup);
    await output.evaluate(async () => {
      await document.fonts.load("10pt zerp-print-cjk-sans", "中文");
      await document.fonts.ready;
    });
    const data = await output.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });
    await mkdir(options.directory, { recursive: true });
    await writeFile(join(options.directory, "delivery.pdf"), data);
    const task = getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
    });
    let pages;
    try {
      const pdf = await task.promise;
      assert.equal(pdf.numPages, geometry.length);
      pages = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const pdfPage = await pdf.getPage(number);
        const viewport = pdfPage.getViewport({ scale: 1 });
        assert.ok(Math.abs((viewport.width * 25.4) / 72 - 210) < 0.4);
        assert.ok(Math.abs((viewport.height * 25.4) / 72 - 297) < 0.4);
        const text = (await pdfPage.getTextContent()).items
          .map((item) => item.str ?? "")
          .join("")
          .normalize("NFKC")
          .replaceAll("⻚", "页")
          .replaceAll("⻓", "长");
        assert.ok(text.includes(`第 ${number} / ${pdf.numPages} 页`), text);
        assert.ok(text.includes("DEMO-001"));
        if (/L\d{3}/.test(text))
          assert.ok(text.includes("商品名称、规格及备注"));
        pages.push({
          number,
          text,
          width: viewport.width,
          height: viewport.height,
        });
      }
      const fullText = pages.map((report) => report.text).join("");
      for (let i = 1; i <= 35; i++)
        assert.equal(
          fullText.split(`L${String(i).padStart(3, "0")}`).length - 1,
          1,
        );
      assert.equal(fullText.split("换行备注结束").length - 1, 12);
      assert.equal(
        fullText.split(
          "长规格与完整备注自动换行，保留所有内容。".normalize("NFKC"),
        ).length - 1,
        60,
      );
      assert.equal(fullText.split("数量合计").length - 1, 1);
      assert.ok(pages.at(-1).text.includes("数量合计"));
      assert.ok(pages.at(-1).text.includes("收货人签字"));
    } finally {
      await task.destroy();
    }
    await dialog
      .getByRole("button", { name: "打开打印窗口", exact: true })
      .click();
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(page.locator('iframe[title="打印预览"]')).toHaveCount(0);
    await expect(page.locator('iframe[title="打印排版测量"]')).toHaveCount(0);
    return {
      ...options,
      geometry,
      pages,
      checks: [
        "dynamic row heights",
        "unclipped wrapped text",
        "actual PDF page size/count",
        "page numbers",
        "repeated headings",
        "all 35 rows exactly once",
        "single final summary/signature",
        "measurement cleanup",
      ],
    };
  } finally {
    await output.close();
  }
}
