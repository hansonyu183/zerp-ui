import { expect } from "@playwright/test";
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
  await page.getByRole("link", { name: "列表与表单投影", exact: true }).click();
  const projected = page.getByRole("table");
  await expect(
    projected
      .getByRole("columnheader")
      .filter({ hasText: /投影编号|嵌套列|字面列/ }),
  ).toHaveText(["投影编号", "嵌套列", "字面列"]);
  await expect(projected).toContainText("P1");
  await expect(projected).toContainText("嵌套内容");
  await expect(projected).toContainText("字面内容");
  await page.getByRole("link", { name: "客户", exact: true }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  assert.equal(
    await page.getByLabel("信用额度", { exact: true }).inputValue(),
    "12345678901234567890.00",
  );
  await page.getByLabel("客户名称", { exact: true }).fill(" 合成修改客户 ");
  await page.getByRole("button", { name: "整理客户名称", exact: true }).click();
  await expect(page.getByLabel("客户名称", { exact: true })).toHaveValue(
    "合成修改客户",
  );
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
  const childLink = new URL("/customers", page.url());
  childLink.searchParams.set("parent", "a");
  childLink.searchParams.set("section", "contacts");
  childLink.searchParams.set("record", JSON.stringify({ id: "c" }));
  await page.goto(childLink.href);
  await expect(
    page.getByRole("tab", { name: "独立联系人", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.zerp-ui[aria-label="独立联系人"]')).toContainText(
    "30000",
  );
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "独立联系人", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.zerp-ui[aria-label="独立联系人"]')).toContainText(
    "30000",
  );
  await page
    .locator('.zerp-ui[aria-label="独立联系人"]')
    .getByRole("button", { name: "取消编辑", exact: true })
    .click();
  const contactView = page
    .locator('.zerp-ui[aria-label="独立联系人"]')
    .getByRole("link", { name: "查看", exact: true });
  const [newTab] = await Promise.all([
    page.context().waitForEvent("page"),
    contactView.click({ button: "middle" }),
  ]);
  try {
    await expect(
      newTab.getByRole("tab", { name: "独立联系人", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      newTab.locator('.zerp-ui[aria-label="独立联系人"]'),
    ).toContainText("30000");
  } finally {
    await newTab.close();
  }
  await page.goto(deepLink.href);
  await page.getByRole("region", { name: "查看资料", exact: true }).waitFor();
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
  // Account and workbench remain model nodes, reached through library-owned UI.
  await page
    .getByRole("button", { name: "账户：演示账户", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "名称与头像", exact: true }).click();
  await page
    .getByRole("heading", { name: "名称与头像", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("账户名称", { exact: true }).fill("合成新账户");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page
    .getByRole("button", { name: "账户：合成新账户", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "更改密码", exact: true }).click();
  await page.getByLabel("当前密码", { exact: true }).fill("synthetic-old");
  await page.getByLabel("新密码", { exact: true }).fill("synthetic-new");
  await page.getByLabel("确认密码", { exact: true }).fill("synthetic-new");
  await page.getByRole("button", { name: "准备更改密码", exact: true }).click();
  await page.getByRole("button", { name: "确认更改密码", exact: true }).click();
  await page.getByRole("button", { name: "核实原请求", exact: true }).waitFor();
  const encryptedPasswordJournals = await page.evaluate(() =>
    Object.entries(localStorage).filter(([key]) =>
      key.startsWith("zerp-model-password:"),
    ),
  );
  assert.ok(encryptedPasswordJournals.length > 0);
  assert.ok(
    encryptedPasswordJournals.every(
      ([, value]) =>
        !value.includes("synthetic-old") && !value.includes("synthetic-new"),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "核实原请求", exact: true }).click();
  await expect(page.getByLabel("新密码", { exact: true })).toHaveValue("");
  await page.getByRole("link", { name: "工作台与偏好", exact: true }).click();
  await page
    .getByRole("heading", { name: "工作台与偏好", exact: true })
    .waitFor();
  await page.getByLabel("工作台搜索", { exact: true }).fill("客户");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await page.getByRole("button", { name: "更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
  await page.getByLabel("加入工作台", { exact: true }).uncheck();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.getByRole("link", { name: "合成场景", exact: true }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("模拟未知结果", { exact: true }).uncheck();
  await page.getByLabel("撤销客户编辑权限", { exact: true }).check();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.getByText("合成业务资格已更新", { exact: true }).waitFor();
  await page.getByRole("link", { name: "客户", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "编辑", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "合成场景", exact: true }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("撤销客户编辑权限", { exact: true }).uncheck();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.getByRole("link", { name: "客户", exact: true }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("客户名称", { exact: true }).fill("合成字段错误");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("alert", { name: "错误提示", exact: true })
    .getByText("请修改合成名称", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("客户名称", { exact: true }).inputValue(),
    "合成字段错误",
  );
  await page.getByRole("button", { name: "取消编辑", exact: true }).click();
  if (
    await page
      .getByRole("button", { name: "放弃本地修改", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "放弃本地修改", exact: true })
      .click();
  await page
    .getByRole("button", { name: "账户：演示账户", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await page.getByRole("button", { name: "登录", exact: true }).waitFor();
  return {
    synthetic: true,
    paths: [
      "login/ledger/session-restore",
      "customer/nested-independent-save/deep-link",
      "configuration/workbench-preference",
      "unknown/reload/reconcile",
      "account/password/sign-out",
      "reactive-qualification/notification/field-feedback",
    ],
  };
}
