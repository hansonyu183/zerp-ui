import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import {
  application,
  object,
  collection,
  array,
  text,
  reference,
  integer,
  decimal,
  secret,
  type ModelNode,
} from "../src/model";
let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
async function click(label: string) {
  const button = [
    ...document.querySelectorAll<HTMLElement>("button,[role=option]"),
  ].find(
    (b) =>
      b.textContent?.trim() === label || b.getAttribute("aria-label") === label,
  );
  expect(button, label + document.body.textContent).toBeTruthy();
  button!.click();
  await flushPromises();
}
async function render(target: ModelNode) {
  const model = reactive(
    application(
      "合成值数组",
      { target },
      {
        owner: { ledger: "test", operator: "user", generation: "1" },
        userPermissions: {
          owner: { ledger: "test", operator: "user", generation: "1" },
          administrator: true,
        },
        brand: {
          productName: "合成",
          enterpriseName: "合成",
          home: "/",
          mark: { kind: "text", text: "例" },
        },
        navigation: {
          current: { node: target },
          href: () => "/",
          visit() {},
          guard: () => () => {},
        },
      },
    ),
  );
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: {} }],
  });
  await router.push("/");
  await router.isReady();
  wrapper = mount(BusinessApplication, {
    props: { model },
    attachTo: document.body,
    global: { plugins: [router] },
  });
  await flushPromises();
  await click("编辑");
}

it("edits scalar array elements and submits the original scalar shape", async () => {
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const target = object(
    "客户",
    {
      tags: array("标签", () => text("标签值"), [
        text("标签值", { value: "甲" }),
      ]),
    },
    { operations: { update: { run } } },
  );
  await render(target);
  const edit = async (index: number, value: string) => {
    const input = document.querySelectorAll<HTMLInputElement>(
      'input[aria-label="标签值"]',
    )[index];
    expect(input).toBeTruthy();
    input!.value = value;
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
  };
  await edit(0, "乙");
  await click("新增");
  await edit(1, "丙");
  await click("删除标签 1");
  await click("新增");
  await edit(1, "丁");
  await click("保存");
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]![0]).toMatchObject({
    input: { tags: ["丙", "丁"] },
  });
});

it("renders and changes a reference array without changing its scalar ID shape", async () => {
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const group = (id: string | null = null) =>
    reference("分组", {
      value: id,
      operations: {
        load: {
          async run() {
            return [
              { id: "A", label: "合成分组甲" },
              { id: "B", label: "合成分组乙" },
            ];
          },
        },
      },
    });
  const target = object(
    "客户",
    { groups: array("所属分组", group, [group("A")]) },
    { operations: { update: { run } } },
  );
  await render(target);
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="所属分组"]',
  );
  expect(document.body.textContent).toContain("合成分组甲");
  input!.click();
  await flushPromises();
  await click("合成分组甲");
  await click("合成分组乙");
  await click("保存");
  expect(run.mock.calls[0]![0]).toMatchObject({ input: { groups: ["B"] } });
});

it("keeps a read-only value array unchanged while editing other fields", async () => {
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const target = object(
    "客户",
    {
      name: text("名称", { value: "甲" }),
      tags: array(
        "共享分组",
        () => text("分组值"),
        [text("分组值", { value: "A" })],
        { readOnly: true },
      ),
    },
    { operations: { update: { run } } },
  );
  await render(target);
  const remove = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.trim() === "删除共享分组 1");
  expect(remove?.disabled).toBe(true);
  const name = document.querySelector<HTMLInputElement>(
    'input[aria-label="名称"]',
  )!;
  name.value = "乙";
  name.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  await click("保存");
  expect(run.mock.calls[0]![0]).toMatchObject({ input: { name: "乙" } });
  expect((run.mock.calls[0]![0] as { input: object }).input).not.toHaveProperty(
    "tags",
  );
});

