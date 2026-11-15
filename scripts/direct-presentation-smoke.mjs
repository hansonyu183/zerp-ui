import { expect } from "@playwright/test";

// Runs against the independently installed public package; no model or VM access.
export async function directPresentationSmoke(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const tabs = page.getByRole("tablist", { name: "往来资料", exact: true });
  const overview = tabs.getByRole("tab", { name: "概览", exact: true });
  const customers = tabs.getByRole("tab", { name: "客户", exact: true });
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await overview.focus();
  await overview.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(customers).toHaveAttribute("aria-selected", "true");
  const panelId = await customers.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
  const table = page.getByRole("table").filter({ hasText: "合成客户甲" });
  await expect(table.locator("thead th").nth(1)).toHaveText("操作");
  await expect(table).toHaveCSS("font-size", "12px");
  const view = table.getByRole("button", { name: "编辑", exact: true });
  await view.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const field = dialog.getByRole("textbox", { name: "客户名称", exact: true });
  await expect(field).toBeEditable();
  const barBox = await page.locator(".v-app-bar").boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(barBox.height).toBe(48);
  expect(dialogBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(1001);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(view).toBeFocused();
  await table.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(field).toBeEditable();
  const code = dialog.getByRole("textbox", { name: "编号", exact: true });
  const codeBox = await code.boundingBox();
  const nameBox = await field.boundingBox();
  expect(Math.abs(codeBox.y - nameBox.y)).toBeLessThan(2);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("article", { name: "记录 1" })).toBeVisible();
  const mobileEdit = page.getByRole("button", { name: "编辑", exact: true });
  await expect(mobileEdit).toContainText("编辑");
  await mobileEdit.click();
  await expect(field).toHaveCSS("font-size", "16px");
  const mobileBox = await dialog.boundingBox();
  const mobileBar = await page.locator(".v-app-bar").boundingBox();
  expect(mobileBox.y).toBeGreaterThanOrEqual(mobileBar.y + mobileBar.height);
  expect(mobileBox.y + mobileBox.height).toBeLessThanOrEqual(845);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await overview.click();
  return {
    desktop: true,
    mobile: true,
    materialTabs: true,
    overlayAndFocus: true,
  };
}
