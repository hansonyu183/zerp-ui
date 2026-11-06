import assert from "node:assert/strict";
import { expect } from "@playwright/test";
export async function groupedFactsSmoke(page) {
  await page
    .getByRole("button", { name: "查看字段分组示例", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "查看资料", exact: true });
  await expect(dialog).toBeVisible();
  const tab = (name) => dialog.getByRole("tab", { name, exact: true });
  await expect(tab("基本资料")).toHaveAttribute("aria-selected", "true");
  assert.deepEqual(await dialog.getByRole("tab").allTextContents(), [
    "基本资料",
    "背景与备注",
    "其他",
  ]);
  assert.equal(await dialog.locator("fieldset").count(), 0);
  assert.equal(await dialog.getByText("synthetic-hidden").count(), 0);
  await expect(dialog.getByText("合成客户甲", { exact: true })).toBeVisible();
  assert.deepEqual(await dialog.locator("dd").allTextContents(), [
    "合成客户甲",
    "one",
    "0",
    "否",
    "（空字符串）",
    "—",
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  const container = dialog.locator(".zerp-facts-container").first();
  for (const [width, columns] of [
    [940, 3],
    [700, 2],
    [320, 1],
  ]) {
    await container.evaluate((el, width) => {
      el.style.inlineSize = `${width}px`;
    }, width);
    await expect
      .poll(() =>
        container
          .locator(":scope > .zerp-facts")
          .evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
          ),
      )
      .toBe(columns);
  }
  await container.evaluate((el) => el.style.removeProperty("inline-size"));
  await tab("背景与备注").click();
  await expect(dialog.getByText(/背景第一行/)).toBeVisible();
  const wide = dialog.locator(".zerp-fact--wide");
  assert.equal(await wide.count(), 2);
  for (const el of await wide.all())
    await expect(el).toHaveCSS("grid-column", "1 / -1");
  assert.equal(
    await dialog.getByText("合成客户甲", { exact: true }).count(),
    1,
  ); // hidden first panel only; not duplicated in second group
  await tab("其他").click();
  await expect(dialog.getByText("未归组原值", { exact: true })).toBeVisible();
  await tab("基本资料").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab("背景与备注")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tab("背景与备注")).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 390, height: 800 });
  await tab("其他").click();
  await expect(tab("其他")).toBeInViewport();
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  await dialog.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.getByRole("button", { name: "查看", exact: true }).nth(1).click();
  await expect(tab("基本资料")).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByText("合成客户乙", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "编辑资料", exact: true });
  await expect(
    editor.getByRole("textbox", { name: "客户名称", exact: true }),
  ).toHaveValue("合成客户乙");
  assert.equal(await editor.getByRole("tab").count(), 0);
  await editor.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
}
