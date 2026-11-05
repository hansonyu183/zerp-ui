import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { assertStableFeedback } from "./feedback-smoke.mjs";

export async function compactReportSmoke(page) {
  const keyword = page.getByLabel("关键字", { exact: true });
  const amount = page.getByLabel("金额下限", { exact: true });
  const enabled = page.getByLabel("使用金额", { exact: true });
  const query = page.getByRole("button", { name: "查询", exact: true });
  const controls = [keyword, amount, query];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(keyword).toBeVisible();
    await expect
      .poll(async () => {
        const first = await keyword.boundingBox(),
          second = await amount.boundingBox();
        return width === 1440
          ? Math.abs(first.y - second.y) < 60
          : second.y > first.y;
      })
      .toBe(true);
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        { message: "form fits after responsive reflow" },
      )
      .toBe(true);
    const source = page.getByLabel("来源", { exact: true });
    await source.press("Enter");
    await expect(page.getByLabel("来源搜索", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "合成来源1", exact: true }).click();
    await page.getByRole("button", { name: "下一页引用", exact: true }).click();
    await page.getByRole("button", { name: "合成来源2", exact: true }).click();
    await page.getByRole("button", { name: "完成选择", exact: true }).click();
    await expect(source).toHaveValue("合成来源1 等 2 项");
    await expect(page.getByLabel("来源搜索", { exact: true })).toBeHidden();
    await source.click();
    await expect(page.getByLabel("来源搜索", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "移除合成来源1", exact: true })
      .click();
    await page
      .getByRole("button", { name: "移除合成来源2", exact: true })
      .click();
    await page.getByRole("button", { name: "上一页引用", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("来源搜索", { exact: true })).toBeHidden();
    await expect(source).toHaveValue("");
    await expect(source).toBeFocused();
    await amount.fill("1.00");
    await keyword.focus();
    await assertStableFeedback(page, controls, async () => {
      await amount.fill("invalid");
      await page
        .getByRole("button", { name: "金额下限错误详情", exact: true })
        .waitFor();
    });
    const errorButton = page.getByRole("button", {
      name: "金额下限错误详情",
      exact: true,
    });
    const inputBox = await amount.boundingBox(),
      errorBox = await errorButton.boundingBox();
    assert.ok(
      inputBox.x + inputBox.width <= errorBox.x + 1,
      "48px error target must not overlap input text",
    );
    const note = page.getByRole("note", {
      name: "金额下限错误详情",
      exact: true,
    });
    await expect(note).toBeVisible();
    const bar = await page.locator(".zerp-shell-toolbar").boundingBox();
    const box = await note.boundingBox();
    assert.ok(
      box.y >= bar.y + bar.height,
      "field feedback remains below app bar",
    );
    await assertStableFeedback(page, controls, async () => {
      await note.getByRole("button", { name: "关闭", exact: true }).click();
    });
    await expect(
      page.getByRole("button", { name: "金额下限错误详情", exact: true }),
    ).toBeVisible();
    await enabled.uncheck();
    await expect(amount).toBeDisabled();
    await expect(amount).toHaveValue("invalid");
    await enabled.check();
    await expect(amount).toHaveValue("invalid");
    await amount.fill("");
    await keyword.focus();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}
