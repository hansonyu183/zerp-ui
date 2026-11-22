import { expect } from "@playwright/test";
import { settleLayout } from "./direct-presentation-smoke.mjs";

export async function businessInteractionSmoke(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(new URL("/", page.url()).href);
  await page
    .getByRole("textbox", { name: "登录名", exact: true })
    .fill("admin");
  await page
    .getByRole("textbox", { name: "登录密码", exact: true })
    .fill("synthetic-only");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "主导航" });
  const customers = navigation.getByRole("link", { name: "客户", exact: true });
  if (!(await customers.isVisible()))
    await navigation.getByText("业务", { exact: true }).click();
  await customers.click();
  const record = page.getByText("合成客户甲", { exact: true });
  await expect(record).toBeVisible();

  const keyword = page.getByRole("textbox", { name: "关键词", exact: true });
  const query = page.getByRole("button", { name: "查询", exact: true });
  const pagination = page.getByRole("navigation", {
    name: "分页",
    exact: true,
  });
  const next = pagination.getByRole("button", { name: "下一页", exact: true });
  await keyword.fill("可重试读取");
  await query.click();
  await expect(
    page.getByRole("status").filter({ hasText: "正在读取" }),
  ).toBeVisible();
  const queryFailure = page
    .getByRole("alert")
    .filter({ hasText: "客户查询暂不可用" });
  await expect(queryFailure).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(
    page.getByText("已有结果未更新", { exact: false }),
  ).toBeVisible();
  await expect(record).toBeVisible();
  await expect(page.getByText("暂无记录", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(keyword).toHaveValue("可重试读取");
  await expect(queryFailure).toHaveCount(0);
  await expect(pagination).toContainText("共 21 条");
  await next.click();
  await expect(pagination).toContainText("第 2 页");
  await expect(next).toBeDisabled();
  await keyword.fill("空结果");
  await query.click();
  await expect(page.getByText("暂无记录", { exact: true })).toBeVisible();
  await expect(pagination).toHaveCount(0);
  await keyword.fill("");
  await query.click();
  await expect(record).toBeVisible();

  await page.setViewportSize({ width: 390, height: 480 });
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = page.getByRole("dialog");
  const name = editor.getByRole("textbox", { name: "客户名称", exact: true });
  const save = editor.getByRole("button", { name: "保存", exact: true });
  await name.fill("暂不可保存");
  await expect(save).toHaveCount(0);
  await expect(
    editor.getByText("当前无法保存。", { exact: true }),
  ).toBeVisible();
  await name.fill("需要核对客户名称");
  await expect(save).toBeEnabled();

  await save.scrollIntoViewIfNeeded();
  await settleLayout(page);
  const before = await name.boundingBox();
  const body = editor.locator(".zerp-record-dialog__body");
  const viewport = await body.evaluate((element) => ({
    height: element.clientHeight,
    scroll: element.scrollTop,
  }));
  expect(viewport.scroll).toBeGreaterThan(0);
  await save.click();
  const specificFailure = editor.getByText("请先核对客户名称。", {
    exact: true,
  });
  await expect(specificFailure).toBeVisible();
  await expect(
    page.getByText("请先核对客户名称。", { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText("操作失败，请检查业务信息后重试。", { exact: true }),
  ).toHaveCount(0);
  await settleLayout(page);
  const after = await name.boundingBox();
  expect(
    await body.evaluate((element) => ({
      height: element.clientHeight,
      scroll: element.scrollTop,
    })),
  ).toEqual(viewport);
  for (const coordinate of ["x", "y", "width", "height"])
    expect(Math.abs(before[coordinate] - after[coordinate])).toBeLessThan(1);
  await expect(name).toBeEditable();
  // A trial click verifies that feedback does not cover the actual field.
  await name.click({ trial: true });

  return [
    {
      clauses: ["UI-SHELL-05", "UI-SHELL-06"],
      check: "query-loading-single-feedback-retry-pagination-and-success-empty",
      result: "passed",
    },
    {
      clauses: ["UI-ACTION-03", "UI-SHELL-05", "UI-SHELL-06"],
      check: "mobile-save-qualification-and-unobstructed-specific-feedback",
      result: "passed",
    },
  ];
}
