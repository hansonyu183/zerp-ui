import assert from "node:assert/strict";

/** Compare visible public controls across feedback changes, without screenshots. */
export async function assertStableFeedback(page, controls, change) {
  const capture = async () => ({
    boxes: await Promise.all(controls.map((control) => control.boundingBox())),
    scroll: await page.evaluate(() => ({ x: scrollX, y: scrollY })),
  });
  // Measure from a settled layout; viewport/drawer transitions are independent of feedback.
  let before = await capture(),
    stable = 0;
  const deadline = Date.now() + 5000;
  while (stable < 2 && Date.now() < deadline) {
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
    const next = await capture();
    stable = JSON.stringify(next) === JSON.stringify(before) ? stable + 1 : 0;
    before = next;
  }
  assert.equal(stable, 2, "feedback geometry targets settle before the change");
  assert.ok(
    before.boxes.every(Boolean),
    "feedback geometry targets are visible",
  );
  await change();
  const after = await capture();
  assert.deepEqual(
    after,
    before,
    "feedback must preserve control geometry and document scroll",
  );
}
