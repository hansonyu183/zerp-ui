import assert from "node:assert/strict";
export async function detailsSmoke(page) {
  const unloadBlocked = () =>
    page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.getByText("合成资料 one", { exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox").count(), 0);
  await page.getByText("9007199254740993.0100", { exact: true }).waitFor();
  await button("查看原料 · 明细行 1").click();
  const children = page.getByRole("dialog", {
    name: "原料 · 明细行 1",
    exact: true,
  });
  assert.equal(
    await button("关闭原料").evaluate((el) => document.activeElement === el),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await children
      .locator("summary")
      .evaluate((el) => document.activeElement === el),
    true,
  );
  await page.keyboard.press("Enter");
  await children.getByText("历史异常 1.x", { exact: true }).waitFor();
  assert.equal(await children.getByRole("textbox").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(
    await button("查看原料 · 明细行 1").evaluate(
      (el) => document.activeElement === el,
    ),
    true,
  );
  await page.getByText("历史记录 · history-one", { exact: true }).click();
  await page
    .getByText("历史金额 ?", { exact: true })
    .waitFor({ state: "visible" });
  await button("查看历史引用：采用时名称").click();
  await page
    .getByText("宿主收到引用意图：adopted-one", { exact: true })
    .waitFor();
  await button("编辑资料").click();
  await page.getByLabel("名称", { exact: true }).fill("修改后的合成资料");
  await page.getByRole("link", { name: "离开资料", exact: true }).click();
  assert.equal(await unloadBlocked(), true);
  const dialog = page.getByRole("dialog", { name: "未保存修改", exact: true });
  await dialog.waitFor();
  assert.equal(
    await button("继续编辑").evaluate((el) => document.activeElement === el),
    true,
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await button("放弃本地修改").evaluate(
      (el) => document.activeElement === el,
    ),
    true,
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page.getByLabel("名称", { exact: true }).inputValue(),
    "修改后的合成资料",
  );
  await page.getByRole("link", { name: "离开资料", exact: true }).click();
  await button("放弃本地修改").click();
  await page
    .getByRole("heading", { name: "已离开资料", exact: true })
    .waitFor();
  assert.equal(await unloadBlocked(), false);
  await page.reload();
  await button("模拟结果未知").click();
  await page.getByRole("link", { name: "离开资料", exact: true }).click();
  await page
    .getByText("写入结果未知，须核实原请求后再离开。", { exact: true })
    .waitFor();
  assert.equal(await dialog.count(), 0);
  assert.equal(await button("编辑资料").isDisabled(), true);
  await button("模拟身份失效").click();
  await page
    .getByRole("heading", { name: "身份已失效，资料已清理", exact: true })
    .waitFor();
  assert.equal(await page.getByText("采用时名称", { exact: true }).count(), 0);
  await page.reload();
  await button("编辑资料").click();
  await page.getByLabel("名称", { exact: true }).fill("待丢弃");
  await page.getByRole("link", { name: "离开资料", exact: true }).click();
  await dialog.waitFor();
  // Host revocation must clear both the draft and an already open confirmation.
  await button("模拟身份失效").evaluate((el) => el.click());
  await page
    .getByRole("heading", { name: "身份已失效，资料已清理", exact: true })
    .waitFor();
  assert.equal(await dialog.count(), 0);
  assert.equal(await unloadBlocked(), false);
  await page.reload();
  await page.getByRole("link", { name: "离开资料", exact: true }).click();
  await page
    .getByRole("heading", { name: "已离开资料", exact: true })
    .waitFor();
}
