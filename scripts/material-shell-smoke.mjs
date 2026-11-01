import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { assertStableFeedback } from "./feedback-smoke.mjs";
import { assertBelowToolbar } from "./shell-interaction-smoke.mjs";

async function touchTarget(control) {
  const box = await control.boundingBox();
  assert.ok(
    box && box.width >= 48 && box.height >= 48,
    `48px effective target ${await control.textContent()}: ${JSON.stringify(box)}`,
  );
  const probe = () =>
    control.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [
        [2, box.height / 2],
        [box.width - 2, box.height / 2],
        [box.width / 2, 2],
        [box.width / 2, box.height - 2],
      ].map(([x, y]) => {
        const target = document.elementFromPoint(box.x + x, box.y + y);
        return {
          hit: !!target && element.contains(target),
          target: target?.outerHTML.slice(0, 180),
          x: box.x + x,
          y: box.y + y,
        };
      });
    });
  await expect
    .poll(async () => (await probe()).every((point) => point.hit), {
      message: `target settles after transitions: ${await control.textContent()}`,
    })
    .toBe(true);
  const hit = await probe();
  assert.ok(
    hit.every((point) => point.hit),
    `target edges hit intended control: ${JSON.stringify({ name: await control.getAttribute("aria-label"), text: await control.textContent(), box, hit })}`,
  );
}

/** Actual computed foreground against composited ancestor surfaces, without screenshots. */
async function contrast(control, paint = {}) {
  return control.evaluate((element, paint) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    const parse = (value) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const pixel = [...context.getImageData(0, 0, 1, 1).data];
      return [...pixel.slice(0, 3), pixel[3] / 255];
    };
    const over = (top, bottom) => {
      const alpha = top[3] ?? 1;
      return top
        .slice(0, 3)
        .map((value, index) => value * alpha + bottom[index] * (1 - alpha));
    };
    let background = [255, 255, 255];
    const ancestors = [];
    for (let current = element; current; current = current.parentElement)
      ancestors.unshift(current);
    let opacity = 1;
    const stateLayers = [
      "v-field__overlay",
      "v-btn__underlay",
      "v-btn__overlay",
      "v-alert__underlay",
      "v-list-item__underlay",
      "v-list-item__overlay",
    ];
    for (const current of ancestors) {
      const style = getComputedStyle(current);
      opacity *= Number(style.opacity);
      const surface = parse(style.backgroundColor);
      surface[3] *= opacity;
      background = over(surface, background);
      for (const layer of current.children) {
        if (!stateLayers.some((name) => layer.classList.contains(name)))
          continue;
        const style = getComputedStyle(layer);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const color = parse(style.backgroundColor);
        color[3] *= opacity * Number(style.opacity);
        background = over(color, background);
      }
    }
    const style = getComputedStyle(element, paint.pseudo);
    const color = parse(style.getPropertyValue(paint.property ?? "color"));
    color[3] *= opacity * (paint.pseudo ? Number(style.opacity) : 1);
    const foreground = over(color, background);
    const luminance = (rgb) =>
      rgb
        .map((value) => value / 255)
        .map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const a = luminance(foreground),
      b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, paint);
}

async function readable(control, message, minimum = 4.5, paint = {}) {
  await expect
    .poll(() => contrast(control, paint), { message })
    .toBeGreaterThanOrEqual(minimum);
}

async function fieldState(input, preset, caption) {
  const field = input.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' v-field ')][1]",
  );
  const label = field.locator(".v-field-label--floating").first();
  await expect(label).toBeVisible();
  await readable(label, `${caption} label`);
  const indicator =
    preset === 3
      ? field.locator(".v-field__outline__start")
      : field.locator(".v-field__outline");
  await expect
    .poll(
      () =>
        indicator.evaluate(
          (element, pseudo) => {
            const style = getComputedStyle(element, pseudo);
            return (
              parseFloat(style.borderBottomWidth) >= 1 &&
              style.borderBottomStyle !== "none"
            );
          },
          preset === 3 ? null : "::after",
        ),
      { message: `${caption} paints a visible border` },
    )
    .toBe(true);
  await readable(indicator, `${caption} indicator`, 3, {
    property: "border-bottom-color",
    ...(preset === 3 ? {} : { pseudo: "::after" }),
  });
}

