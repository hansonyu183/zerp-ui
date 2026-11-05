import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function compactTableSmoke(page) {
  await page.getByLabel("报表示例").selectOption("compact");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  const table = page.locator(".zerp-compact-table table");
  await expect(
    table.getByRole("cell", { name: "合成客户甲", exact: true }),
  ).toBeVisible();
  for (const width of [1440, 1024, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () =>
        table.evaluate((t) => ({
          fits: t.parentElement.scrollWidth <= t.parentElement.clientWidth + 1,
          font: getComputedStyle(t.querySelector("td")).fontSize,
          headers: [...t.querySelectorAll("thead th")].map((th) =>
            th.textContent.trim(),
          ),
        })),
      )
      .toEqual({
        fits: true,
        font: "12px",
        headers: ["编号", "操作", "客户名称", "日期", "金额", "电话", "备注"],
      });
  }
  assert.equal(await table.locator("tbody tr").count(), 2);
  await expect(
    table
      .locator("tbody tr")
      .first()
      .getByRole("link", { name: "查看 C001", exact: true }),
  ).toHaveAttribute("href", "#C001");
  const total = table.locator("tfoot tr").first().locator("td");
  await expect(total.nth(1)).toHaveText("");
  await expect(total.nth(4)).toHaveText("123456.79");
  const first = table.locator("tbody tr").first();
  await first.getByRole("button", { name: "详情 C001", exact: true }).click();
  await expect(page.getByLabel("选中操作")).toHaveText("detail:C001");
  await first.getByRole("button", { name: "更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "设置 C001", exact: true }).click();
  await expect(page.getByLabel("选中操作")).toHaveText("settings:C001");
  await first.getByRole("button", { name: "更多操作", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "打印 C001", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel("报表示例").selectOption("batch");
}
