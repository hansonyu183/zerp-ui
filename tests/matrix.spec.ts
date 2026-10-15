import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { it, expect } from "vitest";
import { DirectRuntime } from "../src/index";
import { exampleDefinition, resourceCases } from "../examples/direct/matrix";
const click = async (w: ReturnType<typeof mount>, name: string) => {
  await w
    .findAll("button")
    .find((b) => b.text() === name)!
    .trigger("click");
  await flushPromises();
};
it.each(resourceCases)(
  "%s exposes its synthetic direct maintenance interactions",
  async (resource, title, kind) => {
    const d = exampleDefinition(resource),
      w = mount(DirectRuntime as Component, {
        props: {
          definition: d,
          scope: "synthetic",
          permissions: { query: true, write: true, create: true },
        },
      });
    await flushPromises();
    expect(w.text()).toContain(`合成${title}`);
    if (kind === "no-enable" || kind === "save-enable")
      expect(w.findAll("button").some((b) => b.text() === "停用")).toBe(false);
    await click(w, "编辑");
    await w.get('input[aria-label="名称"]').setValue(`${title}修改`);
    if (kind === "decimal")
      expect(w.get('input[aria-label="换算系数"]').element).toHaveProperty(
        "value",
        "123456789012345678.123456789012345678",
      );
    if (kind === "conditional") {
      expect(w.find("fieldset legend").text()).toBe("内部单位");
      await w.get('select[aria-label="承运归属"]').setValue("external");
      expect(w.findAll("legend").map((l) => l.text())).toContain("外部单位");
      expect(w.findAll("legend").map((l) => l.text())).not.toContain(
        "内部单位",
      );
    }
    if (kind === "assignment")
      expect(
        w.get('input[aria-label="用户编码"]').attributes("disabled"),
      ).toBeDefined();
    await click(w, "保存");
    expect(w.find('[aria-label="编辑资料"]').exists()).toBe(false);
    expect(w.text()).toContain(`${title}修改`);
    if (!["no-enable", "save-enable"].includes(kind)) {
      await click(w, "停用");
      await click(w, "确认停用");
      expect(w.findAll("button").map((b) => b.text())).toContain("启用");
    }
    w.unmount();
  },
);
