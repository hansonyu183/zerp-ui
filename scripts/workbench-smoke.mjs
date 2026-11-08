import { expect } from "@playwright/test";
export async function workbenchSmoke(page) {
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
