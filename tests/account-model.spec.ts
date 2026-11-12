import { describe, expect, it } from "vitest";
import {
  projectBusinessFields,
  projectBusinessColumns,
  defineBusinessAccountPage,
  defineBusinessWorkbenchPage,
} from "./fixtures/assembly";
import type { BusinessObject } from "../src/business-type";
const model: BusinessObject = {
  kind: "object",
  name: "本人资料",
  properties: {
    name: { kind: "text", name: "姓名", max: 12 },
    password: { kind: "text", name: "新密码", max: 16, secret: true },
    state: { kind: "enum", name: "状态", options: [{ id: "A", name: "启用" }] },
  },
  form: { fields: ["password", "name"] },
  list: { fields: ["state", "name"] },
};
describe("account and workbench model consumers", () => {
  it("uses ordered fields, constraints, secret semantics and enum column labels", () => {
    const fields = projectBusinessFields(model, undefined);
    expect(fields.map((f) => [f.key, f.label, f.type])).toEqual([
      ["password", "新密码", "secret"],
      ["name", "姓名", "text"],
    ]);
    expect(fields[0]).toMatchObject({ maxLength: 16 });
    expect(projectBusinessColumns(model)[0]).toMatchObject({
      key: "state",
      label: "状态",
      type: "enum",
      options: [{ value: "A", label: "启用" }],
    });
    expect(
      defineBusinessAccountPage(model, {
        kind: "change-password",
        values: {},
        submit() {},
      }).title,
    ).toBe("本人资料");
  });
  it("requires a complete unique workbench projection", () => {
    const props = Object.fromEntries(
      ["masters", "reports", "information", "vouchers"].map((key) => [
        key,
        { kind: "collection" as const, name: key },
      ]),
    );
    const workbench: BusinessObject = {
      kind: "object",
      name: "工作台",
      properties: props,
      form: { fields: Object.keys(props) },
    };
    const adapter = {
      async load() {
        return {
          vouchers: { items: [] },
          reports: { items: [] },
          masters: { items: [] },
          information: [],
        };
      },
    };
    expect(
      defineBusinessWorkbenchPage({ model: workbench, instance: 1, adapter })
        .title,
    ).toBe("工作台");
    expect(() =>
      defineBusinessWorkbenchPage({
        model: { ...workbench, form: { fields: ["masters"] } },
        instance: 1,
        adapter,
      }),
    ).toThrow("分区定义不完整");
  });
});

import { mount, flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { AppPage } from "./fixtures/assembly";
async function host(page: ReturnType<typeof defineBusinessWorkbenchPage>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<span/>" } }],
  });
  await router.push("/");
  await router.isReady();
  const wrapper = mount(AppPage, {
    attachTo: document.body,
    props: {
      page,
      scope: "synthetic",
      brand: {
        home: "/",
        productName: "合成",
        enterpriseName: "合成",
        mark: { kind: "text", text: "例" },
      },
      brandState: { kind: "ready" },
      navigation: [],
      navigationState: { kind: "ready" },
      footer: "",
    },
    global: { plugins: [router] },
  });
  await flushPromises();
  return wrapper;
}
it("renders the complete workbench projection in business order", async () => {
  const keys = ["masters", "reports", "information", "vouchers"];
  const wrapper = await host(
    defineBusinessWorkbenchPage({
      model: {
        kind: "object",
        name: "工作台",
        properties: Object.fromEntries(
          keys.map((key) => [key, { kind: "collection", name: key }]),
        ),
        form: { fields: keys },
      },
      instance: 1,
      adapter: {
        async load() {
          return {
            vouchers: { items: [] },
            reports: { items: [] },
            masters: { items: [] },
            information: [],
          };
        },
      },
    }),
  );
  try {
    expect(
      wrapper
        .findAll(".zerp-workbench-grid > section")
        .map((s) => s.attributes("aria-label")),
    ).toEqual(keys);
  } finally {
    wrapper.unmount();
  }
});
it("renders password constraints and conditional input using the existing account runtime", async () => {
  const fields = {
    kind: "object",
    name: "修改密码",
    properties: {
      password: { kind: "text", name: "新密码", secret: true, max: 16 },
      empty: { kind: "boolean", name: "确认空密码" },
    },
    form: { fields: ["password", "empty"] },
  } as const;
  const values = { password: "", empty: false };
  const wrapper = await host(
    defineBusinessAccountPage(fields, {
      kind: "change-password",
      values,
      interactions: { empty: { when: { key: "password", equals: "" } } },
      submit() {},
    }),
  );
  try {
    await wrapper.find('input[type="password"]').setValue("x".repeat(17));
    await flushPromises();
    expect(wrapper.text()).toContain("16");
    await wrapper.find('input[type="password"]').setValue("");
    await flushPromises();
    expect(wrapper.text()).toContain("确认空密码");
    await wrapper.find('input[type="password"]').setValue("changed");
    await flushPromises();
    expect(wrapper.text()).not.toContain("确认空密码");
  } finally {
    wrapper.unmount();
  }
});
