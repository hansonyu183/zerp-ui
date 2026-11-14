import { expect } from "@playwright/test";

export async function openModelLink(page, name) {
  const link = page.getByRole("link", {
    name,
    exact: true,
    includeHidden: true,
  });
  const ancestors = link.locator("xpath=ancestor::details");
  for (let index = 0; index < (await ancestors.count()); index++) {
    const ancestor = ancestors.nth(index);
    if (!(await ancestor.evaluate((element) => element.hasAttribute("open"))))
      await ancestor.locator(":scope > summary").click();
  }
  await link.click();
}
export async function modelRevisionSmoke(page) {
  let directoryLoads = 0;
  const observe = (message) => {
    if (message.text() === "synthetic-directory-load") directoryLoads++;
  };
  page.on("console", observe);
  await openModelLink(page, "权限与引用");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  expect(directoryLoads).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("combobox", { name: "首个目录", exact: true }).click();
  const dropdown = await page.getByRole("listbox").boundingBox();
  expect(dropdown.width).toBeLessThanOrEqual(390);
  await expect(
    page.getByRole("dialog", { name: "选择首个目录", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "下一页引用", exact: true }).click();
  await page.getByRole("option", { name: "甲候选20", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "首个目录", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("combobox", { name: "复用目录", exact: true })
    .fill("甲候选44");
  await page.getByRole("option", { name: "甲候选44", exact: true }).waitFor();
  await page
    .getByRole("combobox", { name: "复用目录", exact: true })
    .press("ArrowDown");
  await page
    .getByRole("combobox", { name: "复用目录", exact: true })
    .press("Enter");
  expect(directoryLoads).toBe(1);
  await page.getByRole("combobox", { name: "多选目录", exact: true }).click();
  await page.getByRole("option", { name: "甲候选2", exact: true }).click();
  await page.getByRole("option", { name: "甲候选3", exact: true }).click();
  await page.getByRole("option", { name: "甲候选2", exact: true }).click();
  await page
    .getByRole("combobox", { name: "多选目录", exact: true })
    .press("Escape");
  expect(directoryLoads).toBe(1);
  await page.getByRole("combobox", { name: "首个目录", exact: true }).click();
  await page
    .getByRole("combobox", { name: "首个目录", exact: true })
    .press("Escape");
  expect(directoryLoads).toBe(1);
  await page.getByLabel("目录依赖", { exact: true }).fill("乙");
  await page.getByRole("combobox", { name: "首个目录", exact: true }).click();
  await page.getByRole("option", { name: "乙候选4", exact: true }).click();
  expect(directoryLoads).toBe(2);
  await page.getByLabel("普通用户视图", { exact: true }).check();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("region", { name: "查看资料", exact: true })
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await expect(page.getByLabel("管理员字段", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("用户只读字段", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "客户", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "账户：演示账户", exact: true }),
  ).toBeVisible();
  await page.getByLabel("普通用户视图", { exact: true }).uncheck();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  page.off("console", observe);
  return {
    directoryLoads,
    candidates: 45,
    permissionViews: ["administrator", "ordinary"],
    source: "synthetic-model-callbacks",
  };
}
