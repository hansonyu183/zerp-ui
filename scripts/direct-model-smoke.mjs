import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  directPresentationSmoke,
  workbenchPresentationSmoke,
} from "./direct-presentation-smoke.mjs";
export async function directModelSmoke(page) {
  const callbacks = [];
  const observe = (message) => {
    if (message.text().startsWith("synthetic-call:"))
      callbacks.push(message.text().slice(15));
  };
  page.on("console", observe);
  const navigation = page.getByRole("navigation", { name: "主导航" });
  const visit = async (label) => {
    const link = navigation.getByRole("link", {
      name: label === "空集合" ? "E 空集合" : label,
      exact: true,
    });
    if (
      (await navigation.locator("details").first().getAttribute("open")) ===
      null
    )
      await navigation.getByText("业务", { exact: true }).click();
    if (!(await link.isVisible()))
      await navigation.getByText("示例分类", { exact: true }).click();
    await link.click();
  };
  const open = async (action = "编辑") => {
    await page
      .getByRole("button", { name: action, exact: true })
      .first()
      .click();
    return page.getByRole("dialog");
  };
  const close = async () => {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "关闭", exact: true })
      .click();
  };
  try {
    await page
      .getByRole("textbox", { name: "登录名", exact: true })
      .fill("admin");
    await page
      .getByRole("textbox", { name: "登录密码", exact: true })
      .fill("synthetic-only");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await workbenchPresentationSmoke(page);
    assert.equal(
      callbacks.filter((name) => name === "workbench.load").length,
      1,
    );
    assert.equal(
      callbacks.filter((name) => name.endsWith(".query")).length,
      0,
      "homepage must not query unvisited collections",
    );
    const workbench = page.locator(".zerp-workbench");
    const recentCustomer = workbench.getByRole("link", {
      name: "客户",
      exact: true,
    });
    await expect(recentCustomer).toHaveAttribute(
      "href",
      "/business/customers?id=customer-off-page",
    );
    await expect(
      workbench.getByRole("link", { name: "管理常用报表", exact: true }),
    ).toHaveAttribute("href", "/business/reports");
    await recentCustomer.click();
    await expect(page).toHaveURL(
      /\/business\/customers\?id=customer-off-page$/,
    );
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "客户名称", exact: true }),
    ).toHaveValue("外页合成客户");
    await close();
    await expect(page.getByText("合成客户甲", { exact: true })).toBeVisible();
    await page.locator(".zerp-shell-brand").click();
    await expect(workbench).toBeVisible();
    await workbench
      .getByRole("link", { name: "管理常用报表", exact: true })
      .click();
    await expect(page).toHaveURL(/\/business\/reports$/);
    await visit("空集合");
    await expect(
      page.getByRole("columnheader", { name: "空集合列标题", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("暂无记录", { exact: true })).toBeVisible();
    await visit("客户");
    await expect(page.getByText("合成客户甲", { exact: true })).toBeVisible();
    const presentation = await directPresentationSmoke(page);
    let dialog = await open();
    await dialog
      .getByRole("textbox", { name: "客户名称", exact: true })
      .fill("合成客户更新");
    const category = dialog.getByRole("combobox", {
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
    await dialog
      .getByRole("textbox", { name: "客户名称", exact: true })
      .fill("临时目录范围");
    await category.click();
    await expect(
      page.getByRole("option", { name: "分类1", exact: true }),
    ).toBeVisible();
    assert.equal(callbacks.filter((name) => name === "catalog.load").length, 2);
    await category.press("Escape");
    await dialog
      .getByRole("textbox", { name: "客户名称", exact: true })
      .fill("合成客户更新");
    const nameBox = await dialog
      .getByRole("textbox", { name: "客户名称", exact: true })
      .boundingBox();
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      page.getByText("已保存：合成客户更新", { exact: true }),
    ).toBeVisible();
    expect(
      Math.abs(
        (
          await dialog
            .getByRole("textbox", { name: "客户名称", exact: true })
            .boundingBox()
        ).y - nameBox.y,
      ),
    ).toBeLessThan(1);
    const settlement = dialog.getByRole("tab", { name: "结算", exact: true }),
      contacts = dialog.getByRole("tab", { name: "联系人", exact: true });
    await expect(settlement).toHaveAttribute("aria-selected", "true");
    await settlement.focus();
    await settlement.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(contacts).toHaveAttribute("aria-selected", "true");
    const contact = dialog
      .getByRole("textbox", { name: "联系人姓名", exact: true })
      .first();
    await contact.fill("更新联系人");
    await settlement.click();
    await contacts.click();
    await expect(contact).toHaveValue("更新联系人");
    const rowPrint = page
      .getByRole("table")
      .getByRole("button", { name: "打印", exact: true });
    await expect(rowPrint).toBeDisabled();
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(rowPrint).toBeEnabled();
    await close();
    await rowPrint.click();
    const itemPreview = page.getByRole("dialog", {
      name: "客户打印",
      exact: true,
    });
    await expect(
      itemPreview
        .frameLocator('iframe[title="打印预览"]')
        .getByText("合成客户更新", { exact: true }),
    ).toBeVisible();
    await itemPreview
      .getByRole("button", { name: "关闭", exact: true })
      .click();
    await close();
    await page.getByRole("button", { name: "当前页打印", exact: true }).click();
    const pagePreview = page.getByRole("dialog", {
      name: "当前页打印",
      exact: true,
    });
    await expect(
      pagePreview
        .frameLocator('iframe[title="打印预览"]')
        .getByText("合成客户更新", { exact: true }),
    ).toBeVisible();
    await pagePreview
      .getByRole("button", { name: "关闭", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "关键词", exact: true })
      .fill("失败");
    await page.getByRole("button", { name: "查询", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "操作失败" }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "关键词", exact: true })
      .fill("retained");
    await visit("单据");
    dialog = await open();
    await dialog.getByRole("tab", { name: "单据明细", exact: true }).click();
    await dialog.getByRole("textbox", { name: "数量", exact: true }).fill("3");
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "单据状态", exact: true }),
    ).toHaveValue("已保存数量 3");
    await dialog.getByRole("button", { name: "提交", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "单据状态", exact: true }),
    ).toHaveValue("已提交");
    await close();
    for (const [label, actions] of [
      [
        "资料办理",
        [
          ["提交", "资料状态", "待审批"],
          ["审批", "资料状态", "已生效"],
        ],
      ],
      [
        "流程办理",
        [
          ["启动", "流程状态", "办理中"],
          ["推进", "流程状态", "已完成"],
        ],
      ],
      ["批量办理", [["执行批次", "项结果", "成功"]]],
      [
        "业务处理",
        [
          ["校验", "处理状态", "校验通过"],
          ["运行", "处理状态", "执行完成"],
        ],
      ],
    ]) {
      await visit(label);
      dialog = await open();
      for (const [action, field, expected] of actions) {
        await dialog.getByRole("button", { name: action, exact: true }).click();
        await expect(
          dialog.getByRole("textbox", { name: field, exact: true }),
        ).toHaveValue(expected);
      }
      await close();
    }
    await visit("业务查询");
    dialog = await open();
    await dialog
      .getByRole("textbox", { name: "查询数量", exact: true })
      .fill("4");
    await dialog
      .getByRole("textbox", { name: "计算系数", exact: true })
      .fill("5");
    await dialog.getByRole("button", { name: "计算", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "查询合计", exact: true }),
    ).toHaveValue("20.00");
    await dialog
      .getByRole("textbox", { name: "查询数量", exact: true })
      .fill("6");
    await dialog.getByRole("button", { name: "菜单计算", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "查询合计", exact: true }),
    ).toHaveValue("30.00");
    await dialog
      .getByRole("textbox", { name: "查询数量", exact: true })
      .fill("4");
    await dialog.getByRole("button", { name: "树计算", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "查询合计", exact: true }),
    ).toHaveValue("20.00");
    const pendingDownload = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "下载脚本结果", exact: true })
      .click();
    const download = await pendingDownload;
    assert.equal(
      await readFile(await download.path(), "utf8"),
      "合计\n20.00\n",
    );
    const exportCount = callbacks.filter(
      (name) => name === "report.export",
    ).length;
    for (const name of ["甲", "乙"]) {
      const pending = page.waitForEvent("download");
      await dialog
        .getByRole("button", { name: `下载文件${name}`, exact: true })
        .click();
      const file = await pending;
      assert.equal(file.suggestedFilename(), `synthetic-${name}.csv`);
      assert.equal(
        await readFile(await file.path(), "utf8"),
        `独立文件${name}\n`,
      );
      assert.equal(
        callbacks.filter((call) => call === `script.file.${name}`).length,
        1,
      );
    }
    assert.equal(
      callbacks.filter((name) => name === "report.export").length,
      exportCount,
    );
    await close();
    await visit("结构化报表");
    await expect(
      page.getByRole("rowgroup", { name: "销售总计", exact: true }),
    ).toContainText("12345678901234567890.10");
    await page
      .getByRole("textbox", { name: "查询期间", exact: true })
      .fill("2026-10");
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    const bottom = page.getByRole("link", {
      name: "打开底部凭证",
      exact: true,
    });
    await bottom.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => window.scrollY);
    const reads = callbacks.filter(
      (name) => name === "structured.query",
    ).length;
    await bottom.click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "关联凭证编号", exact: true }),
    ).toHaveValue("S-001");
    await close();
    await page.goBack();
    await expect(
      page.getByRole("textbox", { name: "查询期间", exact: true }),
    ).toHaveValue("2026-10");
    assert.equal(
      callbacks.filter((name) => name === "structured.query").length,
      reads,
    );
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
    await visit("打印办理");
    dialog = await open("查看");
    await dialog.getByRole("button", { name: "预览", exact: true }).click();
    await page
      .frameLocator('iframe[title="打印预览"]')
      .getByText("Synthetic output 159", { exact: true })
      .waitFor();
    await dialog
      .getByRole("button", { name: "打开打印窗口", exact: true })
      .click();
    await expect(
      dialog.getByRole("textbox", { name: "打印结果", exact: true }),
    ).toHaveValue("等待打印确认");
    await dialog
      .getByRole("button", { name: "确认未打印", exact: true })
      .click();
    await expect(
      dialog.getByRole("textbox", { name: "打印结果", exact: true }),
    ).toHaveValue("已确认未打印");
    await close();
    await page
      .getByRole("button", { name: "账户：合成用户", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "名称与头像", exact: true })
      .click();
    await expect(page.locator('[aria-label="账户菜单"]')).toBeHidden();
    dialog = page.locator(".zerp-shell");
    await expect(
      dialog.getByRole("textbox", { name: "用户姓名", exact: true }),
    ).toHaveValue("合成用户");
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "密钥提交结果", exact: true }),
    ).toHaveValue("已保留密钥");
    await page
      .getByRole("button", { name: "账户：合成用户", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "更改密码", exact: true }).click();
    await expect(page.locator('[aria-label="账户菜单"]')).toBeHidden();
    dialog = page.locator(".zerp-shell");
    await dialog
      .getByRole("textbox", { name: "新密码", exact: true })
      .fill("synthetic-next");
    await dialog.getByRole("button", { name: "修改密码", exact: true }).click();
    await expect(
      page.getByText("合成密码已更新", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "账户：合成用户", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
    await page
      .getByRole("textbox", { name: "登录名", exact: true })
      .fill("viewer");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "保存", exact: true }),
    ).toHaveCount(0);
    await expect(
      navigation.getByRole("link", { name: "单据", exact: true }),
    ).toHaveCount(0);
    const view = page
      .getByRole("link", { name: "查看", exact: true })
      .or(page.getByRole("button", { name: "查看", exact: true }));
    await view.click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "客户名称", exact: true }),
    ).not.toBeEditable();
    await expect(
      page.getByRole("textbox", { name: "额度", exact: true }),
    ).toHaveCount(0);
    for (const name of [
      "session.signIn",
      "workbench.load",
      "customers.query",
      "customer.update",
      "catalog.load",
      "voucher.update",
      "voucher.submit",
      "document.approve",
      "workflow.advance",
      "batch.executeBatch",
      "processing.run",
      "report.calculate",
      "report.export",
      "structured.query",
      "output.preview",
      "output.print",
      "account.secret.keep",
      "account.changePassword",
      "session.signOut",
    ])
      assert.ok(callbacks.includes(name), `missing callback ${name}`);
    return {
      directBusinessModel: true,
      publicStaticContract: true,
      presentation,
      callbacks,
      syntheticOnly: true,
    };
  } finally {
    page.off("console", observe);
  }
}
