import { expect } from "@playwright/test";
import {
  fieldAlignmentSmoke,
  readonlyReferenceFeedbackSmoke,
} from "./field-alignment-smoke.mjs";
import { authAlignmentSmoke } from "./auth-alignment-smoke.mjs";
import { businessInteractionSmoke } from "./business-interaction-smoke.mjs";
import {
  settleLayout,
  directPresentationSmoke,
  workbenchPresentationSmoke,
} from "./direct-presentation-smoke.mjs";

// Public UI only, run by check-package against a physically installed tgz.
export async function uiPreferencesSmoke(page, options = {}) {
  const assertions = [];
  const alignment = await authAlignmentSmoke(page);
  assertions.push({
    clauses: ["UI-FORM-03", "UI-THEME-06", "UI-SHELL-05"],
    ...alignment,
  });
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
  const home = navigation.getByRole("link", { name: "工作台", exact: true });
  await expect(home).toHaveAttribute("href", "/");
  await expect(home).toHaveAttribute("aria-current", "page");
  await navigation.getByText("业务", { exact: true }).click();
  const customers = navigation.getByRole("link", { name: "客户", exact: true });
  await customers.click();
  await page.getByText("合成客户甲", { exact: true }).waitFor();
  const domainTabs = page.getByRole("tablist", {
    name: "客户",
    exact: true,
  });
  await expect(
    domainTabs.getByRole("tab", { name: "客户", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const contactTab = domainTabs.getByRole("tab", {
    name: "联系人",
    exact: true,
  });
  await expect(contactTab).toHaveAttribute("href", "/business/contacts");
  const filterInput = page.getByRole("textbox", {
    name: "关键词",
    exact: true,
  });
  await filterInput.fill("保留领域查询输入");
  await domainTabs.getByRole("tab", { name: "客户", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(contactTab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("合成联系人", { exact: true })).toBeVisible();
  await expect(customers).toHaveAttribute("aria-current", "page");
  await expect(
    navigation.getByRole("link", { name: "联系人", exact: true }),
  ).toHaveCount(0);
  await domainTabs.getByRole("tab", { name: "客户", exact: true }).click();
  await expect(filterInput).toHaveValue("保留领域查询输入");
  await filterInput.fill("");
  await home.click();
  await expect(page.locator(".zerp-workbench")).toBeVisible();
  await customers.click();
  assertions.push({
    clauses: [
      "UI-FORM-04",
      "UI-FORM-06",
      "UI-FORM-07",
      "UI-NAV-03",
      "UI-SCOPE-02",
    ],
    check: "material-domain-tabs-keyboard-links-and-input",
    result: "passed",
  });
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
      const queryButton = page.getByRole("button", {
        name: "查询",
        exact: true,
      });
      await expect(queryButton).toHaveClass(/v-btn--variant-tonal/);
      await expect(queryButton).toHaveClass(/text-primary/);
      const colors = await queryButton.evaluate((element) => {
        const theme = getComputedStyle(element);
        return {
          color: theme.color,
          primary: `rgb(${theme
            .getPropertyValue("--v-theme-primary")
            .trim()
            .split(",")
            .map((value) => value.trim())
            .join(", ")})`,
        };
      });
      expect(colors.color).toBe(colors.primary);

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
  await expect(
    navigation.locator(".zerp-navigation-section"),
  ).not.toHaveAttribute("open");
  await navigation.getByText("示例分类", { exact: true }).click();
  const sectionLink = navigation.getByRole("link", {
    name: "E 空集合",
    exact: true,
  });
  await expect(sectionLink).toHaveAttribute("href", "/business/empty");
  await sectionLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("空集合");
  await expect(sectionLink).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "切换导航", exact: true }).click();
  await expect(sectionLink).toBeVisible();
  await sectionLink.click();
  await expect(
    page.getByRole("button", { name: "切换导航", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await settleLayout(page);
  expect(
    (await page.locator(".v-navigation-drawer").boundingBox()).x + 224,
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  assertions.push({
    clauses: [
      "UI-NAV-01",
      "UI-NAV-02",
      "UI-NAV-03",
      "UI-SCOPE-01",
      "UI-WORK-02",
    ],
    check: "two-level-navigation-canonical-link-title-and-mobile-close",
    result: "passed",
  });
  await navigation.getByRole("link", { name: "客户", exact: true }).click();

  await expect(keyword).toHaveValue("保留条件");
  assertions.push({
    clauses: ["UI-FORM-06"],
    check: "query-input-retained-across-collections",
    result: "passed",
  });

  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }),
  ).toHaveClass(/v-btn--variant-flat/);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }),
  ).toHaveClass(/bg-primary/);

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
    page.getByRole("alert").filter({ hasText: "查询失败" }),
  ).toBeVisible();
  await stable(row, rowBefore);
  await keyword.fill("");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("alert")).toBeHidden();
  await stable(row, rowBefore);
  assertions.push({
    clauses: ["UI-SHELL-05"],
    check:
      "success-error-appearance-and-dismissal-preserve-field-and-row-geometry",
    result: "passed",
  });
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
    await fieldAlignmentSmoke(
      feedbackDialog,
      `${page.viewportSize().width}px error: ${label}`,
    );
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
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await keyword.fill("引用反馈");
    await page.getByRole("button", { name: "查询", exact: true }).click();
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    const referenceForm = feedbackDialog.locator(".zerp-direct-form").filter({
      has: page.getByRole("combobox", { name: "表单引用", exact: true }),
    });
    await stableReferenceFailure("表单引用", referenceForm);
    await feedbackDialog
      .getByRole("tab", { name: "联系人", exact: true })
      .click();
    const ownedRow =
      width === 1440
        ? feedbackDialog.getByRole("table").locator("tbody tr").first()
        : feedbackDialog.locator(".zerp-owned-card").first();
    const ownedFields =
      width === 1440
        ? feedbackDialog.locator(".zerp-direct-records th")
        : ownedRow.locator(".zerp-owned-field > span");
    await expect(ownedFields).toHaveText(
      width === 1440
        ? ["选择", "联系人姓名", "明细引用"]
        : ["联系人姓名", "明细引用"],
    );
    await stableReferenceFailure("明细引用", ownedRow);
    await feedbackDialog
      .getByRole("button", { name: "关闭", exact: true })
      .click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  assertions.push({
    clauses: ["UI-SHELL-05", "UI-DESKTOP-03"],
    check: "long-reference-load-error-preserves-form-and-owned-row-geometry",
    result: "passed",
  });
  assertions.push({
    clauses: ["UI-FORM-05", "UI-MOBILE-01"],
    check: "owned-detail-table-and-cards-use-the-same-member-order-and-labels",
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
  await page
    .getByRole("button", { name: "账户：合成用户", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await page
    .getByRole("textbox", { name: "登录名", exact: true })
    .fill("viewer");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  assertions.push({
    clauses: ["UI-ACTION-03", "UI-SHELL-06"],
    ...(await readonlyReferenceFeedbackSmoke(page)),
  });
  assertions.push(...(await businessInteractionSmoke(page)));
  return {
    assertions,
    presentation,
    boundary:
      "Partial clause coverage, synthetic consumer only; no real ZERP/OIT API or production writes",
  };
}
