import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { fixture, operation } from "./fixtures/static-model";
import { render, click, input } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  document.body.innerHTML = "";
});
it("replaces and expires nonblocking messages in the page notice region", async () => {
  const { model } = fixture();
  wrapper = await render(model);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  model.messages.push(
    { id: "first", level: "success", text: "第一次保存成功", target: null },
    { id: "latest", level: "success", text: "最近保存成功", target: null },
  );
  await flushPromises();
  const notices = wrapper.get('[aria-label="页面消息"]');
  expect(notices.text()).toContain("最近保存成功");
  expect(notices.text()).not.toContain("第一次保存成功");
  await vi.advanceTimersByTimeAsync(2999);
  expect(notices.text()).toContain("最近保存成功");
  await vi.advanceTimersByTimeAsync(1);
  expect(notices.text()).toBe("");
  expect(model.messages).toHaveLength(2);

  model.messages[1]!.text = "后续保存成功";
  await flushPromises();
  expect(notices.text()).toContain("后续保存成功");
  await click("关闭状态提示");
  expect(notices.text()).toBe("");
});

it("blocks interaction until explicit acknowledgment and consumes duplicate prompts", async () => {
  const { model, rows } = fixture();
  const message = {
    id: "blocking",
    level: "warning",
    text: "请阅读此提示",
    target: null,
    blocking: true,
  } as const;
  let reject!: (error: Error) => void;
  rows.operations.create = operation(
    vi.fn(() => {
      model.messages.push(message, { ...message, id: "duplicate" });
      return new Promise<void>((_, fail) => {
        reject = fail;
      });
    }),
  );
  wrapper = await render(model);
  await click("新增");
  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain(message.text);
  expect(wrapper.element.hasAttribute("inert")).toBe(true);
  await click("确定");
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(wrapper.element.hasAttribute("inert")).toBe(false);
  expect(model.messages).toHaveLength(2);
  reject(Error("合成业务拒绝"));
  await flushPromises();
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(wrapper.get('[aria-label="页面消息"]').text()).toBe("");
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
  expect(document.body.textContent).toContain("操作失败");
  expect(record.operations.update.run).toHaveBeenCalledTimes(1);
});
it("hides unavailable queries and prevents duplicate invocation after restoration", async () => {
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
  ).find((button) => button.textContent?.trim() === "查询");
  expect(query).toBeUndefined();
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
  };
  reject(Error("旧会话失败"));
  await flushPromises();
  expect(document.body.textContent).not.toContain("旧会话失败");
});

