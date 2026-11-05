import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import { AppPage, type AppPageHandle, type DraftCollaboration } from "@zerp/ui";
import {
  createComplexDraft,
  complexCollaboration,
  type ComplexDraft,
} from "../examples/capabilities/complex-draft";
import { hostAndDialogButtons } from "./host-and-dialog-buttons";
vi.mock("@zerp/ui", async () => await import("../src/index"));
const mounted: VueWrapper[] = [];
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()));
async function start(options: Parameters<typeof createComplexDraft>[0] = {}) {
  const scenario = createComplexDraft(options);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/", component: { template: "<span />" } }],
  });
  const w = mount(AppPage, {
    attachTo: document.body,
    props: {
      page: scenario.page,
      scope: "synthetic-session",
      brand: {
        home: "/",
        productName: "合成库",
        enterpriseName: "合成公司",
        mark: { kind: "text", text: "合" },
      },
      brandState: { kind: "ready" },
      navigationState: { kind: "ready" },
      navigation: [],
      footer: "合成验证",
    },
    global: { plugins: [router] },
  });
  mounted.push(w);
  await flushPromises();
  return w;
}
function button(w: VueWrapper, label: string) {
  const found = hostAndDialogButtons(w).find(
    (b) =>
      (b.text() === label || b.attributes("aria-label") === label) &&
      (label !== "新增" || b.attributes("disabled") === undefined),
  );
  expect(found, label).toBeDefined();
  return found!;
}
async function click(w: VueWrapper, label: string) {
  await button(w, label).trigger("click");
  await flushPromises();
}
function input(w: VueWrapper, label: string) {
  return w.get<HTMLInputElement>(`input[aria-label="${label}"]`);
}
async function answer(w: VueWrapper) {
  await input(w, "核对计算结果").setValue(true);
  await flushPromises();
  await input(w, "计算说明").setValue("  合成核对  ");
  await input(w, "计算说明").trigger("change");
  await flushPromises();
}
it("saves only confirmed complex blocks with exact values, children and adopted historical references", async () => {
  const saves: ComplexDraft[] = [];
  const w = await start({
    save: async (value) => {
      saves.push(value);
    },
  });
  expect(input(w, "仓库").element.value).toBe("历史仓库");
  expect(w.text()).not.toContain("目录新仓库名");
  await click(w, "编辑单位 1");
  await input(w, "换算比").setValue("9007199254740993.0100");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await click(w, "确定单位");
  await click(w, "编辑价格 1");
  await input(w, "价格金额").setValue("999.00");
  await click(w, "取消价格");
  await click(w, "编辑配料 · 明细行 1");
  const dialog = new DOMWrapper(document.body).get(
    '[role="dialog"][aria-label="配料 · 明细行 1"]',
  );
  await click(w, "编辑配料1");
  await dialog
    .get('input[aria-label="配料名"]')
    .setValue("已确认但取消整个配料面板");
  await click(w, "确定子项");
  // Discard the entire local child panel, including any confirmed children.
  await click(w, "取消配料");
  await click(w, "编辑配料 · 明细行 2");
  await click(w, "新增");
  const second = new DOMWrapper(document.body).get(
    '[role="dialog"][aria-label="配料 · 明细行 2"]',
  );
  await second.get('input[aria-label="配料名"]').setValue("合成乙料");
  await second.get('input[aria-label="配料比例"]').setValue("0.0000001");
  await click(w, "确定子项");
  await click(w, "确定配料");
  await answer(w);
  await click(w, "保存");
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({
    amount: "9007199254740993.0100",
    zero: 0,
    enabled: false,
    note: null,
    profile: {
      warehouse: {
        id: "old-warehouse",
        label: "历史仓库",
        snapshot: { revision: "r1" },
      },
    },
    units: [
      { code: "each", ratio: "9007199254740993.0100", count: 0 },
      { code: "box", ratio: "12.0000", count: 1 },
    ],
    prices: [{ tier: "标准", amount: "1.2300" }],
    calculation: {
      result: "1.2300",
      confirmation: true,
      answer: "  合成核对  ",
    },
  });
  expect(saves[0].sheet.rows.map((row) => row.parts)).toEqual([
    [{ ingredient: "原配料", ratio: "1.0000" }],
    [{ ingredient: "合成乙料", ratio: "0.0000001" }],
  ]);
});
it("protects unfinished unit and child input, and cancels it without a final write", async () => {
  const save = vi.fn(async () => {});
  const w = await start({ save });
  await answer(w);
  await click(w, "编辑单位 1");
  await input(w, "单位数量").setValue("-");
  expect(button(w, "确定单位").attributes("disabled")).toBeDefined();
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  const leaving = (w.vm as unknown as AppPageHandle).requestLeave();
  await flushPromises();
  expect(
    new DOMWrapper(document.body)
      .find('[role="dialog"][aria-label="未保存修改"]')
      .exists(),
  ).toBe(true);
  await click(w, "继续编辑");
  expect(await leaving).toBe(false);
  expect(input(w, "单位数量").element.value).toBe("-");
  await click(w, "取消单位");
  expect(button(w, "保存").attributes("disabled")).toBeUndefined();
  await click(w, "编辑配料 · 明细行 1");
  await click(w, "新增");
  expect(button(w, "确定配料").attributes("disabled")).toBeDefined();
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await click(w, "取消子项");
  await click(w, "取消配料");
  expect(button(w, "保存").attributes("disabled")).toBeUndefined();
  expect(save).not.toHaveBeenCalled();
});
it("retains historical reference facts but clears a dependent selection on parent change and ignores the old catalog", async () => {
  let oldSearch!: (value: {
    items: { id: string; label: string }[];
    total: number;
  }) => void;
  const parents: (string | undefined)[] = [];
  const saves: ComplexDraft[] = [];
  const w = await start({
    save: async (value) => {
      saves.push(value);
    },
    warehouse: {
      search: ({ parent }) => {
        parents.push(parent?.id);
        if (parent?.id === "north")
          return new Promise((resolve) => {
            oldSearch = resolve;
          });
        return Promise.resolve({
          items: [
            {
              id: "south-warehouse",
              label: "新南区仓库",
              snapshot: { revision: "r7" },
            },
          ],
          total: 1,
        });
      },
      resolve: async ({ ids }) =>
        ids.map((id) => ({
          id,
          label: "目录新仓库名",
          snapshot: { revision: "r9" },
        })),
    },
  });
  expect(input(w, "仓库").element.value).toBe("历史仓库");
  expect(w.text()).not.toContain("目录新仓库名");
  await input(w, "补充说明").setValue(true);
  await input(w, "地区说明").setValue("保留条件字段内容");
  await input(w, "地区").trigger("click");
  await flushPromises();
  await click(w, "合成南区");
  expect(input(w, "仓库").element.value).toBe("");
  expect(new Set(parents)).toEqual(new Set(["north", "south"]));
  expect(parents.at(-1)).toBe("south");
  oldSearch({ items: [{ id: "late", label: "迟到北区仓库" }], total: 1 });
  await flushPromises();
  expect(w.text()).not.toContain("迟到北区仓库");
  await input(w, "仓库").trigger("click");
  await flushPromises();
  await click(w, "新南区仓库");
  await answer(w);
  await click(w, "保存");
  expect(saves[0].profile).toEqual({
    region: { id: "south", label: "合成南区" },
    warehouse: {
      id: "south-warehouse",
      label: "新南区仓库",
      snapshot: { revision: "r7" },
    },
    extra: true,
    reason: "保留条件字段内容",
  });
}, 20000);
it("requires both business answers, explicitly stores their calculated facts and invalidates them after a draft change", async () => {
  const saves: ComplexDraft[] = [];
  const w = await start({
    save: async (value) => {
      saves.push(value);
    },
  });
  expect(input(w, "合计结果").element.value).toBe("1.2300");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await input(w, "核对计算结果").setValue(true);
  await flushPromises();
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  input(w, "计算说明").element.value = "尚未采用";
  await input(w, "计算说明").trigger("input");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await input(w, "计算说明").trigger("change");
  await flushPromises();
  expect(input(w, "已采用说明").element.value).toBe("尚未采用");
  expect(button(w, "保存").attributes("disabled")).toBeUndefined();
  await click(w, "编辑价格 1");
  await input(w, "价格金额").setValue("9007199254740993.0100");
  await click(w, "确定价格");
  expect(input(w, "合计结果").element.value).toBe("9007199254740993.0100");
  expect(input(w, "已采用说明").element.value).toBe("");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await answer(w);
  await click(w, "保存");
  expect(saves[0].calculation).toEqual({
    basis:
      '{"units":[{"code":"each","ratio":"1.0000","count":0},{"code":"box","ratio":"12.0000","count":1}],"prices":[{"tier":"标准","amount":"9007199254740993.0100"}],"rows":[{"id":"first","name":"合成甲品","quantity":"0.0100","parts":[{"ingredient":"原配料","ratio":"1.0000"}]},{"id":"second","name":"合成乙品","quantity":"2.0000","parts":[]}]}',
    result: "9007199254740993.0100",
    confirmation: true,
    answer: "  合成核对  ",
  });
}, 20000);
it("holds the complex save after calculation failure and retries without writing until questions are answered", async () => {
  let failed = false;
  const save = vi.fn(async () => {});
  const w = await start({
    save,
    collaboration: {
      change: async (input) => {
        if (!failed) {
          failed = true;
          throw Error("合成计算失败");
        }
        return complexCollaboration.change(input);
      },
    },
  });
  expect(w.text()).toContain("合成计算失败");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  expect(save).not.toHaveBeenCalled();
  await click(w, "重试业务计算");
  expect(input(w, "合计结果").element.value).toBe("1.2300");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await answer(w);
  await click(w, "保存");
  expect(save).toHaveBeenCalledTimes(1);
});
it("adopts isolated calculations only for the current complex draft and ignores canceled editor responses", async () => {
  type Input = Parameters<
    DraftCollaboration<ComplexDraft, unknown>["change"]
  >[0];
  type Result = Awaited<
    ReturnType<DraftCollaboration<ComplexDraft, unknown>["change"]>
  >;
  const requests: { input: Input; resolve: (value: Result) => void }[] = [];
  const save = vi.fn(async () => {});
  const w = await start({
    save,
    collaboration: {
      change: (input) =>
        new Promise((resolve) => {
          requests.push({ input, resolve });
        }),
    },
  });
  const initial = requests.at(-1)!;
  initial.input.value.name = "隔离中的计算修改";
  expect(input(w, "资料名称").element.value).toBe("合成复杂资料");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await input(w, "资料名称").setValue("第二代输入");
  await flushPromises();
  const second = requests.at(-1)!;
  second.resolve(await complexCollaboration.change(second.input));
  await flushPromises();
  initial.resolve(await complexCollaboration.change(initial.input));
  await flushPromises();
  expect(input(w, "资料名称").element.value).toBe("第二代输入");
  expect(initial.input.signal.aborted).toBe(true);
  const oldPrompt = input(w, "核对计算结果");
  await input(w, "资料名称").setValue("待取消输入");
  await flushPromises();
  const canceled = requests.at(-1)!;
  const beforeOldAnswer = requests.length;
  await oldPrompt.setValue(true);
  await flushPromises();
  expect(requests).toHaveLength(beforeOldAnswer);
  await click(w, "取消编辑");
  await click(w, "放弃本地修改");
  expect(canceled.input.signal.aborted).toBe(true);
  await click(w, "编辑");
  const fresh = requests.at(-1)!;
  fresh.resolve(await complexCollaboration.change(fresh.input));
  await flushPromises();
  canceled.input.value.name = "取消后迟到结果";
  canceled.resolve(await complexCollaboration.change(canceled.input));
  await flushPromises();
  expect(input(w, "资料名称").element.value).toBe("合成复杂资料");
  expect(save).not.toHaveBeenCalled();
});
// Full mounted nested-dialog adoption is substantially slower on the CI runner.
it("retains an unfinished child draft when a calculation adopts equal committed row values", async () => {
  type Input = Parameters<
    DraftCollaboration<ComplexDraft, unknown>["change"]
  >[0];
  type Result = Awaited<
    ReturnType<DraftCollaboration<ComplexDraft, unknown>["change"]>
  >;
  let pending!: { input: Input; resolve: (value: Result) => void };
  const saves: ComplexDraft[] = [];
  let first = true;
  const w = await start({
    save: async (value) => {
      saves.push(value);
    },
    collaboration: {
      change: (input) => {
        if (!first) return complexCollaboration.change(input);
        first = false;
        return new Promise((resolve) => {
          pending = { input, resolve };
        });
      },
    },
  });
  await click(w, "编辑配料 · 明细行 1");
  await click(w, "新增");
  let dialog = new DOMWrapper(document.body).get(
    '[role="dialog"][aria-label="配料 · 明细行 1"]',
  );
  await dialog.get('input[aria-label="配料名"]').setValue("未确认配料");
  pending.resolve(await complexCollaboration.change(pending.input));
  await flushPromises();
  dialog = new DOMWrapper(document.body).get(
    '[role="dialog"][aria-label="配料 · 明细行 1"]',
  );
  expect(
    dialog.get<HTMLInputElement>('input[aria-label="配料名"]').element.value,
  ).toBe("未确认配料");
  expect(button(w, "保存").attributes("disabled")).toBeDefined();
  await click(w, "确定子项");
  await click(w, "确定配料");
  await answer(w);
  await click(w, "保存");
  expect(saves[0].sheet.rows[0].parts).toEqual([
    { ingredient: "原配料", ratio: "1.0000" },
    { ingredient: "未确认配料", ratio: "1.0000" },
  ]);
}, 60000);
