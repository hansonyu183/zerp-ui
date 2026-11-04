import assert from "node:assert/strict";
import { expect } from "@playwright/test";

/** Card selection and labelled actions share one non-overlapping touch row. */
export async function cardToolbarSmoke(page, card, width) {
  const toolbar = card.locator(".zerp-record-card__toolbar");
  // A card already exists at both phone widths; wait for Vuetify's resize update.
  const expected = width < 360 ? ["查看", "更多"] : ["查看", "编辑", "更多"];
  await expect(toolbar.locator(".zerp-row-actions .v-btn")).toHaveText(
    expected,
  );
  await page.locator(".v-main").evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
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
    expected,
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