it("uses consumer-created drafts and reopens them without creating twice", async () => {
  const { model, rows } = fixture();
  rows.operations.create = operation(
    vi.fn(async () => {
      rows.draft = {
        kind: "object",
        printable: false,
        family: "standard",
        key: "new",
        label: "新增",
        identity: null,
        readOnly: false,
        members: [
          {
            kind: "text",
            key: "new-name",
            label: "新增名称",
            value: "",
            required: false,
            readOnly: false,
          },
        ],
        operations: {
          update: { disabled: true, async run() {} },
          reconcile: operation(),
        },
      };
    }),
  );
  wrapper = await render(model);
  await click("新增");
  await input("新增名称").setValue("unfinished new");
  await click("关闭");
  expect(rows.draft).not.toBeNull();
  await click("继续编辑");
  expect(input("新增名称").element.value).toBe("unfinished new");
  expect(rows.operations.create.run).toHaveBeenCalledTimes(1);
  const save = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent?.trim() === "保存");
  expect(save).toBeUndefined();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "当前无法保存。",
  );
});
it("does not advertise absent queries or advance disabled pagination", async () => {
  const { model, rows } = fixture();
  delete rows.operations.query;
  rows.total = 100;
  wrapper = await render(model);
  expect(
    Array.from(document.querySelectorAll("button")).some(
      (button) => button.textContent?.trim() === "查询",
    ),
  ).toBe(false);
  await click("下一页");
  expect(rows.page).toBe(1);
});
it("keeps consumer unknown-result restrictions through refresh and feedback dismissal", async () => {
  const { model, record, rows } = fixture();
  record.operations.update!.disabled = true;
  record.operations.reconcile = operation();
  model.messages.push({
    id: "unknown",
    level: "warning",
    text: "结果待核实",
    target: record,
  });
  wrapper = await render(model);
  await click("查看");
  const saved = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "保存",
    );
  expect(saved()).toBeUndefined();
  await click("关闭");
  await click("查询");
  expect(record.operations.update!.disabled).toBe(true);
  expect(rows.operations.query!.run).toHaveBeenCalledTimes(2);
  await click("查看");
  expect(saved()).toBeUndefined();
  await click("核对结果");
  expect(record.operations.reconcile.run).toHaveBeenCalledTimes(1);
  expect(record.operations.update!.disabled).toBe(true);
});
it("keeps a write guard when leaving and returning and makes consumers reject late owner writes", async () => {
  const { model, rows, record, name } = fixture();
  let resolve!: () => void;
  const wait = new Promise<void>((yes) => {
    resolve = yes;
  });
  record.operations.update = operation(
    vi.fn(async () => {
      const owner = model.session.owner;
      await wait;
      if (model.session.owner !== owner) return;
      name.value = "saved";
    }),
  );
  wrapper = await render(model);
  await click("编辑");
  await click("保存");
  await click("关闭");
  await click("编辑");
  const pendingSave = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent?.trim() === "保存");
  if (pendingSave) expect(pendingSave.disabled).toBe(true);
  expect(record.operations.update.run).toHaveBeenCalledTimes(1);
  const owner = { ledger: "new", operator: "new", generation: "2" };
  model.session = {
    state: "ready",
    owner,
  };
  rows.selected = null;
  resolve();
  await flushPromises();
  expect(name.value).toBe("initial");
});
it("offers only sign-in when anonymous and leaves recovery to the consumer", async () => {
  const { model } = fixture();
  const authButtons = () =>
    Array.from(document.querySelectorAll(".zerp-auth-card button")).map(
      (button) => button.textContent?.trim(),
    );

  model.session = { state: "anonymous", owner: null };
  wrapper = await render(model);
  expect(authButtons()).toEqual(["登录"]);
  await click("登录");
  expect(model.authentication.operations.signIn.run).toHaveBeenCalledOnce();

  model.session = { state: "recovering", owner: null };
  await flushPromises();
  expect(authButtons()).toEqual([]);
  expect(model.authentication.operations.recover.run).not.toHaveBeenCalled();
});

it.each(["info", "success", "warning", "error"] as const)(
  "preserves consumer restrictions and reconciliation with %s feedback",
  async (level) => {
    const { model, record } = fixture();
    record.operations.update!.disabled = true;
    record.operations.reconcile = operation();
    model.messages.push({
      id: "pending",
      level,
      text: "业务结果待核实",
      target: record,
    });
    wrapper = await render(model);
    if (level === "error" || level === "warning") {
      const reason = wrapper.get('[role="region"][aria-label="页面消息"]');
      expect(reason.text()).toContain("业务结果待核实");
      expect(reason.find("button.zerp-feedback__close").exists()).toBe(false);
    } else {
      await click("关闭状态提示");
    }
    expect(model.messages).toHaveLength(1);
    expect(record.operations.update!.disabled).toBe(true);
    await click("查看");
    await click("核对结果");
    expect(record.operations.reconcile.run).toHaveBeenCalledTimes(1);
    expect(record.operations.update!.disabled).toBe(true);
  },
);

it("presents one specific save failure at the top while the record stays open", async () => {
  const { model, record } = fixture();
  record.operations.update = operation(
    vi.fn(async () => {
      model.messages.push({
        id: "save-failed",
        level: "error",
        text: "名称已存在，请替换",
        target: record,
      });
      throw Error("write failed");
    }),
  );
  wrapper = await render(model);
  await click("编辑");
  await click("保存");
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(
    wrapper.get('[aria-label="页面消息"] [role="alert"]').text(),
  ).toContain("名称已存在，请替换");
  expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
  expect(document.body.textContent).not.toContain("操作失败");
});

it("keeps save availability explicit even when the record has a different warning", async () => {
  const { model, record } = fixture();
  wrapper = await render(model);
  await click("编辑");
  model.messages.push({
    id: "unrelated-warning",
    level: "warning",
    text: "另一项业务提醒",
    target: record,
  });
  record.operations.update!.disabled = true;
  await flushPromises();

  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("当前无法保存。");
  expect(dialog?.textContent).toContain("另一项业务提醒");
});
