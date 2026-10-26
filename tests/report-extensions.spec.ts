import type { Component } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import type { ReportPresentation, ReportQuery } from "../src/index";
import { ReportView, defineReport } from "../src/index";

it("keeps hidden, unchecked and disabled values while submitting a month condition explicitly", async () => {
  const query = vi.fn(
    async (
      _input: ReportQuery<{
        month: string;
        useAmount: boolean;
        amount: string;
        hidden: string;
        locked: string;
      }>,
    ) => ({ items: [], total: 0 }),
  );
  const definition = defineReport({
    kind: "parameter",
    resource: "report-conditions",
    title: "条件报表",
    rowKey: (row: { id: string }) => row.id,
    columns: [{ key: "id", label: "编号" }],
    initialParameters: () => ({
      month: "2026-10",
      useAmount: false,
      amount: "9007199254740993.01",
      hidden: "保留",
      locked: "原值",
    }),
    parameters: [
      { key: "month", type: "month", label: "月份", required: true },
      {
        key: "amount",
        type: "decimal",
        label: "金额",
        condition: { checkedKey: "useAmount" },
      },
      { key: "hidden", type: "text", label: "隐藏条件", hidden: true },
      { key: "locked", type: "text", label: "只读条件", enabled: false },
    ],
    adapter: { query },
  });
  const wrapper = mount(ReportView as Component, {
    props: {
      definition,
      scope: "actor",
      permissions: { query: true, export: false },
    },
  });
  expect(wrapper.get('input[aria-label="月份"]').attributes("type")).toBe(
    "month",
  );
  expect(wrapper.find('input[aria-label="隐藏条件"]').exists()).toBe(false);
  expect(
    wrapper.get('input[aria-label="金额"]').attributes("disabled"),
  ).toBeDefined();
  expect(
    wrapper.get('input[aria-label="只读条件"]').attributes("disabled"),
  ).toBeDefined();
  expect(query).not.toHaveBeenCalled();
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.text()).not.toContain("保留");
  expect(query.mock.calls[0]?.[0]).toMatchObject({
    parameters: {
      month: "2026-10",
      useAmount: false,
      amount: "9007199254740993.01",
      hidden: "保留",
      locked: "原值",
    },
  });
  await wrapper.get('input[aria-label="启用金额条件"]').setValue(true);
  expect(
    wrapper.get('input[aria-label="金额"]').attributes("disabled"),
  ).toBeUndefined();
  await wrapper.get('input[aria-label="金额"]').setValue("0.0000000000000001");
  await wrapper.get('input[aria-label="启用金额条件"]').setValue(false);
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(query.mock.calls[1]?.[0]).toMatchObject({
    parameters: { useAmount: false, amount: "0.0000000000000001" },
  });
  wrapper.unmount();
});

it("adopts dynamic columns, exact conditional styles and whole-result group totals with the fixed result", async () => {
  type Row = { id: string; bucket: string; amount: string };
  const presentation: ReportPresentation<Row> = {
    columns: [
      { key: "id", label: "动态编号" },
      {
        key: "amount",
        label: "精确金额",
        type: "decimal",
        styles: [
          {
            when: {
              key: "amount",
              op: "gt",
              type: "decimal",
              value: "9007199254740993.0100",
            },
            tone: "negative",
            bold: true,
          },
        ],
      },
    ],
    rowStyles: [
      {
        when: { key: "bucket", op: "eq", type: "text", value: "A" },
        tone: "muted",
      },
    ],
    group: {
      key: "bucket",
      summaries: [
        {
          value: "A",
          caption: "甲组",
          summary: {
            caption: "甲组全量合计",
            values: { amount: "9007199254740999.9999" },
          },
        },
      ],
    },
  };
  const page = vi.fn(async (_input: { resultId: string; page: number }) => ({
    items: [{ id: "second", bucket: "A", amount: "-0.00000001" }],
    total: 2,
  }));
  const definition = defineReport({
    kind: "fixed",
    resource: "dynamic",
    title: "动态报表",
    parameters: [],
    initialParameters: () => ({}),
    rowKey: (row: Row) => row.id,
    columns: [{ key: "id", label: "旧编号" }],
    cell: (row: Row, column: keyof Row) =>
      column === "id"
        ? { kind: "action" as const, label: "办理记录", target: row.id }
        : undefined,
    adapter: {
      query: async () => ({
        id: "result-v1",
        items: [{ id: "first", bucket: "A", amount: "9007199254740993.0101" }],
        total: 2,
        summary: { caption: "全量合计", values: {} },
        context: "版本一",
        presentation,
      }),
      page,
      revalidate: async () => ({ status: "valid" as const }),
    },
  });
  const wrapper = mount(ReportView as Component, {
    props: {
      definition,
      scope: "actor",
      permissions: { query: true, export: false },
      pageSize: 1,
    },
  });
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.findAll("thead th").map((x) => x.text())).toEqual([
    "动态编号",
    "精确金额",
  ]);
  expect(wrapper.get('td[data-label="精确金额"]').classes()).toContain(
    "zerp-report-negative",
  );
  expect(wrapper.get('td[data-label="精确金额"]').classes()).toContain(
    "zerp-report-bold",
  );
  expect(wrapper.get('tr[data-row-id="first"]').classes()).toContain(
    "zerp-report-muted",
  );
  expect(wrapper.text()).toContain("甲组全量合计");
  expect(wrapper.text()).toContain("9007199254740999.9999");
  await wrapper.get('button[aria-label="办理记录"]').trigger("click");
  await flushPromises();
  expect(wrapper.emitted("drill")?.[0]?.[0]).toMatchObject({
    resultId: "result-v1",
    rowId: "first",
    cell: { kind: "action", target: "first" },
  });
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "下一页")!
    .trigger("click");
  await flushPromises();
  expect(page.mock.calls[0]?.[0]).toMatchObject({
    resultId: "result-v1",
    page: 2,
  });
  expect(wrapper.findAll("thead th").map((x) => x.text())).toEqual([
    "动态编号",
    "精确金额",
  ]);
  expect(wrapper.text()).toContain("9007199254740999.9999");
  expect(wrapper.get('td[data-label="精确金额"]').classes()).not.toContain(
    "zerp-report-negative",
  );
  wrapper.unmount();
});

