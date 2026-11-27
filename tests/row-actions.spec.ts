import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import DataList from "../src/app/work/views/list/DataList.vue";

const row = { id: "one", name: "合成客户" };
const props = {
  columns: [{ key: "name", label: "名称" }],
  result: { items: [row], total: 1 },
  page: 1,
  pageSize: 20,
  rowKey: (value: typeof row) => value.id,
};

describe("public list row actions", () => {
  it("shows three named icon actions and puts the fourth in the more menu", async () => {
    const actionsForRow = vi.fn(() => ["edit", "disable", "clone", "delete"]);
    const wrapper = mount(DataList as Component, {
      attachTo: document.body,
      props: { ...props, actions: actionsForRow },
    });
    try {
      const actions = wrapper.get('td[data-label="操作"]');
      expect(actions.findAll("button[aria-label]")).toHaveLength(4);
      for (const name of ["编辑", "停用", "克隆"])
        expect(
          actions
            .get(`[aria-label="${name}"]`)
            .find('[aria-hidden="true"]')
            .exists(),
        ).toBe(true);
      expect(actions.find('[aria-label="删除"]').exists()).toBe(false);
      await actions.get('[aria-label="编辑"]').trigger("click");
      expect(wrapper.emitted("action")?.[0]).toEqual(["edit", row]);
      expect(actionsForRow).toHaveBeenCalledTimes(1);
      await actions.get('[aria-label="更多操作"]').trigger("click");
      await flushPromises();
      const item = document.querySelector('[role="menuitem"]') as HTMLElement;
      expect(item?.textContent).toContain("删除");
      item.click();
      await flushPromises();
      expect(wrapper.emitted("action")?.[1]).toEqual(["delete", row]);
    } finally {
      wrapper.unmount();
    }
  });
});

for (const actions of [
  [],
  ["view"],
  ["edit", "disable"],
  ["edit", "disable", "delete"],
]) {
  it(`renders ${actions.length} permitted actions without an empty menu`, () => {
    const wrapper = mount(DataList as Component, {
      props: { ...props, actions: () => actions },
    });
    expect(wrapper.find("th:last-child").text()).toBe("操作");
    expect(wrapper.find('[aria-label="更多操作"]').exists()).toBe(false);
    expect(wrapper.findAll('td[data-label="操作"] button')).toHaveLength(
      actions.length,
    );
    wrapper.unmount();
  });
}
it("blocks row actions while loading", async () => {
  const wrapper = mount(DataList as Component, {
    props: { ...props, actions: () => ["view"] },
  });
  try {
    await wrapper.get('[aria-label="查看"]').trigger("click");
    expect(wrapper.emitted("action")?.[0]).toEqual(["view", row]);
    await wrapper.setProps({ resultState: "loading" });
    const view = wrapper.get('[aria-label="查看"]');
    expect(view.attributes("disabled")).toBeDefined();
    await view.trigger("click");
    expect(wrapper.emitted("action")).toHaveLength(1);
  } finally {
    wrapper.unmount();
  }
});
it("supports keyboard menu access and discards a menu when the original row is replaced", async () => {
  const wrapper = mount(DataList as Component, {
    attachTo: document.body,
    props: { ...props, actions: () => ["edit", "disable", "clone", "delete"] },
  });
  try {
    const more = wrapper.get('[aria-label="更多操作"]');
    (more.element as HTMLElement).focus();
    await more.trigger("keydown", { key: "ArrowDown" });
    await flushPromises();
    await vi.waitFor(() =>
      expect(more.attributes("aria-expanded")).toBe("true"),
    );
    const focusedItem = document.querySelector(
      '[role="menuitem"]',
    ) as HTMLElement;
    focusedItem.focus();
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();
    await vi.waitFor(() => expect(document.activeElement).toBe(more.element));
    await more.trigger("click");
    await flushPromises();
    const oldItem = document.querySelector('[role="menuitem"]') as HTMLElement;
    await wrapper.setProps({
      result: { items: [{ id: "two", name: "新客户" }], total: 1 },
    });
    oldItem.click();
    await flushPromises();
    expect(wrapper.emitted("action")).toBeUndefined();
  } finally {
    wrapper.unmount();
  }
});

