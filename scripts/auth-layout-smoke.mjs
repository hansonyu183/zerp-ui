import assert from "node:assert/strict";

/** Public AuthPage: responsive width and real viewport height, including short screens. */
export async function authLayoutSmoke(page) {
  const previous = page.viewportSize();
  try {
    // The preceding shell scenarios can leave the synthetic brand in error.
    const retry = page.getByRole("button", { name: "重试品牌", exact: true });
    if (await retry.count()) {
      await retry.scrollIntoViewIfNeeded();
      await retry.click();
      await retry.waitFor({ state: "hidden" });
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [360, 640],
      [320, 568],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      const card = await page.locator("main.zerp-auth-card").boundingBox();
      const field = await page
        .getByLabel("账号", { exact: true })
        .boundingBox();
      const button = await page
        .getByRole("button", { name: "登录", exact: true })
        .boundingBox();
      assert.ok(card && field && button);
      assert.ok(
        await page
          .locator(".zerp-auth-brand-state")
          .evaluate((element) => element.scrollHeight <= element.clientHeight),
        `${width}px: ready enterprise name is not clipped`,
      );
      assert.ok(
        field.width >= Math.min(300, width - 80),
        `${width}px: usable field width`,
      );
      const dimensions = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      assert.equal(
        dimensions.width,
        width,
        `${width}px: no horizontal overflow`,
      );
      assert.ok(
        card.y >= 0,
        `${width}px: short-screen card starts within the document`,
      );
      if (card.height + 32 <= height) {
        assert.equal(
          dimensions.height,
          height,
          `${width}px: no redundant viewport container`,
        );
        assert.ok(
          button.y + button.height <= height,
          `${width}px: submit fits the first viewport`,
        );
      } else {
        assert.ok(
          dimensions.height > height,
          `${width}px: short content area keeps natural scrolling`,
        );
        await page
          .getByRole("button", { name: "登录", exact: true })
          .scrollIntoViewIfNeeded();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  } finally {
    if (previous) await page.setViewportSize(previous);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}
