import { expect } from "@playwright/test";

// Inspect visible controls against their own model field container, across layouts.
export async function fieldAlignmentSmoke(scope, context) {
  const fields = await scope.locator(".v-input").evaluateAll((inputs) =>
    inputs.flatMap((input) => {
      const field = input.querySelector(".v-field");
      if (!field || !field.getClientRects().length) return [];
      const owner = input.closest("section");
      if (!owner) return [];
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return [
        {
          label: input
            .querySelector("input,textarea")
            ?.getAttribute("aria-label"),
          field: rect(field),
          owner: rect(owner),
          modelField:
            owner.parentElement?.matches(
              ".zerp-direct-form, td, .zerp-owned-field",
            ) ?? false,
          // File inputs intentionally place a Material prepend icon outside the field.
          file: input.classList.contains("v-file-input"),
          input: rect(input),
          error: input.querySelector(".zerp-field-error")
            ? rect(input.querySelector(".zerp-field-error"))
            : null,
          menu: input.querySelector(".v-autocomplete__menu-icon")
            ? rect(input.querySelector(".v-autocomplete__menu-icon"))
            : null,
        },
      ];
    }),
  );
  expect(fields.length, context).toBeGreaterThan(0);
  for (const item of fields) {
    const box = item.file ? item.input : item.field;
    expect(box.left, `${context}: ${item.label}`).toBeGreaterThanOrEqual(
      item.owner.left - 1,
    );
    expect(box.right, `${context}: ${item.label}`).toBeLessThanOrEqual(
      item.owner.right + 1,
    );
    if (item.modelField) {
      expect(
        Math.abs(box.left - item.owner.left),
        `${context}: ${item.label} left`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(box.right - item.owner.right),
        `${context}: ${item.label} right`,
      ).toBeLessThanOrEqual(1);
    }
    if (item.error) {
      expect(item.error.left).toBeGreaterThanOrEqual(item.field.left - 1);
      expect(item.error.right).toBeLessThanOrEqual(item.field.right + 1);
      expect(item.error.top).toBeGreaterThanOrEqual(item.field.top - 1);
      expect(item.error.bottom).toBeLessThanOrEqual(item.field.bottom + 1);
      if (item.menu)
        expect(item.error.right).toBeLessThanOrEqual(item.menu.left + 1);
    }
  }
  return { context, fields: fields.length, result: "passed" };
}

export async function readonlyReferenceFeedbackSmoke(page) {
  await page.getByRole("button", { name: "查看", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("combobox", { name: "客户分类", exact: true }),
  ).toBeDisabled();
  await fieldAlignmentSmoke(dialog, "read-only reference fields");
  await dialog
    .getByRole("button", { name: "客户分类错误详情", exact: true })
    .click();
  await expect(
    page.getByRole("note", { name: "客户分类错误详情", exact: true }),
  ).toBeVisible();
  return { check: "readonly-reference-feedback-reachable", result: "passed" };
}