it("skips unchecked condition validation and retains required, hidden and disabled parameter facts", async () => {
  const query = vi.fn(
    async (
      _input: ReportQuery<{
        enabled: boolean;
        amount: string;
        hidden: string;
        locked: string;
      }>,
    ) => ({ items: [], total: 0 }),
  );
  const definition = defineReport({
    kind: "parameter",
    resource: "validation",
    title: "参数校验",
    rowKey: (r: { id: string }) => r.id,
    initialParameters: () => ({
      enabled: false,
      amount: "unfinished.",
      hidden: "unparsed.",
      locked: "readonly.",
    }),
    parameters: [
      {
        key: "amount",
        label: "金额",
        type: "decimal",
        required: true,
        condition: { checkedKey: "enabled", required: true },
      },
      { key: "hidden", label: "隐藏金额", type: "decimal", hidden: true },
      { key: "locked", label: "固定金额", type: "decimal", enabled: false },
    ],
    columns: [],
    adapter: { query },
  });
  const wrapper = mount(ReportView as Component, {
    props: {
      definition,
      scope: "actor",
      permissions: { query: true, export: false },
    },
  });
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.text()).toContain("请启用金额条件。");
  expect(query).not.toHaveBeenCalled();
  await wrapper.get('input[aria-label="启用金额条件"]').setValue(true);
  expect(
    wrapper.get('input[aria-label="启用金额条件"]').attributes("disabled"),
  ).toBeDefined();
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(wrapper.text()).toContain("金额应为完整十进制数。");
  await wrapper.get('input[aria-label="金额"]').setValue("0.0000");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(query.mock.calls[0]?.[0].parameters).toEqual({
    enabled: true,
    amount: "0.0000",
    hidden: "unparsed.",
    locked: "readonly.",
  });
  wrapper.unmount();
});

it("rejects changed page presentation and restores the adopted dynamic definition after revalidation", async () => {
  const definition = defineReport<{}, { amount: string }>({
    kind: "fixed",
    resource: "frozen-columns",
    title: "固定列",
    parameters: [],
    initialParameters: () => ({}),
    columns: [{ key: "amount", label: "旧列", type: "decimal" }],
    rowKey: (r: { amount: string }) => r.amount,
    adapter: {
      query: async () => ({
        id: "frozen",
        items: [{ amount: "1.00" }],
        total: 2,
        summary: { caption: "全量", values: {} },
        context: "v1",
        presentation: {
          columns: [
            {
              key: "amount" as const,
              label: "采用列",
              type: "decimal" as const,
            },
          ],
        },
      }),
      page: async () => ({
        items: [{ amount: "2.00" }],
        total: 2,
        presentation: {
          columns: [
            {
              key: "amount" as const,
              label: "错版列",
              type: "decimal" as const,
            },
          ],
        },
      }),
      revalidate: vi.fn(async () => ({ status: "valid" as const })),
    },
  });
  const wrapper = mount(ReportView as Component, {
    props: {
      definition,
      scope: "actor",
      permissions: { query: true, export: false },
      pageSize: 1,
    },
  });
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  await wrapper
    .findAll("button")
    .find((b) => b.text() === "下一页")!
    .trigger("click");
  await flushPromises();
  expect(wrapper.text()).toContain("分页结果格式与本次查询不一致");
  expect(wrapper.get("thead th").text()).toBe("采用列");
  expect(wrapper.text()).toContain("1.00");
  expect(wrapper.text()).not.toContain("2.00");
  wrapper.unmount();
  const saved = wrapper.emitted("snapshot")!.at(-1)![0];
  const restored = mount(ReportView as Component, {
    props: {
      definition,
      scope: "actor",
      permissions: { query: true, export: false },
      restore: saved,
      pageSize: 1,
    },
  });
  await flushPromises();
  expect(definition.adapter.revalidate).toHaveBeenCalled();
  expect(restored.get("thead th").text()).toBe("采用列");
  restored.unmount();
});

it("does not let an unfinished unchecked integer block the other conditions", async () => {
  const query = vi.fn(
    async (_input: ReportQuery<{ useLimit: boolean; limit: number }>) => ({
      items: [],
      total: 0,
    }),
  );
  const definition = defineReport({
    kind: "parameter",
    resource: "integer-condition",
    title: "整数条件",
    initialParameters: () => ({ useLimit: true, limit: 12 }),
    parameters: [
      {
        key: "limit",
        label: "数量",
        type: "integer",
        condition: { checkedKey: "useLimit" },
      },
    ],
    columns: [],
    rowKey: (r: { id: string }) => r.id,
    adapter: { query },
  });
  const w = mount(ReportView as Component, {
    props: {
      definition,
      scope: "actor",
      permissions: { query: true, export: false },
    },
  });
  await w.get('input[aria-label="数量"]').setValue("12.");
  await w.get('input[aria-label="启用数量条件"]').setValue(false);
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0]?.[0].parameters).toEqual({
    useLimit: false,
    limit: 12,
  });
  await w.get('input[aria-label="启用数量条件"]').setValue(true);
  await w.get("form").trigger("submit");
  await flushPromises();
  expect(query).toHaveBeenCalledTimes(1);
  w.unmount();
});
