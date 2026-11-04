import assert from "node:assert/strict";

/** Card selection and labelled actions share one non-overlapping touch row. */
export async function cardToolbarSmoke(page, card, width) {
  const toolbar = card.locator(".zerp-record-card__toolbar");
  const checkbox = await toolbar.locator(".v-checkbox-btn").boundingBox();
  const bounds = await card.boundingBox();
  assert.ok(checkbox && bounds);
  const actions = await toolbar
    .locator(".zerp-row-actions .v-btn")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          text: element.textContent.trim(),
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      }),
    );
  assert.deepEqual(
    actions.map((action) => action.text),
    width < 360 ? ["查看", "更多"] : ["查看", "编辑", "更多"],
  );
  for (const action of actions) {
    assert.ok(action.height >= 48, "phone actions keep 48px touch height");
    assert.ok(
      Math.abs(
        action.y + action.height / 2 - checkbox.y - checkbox.height / 2,
      ) < 1,
      "checkbox/actions share the same row",
    );
    assert.ok(
      action.x >= checkbox.x + checkbox.width,
      "actions stay to the right of selection",
    );
    assert.ok(
      action.x + action.width <= bounds.x + bounds.width,
      "actions stay within the card",
    );
  }
  const all = await page
    .locator(".zerp-card-selection .v-selection-control__wrapper")
    .boundingBox();
  assert.ok(
    all && Math.abs(all.x - checkbox.x) <= 2,
    "global and card checkboxes align",
  );
}
