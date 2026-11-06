import assert from "node:assert/strict";
import { expect } from "@playwright/test";
export async function groupedFactsSmoke(page) {
  await page
    .getByRole("button", { name: "查看字段分组示例", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "查看资料", exact: true });
  await expect(dialog).toBeVisible();
  const tab = (name) => dialog.getByRole("tab", { name, exact: true });
  await expect(tab("基本资料")).toHaveAttribute("aria-selected", "true");
  assert.deepEqual(await dialog.getByRole("tab").allTextContents(), [
    "基本资料",
    "背景与备注",
    "其他",
  ]);
  assert.equal(await dialog.locator("fieldset").count(), 0);
  assert.equal(await dialog.getByText("synthetic-hidden").count(), 0);
  await expect(dialog.getByText("合成客户甲", { exact: true })).toBeVisible();
  assert.deepEqual(await dialog.locator("dd").allTextContents(), [
    "合成客户甲",
    "one",
    "0",
    "否",
    "（空字符串）",
    "—",
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  const container = dialog.locator(".zerp-facts-container").first();
  for (const [width, columns] of [
    [940, 3],
    [700, 2],
    [320, 1],
  ]) {
    await container.evaluate((el, width) => {
      el.style.inlineSize = `${width}px`;
    }, width);
    await expect
      .poll(() =>
        container
          .locator(":scope > .zerp-facts")
          .evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
          ),
      )
      .toBe(columns);
  }
  await container.evaluate((el) => el.style.removeProperty("inline-size"));
  await tab("背景与备注").click();
  await expect(dialog.getByText(/背景第一行/)).toBeVisible();
  const wide = dialog.locator(".zerp-fact--wide");
  assert.equal(await wide.count(), 2);
  for (const el of await wide.all())
    await expect(el).toHaveCSS("grid-column", "1 / -1");
  assert.equal(
    await dialog.getByText("合成客户甲", { exact: true }).count(),
    1,
  ); // hidden first panel only; not duplicated in second group
  await tab("其他").click();
  await expect(dialog.getByText("未归组原值", { exact: true })).toBeVisible();
  await tab("基本资料").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab("背景与备注")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tab("背景与备注")).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 390, height: 800 });
  await tab("其他").click();
  await expect(tab("其他")).toBeInViewport();
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  await dialog.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.getByRole("button", { name: "查看", exact: true }).nth(1).click();
  await expect(tab("基本资料")).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByText("合成客户乙", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "编辑资料", exact: true });
  await expect(
    editor.getByRole("textbox", { name: "客户名称", exact: true }),
  ).toHaveValue("合成客户乙");
  const editTab = (name) => editor.getByRole("tab", { name, exact: true });
  await expect(editor.getByRole("tab")).toHaveCount(4); // passwords stay editable
  const name = editor.getByRole("textbox", { name: "客户名称", exact: true });
  const count = editor.getByRole("textbox", { name: "零值", exact: true });
  const save = editor.getByRole("button", { name: "保存", exact: true });
  await name.fill("分组编辑客户");
  await count.fill("-");
  await editTab("背景与备注").click();
  const note = editor.getByRole("textbox", { name: "背景信息", exact: true });
  await note.fill("跨 Tab 备注\n第二行");
  await expect(save).toBeDisabled();
  await expect(editTab("基本资料")).toContainText("1项待完善");
  await editTab("其他").click();
  const other = editor.getByRole("textbox", { name: "新增字段", exact: true });
  await other.fill("");
  await editTab("基本资料").click();
  await expect(count).toHaveValue("-");
  await expect(name).toHaveValue("分组编辑客户");
  await count.fill("12");
  await save.click(); // required field on a hidden panel rejects the whole save
  await expect(page.locator('output[aria-label="分组保存内容"]')).toBeEmpty();
  await expect(editTab("其他")).toContainText("1项待完善");
  await page.getByRole("button", { name: "关闭错误提示", exact: true }).click();
  await editor.getByRole("button", { name: "取消编辑", exact: true }).click();
  const guard = page.getByRole("dialog", { name: "未保存修改", exact: true });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "继续编辑", exact: true }).click();
  await editTab("其他").click();
  await other.fill("已完善");
  await editTab("背景与备注").click();
  await expect(note).toHaveValue("跨 Tab 备注\n第二行");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.locator('output[aria-label="分组保存内容"]')).toContainText(
    "分组编辑客户",
  );
  const saved = JSON.parse(
    await page.locator('output[aria-label="分组保存内容"]').textContent(),
  );
  assert.deepEqual(saved, {
    values: {
      name: "分组编辑客户",
      code: "two",
      zero: 12,
      enabled: false,
      empty: "",
      note: "跨 Tab 备注\n第二行",
      tags: ["合成标签"],
      password: "synthetic-hidden",
      other: "已完善",
    },
  });
  await page.getByRole("button", { name: "关闭状态提示", exact: true }).click();
  await page.getByRole("button", { name: "查看", exact: true }).first().click();
  await expect(tab("基本资料")).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("button", { name: "取消编辑", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
}
