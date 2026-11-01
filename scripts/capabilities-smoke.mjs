import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { assertStableFeedback } from "./feedback-smoke.mjs";
export async function taskMaterialSmoke(page) {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const control = page.getByRole("group", { name: "操作选择", exact: true });
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    assert.ok(box && box.height >= 48, "task action has a 48px hit region");
    for (const y of [2, box.height - 2]) {
      await control.click({ position: { x: box.width / 2, y } });
      await expect(
        page.getByRole("combobox", { name: "操作", exact: true }),
      ).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 1280, height: 1400 });
  const upload = page.getByLabel("读取资源包", { exact: true });
  const value = page.getByRole("textbox", { name: "内容", exact: true });
  for (const content of ["9007199254740993.0100", "再次读取同名文件"]) {
    await upload.setInputFiles({
      name: "synthetic.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ value: content })),
    });
    await expect(value).toHaveValue(content);
    await expect(upload).toHaveValue("");
  }
  await value.fill("合成业务");
}
export async function capabilitiesSmoke(page) {
  await taskMaterialSmoke(page);
  await page.setViewportSize({ width: 1280, height: 1400 });
  await expect(
    page.getByRole("heading", { name: "业务处理", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "准备执行处理", exact: true }),
  ).toBeDisabled();
  // The visible Material file field is the only trigger; the native chooser remains browser-owned.
  const file = page.getByLabel("读取资源包", { exact: true });
  const fileField = file.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' v-field ')][1]",
  );
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 1400 });
    await fileField.scrollIntoViewIfNeeded();
    const box = await fileField.boundingBox();
    assert.ok(
      box && box.width >= 48 && box.height >= 48,
      "file trigger has a 48px effective field",
    );
    const chooser = page.waitForEvent("filechooser");
    await fileField.click({ position: { x: 2, y: box.height / 2 } });
    await (await chooser).setFiles([]);
  }
  await page.setViewportSize({ width: 1280, height: 1400 });
  const messages = page.locator('[aria-label="业务消息"]').first();
  const confirmation = page.getByRole("checkbox", { name: "我已核对业务输入" });
  const prepare = page.getByRole("button", {
    name: "准备执行处理",
    exact: true,
  });
  const controls = [messages, confirmation, prepare];
  await prepare.scrollIntoViewIfNeeded();
  await expect(messages.locator(".zerp-feedback")).toHaveCount(0);
  await assertStableFeedback(page, controls, async () => {
    await confirmation.check();
    await expect(prepare).toBeEnabled();
    await expect(messages.locator(".zerp-feedback")).toHaveCount(2);
  });
  for (const label of ["关闭状态提示", "关闭警告提示"])
    await assertStableFeedback(page, controls, async () => {
      await messages.getByRole("button", { name: label, exact: true }).click();
      await expect(
        messages.getByRole("button", { name: label, exact: true }),
      ).toHaveCount(0);
    });
  const businessInput = "合成业务" + "完整预览内容".repeat(80) + "末尾标记";
  await assertStableFeedback(page, controls, async () => {
    await page
      .getByRole("textbox", { name: "内容", exact: true })
      .fill("合成业务");
    await expect(messages.locator(".zerp-feedback")).toHaveCount(0);
    await expect(confirmation).toBeVisible();
    await expect(prepare).toBeDisabled();
  });
  // Changing the displayed grid data may grow rows; this is separate from feedback-only geometry.
  await page
    .getByRole("textbox", { name: "内容", exact: true })
    .fill(businessInput);
  await expect(prepare).toBeDisabled();
  await confirmation.check();
  await expect(
    page.getByRole("button", { name: "准备执行处理", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "准备执行处理", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "完整办理预览" }),
  ).toContainText(businessInput + " · 已确认");
  await page.setViewportSize({ width: 390, height: 720 });
  await page
    .getByRole("button", { name: "确认执行处理", exact: true })
    .scrollIntoViewIfNeeded();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "long complete preview wraps without page overflow",
  );
  await page.getByRole("button", { name: "确认执行处理", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 1400 });
  await expect(
    page
      .getByRole("status", { name: "状态提示", exact: true })
      .filter({ hasText: "已应用，读取完成；可显式准备新请求。" }),
  ).toBeVisible();
  const base = new URL(page.url()).origin;
  await page.goto(base + "/batch");
  await page.getByRole("button", { name: "建立批次", exact: true }).click();
  await page.getByRole("button", { name: "准备执行处理", exact: true }).click();
  await page.getByRole("button", { name: "确认执行处理", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "继续下一项", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "继续下一项", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "继续下一项", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "第二项", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "停止剩余操作", exact: true }).click();
  await expect(
    page.getByText("第二项 · 已停止", { exact: true }),
  ).toBeVisible();
  await page.goto(base + "/recovery");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page
    .getByRole("textbox", { name: "名称", exact: true })
    .fill("耐久原请求");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "核实本次请求", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "核实本次请求", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "核实本次请求", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "核实本次请求", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "编辑", exact: true }),
  ).toBeEnabled();
  await page.goto(base + "/printing");
  const frame = page.frameLocator('iframe[title="打印预览"]');
  await expect(
    frame.getByText("金额：9007199254740993.0100", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "打开打印窗口", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "操作", exact: true })
    .press("ArrowDown");
  await page.getByRole("option", { name: "打印", exact: true }).click();
  await page.getByRole("button", { name: "准备打印", exact: true }).click();
  await page.getByRole("button", { name: "确认打印", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "打开打印窗口", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "打开打印窗口", exact: true }),
  ).toBeEnabled();
  assert.equal(await frame.locator("script").count(), 0);
}
