import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { fixture, field, operation } from "./fixtures/static-model";
import { render, click, input } from "./fixtures/static-host";
import type { InteractionNode, OutputNode } from "../src/model";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("keeps script answers directly on the model and calculates from current answers", async () => {
  const { model, record } = fixture();
  const questions: InteractionNode = {
    kind: "interactions",
    key: "questions",
    label: "问题",
    readOnly: false,
    value: {},
    items: [{ kind: "input", id: "factor", label: "系数" }],
  };
  const result = field("result", "结果", "");
  result.readOnly = true;
  record.members = [questions, result];
  record.report = {
    operations: {
      calculate: operation(
        vi.fn(async () => {
          const current = record.members[0] as InteractionNode;
          result.value = String(Number(current.value.factor) * 3);
        }),
      ),
    },
  };
  wrapper = await render(model);
  await click("编辑");
  await input("系数").setValue("4");
  await input("系数").trigger("change");
  await click("计算");
  expect((record.members[0] as InteractionNode).value.factor).toBe("4");
  expect(result.value).toBe("12");
});
it("retains finite document, workflow, processing and batch callbacks on unified objects", async () => {
  const { model, record } = fixture();
  const status = field("status", "状态", "待执行");
  record.members = [status];
  const set = (value: string) =>
    operation(
      vi.fn(async () => {
        status.value = value;
      }),
    );
  record.document = { operations: { submit: set("已提交") } };
  record.workflow = {
    operations: { start: set("已启动"), advance: set("已推进") },
  };
  record.processing = { operations: { validate: set("校验通过") } };
  record.batch = { operations: { executeBatch: set("已执行") } };
  wrapper = await render(model);
  await click("编辑");
  for (const [label, expected] of [
    ["提交", "已提交"],
    ["启动", "已启动"],
    ["推进", "已推进"],
    ["校验", "校验通过"],
    ["执行批次", "已执行"],
  ]) {
    await click(label!);
    expect(status.value).toBe(expected);
  }
});
it("previews finite documents without treating a preview as confirmed physical printing", async () => {
  const { model, record } = fixture();
  const confirmed = vi.fn(async () => {});
  const output: OutputNode = {
    kind: "output",
    key: "sheet",
    label: "输出",
    readOnly: false,
    value: {
      id: "synthetic",
      title: "Preview",
      width: 100,
      height: 100,
      pages: [
        {
          key: "1",
          items: [
            {
              kind: "text",
              key: "text",
              x: 0,
              y: 0,
              width: 90,
              height: 10,
              text: "Synthetic output",
            },
          ],
        },
      ],
    },
    operations: { print: operation(), confirmPrinted: operation(confirmed) },
  };
  record.members = [output];
  wrapper = await render(model);
  await click("编辑");
  await flushPromises();
  expect(document.querySelector('iframe[title="打印预览"]')).not.toBeNull();
  expect(confirmed).not.toHaveBeenCalled();
  await click("确认已打印");
  expect(confirmed).toHaveBeenCalledTimes(1);
});
it("keeps report facts, precise totals and authorized links with root collection targets", async () => {
  const { model, rows, record } = fixture();
  rows.report = {
    summary: { caption: "总计", values: { name: "12345678901234567890.10" } },
    presentation: {
      rows: [{ rowId: record.identity!, appearance: { bold: true } }],
      groups: [],
    },
    cells: [
      {
        row: record,
        field: "name",
        kind: "record",
        label: "打开记录",
        target: { collection: rows, record },
        disabled: false,
      },
    ],
  };
  wrapper = await render(model);
  expect(document.querySelector('[aria-label="总计"]')?.textContent).toContain(
    "12345678901234567890.10",
  );
  const link = document.querySelector<HTMLAnchorElement>(
    'a[aria-label="打开记录"]',
  );
  expect(link).not.toBeNull();
  link!.click();
  await flushPromises();
  expect(rows.selected).toBe(record);
});

it("keeps secret keep, replacement and clearing intents explicit without exposing backend secrets", async () => {
  const { model, record } = fixture();
  record.members = [
    {
      kind: "secret",
      key: "secret",
      label: "密钥",
      readOnly: false,
      required: false,
      value: { intent: "keep" },
    },
  ];
  const seen: string[] = [];
  record.operations.update = operation(
    vi.fn(async () => {
      const secret = record.members[0]!;
      if (secret.kind === "secret") seen.push(secret.value.intent);
    }),
  );
  wrapper = await render(model);
  await click("编辑");
  await click("保存");
  expect(seen).toEqual(["keep"]);
  const secret = record.members[0]!;
  if (secret.kind !== "secret") throw Error("Expected secret");
  secret.value = { intent: "replace", value: "synthetic" };
  await flushPromises();
  await click("保存");
  secret.value = { intent: "clear" };
  await flushPromises();
  await click("保存");
  expect(seen).toEqual(["keep", "replace", "clear"]);
  expect(document.body.textContent).not.toContain("synthetic");
});
it("keeps processing input writable while execution is disabled without a fake save", async () => {
  const { model, record } = fixture();
  delete record.operations.update;
  record.processing = { operations: { run: operation() } };
  record.processing.operations.run!.disabled = true;
  wrapper = await render(model);
  await click("查看");
  await input("名称").setValue("input");
  expect(input("名称").element.readOnly).toBe(false);
  expect(
    Array.from(document.querySelectorAll("button")).some(
      (button) => button.textContent?.trim() === "保存",
    ),
  ).toBe(false);
  const execute = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent?.trim() === "运行");
  expect(execute).toBeUndefined();
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(
    "当前无法保存。",
  );
});

it("keeps a preview-only output record actionable without manufacturing update", async () => {
  const { model, record } = fixture();
  delete record.operations.update;
  record.members = [
    {
      kind: "output",
      key: "sheet",
      label: "打印内容",
      readOnly: false,
      value: null,
      operations: { print: operation() },
    },
  ];
  record.output = {
    operations: {
      preview: operation(
        vi.fn(async () => {
          const output = record.members[0]!;
          if (output.kind === "output")
            output.value = {
              id: "preview",
              title: "Preview",
              width: 100,
              height: 100,
              pages: [
                {
                  key: "1",
                  items: [
                    {
                      kind: "text",
                      key: "t",
                      x: 0,
                      y: 0,
                      width: 90,
                      height: 10,
                      text: "Preview",
                    },
                  ],
                },
              ],
            };
        }),
      ),
    },
  };
  wrapper = await render(model);
  await click("查看");
  await click("预览");
  expect(record.output.operations.preview!.run).toHaveBeenCalledTimes(1);
  expect(document.querySelector('iframe[title="打印预览"]')).not.toBeNull();
  expect(record.operations.update).toBeUndefined();
});

it("keeps explicit writable output confirmations reachable without fake CRUD save", async () => {
  const { model, record } = fixture();
  delete record.operations.update;
  const confirmed = operation();
  record.output = {
    operations: { preview: operation(), confirmNotPrinted: confirmed },
  };
  wrapper = await render(model);
  await click("查看");
  await click("确认未打印");
  expect(confirmed.run).toHaveBeenCalledTimes(1);
  expect(record.operations.update).toBeUndefined();
});
