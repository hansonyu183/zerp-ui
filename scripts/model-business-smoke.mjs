import { printOutputSmoke, rotatedPdfSmoke } from "./print-smoke.mjs";
import assert from "node:assert/strict";
export async function modelBusinessSmoke(page, evidence) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const closeEditor = async () => {
    await button("关闭编辑").click();
    if (await button("放弃本地修改").count())
      await button("放弃本地修改").click();
  };
  const visit = async (name) => {
    await page.getByRole("link", { name, exact: true }).click();
    if (await button("放弃本地修改").isVisible())
      await button("放弃本地修改").click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
  };
  await page.getByRole("heading", { name: "查询分析", exact: true }).waitFor();
  await button("查询").click();
  await page
    .getByText("12345678901234567890.10", { exact: true })
    .first()
    .waitFor();
  assert.ok((await page.locator("body").innerText()).includes("权威合计"));
  const download = page.waitForEvent("download");
  await button("导出").click();
  assert.equal((await download).suggestedFilename(), "synthetic.csv");
  await page
    .getByRole("link", { name: "打开业务", exact: true })
    .first()
    .click();
  await button("准备执行处理").click();
  await page.getByText("权威处理预览", { exact: true }).waitFor();
  await button("确认执行处理").click();
  await button("核实原请求").waitFor();
  await page.reload();
  await button("核实原请求").click();
  await button("准备执行处理").waitFor();
  assert.deepEqual(
    await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith("model-executions:"))
        .map(([, value]) => Number(value)),
    ),
    [1],
  );

  await visit("正式候选与附件");
  await button("编辑档案").click();
  await page.getByLabel("本地附件").setInputFiles({
    name: "cancel.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("cancel local only"),
  });
  await closeEditor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("model-doc-original")),
    null,
  );
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("model-stage:"),
        ).length,
    ),
    0,
  );
  await button("编辑档案").click();
  await page.getByLabel("本地附件").setInputFiles({
    name: "stage.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("staged synthetic"),
  });
  await page.getByLabel("资料名称", { exact: true }).fill("合成候选内容");
  await button("提交档案").click();
  await page.getByText("合成暂存后业务校验失败", { exact: true }).waitFor();
  const staged = await page.evaluate(() =>
    Object.entries(localStorage).filter(([key]) =>
      key.startsWith("model-stage:"),
    ),
  );
  assert.equal(staged.length, 1);
  assert.equal(staged[0][1], "1");
  await closeEditor();
  await button("编辑档案").click();
  await button("提交档案").click();
  await button("开放候选").click();
  assert.equal(
    await page.getByLabel("资料名称", { exact: true }).inputValue(),
    "合成候选内容",
  );
  assert.equal(
    await page.evaluate(
      () =>
        Object.entries(localStorage).filter(([key]) =>
          key.startsWith("model-stage:"),
        )[0][1],
    ),
    "1",
  );
  await button("审批通过").click();

  await visit("单据录入");
  await button("查看").click();
  await button("编辑单据").click();
  const rows = page.getByRole("region", { name: "明细", exact: true });
  await rows.getByRole("button", { name: "新增", exact: true }).click();
  await page.getByLabel("品名", { exact: true }).fill("应取消行");
  await button("取消明细行").click();
  assert.ok(!(await rows.innerText()).includes("应取消行"));
  await rows.getByRole("button", { name: "新增", exact: true }).click();
  assert.equal(
    await page.getByLabel("行金额", { exact: true }).inputValue(),
    "1.00",
  );
  await page.getByLabel("品名", { exact: true }).fill("合成保留行");
  await page
    .getByLabel("行金额", { exact: true })
    .fill("12345678901234567890.0100");
  await button("确定明细行").click();
  await button("编辑子明细 · 明细行 1").click();
  const child = page.getByRole("dialog", {
    name: "子明细 · 明细行 1",
    exact: true,
  });
  await child.getByRole("button", { name: "新增", exact: true }).click();
  await child.getByLabel("子项说明", { exact: true }).fill("应取消子项");
  await child.getByRole("button", { name: "取消子明细", exact: true }).click();
  await button("编辑子明细 · 明细行 1").click();
  await child.getByRole("button", { name: "新增", exact: true }).click();
  await child.getByLabel("子项说明", { exact: true }).fill("合成保留子项");
  await child.getByRole("button", { name: "确定子明细", exact: true }).click();
  await button("提交单据").click();
  const original = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("model-voucher-original")),
  );
  assert.equal(original.input.lines[0].item, "合成保留行");
  assert.equal(original.input.lines[0].amount, "12345678901234567890.0100");
  assert.deepEqual(original.input.lines[0].children, [
    { note: "合成保留子项" },
  ]);
  await visit("流程节点");
  await button("查看").click();
  await page.getByLabel("操作原因", { exact: true }).fill("合成审批原因");
  await button("批准下级").click();
  const flow = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("model-flow-original")),
  );
  assert.equal(flow.instance, "F1");
  assert.equal(flow.node, "N1");
  assert.equal(flow.revision, "1");
  assert.equal(flow.operation, "APPROVE_CHILD");
  assert.equal(flow.reason, "合成审批原因");
  await button("关闭实例").click();

  await visit("批量办理");
  await button("建立批次").click();
  await button("准备执行处理").click();
  await button("确认执行处理").click();
  await button("核实原请求").waitFor();
  assert.ok(await button("继续下一项").isDisabled());
  assert.ok(await button("停止剩余操作").isDisabled());
  await page.reload();
  await button("核实原请求").click();
  await button("继续下一项").click();
  await button("停止剩余操作").click();
  await page.waitForFunction(() =>
    Object.entries(localStorage).some(
      ([key, value]) =>
        key.startsWith("model-batch:") && JSON.parse(value).completed,
    ),
  );
  const batch = await page.evaluate(
    () =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith("model-batch:"))
        .map(([, value]) => JSON.parse(value))[0],
  );
  assert.ok(batch.completed);
  assert.ok(batch.entries[0].settlement);
  assert.ok(batch.entries[1].skipped);
  assert.deepEqual(
    await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith("model-executions:"))
        .map(([, value]) => Number(value)),
    ),
    [1, 1],
  );

  await visit("图文打印");
  await button("准备生成预览").click();
  await button("确认生成预览").click();
  await button("打印").click();
  await button("准备打印").click();
  await button("确认打印").click();
  const frame = page.frameLocator('iframe[title="打印预览"]');
  await frame.getByText("合成打印输出", { exact: true }).waitFor();
  await printOutputSmoke(page, evidence);
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (button) => button.textContent.trim() === "打开打印窗口",
      )?.disabled,
  );
  await page.locator('iframe[title="打印预览"]').evaluate((frame) => {
    frame.contentWindow.print = () => {
      window.__modelPrinted = (window.__modelPrinted ?? 0) + 1;
    };
  });
  await button("打开打印窗口").click();
  assert.equal(await page.evaluate(() => window.__modelPrinted), 1);
  await button("确认已打印").click();
  await button("准备确认已打印").click();
  await button("确认确认已打印").click();
  await page.reload();
  assert.ok(await button("打开打印窗口").isDisabled());
  assert.equal(await page.evaluate(() => window.__modelPrinted ?? 0), 0);
  await rotatedPdfSmoke(page, evidence);
  return {
    synthetic: true,
    paths: [
      "query/export/drill",
      "prepare/confirm/unknown/reload/exact-reconcile",
      "attachment-local-cancel/stage/failure/reuse/submit/approve",
      "voucher-row-cancel/row-confirm/child-cancel/child-confirm/exact-decimal",
      "voucher-to-workflow/exact-instance-node-revision-action",
      "batch-freeze/unknown-block/reload/reconcile/stop-unsent",
      "finite-preview/actual-pdf/qr-decoding/four-rotations/print-invocation/printed-confirmation/reload-no-reprint",
    ],
    printInvocation:
      "stubbed at the browser print boundary; no physical print count claimed",
  };
}
