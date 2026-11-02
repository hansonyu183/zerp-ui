import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { type DetailGroup, type ReferenceValue } from "../src/index";
import RecordDetails from "../src/RecordDetails.vue";

type Facts = {
  amount: string;
  missing?: string;
  empty: string;
  zero: number;
  enabled: boolean;
  reference: ReferenceValue;
  rows: { id: string; raw: string }[];
};
type Intent = { kind: "reference"; id: string };
const groups: readonly DetailGroup<Facts, Intent>[] = [
  {
    key: "facts",
    label: "原始事实",
    fields: [
      { key: "amount", label: "精确金额", type: "decimal" },
      { key: "missing", label: "缺失", type: "text" },
      { key: "empty", label: "空文本", type: "text" },
      { key: "zero", label: "零值", type: "integer" },
      { key: "enabled", label: "启用", type: "boolean" },
      {
        key: "reference",
        label: "历史引用",
        type: "reference",
        related: (value) => ({ kind: "reference", id: value.id }),
      },
      {
        key: "rows",
        label: "历史子项",
        type: "records",
        rowKey: (row) => row.id,
        rowLabel: (row) => row.id,
        fields: [{ key: "raw", label: "历史原值", type: "decimal" }],
      },
    ],
  },
];
it("shows grouped historical facts and emits only a typed local reference intent", async () => {
  const intents: Intent[] = [];
  const value: Facts = {
    amount: "9007199254740993.0100",
    empty: "",
    zero: 0,
    enabled: false,
    reference: { id: "adopted", label: "当时名称", snapshot: { revision: 1 } },
    rows: [{ id: "row-two", raw: "异常原值 1.x" }],
  };
  const wrapper = mount(RecordDetails<Facts, Intent>, {
    props: {
      value,
      groups,
      scope: "one",
      instance: "record-one",
      onRelated: (intent) => intents.push(intent),
    },
  });
  expect(wrapper.text()).toContain("9007199254740993.0100");
  const facts = wrapper.findAll("dd").map((item) => item.text());
  expect(facts).toEqual(
    expect.arrayContaining(["—", "（空字符串）", "0", "否"]),
  );
  expect(wrapper.get('button[aria-expanded="false"]').text()).toBe(
    "历史子项 · row-two",
  );
  expect(wrapper.text()).toContain("异常原值 1.x");
  expect(wrapper.findAll("input")).toHaveLength(0);
  await wrapper.get("button").trigger("click");
  expect(intents).toEqual([{ kind: "reference", id: "adopted" }]);
  const old = wrapper.get("button");
  await wrapper.setProps({ scope: "two", instance: "record-two" });
  await old.trigger("click");
  expect(intents).toHaveLength(1);
  wrapper.unmount();
});

it("expands recursive historical facts with an accessible keyboard control through AppPage", async () => {
  const { AppPage, defineDetailsPage } = await import("../src/index");
  const { createRouter, createMemoryHistory } = await import("vue-router");
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  const wrapper = mount(AppPage, {
    attachTo: document.body,
    props: {
      scope: "synthetic",
      brand: {
        home: "/",
        productName: "合成库",
        enterpriseName: "合成公司",
        mark: { kind: "text", text: "合" },
      },
      brandState: { kind: "ready" },
      navigation: [],
      navigationState: { kind: "ready" },
      footer: "合成验证",
      page: defineDetailsPage({
        title: "历史事实",
        instance: "one",
        value: { rows: [{ id: "old", amount: "9007199254740993.0100" }] },
        groups: [
          {
            key: "history",
            label: "采用时记录",
            fields: [
              {
                key: "rows",
                label: "历史子项",
                type: "records",
                rowKey: (row) => row.id,
                rowLabel: (row) => row.id,
                fields: [{ key: "amount", label: "采用金额", type: "decimal" }],
              },
            ],
          },
        ],
      }),
    },
    global: { plugins: [router] },
  });
  const expand = wrapper
    .findAll("button")
    .find((node) => node.text() === "历史子项 · old");
  expect(expand).toBeDefined();
  expect(expand!.attributes("aria-expanded")).toBe("false");
  await expand!.trigger("click");
  expect(expand!.attributes("aria-expanded")).toBe("true");
  expect(wrapper.text()).toContain("9007199254740993.0100");
  expect(wrapper.text()).not.toContain('"amount":');
  wrapper.unmount();
});
