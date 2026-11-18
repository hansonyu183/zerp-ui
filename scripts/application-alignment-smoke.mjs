import { expect } from "@playwright/test";
import { settleLayout } from "./direct-presentation-smoke.mjs";
import { fieldAlignmentSmoke } from "./field-alignment-smoke.mjs";

// Tour the actual synthetic application's public navigation; no model/VM access.
export async function applicationAlignmentSmoke(page) {
  const surfaces = [];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("textbox", { name: "登录名", exact: true })
    .fill("admin");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "主导航" });
  const content = page.locator(".zerp-shell-content");
  async function menu() {
    const toggle = page.getByRole("button", { name: "切换导航", exact: true });
    const drawer = page.locator(".v-navigation-drawer");
    await expect
      .poll(
        async () =>
          (await toggle.getAttribute("aria-expanded")) ===
          String(
            await drawer.evaluate((el) =>
              el.classList.contains("v-navigation-drawer--active"),
            ),
          ),
      )
      .toBe(true);
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
    await expect(drawer).toHaveClass(/v-navigation-drawer--active/);
    await settleLayout(page);
    const groups = navigation.locator("details");
    for (let i = 0; i < (await groups.count()); i++)
      if ((await groups.nth(i).getAttribute("open")) === null)
        await groups.nth(i).locator(":scope > summary").click();
  }
  async function inspect(scope, name, width) {
    await settleLayout(page);
    const fields = (await scope.locator(".v-field:visible").count())
      ? await fieldAlignmentSmoke(scope, name)
      : { fields: 0 };
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      name,
    ).toBeLessThanOrEqual(width + 1);
    const bounds = await scope
      .locator(".zerp-business-actions, .v-tabs, .v-table, iframe")
      .evaluateAll((elements) =>
        elements
          .filter((e) => e.getClientRects().length)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const owner = element.closest("section")?.getBoundingClientRect();
            return {
              kind: element.tagName,
              left: rect.left,
              right: rect.right,
              owner: owner ? { left: owner.left, right: owner.right } : null,
            };
          }),
      );
    for (const rect of bounds) {
      expect(rect.left, `${name} ${rect.kind}`).toBeGreaterThanOrEqual(-1);
      expect(rect.right, `${name} ${rect.kind}`).toBeLessThanOrEqual(width + 1);
      if (rect.owner) {
        expect(rect.left, name).toBeGreaterThanOrEqual(rect.owner.left - 1);
        expect(rect.right, name).toBeLessThanOrEqual(rect.owner.right + 1);
      }
    }
    if (await page.getByRole("dialog").count()) {
      const dialog = await page.getByRole("dialog").boundingBox();
      const bar = await page.locator(".v-app-bar").boundingBox();
      expect(dialog.y, name).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
      expect(dialog.y + dialog.height, name).toBeLessThanOrEqual(
        page.viewportSize().height + 1,
      );
    }
    surfaces.push({
      width,
      name,
      fields: fields.fields,
      components: bounds.length,
      result: "passed",
    });
  }
  await menu();
  const links = await navigation.locator("a[href]").evaluateAll((items) =>
    items.map((item) => ({
      label: (() => {
        const copy = item.cloneNode(true);
        copy
          .querySelectorAll('[aria-hidden="true"]')
          .forEach((icon) => icon.remove());
        return copy.textContent.trim();
      })(),
      href: item.getAttribute("href"),
    })),
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    const drawer = page.locator(".v-navigation-drawer");
    if (width === 390)
      await expect(drawer).toHaveClass(/v-navigation-drawer--mobile/);
    else await expect(drawer).not.toHaveClass(/v-navigation-drawer--mobile/);
    await settleLayout(page);
    for (const link of links) {
      await menu();
      await navigation.locator(`a[href=${JSON.stringify(link.href)}]`).click();
      await inspect(content, `${link.label} / 列表与筛选`, width);
      const detail = content
        .locator(".zerp-row-actions")
        .getByRole("button", { name: /^(编辑|查看)$/ })
        .or(
          content
            .locator(".zerp-row-actions")
            .getByRole("link", { name: "查看", exact: true }),
        )
        .first();
      if (await detail.count()) {
        await detail.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await inspect(dialog, `${link.label} / 详情`, width);
        const tabs = await dialog.getByRole("tab").allTextContents();
        for (const name of tabs) {
          await dialog
            .getByRole("tab", { name: name.trim(), exact: true })
            .click();
          await inspect(dialog, `${link.label} / ${name.trim()}`, width);
        }
        const preview = dialog.getByRole("button", {
          name: "预览",
          exact: true,
        });
        if (await preview.count()) {
          await preview.click();
          await expect(
            dialog.locator('iframe[title="打印预览"]'),
          ).toBeVisible();
          await inspect(dialog, `${link.label} / 打印预览`, width);
        }
        await dialog.getByRole("button", { name: "关闭", exact: true }).click();
        await expect(dialog).toBeHidden();
      }
    }
    await page.locator(".zerp-shell-brand").click();
    await inspect(content, "工作台", width);
    for (const caption of ["名称与头像", "更改密码"]) {
      await page
        .getByRole("button", { name: "账户：合成用户", exact: true })
        .click();
      const accountMenu = page.getByRole("menu", {
        name: "账户菜单",
        exact: true,
      });
      await expect(accountMenu).toBeVisible();
      await settleLayout(page);
      const rect = await accountMenu.boundingBox();
      expect(rect.x).toBeGreaterThanOrEqual(-1);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
      await page.getByRole("menuitem", { name: caption, exact: true }).click();
      await inspect(content, caption, width);
      const secret = content.getByRole("combobox", {
        name: "接口密钥",
        exact: true,
      });
      if (caption === "名称与头像") {
        await expect(secret).toBeVisible();
        await secret.press("ArrowDown");
        await page.getByRole("option", { name: "修改", exact: true }).click();
        await inspect(content, "密钥修改控件", width);
        await secret.press("ArrowDown");
        await page.getByRole("option", { name: "保留", exact: true }).click();
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  return {
    check: "application-pages-and-components-alignment",
    pages: links.map((link) => link.label),
    surfaces,
    result: "passed",
  };
}
