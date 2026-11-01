import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { assertStableFeedback } from "./feedback-smoke.mjs";

async function touchTarget(control) {
  const box = await control.boundingBox();
  assert.ok(
    box && box.width >= 48 && box.height >= 48,
    "48px effective target",
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
    "target edges hit the intended control",
  );
}

/** Actual computed foreground against composited ancestor surfaces, without screenshots. */
async function contrast(control) {
  return control.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    const parse = (value) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const pixel = [...context.getImageData(0, 0, 1, 1).data];
      return [...pixel.slice(0, 3), pixel[3] / 255];
    };
    const over = (top, bottom) => {
      const alpha = top[3] ?? 1;
      return top
        .slice(0, 3)
        .map((value, index) => value * alpha + bottom[index] * (1 - alpha));
    };
    let background = [255, 255, 255];
    const ancestors = [];
    for (let current = element; current; current = current.parentElement)
      ancestors.unshift(current);
    for (const current of ancestors)
      background = over(
        parse(getComputedStyle(current).backgroundColor),
        background,
      );
    const color = parse(getComputedStyle(element).color);
    color[3] *= ancestors.reduce(
      (opacity, current) => opacity * Number(getComputedStyle(current).opacity),
      1,
    );
    const foreground = over(color, background);
    const luminance = (rgb) =>
      rgb
        .map((value) => value / 255)
        .map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const a = luminance(foreground),
      b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

/** Representative shared shell/list/feedback states through an installed AppPage consumer. */
export async function materialShellSmoke(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("link", { name: "直接维护", exact: true }).click();
  await page.getByLabel("资料演示", { exact: true }).selectOption("actions");
  await page
    .getByRole("checkbox", { name: "选择 row-actions", exact: true })
    .waitFor();
  for (const preset of [1, 2, 3]) {
    await page.getByRole("button", { name: "主题预设", exact: true }).click();
    const choice = page.getByRole("menuitemradio", {
      name: `Material Design ${preset}`,
      exact: true,
    });
    await choice.click();
    await expect(choice).toBeHidden();
    for (const mode of ["light", "dark"]) {
      if (mode === "dark")
        await page
          .getByRole("button", { name: "切换明暗模式", exact: true })
          .click();
      await expect(
        page.locator(`.zerp-shell.v-theme--zerp-md${preset}-${mode}`),
      ).toBeVisible();
      const selected = page.getByRole("checkbox", {
        name: "选择 row-actions",
        exact: true,
      });
      await selected.check();
      await expect(page.getByLabel("已选记录", { exact: true })).toHaveText(
        "row-actions",
      );
      await selected.uncheck();
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 720 });
        for (const name of [
          "切换导航",
          "主题预设",
          "切换明暗模式",
          "账户：演示账户",
          "查看",
          "编辑",
          "删除",
          "更多操作",
        ]) {
          const control = page.getByRole(
            name === "查看" ? "button" : "button",
            { name, exact: true },
          );
          await control.scrollIntoViewIfNeeded();
          await touchTarget(control);
        }
        await selected.scrollIntoViewIfNeeded();
        await touchTarget(selected);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "wide list scrolls inside the page",
        );
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      const cell = page.getByRole("cell", { name: "合成客户", exact: true });
      await expect
        .poll(() => contrast(cell), {
          message: `MD${preset} ${mode} list text contrast`,
        })
        .toBeGreaterThanOrEqual(4.5);
      const action = page.getByRole("button", { name: "编辑", exact: true });
      assert.ok(
        (await contrast(action.locator("i").first())) >= 3,
        "action icon contrast >= 3:1",
      );
      const theme = page.getByRole("button", { name: "主题预设", exact: true });
      await theme.click();
      const selectedPreset = page.getByRole("menuitemradio", {
        name: `Material Design ${preset}`,
        exact: true,
      });
      await expect(selectedPreset).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(() => contrast(selectedPreset), {
          message: `MD${preset} ${mode} menu text contrast`,
        })
        .toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press("Escape");
      await expect(theme).toBeFocused();
      await assertStableFeedback(page, [theme, action], async () => {
        await page
          .getByRole("button", { name: "模拟品牌失败", exact: true })
          .evaluate((element) => element.click());
        await expect(
          page.getByRole("alert", { name: "错误提示", exact: true }),
        ).toBeVisible();
      });
      const message = page.getByRole("alert", {
        name: "错误提示",
        exact: true,
      });
      assert.ok((await contrast(message)) >= 4.5, "feedback contrast >= 4.5:1");
      await assertStableFeedback(page, [theme, action], async () => {
        await message
          .getByRole("button", { name: "关闭错误提示", exact: true })
          .click();
        await expect(message).toBeHidden();
      });
      await page.reload();
      await page
        .getByLabel("资料演示", { exact: true })
        .selectOption("actions");
      if (mode === "dark")
        await page
          .getByRole("button", { name: "切换明暗模式", exact: true })
          .click();
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
