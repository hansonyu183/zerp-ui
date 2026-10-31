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
