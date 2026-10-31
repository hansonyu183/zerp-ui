import { defineComponent, h, ref, shallowRef, type Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import {
  CrudView,
  ConfigurationView,
  defineCrud,
  defineConfiguration,
  type CrudDefinition,
  type ConfigurationDefinition,
  type CrudViewHandle,
  type ConfigurationViewHandle,
} from "../src/index";
const row = { id: "one", name: "原值" };
const crud = (): CrudDefinition<{ name: string }, {}, typeof row, string> =>
  defineCrud({
    resource: "protected",
    title: "保护资料",
    fields: [{ key: "name", label: "名称", type: "text", required: true }],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: (r: typeof row) => r.id,
    actions: () => ["view", "edit"] as const,
    adapter: {
      empty: () => ({ name: "" }),
      query: async () => ({ items: [row], total: 1 }),
      get: async () => ({ values: { name: "原值" }, identity: "one" }),
      create: vi.fn(async () => ({ status: "success" as const })),
      save: vi.fn(async () => ({ status: "success" as const })),
    },
  });
const config = (): ConfigurationDefinition<
  { name: string },
  {},
  typeof row,
  string
> => {
  const d = crud();
  return defineConfiguration({
    ...d,
    adapter: {
      ...d.adapter,
      save: vi.fn(async () => ({ status: "success" as const })),
    },
  });
};
const button = (w: ReturnType<typeof mount>, name: string) =>
  w
    .findAll("button")
    .find((b) => b.text() === name || b.attributes("aria-label") === name)!;
async function click(w: ReturnType<typeof mount>, name: string) {
  await button(w, name).trigger("click");
  await flushPromises();
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
for (const kind of ["crud", "configuration"] as const) {
  const View = (kind === "crud" ? CrudView : ConfigurationView) as Component;
  const permissions =
    kind === "crud"
      ? { query: true, create: true, write: true }
      : { read: true, write: true };
  const closeLabel = kind === "crud" ? "取消编辑" : "关闭编辑";
  it(`${kind} blocks unfinished filter submissions independently of editing and rereads adopted filters`, async () => {
    const query = vi.fn(
      async (_input: {
        scope: string;
        filters: { count: number | null };
        page: number;
        pageSize: number;
      }) => ({ items: [row], total: 40 }),
    );
    const base = kind === "crud" ? crud() : config();
    const definition = {
      ...base,
      filters: [{ key: "count", label: "筛选整数", type: "integer" as const }],
      initialFilters: () => ({ count: 12 }),
      adapter: { ...base.adapter, query },
    };
    const w = mount(View, { props: { definition, scope: "a", permissions } });
    await flushPromises();
    await w.get('input[aria-label="筛选整数"]').setValue("20");
    await w.get('input[aria-label="筛选整数"]').setValue("-");
    query.mockClear();
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(query).not.toHaveBeenCalled();
    expect(button(w, "查询").attributes("disabled")).toBeDefined();
    expect(w.emitted("queried")?.at(-1)).toEqual([{ count: 12 }]);
    await click(w, "下一页");
    expect(query).toHaveBeenLastCalledWith({
      scope: "a",
      filters: { count: 12 },
      page: 2,
      pageSize: 20,
    });
    await click(w, "编辑");
    expect(w.emitted("protection")?.at(-1)).toEqual([
      { dirty: false, localPending: false, invalid: false, writeState: "idle" },
    ]);
    await click(w, closeLabel);
    expect(button(w, "查询").attributes("disabled")).toBeDefined();
    await click(w, "编辑");
    await w.get('input[aria-label="名称"]').setValue("修改");
    await click(w, "保存");
    expect(query).toHaveBeenLastCalledWith({
      scope: "a",
      filters: { count: 12 },
      page: 2,
      pageSize: 20,
    });
    expect(w.get('input[aria-label="筛选整数"]').element).toHaveProperty(
      "value",
      "-",
    );
    expect(button(w, "查询").attributes("disabled")).toBeDefined();
    await w.get('input[aria-label="筛选整数"]').setValue("30");
    await w.get("form").trigger("submit");
    await flushPromises();
    expect(query).toHaveBeenLastCalledWith({
      scope: "a",
      filters: { count: 30 },
      page: 1,
      pageSize: 20,
    });
    expect(w.emitted("queried")?.at(-1)).toEqual([{ count: 30 }]);
    w.unmount();
  });
  it(`${kind} clears unfinished filters when permissions, scope or resource change`, async () => {
    const base = kind === "crud" ? crud() : config();
    const definition = {
      ...base,
      filters: [{ key: "count", label: "筛选整数", type: "integer" as const }],
      initialFilters: () => ({ count: 12 }),
    };
    const w = mount(View, { props: { definition, scope: "a", permissions } });
    await flushPromises();
    for (const next of [
      { permissions: { ...permissions, write: false } },
      { scope: "b" },
      { definition: { ...definition, resource: "new-resource" } },
    ]) {
      await w.get('input[aria-label="筛选整数"]').setValue("-");
      expect(button(w, "查询").attributes("disabled")).toBeDefined();
      await w.setProps(next);
      await flushPromises();
      expect(w.get('input[aria-label="筛选整数"]').element).toHaveProperty(
        "value",
        "12",
      );
      expect(button(w, "查询").attributes("disabled")).toBeUndefined();
    }
    w.unmount();
  });
  it(`${kind} offers explicit local discard and keeps a clean open unprotected`, async () => {
    const w = mount(View, {
      props: {
        definition: kind === "crud" ? crud() : config(),
        scope: "a",
        permissions,
      },
    });
    await flushPromises();
    await click(w, "编辑");
    await click(w, closeLabel);
    expect(w.find('[aria-label="未保存修改"]').exists()).toBe(false);
    await click(w, "编辑");
    await w.get('input[aria-label="名称"]').setValue("修改");
    await click(w, closeLabel);
    expect(w.find('[aria-label="未保存修改"]').exists()).toBe(true);
    await click(w, "继续编辑");
    expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
      "value",
      "修改",
    );
    await click(w, closeLabel);
    await click(w, "放弃本地修改");
    expect(w.find('input[aria-label="名称"]').exists()).toBe(false);
    w.unmount();
  });
  it(`${kind} rejects a stale external switch after identity changes during confirmation`, async () => {
    const answer = deferred<boolean>();
    const scope = ref("a");
    const handle = shallowRef<
      CrudViewHandle<typeof row> | ConfigurationViewHandle<typeof row> | null
    >(null);
    const definition = kind === "crud" ? crud() : config();
    const Host = defineComponent(
      () => () =>
        h("main", [
          h(
            "button",
            { onClick: () => handle.value?.openRow({ ...row, id: "next" }) },
            "外部打开",
          ),
          h(View, {
            ref: handle,
            scope: scope.value,
            permissions,
            definition,
            beforeClose: () => answer.promise,
          }),
        ]),
    );
    const w = mount(Host);
    await flushPromises();
    await click(w, "编辑");
    await w.get('input[aria-label="名称"]').setValue("旧输入");
    await click(w, "外部打开");
    scope.value = "b";
    await flushPromises();
    answer.resolve(true);
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });
}
it("views historical facts without create validation and refuses a server-denied edit", async () => {
  const base = crud();
  const d = {
    ...base,
    adapter: {
      ...base.adapter,
      get: async () => ({
        values: { name: "" },
        identity: "one",
        writable: false,
      }),
    },
  };
  const w = mount(CrudView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { query: true, create: true, write: true },
    },
  });
  await flushPromises();
  await click(w, "查看");
  expect(w.get('[role="dialog"]').text()).toContain("（空字符串）");
  expect(w.find('input[aria-label="名称"]').exists()).toBe(false);
  expect(
    w
      .get('[role="dialog"]')
      .findAll("button")
      .map((b) => b.text()),
  ).not.toContain("编辑");
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    dirty: false,
    invalid: false,
  });
  w.unmount();
});
it("retained configuration refresh failure keeps the write locked until authoritative detail arrives", async () => {
  const base = config();
  const get = vi.fn(base.adapter.get);
  const d = { ...base, adapter: { ...base.adapter, get } };
  const w = mount(ConfigurationView as Component, {
    props: {
      definition: d,
      scope: "a",
      permissions: { read: true, write: true },
      retainEditor: true,
    },
  });
  await flushPromises();
  await click(w, "编辑");
  await w.get('input[aria-label="名称"]').setValue("修改");
  get.mockRejectedValueOnce(new Error("详情读取失败"));
  await click(w, "保存");
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    writeState: "refresh",
  });
  await click(w, "关闭编辑");
  expect(w.find('input[aria-label="名称"]').exists()).toBe(true);
  await click(w, "重试读取");
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    dirty: false,
    writeState: "idle",
  });
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  w.unmount();
});
it("configuration snapshots are isolated readonly facts and cannot rewrite the draft", async () => {
  const d = config(),
    w = mount(ConfigurationView as Component, {
      props: {
        definition: d,
        scope: "snapshot",
        permissions: { read: true, write: true },
      },
    });
  await flushPromises();
  await click(w, "编辑");
  const snapshot = w.emitted("draft")?.at(-1)?.[0] as {
    values: { name: string };
  };
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.values)).toBe(true);
  expect(() => {
    snapshot.values.name = "outside";
  }).toThrow();
  await click(w, "保存");
  expect(d.adapter.save).toHaveBeenCalledWith(
    expect.objectContaining({ input: { name: "原值" } }),
  );
  w.unmount();
});
it("never guesses a new configuration identity from the refreshed list", async () => {
  const d = config();
  const get = vi.fn(d.adapter.get);
  d.adapter.get = get;
  const w = mount(ConfigurationView as Component, {
    props: {
      definition: d,
      scope: "missing-identity",
      permissions: { read: true, write: true },
      retainEditor: true,
    },
  });
  await flushPromises();
  await click(w, "新增配置");
  await w.get('input[aria-label="名称"]').setValue("new");
  await click(w, "保存");
  expect(w.text()).toContain("协议未返回新记录身份");
  expect(get).not.toHaveBeenCalled();
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    writeState: "refresh",
  });
  await click(w, "重试读取");
  expect(d.adapter.save).toHaveBeenCalledTimes(1);
  expect(get).not.toHaveBeenCalled();
  w.unmount();
});
it("CRUD keeps unfinished filters visible until completed before expanding or collapsing conditions", async () => {
  const definition = {
    ...crud(),
    filters: [
      { key: "count", label: "筛选整数", type: "integer" as const },
      { key: "limit", label: "更多整数", type: "integer" as const },
    ],
    initialFilters: () => ({ count: 12, limit: 5 }),
  };
  const w = mount(CrudView as Component, {
    props: {
      definition,
      scope: "a",
      permissions: { query: true, create: true, write: true },
    },
  });
  await flushPromises();
  await w.get('input[aria-label="筛选整数"]').setValue("-");
  expect(button(w, "更多条件").attributes("disabled")).toBeDefined();
  await click(w, "更多条件");
  expect(w.get('input[aria-label="筛选整数"]').element).toHaveProperty(
    "value",
    "-",
  );
  expect(button(w, "查询").attributes("disabled")).toBeDefined();
  await w.get('input[aria-label="筛选整数"]').setValue("20");
  await click(w, "更多条件");
  await w.get('input[aria-label="更多整数"]').setValue("-");
  expect(button(w, "收起条件").attributes("disabled")).toBeDefined();
  await click(w, "收起条件");
  expect(w.get('input[aria-label="更多整数"]').element).toHaveProperty(
    "value",
    "-",
  );
  expect(button(w, "查询").attributes("disabled")).toBeDefined();
  await w.get('input[aria-label="更多整数"]').setValue("8");
  await click(w, "收起条件");
  expect(w.find('input[aria-label="更多整数"]').exists()).toBe(false);
  expect(button(w, "查询").attributes("disabled")).toBeUndefined();
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(w.emitted("queried")?.at(-1)).toEqual([{ count: 20, limit: 8 }]);
  w.unmount();
});
it("CRUD blocks preserve key ownership, structural baselines, pending protection and generation", async () => {
  const { configurationBlock } = await import("../src/index");
  type Settings = { code: string; enabled: boolean };
  type Draft = { name: string; settings: Settings };
  const late: Array<(pending: boolean) => void> = [];
  const Block = defineComponent(
    (
      p: import("../src/index").ConfigurationBlockProps<
        Settings,
        readonly string[]
      >,
    ) => {
      late.push(p.onPending!);
      return () =>
        h("fieldset", { disabled: p.disabled }, [
          h(
            "button",
            {
              onClick: () =>
                p["onUpdate:modelValue"]?.({ enabled: true, code: "A" }),
            },
            "恢复区块",
          ),
          h(
            "button",
            {
              onClick: () =>
                p["onUpdate:modelValue"]?.({ code: "B", enabled: true }),
            },
            "改动区块",
          ),
          h("button", { onClick: () => p.onPending?.(true) }, "区块未完成"),
        ]);
    },
    {
      props: [
        "modelValue",
        "catalog",
        "mode",
        "disabled",
        "onUpdate:modelValue",
        "onPending",
      ],
    },
  );
  const d = defineCrud<Draft, {}, typeof row, string>({
    ...crud(),
    fields: [{ key: "name", label: "名称", type: "text" }],
    adapter: {
      ...crud().adapter,
      empty: () => ({ name: "", settings: { code: "A", enabled: true } }),
      get: async () => ({
        identity: "one",
        values: { name: "原值", settings: { code: "A", enabled: true } },
      }),
      create: async () => ({ status: "success" }),
      save: vi.fn(async () => ({ status: "success" as const })),
    },
  });
  const blocks = [
    configurationBlock<Draft>()({
      key: "settings",
      component: Block,
      catalog: [] as readonly string[],
    }),
  ];
  const w = mount(CrudView as Component, {
    props: {
      definition: d,
      blocks,
      scope: "blocks",
      permissions: { query: true, create: true, write: true },
    },
  });
  await flushPromises();
  await click(w, "编辑");
  await click(w, "改动区块");
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({ dirty: true });
  await click(w, "恢复区块");
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({ dirty: false });
  await click(w, "区块未完成");
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    dirty: false,
    localPending: true,
  });
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await click(w, "取消编辑");
  await click(w, "放弃本地修改");
  await click(w, "编辑");
  late[0](true);
  await flushPromises();
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    localPending: false,
  });
  await click(w, "保存");
  expect(d.adapter.save).toHaveBeenCalledWith(
    expect.objectContaining({
      input: { name: "原值", settings: { code: "A", enabled: true } },
    }),
  );
  w.unmount();
});
it("restores retained new configuration only from exact reconciliation identity after remount", async () => {
  const base = config();
  const get = vi.fn(async ({ identity }: { identity: string }) => ({
    identity,
    values: { name: "权威创建结果" },
  }));
  const save = vi.fn(async () => ({ status: "unknown" as const }));
  const d: ConfigurationDefinition<
    { name: string },
    {},
    typeof row,
    string,
    { request: string }
  > = {
    ...base,
    adapter: { ...base.adapter, get, save },
    reconcile: async (a) => ({
      status: "applied",
      attemptId: a.id,
      evidence: { request: a.id },
      identity: "authoritative-created",
    }),
  };
  const props = {
    definition: d,
    scope: "retained-reconcile",
    permissions: { read: true, write: true, reconcile: true },
    retainEditor: true,
  };
  let w = mount(ConfigurationView as Component, { props });
  await flushPromises();
  await click(w, "新增配置");
  await w.get('input[aria-label="名称"]').setValue("发送草稿");
  await click(w, "保存");
  w.unmount();
  w = mount(ConfigurationView as Component, { props });
  await flushPromises();
  await click(w, "核实本次请求");
  expect(get).toHaveBeenCalledWith({
    scope: "retained-reconcile",
    identity: "authoritative-created",
  });
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "权威创建结果",
  );
  expect(w.emitted("protection")?.at(-1)?.[0]).toMatchObject({
    dirty: false,
    writeState: "idle",
  });
  expect(save).toHaveBeenCalledTimes(1);
  w.unmount();
});
