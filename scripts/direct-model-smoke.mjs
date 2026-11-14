import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
export async function directModelSmoke(page) {
  const callbacks = [];
  const observe = (message) => {
    if (message.text().startsWith("synthetic-call:"))
      callbacks.push(message.text().slice(15));
  };
  page.on("console", observe);
  try {
    await page
      .getByRole("textbox", { name: "登录名", exact: true })
      .fill("admin");
    await page
      .getByRole("textbox", { name: "登录密码", exact: true })
      .fill("synthetic-only");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.getByRole("tab", { name: "概览", exact: true }).waitFor();
    assert.deepEqual(
      callbacks,
      ["session.signIn"],
      "constructing and navigating the aggregate must not query its child collection",
    );
    const navigation = page.getByRole("navigation", { name: "主导航" });
    await expect(
      navigation.getByRole("link", { name: "客户", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "变更记录", exact: true }).click();
    await page.getByText("暂无记录", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "客户", exact: true }).click();
    await page.getByText("合成客户甲", { exact: true }).waitFor();
    await page.getByRole("button", { name: "查看", exact: true }).click();
    await page
      .getByRole("textbox", { name: "客户名称", exact: true })
      .fill("合成客户更新");
    const category = page.getByRole("combobox", {
      name: "客户分类",
      exact: true,
    });
    await category.click();
    await page.getByRole("button", { name: "下一页引用", exact: true }).click();
    await page.getByRole("option", { name: "分类21", exact: true }).click();
    await category.click();
    await category.fill("分类45");
    await page.getByRole("option", { name: "分类45", exact: true }).click();
    assert.equal(callbacks.filter((name) => name === "catalog.load").length, 1);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByText("已保存：合成客户更新", { exact: true }).waitFor();
    await page
      .getByRole("textbox", { name: "关键词", exact: true })
      .fill("失败");
    await page.getByRole("button", { name: "查询", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "操作失败" }).waitFor();
    await expect(
      page.getByRole("textbox", { name: "客户名称", exact: true }),
    ).toHaveValue("合成客户更新");

    await navigation
      .getByRole("link", { name: "资料办理", exact: true })
      .click();
    await page.getByRole("button", { name: "提交", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "资料状态", exact: true }),
    ).toHaveValue("待审批");
    await page.getByRole("button", { name: "审批", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "资料状态", exact: true }),
    ).toHaveValue("已生效");
    await navigation
      .getByRole("link", { name: "单据办理", exact: true })
      .click();
    await page.getByRole("textbox", { name: "数量", exact: true }).fill("3");
    await page
      .getByRole("button", { name: /^(calculate|计算)$/, exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "金额", exact: true }),
    ).toHaveValue("30.00");
    await page.locator('input[type="file"]').setInputFiles({
      name: "synthetic.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("synthetic attachment"),
    });
    await page
      .getByRole("button", {
        name: /^(stageAttachments|暂存附件|上传附件)$/,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("textbox", { name: "单据状态", exact: true }),
    ).toHaveValue("已暂存 1 个附件");
    await page
      .getByRole("textbox", { name: "标签值", exact: true })
      .fill("更新标签");
    await page.getByRole("combobox", { name: "关联值", exact: true }).click();
    await page.getByRole("option", { name: "合成关联", exact: true }).click();
    await page.getByRole("button", { name: "提交", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "单据状态", exact: true }),
    ).toHaveValue("已提交：更新标签/合成关联");
    await navigation
      .getByRole("link", { name: "流程办理", exact: true })
      .click();
    await page
      .getByRole("button", { name: /^(start|启动)$/, exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "流程状态", exact: true }),
    ).toHaveValue("办理中");
    await page
      .getByRole("button", { name: /^(advance|推进|流转)$/, exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "流程状态", exact: true }),
    ).toHaveValue("已完成");
    await navigation
      .getByRole("link", { name: "批量办理", exact: true })
      .click();
    await page.getByRole("button", { name: "执行批次", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "项结果", exact: true }),
    ).toHaveValue("成功");
    await navigation
      .getByRole("link", { name: "业务查询", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "查询数量", exact: true })
      .fill("4");
    await page
      .getByRole("button", { name: /^(calculate|计算)$/, exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "查询合计", exact: true }),
    ).toHaveValue("40.00");
    await page
      .getByRole("textbox", { name: "计算系数", exact: true })
      .fill("5");
    await page
      .getByRole("button", { name: /^(calculate|计算)$/, exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "查询合计", exact: true }),
    ).toHaveValue("20.00");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const artifact = await download;
    assert.equal(artifact.suggestedFilename(), "synthetic-report.csv");
    assert.equal(
      await readFile(await artifact.path(), "utf8"),
      "合计\n20.00\n",
    );
    await navigation
      .getByRole("link", { name: "打印办理", exact: true })
      .click();
    await page.getByRole("button", { name: "预览", exact: true }).click();
    await page
      .frameLocator('iframe[title="打印预览"]')
      .getByText("Synthetic output 154", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "打开打印窗口", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "打印结果", exact: true }),
    ).toHaveValue("等待打印确认");
    await page.getByRole("button", { name: "确认未打印", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "打印结果", exact: true }),
    ).toHaveValue("已确认未打印");
    await page
      .getByRole("button", { name: "账户：合成用户", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "名称与头像", exact: true })
      .click();
    await expect(
      page.getByRole("menu", { name: "账户菜单", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("textbox", { name: "用户姓名", exact: true }),
    ).toHaveValue("合成用户");
    await page
      .getByRole("button", { name: "账户：合成用户", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "更改密码", exact: true }).click();
    await expect(
      page.getByRole("menu", { name: "账户菜单", exact: true }),
    ).toBeHidden();
    await page
      .getByRole("textbox", { name: "新密码", exact: true })
      .fill("synthetic-next");
    await page.getByRole("button", { name: "修改密码", exact: true }).click();
    await page.getByText("合成密码已更新", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "账户：合成用户", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
    await expect(
      page.getByRole("menu", { name: "账户菜单", exact: true }),
    ).toBeHidden();
    await page
      .getByRole("textbox", { name: "登录名", exact: true })
      .fill("viewer");
    await page
      .getByRole("textbox", { name: "登录密码", exact: true })
      .fill("synthetic-only");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      navigation.getByRole("link", { name: "单据办理", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "客户", exact: true }).click();
    await page.getByRole("button", { name: "查看", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "保存", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "额度", exact: true }),
    ).toHaveCount(0);
    for (const name of [
      "customers.query",
      "customer.update",
      "document.approve",
      "voucher.stageAttachments",
      "workflow.advance",
      "batch.executeBatch",
      "report.export",
      "output.preview",
      "output.print",
      "account.profile",
      "account.changePassword",
      "session.signOut",
    ])
      assert.ok(callbacks.includes(name), `missing business callback: ${name}`);
    return {
      directBusinessModel: true,
      aggregateProjection: true,
      callbacks,
      syntheticOnly: true,
    };
  } finally {
    page.off("console", observe);
  }
}
