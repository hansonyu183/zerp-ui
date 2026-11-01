import { hostAndDialogButtons } from "./host-and-dialog-buttons";
import { DOMWrapper } from "@vue/test-utils";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it } from "vitest";
import { AppPage, defineDetailsPage } from "../src/index";
import { createRouter, createMemoryHistory } from "vue-router";
import {
  defineConfiguration,
  defineVoucher,
  defineVoucherPage,
  type DetailsPage,
} from "../src/index";

it("shows grouped facts and related intents through the complete page entrance", async () => {
  const related: string[] = [];
  const page = defineDetailsPage({
    title: "资料事实",
    instance: "record-one",
    value: {
      amount: "9007199254740993.0100",
      reference: { id: "old", label: "历史名称" },
    },
    groups: [
      {
        key: "facts",
        label: "历史事实",
        fields: [
          { key: "amount", label: "金额", type: "decimal" },
          {
            key: "reference",
            label: "来源",
            type: "reference",
            related: (value) => value.id,
          },
        ],
      },
    ],
    onRelated: (intent) => related.push(intent),
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  const wrapper = mount(AppPage, {
    props: {
      page,
      scope: "synthetic",
      brand: {
        home: "/",
        productName: "合成库",
        enterpriseName: "合成公司",
        mark: { kind: "text", text: "合" },
      },
      brandState: { kind: "ready" },
      navigationState: { kind: "ready" },
      navigation: [],
      footer: "合成验证",
    },
    global: { plugins: [router] },
  });
  await flushPromises();
  expect(wrapper.findAll("h1").map((node) => node.text())).toEqual([
    "资料事实",
  ]);
  expect(wrapper.text()).toContain("9007199254740993.0100");
  const button = hostAndDialogButtons(wrapper).find(
    (node) => node.attributes("aria-label") === "查看来源：历史名称",
  );
  expect(button).toBeDefined();
  await button!.trigger("click");
  expect(related).toEqual(["old"]);
  wrapper.unmount();
});

import { defineCrud, defineCrudPage, domainBlocks } from "../src/index";
import type { EditProtection } from "../src/index";
type Editable = { name: string; settings: { count: number } };
function editablePage(
  write: () => Promise<{ status: "unknown" } | { status: "success" }>,
  onProtection?: (value: EditProtection) => void,
) {
  const definition = defineCrud<
    Editable,
    {},
    { id: string; name: string },
    string
  >({
    resource: "synthetic-records",
    title: "资料维护",
    fields: [{ key: "name", label: "名称", type: "text" }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: (row) => row.id,
    actions: () => ["view", "edit"],
    adapter: {
      query: async () => ({ items: [{ id: "one", name: "原名称" }], total: 1 }),
      get: async () => ({
        values: { name: "原名称", settings: { count: 2 } },
        identity: "one",
      }),
      empty: () => ({ name: "", settings: { count: 0 } }),
      create: write,
      save: write,
    },
  });
  return defineCrudPage({
    definition,
    onProtection,
    permissions: { query: true, create: true, write: true },
    initialRow: { id: "one", name: "原名称" },
    readOnly: false,
    blocks: [
      domainBlocks<Editable>().fields({
        key: "settings",
        label: "设置",
        fields: [{ key: "count", label: "数量", type: "integer" }],
      }),
    ],
  });
}
function mountPage(page: ReturnType<typeof defineDetailsPage>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  return mount(AppPage, {
    attachTo: document.body,
    props: {
      page,
      scope: "synthetic",
      brand: {
        home: "/",
        productName: "合成",
        enterpriseName: "合成",
        mark: { kind: "text", text: "合" },
      },
      brandState: { kind: "ready" },
      navigationState: { kind: "ready" },
      navigation: [],
      footer: "合成",
    },
    global: { plugins: [router] },
  });
}
it("keeps unfinished library block input protected when a different page is requested", async () => {
  const wrapper = mountPage(editablePage(async () => ({ status: "success" })));
  await flushPromises();
  const count = wrapper.get('input[aria-label="数量"]');
  await count.setValue("-");
  const save = hostAndDialogButtons(wrapper).find(
    (node) => node.text() === "保存",
  )!;
  expect(save.attributes("disabled")).toBeDefined();
  const next = defineDetailsPage({
    title: "其它页面",
    instance: "two",
    value: { name: "其它" },
    groups: [
      {
        key: "base",
        label: "基本信息",
        fields: [{ key: "name", label: "名称", type: "text" }],
      },
    ],
  });
  await wrapper.setProps({ page: next });
  expect(
    new DOMWrapper(document.body)
      .find('[role="dialog"][aria-label="未保存修改"]')
      .exists(),
  ).toBe(true);
  const continueEditing = hostAndDialogButtons(wrapper).find(
    (node) => node.text() === "继续编辑",
  )!;
  await continueEditing.trigger("click");
  await flushPromises();
  expect(wrapper.get("h1").text()).toBe("资料维护");
  expect(
    wrapper.get<HTMLInputElement>('input[aria-label="数量"]').element.value,
  ).toBe("-");
  await wrapper.setProps({ active: false });
  await flushPromises();
  expect(wrapper.findAll("input")).toHaveLength(0);
  wrapper.unmount();
});
it("keeps the current page and original write lock after an unknown save", async () => {
  let writes = 0;
  const wrapper = mountPage(
    editablePage(async () => {
      writes++;
      return { status: "unknown" };
    }),
  );
  await flushPromises();
  await wrapper.get('input[aria-label="名称"]').setValue("修改名称");
  await hostAndDialogButtons(wrapper)
    .find((node) => node.text() === "保存")!
    .trigger("click");
  await flushPromises();
  const next = defineDetailsPage({
    title: "其它页面",
    instance: "two",
    value: { name: "其它" },
    groups: [],
  });
  await wrapper.setProps({ page: next });
  await flushPromises();
  expect(wrapper.get("h1").text()).toBe("资料维护");
  expect(
    new DOMWrapper(document.body).find('[aria-label="未保存修改"]').exists(),
  ).toBe(false);
  expect(wrapper.text()).toContain("未知");
  expect(writes).toBe(1);
  wrapper.unmount();
});

import { defineOperationPage, defineAccountPage } from "../src/index";
import { reactive, ref } from "vue";
import {
  synthetic,
  type Store,
  type Scenario,
  type Identity,
  type SyntheticModel,
  type Baseline,
} from "../examples/voucher/operation-adapter";
import type {
  OperationIntent,
  OperationSettlement,
  OperationDefinition,
} from "../src/index";
Object.defineProperty(navigator, "locks", {
  configurable: true,
  value: {
    request: async (_name: string, work: () => Promise<unknown>) => work(),
  },
});
it("owns voucher editing and restores an original not-applied request inside the complete page", async () => {
  const values = new Map<string, string>();
  const storage: Store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const scenario: Scenario = "not-applied";
  const events: string[] = [];
  const definition: OperationDefinition<SyntheticModel, Identity, Baseline> =
    synthetic(
      storage,
      () => scenario,
      (event) => events.push(event),
    );
  const intent: OperationIntent<SyntheticModel, Identity> = {
    action: "edit",
    owner: { scope: "synthetic", operator: "operator", resource: "voucher" },
    identity: { voucher: "one" },
    input: { note: "原内容", rows: [{ key: "r1", quantity: "1.0100" }] },
  };
  const settlements: OperationSettlement<SyntheticModel, Identity, Baseline>[] =
    [];
  const page = defineOperationPage({
    title: "单据内容",
    definition,
    intent,
    eligible: true,
    recoveryAllowed: true,
    onSettled: (value) => settlements.push(value),
    editor: {
      definition: {
        headerFields: [{ key: "note", label: "内容备注", type: "text" }],
        rowFields: [{ key: "quantity", label: "内容数量", type: "decimal" }],
        columns: [{ key: "quantity", label: "数量", type: "decimal" }],
        rowKey: (row) => row.key,
        emptyRow: () => ({ key: "new", quantity: "0" }),
      },
      value: {
        header: { note: "原内容" },
        rows: [{ key: "r1", quantity: "1.0100" }],
      },
      toIntent: (content) => ({
        ...intent,
        action: "edit",
        input: { note: content.header.note, rows: content.rows },
      }),
      restore: (request) =>
        request.action === "create" || request.action === "edit"
          ? { header: { note: request.input.note }, rows: request.input.rows }
          : null,
      adopt: () => null,
    },
  });
  const wrapper = mountPage(page);
  await flushPromises();
  await wrapper.get('input[aria-label="内容备注"]').setValue("办理原输入");
  const click = async (text: string) => {
    await hostAndDialogButtons(wrapper)
      .find((node) => node.text() === text)!
      .trigger("click");
    await flushPromises();
  };
  await click("准备保存修改");
  expect(wrapper.get('[aria-label="完整办理预览"]').text()).toContain(
    "办理原输入",
  );
  await click("确认保存修改");
  expect(wrapper.text()).toContain("必须封存");
  expect(
    wrapper.get('input[aria-label="内容备注"]').attributes("disabled"),
  ).toBeDefined();
  await click("封存原请求");
  expect(settlements).toHaveLength(1);
  await wrapper.get('input[aria-label="内容备注"]').setValue("尚未采用新值");
  await click("恢复原内容");
  expect(
    wrapper.get<HTMLInputElement>('input[aria-label="内容备注"]').element.value,
  ).toBe("办理原输入");
  expect(events.filter((event) => event.startsWith("execute:"))).toHaveLength(
    1,
  );
  wrapper.unmount();
});
it("owns account validation, unfinished inputs and local cancel without inventing account rules", async () => {
  const submissions: { name: string; count: number }[] = [];
  const facts = reactive({ busy: false, error: "", notice: "" });
  const page = defineAccountPage(() => ({
    kind: "profile",
    title: "账户名称与头像",
    values: { name: "原名称", count: 2 },
    fields: [
      { key: "name", label: "账户名称", type: "text", required: true },
      { key: "count", label: "验证数量", type: "integer" },
    ],
    ...facts,
    submit: (value) => submissions.push(value),
  }));
  const wrapper = mountPage(page);
  await flushPromises();
  await wrapper.get('input[aria-label="账户名称"]').setValue("新名称");
  await wrapper.get('input[aria-label="验证数量"]').setValue("-");
  const submit = hostAndDialogButtons(wrapper).find(
    (node) => node.attributes("type") === "submit",
  )!;
  expect(submit.attributes("disabled")).toBeDefined();
  expect(submissions).toHaveLength(0);
  await wrapper.get('input[aria-label="验证数量"]').setValue("3");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(submissions).toEqual([{ name: "新名称", count: 3 }]);
  facts.busy = true;
  await flushPromises();
  const next = defineDetailsPage({
    title: "其它页面",
    instance: "two",
    value: {},
    groups: [],
  });
  await wrapper.setProps({ page: next });
  await flushPromises();
  expect(wrapper.get("h1").text()).toBe("账户名称与头像");
  wrapper.unmount();
});

it("guards a record switch within the same details definition and clears a saved account baseline by explicit instance", async () => {
  const selected = reactive({ instance: "one", note: "原内容" });
  const page = defineDetailsPage(() => ({
    title: "资料详情",
    instance: selected.instance,
    value: { label: selected.instance },
    groups: [
      {
        key: "base",
        label: "基本",
        fields: [{ key: "label", label: "名称", type: "text" }],
      },
    ],
    editor: {
      definition: {
        headerFields: [{ key: "note", label: "详情备注", type: "text" }],
        rowFields: [],
        columns: [],
        rowKey: (row: { id: string }) => row.id,
        emptyRow: () => ({ id: "new" }),
      },
      value: { header: { note: selected.note }, rows: [] },
    },
  }));
  const wrapper = mountPage(page);
  await flushPromises();
  await hostAndDialogButtons(wrapper)
    .find((node) => node.text() === "编辑资料")!
    .trigger("click");
  await wrapper.get('input[aria-label="详情备注"]').setValue("未保存内容");
  selected.instance = "two";
  selected.note = "新记录";
  await flushPromises();
  expect(
    new DOMWrapper(document.body).find('[aria-label="未保存修改"]').exists(),
  ).toBe(true);
  await hostAndDialogButtons(wrapper)
    .find((node) => node.text() === "继续编辑")!
    .trigger("click");
  await flushPromises();
  expect(
    wrapper.get<HTMLInputElement>('input[aria-label="详情备注"]').element.value,
  ).toBe("未保存内容");
  wrapper.unmount();
  const account = reactive({ instance: 0, values: { name: "原名称" } });
  const accountPage = defineAccountPage(() => ({
    kind: "profile",
    title: "账户",
    instance: account.instance,
    values: account.values,
    fields: [{ key: "name", label: "名称", type: "text" }],
    onChange: (value) => {
      account.values = value;
    },
    submit: () => {
      account.instance++;
    },
  }));
  const accountWrapper = mountPage(accountPage);
  await flushPromises();
  await accountWrapper.get('input[aria-label="名称"]').setValue("已保存名称");
  await accountWrapper.get("form").trigger("submit");
  await flushPromises();
  const next = defineDetailsPage({
    title: "已离开",
    instance: "next",
    value: {},
    groups: [],
  });
  await accountWrapper.setProps({ page: next });
  await flushPromises();
  expect(accountWrapper.get("h1").text()).toBe("已离开");
  expect(accountWrapper.find('[aria-label="未保存修改"]').exists()).toBe(false);
  accountWrapper.unmount();
});
it("isolates an admitted details record from in-place reactive source changes", async () => {
  const source = reactive<
    DetailsPage<{ label: string }, never, { note: string }, { id: string }>
  >({
    title: "响应式详情",
    instance: "one",
    value: { label: "原记录" },
    groups: [
      {
        key: "base",
        label: "基本",
        fields: [{ key: "label", label: "记录名称", type: "text" }],
      },
    ],
    editor: {
      definition: {
        headerFields: [{ key: "note", label: "详情备注", type: "text" }],
        rowFields: [],
        columns: [],
        rowKey: (row) => row.id,
        emptyRow: () => ({ id: "new" }),
      },
      value: { header: { note: "原内容" }, rows: [] },
    },
  });
  const wrapper = mountPage(defineDetailsPage(source));
  const click = async (text: string) => {
    await hostAndDialogButtons(wrapper)
      .find((node) => node.text() === text)!
      .trigger("click");
    await flushPromises();
  };
  try {
    await flushPromises();
    await click("编辑资料");
    await wrapper.get('input[aria-label="详情备注"]').setValue("未保存内容");
    source.instance = "two";
    source.value.label = "替换记录";
    source.editor!.value.header.note = "替换内容";
    await flushPromises();
    expect(
      new DOMWrapper(document.body).find('[aria-label="未保存修改"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain("原记录");
    expect(wrapper.text()).not.toContain("替换记录");
    await click("继续编辑");
    expect(
      wrapper.get<HTMLInputElement>('input[aria-label="详情备注"]').element
        .value,
    ).toBe("未保存内容");

    source.instance = "three";
    await flushPromises();
    await click("放弃本地修改");
    expect(wrapper.text()).toContain("替换记录");
    expect(wrapper.text()).toContain("替换内容");
    expect(await wrapper.vm.requestLeave()).toBe(true);
  } finally {
    wrapper.unmount();
  }
});
it.each(["replace", "remove"] as const)(
  "keeps an unknown script request recoverable when its definition is requested to %s",
  async (change) => {
    const permissions = { read: true, write: true, reconcile: true };
    const definition = defineVoucher<
      {},
      string,
      string,
      string,
      string,
      string,
      string,
      {}
    >({
      protocol: "submission",
      resource: "script-owner",
      title: "含脚本的单据",
      fields: [],
      auditColumns: [],
      adapter: {
        list: async () => ({ items: [], total: 0 }),
        get: async () => ({ current: null, history: [], audit: [] }),
        submit: async () => ({ status: "success" }),
      },
    });
    let writes = 0;
    const reconciled: string[] = [];
    const script = defineConfiguration<
      { name: string },
      {},
      { id: string; name: string },
      string,
      string
    >({
      resource: "original-script",
      title: "原脚本",
      fields: [{ key: "name", label: "脚本名称", type: "text" }],
      filters: [],
      initialFilters: () => ({}),
      columns: [{ key: "name", label: "名称" }],
      identity: (row) => row.id,
      adapter: {
        query: async () => ({
          items: [{ id: "one", name: "原脚本" }],
          total: 1,
        }),
        get: async () => ({ values: { name: "原脚本" }, identity: "one" }),
        save: async () => {
          writes++;
          return { status: "unknown" };
        },
      },
      reconcile: async (attempt) => {
        reconciled.push(attempt.resource);
        return {
          status: "not-applied",
          attemptId: attempt.id,
          evidence: "原请求未应用",
        };
      },
    });
    const replacement = {
      ...script,
      resource: "replacement-script",
      title: "替换脚本",
      adapter: {
        ...script.adapter,
        query: async () => ({
          items: [{ id: "two", name: "替换脚本" }],
          total: 1,
        }),
      },
    };
    const selected = ref(true);
    const page = defineVoucherPage(() => ({
      definition,
      permissions,
      script: selected.value
        ? { definition: script, permissions }
        : change === "replace"
          ? { definition: replacement, permissions }
          : undefined,
    }));
    const wrapper = mountPage(page);
    const click = async (text: string) => {
      await hostAndDialogButtons(wrapper)
        .find(
          (node) =>
            node.text() === text || node.attributes("aria-label") === text,
        )!
        .trigger("click");
      await flushPromises();
    };
    try {
      await flushPromises();
      await click("编辑");
      await wrapper.get('input[aria-label="脚本名称"]').setValue("修改脚本");
      await click("保存");
      expect(await wrapper.vm.requestLeave()).toBe(false);
      selected.value = false;
      await flushPromises();
      expect(await wrapper.vm.requestLeave()).toBe(false);
      expect(wrapper.text()).toContain("原脚本");
      expect(wrapper.text()).not.toContain("替换脚本");
      await click("核实本次请求");
      expect(reconciled).toEqual(["original-script"]);
      expect(writes).toBe(1);
      await wrapper.get('input[aria-label="脚本名称"]').setValue("原脚本");
      selected.value = true;
      await flushPromises();
      selected.value = false;
      await flushPromises();
      expect(await wrapper.vm.requestLeave()).toBe(true);
      expect(wrapper.text()).not.toContain("原脚本");
      expect(wrapper.text().includes("替换脚本")).toBe(change === "replace");
    } finally {
      wrapper.unmount();
    }
  },
);
it("emits finite list selection and related operation intents without invoking a CRUD write", async () => {
  const chosen = reactive({ keys: [] as (string | number)[] });
  const intents: string[] = [];
  const definition = defineCrud<
    { name: string },
    {},
    { id: string; name: string },
    string
  >({
    resource: "list",
    title: "关联列表",
    fields: [],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: (row) => row.id,
    actions: () => [],
    adapter: {
      query: async () => ({ items: [{ id: "one", name: "一号" }], total: 1 }),
      get: async () => ({ values: { name: "一号" }, identity: "one" }),
      empty: () => ({ name: "" }),
      create: async () => {
        throw Error("不应写入");
      },
      save: async () => {
        throw Error("不应写入");
      },
    },
  });
  const page = defineCrudPage(() => ({
    definition,
    permissions: { query: true, create: false, write: false },
    selection: {
      rowKey: (row) => row.id,
      selectedKeys: chosen.keys,
      onChange: (keys) => {
        chosen.keys = keys;
      },
    },
    listActions: () => ["withdraw"],
    onListAction: (action, row) => intents.push(`${action}:${row.id}`),
  }));
  const wrapper = mountPage(page);
  await flushPromises();
  const checkbox = wrapper.findAll('input[type="checkbox"]');
  expect(checkbox.length).toBeGreaterThan(0);
  await checkbox[checkbox.length - 1].setValue(true);
  await flushPromises();
  expect(chosen.keys).toEqual(["one"]);
  const withdraw = hostAndDialogButtons(wrapper).find(
    (node) =>
      node.attributes("aria-label")?.includes("反送审") ||
      node.text() === "反送审",
  )!;
  expect(withdraw).toBeDefined();
  await withdraw.trigger("click");
  await flushPromises();
  expect(intents).toEqual(["withdraw:one"]);
  wrapper.unmount();
});

it("denies an ordinary switch from an unknown operation to another page but clears a same-page actor replacement", async () => {
  const values = new Map<string, string>();
  const storage: Store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const definition: OperationDefinition<SyntheticModel, Identity, Baseline> =
    synthetic(
      storage,
      () => "unknown",
      () => {},
    );
  const actor = reactive({ operator: "operator-a" });
  const originalOwner = {
    scope: "synthetic",
    operator: "operator-a",
    resource: "operation-guard",
  };
  const page = defineOperationPage(() => ({
    title: "原办理页面",
    definition,
    intent: {
      action: "void",
      owner: { ...originalOwner, operator: actor.operator },
      identity: { voucher: "one" },
      input: { note: "原输入" },
    },
    eligible: true,
    recoveryAllowed: true,
  }));
  const wrapper = mountPage(page);
  await flushPromises();
  const click = async (text: string) => {
    await hostAndDialogButtons(wrapper)
      .find((node) => node.text() === text)!
      .trigger("click");
    await flushPromises();
  };
  await click("准备作废");
  await click("确认作废");
  const original = await definition.persistence.load(originalOwner);
  expect(original).not.toBeNull();
  expect(wrapper.text()).toContain(original!.request.requestId);
  const details = defineDetailsPage({
    title: "其它资料",
    instance: "other",
    value: {},
    groups: [],
  });
  await wrapper.setProps({ page: details });
  await flushPromises();
  expect(wrapper.get("h1").text()).toBe("原办理页面");
  expect(wrapper.text()).toContain(original!.request.requestId);
  await wrapper.setProps({ page });
  await flushPromises();
  actor.operator = "operator-b";
  await flushPromises();
  expect(wrapper.text()).not.toContain(original!.request.requestId);
  expect(
    hostAndDialogButtons(wrapper)
      .find((node) => node.text() === "准备作废")!
      .attributes("disabled"),
  ).toBeUndefined();
  expect(
    (await definition.persistence.load(originalOwner))?.request.requestId,
  ).toBe(original!.request.requestId);
  wrapper.unmount();
});
it("does not publish retired page protection to a consumer after security cleanup", async () => {
  const events: EditProtection[] = [];
  const page = editablePage(
    async () => ({ status: "success" }),
    (value) => events.push(value),
  );
  const wrapper = mountPage(page);
  await flushPromises();
  await wrapper.get('input[aria-label="名称"]').setValue("未保存名称");
  expect(events[events.length - 1].dirty).toBe(true);
  const count = events.length;
  await wrapper.setProps({ active: false });
  await flushPromises();
  expect(events).toHaveLength(count);
  wrapper.unmount();
});

it("guards an in-place operation identity change while preserving same-record preview updates", async () => {
  const values = new Map<string, string>();
  const storage: Store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const definition: OperationDefinition<SyntheticModel, Identity, Baseline> =
    synthetic(
      storage,
      () => "success",
      () => {},
    );
  const identity = reactive({ voucher: "one" });
  const title = ref("原办理页面");
  const page = defineOperationPage(() => ({
    title: title.value,
    definition,
    intent: {
      action: "void",
      owner: {
        scope: "synthetic",
        operator: "operator",
        resource: "reactive-identity",
      },
      identity,
      input: { note: "原输入" },
    },
    eligible: true,
    recoveryAllowed: true,
  }));
  const wrapper = mountPage(page);
  const click = async (text: string) => {
    await hostAndDialogButtons(wrapper)
      .find((node) => node.text() === text)!
      .trigger("click");
    await flushPromises();
  };
  try {
    await flushPromises();
    await click("准备作废");
    expect(wrapper.get('[aria-label="完整办理预览"]').text()).toContain("one");
    title.value = "同记录新标题";
    await flushPromises();
    expect(wrapper.get('[aria-label="完整办理预览"]').text()).toContain("one");
    identity.voucher = "two";
    await flushPromises();
    expect(
      new DOMWrapper(document.body).find('[aria-label="未保存修改"]').exists(),
    ).toBe(true);
    await click("继续编辑");
    expect(wrapper.get('[aria-label="完整办理预览"]').text()).toContain("one");
  } finally {
    wrapper.unmount();
  }
});

it("keeps controlled details echoes dirty and requests leave confirmation", async () => {
  const content = ref({
    header: { note: "原备注" },
    rows: [] as { id: string }[],
  });
  const events: EditProtection[] = [];
  const page = defineDetailsPage(() => ({
    title: "受控详情",
    instance: "one",
    value: { label: "一号" },
    groups: [],
    onProtection: (value) => events.push(value),
    editor: {
      definition: {
        headerFields: [{ key: "note", label: "详情备注", type: "text" }],
        rowFields: [],
        columns: [],
        rowKey: (row) => row.id,
        emptyRow: () => ({ id: "new" }),
      },
      value: content.value,
      onChange: (value) => {
        content.value = { header: value.header, rows: [...value.rows] };
      },
    },
  }));
  const wrapper = mountPage(page);
  await flushPromises();
  await hostAndDialogButtons(wrapper)
    .find((node) => node.text() === "编辑资料")!
    .trigger("click");
  await wrapper.get('input[aria-label="详情备注"]').setValue("未保存备注");
  await flushPromises();
  expect(wrapper.find('input[aria-label="详情备注"]').exists()).toBe(true);
  expect(events[events.length - 1].dirty).toBe(true);
  const next = defineDetailsPage({
    title: "其它页面",
    instance: "two",
    value: {},
    groups: [],
  });
  await wrapper.setProps({ page: next });
  await flushPromises();
  expect(
    new DOMWrapper(document.body).find('[aria-label="未保存修改"]').exists(),
  ).toBe(true);
  wrapper.unmount();
});
it("accepts nested reactive operation values and preserves typed Date Map and Set data", async () => {
  const values = new Map<string, string>();
  const storage: Store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const definition: OperationDefinition<SyntheticModel, Identity, Baseline> =
    synthetic(
      storage,
      () => "success",
      () => {},
    );
  const rows = ref([
    {
      key: "r1",
      quantity: "1.0100",
      facts: {
        at: new Date("2026-10-31T00:00:00Z"),
        amounts: new Map([["precise", "9007199254740993.0100"]]),
        tags: new Set(["original"]),
      },
    },
  ]);
  const facts = reactive({ eligible: true });
  const observed: (typeof rows.value)[number]["facts"][] = [];
  const events: EditProtection[] = [];
  const intent: OperationIntent<SyntheticModel, Identity> = {
    action: "edit",
    owner: {
      scope: "synthetic",
      operator: "reactive",
      resource: "nested-reactive",
    },
    identity: { voucher: "one" },
    input: { note: "原备注", rows: [] },
  };
  const page = defineOperationPage(() => ({
    title: "响应式单据",
    definition,
    intent,
    eligible: facts.eligible,
    recoveryAllowed: true,
    onProtection: (value) => events.push(value),
    editor: {
      definition: {
        headerFields: [{ key: "note", label: "响应式备注", type: "text" }],
        rowFields: [{ key: "quantity", label: "数量", type: "decimal" }],
        columns: [{ key: "quantity", label: "数量", type: "decimal" }],
        rowKey: (row) => row.key,
        emptyRow: () => rows.value[0],
      },
      value: { header: { note: "原备注" }, rows: rows.value },
      toIntent: (content, base) => {
        observed.push(content.rows[0].facts);
        return {
          ...base,
          action: "edit",
          input: { note: content.header.note, rows: content.rows },
        };
      },
      restore: () => null,
      adopt: () => null,
    },
  }));
  const wrapper = mountPage(page);
  await flushPromises();
  expect(wrapper.text()).toContain("1.0100");
  expect(observed[0].at).toBeInstanceOf(Date);
  expect(observed[0].at.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  expect(observed[0].amounts).toBeInstanceOf(Map);
  expect(observed[0].amounts.get("precise")).toBe("9007199254740993.0100");
  expect(observed[0].tags).toBeInstanceOf(Set);
  await wrapper.get('input[aria-label="响应式备注"]').setValue("未保存备注");
  await flushPromises();
  facts.eligible = false;
  await flushPromises();
  facts.eligible = true;
  await flushPromises();
  expect(
    wrapper.get<HTMLInputElement>('input[aria-label="响应式备注"]').element
      .value,
  ).toBe("未保存备注");
  expect(events[events.length - 1].dirty).toBe(true);
  wrapper.unmount();
});

type ModeValues = { createOnly: string; editOnly: string };
type ModeDraft = {
  group: ModeValues;
  items: ModeValues[];
  sheet: { header: ModeValues; rows: readonly { id: string }[] };
};
const blockKinds: readonly ("fields" | "rows" | "voucher")[] = [
  "fields",
  "rows",
  "voucher",
];
const draftModes: readonly ("create" | "edit")[] = ["create", "edit"];
it.each(
  blockKinds.flatMap((kind) => draftModes.map((mode) => ({ kind, mode }))),
)(
  "renders and validates $mode fields consistently in a $kind domain block",
  async ({ kind, mode }) => {
    const fields: import("../src/index").Fields<ModeValues> = [
      {
        key: "createOnly",
        label: "仅创建字段",
        type: "text",
        mode: "create",
        required: true,
      },
      {
        key: "editOnly",
        label: "仅编辑字段",
        type: "text",
        mode: "edit",
        required: true,
      },
    ];
    const emptyValues = (): ModeValues => ({ createOnly: "", editOnly: "" });
    const empty = (): ModeDraft => ({
      group: emptyValues(),
      items: [emptyValues()],
      sheet: { header: emptyValues(), rows: [] },
    });
    const received: import("../src/index").Attempt<ModeDraft, string>[] = [];
    const definition = defineCrud<ModeDraft, {}, { id: string }, string>({
      resource: `mode-${kind}-${mode}`,
      title: "分组表单模式",
      fields: [],
      filters: [],
      initialFilters: () => ({}),
      columns: [{ key: "id", label: "编号" }],
      identity: (row) => row.id,
      actions: () => ["view", "edit"],
      adapter: {
        query: async () => ({ items: [{ id: "one" }], total: 1 }),
        get: async () => ({ identity: "one", values: empty() }),
        empty,
        create: async (attempt) => {
          received.push(attempt);
          return { status: "success" };
        },
        save: async (attempt) => {
          received.push(attempt);
          return { status: "success" };
        },
      },
    });
    const factory = domainBlocks<ModeDraft>();
    const block =
      kind === "fields"
        ? factory.fields({ key: "group", label: "模式分组", fields })
        : kind === "rows"
          ? factory.rows({
              key: "items",
              label: "模式子项",
              fields,
              empty: emptyValues,
              get: (value) => value,
              set: (_value, rows) => [...rows],
            })
          : factory.voucher({
              key: "sheet",
              label: "模式单据",
              editor: {
                headerFields: fields,
                rowFields: [],
                columns: [],
                rowKey: (row) => row.id,
                emptyRow: () => ({ id: "new" }),
              },
              get: (value) => value,
              set: (_value, content) => content,
            });
    const page = defineCrudPage({
      definition,
      permissions: { query: true, create: true, write: true },
      blocks: [block],
      initialRow: mode === "edit" ? { id: "one" } : undefined,
      readOnly: false,
    });
    const wrapper = mountPage(page);
    await flushPromises();
    const click = async (text: string) => {
      await hostAndDialogButtons(wrapper)
        .find(
          (node) =>
            node.text() === text || node.attributes("aria-label") === text,
        )!
        .trigger("click");
      await flushPromises();
    };
    if (mode === "create") await click("新增");
    if (kind === "rows") await click("编辑模式子项 1");
    const activeLabel = mode === "create" ? "仅创建字段" : "仅编辑字段";
    const hiddenLabel = mode === "create" ? "仅编辑字段" : "仅创建字段";
    expect(wrapper.find(`input[aria-label="${activeLabel}"]`).exists()).toBe(
      true,
    );
    expect(wrapper.find(`input[aria-label="${hiddenLabel}"]`).exists()).toBe(
      false,
    );
    await wrapper
      .get(`input[aria-label="${activeLabel}"]`)
      .setValue("当前模式内容");
    if (kind === "rows") await click("确定模式子项");
    await click("保存");
    expect(received).toHaveLength(1);
    expect(received[0].operation).toBe(mode === "create" ? "create" : "save");
    const input = received[0].input!;
    const local =
      kind === "fields"
        ? input.group
        : kind === "rows"
          ? input.items[0]
          : input.sheet.header;
    expect(local[mode === "create" ? "createOnly" : "editOnly"]).toBe(
      "当前模式内容",
    );
    expect(local[mode === "create" ? "editOnly" : "createOnly"]).toBe("");
    wrapper.unmount();
  },
);

it("links account field validation to its input and submits exact controlled values", async () => {
  const submissions: {
    amount: string;
    count: number;
    enabled: boolean;
    note: string | null;
  }[] = [];
  const page = defineAccountPage<(typeof submissions)[number]>({
    kind: "profile",
    title: "合成精确账户",
    values: { amount: "1.2300", count: 0, enabled: false, note: null },
    fields: [
      { key: "amount", label: "精确账户金额", type: "decimal", required: true },
      { key: "count", label: "精确账户数量", type: "integer" },
      { key: "enabled", label: "精确账户启用", type: "boolean" },
      { key: "note", label: "精确账户备注", type: "text" },
    ],
    submit: (value) => submissions.push(value),
  });
  const w = mountPage(page);
  await flushPromises();
  const amount = w.get('input[aria-label="精确账户金额"]');
  await amount.setValue("-");
  expect(amount.attributes("aria-invalid")).toBe("true");
  expect(
    w.get(`[id="${amount.attributes("aria-describedby")}"]`).text(),
  ).toContain("应为完整十进制数");
  await amount.setValue("9007199254740993.0100");
  await w.get("form").trigger("submit");
  expect(submissions).toEqual([
    { amount: "9007199254740993.0100", count: 0, enabled: false, note: null },
  ]);
  w.unmount();
});

it("submits selected catalog values and date strings from the complete account page", async () => {
  type Values = {
    choice: string;
    tags: string[];
    date: string;
    period: string[];
  };
  const submissions: Values[] = [];
  const page = defineAccountPage({
    kind: "profile",
    title: "合成目录账户",
    values: {
      choice: "old",
      tags: ["a"],
      date: "2026-11-01",
      period: ["2026-11-01", "2026-11-02"],
    },
    fields: [
      {
        key: "choice",
        type: "enum",
        label: "账户类别",
        options: [
          { value: "a", label: "甲类" },
          { value: "b", label: "乙类" },
        ],
      },
      {
        key: "tags",
        type: "multi-enum",
        label: "账户标签",
        options: [
          { value: "a", label: "甲标签" },
          { value: "b", label: "乙标签" },
        ],
      },
      { key: "date", type: "date", label: "账户日期" },
      { key: "period", type: "date-range", label: "账户期间" },
    ],
    submit: (value) => submissions.push(value),
  });
  const w = mountPage(page);
  await flushPromises();
  expect(w.get('input[aria-label="账户类别"]').element).toHaveProperty(
    "value",
    "old",
  );
  await w
    .get('input[aria-label="账户类别"]')
    .trigger("keydown", { key: "ArrowDown" });
  await flushPromises();
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(
    (node) => node.textContent?.trim() === "乙类",
  );
  expect(option).toBeDefined();
  (option as HTMLElement).click();
  await flushPromises();
  await w.get('input[aria-label="账户日期"]').setValue("2026-11-03");
  await w.get('input[aria-label="账户期间止"]').setValue("2026-11-04");
  await w.get("form").trigger("submit");
  expect(submissions).toEqual([
    {
      choice: "b",
      tags: ["a"],
      date: "2026-11-03",
      period: ["2026-11-01", "2026-11-04"],
    },
  ]);
  w.unmount();
});

it("presents every domain-row action as disabled while the original save is pending or unknown", async () => {
  type Draft = { items: { name: string }[] };
  let finish!: (value: { status: "unknown" }) => void;
  const write = new Promise<{ status: "unknown" }>((resolve) => {
    finish = resolve;
  });
  const definition = defineCrud<Draft, {}, { id: string }, string>({
    resource: "synthetic-row-lock",
    title: "行操作锁定",
    fields: [],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "id", label: "编号" }],
    identity: (row) => row.id,
    actions: () => ["edit"],
    adapter: {
      query: async () => ({ items: [{ id: "one" }], total: 1 }),
      get: async () => ({
        identity: "one",
        values: { items: [{ name: "原条目" }] },
      }),
      empty: () => ({ items: [] }),
      create: async () => ({ status: "success" }),
      save: () => write,
    },
  });
  const page = defineCrudPage({
    definition,
    permissions: { query: true, create: true, write: true },
    initialRow: { id: "one" },
    readOnly: false,
    blocks: [
      domainBlocks<Draft>().rows({
        key: "items",
        label: "锁定条目",
        fields: [{ key: "name", label: "条目名称", type: "text" }],
        empty: () => ({ name: "" }),
        get: (rows) => rows,
        set: (_rows, value) => [...value],
      }),
    ],
  });
  const wrapper = mountPage(page);
  await flushPromises();
  const action = (name: string) =>
    hostAndDialogButtons(wrapper).find((node) => node.text() === name)!;
  const names = ["编辑锁定条目 1", "删除锁定条目 1", "新增锁定条目"];
  for (const name of names)
    expect(action(name).attributes("disabled")).toBeUndefined();
  await action("保存").trigger("click");
  await flushPromises();
  for (const name of names)
    expect(action(name).attributes("disabled")).toBeDefined();
  await action("新增锁定条目").trigger("click");
  expect(wrapper.find('input[aria-label="条目名称"]').exists()).toBe(false);
  finish({ status: "unknown" });
  await flushPromises();
  for (const name of names)
    expect(action(name).attributes("disabled")).toBeDefined();
  wrapper.unmount();
});