it.each([
  ["数量", integer("值", { value: 0 }), "42", 42],
  [
    "金额",
    decimal("值", { value: "0.00" }),
    "12345678901234567890.12",
    "12345678901234567890.12",
  ],
] as const)(
  "preserves %s scalar types in array writes",
  async (_name, node, entered, expected) => {
    const run = vi.fn(async (_request: unknown) => ({
      status: "success" as const,
    }));
    const target = object(
      "数据",
      { values: array("值数组", () => node, [node]) },
      { operations: { update: { run } } },
    );
    await render(target);
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="值"]',
    )!;
    input.value = entered;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    await click("保存");
    expect(run.mock.calls[0]![0]).toMatchObject({
      input: { values: [expected] },
    });
  },
);
it("cancels scalar array edits without a business write", async () => {
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const target = object(
    "客户",
    {
      tags: array("标签", () => text("标签值"), [
        text("标签值", { value: "甲" }),
      ]),
    },
    { operations: { update: { run } } },
  );
  await render(target);
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="标签值"]',
  )!;
  input.value = "乙";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  await click("取消编辑");
  const discard = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.trim() === "放弃本地修改");
  discard?.click();
  await flushPromises();
  await click("编辑");
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="标签值"]')
      ?.value,
  ).toBe("甲");
  expect(run).not.toHaveBeenCalled();
});

it.each([true, false])(
  "projects row fields and retains qualification after deletion (identity=%s)",
  async (identified) => {
    const run = vi.fn(async (_request: unknown) => ({
      status: "success" as const,
    }));
    const line = (id: string, editable: boolean) =>
      object(
        "明细",
        {
          id: text("行号", { value: id, readOnly: true }),
          price: text("价格", {
            value: id === "main" ? "100" : "20",
            readOnly: !editable,
          }),
          ...(editable ? { note: text("子项说明", { value: "原说明" }) } : {}),
        },
        { identity: identified ? (["id"] as const) : [] },
      );
    const target = object(
      "单据",
      {
        rows: array("明细", () => line("new", true), [
          line("main", false),
          line("child", true),
        ]),
      },
      { operations: { update: { run } } },
    );
    await render(target);
    const rows = document.querySelectorAll<HTMLElement>(
      'section[aria-label^="明细 "]',
    );
    expect(
      rows[0]!.querySelector<HTMLInputElement>('input[aria-label="价格"]')
        ?.disabled,
    ).toBe(true);
    expect(rows[0]!.querySelector('input[aria-label="子项说明"]')).toBeNull();
    const note = rows[1]!.querySelector<HTMLInputElement>(
      'input[aria-label="子项说明"]',
    )!;
    expect(note).toBeTruthy();
    note.value = "子项修改";
    note.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    await click("删除明细 1");
    await click("新增");
    await click("保存");
    expect(run.mock.calls[0]![0]).toMatchObject({
      input: {
        rows: [
          { price: "20", note: "子项修改" },
          { price: "20", note: "原说明" },
        ],
      },
    });
    expect(
      (run.mock.calls[0]![0] as { input: { rows: object[] } }).input.rows,
    ).toHaveLength(2);
    await click("编辑");
    const first = document.querySelector<HTMLElement>(
      'section[aria-label="明细 1"]',
    )!;
    expect(
      first.querySelector<HTMLInputElement>('input[aria-label="价格"]')
        ?.disabled,
    ).toBe(false);
    expect(
      first.querySelector<HTMLInputElement>('input[aria-label="子项说明"]')
        ?.value,
    ).toBe("子项修改");
  },
);

it("uses nested row declarations for required fields and secret write qualification", async () => {
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const child = (id: string, locked = false) =>
    object(
      "子行",
      {
        id: text("子行号", { value: id, readOnly: true }),
        note: text("子行内容", { value: id, required: true }),
        password: secret("行口令", { value: "must-clear", readOnly: locked }),
      },
      { identity: ["id"] as const },
    );
  const line = () =>
    object("父行", {
      children: array("子明细", () => child("new"), [
        child("locked", true),
        child("editable"),
      ]),
    });
  const target = object(
    "单据",
    { rows: array("父明细", line, [line()]) },
    { operations: { update: { run } } },
  );
  await render(target);
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[aria-label="行口令"]',
  );
  expect(inputs).toHaveLength(2);
  expect(inputs[0]!.disabled).toBe(true);
  expect(inputs[1]!.disabled).toBe(false);
  expect(document.querySelector('input[type="password"]')).toBeNull();
  await click("保存");
  expect(run.mock.calls[0]![0]).toMatchObject({
    input: {
      rows: [
        {
          children: [
            { note: "locked" },
            { note: "editable", password: undefined },
          ],
        },
      ],
    },
  });
  const input = (
    run.mock.calls[0]![0] as { input: { rows: { children: object[] }[] } }
  ).input;
  expect(input.rows[0]!.children[0]).not.toHaveProperty("password");
});

