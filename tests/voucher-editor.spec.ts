import { hostAndDialogButtons } from "./host-and-dialog-buttons";
import { DOMWrapper } from "@vue/test-utils";
import { defineComponent, h, ref, type Component } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { type VoucherEditorValue } from "../src/index";
import VoucherEditor from "../src/VoucherEditor.vue";

type Header = { supplier: string; date: string };
type Row = { id: string; name: string; quantity: string };
const initial: VoucherEditorValue<Header, Row> = {
  header: { supplier: "合成供应商", date: "2026-10-20" },
  rows: [{ id: "one", name: "合成商品", quantity: "9007199254740993.0100" }],
};
function editor(mode: "read" | "edit" = "edit") {
  const value = ref<VoucherEditorValue<Header, Row>>(structuredClone(initial));
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(VoucherEditor as Component, {
          modelValue: value.value,
          scope: "synthetic",
          mode,
          headerFields: [
            { key: "supplier", label: "供应商", type: "text" },
            { key: "date", label: "单据日期", type: "date" },
          ],
          rowFields: [
            { key: "name", label: "品名", type: "text" },
            { key: "quantity", label: "数量", type: "decimal" },
          ],
          columns: [
            { key: "name", label: "品名" },
            { key: "quantity", label: "数量", type: "decimal" },
          ],
          rowKey: (row: Row) => row.id,
          emptyRow: () => ({ id: "two", name: "", quantity: "" }),
          "onUpdate:modelValue": (next: VoucherEditorValue<Header, Row>) =>
            (value.value = next),
        }),
    }),
  );
  return { wrapper, value };
}
async function clickRow(
  wrapper: ReturnType<typeof mount>,
  action: string,
  row: number,
) {
  await wrapper
    .findAll('[data-label="操作"]')
    [row - 1]!.get(`[aria-label="${action}"]`)
    .trigger("click");
  await flushPromises();
}
async function click(wrapper: ReturnType<typeof mount>, text: string) {
  await hostAndDialogButtons(wrapper)
    .find(
      (b) =>
        (b.text() === text || b.attributes("aria-label") === text) &&
        b.attributes("disabled") === undefined,
    )!
    .trigger("click");
  await flushPromises();
}
it("shows a voucher header and detail table and edits a row without changing decimal text", async () => {
  const { wrapper, value } = editor();
  expect(wrapper.get('input[aria-label="供应商"]').element).toHaveProperty(
    "value",
    "合成供应商",
  );
  expect(wrapper.find("table").text()).toContain("9007199254740993.0100");
  await wrapper.get('input[aria-label="供应商"]').setValue("合成供应商乙");
  expect(value.value.header.supplier).toBe("合成供应商乙");
  await clickRow(wrapper, "编辑", 1);
  await wrapper.get('input[aria-label="品名"]').setValue("修改品名");
  await click(wrapper, "取消明细行");
  expect(value.value.rows[0].name).toBe("合成商品");
  await clickRow(wrapper, "编辑", 1);
  await wrapper.get('input[aria-label="品名"]').setValue("修改品名");
  await click(wrapper, "确定明细行");
  expect(value.value.rows).toEqual([
    { id: "one", name: "修改品名", quantity: "9007199254740993.0100" },
  ]);
  wrapper.unmount();
});
it("shows the same details without editing actions in read mode", () => {
  const { wrapper } = editor("read");
  expect(wrapper.find("table").text()).toContain("合成商品");
  expect(hostAndDialogButtons(wrapper)).toHaveLength(0);
  expect(wrapper.findAll("input")).toHaveLength(0);
  expect(wrapper.get('[aria-label="单据表头"]').text()).toContain("合成供应商");
  wrapper.unmount();
});
it("adds and confirms deletion of a detail row", async () => {
  const { wrapper, value } = editor();
  await click(wrapper, "新增");
  await wrapper.get('input[aria-label="品名"]').setValue("第二商品");
  await click(wrapper, "确定明细行");
  expect(value.value.rows).toHaveLength(2);
  await clickRow(wrapper, "删除", 1);
  expect(value.value.rows).toHaveLength(2);
  await click(wrapper, "确认删除");
  expect(value.value.rows.map((row) => row.id)).toEqual(["two"]);
  wrapper.unmount();
});
type Formula = { material: string; amount: string };
type FormulaRow = Row & { formula: Formula[] };
function formulaEditor(mode: "read" | "edit" = "edit") {
  const value = ref<VoucherEditorValue<Header, FormulaRow>>({
    header: initial.header,
    rows: [
      { id: "one", name: "甲", quantity: "1", formula: [] },
      { id: "two", name: "乙", quantity: "2", formula: [] },
    ],
  });
  const scope = ref("synthetic");
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(VoucherEditor as Component, {
          modelValue: value.value,
          scope: scope.value,
          mode,
          headerFields: [],
          rowFields: [{ key: "name", label: "品名", type: "text" }],
          columns: [
            { key: "name", label: "品名" },
            {
              key: "formula",
              label: "配方",
              type: "children",
              fields: [
                { key: "material", label: "原料", type: "text" },
                { key: "amount", label: "用量", type: "decimal" },
              ],
              empty: () => ({ material: "", amount: "" }),
              summary: (children: readonly Formula[]) =>
                `${children.length} 项`,
            },
          ],
          rowKey: (row: FormulaRow) => row.id,
          emptyRow: () => ({ id: "new", name: "", quantity: "", formula: [] }),
          "onUpdate:modelValue": (
            next: VoucherEditorValue<Header, FormulaRow>,
          ) => (value.value = next),
        }),
    }),
    { attachTo: document.body },
  );
  return { wrapper, value, scope };
}
it("edits only the selected row's formula children and discards cancelled changes", async () => {
  const { wrapper, value } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 2");
  await click(wrapper, "新增");
  await new DOMWrapper(document.body)
    .get('input[aria-label="原料"]')
    .setValue("合成原料");
  await new DOMWrapper(document.body)
    .get('input[aria-label="用量"]')
    .setValue("0.0100");
  await click(wrapper, "取消配方");
  expect(value.value.rows[1].formula).toEqual([]);
  await click(wrapper, "编辑配方 · 明细行 2");
  await click(wrapper, "新增");
  await new DOMWrapper(document.body)
    .get('input[aria-label="原料"]')
    .setValue("合成原料");
  await new DOMWrapper(document.body)
    .get('input[aria-label="用量"]')
    .setValue("0.0100");
  await click(wrapper, "确定配方");
  expect(value.value.rows[0].formula).toEqual([]);
  expect(value.value.rows[1].formula).toEqual([
    { material: "合成原料", amount: "0.0100" },
  ]);
  expect(wrapper.find("table").text()).toContain("1 项");
  wrapper.unmount();
});
it("discards an open formula draft on scope change and allows read-only inspection", async () => {
  const { wrapper, value, scope } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 2");
  await click(wrapper, "新增");
  await new DOMWrapper(document.body)
    .get('input[aria-label="原料"]')
    .setValue("迟到原料");
  scope.value = "other";
  await flushPromises();
  expect(
    new DOMWrapper(document.body)
      .find('[role="dialog"][aria-label="配方 · 明细行 2"]')
      .exists(),
  ).toBe(false);
  expect(value.value.rows[1].formula).toEqual([]);
  wrapper.unmount();
  const read = formulaEditor("read");
  await click(read.wrapper, "查看配方 · 明细行 1");
  expect(
    new DOMWrapper(document.body)
      .find('[role="dialog"][aria-label="配方 · 明细行 1"]')
      .exists(),
  ).toBe(true);
  expect(
    hostAndDialogButtons(read.wrapper).some((b) => b.text() === "确定配方"),
  ).toBe(false);
  read.wrapper.unmount();
});
it("moves focus into the formula dialog and restores it on close", async () => {
  const { wrapper } = formulaEditor();
  const trigger = hostAndDialogButtons(wrapper).find(
    (b) => b.text() === "编辑配方 · 明细行 1",
  )!;
  await trigger.trigger("click");
  await flushPromises();
  expect(document.activeElement?.textContent).toContain("取消配方");
  await click(wrapper, "取消配方");
  expect(document.activeElement).toBe(trigger.element);
  wrapper.unmount();
});
it("blocks confirmation while a directly edited formula row is invalid", async () => {
  const { wrapper, value } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 1");
  await click(wrapper, "新增");
  await new DOMWrapper(document.body)
    .get('input[aria-label="用量"]')
    .setValue("-");
  expect(
    hostAndDialogButtons(wrapper)
      .find((b) => b.text() === "确定配方")!
      .attributes("disabled"),
  ).toBeDefined();
  expect(value.value.rows[0].formula).toEqual([]);
  await new DOMWrapper(document.body)
    .get('input[aria-label="用量"]')
    .setValue("1.2300");
  await click(wrapper, "确定配方");
  expect(value.value.rows[0].formula).toEqual([
    { material: "", amount: "1.2300" },
  ]);
  wrapper.unmount();
});
it("drops a formula draft if the parent rows change while it is open", async () => {
  const { wrapper, value } = formulaEditor();
  await click(wrapper, "编辑配方 · 明细行 1");
  value.value = { ...value.value, rows: [...value.value.rows].reverse() };
  await flushPromises();
  expect(
    new DOMWrapper(document.body)
      .find('[role="dialog"][aria-label="配方 · 明细行 1"]')
      .exists(),
  ).toBe(false);
  expect(value.value.rows.map((row) => row.formula)).toEqual([[], []]);
  wrapper.unmount();
});
it("reports unfinished local row input until it is confirmed or discarded", async () => {
  const { wrapper, value } = editor();
  await clickRow(wrapper, "编辑", 1);
  const component = wrapper.findComponent({ name: "VoucherEditor" });
  expect(component.emitted("pending")?.at(-1)).toEqual([true]);
  await wrapper.get('input[aria-label="品名"]').setValue("未确认的输入");
  expect(value.value.rows[0].name).toBe("合成商品");
  await click(wrapper, "取消明细行");
  expect(component.emitted("pending")?.at(-1)).toEqual([false]);
  wrapper.unmount();
});

