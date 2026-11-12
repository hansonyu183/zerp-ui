import assert from "node:assert/strict";
export async function modelBusinessSmoke(page) {
  await page.getByRole("heading", { name: "查询分析", exact: true }).waitFor();
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await page
    .getByText("12345678901234567890.10", { exact: true })
    .first()
    .waitFor();
  assert.ok((await page.locator("body").innerText()).includes("权威合计"));
  await page.getByRole("link", { name: "业务办理", exact: true }).click();
  await page.getByRole("button", { name: "准备执行处理", exact: true }).click();
  await page.getByText("权威处理预览", { exact: true }).waitFor();
  await page.getByRole("button", { name: "确认执行处理", exact: true }).click();
  await page.getByRole("button", { name: "核实原请求", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "核实原请求", exact: true }).click();
  await page
    .getByRole("button", { name: "准备执行处理", exact: true })
    .waitFor({ state: "visible" });
  const counts = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith("model-executions:"))
      .map(([, value]) => Number(value)),
  );
  assert.deepEqual(counts, [1]);
  for (const name of [
    "正式候选与附件",
    "单据录入",
    "流程节点",
    "批量办理",
    "图文打印",
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
  }
}
