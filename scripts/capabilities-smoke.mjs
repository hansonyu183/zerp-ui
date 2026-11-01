import assert from "node:assert/strict";
import { expect } from "@playwright/test";
export async function capabilitiesSmoke(page) {
  await expect(
    page.getByRole("heading", { name: "业务处理", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "准备执行处理", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "我已核对业务输入" }).check();
  await expect(
    page.getByRole("button", { name: "准备执行处理", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "准备执行处理", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "完整办理预览" }),
  ).toContainText("合成业务 · 已确认");
  await page.getByRole("button", { name: "确认执行处理", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "准备执行处理", exact: true }),
  ).toBeEnabled();
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
  await page.getByLabel("操作", { exact: true }).selectOption("print");
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
