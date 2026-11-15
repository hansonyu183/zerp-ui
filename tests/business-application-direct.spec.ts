import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { fixture, operation } from "./fixtures/static-model";
import { render, click, input } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("edits the same model in an overlay and retains failed-save input", async () => {
  const { model, name, record } = fixture();
  record.operations.update = operation(
    vi.fn(async () => {
      throw Error("保存失败");
    }),
  );
  wrapper = await render(model);
  await click("编辑");
  await input("名称").setValue("unfinished");
  await click("保存");
  expect(name.value).toBe("unfinished");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.body.textContent).toContain("保存失败");
  expect(record.operations.update.run).toHaveBeenCalledTimes(1);
});
it("displays disabled operations, rechecks their state and prevents duplicate invocation", async () => {
  const { model, rows } = fixture();
  let done!: () => void;
  const run = vi.fn(
    () =>
      new Promise<void>((yes) => {
        done = yes;
      }),
  );
  rows.operations.query = operation(run);
  rows.operations.query.disabled = true;
  wrapper = await render(model);
  const query = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent?.trim() === "查询")!;
  expect(query.disabled).toBe(true);
  await click("查询");
  expect(run).not.toHaveBeenCalled();
  rows.operations.query.disabled = false;
  await flushPromises();
  await click("查询");
  await click("查询");
  expect(run).toHaveBeenCalledTimes(1);
  done();
  await flushPromises();
});
it("returns the same root to authentication on logout and hides prior data", async () => {
  const { model, rows } = fixture();
  const root = model;
  model.account.operations.signOut = operation(
    vi.fn(async () => {
      model.session = {
        state: "anonymous",
        owner: null,
        userPermissions: null,
      };
      rows.items = [];
      rows.selected = null;
      model.messages = [];
    }),
  );
  wrapper = await render(model);
  await click("账户：Tester");
  await click("退出登录");
  expect(model).toBe(root);
  expect(document.body.textContent).not.toContain("initial");
  expect(input("登录名").exists()).toBe(true);
});
it("isolates old busy and late failure feedback after owner changes", async () => {
  const { model, rows } = fixture();
  let reject!: (error: Error) => void;
  rows.operations.query = operation(
    vi.fn(
      () =>
        new Promise<void>((_, no) => {
          reject = no;
        }),
    ),
  );
  wrapper = await render(model);
  const owner = { ledger: "other", operator: "other", generation: "2" };
  model.session = {
    state: "ready",
    owner,
    userPermissions: { owner, administrator: true },
  };
  reject(Error("旧会话失败"));
  await flushPromises();
  expect(document.body.textContent).not.toContain("旧会话失败");
});
