import { hostAndDialogButtons } from "./host-and-dialog-buttons";
import type { Component } from "vue";
import { mount, flushPromises, DOMWrapper } from "@vue/test-utils";
import { it, expect, afterEach } from "vitest";
import CrudView from "../src/CrudView.vue";
import { exampleDefinition, resourceCases } from "../examples/direct/matrix";
const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});
const click = async (w: ReturnType<typeof mount>, name: string) => {
  await hostAndDialogButtons(w)
    .find((b) => b.text() === name || b.attributes("aria-label") === name)!
    .trigger("click");
  await flushPromises();
};
it.each(resourceCases)(
  "%s exposes its synthetic direct maintenance interactions",
  async (resource, title, kind) => {
    const d = exampleDefinition(resource),
      w = mount(CrudView as Component, {
        attachTo: document.body,
        props: {
          definition: d,
          scope: "synthetic",
          permissions: { query: true, write: true, create: true },
        },
      });
    mounted.push(w);
    await flushPromises();
    expect(w.text()).toContain(`合成${title}`);
    if (kind === "no-enable" || kind === "save-enable")
      expect(
        w
          .findAll("button")
          .some(
            (b) => b.text() === "停用" || b.attributes("aria-label") === "停用",
          ),
      ).toBe(false);
    await click(w, "编辑");
    await w.get('input[aria-label="名称"]').setValue(`${title}修改`);
    if (kind === "decimal")
      expect(w.get('input[aria-label="换算系数"]').element).toHaveProperty(
        "value",
        "123456789012345678.123456789012345678",
      );
    if (kind === "conditional") {
      expect(w.find("fieldset legend").text()).toBe("内部单位");
      await w
        .get('[role="combobox"][aria-label="承运归属"]')
        .trigger("keydown", { key: "ArrowDown" });
      await flushPromises();
      const external = new DOMWrapper(document.body)
        .findAll('[role="option"]')
        .find((option) => option.text() === "外部");
      expect(external).toBeDefined();
      await external!.trigger("click");
      await flushPromises();
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
      expect(
        w.findAll("button").map((b) => b.attributes("aria-label") ?? b.text()),
      ).toContain("启用");
    }
  },
);
it.each(["aux/dictionary-item", "acc/subject"] as const)(
  "%s applies directory filtering only after submit",
  async (resource) => {
    const d = exampleDefinition(resource),
      w = mount(CrudView as Component, {
        attachTo: document.body,
        props: {
          definition: d,
          scope: "a",
          permissions: { query: true, write: true, create: true },
        },
      });
    mounted.push(w);
    await flushPromises();
    await click(w, "更多条件");
    await click(w, "合成可选 B");
    expect(w.findAll("tbody tr").some((r) => r.text().includes(" B"))).toBe(
      resource === "aux/dictionary-item",
    );
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(w.findAll("tbody tr")).toHaveLength(1);
    expect(w.get("tbody").text()).toContain(" B");
  },
);
it("keeps user assignment readonly when denied and editable when allowed by detail facts", async () => {
  const d = exampleDefinition("app/user"),
    w = mount(CrudView as Component, {
      attachTo: document.body,
      props: {
        definition: d,
        scope: "a",
        permissions: { query: true, write: true, create: true },
      },
    });
  mounted.push(w);
  await flushPromises();
  await click(w, "编辑");
  for (const label of ["可分配角色", "关联员工"])
    expect(
      w
        .findAll("fieldset")
        .find((f) => f.find("legend").text() === label)!
        .attributes("disabled"),
    ).toBeDefined();
  await click(w, "取消编辑");
  await w
    .findAll("tbody tr")[1]
    .findAll("button")
    .find((b) => b.text() === "编辑" || b.attributes("aria-label") === "编辑")!
    .trigger("click");
  await flushPromises();
  for (const label of ["可分配角色", "关联员工"])
    expect(
      w
        .findAll("fieldset")
        .find((f) => f.find("legend").text() === label)!
        .attributes("disabled"),
    ).toBeUndefined();
});
it("omits writes on a synthetic role without action qualification", async () => {
  const d = exampleDefinition("app/role"),
    w = mount(CrudView as Component, {
      attachTo: document.body,
      props: {
        definition: d,
        scope: "a",
        permissions: { query: true, write: true, create: true },
      },
    });
  mounted.push(w);
  await flushPromises();
  expect(w.findAll("tbody tr")[0].findAll("button").length).toBeGreaterThan(0);
  expect(w.findAll("tbody tr")[1].findAll("button")).toHaveLength(0);
});
