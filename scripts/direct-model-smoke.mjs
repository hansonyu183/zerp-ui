import assert from "node:assert/strict";
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
      .getByRole("heading", { name: "合成业务示例", exact: true })
      .waitFor();
    await page.getByRole("tab", { name: "概览", exact: true }).waitFor();
    assert.deepEqual(
      callbacks,
      [],
      "constructing and navigating the aggregate must not query its child collection",
    );
    const navigation = page.getByRole("navigation", { name: "业务导航" });
    await expect(
      navigation.getByRole("link", { name: "客户", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "客户", exact: true }).click();
    await page.getByText("合成客户甲", { exact: true }).waitFor();
    await page.getByRole("button", { name: "查看", exact: true }).click();
    await page
      .getByRole("textbox", { name: "客户名称", exact: true })
      .fill("合成客户更新");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByText("已保存：合成客户更新", { exact: true }).waitFor();
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
        name: /^(stageAttachments|暂存附件)$/,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("textbox", { name: "单据状态", exact: true }),
    ).toHaveValue("已暂存 1 个附件");
    await page.getByRole("button", { name: "提交", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "单据状态", exact: true }),
    ).toHaveValue("已提交");
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
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出", exact: true }).click();
    assert.equal((await download).suggestedFilename(), "synthetic-report.csv");
    await navigation
      .getByRole("link", { name: "打印办理", exact: true })
      .click();
    await page.getByRole("button", { name: "预览", exact: true }).click();
    await page.getByRole("button", { name: "确认未打印", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "打印结果", exact: true }),
    ).toHaveValue("已确认未打印");
    for (const name of [
      "customers.query",
      "customer.update",
      "document.approve",
      "voucher.stageAttachments",
      "workflow.advance",
      "batch.executeBatch",
      "report.export",
      "output.preview",
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
