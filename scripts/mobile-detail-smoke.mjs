import { expect } from "@playwright/test";
import { settleLayout } from "./direct-presentation-smoke.mjs";

// Runs through the public BusinessApplication and its synthetic consumer only.
export async function mobileDetailSmoke(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("textbox", { name: "登录名", exact: true })
    .fill("admin");
  await page
    .getByRole("textbox", { name: "登录密码", exact: true })
    .fill("synthetic-only");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("button", { name: "切换导航", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await navigation.getByText("业务", { exact: true }).click();
  await navigation.getByRole("link", { name: "单据", exact: true }).click();

  const criterion = page.getByRole("textbox", {
    name: "单据筛选",
    exact: true,
  });
  await criterion.fill("手机详情");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  const pagination = page.getByRole("navigation", { name: "分页" });
  await expect(pagination).toContainText("第 2 页");
  const trigger = page
    .getByRole("article", { name: "记录 5", exact: true })
    .filter({ hasText: "MD017" })
    .getByRole("button", { name: "查看", exact: true });
  await trigger.scrollIntoViewIfNeeded();
  const listScroll = await page.evaluate(() => window.scrollY);
  expect(listScroll).toBeGreaterThan(0);

  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "合成手机详情",
    exact: true,
  });
  const close = dialog
    .locator("header")
    .getByRole("button", { name: "关闭", exact: true });
  const body = dialog.locator(".zerp-record-dialog__body");
  const note = dialog.getByRole("textbox", { name: "单据备注", exact: true });
  const record = dialog.getByRole("textbox", {
    name: "完整办理记录",
    exact: true,
  });
  await expect(note).toHaveValue(/备注结尾$/);
  await expect(record).toHaveValue(/办理记录结尾$/);
  for (const field of [note, record]) {
    await expect(field).not.toBeEditable();
    await expect
      .poll(() =>
        field.evaluate(
          (element) =>
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
    expect((await field.boundingBox()).height).toBeGreaterThan(48);
  }

  await settleLayout(page);
  const titleClose = await close.boundingBox();
  expect(titleClose.width).toBeGreaterThanOrEqual(48);
  expect(titleClose.height).toBeGreaterThanOrEqual(48);
  await body.evaluate((element) => (element.scrollTop = element.scrollHeight));
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    0,
  );
  await expect(close).toBeInViewport();
  expect(Math.abs((await close.boundingBox()).y - titleClose.y)).toBeLessThan(
    1,
  );

  const related = dialog.getByRole("region", { name: "业务提示", exact: true });
  const links = related.getByRole("link");
  await expect(links).toHaveText([
    "关联联系人",
    "客户资料",
    "资料办理",
    "流程办理",
    "批量办理",
    "经营报表",
  ]);
  const positions = await links.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, height } = element.getBoundingClientRect();
      return { x, y, height };
    }),
  );
  expect(Math.abs(positions[0].y - positions[1].y)).toBeLessThan(1);
  expect(positions[1].x).toBeGreaterThan(positions[0].x);
  expect(positions.at(-1).y).toBeGreaterThan(positions[0].y);
  expect(positions.every(({ height }) => height >= 48)).toBe(true);
  expect(
    await body.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(await body.evaluate((element) => element.clientWidth));

  await close.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(pagination).toContainText("第 2 页");
  await expect(criterion).toHaveValue("手机详情");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(listScroll);

  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  // Desktop keeps the original single-line read-only presentation.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktopTrigger = page
    .getByRole("row")
    .filter({ hasText: "MD017" })
    .getByRole("button", { name: "查看", exact: true });
  await desktopTrigger.click();
  await expect(note).toHaveJSProperty("tagName", "INPUT");
  await expect(note).not.toBeEditable();
  await close.click();
  await expect(desktopTrigger).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  const contacts = related.getByRole("link", {
    name: "关联联系人",
    exact: true,
  });
  await expect(contacts).toHaveAttribute("href", "/business/contacts");
  await contacts.click();
  await expect(page).toHaveURL(/\/business\/contacts$/);
  await expect(
    page.getByRole("heading", { name: "联系人", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });

  return [
    {
      clauses: ["UI-FORM-02", "UI-THEME-06"],
      check: "scrolled-mobile-record-close-and-context",
      result: "passed",
    },
    {
      clauses: ["UI-FORM-01", "UI-FORM-03"],
      check: "mobile-readonly-full-values-and-desktop-single-line",
      result: "passed",
    },
    {
      clauses: ["UI-SHELL-04", "UI-THEME-06", "UI-NAV-04"],
      check: "mobile-related-link-wrap-and-collection-heading",
      result: "passed",
    },
  ];
}
