import { expect } from "@playwright/test";
import {
  settleLayout,
  directPresentationSmoke,
  workbenchPresentationSmoke,
} from "./direct-presentation-smoke.mjs";

// Public UI only, run by check-package against a physically installed tgz.
export async function uiPreferencesSmoke(page, options = {}) {
  const assertions = [];
  await expect(page.locator(".zerp-auth-page")).toHaveClass(
    /v-theme--zerp-md3-light/,
  );
  await page
    .getByRole("textbox", { name: "登录名", exact: true })
    .fill("admin");
  await page
    .getByRole("textbox", { name: "登录密码", exact: true })
    .fill("synthetic-only");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await navigation.getByText("业务", { exact: true }).click();
  await navigation.getByRole("link", { name: "客户", exact: true }).click();
  await page.getByText("合成客户甲", { exact: true }).waitFor();
  const app = page.locator(".zerp-shell");
  await expect(app).toHaveClass(/v-theme--zerp-md3-light/);
  for (const mode of ["light", "dark"]) {
    if (mode === "dark")
      await page
        .getByRole("button", { name: "切换明暗模式", exact: true })
        .click();
    for (const number of [1, 2, 3]) {
      await page.getByRole("button", { name: "主题预设", exact: true }).click();
      await page
        .getByRole("menuitemradio", {
          name: `Material Design ${number}`,
          exact: true,
        })
        .click();
      await expect(app).toHaveClass(
        new RegExp(`v-theme--zerp-md${number}-${mode}`),
      );
      await page
        .getByRole("button", { name: "切换明暗模式", exact: true })
        .click();
      const opposite = mode === "light" ? "dark" : "light";
      await expect(app).toHaveClass(
        new RegExp(`v-theme--zerp-md${number}-${opposite}`),
      );
      await page
        .getByRole("button", { name: "切换明暗模式", exact: true })
        .click();
      await expect(app).toHaveClass(
        new RegExp(`v-theme--zerp-md${number}-${mode}`),
      );
    }
  }
  await page.getByRole("button", { name: "切换明暗模式", exact: true }).click();
  assertions.push({
    clauses: ["UI-THEME-03"],
    check: "default-and-independent-theme-transitions",
    result: "passed",
  });
  const presentation =
    options.layout === false ? undefined : await directPresentationSmoke(page);
  assertions.push({
    clauses: [
      "UI-THEME-05",
      "UI-THEME-06",
      "UI-SHELL-01",
      "UI-DESKTOP-02",
      "UI-MOBILE-01",
      "UI-ACTION-02",
      "UI-FORM-02",
      "UI-FORM-03",
      "UI-FORM-04",
    ],
    check: "representative-desktop-mobile-presentation",
    result: "passed",
  });

  const keyword = page.getByRole("textbox", { name: "关键词", exact: true });
  await keyword.fill("保留条件");
  await navigation.getByRole("link", { name: "空集合", exact: true }).click();
  await navigation.getByRole("link", { name: "客户", exact: true }).click();

  await expect(keyword).toHaveValue("保留条件");
  assertions.push({
    clauses: ["UI-FORM-06"],
    check: "query-input-retained-across-collections",
    result: "passed",
  });

  await page.getByRole("button", { name: "编辑", exact: true }).click();
  const field = page.getByRole("textbox", { name: "客户名称", exact: true });
  await field.fill("契约验证客户");
  await settleLayout(page);
  const before = await field.boundingBox();
  const stable = async (locator, baseline) => {
    await expect
      .poll(async () => {
        const box = await locator.boundingBox();
        return Math.max(
          ...["x", "y", "width", "height"].map((key) =>
            Math.abs(box[key] - baseline[key]),
          ),
        );
      })
      .toBeLessThan(1); // Existing suite's subpixel measurement tolerance, not a UX spacing rule.
  };
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存：契约验证客户" }),
  ).toBeVisible();
  await stable(field, before);
  await page.getByRole("button", { name: "关闭状态提示", exact: true }).click();
  await expect(
    page.getByText("已保存：契约验证客户", { exact: true }),
  ).toBeHidden();
  await stable(field, before);
  await expect(field).toHaveValue("契约验证客户");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  const row = page.getByRole("table").locator("tbody tr").first();
  await keyword.fill("失败");
  await settleLayout(page);
  const rowBefore = await row.boundingBox();
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "操作失败" }),
  ).toBeVisible();
  await stable(row, rowBefore);
  await page.getByRole("button", { name: "关闭错误提示", exact: true }).click();
  await expect(page.getByRole("alert")).toBeHidden();
  await stable(row, rowBefore);
  assertions.push({
    clauses: ["UI-SHELL-05"],
    check:
      "success-error-appearance-and-dismissal-preserve-field-and-row-geometry",
    result: "passed",
  });
  await keyword.fill("引用反馈");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  const feedbackDialog = page
    .getByRole("dialog")
    .filter({ hasText: "表单引用" });
  async function stableReferenceFailure(label, container) {
    const control = feedbackDialog.getByRole("combobox", {
      name: label,
      exact: true,
    });
    await control.scrollIntoViewIfNeeded();
    await settleLayout(page);
    const baseline = await container.boundingBox();
    await control.click();
    const detailsButton = page.getByRole("button", {
      name: `${label}错误详情`,
      exact: true,
    });
    await expect(detailsButton).toBeVisible();
    const details = page.getByRole("note", {
      name: `${label}错误详情`,
      exact: true,
    });
    if (!(await details.isVisible())) await detailsButton.click();
    await expect(details).toBeVisible();
    await expect(control).toHaveAttribute("aria-invalid", "true");
    const description = await control.getAttribute("aria-describedby");
    expect(description).toBeTruthy();
    await expect(
      page.locator(`[id="${description.split(" ").at(-1)}"]`),
    ).toContainText("目录读取失败");
    const messages = details.locator(".zerp-field-error-messages");
    await expect(messages).toHaveCSS("overflow-y", "auto");
    expect(
      await messages.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await stable(container, baseline);
    await details
      .getByRole("button", { name: "重试引用", exact: true })
      .click();
    await expect(details).toBeHidden();
    await expect(control).not.toHaveAttribute("aria-invalid", "true");
    if ((await control.getAttribute("aria-expanded")) === "true")
      await control.press("Escape");
    const restored = await container.boundingBox();
    expect(Math.abs(restored.height - baseline.height)).toBeLessThan(1);
    expect(Math.abs(restored.width - baseline.width)).toBeLessThan(1);
  }
  const referenceForm = feedbackDialog.locator(".zerp-direct-form").filter({
    has: page.getByRole("combobox", { name: "表单引用", exact: true }),
  });
  await stableReferenceFailure("表单引用", referenceForm);
  await feedbackDialog
    .getByRole("tab", { name: "联系人", exact: true })
    .click();
  const ownedRow = feedbackDialog
    .getByRole("table")
    .locator("tbody tr")
    .first();
  await stableReferenceFailure("明细引用", ownedRow);
  await feedbackDialog
    .getByRole("button", { name: "关闭", exact: true })
    .click();
  assertions.push({
    clauses: ["UI-SHELL-05", "UI-DESKTOP-03"],
    check: "long-reference-load-error-preserves-form-and-owned-row-geometry",
    result: "passed",
  });

  await page
    .getByRole("link", { name: "合成业务示例：首页", exact: true })
    .click();
  if (options.workbench !== false) await workbenchPresentationSmoke(page);
  assertions.push({
    clauses: ["UI-WORK-01", "UI-THEME-02"],
    check: "workbench-layout-and-theme",
    result: "passed",
  });
  return {
    assertions,
    presentation,
    boundary:
      "Partial clause coverage, synthetic consumer only; no real ZERP/OIT API or production writes",
  };
}
