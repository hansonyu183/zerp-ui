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
  const { model, record, name } = fixture();
  record.operations.update!.disabled = true;
  wrapper = await render(model);
  await click("查看");
  expect(input("名称").element.readOnly).toBe(true);
  expect(document.body.textContent).not.toContain("保存");
  await click("关闭");
  record.operations.update!.disabled = false;
  await flushPromises();
  await click("编辑");
  expect(input("名称").element.readOnly).toBe(false);
  name.readOnly = true;
  await flushPromises();
  expect(input("名称").element.readOnly).toBe(true);
});
it("keeps the workspace hidden while the session is anonymous or recovering", async () => {
  const { model } = fixture();
  model.session = { state: "anonymous", owner: null };
  wrapper = await render(model);
  expect(document.body.textContent).not.toContain("initial");
  model.session = { state: "recovering", owner: null };
  await flushPromises();
  expect(document.body.textContent).not.toContain("initial");
  expect(input("登录名").exists()).toBe(true);
});

it("lets a readonly user edit query criteria without granting record writes", async () => {
  const { model, rows, term, record } = fixture();
  record.readOnly = true;
  record.operations.update!.disabled = true;
  wrapper = await render(model);
  await input("条件").setValue("requested");
  expect(term.value).toBe("requested");
  await click("查询");
  expect(rows.operations.query!.run).toHaveBeenCalledTimes(1);
  expect(record.operations.update!.run).not.toHaveBeenCalled();
});
it("keeps forced password change separate from workspace and unknown-result actions", async () => {
  const { model, owner, record } = fixture();
  record.operations.update!.disabled = true;
  model.session = {
    state: "password-required",
    owner,
  };
  wrapper = await render(model);
  expect(document.querySelector("table")).toBeNull();
  expect(document.body.textContent).toContain("修改密码");
  expect(record.operations.update!.disabled).toBe(true);
});
it("hides denied records and fields without deleting the consumer model", async () => {
  const { model, rows, name } = fixture();
  name.readable = false;
  wrapper = await render(model);
  expect(document.body.textContent).not.toContain("initial");
  expect(rows.items).toHaveLength(1);
  expect(rows.items[0]!.members).toContain(name);
});

it("responds to node readability and operation availability independently", async () => {
  const { model, record } = fixture();
  record.readable = false;
  record.operations.update!.disabled = true;
  model.work.account.profile.readable = false;
  wrapper = await render(model);
  expect(wrapper.text()).not.toContain("initial");
  record.readable = true;
  await flushPromises();
  expect(wrapper.text()).toContain("initial");
  expect(wrapper.find('[data-row-action="edit"]').exists()).toBe(false);
  expect(wrapper.find('[data-row-action="view"]').exists()).toBe(true);
  await click("账户：Tester");
  const menu = () => document.querySelector('[aria-label="账户菜单"]');
  expect(menu()?.textContent).not.toContain("名称与头像");
  model.work.account.profile.readable = true;
  await flushPromises();
  expect(menu()?.textContent).toContain("名称与头像");
});
