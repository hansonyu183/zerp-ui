import { expect } from "@playwright/test";
/** Public AppPage behavior of the synthetic complex consumer, also run after tgz installation. */
export async function complexDraftSmoke(page) {
  await page.goto(new URL("/complex", page.url()).href);
  await expect(
    page.getByRole("heading", { name: "复杂资料协作", exact: true }),
  ).toBeVisible();
  const save = page.getByRole("button", { name: "保存", exact: true });
  await expect(
    page.getByRole("textbox", { name: "合计结果", exact: true }),
  ).toHaveValue("1.2300");
  await expect(page.getByLabel("仓库", { exact: true })).toHaveValue(
    "历史仓库",
  );
  await expect(page.getByText("目录新仓库名", { exact: true })).toHaveCount(0);
  await expect(save).toBeDisabled();
  await page
    .getByRole("textbox", { name: "单位数量", exact: true })
    .first()
    .fill("-");
  await expect(save).toBeDisabled();
  await page
    .getByRole("textbox", { name: "单位数量", exact: true })
    .first()
    .fill("0");
  await page
    .getByRole("textbox", { name: "换算比", exact: true })
    .first()
    .fill("9007199254740993.0100");
  await page
    .getByRole("textbox", { name: "价格金额", exact: true })
    .fill("999.00");
  await page
    .getByRole("textbox", { name: "价格金额", exact: true })
    .fill("1.2300");
  await page
    .getByRole("button", { name: "编辑配料 · 明细行 2", exact: true })
    .click();
  const child = page.getByRole("dialog", {
    name: "配料 · 明细行 2",
    exact: true,
  });
  await child.getByRole("button", { name: "新增", exact: true }).click();
  await expect(
    child.getByRole("button", { name: "确定配料", exact: true }),
  ).toBeDisabled();
  await child
    .getByRole("textbox", { name: "配料名", exact: true })
    .fill("合成烟测配料");
  await child
    .getByRole("textbox", { name: "配料比例", exact: true })
    .fill("0.0000001");
  await child.getByRole("button", { name: "确定配料", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "核对计算结果", exact: true })
    .check();
  await expect(save).toBeDisabled();
  await page
    .getByRole("textbox", { name: "计算说明", exact: true })
    .fill("合成工件核对");
  await page.getByRole("textbox", { name: "计算说明", exact: true }).blur();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByRole("region", { name: "编辑资料", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const detail = page.getByRole("region", { name: "查看资料", exact: true });
  await expect(detail).toContainText("9007199254740993.0100");
  await expect(detail).toContainText("历史仓库");
  await expect(detail).toContainText("1.2300");
  await expect(detail).not.toContainText("999.00");
  await expect(detail).toContainText("合成工件核对");
  await page
    .getByRole("button", { name: "查看配料 · 明细行 2", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "配料 · 明细行 2", exact: true }),
  ).toContainText("合成烟测配料");
  await page.getByRole("button", { name: "关闭配料", exact: true }).click();
}