async function materialFieldsAndModalSmoke(page, preset, mode) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const selectMode = (value) =>
    page.getByLabel("资料演示", { exact: true }).selectOption(value);
  await selectMode("form");
  const name = page.getByRole("textbox", { name: "独立名称", exact: true });
  const amount = page.getByRole("textbox", { name: "独立金额", exact: true });
  const count = page.getByRole("textbox", { name: "独立数量", exact: true });
  const submit = button("提交独立表单");
  await expect(name).toHaveAttribute("required", "");
  await expect(submit).toBeDisabled();
  await expect(count).toHaveValue("0");
  await expect(amount).toHaveValue("9007199254740993.0100");
  await name.fill("合成名称");
  await submit.scrollIntoViewIfNeeded();
  await assertStableFeedback(page, [name, amount, submit], async () => {
    await amount.fill("-");
    await expect(amount).toHaveAttribute("aria-invalid", "true");
  });
  const error = page.locator(
    `[id="${await amount.getAttribute("aria-describedby")}"]`,
  );
  await expect(error).toHaveText("独立金额应为完整十进制数。");
  await readable(error, `MD${preset} ${mode} field error contrast`);
  await fieldState(amount, preset, `MD${preset} ${mode} error field`);
  await amount.fill("9007199254740993.0100");
  await expect(amount).not.toHaveAttribute("aria-invalid", "true");
  await expect(amount).toBeFocused();
  await fieldState(amount, preset, `MD${preset} ${mode} focused field`);
  await readable(amount, `MD${preset} ${mode} field text contrast`);
  await count.fill("-");
  await expect(submit).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "本地输入未完成" }),
  ).toBeVisible();
  await count.fill("0");
  await expect(submit).toBeEnabled();
  await readable(submit, `MD${preset} ${mode} primary submit contrast`);
  await submit.hover();
  const layer = submit.locator(".v-btn__overlay");
  await expect
    .poll(() => layer.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBeGreaterThan(0);
  await readable(submit, `MD${preset} ${mode} hover submit contrast`);
  await page.mouse.down();
  try {
    await expect
      .poll(() => layer.evaluate((el) => Number(getComputedStyle(el).opacity)))
      .toBeGreaterThan(0);
    await readable(submit, `MD${preset} ${mode} pressed submit contrast`);
  } finally {
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 720 });
    await submit.scrollIntoViewIfNeeded();
    await touchTarget(submit);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "field page fits narrow viewport",
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await submit.click();
  await expect(page.getByLabel("独立提交值", { exact: true })).toHaveText(
    '{"title":"合成名称","count":0,"amount":"9007199254740993.0100"}',
  );
  await button("取消").click();
  await selectMode("contracts");
  await button("打开资料接缝").click();
  const editor = page.getByRole("region", { name: "编辑资料", exact: true });
  const cardName = editor.getByRole("textbox", {
    name: "资料名称",
    exact: true,
  });
  await cardName.fill("");
  const cardError = page.locator(
    `[id="${await cardName.getAttribute("aria-describedby")}"]`,
  );
  await expect(cardError).toHaveText("请填写资料名称。");
  await readable(cardError, `MD${preset} ${mode} card field error contrast`);
  await fieldState(cardName, preset, `MD${preset} ${mode} card error field`);
  await cardName.fill("待放弃合成输入");
  const cancel = editor.getByRole("button", { name: "取消编辑", exact: true });
  await cancel.click();
  const dialog = page.getByRole("dialog", { name: "未保存修改", exact: true });
  const keep = dialog.getByRole("button", { name: "继续编辑", exact: true });
  const discard = dialog.getByRole("button", {
    name: "放弃本地修改",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await assertBelowToolbar(page, dialog);
  await assertBelowToolbar(page, page.locator(".zerp-leave-dialog"));
  await expect(keep).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(discard).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(keep).toBeFocused();
  await readable(
    dialog.locator("p"),
    `MD${preset} ${mode} modal text contrast`,
  );
  await readable(keep, `MD${preset} ${mode} modal secondary contrast`);
  await readable(discard, `MD${preset} ${mode} modal danger contrast`);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 720 });
    await keep.scrollIntoViewIfNeeded();
    await touchTarget(keep);
    await discard.scrollIntoViewIfNeeded();
    await touchTarget(discard);
    await assertBelowToolbar(page, dialog);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(cancel).toBeFocused();
  await expect(
    editor.getByRole("textbox", { name: "资料名称", exact: true }),
  ).toHaveValue("待放弃合成输入");
  await cancel.click();
  await discard.click();
  await expect(editor).toBeHidden();
  await selectMode("actions");
}

