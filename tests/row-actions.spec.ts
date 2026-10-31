import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import DataList from "../src/DataList.vue";

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
    const wrapper = mount(DataList as Component, {
      attachTo: document.body,
      props: { ...props, actions: () => ["view", "edit", "disable", "delete"] },
    });
    try {
      const actions = wrapper.get('td[data-label="操作"]');
      expect(actions.findAll("button[aria-label]")).toHaveLength(4);
      for (const name of ["查看", "编辑", "停用"])
        expect(
          actions
            .get(`[aria-label="${name}"]`)
            .find('[aria-hidden="true"]')
            .exists(),
        ).toBe(true);
      expect(actions.find('[aria-label="删除"]').exists()).toBe(false);
      await actions.get('[aria-label="编辑"]').trigger("click");
      expect(wrapper.emitted("action")?.[0]).toEqual(["edit", row]);
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
  ["view", "edit"],
  ["view", "edit", "disable"],
]) {
  it(`renders ${actions.length} permitted actions without an empty menu`, () => {
    const wrapper = mount(DataList as Component, {
      props: { ...props, actions: () => actions },
    });
    expect(wrapper.find("th:last-child").text()).toBe(
      actions.length ? "操作" : "名称",
    );
    expect(wrapper.find('[aria-label="更多操作"]').exists()).toBe(false);
    expect(wrapper.findAll('td[data-label="操作"] button')).toHaveLength(
      actions.length,
    );
    wrapper.unmount();
  });
}
it("retains native view links and blocks all actions while loading", async () => {
  const wrapper = mount(DataList as Component, {
    props: {
      ...props,
      actions: () => ["view", "edit"],
      viewHref: () => "/records/one",
    },
  });
  try {
    const link = wrapper.get('a[aria-label="查看"]');
    expect(link.attributes("href")).toBe("/records/one");
    await link.trigger("click", { ctrlKey: true });
    expect(wrapper.emitted("action")).toBeUndefined();
    await link.trigger("click");
    expect(wrapper.emitted("action")?.[0]).toEqual(["view", row]);
    await wrapper.setProps({ loading: true });
    expect(wrapper.find('a[aria-label="查看"]').exists()).toBe(false);
    await wrapper.get('[aria-label="编辑"]').trigger("click");
    expect(wrapper.emitted("action")).toHaveLength(1);
    await wrapper.setProps({ result: { items: [], total: 0 } });
    expect(wrapper.find("th:last-child").text()).toBe("名称");
  } finally {
    wrapper.unmount();
  }
});
it("supports keyboard menu access and discards a menu when the original row is replaced", async () => {
  const wrapper = mount(DataList as Component, {
    attachTo: document.body,
    props: { ...props, actions: () => ["view", "edit", "disable", "delete"] },
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
      actions: () => ["send", "withdraw", "check", "uncheck", "void", "unvoid"],
    },
  });
  try {
    for (const label of ["送审", "反送审", "审核"])
      expect(
        w.get(`[aria-label="${label}"]`).find('[aria-hidden="true"]').exists(),
      ).toBe(true);
    await w.get('[aria-label="更多操作"]').trigger("click");
    await flushPromises();
    for (const label of ["反审核", "作废", "反作废"])
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
    await w.get('[aria-label="反完成"]').trigger("click");
    expect(w.emitted("action")).toEqual([
      ["complete", row],
      ["uncomplete", second],
    ]);
    await w.setProps({ disabled: true });
    await w.get('[aria-label="完成"]').trigger("click");
    expect(w.emitted("action")).toHaveLength(2);
  } finally {
    w.unmount();
  }
});

it("keeps an open action menu attached to its original row when an ordinary list is reordered", async () => {
  const second = { id: "two", name: "第二条" };
  const actions = ["view", "edit", "complete", "uncomplete"] as const;
  const w = mount(DataList as Component, {
    attachTo: document.body,
    props: {
      ...props,
      rowKey: undefined,
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
