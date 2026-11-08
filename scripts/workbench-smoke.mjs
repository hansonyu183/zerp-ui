import { expect } from "@playwright/test";
/** Workbench rendering regression: semantic links, real theme changes, and 1 + 3 geometry. */
export async function workbenchPresentationSmoke(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL("/", page.url()).href);
  const info = page.getByRole("region", { name: "重要信息", exact: true });
  const sections = ["常用单据", "常用报表", "常用资料"].map((name) =>
    page.getByRole("region", { name, exact: true }),
  );
  await expect(info).toBeVisible();
  const boxes = await Promise.all(
    [info, ...sections].map((item) => item.boundingBox()),
  );
  expect(boxes[0].y + boxes[0].height).toBeLessThanOrEqual(boxes[1].y);
  expect(Math.abs(boxes[1].y - boxes[2].y)).toBeLessThan(2);
  expect(Math.abs(boxes[2].y - boxes[3].y)).toBeLessThan(2);
  expect(Math.abs(boxes[1].width - boxes[2].width)).toBeLessThan(2);
  expect(Math.abs(boxes[2].width - boxes[3].width)).toBeLessThan(2);
  expect(Math.abs(boxes[0].x - boxes[1].x)).toBeLessThan(2);
  expect(
    Math.abs(boxes[0].x + boxes[0].width - boxes[3].x - boxes[3].width),
  ).toBeLessThan(2);
  const link = page.getByRole("link", { name: "合成单据0", exact: true });
  await expect(link).toHaveClass(/v-list-item/);
  await expect(link).toHaveCSS("text-decoration-line", "none");
  const styles = [];
  const buttonRadii = [];
  for (const preset of [1, 2, 3]) {
    await page.getByRole("button", { name: "主题预设", exact: true }).click();
    await page
      .getByRole("menuitemradio", {
        name: `Material Design ${preset}`,
        exact: true,
      })
      .click();
    for (const mode of ["light", "dark"]) {
      if (
        !(await page
          .locator(`.zerp-shell.v-theme--zerp-md${preset}-${mode}`)
          .count())
      )
        await page
          .getByRole("button", { name: "切换明暗模式", exact: true })
          .click();
      await expect(
        page.locator(`.zerp-shell.v-theme--zerp-md${preset}-${mode}`),
      ).toBeVisible();
      const surface = await info.evaluate(
        (element) =>
          `rgb(${getComputedStyle(element)
            .getPropertyValue("--v-theme-surface")
            .split(",")
            .map((value) => value.trim())
            .join(", ")})`,
      );
      await expect(info).toHaveCSS("background-color", surface);
      const style = await info.evaluate((element) => {
        const css = getComputedStyle(element);
        return {
          radius: css.borderTopLeftRadius,
          background: css.backgroundColor,
          shadow: css.boxShadow,
        };
      });
      if (mode === "light") {
        styles.push(style);
        buttonRadii.push(
          await page
            .getByRole("button", { name: "展开全部", exact: true })
            .evaluate(
              (element) => getComputedStyle(element).borderTopLeftRadius,
            ),
        );
      } else
        await expect
          .poll(async () =>
            info.evaluate(
              (element) => getComputedStyle(element).backgroundColor,
            ),
          )
          .not.toBe(styles.at(-1).background);
      await expect(link).toHaveCSS("text-decoration-line", "none");
    }
  }
  // Official MD1/MD2/MD3 card defaults must remain observable, rather than overridden by this page.
  expect(new Set(styles.map((style) => style.radius)).size).toBe(3);
  expect(new Set(buttonRadii).size).toBe(3);
  console.log(
    "Workbench Material defaults",
    JSON.stringify({ cards: styles, buttonRadii }),
  );
  await page.getByRole("button", { name: "切换明暗模式", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 800 });
  const mobile = await Promise.all(
    [info, ...sections].map((item) => item.boundingBox()),
  );
  for (let index = 1; index < mobile.length; index++)
    expect(mobile[index].y).toBeGreaterThanOrEqual(
      mobile[index - 1].y + mobile[index - 1].height - 1,
    );
}
export async function workbenchSmoke(page) {
  await workbenchPresentationSmoke(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(new URL("/", page.url()).href);
    await expect(
      page.getByRole("heading", { name: "工作台", exact: true }),
    ).toBeVisible();
    for (const name of ["常用单据", "常用报表", "常用资料", "重要信息"])
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "合成单据12", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "展开全部", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "合成单据12", exact: true }),
    ).toHaveAttribute("href", "/voucher/12");
    await page.getByRole("button", { name: "收起", exact: true }).click();
    const link = page.getByRole("link", { name: "合成单据0", exact: true });
    const popupPromise = page.context().waitForEvent("page");
    await link.click({ modifiers: ["ControlOrMeta"] });
    const popup = await popupPromise;
    try {
      await popup.waitForURL("**/voucher/0");
      expect(new URL(popup.url()).pathname).toBe("/voucher/0");
    } finally {
      await popup.close();
    }
    await page.getByRole("link", { name: "管理常用报表", exact: true }).click();
    await page
      .getByRole("textbox", { name: "名称", exact: true })
      .fill("合成报表51");
    await page
      .getByRole("button", { name: "添加：合成报表51", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "移除：合成报表51", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await page
      .getByRole("textbox", { name: "名称", exact: true })
      .fill("合成报表51");
    await expect(
      page.getByRole("button", { name: "移除：合成报表51", exact: true }),
    ).toBeEnabled();
    await page.goto(new URL("/", page.url()).href);
    await expect(
      page.getByRole("link", { name: "合成报表51", exact: true }),
    ).toHaveAttribute("href", "/report/51");
    await page.getByRole("link", { name: "管理常用报表", exact: true }).click();
    await page
      .getByRole("textbox", { name: "名称", exact: true })
      .fill("合成报表51");
    await page
      .getByRole("button", { name: "移除：合成报表51", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "添加：合成报表51", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
}
