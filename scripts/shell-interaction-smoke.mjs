import assert from "node:assert/strict";
import { expect } from "@playwright/test";

/** Public shell behavior, shared by installed tgz and local synthetic example. */
export async function shellInteractionSmoke(page) {
  const toggle = page.getByRole("button", { name: "切换导航", exact: true });
  const navigation = page.getByRole("navigation", {
    name: "主导航",
    exact: true,
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  for (const control of [
    page.getByText("星河演示", { exact: true }),
    page.getByLabel("主题预设", { exact: true }),
    page.getByRole("button", { name: "切换明暗模式", exact: true }),
    page.getByRole("button", { name: "账户：演示账户", exact: true }),
  ]) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    assert.ok(
      box && box.x >= 0 && box.x + box.width <= 320,
      "narrow toolbar control must fit viewport",
    );
  }
  await page.getByLabel("主题预设", { exact: true }).selectOption("md2");
  await expect(page.getByLabel("主题预设", { exact: true })).toHaveValue("md2");
  await page.getByLabel("主题预设", { exact: true }).selectOption("md3");
  await page
    .getByRole("button", { name: "账户：演示账户", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "个人资料", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("menuitem", { name: "个人资料", exact: true }),
  ).toBeHidden();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(navigation.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  const link = page.getByRole("link", { name: "报表", exact: true });
  const originalURL = page.url();
  await link.dispatchEvent("click", { metaKey: true, button: 0 });
  assert.equal(page.url(), originalURL);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await link.click();
  await expect(
    page.getByRole("heading", { name: "报表", exact: true }),
  ).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole("link", { name: "流程", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "流程", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "流程", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}