function asyncEditor(emptyRow: () => Row | Promise<Row>) {
  return mount(VoucherEditor<Header, Row>, {
    props: {
      modelValue: structuredClone(initial),
      scope: "first",
      mode: "edit",
      headerFields: [],
      rowFields: [{ key: "name", label: "品名", type: "text" }],
      columns: [{ key: "name", label: "品名" }],
      rowKey: (row: Row) => row.id,
      emptyRow,
    },
  });
}
it("awaits a new row before opening and locks concurrent row actions", async () => {
  let resolve!: (row: Row) => void;
  let calls = 0;
  const wrapper = asyncEditor(() => {
    calls++;
    return new Promise<Row>((done) => {
      resolve = done;
    });
  });
  await clickRow(wrapper, "编辑", 1);
  expect(calls).toBe(0);
  await click(wrapper, "取消明细行");
  await click(wrapper, "新增");
  expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
  expect(wrapper.get('[role="status"]').text()).toContain("正在更新明细…");
  expect(wrapper.emitted("pending")?.at(-1)).toEqual([true]);
  for (const name of ["新增", "编辑", "删除"]) {
    expect(
      wrapper
        .findAll("button")
        .find((b) => b.text() === name || b.attributes("aria-label") === name)!
        .attributes("disabled"),
    ).toBeDefined();
  }
  resolve({ id: "stable-new", name: "异步默认", quantity: "0.0000" });
  await flushPromises();
  expect(wrapper.get('input[aria-label="品名"]').element).toHaveProperty(
    "value",
    "异步默认",
  );
  await click(wrapper, "确定明细行");
  expect(
    (
      wrapper.emitted("update:modelValue")!.at(-1)![0] as VoucherEditorValue<
        Header,
        Row
      >
    ).rows.at(-1)?.id,
  ).toBe("stable-new");
  wrapper.unmount();
});
it("shows a failed row preparation without inserting and permits retry", async () => {
  let attempts = 0;
  const wrapper = asyncEditor(async () => {
    if (!attempts++) throw new Error("请选择仓库后重试。");
    return { id: "retry", name: "默认", quantity: "0" };
  });
  await click(wrapper, "新增");
  expect(wrapper.get('[role="alert"]').text()).toContain("请选择仓库后重试。");
  expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
  expect(wrapper.emitted("pending")?.at(-1)).toEqual([false]);
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  await click(wrapper, "新增");
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  expect(wrapper.get('input[aria-label="品名"]').element).toHaveProperty(
    "value",
    "默认",
  );
  wrapper.unmount();
});
it.each(["scope", "instance", "mode", "disabled", "model", "unmount"])(
  "ignores late row preparation after %s changes",
  async (change) => {
    let resolve!: (row: Row) => void;
    const wrapper = asyncEditor(
      () =>
        new Promise<Row>((done) => {
          resolve = done;
        }),
    );
    await click(wrapper, "新增");
    if (change === "scope") await wrapper.setProps({ scope: "second" });
    if (change === "instance") await wrapper.setProps({ instance: 2 });
    if (change === "mode") await wrapper.setProps({ mode: "read" });
    if (change === "disabled") await wrapper.setProps({ disabled: true });
    if (change === "model")
      await wrapper.setProps({
        modelValue: {
          ...initial,
          header: { ...initial.header, date: "2026-10-27" },
        },
      });
    if (change === "unmount") wrapper.unmount();
    const pendingCount = wrapper.emitted("pending")?.length;
    resolve({ id: "late", name: "旧默认", quantity: "1" });
    await flushPromises();
    expect(wrapper.emitted("pending")?.length).toBe(pendingCount);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    if (change !== "unmount") {
      expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
      expect(wrapper.emitted("pending")?.at(-1)).toEqual([false]);
      wrapper.unmount();
    }
  },
);
it("awaits a row transformation before adoption and retains previous input on failure", async () => {
  const wrapper = asyncEditor(() => ({ id: "new", name: "", quantity: "0" }));
  let resolve!: (row: Row) => void;
  await wrapper.setProps({
    transformRow: ({ value, previous }: { value: Row; previous: Row }) => {
      expect(previous.name).toBe("合成商品");
      return new Promise<Row>((done) => {
        resolve = () => done({ ...value, name: "权威结果" });
      });
    },
  });
  await clickRow(wrapper, "编辑", 1);
  await wrapper.get('input[aria-label="品名"]').setValue("修改");
  expect(
    wrapper
      .findAll("button")
      .find((b) => b.text() === "确定明细行")!
      .attributes("disabled"),
  ).toBeDefined();
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  resolve({ id: "one", name: "unused", quantity: "0" });
  await flushPromises();
  expect(wrapper.get('input[aria-label="品名"]').element).toHaveProperty(
    "value",
    "权威结果",
  );
  await wrapper.setProps({
    transformRow: async () => {
      throw new Error("价格不可用。");
    },
  });
  await wrapper.get('input[aria-label="品名"]').setValue("失败修改");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain("价格不可用。");
  expect(wrapper.get('input[aria-label="品名"]').element).toHaveProperty(
    "value",
    "权威结果",
  );
  wrapper.unmount();
});
it("honors separate row operations and cancels a late default when insertion is revoked", async () => {
  let resolve!: (row: Row) => void;
  const wrapper = asyncEditor(
    () =>
      new Promise<Row>((done) => {
        resolve = done;
      }),
  );
  await wrapper.setProps({
    rowOperations: { insert: true, update: false, delete: false },
  });
  expect(
    wrapper
      .findAll("button")
      .some((b) => b.attributes("aria-label") === "编辑"),
  ).toBe(false);
  expect(
    wrapper
      .findAll("button")
      .some((b) => b.attributes("aria-label") === "删除"),
  ).toBe(false);
  await click(wrapper, "新增");
  await wrapper.setProps({
    rowOperations: { insert: false, update: true, delete: true },
  });
  resolve({ id: "late", name: "已撤销", quantity: "0" });
  await flushPromises();
  expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
  expect(wrapper.findAll("button").some((b) => b.text() === "新增")).toBe(
    false,
  );
  await clickRow(wrapper, "编辑", 1);
  await wrapper.setProps({
    rowOperations: { insert: false, update: false, delete: true },
  });
  expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
  await clickRow(wrapper, "删除", 1);
  await click(wrapper, "确认删除");
  expect(
    (
      wrapper.emitted("update:modelValue")!.at(-1)![0] as VoucherEditorValue<
        Header,
        Row
      >
    ).rows,
  ).toEqual([]);
  wrapper.unmount();
});
it.each(["scope", "disabled", "permission", "model", "cancel", "unmount"])(
  "discards a late row transformation after %s",
  async (change) => {
    let resolve!: (row: Row) => void;
    const wrapper = asyncEditor(() => ({ id: "new", name: "", quantity: "0" }));
    await wrapper.setProps({
      transformRow: () =>
        new Promise<Row>((done) => {
          resolve = done;
        }),
    });
    await clickRow(wrapper, "编辑", 1);
    await wrapper.get('input[aria-label="品名"]').setValue("待核价格");
    if (change === "scope") await wrapper.setProps({ scope: "next" });
    if (change === "disabled") await wrapper.setProps({ disabled: true });
    if (change === "permission")
      await wrapper.setProps({
        rowOperations: { insert: true, update: false, delete: true },
      });
    if (change === "model")
      await wrapper.setProps({ modelValue: { ...initial, rows: [] } });
    if (change === "cancel") await click(wrapper, "取消明细行");
    if (change === "unmount") wrapper.unmount();
    const pendingCount = wrapper.emitted("pending")?.length;
    resolve({ id: "one", name: "旧价格结果", quantity: "1" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.emitted("pending")?.length).toBe(pendingCount);
    if (change !== "unmount") {
      expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
      wrapper.unmount();
    }
  },
);

it("keeps a full prepared candidate local, cancels it all, then adopts header and other rows once", async () => {
  const events: string[] = [];
  const wrapper = mount(VoucherEditor<Header, Row>, {
    props: {
      modelValue: structuredClone(initial),
      scope: "full",
      mode: "edit",
      headerFields: [{ key: "supplier", label: "供应商", type: "text" }],
      rowFields: [{ key: "name", label: "品名", type: "text" }],
      columns: [{ key: "name", label: "品名" }],
      rowKey: (row: Row) => row.id,
      rowDraft: {
        prepare: async ({
          candidate,
        }: {
          candidate: VoucherEditorValue<Header, Row>;
        }) => ({
          rowKey: "new-full",
          candidate: {
            header: { ...candidate.header, supplier: "候选供应商" },
            rows: [
              { ...candidate.rows[0], name: "他行改值" },
              { id: "new-full", name: "初始化新行", quantity: "0" },
            ],
          },
        }),
      },
      "onUpdate:modelValue": () => events.push("update"),
      onPending: (pending: boolean) => events.push(`pending:${pending}`),
    },
  });
  await click(wrapper, "新增");
  expect(wrapper.get('[aria-label="单据表头"]').text()).toContain("候选供应商");
  expect(wrapper.find('input[aria-label="供应商"]').exists()).toBe(false);
  expect(wrapper.get("table").text()).toContain("他行改值");
  expect(wrapper.get('input[aria-label="品名"]').element).toHaveProperty(
    "value",
    "初始化新行",
  );
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  await click(wrapper, "取消明细行");
  expect(wrapper.get('input[aria-label="供应商"]').element).toHaveProperty(
    "value",
    "合成供应商",
  );
  expect(wrapper.get("table").text()).toContain("合成商品");
  await click(wrapper, "新增");
  const actionStart = events.length;
  await click(wrapper, "确定明细行");
  expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
  const adopted = wrapper.emitted(
    "update:modelValue",
  )![0][0] as VoucherEditorValue<Header, Row>;
  expect(adopted.header.supplier).toBe("候选供应商");
  expect(adopted.rows.map((row) => row.name)).toEqual([
    "他行改值",
    "初始化新行",
  ]);
  expect(events.slice(actionStart)[0]).toBe("update");
  expect(events.slice(actionStart)).toContain("pending:false");
  wrapper.unmount();
});
it("restores the visible integer input when a transformation fails", async () => {
  type CountRow = { id: string; count: number };
  const wrapper = mount(VoucherEditor<Header, CountRow>, {
    props: {
      modelValue: { header: initial.header, rows: [{ id: "count", count: 1 }] },
      scope: "integer",
      mode: "edit",
      headerFields: [],
      rowFields: [{ key: "count", label: "件数", type: "integer" }],
      columns: [{ key: "count", label: "件数" }],
      rowKey: (row: CountRow) => row.id,
      emptyRow: () => ({ id: "new-count", count: 0 }),
      transformRow: async () => {
        throw new Error("件数不可用。");
      },
    },
  });
  await clickRow(wrapper, "编辑", 1);
  await wrapper.get('input[aria-label="件数"]').setValue("7");
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain("件数不可用。");
  expect(wrapper.get('input[aria-label="件数"]').element).toHaveProperty(
    "value",
    "1",
  );
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  wrapper.unmount();
});
function fullEditor(
  change?: (input: {
    value: Row;
    previous: Row;
    candidate: VoucherEditorValue<Header, Row>;
  }) =>
    VoucherEditorValue<Header, Row> | Promise<VoucherEditorValue<Header, Row>>,
) {
  return mount(VoucherEditor<Header, Row>, {
    props: {
      modelValue: {
        header: structuredClone(initial.header),
        rows: [
          ...structuredClone(initial.rows),
          { id: "peer", name: "另一行", quantity: "2" },
        ],
      },
      scope: "full-change",
      mode: "edit",
      headerFields: [{ key: "supplier", label: "供应商", type: "text" }],
      rowFields: [{ key: "name", label: "品名", type: "text" }],
      columns: [{ key: "name", label: "品名" }],
      rowKey: (row: Row) => row.id,
      rowDraft: {
        prepare: ({ candidate }) => ({
          rowKey: "new",
          candidate: {
            ...candidate,
            rows: [
              ...candidate.rows,
              { id: "new", name: "新增", quantity: "0" },
            ],
          },
        }),
        change,
      },
    },
  });
}
it("applies a whole calculation candidate and rolls back a rejected visible change without leaking header patches", async () => {
  let fail = false;
  const wrapper = fullEditor(async ({ value, previous, candidate }) => {
    expect(candidate.rows[0].name).toBe(value.name);
    expect(previous.id).toBe("one");
    candidate.header.supplier = "不应泄漏";
    if (fail) throw new Error("重新输入。");
    return {
      header: { ...candidate.header, supplier: "计算供应商" },
      rows: candidate.rows.map((row) =>
        row.id === "peer" ? { ...row, name: "跨行计算" } : row,
      ),
    };
  });
  await clickRow(wrapper, "编辑", 1);
  await wrapper.get('input[aria-label="品名"]').setValue("第一修改");
  await flushPromises();
  expect(wrapper.get('[aria-label="单据表头"]').text()).toContain("计算供应商");
  expect(wrapper.get("table").text()).toContain("跨行计算");
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  fail = true;
  await wrapper.get('input[aria-label="品名"]').setValue("失败修改");
  await flushPromises();
  expect(wrapper.get('input[aria-label="品名"]').element).toHaveProperty(
    "value",
    "第一修改",
  );
  expect(wrapper.get('[aria-label="单据表头"]').text()).toContain("计算供应商");
  expect(wrapper.get('[aria-label="单据表头"]').text()).not.toContain(
    "不应泄漏",
  );
  await click(wrapper, "确定明细行");
  const [adopted, origin] = wrapper.emitted("update:modelValue")![0] as [
    VoucherEditorValue<Header, Row>,
    { kind: string },
  ];
  expect(adopted.header.supplier).toBe("计算供应商");
  expect(adopted.rows.map((row) => row.name)).toEqual(["第一修改", "跨行计算"]);
  expect(origin.kind).toBe("row");
  wrapper.unmount();
});
it("keeps a removed target as a full candidate until explicit adoption or cancellation", async () => {
  const wrapper = fullEditor(({ value, candidate }) => ({
    header: { ...candidate.header, supplier: "删除后表头" },
    rows: candidate.rows.filter((row) => row.id !== value.id),
  }));
  await clickRow(wrapper, "编辑", 1);
  await wrapper.get('input[aria-label="品名"]').setValue("移除当前行");
  await flushPromises();
  expect(wrapper.get('[aria-label="编辑明细行"]').text()).toContain(
    "该明细行已移除。",
  );
  expect(wrapper.find('input[aria-label="品名"]').exists()).toBe(false);
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  await click(wrapper, "取消明细行");
  expect(wrapper.get("table").text()).toContain("合成商品");
  await clickRow(wrapper, "编辑", 1);
  await wrapper.get('input[aria-label="品名"]').setValue("移除当前行");
  await flushPromises();
  await click(wrapper, "确定明细行");
  const adopted = wrapper.emitted(
    "update:modelValue",
  )![0][0] as VoucherEditorValue<Header, Row>;
  expect(adopted.rows.map((row) => row.id)).toEqual(["peer"]);
  expect(adopted.header.supplier).toBe("删除后表头");
  wrapper.unmount();
});
it.each(["scope", "instance", "model", "permission", "disabled", "unmount"])(
  "discards all late candidate patches after %s",
  async (change) => {
    let resolve!: (value: VoucherEditorValue<Header, Row>) => void;
    const wrapper = fullEditor(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await clickRow(wrapper, "编辑", 1);
    await wrapper.get('input[aria-label="品名"]').setValue("等待计算");
    if (change === "scope") await wrapper.setProps({ scope: "next" });
    if (change === "instance") await wrapper.setProps({ instance: 2 });
    if (change === "model")
      await wrapper.setProps({ modelValue: { ...initial, rows: [] } });
    if (change === "permission")
      await wrapper.setProps({
        rowOperations: { insert: true, update: false, delete: true },
      });
    if (change === "disabled") await wrapper.setProps({ disabled: true });
    if (change === "unmount") wrapper.unmount();
    const events = wrapper.emitted("pending")?.length;
    resolve({ header: { ...initial.header, supplier: "迟到表头" }, rows: [] });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.emitted("pending")?.length).toBe(events);
    if (change !== "unmount") {
      expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain("迟到表头");
      wrapper.unmount();
    }
  },
);
it("permits init to remove the just-prepared target without losing other candidate changes", async () => {
  const wrapper = fullEditor();
  await wrapper.setProps({
    rowDraft: {
      prepare: ({
        candidate,
      }: {
        candidate: VoucherEditorValue<Header, Row>;
      }) => ({
        rowKey: "removed-new",
        candidate: {
          ...candidate,
          header: { ...candidate.header, supplier: "初始化表头" },
        },
      }),
    },
  });
  await click(wrapper, "新增");
  expect(wrapper.get('[aria-label="编辑明细行"]').text()).toContain(
    "该明细行已移除。",
  );
  await click(wrapper, "确定明细行");
  const adopted = wrapper.emitted(
    "update:modelValue",
  )![0][0] as VoucherEditorValue<Header, Row>;
  expect(adopted.rows.map((row) => row.id)).toEqual(["one", "peer"]);
  expect(adopted.header.supplier).toBe("初始化表头");
  wrapper.unmount();
});
it("labels direct header edits independently of row adoption", async () => {
  const wrapper = fullEditor();
  await wrapper.get('input[aria-label="供应商"]').setValue("用户直接修改");
  expect(wrapper.emitted("update:modelValue")![0][1]).toEqual({
    kind: "header",
  });
  wrapper.unmount();
});
it("drops a full local candidate when the external model changes before confirmation", async () => {
  const wrapper = fullEditor();
  await clickRow(wrapper, "编辑", 1);
  await wrapper.setProps({
    modelValue: {
      ...initial,
      header: { ...initial.header, supplier: "外部更新" },
    },
  });
  expect(wrapper.find('[aria-label="编辑明细行"]').exists()).toBe(false);
  expect(wrapper.get('input[aria-label="供应商"]').element).toHaveProperty(
    "value",
    "外部更新",
  );
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  wrapper.unmount();
});

it("resolves new and existing row fields from an isolated active row", async () => {
  type Item = { id: string; role: string; name: string; quantity: string };
  const model = ref<VoucherEditorValue<Header, Item>>({
    header: { ...initial.header },
    rows: [{ ...initial.rows[0], role: "main" }],
  });
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(VoucherEditor as Component, {
          modelValue: model.value,
          scope: "active-fields",
          mode: "edit",
          headerFields: [],
          rowFields: (row: Item) => {
            const locked = row.role === "main";
            row.name = "callback mutation";
            return [
              { key: "name", label: "行名称", type: "text" },
              {
                key: "quantity",
                label: "行数量",
                type: "decimal",
                readonly: locked,
              },
            ];
          },
          columns: [{ key: "name", label: "名称" }],
          rowKey: (row: Item) => row.id,
          emptyRow: () => ({
            id: "new",
            role: "detail",
            name: "新行",
            quantity: "1.0000",
          }),
          "onUpdate:modelValue": (next: VoucherEditorValue<Header, Item>) =>
            (model.value = next),
        }),
    }),
  );
  await clickRow(wrapper, "编辑", 1);
  expect(
    wrapper.get('input[aria-label="行数量"]').attributes("disabled"),
  ).toBeDefined();
  expect(wrapper.get('input[aria-label="行名称"]').element).toHaveProperty(
    "value",
    "合成商品",
  );
  await click(wrapper, "取消明细行");
  expect(model.value.rows[0].name).toBe("合成商品");
  await click(wrapper, "新增");
  expect(
    wrapper.get('input[aria-label="行数量"]').attributes("disabled"),
  ).toBeUndefined();
  await wrapper
    .get('input[aria-label="行数量"]')
    .setValue("9007199254740993.1234");
  await click(wrapper, "确定明细行");
  expect(model.value.rows[1].quantity).toBe("9007199254740993.1234");
  expect(model.value.rows[1].name).toBe("新行");
  wrapper.unmount();
});
it("re-resolves role visibility and readonly after an asynchronous full-row change", async () => {
  type Item = { id: string; role: string; quantity: string };
  let resolve!: (value: VoucherEditorValue<Header, Item>) => void;
  let candidate!: VoucherEditorValue<Header, Item>;
  const wrapper = mount(VoucherEditor as Component, {
    props: {
      scope: "role-change",
      mode: "edit",
      modelValue: {
        header: { ...initial.header },
        rows: [{ id: "one", role: "detail", quantity: "1.0000" }],
      },
      headerFields: [],
      rowKey: (row: Item) => row.id,
      columns: [{ key: "quantity", label: "数量" }],
      rowFields: (row: Item) => [
        {
          key: "role",
          label: "行角色",
          type: "text",
        },
        {
          key: "quantity",
          label: "行数量",
          type: "decimal",
          readonly: row.role === "main",
        },
        ...(row.role === "detail"
          ? [{ key: "id", label: "子项标识", type: "text", readonly: true }]
          : []),
      ],
      rowDraft: {
        prepare: () => ({
          rowKey: "new",
          candidate: {
            header: { ...initial.header },
            rows: [{ id: "new", role: "detail", quantity: "1.0000" }],
          },
        }),
        change: (change: { candidate: VoucherEditorValue<Header, Item> }) => {
          candidate = change.candidate;
          return new Promise((yes) => (resolve = yes));
        },
      },
    },
  });
  await clickRow(wrapper, "编辑", 1);
  expect(wrapper.find('input[aria-label="子项标识"]').exists()).toBe(true);
  await wrapper.get('input[aria-label="行角色"]').setValue("main");
  expect(
    wrapper
      .findAll("button")
      .find((button) => button.text() === "确定明细行")!
      .attributes("disabled"),
  ).toBeDefined();
  resolve(candidate);
  await flushPromises();
  expect(
    wrapper.get('input[aria-label="行数量"]').attributes("disabled"),
  ).toBeDefined();
  expect(wrapper.find('input[aria-label="子项标识"]').exists()).toBe(false);
  await click(wrapper, "确定明细行");
  const result = wrapper.emitted(
    "update:modelValue",
  )![0][0] as VoucherEditorValue<Header, Item>;
  expect(result.rows[0]).toEqual({
    id: "one",
    role: "main",
    quantity: "1.0000",
  });
  wrapper.unmount();
});