it("provides semantic names for workflow operations", async () => {
  const w = mount(DataList as Component, {
    attachTo: document.body,
    props: {
      ...props,
      actions: () => [
        "send",
        "withdraw",
        "approve",
        "unapprove",
        "void",
        "unvoid",
      ],
    },
  });
  try {
    for (const label of ["发送", "撤回", "审批"])
      expect(
        w.get(`[aria-label="${label}"]`).find('[aria-hidden="true"]').exists(),
      ).toBe(true);
    await w.get('[aria-label="更多操作"]').trigger("click");
    await flushPromises();
    for (const label of ["取消审批", "作废", "取消作废"])
      expect(
        [...document.querySelectorAll('[role="menuitem"]')].some((n) =>
          n.textContent?.includes(label),
        ),
      ).toBe(true);
  } finally {
    w.unmount();
  }
});

it("uses complete and uncomplete actions with stable row identity after reordering", async () => {
  const second = { id: "two", name: "第二条" };
  const w = mount(DataList as Component, {
    props: {
      ...props,
      actions: () => ["complete", "uncomplete"],
      result: { items: [row, second], total: 2 },
    },
  });
  try {
    await w.get('[aria-label="完成"]').trigger("click");
    await w.setProps({ result: { items: [second, row], total: 2 } });
    await w.get('[aria-label="取消完成"]').trigger("click");
    expect(w.emitted("action")).toEqual([
      ["complete", row],
      ["uncomplete", second],
    ]);
    await w.setProps({ resultState: "loading" });
    await w.get('[aria-label="完成"]').trigger("click");
    expect(w.emitted("action")).toHaveLength(2);
  } finally {
    w.unmount();
  }
});

it("keeps an open action menu attached to its original row when an ordinary list is reordered", async () => {
  const second = { id: "two", name: "第二条" };
  const actions = ["edit", "disable", "complete", "uncomplete"] as const;
  const w = mount(DataList as Component, {
    attachTo: document.body,
    props: {
      ...props,
      actions: () => actions,
      result: { items: [row, second], total: 2 },
    },
  });
  try {
    await w.get('[aria-label="更多操作"]').trigger("click");
    await flushPromises();
    await w.setProps({ result: { items: [second, row], total: 2 } });
    const item = document.querySelector('[role="menuitem"]') as HTMLElement;
    item.click();
    await flushPromises();
    expect(w.emitted("action")).toEqual([["uncomplete", row]]);
  } finally {
    w.unmount();
  }
});

it("switches phone records to cards with exact cells, groups or authoritative totals", async () => {
  const width = window.innerWidth;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  window.dispatchEvent(new Event("resize"));
  const record = {
    id: "one",
    name: "合成客户",
    amount: "9007199254740993.0100",
  };
  const wrapper = mount(DataList as Component, {
    props: {
      ...props,
      columns: [
        { key: "name", label: "名称" },
        { key: "amount", label: "金额" },
      ],
      result: { items: [record], total: 41 },
      page: 2,
      actions: () => ["view"],
      summary: { caption: "权威合计", values: { amount: "123456789.9900" } },
      presentation: {
        rows: [],
        groups: [
          {
            id: "customer",
            label: "客户组",
            level: 0,
            firstKey: "one",
            lastKey: "one",
            continuedBefore: true,
            continuedAfter: true,
            summary: { caption: "组小计", values: { amount: "1234.5000" } },
          },
        ],
      },
    },
  });
  try {
    await flushPromises();
    const card = wrapper.get('article[aria-label="记录 1"]');
    const toolbar = card.get(".zerp-record-card__toolbar");
    expect(toolbar.get('[aria-label="查看"]').text()).toContain("查看");
    expect(wrapper.find("table").exists()).toBe(false);
    expect(card.text()).toContain("金额9007199254740993.0100");
    expect(wrapper.text()).toContain("客户组（续）");
    expect(wrapper.text()).toContain("组小计（续）");
    expect(wrapper.text()).toContain("1234.5000");
    expect(wrapper.get('[aria-label="权威合计"]').text()).toContain(
      "123456789.9900",
    );
    await card.get('[aria-label="查看"]').trigger("click");
    expect(wrapper.emitted("action")?.[0]).toEqual(["view", record]);
    expect(wrapper.get('[aria-label="分页"]').text()).toContain(
      "第 2 页 / 3 页",
    );
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320,
    });
    window.dispatchEvent(new Event("resize"));
    await wrapper.setProps({ actions: () => ["edit", "delete"] });
    await flushPromises();
    expect(card.get('[aria-label="编辑"]').text()).toContain("编辑");
    expect(card.get('[aria-label="删除"]').text()).toContain("删除");
    expect(card.find('[aria-label="更多操作"]').exists()).toBe(false);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });
    window.dispatchEvent(new Event("resize"));
    await flushPromises();
    expect(wrapper.find("table").exists()).toBe(true);
    expect(wrapper.find("article").exists()).toBe(false);
  } finally {
    wrapper.unmount();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  }
});
