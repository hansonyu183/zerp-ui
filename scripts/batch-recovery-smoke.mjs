import assert from "node:assert/strict";
import { expect } from "@playwright/test";
/** Runs only the synthetic consumer installed from the checked tgz. */
export async function batchRecoverySmoke(page) {
  const base = new URL(page.url()).origin;
  const button = (name) => page.getByRole("button", { name, exact: true });
  const state = (kind) =>
    page.evaluate(
      (kind) => JSON.parse(localStorage.getItem(`synthetic-migration:${kind}`)),
      kind,
    );
  await page.goto(base + "/migration-batch");
  await expect(
    page.getByRole("heading", { name: "unknown", exact: true }),
  ).toBeVisible();
  await expect(button("继续下一项")).toBeDisabled();
  await expect(button("停止剩余操作")).toBeDisabled();
  let stored = await state("batch");
  assert.equal(stored.batch.id, "legacy-batch-2026");
  assert.deepEqual(stored.executed, []);
  assert.deepEqual(
    stored.batch.entries.map((e) => e.key),
    ["applied", "sealed", "unknown", "never-sent"],
  );
  assert.equal(stored.records["legacy-request-unknown"].request.concurrency, 7);
  assert.deepEqual(stored.records["legacy-request-unknown"].association, {
    kind: "batch",
    batchId: "legacy-batch-2026",
    entryKey: "unknown",
  });
  await page.reload();
  await expect(button("继续下一项")).toBeDisabled();
  assert.deepEqual((await state("batch")).executed, []);
  await button("核实原请求").click();
  await expect(button("继续下一项")).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "unknown", exact: true }),
  ).toBeVisible();
  await button("继续下一项").click();
  await expect(
    page.getByRole("heading", { name: "never-sent", exact: true }),
  ).toBeVisible();
  await button("停止剩余操作").click();
  await expect(
    page.getByText("never-sent · 已停止", { exact: true }),
  ).toBeVisible();
  stored = await state("batch");
  assert.deepEqual(stored.executed, []);
  assert.deepEqual(stored.reconciled, ["legacy-request-unknown"]);
  assert.equal(stored.batch.entries[0].settlement.receipt.status, "applied");
  assert.equal(stored.batch.entries[1].settlement.receipt.sealed, true);
  assert.equal(stored.batch.entries[2].skipped, undefined);
  assert.equal(stored.batch.entries[3].skipped, true);
  assert.equal(
    stored.source,
    await page.evaluate(() =>
      localStorage.getItem("synthetic-migration:batch:source"),
    ),
  );
  await page.reload();
  await expect(
    page.getByText("never-sent · 已停止", { exact: true }),
  ).toBeVisible();
  assert.deepEqual((await state("batch")).executed, []);
  await page.goto(base + "/migration-single");
  await expect(button("核实原请求")).toBeVisible();
  await page.reload();
  await button("核实原请求").click();
  await expect(
    page
      .getByRole("status", { name: "状态提示", exact: true })
      .filter({ hasText: "已应用，读取完成；可显式准备新请求。" }),
  ).toBeVisible();
  stored = await state("single");
  assert.deepEqual(stored.executed, []);
  assert.deepEqual(stored.reconciled, ["legacy-request-single"]);
  assert.equal(stored.records["legacy-request-single"].completed, true);
  await page.reload();
  await expect(button("核实原请求")).toHaveCount(0);
  assert.deepEqual((await state("single")).executed, []);
  // Corrupt only the client journal after conversion. A real reload must still
  // compare it with the independent complete original, never echo its binding.
  for (const field of ["input", "concurrency", "preview"]) {
    await page.evaluate(() =>
      localStorage.removeItem("synthetic-migration:single"),
    );
    await page.goto(base + "/migration-single");
    await expect(button("核实原请求")).toBeVisible();
    const original = await page.evaluate((field) => {
      const key = "synthetic-migration:single";
      const source = localStorage.getItem(`${key}:source`);
      const stored = JSON.parse(localStorage.getItem(key));
      const request = stored.records["legacy-request-single"].request;
      if (field === "input") request.input.value = "corrupt-input";
      else if (field === "concurrency") request.concurrency++;
      else request.preview.title = "corrupt-preview";
      const corrupt = JSON.stringify(stored);
      localStorage.setItem(key, corrupt);
      return { source, corrupt };
    }, field);
    await page.reload();
    await expect(page.getByText(/迁移权威原请求不匹配/)).toBeVisible();
    await expect(button("重试恢复")).toBeEnabled();
    await expect(button("准备执行处理")).toBeDisabled();
    await button("重试恢复").click();
    await expect(page.getByText(/迁移权威原请求不匹配/)).toBeVisible();
    stored = await state("single");
    assert.deepEqual(stored.executed, []);
    assert.deepEqual(stored.reconciled, []);
    assert.equal(stored.records["legacy-request-single"].completed, undefined);
    assert.deepEqual(
      await page.evaluate(() => ({
        source: localStorage.getItem("synthetic-migration:single:source"),
        corrupt: localStorage.getItem("synthetic-migration:single"),
      })),
      original,
    );
  }
  // Settled entries also carry complete originals and must be checked before
  // a restored batch adopts their receipts.
  await page.evaluate(() => {
    const key = "synthetic-migration:batch";
    const stored = JSON.parse(localStorage.getItem(key));
    stored.batch.entries[0].settlement.request.input.value =
      "corrupt-settlement";
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.goto(base + "/migration-batch");
  await expect(page.getByText(/迁移权威原请求不匹配/)).toBeVisible();
  await expect(button("重试恢复批次")).toBeEnabled();
  await expect(button("核实原请求")).toHaveCount(0);
  // A genuinely never-sent entry still prepares and executes exactly once,
  // retaining its separate synthetic authority across another reload.
  await page.evaluate(() =>
    localStorage.removeItem("synthetic-migration:batch"),
  );
  await page.goto(base + "/migration-batch");
  await button("核实原请求").click();
  await expect(button("继续下一项")).toBeEnabled();
  await button("继续下一项").click();
  await button("准备执行处理").click();
  await button("确认执行处理").click();
  await expect(button("继续下一项")).toBeEnabled();
  stored = await state("batch");
  assert.equal(stored.executed.length, 1);
  const newId = stored.executed[0];
  assert.deepEqual(stored.records[newId].request.input, {
    value: "never-sent",
  });
  assert.equal(stored.records[newId].completed, true);
  await page.reload();
  await expect(button("继续下一项")).toBeEnabled();
  await button("继续下一项").click();
  await expect(button("建立批次")).toBeDisabled();
  stored = await state("batch");
  assert.equal(stored.batch.completed, true);
  assert.deepEqual(stored.executed, [newId]);
  // A separate synthetic import with inadequate facts is preserved and refused.
  const raw = await page.evaluate(() =>
    localStorage.getItem("synthetic-migration:batch:source"),
  );
  const insufficient = JSON.parse(raw);
  delete insufficient.entries[2].original.binding;
  await page.evaluate((source) => {
    localStorage.removeItem("synthetic-migration:batch");
    localStorage.setItem("synthetic-migration:batch:import", source);
  }, JSON.stringify(insufficient));
  await page.goto(base + "/migration-batch");
  await expect(page.getByText(/保留原件并拒绝转换/)).toBeVisible();
  await expect(button("准备执行处理")).toHaveCount(0);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("synthetic-migration:batch:source"),
    ),
    JSON.stringify(insufficient),
  );
}
