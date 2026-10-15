import { expect, it } from "vitest";
import { createShellThemes, defaultThemeChoice } from "../src/index";
it("provides all six official material themes with finite brand colors and MD3 light by default", () => {
  const result = createShellThemes({
    primary: "#123456",
    secondary: "#654321",
  });
  expect(defaultThemeChoice).toEqual({ preset: "md3", mode: "light" });
  expect(result.defaultTheme).toBe("zerp-md3-light");
  expect(Object.keys(result.themes)).toHaveLength(6);
  for (const preset of ["md1", "md2", "md3"]) {
    expect(result.themes[`zerp-${preset}-dark`].dark).toBe(true);
    expect(result.themes[`zerp-${preset}-light`].dark).toBe(false);
    expect(result.themes[`zerp-${preset}-dark`].colors).toMatchObject({
      primary: "#123456",
      secondary: "#654321",
      muted: "#aeb7c5",
    });
  }
  expect(createShellThemes().themes["zerp-md3-light"].colors?.primary).not.toBe(
    "#123456",
  );
});

import { mount, flushPromises, config } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { createVuetify } from "vuetify";
import { ZerpShell } from "../src/index";
it("renders consumer links, retries and controlled theme intents without owning navigation or theme state", async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/catalog", component: { template: "<p>资料</p>" } }],
  });
  await router.push("/catalog");
  const plugins = config.global.plugins;
  config.global.plugins = [createVuetify({ theme: createShellThemes() })];
  const wrapper = mount(ZerpShell, {
    props: {
      brand: {
        productName: "产品",
        enterpriseName: "企业",
        mark: { kind: "text", text: "星" },
      },
      brandState: { kind: "loading" },
      navigationState: { kind: "ready" },
      navigation: [
        {
          key: "group",
          caption: "资料分组",
          items: [
            {
              key: "catalog",
              caption: "资料链接",
              to: "/catalog",
              icon: "catalog",
            },
          ],
        },
      ],
      pageTitle: "资料标题",
      footer: "消费者页脚",
    },
    global: {
      plugins: [router],
    },
    slots: { default: "<p>消费者内容</p>" },
  });
  config.global.plugins = plugins;
  expect(wrapper.text()).toContain("品牌加载中");
  expect(wrapper.find("a").attributes("href")).toBe("/catalog");
  expect(wrapper.find("a").attributes("aria-current")).toBe("page");
  expect(wrapper.text()).toContain("消费者内容");
  await wrapper.setProps({
    brandState: { kind: "error", caption: "品牌错误" },
    navigationState: { kind: "error", caption: "导航错误" },
  });
  for (const label of ["重试品牌", "重试导航"])
    await wrapper
      .findAll("button")
      .find((b) => b.text() === label)!
      .trigger("click");
  expect(wrapper.emitted("retry-brand")).toHaveLength(1);
  expect(wrapper.emitted("retry-navigation")).toHaveLength(1);
  expect(wrapper.find("a").exists()).toBe(false);
  await wrapper.get("select").setValue("md2");
  expect(wrapper.emitted("update:theme")?.[0]).toEqual([
    { preset: "md2", mode: "light" },
  ]);
  await flushPromises();
  expect(wrapper.find(".v-theme--zerp-md3-light").exists()).toBe(true);
  wrapper.unmount();
});
