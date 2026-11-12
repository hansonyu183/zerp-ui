import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import {
  AppPage,
  defineConfigurationPage,
  domainBlocks,
} from "./fixtures/assembly";
import { hostAndDialogButtons } from "./host-and-dialog-buttons";
type Draft = {
  first: { name: string };
  second: { count: number; required: string };
};
const mounted: VueWrapper[] = [];
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()));
async function start(count = 2) {
  const save = vi.fn(async () => ({ status: "success" as const }));
  const query = vi.fn(async () => ({
    items: [{ id: "one" }, { id: "two" }],
    total: 2,
  }));
  const block = domainBlocks<Draft>();
  const blocks = [
    block.fields({
      key: "first",
      label: "基本",
      fields: [{ key: "name", label: "名称", type: "text" }],
    }),
    block.fields({
      key: "second",
      label: "控制",
      fields: [
        { key: "count", label: "数量", type: "integer" },
        { key: "required", label: "必填项", type: "text", required: true },
      ],
    }),
  ].slice(0, count);
  const definition = {
    resource: "block-tabs",
    title: "合成配置",
    fields: [],
    filters: [],
    initialFilters: () => ({}),
    columns: [{ key: "id" as const, label: "编号" }],
    identity: (row: { id: string }) => row.id,
    adapter: {
      query,
      get: vi.fn(async ({ identity }: { identity: string }) => ({
        identity,
        values: {
          first: { name: identity },
          second: { count: 0, required: "" },
        },
      })),
      save,
    },
  };
  const page = defineConfigurationPage({
    definition,
    blocks,
    permissions: { read: true, write: true, reconcile: true },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  const w = mount(AppPage, {
    attachTo: document.body,
    props: {
      page,
      scope: "a",
      brand: {
        home: "/",
        productName: "合成库",
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
  mounted.push(w);
  await flushPromises();
  const open = async (index = 0) => {
    await hostAndDialogButtons(w)
      .filter(
        (b) => b.text() === "编辑" || b.attributes("aria-label") === "编辑",
      )
      [index]!.trigger("click");
    await flushPromises();
  };
  return { w, save, query, open, definition };
}
const click = async (w: VueWrapper, label: string) => {
  await hostAndDialogButtons(w)
    .find((b) => b.text() === label)!
    .trigger("click");
  await flushPromises();
};
it("keeps hidden groups mounted, validates all groups and saves one complete draft without tab requests", async () => {
  const { w, save, query, open, definition } = await start();
  await open();
  expect(w.findAll('[role="tab"]')).toHaveLength(2);
  await w.get('input[aria-label="名称"]').setValue("新名称");
  await click(w, "保存");
  expect(save).not.toHaveBeenCalled();
  await w.get('[role="tab"][aria-label="控制"]').trigger("click");
  await flushPromises();
  expect(w.get('input[aria-label="名称"]').element).toHaveProperty(
    "value",
    "新名称",
  );
  await w.get('input[aria-label="数量"]').setValue("12");
  await w.get('input[aria-label="必填项"]').setValue("已填写");
  expect(query).toHaveBeenCalledTimes(1);
  expect(definition.adapter.get).toHaveBeenCalledTimes(1);
  await click(w, "保存");
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      input: {
        first: { name: "新名称" },
        second: { count: 12, required: "已填写" },
      },
      identity: "one",
    }),
  );
});
it("locks tab switching for incomplete input and returns to the first group on record changes", async () => {
  const { w, open } = await start();
  await open();
  await w.get('[role="tab"][aria-label="控制"]').trigger("click");
  await flushPromises();
  await w.get('input[aria-label="数量"]').setValue("-");
  await flushPromises();
  expect(
    w.get('[role="tab"][aria-label="基本"]').attributes("disabled"),
  ).toBeDefined();
  await w.get('input[aria-label="数量"]').setValue("2");
  await flushPromises();
  await click(w, "关闭编辑");
  await click(w, "放弃本地修改");
  await open(1);
  expect(
    w.get('[role="tab"][aria-label="基本"]').attributes("aria-selected"),
  ).toBe("true");
});
for (const count of [0, 1])
  it(`renders ${count} groups without empty tab chrome`, async () => {
    const { w, open } = await start(count);
    await open();
    expect(w.findAll('[role="tablist"]')).toHaveLength(0);
    expect(w.findAll('[aria-label="内容分组"]')).toHaveLength(count);
  });
