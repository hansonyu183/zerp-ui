import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { BusinessApplication } from "../src/index";
import type { InteractionNode } from "../src/model";
import { fixture, operation } from "./fixtures/static-model";

let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});
function setup(run = vi.fn(async () => {})) {
  const f = fixture();
  const action = reactive({
    kind: "action" as const,
    operation: operation(run),
  });
  const node: InteractionNode = reactive({
    kind: "interactions",
    key: "questions",
    label: "业务提示",
    readOnly: false,
    value: {},
    items: [
      {
        kind: "menu",
        id: "menu",
        label: "菜单",
        items: [{ key: "calculate", label: "重新计算", target: action }],
      },
      {
        kind: "tree",
        id: "tree",
        label: "树",
        items: [
          {
            key: "group",
            label: "目录",
            target: { collection: f.rows },
            children: [{ key: "child", label: "计算子项", target: action }],
          },
        ],
      },
    ],
  });
  f.rows.conditions.members.push(node);
  const visit = vi.fn(f.model.navigation.visit);
  f.model.navigation.visit = visit;
  wrapper = mount(BusinessApplication, {
    props: { model: f.model },
    attachTo: document.body,
    global: {
      plugins: [
        createRouter({
          history: createMemoryHistory(),
          routes: [
            { path: "/:pathMatch(.*)*", component: { template: "<div />" } },
          ],
        }),
      ],
    },
  });
  return { ...f, node, action, run, visit };
}
async function click(label: string) {
  const button = wrapper!.findAll("button").find((b) => b.text() === label)!;
  expect(button).toBeTruthy();
  await button.trigger("click");
  await flushPromises();
}
it("executes menu and tree callbacks without navigating", async () => {
  const f = setup();
  await flushPromises();
  await click("重新计算");
  await click("计算子项");
  expect(f.run).toHaveBeenCalledTimes(2);
  expect(f.visit).not.toHaveBeenCalled();
  expect(f.rows.selected).toBeNull();
});
it("rechecks explicit interaction permission, read-only and disabled state", async () => {
  const f = setup();
  await flushPromises();
  f.model.session = {
    state: "ready",
    owner: f.owner,
    userPermissions: {
      owner: f.owner,
      administrator: false,
      grants: [
        { node: f.rows, read: true, write: true, operations: { query: true } },
      ],
    },
  };
  await flushPromises();
  expect(
    wrapper!.findAll("button").some((button) => button.text() === "重新计算"),
  ).toBe(false);
  expect(f.run).not.toHaveBeenCalled();
  if (
    f.model.session.userPermissions &&
    !f.model.session.userPermissions.administrator
  )
    f.model.session.userPermissions.grants[0]!.operations.interact = true;
  await flushPromises();
  f.node.readOnly = true;
  await click("重新计算");
  f.node.readOnly = false;
  f.action.operation.disabled = true;
  await click("重新计算");
  expect(f.run).not.toHaveBeenCalled();
  f.action.operation.disabled = false;
  await flushPromises();
  await click("重新计算");
  expect(f.run).toHaveBeenCalledTimes(1);
});
it("prevents duplicate menu/tree execution while the owner node is busy", async () => {
  let finish!: () => void;
  const f = setup(
    vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  await flushPromises();
  await click("重新计算");
  await click("计算子项");
  expect(f.run).toHaveBeenCalledTimes(1);
  finish();
  await flushPromises();
  await click("计算子项");
  expect(f.run).toHaveBeenCalledTimes(2);
  finish();
  await flushPromises();
});
it.each(["entry", "node", "hidden", "owner", "model"] as const)(
  "isolates late action failures after replacing the %s",
  async (replacement) => {
    let reject!: (error: Error) => void;
    const f = setup(
      vi.fn(
        () =>
          new Promise<void>((_resolve, no) => {
            reject = no;
          }),
      ),
    );
    await flushPromises();
    await click("重新计算");
    if (replacement === "entry") f.node.items = [];
    else if (replacement === "node") f.rows.conditions.members = [];
    else if (replacement === "hidden") f.node.label = null;
    else if (replacement === "owner")
      f.model.session = {
        state: "anonymous",
        owner: null,
        userPermissions: null,
      };
    else await wrapper!.setProps({ model: fixture().model });
    await flushPromises();
    reject(Error("old action rejected"));
    await flushPromises();
    expect(document.body.textContent).not.toContain("操作失败");
  },
);
it("reports a current action failure and preserves navigation and downloads", async () => {
  const f = setup(
    vi.fn(async () => {
      throw Error("failed");
    }),
  );
  const download = vi.fn(async () => {});
  f.rows.operations.export = operation(download);
  f.node.items = [
    ...f.node.items,
    {
      kind: "related",
      id: "related",
      label: "关联记录",
      target: { collection: f.rows, record: f.record },
    },
    {
      kind: "download",
      id: "download",
      label: "下载",
      target: { collection: f.rows },
    },
  ];
  await flushPromises();
  await click("重新计算");
  expect(document.body.textContent).toContain("操作失败");
  await click("关联记录");
  expect(f.visit).toHaveBeenCalledTimes(1);
  expect(f.rows.selected).toBe(f.record);
  f.rows.selected = null;
  await flushPromises();
  await click("下载");
  expect(download).toHaveBeenCalledTimes(1);
});
