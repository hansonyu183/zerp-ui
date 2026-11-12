import assert from "node:assert/strict";
export async function modelSmoke(page) {
  await page
    .getByRole("heading", { name: "模型驱动客户应用", exact: true })
    .waitFor();
  await page.getByLabel("操作员", { exact: true }).fill("synthetic-user");
  await page.getByLabel("密码", { exact: true }).fill("synthetic-password");
  await page.getByLabel("账套", { exact: true }).click();
  await page.getByText("合成账套", { exact: true }).click();
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("heading", { name: "客户", exact: true }).waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  assert.equal(
    await page.getByLabel("信用额度", { exact: true }).inputValue(),
    "12345678901234567890.00",
  );
  await page.getByLabel("客户名称", { exact: true }).fill("合成修改客户");
  await page.getByLabel("外部编号", { exact: true }).fill("含点键修改");
  await page.getByRole("tab", { name: "独立联系人", exact: true }).click();
  const contacts = page.locator('.zerp-ui[aria-label="独立联系人"]');
  await contacts.getByRole("button", { name: "编辑", exact: true }).click();
  await contacts.getByLabel("联系人电话", { exact: true }).fill("30000");
  await contacts.getByRole("button", { name: "保存", exact: true }).click();
  await contacts.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page
    .getByRole("tab", { name: "基本资料", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("region", { name: "查看资料", exact: true })
    .getByRole("button", { name: "编辑", exact: true })
    .waitFor();
  assert.ok((await page.locator("body").innerText()).includes("合成修改客户"));
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  const deepLink = new URL("/customers", page.url());
  deepLink.searchParams.set("record", JSON.stringify({ id: "a" }));
  await page.goto(deepLink.href);
  await page.getByRole("region", { name: "查看资料", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("region", { name: "查看资料", exact: true }).waitFor();
  assert.ok((await page.locator("body").innerText()).includes("合成修改客户"));
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page
    .getByRole("link", { name: "配置与工作台偏好", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "配置与工作台偏好", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("工作台常用项", { exact: true }).fill("客户、配置");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.getByRole("link", { name: "客户", exact: true }).click();
  await page.waitForURL("**/customers");
  await page.getByRole("link", { name: "合成场景", exact: true }).click();
  await page.getByRole("heading", { name: "合成场景", exact: true }).waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("模拟未知结果", { exact: true }).check();
  await page.getByLabel("确认原请求已应用", { exact: true }).check();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.getByRole("link", { name: "客户", exact: true }).click();
  await page.getByRole("heading", { name: "客户", exact: true }).waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("客户名称", { exact: true }).fill("待核实客户");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("button", { name: "核实本次请求", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "重试读取", exact: true }).click();
  await page
    .getByRole("button", { name: "核实本次请求", exact: true })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "核实本次请求", exact: true }).click();
  await page
    .getByRole("button", { name: "核实本次请求", exact: true })
    .waitFor({ state: "hidden" });
  assert.ok((await page.locator("body").innerText()).includes("待核实客户"));
  assert.equal(
    await page
      .getByRole("button", { name: "核实本次请求", exact: true })
      .count(),
    0,
  );
  await page.getByRole("heading", { name: "客户", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "登录", exact: true }).count(),
    0,
  );
}
