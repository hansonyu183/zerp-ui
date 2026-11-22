import { afterEach, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import type {
  Collection,
  ObjectNode,
  RecordsNode,
  Workbench,
  InteractionNode,
} from "../src/model";
import { fixture, object, field, operation } from "./fixtures/static-model";
import { render } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});
function setup() {
  const f = fixture();
  const offPage = object("off-page", "外页记录", [
    field("name", "名称", "外页"),
  ]);
  const shortcut = object("shortcut", "快捷入口", [
    field("title", "名称", "最近记录"),
  ]);
  const records = (key: string, items: ObjectNode[] = []): RecordsNode =>
    reactive({
      kind: "records",
      key,
      label: key,
      readOnly: true,
      items,
      selected: null,
      operations: {},
    });
  const workbench: Workbench = reactive({
    load: operation(),
    information: records("信息"),
    vouchers: records("单据", [shortcut]),
    reports: records("报表"),
    masters: records("资料"),
    targets: new Map([[shortcut, { collection: f.rows, record: offPage }]]),
    manageReports: { collection: f.rows },
  });
  f.model.workbench = workbench;
  f.model.navigation.current = null;
  const href = vi.fn((collection: Collection | null, record?: ObjectNode) =>
    collection
      ? `/${collection.key}${record ? `?id=${record.identity}` : ""}`
      : "/",
  );
  const visit = vi.fn((collection: Collection | null, record?: ObjectNode) => {
    if (collection && record) collection.selected = record;
    f.model.navigation.current = collection;
  });
  f.model.navigation.href = href;
  f.model.navigation.visit = visit;
  return { ...f, offPage, shortcut, workbench, href, visit };
}
it("builds the workbench caption in readable, labeled member order", async () => {
  const f = setup();
  const denied = field("restricted", "权限字段", "无权摘要");
  f.shortcut.members = [
    field("z-name", "名称", "最近记录"),
    field("a-count", "数量", "0"),
    field("hidden", null, "无标签摘要"),
    denied,
  ];
  f.model.session.userPermissions = {
    owner: f.owner,
    administrator: false,
    grants: [
      { node: f.rows, read: true, write: false, operations: {} },
      { node: f.workbench.vouchers, read: true, write: false, operations: {} },
      { node: denied, read: false, write: false, operations: {} },
    ],
  };
  wrapper = await render(f.model);
  const section = wrapper.get('.zerp-workbench [aria-label="单据"]');
  expect(section.get("a").text()).toBe("最近记录 · 0");
});
it("renders real off-page workbench record and management links without changing selection", async () => {
  const f = setup();
  f.model.members = [
    {
      kind: "domain",
      key: "domain",
      label: "客户领域",
      members: [f.rows],
    },
  ];
  wrapper = await render(f.model);
  const link = wrapper.findAll("a").find((a) => a.text() === "最近记录");
  expect(link).toBeTruthy();
  expect(link!.attributes("href")).toBe("/rows?id=off-page");
  expect(f.rows.items).not.toContain(f.offPage);
  expect(f.rows.selected).toBeNull();
  const manage = wrapper.findAll("a").find((a) => a.text() === "管理常用报表");
  expect(manage?.attributes("href")).toBe("/rows");
  await link!.trigger("click", { ctrlKey: true });
  expect(f.visit).not.toHaveBeenCalled();
  expect(f.rows.selected).toBeNull();
  await link!.trigger("click");
  await flushPromises();
  expect(f.visit).toHaveBeenCalledWith(f.rows, f.offPage);
  expect(f.rows.selected).toBe(f.offPage);
});
it("includes each report target record in its own href and preserves modifier clicks", async () => {
  const f = setup();
  f.model.navigation.current = f.rows;
  const next = object("next", "第二条", [field("name", "名称", "第二条")]);
  f.rows.items.push(next);
  f.rows.report = {
    cells: [
      {
        row: f.record,
        field: "name",
        kind: "record",
        target: { collection: f.rows, record: f.offPage },
        label: "外页链接",
        disabled: false,
      },
      {
        row: next,
        field: "name",
        kind: "record",
        target: { collection: f.rows, record: next },
        label: "当前链接",
        disabled: false,
      },
    ],
  };
  wrapper = await render(f.model);
  const links = wrapper.findAll("a");
  const first = links.find((a) => a.attributes("aria-label") === "外页链接")!,
    second = links.find((a) => a.attributes("aria-label") === "当前链接")!;
  expect(first.attributes("href")).toBe("/rows?id=off-page");
  expect(second.attributes("href")).toBe("/rows?id=next");
  expect(f.rows.selected).toBeNull();
  await first.trigger("click", { metaKey: true });
  expect(f.visit).not.toHaveBeenCalled();
  await first.trigger("click");
  await flushPromises();
  expect(f.visit).toHaveBeenCalledWith(f.rows, f.offPage);
});

