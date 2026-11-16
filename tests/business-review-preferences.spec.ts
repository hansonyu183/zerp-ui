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

it("lets a readonly user edit query criteria without granting record writes", async () => {
  const { model, rows, owner, term, record } = fixture();
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
          operations: { query: true, get: true },
        },
      ],
    },
  };
  wrapper = await render(model);
  await input("条件").setValue("requested");
  expect(term.value).toBe("requested");
  await click("查询");
  expect(rows.operations.query!.run).toHaveBeenCalledTimes(2);
  expect(record.operations.update!.run).not.toHaveBeenCalled();
});
it("keeps forced password change separate from workspace and unknown-result actions", async () => {
  const { model, owner, record } = fixture();
  record.operations.update!.disabled = true;
  model.session = {
    state: "password-required",
    owner,
    userPermissions: { owner, administrator: true },
  };
  wrapper = await render(model);
  expect(document.querySelector("table")).toBeNull();
  expect(document.body.textContent).toContain("修改密码");
  expect(record.operations.update!.disabled).toBe(true);
});
it("hides denied records and fields without deleting the consumer model", async () => {
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
          write: true,
          operations: { query: true, update: true },
        },
        { node: name, read: false, write: false, operations: {} },
      ],
    },
  };
  wrapper = await render(model);
  expect(document.body.textContent).not.toContain("initial");
  expect(rows.items).toHaveLength(1);
  expect(rows.items[0]!.members).toContain(name);
});