it("uses the current same-identity declaration when calculation returns its original input", async () => {
  const line = (locked: boolean) =>
    object(
      "行",
      {
        id: text("行号", { value: "one", readOnly: true }),
        price: text("价格", { value: "10", readOnly: locked }),
        ...(locked ? { newField: text("新字段") } : {}),
      },
      { identity: ["id"] as const },
    );
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const target = object(
    "单据",
    {
      mode: text("业务模式"),
      rows: array("明细", () => line(false), [line(false)]),
    },
    {
      operations: {
        update: { run },
        calculate: {
          async run({ input }) {
            if (input.mode === "locked") target.rows.items = [line(true)];
            return { value: input };
          },
        },
      },
    },
  );
  await render(target);
  const mode = document.querySelector<HTMLInputElement>(
    'input[aria-label="业务模式"]',
  )!;
  mode.value = "locked";
  mode.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="价格"]')
      ?.disabled,
  ).toBe(true);
  expect(document.querySelector('input[aria-label="新字段"]')).toBeTruthy();
  await click("保存");
  const request = run.mock.calls[0]![0] as { input: { rows: object[] } };
  expect(request.input.rows[0]).not.toHaveProperty("price");
});

it("finishes known committed refresh when a query replaces opaque array row declarations", async () => {
  let stored = "原包装";
  let revision = 1;
  let writes = 0;
  const row = () =>
    object(
      "客户",
      {
        id: text("编号", { value: "one", readOnly: true }),
        units: array(
          "包装",
          () => object("包装行", { label: text("包装名称") }),
          [object("包装行", { label: text("包装名称", { value: stored }) })],
        ),
      },
      {
        identity: ["id"] as const,
        concurrency: String(revision),
        operations: {
          get: {
            async run() {
              return {
                identity: { id: "one" },
                concurrency: String(revision),
                value: { id: "one", units: [{ label: stored }] },
              };
            },
          },
          update: {
            async run(request) {
              stored = request.input.units![0]!.label!;
              writes++;
              revision++;
              return { status: "success" as const };
            },
          },
        },
      },
    );
  const records = collection("客户", row, {
    operations: {
      query: {
        async run() {
          return { items: [row()], total: 1 };
        },
      },
    },
  });
  await render(records);
  const field = document.querySelector<HTMLInputElement>(
    'input[aria-label="包装名称"]',
  )!;
  field.value = "修改包装";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  await click("保存");
  expect(stored).toBe("修改包装");
  expect(writes).toBe(1);
  expect(document.body.textContent).not.toContain("数组行声明已失效");
  await click("编辑");
  expect(
    document.querySelector<HTMLInputElement>('input[aria-label="包装名称"]')
      ?.value,
  ).toBe("修改包装");
});

it("rejects a stale opaque row at save preparation instead of adopting a writable factory", async () => {
  const run = vi.fn(async (_request: unknown) => ({
    status: "success" as const,
  }));
  const units = () =>
    array("包装", () => object("行", { label: text("包装名称") }), [
      object("行", { label: text("包装名称", { value: "包装" }) }),
    ]);
  const target = reactive(
    object("客户", { units: units() }, { operations: { update: { run } } }),
  );
  await render(target);
  const field = document.querySelector<HTMLInputElement>(
    'input[aria-label="包装名称"]',
  )!;
  field.value = "未采用修改";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  Reflect.set(target, "units", units());
  await flushPromises();
  await click("保存");
  expect(run).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("数组行声明已失效");
});
