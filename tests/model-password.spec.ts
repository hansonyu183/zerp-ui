import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import {
  application,
  object,
  secret,
  text,
  operation,
  type ModelActionModel,
  type ModelOperationJournal,
  type ModelApplicationOptions,
} from "../src/model";
const wrappers: ReturnType<typeof mount>[] = [];
beforeEach(() =>
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: async (_key: string, work: () => unknown) => work() },
  }),
);
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = "";
});
async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  expect(button, label + document.body.textContent).toBeTruthy();
  button!.click();
  await flushPromises();
}
const nextSecret = 'synthetic-"new\\\n';
async function fixture({
  encrypted = true,
  revoke = false,
  failSave = false,
  force = true,
  changeOwner = false,
  notApplied = false,
} = {}) {
  const input = object("密码", {
    current: secret("当前密码", { value: "synthetic-old" }),
    next: secret("新密码", { value: nextSecret }),
  });
  type M = ModelActionModel<"changePassword", typeof input, { digest: string }>;
  type Journal = ModelOperationJournal<M, {}, string>;
  let journal: Journal | null = null;
  const run = vi.fn(async (request: { input: { next: string | null } }) => {
    throw Error("connection lost: " + request.input.next);
  });
  const refresh = vi.fn(async () => {});
  const action = operation<
    "changePassword",
    typeof input,
    {},
    string,
    { digest: string }
  >("changePassword", input, {
    async prepare(intent) {
      return {
        ...intent,
        requestId: "password-original",
        concurrency: "1",
        binding: "exact",
        preview: { title: "更改密码", sections: [] },
      };
    },
    acceptsPreparation: () => true,
    run,
    async reconcile(request) {
      const facts = {
        action: request.action,
        owner: request.owner,
        requestId: request.requestId,
        binding: request.binding,
        evidence: { digest: "exact" },
      };
      return notApplied
        ? { ...facts, status: "not-applied" as const, sealed: false }
        : { ...facts, status: "applied" as const };
    },
    seal: async (_request, receipt) =>
      receipt.status === "not-applied" ? { ...receipt, sealed: true } : receipt,
    refresh,
    accepts: (_request, receipt) => receipt.evidence.digest === "exact",
    persistence: {
      secrets: encrypted ? "encrypted" : undefined,
      async load() {
        return journal;
      },
      async save(value, expected) {
        if (failSave) throw Error("failed: " + value.request.input.next);
        expect(journal?.request.requestId ?? null).toBe(expected);
        journal = structuredClone(value);
        if (revoke) action.disabledReason = "改密权限已撤销";
        if (changeOwner && expected === null)
          options.owner = {
            ledger: "synthetic",
            operator: "other",
            generation: "2",
          };
      },
      async remove(_owner, expected) {
        expect(journal?.request.requestId).toBe(expected);
        journal = journal ? { ...journal, completed: true } : null;
      },
    },
  });
  const password = object(
    "更改密码",
    {},
    { operations: { changePassword: action } },
  );
  const home = object(
    "工作台",
    { title: text("内容", { value: "合成工作台" }) },
    {
      operations: {
        get: {
          async run() {
            return {
              value: { title: "合成工作台" },
              identity: {},
              concurrency: "1",
            };
          },
        },
      },
    },
  );
  const options = reactive<ModelApplicationOptions>({
    owner: { ledger: "synthetic", operator: "user", generation: "1" },
    userPermissions: {
      owner: { ledger: "synthetic", operator: "user", generation: "1" },
      administrator: true,
    },
    forcePasswordChange: force,
    brand: {
      productName: "合成",
      enterpriseName: "合成",
      home: "/",
      mark: { kind: "text", text: "例" },
    },
    navigation: {
      current: { node: password },
      href: () => "/",
      visit(node, identity) {
        options.navigation.current = { node, identity };
      },
      guard: () => () => {},
    },
  });
  const model = reactive(application("合成改密", { home, password }, options));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: {} }],
  });
  await router.push("/");
  await router.isReady();
  const render = async () => {
    const wrapper = mount(BusinessApplication, {
      props: { model },
      attachTo: document.body,
      global: { plugins: [router] },
    });
    wrappers.push(wrapper);
    await flushPromises();
    return wrapper;
  };
  return {
    wrapper: await render(),
    render,
    run,
    refresh,
    action,
    input,
    home,
    options,
    journal: () => journal,
  };
}
it("keeps forced password originals behind an encrypted port, locked and recoverable after reload without resending", async () => {
  const f = await fixture();
  await click("准备更改密码");
  expect(document.body.textContent).not.toContain(nextSecret);
  await click("确认更改密码");
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(f.journal()!.request.input).toEqual({
    current: "synthetic-old",
    next: nextSecret,
  });
  expect(document.body.textContent).toContain("核实原请求");
  expect(document.body.textContent).not.toContain(nextSecret);
  await click("准备更改密码");
  expect(f.run).toHaveBeenCalledTimes(1);
  f.wrapper.unmount();
  await f.render();
  await click("核实原请求");
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(f.refresh).toHaveBeenCalledTimes(1);
  expect(f.journal()!.completed).toBe(true);
  expect(f.input.next.value).toBe("");
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="新密码"]')
      ?.value,
  ).toBe("");
});

