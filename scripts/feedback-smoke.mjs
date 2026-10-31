import assert from "node:assert/strict";

/** Compare visible public controls across feedback changes, without screenshots. */
export async function assertStableFeedback(page, controls, change) {
  const capture = async () => ({
    boxes: await Promise.all(controls.map((control) => control.boundingBox())),
    scroll: await page.evaluate(() => ({ x: scrollX, y: scrollY })),
  });
  const before = await capture();
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
