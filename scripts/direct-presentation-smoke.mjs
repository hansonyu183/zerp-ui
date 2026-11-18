import { expect } from "@playwright/test";
import { fieldAlignmentSmoke } from "./field-alignment-smoke.mjs";

export async function settleLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}

// Runs against the independently installed public package; no model or VM access.
export async function directPresentationSmoke(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const alignment = [
    await fieldAlignmentSmoke(
      page.locator(".zerp-shell-content"),
      "desktop filters",
    ),
  ];
  const firstFilter = await page
    .getByRole("textbox", { name: "关键词", exact: true })
    .boundingBox();
  const fourthFilter = await page
    .getByRole("textbox", { name: "状态条件", exact: true })
    .boundingBox();
  const fifthFilter = await page
    .getByRole("textbox", { name: "联系条件", exact: true })
    .boundingBox();
  expect(Math.abs(firstFilter.y - fourthFilter.y)).toBeLessThan(2);
  expect(fifthFilter.y).toBeGreaterThan(firstFilter.y);
  const table = page.getByRole("table").filter({ hasText: "合成客户甲" });
  await expect(table.locator("thead th").nth(1)).toHaveText("操作");
  await expect(table).toHaveCSS("font-size", "12px");
  const view = table.getByRole("button", { name: "编辑", exact: true });
  expect((await view.boundingBox()).height).toBeGreaterThanOrEqual(32);
  await view.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await settleLayout(page);
  const field = dialog.getByRole("textbox", { name: "客户名称", exact: true });
  await expect(field).toBeEditable();
  alignment.push(
    await fieldAlignmentSmoke(dialog, "desktop edit and read-only fields"),
  );
  const barBox = await page.locator(".v-app-bar").boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(barBox.height).toBe(48);
  expect(dialogBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(1001);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(view).toBeFocused();
  await table.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(field).toBeEditable();
  await settleLayout(page);
  const code = dialog.getByRole("textbox", { name: "编号", exact: true });
  const codeBox = await code.boundingBox();
  const nameBox = await field.boundingBox();
  expect(Math.abs(codeBox.y - nameBox.y)).toBeLessThan(2);
  const thirdField = await dialog
    .getByRole("textbox", { name: "额度", exact: true })
    .boundingBox();
  const fourthField = await dialog
    .getByRole("combobox", { name: "客户分类", exact: true })
    .boundingBox();
  expect(Math.abs(codeBox.y - thirdField.y)).toBeLessThan(2);
  expect(fourthField.y).toBeGreaterThan(codeBox.y);
  await dialog.getByRole("tab", { name: "联系人", exact: true }).click();
  alignment.push(await fieldAlignmentSmoke(dialog, "desktop owned records"));

  await dialog.getByRole("button", { name: "关闭", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  const domainTabs = page.getByRole("tablist", {
    name: "客户",
    exact: true,
  });
  await expect(domainTabs).toBeVisible();
  expect((await domainTabs.boundingBox()).width).toBeLessThanOrEqual(390);

  await expect(page.getByRole("article", { name: "记录 1" })).toBeVisible();
  const mobileEdit = page.getByRole("button", { name: "编辑", exact: true });
  await expect(mobileEdit).toContainText("编辑");
  expect((await mobileEdit.boundingBox()).height).toBeGreaterThanOrEqual(48);
  await mobileEdit.click();
  await settleLayout(page);
  await expect(field).toHaveCSS("font-size", "16px");
  alignment.push(
    await fieldAlignmentSmoke(dialog, "mobile edit and read-only fields"),
  );
  await dialog.getByRole("tab", { name: "联系人", exact: true }).click();
  alignment.push(await fieldAlignmentSmoke(dialog, "mobile owned cards"));
  const mobileBox = await dialog.boundingBox();
  const mobileBar = await page.locator(".v-app-bar").boundingBox();
  expect(mobileBox.y).toBeGreaterThanOrEqual(mobileBar.y + mobileBar.height);
  expect(mobileBox.y + mobileBox.height).toBeLessThanOrEqual(845);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  return {
    desktop: true,
    mobile: true,
    overlayAndFocus: true,
    alignment,
  };
}

export async function workbenchPresentationSmoke(page) {
  const workbench = page.getByRole("region", { name: "工作台", exact: true });
  const cards = workbench.locator(".zerp-workbench-grid > section");
  await expect(cards).toHaveCount(4);
  await settleLayout(page);
  const rects = () =>
    cards.evaluateAll((items) =>
      items.map((item) => {
        const { x, y, width, height } = item.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
  const desktop = await rects();
  expect(desktop[0].width).toBeGreaterThan(desktop[1].width * 2.9);
  expect(desktop[0].y + desktop[0].height).toBeLessThan(desktop[1].y + 1);
  expect(Math.abs(desktop[1].y - desktop[2].y)).toBeLessThan(1);
  expect(Math.abs(desktop[1].width - desktop[3].width)).toBeLessThan(1);
  const darkToggle = page.getByRole("button", {
    name: "切换明暗模式",
    exact: true,
  });
  await darkToggle.click();
  for (const preset of [1, 2, 3]) {
    await page.getByRole("button", { name: "主题预设", exact: true }).click();
    await page
      .getByRole("menuitemradio", {
        name: `Material Design ${preset}`,
        exact: true,
      })
      .click();
    await expect(cards.first()).toHaveClass(
      new RegExp(`v-theme--zerp-md${preset}-dark`),
    );
    await expect(
      page.getByRole("menu", { name: "主题预设", exact: true }),
    ).toBeHidden();
  }
  await darkToggle.click();
  await expect(cards.first()).toHaveClass(/v-theme--zerp-md3-light/);
  await page.setViewportSize({ width: 390, height: 844 });
  await settleLayout(page);
  const mobile = await rects();
  for (let i = 1; i < mobile.length; i++) {
    expect(mobile[i].y).toBeGreaterThanOrEqual(
      mobile[i - 1].y + mobile[i - 1].height,
    );
    expect(Math.abs(mobile[i].x - mobile[0].x)).toBeLessThan(1);
    expect(Math.abs(mobile[i].width - mobile[0].width)).toBeLessThan(1);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
}