it("refuses password preparation without an encrypted persistence port", async () => {
  const f = await fixture({ encrypted: false });
  await click("准备更改密码");
  expect(f.journal()).toBeNull();
  expect(f.run).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain(
    "秘密输入需要消费者加密的原请求存储",
  );
});
it("does not execute a password callback withdrawn during durable reservation", async () => {
  const f = await fixture({ revoke: true });
  await click("准备更改密码");
  await click("确认更改密码");
  expect(f.journal()!.request.requestId).toBe("password-original");
  expect(f.run).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("核实原请求");
});
it("retries only the password result read after exact recovery when refreshing fails", async () => {
  const f = await fixture();
  f.refresh.mockRejectedValueOnce(Error("读取失败"));
  await click("准备更改密码");
  await click("确认更改密码");
  await click("核实原请求");
  expect(f.journal()!.receipt?.status).toBe("applied");
  expect(document.body.textContent).toContain("重试读取");
  await click("重试读取");
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(f.refresh).toHaveBeenCalledTimes(2);
  expect(f.journal()!.completed).toBe(true);
});

it("rejects secret preview strings even when they contain JSON escape characters", async () => {
  const f = await fixture();
  const prepare = f.action.prepare;
  f.action.prepare = async (intent) => ({
    ...(await prepare(intent)),
    preview: { title: intent.input.next!, sections: [] },
  });
  await click("准备更改密码");
  expect(document.body.textContent).toContain("秘密值不能包含在办理预览中");
  expect(document.body.textContent).not.toContain(nextSecret);
  expect(f.run).not.toHaveBeenCalled();
});
it("hides secret-bearing persistence errors without sending a password write", async () => {
  const f = await fixture({ failSave: true });
  await click("准备更改密码");
  await click("确认更改密码");
  expect(document.body.textContent).toContain("原请求存储不可用");
  expect(document.body.textContent).not.toContain(nextSecret);
  expect(f.run).not.toHaveBeenCalled();
});
it("redacts secret-bearing preparation acceptance errors", async () => {
  const f = await fixture();
  f.action.acceptsPreparation = (intent) => {
    throw Error("failed: " + intent.input.next);
  };
  await click("准备更改密码");
  expect(document.body.textContent).toContain("[已隐藏]");
  expect(document.body.textContent).not.toContain(nextSecret);
  expect(f.run).not.toHaveBeenCalled();
});

it("uses the same unknown lock for an ordinary password change", async () => {
  const f = await fixture({ force: false });
  await click("准备更改密码");
  await click("确认更改密码");
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain("核实原请求");
});
it("does not send the old password request after the owner changes during reservation", async () => {
  const f = await fixture({ changeOwner: true });
  await click("准备更改密码");
  await click("确认更改密码");
  expect(f.run).not.toHaveBeenCalled();
  expect(f.journal()!.request.owner.operator).toBe("user");
  expect(document.body.textContent).not.toContain(nextSecret);
});
it("seals an exact not-applied password original before unlocking", async () => {
  const f = await fixture({ notApplied: true });
  await click("准备更改密码");
  await click("确认更改密码");
  await click("核实原请求");
  expect(document.body.textContent).toContain("封存原请求");
  expect(f.journal()!.completed).not.toBe(true);
  await click("封存原请求");
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(f.journal()!.completed).toBe(true);
});

it("discovers a pending password original after a new application starts on another node", async () => {
  const f = await fixture({ force: false });
  await click("准备更改密码");
  await click("确认更改密码");
  f.wrapper.unmount();
  f.options.navigation = { ...f.options.navigation, current: { node: f.home } };
  await f.render();
  expect(document.body.textContent).toContain("存在待恢复的原请求：password");
  await click("恢复所属原请求");
  await click("核实原请求");
  expect(f.journal()!.completed).toBe(true);
  expect(document.body.textContent).not.toContain(
    "存在待恢复的原请求：password",
  );
  expect(document.body.textContent).not.toContain("存在未完成的原请求");
  expect(f.run).toHaveBeenCalledTimes(1);
});

it("redacts JSON-escaped password inputs in consumer exceptions", async () => {
  const f = await fixture();
  f.action.acceptsPreparation = (intent) => {
    throw Error(JSON.stringify(intent.input));
  };
  await click("准备更改密码");
  expect(document.body.textContent).toContain("[已隐藏]");
  expect(document.body.textContent).not.toContain(
    JSON.stringify(nextSecret).slice(1, -1),
  );
  expect(f.run).not.toHaveBeenCalled();
});