async function brightBrandSmoke(page) {
  console.log("Material bright brand matrix");
  await page.goto(new URL("/?material-brand=light", page.url()).href);
  await page.getByRole("link", { name: "直接维护", exact: true }).click();
  await page.getByLabel("资料演示", { exact: true }).selectOption("contracts");
  await page.getByRole("button", { name: "打开资料接缝", exact: true }).click();
  const editor = page.getByRole("region", { name: "编辑资料", exact: true });
  const enabled = editor.getByRole("checkbox", {
    name: "设置启用",
    exact: true,
  });
  const name = editor.getByRole("textbox", { name: "资料名称", exact: true });
  const save = editor.getByRole("button", { name: "保存", exact: true });
  const cancel = editor.getByRole("button", { name: "取消编辑", exact: true });
  for (const preset of [1, 2, 3]) {
    await page.getByRole("button", { name: "主题预设", exact: true }).click();
    await page
      .getByRole("menuitemradio", {
        name: `Material Design ${preset}`,
        exact: true,
      })
      .click();
    for (const mode of ["light", "dark"]) {
      if (mode === "dark")
        await page
          .getByRole("button", { name: "切换明暗模式", exact: true })
          .click();
      await expect(enabled).toBeChecked();
      await readable(
        enabled.locator("..").locator(".v-icon"),
        `bright brand MD${preset} ${mode} selected control`,
        3,
      );
      await readable(save, `bright brand MD${preset} ${mode} filled submit`);
      await readable(
        cancel,
        `bright brand MD${preset} ${mode} ordinary action`,
      );
      await name.focus();
      await fieldState(name, preset, `bright brand MD${preset} ${mode} field`);
    }
    await page
      .getByRole("button", { name: "切换明暗模式", exact: true })
      .click();
  }
  await cancel.click();
}

/** Representative shared shell/list/feedback states through an installed AppPage consumer. */
export async function materialShellSmoke(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("link", { name: "直接维护", exact: true }).click();
  await page.getByLabel("资料演示", { exact: true }).selectOption("actions");
  await page
    .getByRole("checkbox", { name: "选择 row-actions", exact: true })
    .waitFor();
  for (const preset of [1, 2, 3]) {
    await page.getByRole("button", { name: "主题预设", exact: true }).click();
    const choice = page.getByRole("menuitemradio", {
      name: `Material Design ${preset}`,
      exact: true,
    });
    await choice.click();
    await expect(choice).toBeHidden();
    for (const mode of ["light", "dark"]) {
      if (mode === "dark")
        await page
          .getByRole("button", { name: "切换明暗模式", exact: true })
          .click();
      await expect(
        page.locator(`.zerp-shell.v-theme--zerp-md${preset}-${mode}`),
      ).toBeVisible();
      console.log(
        `Material MD${preset} ${mode}: fields, actions, list, feedback and modal`,
      );
      const selected = page.getByRole("checkbox", {
        name: "选择 row-actions",
        exact: true,
      });
      await selected.check();
      await expect(page.getByLabel("已选记录", { exact: true })).toHaveText(
        "row-actions",
      );
      await selected.uncheck();
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 720 });
        for (const name of [
          "切换导航",
          "主题预设",
          "切换明暗模式",
          "账户：演示账户",
          "查看",
          "编辑",
          "删除",
          "更多操作",
        ]) {
          const control = page.getByRole("button", { name, exact: true });
          await control.scrollIntoViewIfNeeded();
          await touchTarget(control);
        }
        await selected.scrollIntoViewIfNeeded();
        await touchTarget(selected);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "wide list scrolls inside the page",
        );
      }
      await page.setViewportSize({ width: 1280, height: 720 });
      const cell = page.getByRole("cell", { name: "合成客户", exact: true });
      await expect
        .poll(() => contrast(cell), {
          message: `MD${preset} ${mode} list text contrast`,
        })
        .toBeGreaterThanOrEqual(4.5);
      const action = page.getByRole("button", { name: "编辑", exact: true });
      assert.ok(
        (await contrast(action.locator("i").first())) >= 3,
        "action icon contrast >= 3:1",
      );
      const theme = page.getByRole("button", { name: "主题预设", exact: true });
      await theme.click();
      const selectedPreset = page.getByRole("menuitemradio", {
        name: `Material Design ${preset}`,
        exact: true,
      });
      await expect(selectedPreset).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(() => contrast(selectedPreset), {
          message: `MD${preset} ${mode} menu text contrast`,
        })
        .toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press("Escape");
      await expect(theme).toBeFocused();
      await assertStableFeedback(page, [theme, action], async () => {
        await page
          .getByRole("button", { name: "模拟品牌失败", exact: true })
          .evaluate((element) => element.click());
        await expect(
          page.getByRole("alert", { name: "错误提示", exact: true }),
        ).toBeVisible();
      });
      const message = page.getByRole("alert", {
        name: "错误提示",
        exact: true,
      });
      assert.ok((await contrast(message)) >= 4.5, "feedback contrast >= 4.5:1");
      await expect(message).toContainText("长提示末尾");
      const messageReserve = message.locator("..");
      assert.ok(
        await messageReserve.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
        "long feedback scrolls within its fixed reserve",
      );
      await assertStableFeedback(page, [theme, action], async () => {
        await message
          .getByRole("button", { name: "关闭错误提示", exact: true })
          .click();
        await expect(message).toBeHidden();
      });
      await materialFieldsAndModalSmoke(page, preset, mode);
      await page.reload();
      await page
        .getByLabel("资料演示", { exact: true })
        .selectOption("actions");
      if (mode === "dark")
        await page
          .getByRole("button", { name: "切换明暗模式", exact: true })
          .click();
    }
  }
  await brightBrandSmoke(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}
