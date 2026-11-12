import assert from "node:assert/strict";
import { expect } from "@playwright/test";

/** Check actual visible bounds; shared by installed consumer interaction smokes. */
export async function assertBelowToolbar(
  page,
  target,
  { withinViewport = true } = {},
) {
  await expect
    .poll(
      async () => {
        const [bar, content] = await Promise.all([
          page.locator(".v-app-bar").boundingBox(),
          target.boundingBox(),
        ]);
        return Boolean(
          bar &&
          content &&
          content.y >= bar.y + bar.height - 1 &&
          (!withinViewport ||
            content.y + content.height <= page.viewportSize().height + 1),
        );
      },
      {
        message:
          "content and overlay bounds stay below the toolbar inside the viewport",
      },
    )
    .toBe(true);
}

/** Public shell behavior, shared by installed tgz and local synthetic example. */
export async function shellInteractionSmoke(page) {
  const toggle = page.getByRole("button", { name: "切换导航", exact: true });
  await expect(toggle).not.toHaveAttribute("title");
  const navigation = page.getByRole("navigation", {
    name: "主导航",
    exact: true,
  });
  await expect(
    navigation
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: /^合成公司业务$/ }) })
      .first()
      .locator("a"),
  ).toHaveText([/直接维护$/, /配置$/, /报表$/, /资料档案$/, /单据$/, /流程$/]);
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
  for (const name of [
    "切换导航",
    "主题预设",
    "切换明暗模式",
    "账户：演示账户",
  ]) {
    const control = page.getByRole("button", { name, exact: true });
    const box = await control.boundingBox();
    assert.ok(
      box && box.width >= 48 && box.height >= 48,
      `${name} has a 48px touch target`,
    );
    assert.ok(
      await control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return [
          [2, box.height / 2],
          [box.width - 2, box.height / 2],
          [box.width / 2, 2],
          [box.width / 2, box.height - 2],
        ].every(([x, y]) =>
          element.contains(document.elementFromPoint(box.x + x, box.y + y)),
        );
      }),
      `${name} touch target edges are hit-testable`,
    );
  }
  // Explicit semantic sections remain intact even below/above the automatic threshold.
  await toggle.click();
  const explicit = navigation.locator(":scope > details").filter({
    has: page.locator(":scope > summary", { hasText: /^编码分组单据$/ }),
  });
  await explicit.locator(":scope > summary").click();
  const purchase = explicit
    .locator("details")
    .filter({ has: page.locator(":scope > summary", { hasText: /^采购$/ }) });
  await expect(purchase.locator("a")).toHaveCount(13);
  await purchase.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(
    purchase.getByRole("link", { name: "A0 合成采购0", exact: true }),
  ).toBeVisible();
  await expect(
    purchase.getByRole("link", { name: "A0 合成采购0", exact: true }),
  ).toHaveAttribute("href", "/direct?type=A0");
  await expect(explicit.locator("details")).toHaveCount(2);
  await expect(
    explicit.getByRole("link", { name: "单据查询", exact: true }),
  ).toBeVisible();
  await explicit.locator(":scope > summary").click();
  await page.keyboard.press("Escape");
  // Same behavior through the installed tgz: native disclosure keyboard and narrow links.
  await toggle.click();
  const longMenu = navigation
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^多项导航$/ }) })
    .first();
  const parentSummary = longMenu.locator(":scope > summary");
  await parentSummary.focus();
  await page.keyboard.press("Enter");
  await expect(longMenu).toHaveAttribute("open", "");
  const customer = longMenu
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^客户$/ }) });
  const customerSummary = customer.locator(":scope > summary");
  await customerSummary.focus();
  await page.keyboard.press("Space");
  await expect(
    customer.getByRole("link", { name: "客户分类", exact: true }),
  ).toBeVisible();
  await expect(
    customer.getByRole("link", { name: "客户分类", exact: true }),
  ).toHaveAttribute("href", "/direct?menu=1");
  assert.equal(await longMenu.locator("a").count(), 13);
  assert.ok(
    await navigation.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  );
  await page.keyboard.press("Space");
  await expect(
    customer.getByRole("link", { name: "客户分类", exact: true }),
  ).toBeHidden();
  await parentSummary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const bar = page.locator(".v-app-bar");
  const belowBar = (locator) =>
    assertBelowToolbar(page, locator, { withinViewport: false });
  const hitToolbar = async () => {
    assert.ok(
      await toggle.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          ),
        );
      }),
      "toolbar toggle remains hit-testable above overlays",
    );
  };
  await belowBar(
    page.getByRole("main").first().getByRole("heading", { level: 1 }).first(),
  );
  await page.getByRole("button", { name: "主题预设", exact: true }).click();
  const preset = page.getByRole("menuitemradio", {
    name: "Material Design 2",
    exact: true,
  });
  await expect(preset).toBeVisible();
  await belowBar(preset);
  await hitToolbar();
  const firstPreset = page.getByRole("menuitemradio", {
    name: "Material Design 1",
    exact: true,
  });
  await firstPreset.focus();
  await page.keyboard.press("ArrowDown");
  await expect(preset).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("menuitemradio", { name: "Material Design 3", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(firstPreset).toBeFocused();
  await preset.click();
  await expect(preset).toBeHidden();
  await page.getByRole("button", { name: "主题预设", exact: true }).click();
  await expect(preset).toHaveAttribute("aria-checked", "true");
  await page
    .getByRole("menuitemradio", { name: "Material Design 3", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: "Material Design 3", exact: true }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "账户：演示账户", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "名称与头像", exact: true }),
  ).toBeVisible();
  await belowBar(
    page.getByRole("menuitem", { name: "名称与头像", exact: true }),
  );
  await hitToolbar();
  await page.getByRole("menuitem", { name: "名称与头像", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "更改密码", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("menuitem", { name: "名称与头像", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "账户：演示账户", exact: true }),
  ).toBeFocused();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await belowBar(navigation);
  await belowBar(page.locator(".v-navigation-drawer__scrim"));
  await hitToolbar();
  await page.keyboard.press("Tab");
  await expect(navigation.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  const group = navigation.locator("details").first();
  await expect(group).not.toHaveAttribute("open");
  await group.locator("summary").click();
  const link = page.getByRole("link", { name: "报表", exact: true });
  const originalURL = page.url();
  const [opened] = await Promise.all([
    page.context().waitForEvent("page"),
    link.click({ modifiers: ["ControlOrMeta"] }),
  ]);
  try {
    await opened.waitForLoadState();
    assert.equal(page.url(), originalURL);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  } finally {
    await opened.close();
  }
  await link.click();
  await expect(
    page.getByRole("heading", { name: "合成报表 · 分批", exact: true }),
  ).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole("link", { name: "流程", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "合成流程运行时", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "流程", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const top = await bar.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => (await bar.boundingBox())?.y).toBe(top?.y);
  await hitToolbar();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 720, height: 320 });
  await expect.poll(async () => (await bar.boundingBox())?.y).toBe(0);
  await hitToolbar();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}
