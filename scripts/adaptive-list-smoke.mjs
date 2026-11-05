import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function adaptiveListSmoke(page) {
  await page.evaluate(() => {
    window.adaptiveResizeErrors = [];
    window.addEventListener("error", (event) => {
      if (event.message.includes("ResizeObserver"))
        window.adaptiveResizeErrors.push(event.message);
    });
  });
  await page.getByLabel("报表示例", { exact: true }).selectOption("wide");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  const records = page.getByRole("article");
  await expect(records).toHaveCount(3);
  for (const width of [1440, 1024, 800, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.locator(".zerp-list").evaluate((root) => ({
          overflow: root.scrollWidth > root.clientWidth + 1,
          fields: [...root.querySelectorAll("article")].map(
            (row) => row.querySelectorAll("[data-label]").length,
          ),
        })),
      )
      .toEqual({ overflow: false, fields: [18, 18, 18] });
    await page
      .getByRole("button", { name: "查看 合成客户1", exact: true })
      .click();
    await expect(page.getByLabel("试用操作结果")).toContainText(
      "查看 合成客户1",
    );
  }
  const positions = await records.evaluateAll((rows) =>
    rows.map((row) =>
      [...row.querySelectorAll("[data-label]")].map((cell) =>
        Math.round(cell.getBoundingClientRect().x),
      ),
    ),
  );
  assert.deepEqual(positions[0], positions[1]);
  assert.deepEqual(await page.evaluate(() => window.adaptiveResizeErrors), []);
  await page.getByLabel("报表示例", { exact: true }).selectOption("batch");
}