it("rejects a record already owned by a different root collection", async () => {
  const f = setup();
  f.model.members.push({
    ...f.rows,
    key: "other",
    label: "其他",
    conditions: object("other-conditions", "条件"),
    items: [f.offPage],
    selected: null,
    draft: null,
  });
  wrapper = await render(f.model);
  expect(wrapper.findAll("a").some((a) => a.text() === "最近记录")).toBe(false);
  expect(f.rows.selected).toBeNull();
});
it("hides revoked workbench targets and rejects an old link before the next render", async () => {
  const f = setup();
  wrapper = await render(f.model);
  const link = wrapper.findAll("a").find((a) => a.text() === "最近记录")!;
  f.model.session = {
    state: "ready",
    owner: f.owner,
    userPermissions: {
      owner: f.owner,
      administrator: false,
      grants: [
        {
          node: f.workbench.vouchers,
          read: true,
          write: false,
          operations: {},
        },
        { node: f.workbench.reports, read: true, write: false, operations: {} },
      ],
    },
  };
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
  });
  link.element.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(f.visit).not.toHaveBeenCalled();
  await flushPromises();
  expect(
    wrapper
      .findAll("a")
      .some((a) => a.text() === "最近记录" || a.text() === "管理常用报表"),
  ).toBe(false);
});
it("preserves read-only navigation, business disable and the legacy get entry", async () => {
  const f = setup();
  f.offPage.readOnly = true;
  f.shortcut.readOnly = true;
  const get = vi.fn(async () => {});
  f.shortcut.operations.get = operation(get);
  wrapper = await render(f.model);
  const previous = wrapper.findAll("a").find((a) => a.text() === "最近记录")!;
  f.shortcut.operations.get.disabled = true;
  f.model.messages.push({
    id: "workbench-blocker",
    level: "warning",
    text: "最近记录暂不可读取",
    target: f.shortcut,
  });
  const denied = new MouseEvent("click", { bubbles: true, cancelable: true });
  previous.element.dispatchEvent(denied);
  expect(denied.defaultPrevented).toBe(true);
  expect(f.visit).not.toHaveBeenCalled();
  await flushPromises();
  expect(wrapper.findAll("a").some((a) => a.text() === "最近记录")).toBe(false);
  const caption = wrapper
    .findAll(".zerp-workbench-links .v-list-item")
    .find((item) => item.text() === "最近记录")!;
  expect(caption.attributes("role")).toBe("listitem");
  expect(caption.attributes("tabindex")).toBeUndefined();
  const card = wrapper.get('.zerp-workbench [aria-label="单据"]');
  expect(card.text()).toContain("最近记录暂不可读取");
  expect(card.find('button[aria-label="关闭警告提示"]').exists()).toBe(false);
  f.shortcut.operations.get.disabled = false;
  await flushPromises();
  await wrapper
    .findAll("a")
    .find((a) => a.text() === "最近记录")!
    .trigger("click");
  expect(f.visit).toHaveBeenCalledWith(f.rows, f.offPage);
  expect(get).not.toHaveBeenCalled();
  f.model.navigation.current = null;
  f.workbench.targets = undefined;
  await flushPromises();
  const legacy = wrapper
    .findAll(".zerp-workbench-links .v-list-item")
    .find((a) => a.text() === "最近记录")!;
  await legacy.trigger("click");
  expect(get).toHaveBeenCalledTimes(1);
});
it("preserves each finite interaction target as an actual record anchor", async () => {
  const f = setup();
  f.model.workbench = undefined;
  f.model.navigation.current = f.rows;
  const node: InteractionNode = reactive({
    kind: "interactions",
    key: "links",
    label: "关联",
    readOnly: true,
    value: {},
    items: [
      {
        kind: "related",
        id: "related",
        label: "外页关联",
        target: { collection: f.rows, record: f.offPage },
      },
      {
        kind: "menu",
        id: "menu",
        label: "菜单",
        items: [
          {
            key: "entry",
            label: "菜单记录",
            target: { collection: f.rows, record: f.record },
          },
        ],
      },
    ],
  });
  f.rows.conditions.members.push(node);
  wrapper = await render(f.model);
  const related = wrapper.findAll("a").find((a) => a.text() === "外页关联")!;
  expect(related.attributes("href")).toBe("/rows?id=off-page");
  const menu = wrapper.findAll("a").find((a) => a.text() === "菜单记录")!;
  expect(menu.attributes("href")).toBe("/rows?id=r1");
  await related.trigger("click", { metaKey: true });
  expect(f.visit).not.toHaveBeenCalled();
  await related.trigger("click");
  expect(f.visit).toHaveBeenCalledWith(f.rows, f.offPage);
});
it("isolates target edges after a workbench owner is replaced", async () => {
  const f = setup();
  wrapper = await render(f.model);
  const link = wrapper.findAll("a").find((a) => a.text() === "最近记录")!;
  f.model.session = { state: "anonymous", owner: null, userPermissions: null };
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.element.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(f.visit).not.toHaveBeenCalled();
  await flushPromises();
  expect(wrapper.findAll("a").some((a) => a.text() === "最近记录")).toBe(false);
});

