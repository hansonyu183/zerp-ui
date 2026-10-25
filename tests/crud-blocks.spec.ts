import { defineComponent, h, type Component, type PropType } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { CrudView, defineCrud, configurationBlock } from "../src/index";
type Draft = { native: { amount: string } };
const NativeBlock = defineComponent({
  props: {
    modelValue: {
      type: Object as PropType<{ amount: string }>,
      required: true,
    },
    catalog: { type: Object, required: true },
    mode: { type: String as PropType<"read" | "edit">, required: true },
    disabled: { type: Boolean, required: true },
  },
  emits: ["update:modelValue", "pending"],
  setup(p, { emit }) {
    return () =>
      h("input", {
        "aria-label": "精确数量",
        value: p.modelValue.amount,
        disabled: p.disabled,
        readonly: p.mode === "read",
        onInput: (e: Event) =>
          emit("update:modelValue", {
            amount: (e.target as HTMLInputElement).value,
          }),
      });
  },
});
const make = () =>
  defineCrud<Draft, {}, { id: string; name: string }, string>({
    resource: "synthetic-domain",
    title: "合成资料",
    fields: [],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "name", label: "名称" }],
    identity: (r) => r.id,
    actions: () => ["edit", "delete"],
    adapter: {
      empty: () => ({ native: { amount: "" } }),
      query: async () => ({ items: [{ id: "one", name: "原记录" }], total: 1 }),
      get: async () => ({
        identity: "one",
        values: { native: { amount: "0.10" } },
      }),
      create: vi.fn(async () => ({ status: "success" as const })),
      save: vi.fn(async () => ({ status: "success" as const })),
      delete: vi.fn(async () => ({ status: "success" as const })),
    },
  });
const button = (w: ReturnType<typeof mount>, name: string) =>
  w
    .findAll("button")
    .find((b) => b.text() === name || b.attributes("aria-label") === name)!;
