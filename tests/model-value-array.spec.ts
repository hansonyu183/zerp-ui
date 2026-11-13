import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import { BusinessApplication } from "../src/index";
import {
  application,
  object,
  array,
  text,
  reference,
  integer,
  decimal,
  type ModelNode,
} from "../src/model";
let wrapper: ReturnType<typeof mount> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find(
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
        search: {
          async run() {
            return { items: [{ id: "B", label: "合成分组乙" }], total: 1 };
          },
        },
        resolve: {
          async run({ input }) {
            return input.ids.map((id) => ({
              id,
              label: id === "A" ? "合成分组甲" : "合成分组乙",
            }));
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
    'input[aria-label="分组"]',
  );
  expect(input?.value).toContain("合成分组甲");
  input!.click();
  await flushPromises();
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