it.each(["removed", "replaced"] as const)(
  "rejects the old workbench anchor when its target is %s before patching",
  async (change) => {
    const f = setup();
    const get = vi.fn(async () => {});
    f.shortcut.operations.get = operation(get);
    wrapper = await render(f.model);
    const link = wrapper.findAll("a").find((a) => a.text() === "最近记录")!;
    if (change === "removed") f.workbench.targets = new Map();
    else
      f.workbench.targets = new Map([
        [f.shortcut, { collection: f.rows, record: f.record }],
      ]);
    for (const modifiers of [{}, { ctrlKey: true }, { metaKey: true }]) {
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ...modifiers,
      });
      link.element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(get).not.toHaveBeenCalled();
    expect(f.visit).not.toHaveBeenCalled();
    expect(f.rows.selected).toBeNull();
  },
);
it.each(["disabled", "removed", "replaced"] as const)(
  "rejects an old related anchor when its item is %s before patching",
  async (change) => {
    const f = setup();
    f.model.workbench = undefined;
    f.model.navigation.current = f.rows;
    const related = reactive({
      kind: "related" as const,
      id: "related",
      label: "同步关联",
      disabled: false,
      target: { collection: f.rows, record: f.record },
    });
    const node: InteractionNode = reactive({
      kind: "interactions",
      key: "links",
      label: "关联",
      readOnly: true,
      value: {},
      items: [related],
    });
    f.rows.conditions.members.push(node);
    wrapper = await render(f.model);
    const link = wrapper.findAll("a").find((a) => a.text() === "同步关联")!;
    if (change === "disabled") related.disabled = true;
    else if (change === "removed") node.items = [];
    else related.target = { collection: f.rows, record: f.offPage };
    for (const modifiers of [{}, { ctrlKey: true }, { metaKey: true }]) {
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ...modifiers,
      });
      link.element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(f.visit).not.toHaveBeenCalled();
    expect(f.rows.selected).toBeNull();
  },
);

it("rejects the old report record href when the current fact target is replaced before patching", async () => {
  const f = setup();
  f.model.workbench = undefined;
  f.model.navigation.current = f.rows;
  const fact = reactive({
    row: f.record,
    field: "name",
    kind: "record" as const,
    target: { collection: f.rows, record: f.record },
    label: "报表关联",
    disabled: false,
  });
  f.rows.report = { cells: [fact] };
  wrapper = await render(f.model);
  const link = wrapper.get('a[aria-label="报表关联"]');
  fact.target = { collection: f.rows, record: f.offPage };
  for (const modifiers of [{}, { ctrlKey: true }, { metaKey: true }]) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...modifiers,
    });
    link.element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  expect(f.visit).not.toHaveBeenCalled();
  expect(f.rows.selected).toBeNull();
});
it.each([
  ["menu", "removed"],
  ["menu", "disabled"],
  ["menu", "replaced"],
  ["tree", "removed"],
  ["tree", "disabled"],
  ["tree", "replaced"],
] as const)(
  "rejects an old %s record anchor when %s before patching",
  async (kind, change) => {
    const f = setup();
    f.model.workbench = undefined;
    f.model.navigation.current = f.rows;
    const entry = reactive({
      key: "entry",
      label: "菜单关联",
      target: { collection: f.rows, record: f.record },
      disabled: false,
    });
    const node: InteractionNode = reactive({
      kind: "interactions",
      key: "links",
      label: "关联",
      readOnly: true,
      value: {},
      items: [{ kind, id: "menu", label: "菜单", items: [entry] }],
    });
    f.rows.conditions.members.push(node);
    wrapper = await render(f.model);
    const link = wrapper.findAll("a").find((a) => a.text() === "菜单关联")!;
    if (change === "removed") node.items = [];
    else if (change === "disabled") entry.disabled = true;
    else entry.target = { collection: f.rows, record: f.offPage };
    for (const modifiers of [{}, { ctrlKey: true }, { metaKey: true }]) {
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ...modifiers,
      });
      link.element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(f.visit).not.toHaveBeenCalled();
    expect(f.rows.selected).toBeNull();
  },
);
it("rejects the report's old native href when the target identity changes before patching", async () => {
  const f = setup();
  f.model.workbench = undefined;
  f.model.navigation.current = f.rows;
  f.rows.report = {
    cells: [
      {
        row: f.record,
        field: "name",
        kind: "record",
        target: { collection: f.rows, record: f.record },
        label: "身份关联",
        disabled: false,
      },
    ],
  };
  wrapper = await render(f.model);
  const link = wrapper.get('a[aria-label="身份关联"]');
  f.record.identity = "changed";
  for (const modifiers of [{}, { ctrlKey: true }, { metaKey: true }]) {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ...modifiers,
    });
    link.element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  expect(f.visit).not.toHaveBeenCalled();
  expect(f.rows.selected).toBeNull();
});
