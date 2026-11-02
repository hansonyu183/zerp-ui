import assert from "node:assert/strict";
import { expect } from "@playwright/test";
/** Both Pages share an origin/storage, but have independent JS runtimes. */
export async function durableRecoverySmoke(page) {
  const run = crypto.randomUUID();
  const url = new URL(`/durable-recovery?run=${run}`, page.url()).href;
  const tabs = await Promise.all([
    page.context().newPage(),
    page.context().newPage(),
  ]);
  try {
    await Promise.all(tabs.map((tab) => tab.goto(url)));
    for (const tab of tabs)
      await expect(
        tab.getByRole("heading", { name: "耐久恢复验证", exact: true }),
      ).toBeVisible();
    // Direct CAS competition does not use the runtime's operation Web Lock.
    const candidates = await Promise.all(
      tabs.map((tab) =>
        tab.evaluate(() => window.syntheticDurableRecovery.reserveProbe()),
      ),
    );
    assert.equal(
      candidates.filter((c) => c.won).length,
      1,
      "atomic reserve has exactly one winner",
    );
    const history = await tabs[0].evaluate(() =>
      window.syntheticDurableRecovery.history(),
    );
    assert.equal(history.retained.completed, true);
    assert.equal(
      history.retained.request.requestId,
      candidates.find((c) => c.won).id,
    );
    assert.equal(history.retained.receipt.status, "applied");
    assert.equal(history.head.request.requestId, history.nextId);
    assert.equal(
      history.refused,
      4,
      "immutable originals and terminal history cannot regress",
    );
    assert.equal(
      history.isolated,
      null,
      "another owner has its own durable namespace",
    );
    assert.deepEqual(
      history.sends,
      [history.originalId],
      "only the CAS winner sent",
    );
    const writes = await tabs[0].evaluate(() =>
      window.syntheticDurableRecovery.writeHistory(),
    );
    assert.equal(writes.original.completed, true);
    assert.equal(writes.original.outcome, "applied");
    assert.equal(writes.head.attempt.id, writes.nextId);
    assert.equal(writes.refused, 3);
    assert.equal(writes.isolated, null);
    // Both public pages prepare before either confirms. The first sends an
    // unknown result, keeping its slot reserved while the second loses CAS.
    await Promise.all(
      tabs.map((tab) =>
        tab.getByRole("button", { name: "准备执行处理", exact: true }).click(),
      ),
    );
    await Promise.all(
      tabs.map((tab) =>
        tab.getByRole("button", { name: "确认执行处理", exact: true }).click(),
      ),
    );
    await expect
      .poll(async () => {
        const snapshot = await tabs[0].evaluate(() =>
          window.syntheticDurableRecovery.snapshot(),
        );
        return snapshot.events.filter((e) => e.kind === "execute").length;
      })
      .toBe(1);
    for (const tab of tabs)
      await expect(
        tab.getByRole("button", { name: /^(核实原请求|重试恢复)$/ }),
      ).toBeVisible();
    const initial = await tabs[0].evaluate(() =>
      window.syntheticDurableRecovery.snapshot(),
    );
    assert.equal(initial.events.filter((e) => e.kind === "execute").length, 1);
    const originalId = initial.journal.request.requestId;
    assert.equal(initial.journal.request.input.value, "unknown");
    await expect(
      tabs[0].getByRole("button", { name: "准备执行处理", exact: true }),
    ).toBeDisabled();
    await expect(
      tabs[1].getByRole("button", { name: "准备执行处理", exact: true }),
    ).toBeDisabled();
    // Reload each independent context: recovery never prepares/executes again.
    await Promise.all(tabs.map((tab) => tab.reload()));
    for (const tab of tabs)
      await expect(
        tab.getByRole("button", { name: "核实原请求", exact: true }),
      ).toBeVisible();
    await tabs[0]
      .getByRole("button", { name: "核实原请求", exact: true })
      .click();
    await expect(
      tabs[0].getByRole("button", { name: "准备执行处理", exact: true }),
    ).toBeEnabled();
    await tabs[1]
      .getByRole("button", { name: "核实原请求", exact: true })
      .click();
    await expect(
      tabs[1].getByRole("button", { name: "准备执行处理", exact: true }),
    ).toBeEnabled();
    const final = await tabs[0].evaluate(() =>
      window.syntheticDurableRecovery.snapshot(),
    );
    assert.equal(final.journal.request.requestId, originalId);
    assert.equal(final.journal.completed, true);
    assert.equal(final.events.filter((e) => e.kind === "execute").length, 1);
    assert.equal(final.events.filter((e) => e.kind === "reconcile").length, 1);
    assert.equal(final.events.filter((e) => e.kind === "refresh").length, 1);
    // Same installed package: an accepted receipt remains known when its first
    // durable terminal save fails, so retry does not consult authority again.
    await tabs[0].goto(
      new URL(`/durable-recovery?run=${run}-terminal&terminal=true`, page.url())
        .href,
    );
    await tabs[0].evaluate(() =>
      window.syntheticDurableRecovery.failNextTerminalSave(),
    );
    await tabs[0]
      .getByRole("button", { name: "准备执行处理", exact: true })
      .click();
    await tabs[0]
      .getByRole("button", { name: "确认执行处理", exact: true })
      .click();
    await expect(
      tabs[0]
        .getByRole("status", { name: "状态提示", exact: true })
        .filter({ hasText: "合成终态保存失败" }),
    ).toBeVisible();
    await tabs[0]
      .getByRole("button", { name: "重试读取", exact: true })
      .click();
    await expect(
      tabs[0].getByRole("button", { name: "准备执行处理", exact: true }),
    ).toBeEnabled();
    const retried = await tabs[0].evaluate(() =>
      window.syntheticDurableRecovery.snapshot(),
    );
    assert.equal(retried.events.filter((e) => e.kind === "execute").length, 1);
    assert.equal(
      retried.events.filter((e) => e.kind === "reconcile").length,
      0,
    );
    assert.equal(retried.events.filter((e) => e.kind === "refresh").length, 1);
    assert.equal(retried.journal.completed, true);
  } finally {
    await Promise.all(tabs.map((tab) => tab.close()));
  }
}
