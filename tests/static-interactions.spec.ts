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
function action(label: string) {
  return wrapper!.findAll("button,a").find((b) => b.text() === label);
}
async function click(label: string) {
  const button = action(label)!;
  expect(button).toBeTruthy();
  await button.trigger("click");
  await flushPromises();
}
function scriptFile(f: ReturnType<typeof setup>, run = vi.fn(async () => {})) {
  const target = reactive({
    kind: "download" as const,
    operation: operation(run),
  });
  f.node.items = [{ kind: "download", id: "file", label: "下载文件", target }];
  return target;
}
it("requires download permission while allowing authorized read-only downloads", async () => {
  const f = setup(),
    run = vi.fn(async () => {});
  const target = scriptFile(f, run);
  f.node.readOnly = true;
  f.model.session = {
    state: "ready",
    owner: f.owner,
    userPermissions: {
      owner: f.owner,
      administrator: false,
      grants: [
        { node: f.rows, read: true, write: false, operations: { query: true } },
      ],
    },
  };
  await flushPromises();
  expect(
    wrapper!.findAll("button").some((button) => button.text() === "下载文件"),
  ).toBe(false);
  if (!f.model.session.userPermissions.administrator)
    f.model.session.userPermissions.grants[0]!.operations.download = true;
  target.operation.disabled = true;
  await flushPromises();
  expect(action("下载文件")).toBeUndefined();
  expect(run).not.toHaveBeenCalled();
  target.operation.disabled = false;
  const entry = f.node.items[0]!;
  if (entry.kind === "download") entry.disabled = true;
  await flushPromises();
  expect(action("下载文件")).toBeUndefined();
  expect(run).not.toHaveBeenCalled();
  if (entry.kind === "download") entry.disabled = false;
  await flushPromises();
  await click("下载文件");
  expect(run).toHaveBeenCalledTimes(1);
});
it("prevents duplicate script downloads and reports current failures", async () => {
  let finish!: () => void;
  const f = setup(),
    run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
  scriptFile(f, run);
  await flushPromises();
  await click("下载文件");
  await click("下载文件");
  expect(run).toHaveBeenCalledTimes(1);
  finish();
  await flushPromises();
  scriptFile(
    f,
    vi.fn(async () => {
      throw Error("file failed");
    }),
  );
  await flushPromises();
  await click("下载文件");
  expect(document.body.textContent).toContain("操作失败");
});
it.each(["entry", "node", "owner", "model"] as const)(
  "isolates late download failures after replacing the %s",
  async (replacement) => {
    let reject!: (error: Error) => void;
    const f = setup();
    scriptFile(
      f,
      vi.fn(
        () =>
          new Promise<void>((_resolve, no) => {
            reject = no;
          }),
      ),
    );
    await flushPromises();
    await click("下载文件");
    if (replacement === "entry") f.node.items = [];
    else if (replacement === "node") f.rows.conditions.members = [];
    else if (replacement === "owner")
      f.model.session = {
        state: "anonymous",
        owner: null,
        userPermissions: null,
      };
    else await wrapper!.setProps({ model: fixture().model });
    await flushPromises();
    reject(Error("old file failed"));
    await flushPromises();
    expect(document.body.textContent).not.toContain("操作失败");
  },
);
it("downloads distinct script files in read-only views without replacing collection export", async () => {
  const f = setup();
  const first = vi.fn(async () => {}),
    second = vi.fn(async () => {});
  const exported = vi.fn(async () => {});
  f.rows.operations.export = operation(exported);
  f.node.readOnly = true;
  f.node.items = [
    {
      kind: "download",
      id: "a",
      label: "下载甲",
      target: { kind: "download", operation: operation(first) },
    },
    {
      kind: "download",
      id: "b",
      label: "下载乙",
      target: { kind: "download", operation: operation(second) },
    },
    {
      kind: "download",
      id: "collection",
      label: "导出集合",
      target: { collection: f.rows },
    },
  ];
  await flushPromises();
  await click("下载甲");
  await click("下载乙");
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(exported).not.toHaveBeenCalled();
  expect(f.visit).not.toHaveBeenCalled();
  expect(wrapper!.find('[role="region"][aria-label="下载甲"]').exists()).toBe(
    false,
  );
  await click("导出集合");
  expect(exported).toHaveBeenCalledTimes(1);
});
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
  const previous = action("重新计算")!;
  f.node.readOnly = true;
  await previous.trigger("click");
  expect(action("重新计算")).toBeUndefined();
  f.node.readOnly = false;
  f.action.operation.disabled = true;
  await flushPromises();
  expect(action("重新计算")).toBeUndefined();
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
