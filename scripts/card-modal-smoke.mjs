import { expect } from "@playwright/test";
import assert from "node:assert/strict";
export async function recordDialogSmoke(page) {
  await page.getByLabel("资料演示", { exact: true }).selectOption("actions");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 850 });
    if (width === 390) {
      const card = page.getByRole("article", { name: "记录 1", exact: true });
      await expect(card).toBeVisible();
      await expect
        .poll(async () => {
          const fields = await card
            .locator("[data-label]")
            .evaluateAll((nodes) =>
              nodes.map((n) => ({
                top: n.getBoundingClientRect().top,
                height: n.getBoundingClientRect().height,
              })),
            );
          return (
            fields.length === 3 &&
            fields.some(
              (a, i) => i > 0 && Math.abs(a.top - fields[i - 1].top) < 2,
            )
          );
        })
        .toBe(true);
    }
    const view = page.getByRole("button", { name: "查看", exact: true });
    await view.click();
    const dialog = page.getByRole("dialog", { name: "查看资料", exact: true });
    await expect(dialog).toBeVisible();
    const bar = await page.locator(".zerp-shell-toolbar").boundingBox();
    const box = await dialog.boundingBox();
    assert.ok(
      box.y >= bar.y + bar.height && box.x >= 0 && box.x + box.width <= width,
    );

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(view).toBeFocused();
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    const edit = page.getByRole("dialog", { name: "编辑资料", exact: true });
    await edit.getByLabel("名称", { exact: true }).fill("本地草稿");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "放弃本地修改", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "放弃本地修改", exact: true })
      .click();
    await expect(edit).toBeHidden();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}
export async function relatedDialogSmoke(page) {
  const keyword = page.getByLabel("关键字", { exact: true });
  await keyword.fill("保留筛选");
  await page.getByRole("button", { name: "关联资料详情", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "合成资料详情",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog
      .getByRole("region", { name: "基本资料", exact: true })
      .getByText("合成客户", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "编辑资料", exact: true }).click();
  await dialog.getByLabel("详情名称", { exact: true }).fill("详情草稿");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "放弃本地修改", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "放弃本地修改", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(keyword).toHaveValue("保留筛选");
  await keyword.fill("");
}