it("public CRUD owns saving a detached domain block draft and its original identity", async () => {
  const definition = make();
  const w = mount(CrudView as Component, {
    props: {
      definition,
      scope: "actor-a",
      permissions: { query: true, create: true, write: true },
      blocks: [
        configurationBlock<Draft>()({
          key: "native",
          component: NativeBlock,
          catalog: { unit: "kg" },
        }),
      ],
    },
  });
  await flushPromises();
  await button(w, "编辑").trigger("click");
  await flushPromises();
  await w.get('input[aria-label="精确数量"]').setValue("9007199254740993.01");
  await button(w, "保存").trigger("click");
  await flushPromises();
  expect(definition.adapter.save).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: "save",
      identity: "one",
      input: { native: { amount: "9007199254740993.01" } },
    }),
  );
  w.unmount();
});
it("read-only users can view domain facts without acquiring an editor or save action", async () => {
  const definition = make();
  definition.actions = () => ["view"];
  const w = mount(CrudView as Component, {
    props: {
      definition,
      scope: "reader",
      permissions: { query: true, create: false, write: false },
      blocks: [
        configurationBlock<Draft>()({
          key: "native",
          component: NativeBlock,
          catalog: {},
        }),
      ],
    },
  });
  await flushPromises();
  await button(w, "查看").trigger("click");
  await flushPromises();
  expect(
    w.get('input[aria-label="精确数量"]').attributes("readonly"),
  ).toBeDefined();
  expect(w.findAll("button").some((b) => b.text() === "保存")).toBe(false);
  expect(definition.adapter.save).not.toHaveBeenCalled();
  await button(w, "关闭详情").trigger("click");
  await flushPromises();
  expect(w.find('input[aria-label="精确数量"]').exists()).toBe(false);
  w.unmount();
});
it("cancelling a dirty editor requires an explicit local discard without sending a write", async () => {
  const definition = make();
  const w = mount(CrudView as Component, {
    props: {
      definition,
      scope: "discard",
      permissions: { query: true, create: true, write: true },
      blocks: [
        configurationBlock<Draft>()({
          key: "native",
          component: NativeBlock,
          catalog: {},
        }),
      ],
    },
  });
  await flushPromises();
  await button(w, "编辑").trigger("click");
  await flushPromises();
  await w.get('input[aria-label="精确数量"]').setValue("12.30");
  await button(w, "取消编辑").trigger("click");
  await flushPromises();
  expect(w.find('[aria-label="未保存修改"]').exists()).toBe(true);
  await button(w, "继续编辑").trigger("click");
  await flushPromises();
  expect(
    (w.get('input[aria-label="精确数量"]').element as HTMLInputElement).value,
  ).toBe("12.30");
  await button(w, "取消编辑").trigger("click");
  await flushPromises();
  await button(w, "放弃本地修改").trigger("click");
  await flushPromises();
  expect(w.find('input[aria-label="精确数量"]').exists()).toBe(false);
  expect(definition.adapter.save).not.toHaveBeenCalled();
  w.unmount();
});
it("block pending disables the owning save and stale callbacks cannot change the next scope", async () => {
  const callbacks: {
    update: (v: { amount: string }) => void;
    pending: (v: boolean) => void;
  }[] = [];
  const Deferred = defineComponent({
    props: {
      modelValue: {
        type: Object as PropType<{ amount: string }>,
        required: true,
      },
      catalog: { type: Object, required: true },
      mode: { type: String as PropType<"read" | "edit">, required: true },
      disabled: { type: Boolean, required: true },
    },
    emits: ["update:modelValue", "pending"],
    setup(p, { emit }) {
      callbacks.push({
        update: (v) => emit("update:modelValue", v),
        pending: (v) => emit("pending", v),
      });
      return () => h("span", { "aria-label": "区块原值" }, p.modelValue.amount);
    },
  });
  const definition = make();
  const w = mount(CrudView as Component, {
    props: {
      definition,
      scope: "first",
      permissions: { query: true, create: true, write: true },
      blocks: [
        configurationBlock<Draft>()({
          key: "native",
          component: Deferred,
          catalog: {},
        }),
      ],
    },
  });
  await flushPromises();
  await button(w, "编辑").trigger("click");
  await flushPromises();
  callbacks[0]!.pending(true);
  await flushPromises();
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await w.setProps({ scope: "second" });
  await flushPromises();
  await button(w, "编辑").trigger("click");
  await flushPromises();
  callbacks[0]!.update({ amount: "OLD" });
  callbacks[0]!.pending(false);
  await flushPromises();
  expect(w.get('[aria-label="区块原值"]').text()).toBe("0.10");
  callbacks[1]!.update({ amount: "0.30" });
  await button(w, "保存").trigger("click");
  await flushPromises();
  expect(definition.adapter.save).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: "second",
      input: { native: { amount: "0.30" } },
    }),
  );
  w.unmount();
});
it("changing create capability alone preserves the active draft and write receipt", async () => {
  const definition = make();
  let complete!: (r: { status: "success" }) => void;
  definition.adapter.save = vi.fn(
    () => new Promise<{ status: "success" }>((r) => (complete = r)),
  );
  const w = mount(CrudView as Component, {
    props: {
      definition,
      scope: "actor-a",
      permissions: { query: true, create: true, write: true },
      blocks: [
        configurationBlock<Draft>()({
          key: "native",
          component: NativeBlock,
          catalog: {},
        }),
      ],
    },
  });
  await flushPromises();
  await button(w, "编辑").trigger("click");
  await flushPromises();
  await w.get('input[aria-label="精确数量"]').setValue("1.005");
  await w.setProps({
    permissions: { query: true, create: false, write: true },
  });
  await flushPromises();
  expect(w.get('input[aria-label="精确数量"]').element).toHaveProperty(
    "value",
    "1.005",
  );
  await button(w, "保存").trigger("click");
  await flushPromises();
  await w.setProps({ permissions: { query: true, create: true, write: true } });
  complete({ status: "success" });
  await flushPromises();
  expect(w.text()).toContain("写入成功");
  expect(w.find('input[aria-label="精确数量"]').exists()).toBe(false);
  w.unmount();
});
it("read detail keeps a separately authorized delete action when get forbids editing", async () => {
  const definition = make();
  definition.actions = () => ["view", "delete"];
  definition.adapter.get = async () => ({
    identity: "one",
    values: { native: { amount: "0.10" } },
    writable: false,
  });
  const w = mount(CrudView as Component, {
    props: {
      definition,
      scope: "actor-a",
      permissions: { query: true, create: false, write: true },
      blocks: [
        configurationBlock<Draft>()({
          key: "native",
          component: NativeBlock,
          catalog: {},
        }),
      ],
    },
  });
  await flushPromises();
  await button(w, "查看").trigger("click");
  await flushPromises();
  const dialog = w.get('[role="dialog"][aria-label="查看资料"]');
  expect(dialog.text()).not.toContain("保存");
  await dialog
    .findAll("button")
    .find((b) => b.text() === "删除")!
    .trigger("click");
  await button(w, "确认删除").trigger("click");
  await flushPromises();
  expect(definition.adapter.delete).toHaveBeenCalledWith(
    expect.objectContaining({ identity: "one", operation: "delete" }),
  );
  w.unmount();
});
