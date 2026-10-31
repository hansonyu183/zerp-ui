import { expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import { AuthPage, createShellThemes, type AuthValues } from "../src/index";

const brand = {
  home: "/",
  productName: "示例产品",
  enterpriseName: "示例企业",
  mark: { kind: "text" as const, text: "示" },
};
const empty: AuthValues = { identifier: "", password: "", confirmation: "" };
function page(props: Record<string, unknown> = {}) {
  return mount(AuthPage, {
    props: {
      brand,
      brandState: { kind: "ready" },
      mode: "sign-in",
      values: empty,
      capabilities: { register: true, recover: true },
      ...props,
    },
    global: { plugins: [createVuetify({ theme: createShellThemes() })] },
  });
}

it("keeps unavailable flows hidden and submits controlled credentials", async () => {
  const w = page({
    capabilities: {},
    values: { ...empty, identifier: " user ", password: "secret" },
  });
  expect(w.text()).not.toContain("忘记密码");
  expect(w.text()).not.toContain("注册账号");
  await w.get("form").trigger("submit");
  expect(w.emitted("submit")?.[0]).toEqual([
    { mode: "sign-in", identifier: "user", password: "secret" },
  ]);
  w.unmount();
});

it("validates registration confirmation and clears secrets when switching modes", async () => {
  const w = page({
    mode: "register",
    values: { identifier: "user", password: "one", confirmation: "two" },
  });
  expect(w.get('[role="alert"]').text()).toContain("不一致");
  expect(w.get('button[type="submit"]').attributes("disabled")).toBeDefined();
  await w.setProps({
    values: { identifier: "user", password: "one", confirmation: "one" },
  });
  await w.get("form").trigger("submit");
  expect(w.emitted("submit")?.[0]).toEqual([
    { mode: "register", identifier: "user", password: "one" },
  ]);
  await w.get("nav button").trigger("click");
  expect(w.emitted("update:values")?.at(-1)).toEqual([
    { identifier: "user", password: "", confirmation: "" },
  ]);
  expect(w.emitted("update:mode")?.at(-1)).toEqual(["sign-in"]);
  w.unmount();
});

it("keeps recovery verification with the consumer and only submits the reset password", async () => {
  const w = page({ mode: "recover", values: { ...empty, identifier: "user" } });
  await w.get("form").trigger("submit");
  expect(w.emitted("submit")?.[0]).toEqual([
    { mode: "recover", identifier: "user" },
  ]);
  await w.setProps({
    mode: "reset",
    values: { identifier: "", password: "new", confirmation: "new" },
  });
  await w.get("form").trigger("submit");
  expect(w.emitted("submit")?.[1]).toEqual([
    { mode: "reset", password: "new" },
  ]);
  w.unmount();
});

it("dismisses authentication feedback without changing controlled values and reopens updated feedback", async () => {
  const values = { identifier: "user", password: "secret", confirmation: "" };
  const w = page({ values, error: "认证暂时失败" });
  await w.get('button[aria-label="关闭错误提示"]').trigger("click");
  expect(w.text()).not.toContain("认证暂时失败");
  expect(w.emitted("update:values")).toBeUndefined();
  expect(w.emitted("submit")).toBeUndefined();
  await w.setProps({ error: "请核对账号" });
  expect(w.get('[role="alert"]').text()).toContain("请核对账号");
  expect(
    (w.get('input[autocomplete="username"]').element as HTMLInputElement).value,
  ).toBe("user");
  w.unmount();
});
