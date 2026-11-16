import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { fixture, operation } from "./fixtures/static-model";
import { render, click } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("keeps the account menu reachable during a pending page read", async () => {
  const { model, rows } = fixture();
  let resolve!: () => void;
  rows.operations.query = operation(
    vi.fn(
      () =>
        new Promise<void>((yes) => {
          resolve = yes;
        }),
    ),
  );
  wrapper = await render(model);
  await click("账户：Tester");
  expect(document.body.textContent).toContain("退出登录");
  resolve();
  await flushPromises();
});
it("keeps an open account menu usable across unrelated business updates", async () => {
  const { model } = fixture();
  const signOut = vi.fn(async () => {});
  model.account.operations.signOut = operation(signOut);
  wrapper = await render(model);
  await click("账户：Tester");
  const activeMenu = () =>
    document.querySelector('.v-overlay--active [role="menu"]');
  expect(activeMenu()).not.toBeNull();
  model.label = "业务状态已更新";
  model.messages.push({
    id: "update",
    level: "info",
    text: "读取完成",
    target: null,
  });
  await flushPromises();
  expect(activeMenu()).not.toBeNull();
  const exit = [
    ...activeMenu()!.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ].find((item) => item.textContent?.includes("退出登录"))!;
  exit.click();
  await flushPromises();
  expect(signOut).toHaveBeenCalledTimes(1);
});
it("closes the account menu when the owner session ends", async () => {
  const { model } = fixture();
  wrapper = await render(model);
  await click("账户：Tester");
  expect(
    document.querySelector('.v-overlay--active [role="menu"]'),
  ).not.toBeNull();
  model.session = { state: "anonymous", owner: null, userPermissions: null };
  await flushPromises();
  expect(document.querySelector('.v-overlay--active [role="menu"]')).toBeNull();
});
it("defaults to MD3 light and independently changes preset and mode", async () => {
  const { model } = fixture();
  wrapper = await render(model);
  expect(document.querySelector(".v-theme--zerp-md3-light")).not.toBeNull();
  await click("切换明暗模式");
  await click("主题预设");
  const radio = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
  ).find((item) => item.textContent?.includes("Material Design 2"));
  expect(radio).toBeDefined();
  radio!.click();
  await flushPromises();
  expect(document.querySelector(".v-theme--zerp-md2-dark")).not.toBeNull();
});
