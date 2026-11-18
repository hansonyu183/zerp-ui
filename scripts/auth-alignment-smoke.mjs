import { expect } from "@playwright/test";

// Public model consumer: the visible controls must share their form edges.
export async function authAlignmentSmoke(page) {
  const measured = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    const controls = [
      page.getByRole("combobox", { name: "账套", exact: true }),
      page.getByRole("textbox", { name: "登录名", exact: true }),
      page.getByRole("textbox", { name: "登录密码", exact: true }),
    ];
    const boxes = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      boxes.push(
        await control.evaluate((element) => {
          const rect = element.closest(".v-field").getBoundingClientRect();
          return { left: rect.left, right: rect.right, height: rect.height };
        }),
      );
    }
    measured.push({ width, boxes });
    expect(
      Math.abs(boxes[0].left - boxes[1].left),
      JSON.stringify(measured),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(boxes[0].right - boxes[1].right),
      JSON.stringify(measured),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[1].left - boxes[2].left)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[1].right - boxes[2].right)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThanOrEqual(1);
    const login = await page
      .getByRole("button", { name: "登录", exact: true })
      .boundingBox();
    expect(Math.abs(login.x - boxes[0].left)).toBeLessThanOrEqual(1);
  }
  return {
    check: "authentication-reference-text-password-alignment",
    measured,
    result: "passed",
  };
}
