import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import { fixture } from "./fixtures/static-model";
import { render, click, input } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("narrows field reads and writes and restores structure on increased permission", async () => {
  const { model, rows, name, owner } = fixture();
  model.session = {
    state: "ready",
    owner,
    userPermissions: {
      owner,
      administrator: false,
      grants: [
        {
          node: rows,
          read: true,
          write: false,
          operations: { get: true, query: true },
        },
      ],
    },
  };
  wrapper = await render(model);
  await click("查看");
  expect(input("名称").element.readOnly).toBe(true);
  expect(document.body.textContent).not.toContain("保存");
  await click("关闭");
  model.session = {
    state: "ready",
    owner,
    userPermissions: { owner, administrator: true },
  };
  await flushPromises();
  await click("编辑");
  expect(input("名称").element.readOnly).toBe(false);
  name.readOnly = true;
  await flushPromises();
  expect(input("名称").element.readOnly).toBe(true);
});
it("denies owner mismatches and anonymous/recovering workspace visibility", async () => {
  const { model, owner } = fixture();
  model.session = {
    state: "ready",
    owner,
    userPermissions: {
      owner: { ...owner, generation: "wrong" },
      administrator: true,
    },
  };
  wrapper = await render(model);
  expect(document.body.textContent).not.toContain("initial");
  model.session = { state: "recovering", owner: null, userPermissions: null };
  await flushPromises();
  expect(document.body.textContent).not.toContain("initial");
  expect(input("登录名").exists()).toBe(true);
});
