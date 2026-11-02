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
    page.getByText("已应用，读取完成；可显式准备新请求。", { exact: true }),
  ).toBeVisible();
  stored = await state("single");
  assert.deepEqual(stored.executed, []);
  assert.deepEqual(stored.reconciled, ["legacy-request-single"]);
  assert.equal(stored.records["legacy-request-single"].completed, true);
  await page.reload();
  await expect(button("核实原请求")).toHaveCount(0);
  assert.deepEqual((await state("single")).executed, []);
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
