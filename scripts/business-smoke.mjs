import { expect } from "@playwright/test";
export async function businessSmoke(page) {
  await page.getByLabel("确认已保存", { exact: true }).check();
  await expect(
    page.getByRole("tab", { name: "相关字典", exact: true }),
  ).toBeVisible();
  const root = page.locator('.zerp-ui[aria-label="往来单位"]');
  await expect(
    root.getByRole("cell", { name: "123", exact: true }),
  ).toBeVisible();
  await root.getByRole("button", { name: "编辑", exact: true }).click();
  const parent = page
    .getByRole("region", { name: "编辑资料", exact: true })
    .first();
  await parent
    .getByRole("textbox", { name: "名称", exact: true })
    .fill("保留父草稿");
  await expect(
    parent.getByRole("tab", { name: "空内容", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "分组", exact: true }).click();
  await page.getByRole("tab", { name: "往来单位", exact: true }).click();
  await expect(
    parent.getByRole("textbox", { name: "名称", exact: true }),
  ).toHaveValue("保留父草稿");
  await parent.getByRole("tab", { name: "联系信息", exact: true }).click();
  await parent.getByRole("textbox", { name: "手机", exact: true }).fill("456");
  await parent.getByRole("tab", { name: "属性", exact: true }).click();
  await parent
    .getByRole("combobox", { name: "授权码", exact: true })
    .press("Enter");
  await page.getByRole("option", { name: "修改", exact: true }).click();
  await parent
    .getByRole("textbox", { name: "新的授权码", exact: true })
    .fill("synthetic-secret");
  await parent.getByRole("tab", { name: "联系人", exact: true }).click();
  const contacts = parent.locator('.zerp-ui[aria-label="联系人"]');
  await contacts.getByRole("button", { name: "编辑", exact: true }).click();
  const child = contacts;
  await child
    .getByRole("textbox", { name: "名称", exact: true })
    .fill("更新联系人");
  await page.getByLabel("保存结果", { exact: true }).selectOption("unknown");
  await child.getByRole("button", { name: "保存", exact: true }).click();
  // Nested fixed status text must not intercept the resource recovery button.
  await child
    .getByRole("button", { name: "核实本次请求", exact: true })
    .click();
  await expect(
    child.getByRole("button", { name: "核实本次请求", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("保存结果", { exact: true }).selectOption("success");
  await contacts.getByRole("button", { name: "取消编辑", exact: true }).click();
  await expect(
    contacts.getByRole("cell", { name: "更新联系人", exact: true }),
  ).toBeVisible();
  await parent
    .getByRole("tab", { name: "基本资料", exact: true })
    .first()
    .click();
  await expect(
    parent.getByRole("textbox", { name: "名称", exact: true }),
  ).toHaveValue("保留父草稿");
  await parent.getByRole("combobox", { name: "分类", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "选择分类", exact: true });
  await picker
    .getByRole("button", { name: "浏览总分类下级", exact: true })
    .click();
  await picker.getByRole("button", { name: "子分类", exact: true }).click();
  await parent.getByRole("button", { name: "保存", exact: true }).click();
  await page
    .getByRole("region", { name: "查看资料", exact: true })
    .getByRole("button", { name: "取消编辑", exact: true })
    .click();
  await expect(
    root.getByRole("cell", { name: "保留父草稿", exact: true }),
  ).toBeVisible();
  await expect(
    root.getByRole("cell", { name: "456", exact: true }),
  ).toBeVisible();
  // The uncertain write belongs to the current runtime, not another module resource.
  await page.getByLabel("保存结果", { exact: true }).selectOption("unknown");
  await page.getByLabel("确认已保存", { exact: true }).check();
  await root.getByRole("button", { name: "编辑", exact: true }).click();
  await page
    .getByRole("region", { name: "编辑资料", exact: true })
    .first()
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "核实本次请求", exact: true }).first(),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "核实本次请求", exact: true })
    .first()
    .click();
  await page
    .getByRole("region", { name: "查看资料", exact: true })
    .getByRole("button", { name: "取消编辑", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    root.getByRole("article", { name: "记录 1", exact: true }),
  ).toContainText("保留父草稿");
}
