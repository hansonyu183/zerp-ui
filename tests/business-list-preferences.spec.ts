import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { domainOf, fixture, operation } from "./fixtures/static-model";
import { render, click, input, route } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});
it("shows explicit column labels for an empty collection without record templates", async () => {
  const { model, rows } = fixture();
  rows.items = [];
  rows.total = 0;
  rows.columns = [{ key: "internal", label: "空表标题" }];
  wrapper = await render(model);
  expect(document.querySelector("thead")?.textContent).toContain("空表标题");
  expect(document.body.textContent).toContain("暂无记录");
});
it("puts row actions in the second column and opens detail over retained conditions", async () => {
  const { model, term, rows } = fixture();
  term.value = "retained";
  rows.page = 3;
  wrapper = await render(model);
  const headers = Array.from(document.querySelectorAll("thead th"));
  expect(headers[1]?.textContent).toContain("操作");
  await click("编辑");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(input("条件").element.value).toBe("retained");
  await click("关闭");
  expect(term.value).toBe("retained");
  expect(rows.page).toBe(3);
  expect(document.querySelector("table")).not.toBeNull();
});
it("excludes unreadable fields from explicit columns and detail", async () => {
  const { model, name } = fixture();
  name.readable = false;
  wrapper = await render(model);
  expect(document.querySelector("table")?.textContent).not.toContain("initial");
  await click("编辑");
  expect(document.querySelector('input[aria-label="名称"]')).toBeNull();
  name.readable = true;
  await flushPromises();
  expect(document.querySelector("table")?.textContent).toContain("initial");
  expect(input("名称").element.value).toBe("initial");
});

it("keeps all qualified workflow actions directly reachable while ordinary rows use the menu", async () => {
  const { model, record } = fixture();
  const run = async () => {};
  record.workflow = {
    operations: {
      start: { disabled: false, run },
      advance: { disabled: false, run },
      approveChild: { disabled: false, run },
      rejectChild: { disabled: false, run },
    },
  };
  wrapper = await render(model);
  for (const label of ["启动", "推进", "批准子项", "拒绝子项"])
    expect(
      document.querySelector(`button[aria-label="${label}"]`),
      label,
    ).not.toBeNull();
  expect(document.querySelector('button[aria-label="更多操作"]')).toBeNull();
});

it("distinguishes loading, failure, retry, empty success and normal paging", async () => {
  const { model, rows, record, term } = fixture();
  rows.items = [];
  rows.total = 0;
  term.value = "retained";
  let fail!: (cause: Error) => void;
  const first = new Promise<void>((_, reject) => {
    fail = reject;
  });
  const read = vi
    .fn(async () => {})
    .mockImplementationOnce(() => first)
    .mockImplementationOnce(async () => {
      expect(term.value).toBe("retained");
      expect(rows.page).toBe(1);
    })
    .mockImplementation(async () => {
      rows.items = [record];
      rows.total = 40;
    });
  rows.operations.query = operation(read);
  const text = () => document.body.textContent;
  const paging = () => document.querySelector('nav[aria-label="分页"]');

  wrapper = await render(model);
  await click("查询");
  expect(text()).toContain("正在读取");
  expect(text()).not.toContain("暂无记录");
  expect(paging()).toBeNull();

  fail(Error("response unavailable"));
  await flushPromises();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "查询失败",
  );
  expect(input("条件").element.value).toBe("retained");
  expect(text()).not.toContain("暂无记录");
  expect(text()).not.toContain("共 0 条");
  expect(paging()).toBeNull();

  await click("重试");
  expect(text()).toContain("暂无记录");
  expect(text()).not.toContain("查询失败");
  expect(paging()).toBeNull();

  await click("查询");
  expect(text()).toContain("initial");
  expect(paging()).not.toBeNull();
  await click("下一页");
  expect(rows.page).toBe(2);
  expect(read).toHaveBeenCalledTimes(4);
});

it("keeps prior rows marked stale and uses one concrete query failure", async () => {
  const { model, rows } = fixture();
  rows.total = 60;
  rows.operations.query = operation(
    vi
      .fn(async () => {})
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        model.messages.push(
          {
            id: "query-warning",
            level: "warning",
            text: "该次查询的重复提示",
            target: rows,
          },
          {
            id: "query-denied",
            level: "error",
            text: "该范围暂不可读取",
            target: rows,
          },
        );
        throw Error("read failed");
      }),
  );
  wrapper = await render(model);
  await click("查询");
  rows.page = 2;
  await flushPromises();
  await click("下一页");
  expect(rows.page).toBe(2);
  expect(document.querySelector('[aria-label="分页"]')?.textContent).toContain(
    "第 2 页",
  );
  expect(document.querySelector("table")?.textContent).toContain("initial");
  const alerts = document.querySelectorAll('[role="alert"]');
  expect(alerts).toHaveLength(1);
  expect(alerts[0]?.textContent).toContain("该范围暂不可读取");
  expect(alerts[0]?.textContent).toContain("已有结果未更新");
  expect(document.body.textContent).not.toContain("该次查询的重复提示");
  await click("重试");
  expect(rows.page).toBe(3);
  expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
});

it.each([
  ["error", true],
  ["success", true],
  ["error", false],
  ["success", false],
] as const)(
  "isolates late %s feedback after opening a different collection (targeted: %s)",
  async (level, targeted) => {
    const { model, rows } = fixture();
    const other = fixture().rows;
    other.key = "other";
    other.label = "另一集合";
    model.work.members.push(domainOf(other));
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    rows.operations.query = operation(
      vi.fn(async () => {
        await pending;
        model.messages.push({
          id: "old-query-outcome",
          level,
          text: "旧集合结果",
          target: targeted ? rows : null,
        });
        if (level === "error") throw Error("stale callback failure");
      }),
    );
    wrapper = await render(model);
    await click("查询");
    route(other);
    await flushPromises();
    finish();
    await flushPromises();

    expect(document.body.textContent).toContain("另一集合");
    expect(document.body.textContent).not.toContain("旧集合结果");
    expect(document.querySelector('[role="alert"]')).toBeNull();
  },
);

it("updates row operations when eligibility or permission changes and keeps running actions guarded", async () => {
  const { model, record } = fixture();
  let complete!: () => void;
  const remove = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  record.operations.delete = operation(remove);
  const removeButton = () =>
    document.querySelector<HTMLButtonElement>('button[aria-label="删除"]');
  wrapper = await render(model);
  const previous = removeButton()!;
  record.operations.delete.disabled = true;
  previous.click();
  await flushPromises();
  expect(removeButton()).toBeNull();
  expect(remove).not.toHaveBeenCalled();

  record.operations.update!.disabled = true;
  await flushPromises();
  expect(removeButton()).toBeNull();
  expect(document.querySelector('button[aria-label="查看"]')).not.toBeNull();
  record.operations.delete.disabled = false;
  await flushPromises();
  expect(removeButton()?.disabled).toBe(false);
  await click("删除");
  expect(removeButton()?.disabled).toBe(true);
  await click("删除");
  expect(remove).toHaveBeenCalledTimes(1);
  complete();
  await flushPromises();
  expect(removeButton()?.disabled).toBe(false);
});

it("uses a fresh first-page query after failed conditions are edited", async () => {
  const { model, rows, term } = fixture();
  rows.total = 60;
  term.value = "original";
  const read = vi
    .fn(async () => {})
    .mockImplementationOnce(async () => {
      throw Error("read failed");
    })
    .mockImplementationOnce(async () => {
      expect(rows.page).toBe(1);
      expect(term.value).toBe("new conditions");
    });
  rows.operations.query = operation(read);
  wrapper = await render(model);
  await click("下一页");
  const retry = () =>
    wrapper!.findAll("button").some((b) => b.text() === "重试");
  expect(retry()).toBe(true);

  await input("条件").setValue("new conditions");
  await flushPromises();
  expect(retry()).toBe(false);
  await click("查询");
  expect(read).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

it("hides detail actions when a configured read is unavailable", async () => {
  const { model, record } = fixture();
  record.businessType = undefined;
  wrapper = await render(model);
  expect(document.querySelector('button[aria-label="编辑"]')).toBeNull();
  expect(document.querySelector("tbody")?.textContent).toContain("initial");
  record.businessType = "record";
  await flushPromises();
  expect(document.querySelector('button[aria-label="编辑"]')).not.toBeNull();
});

it.each(["standard", "voucher"] as const)(
  "keeps %s approval separate from edit eligibility",
  async (family) => {
    const { model, record } = fixture();
    record.family = family;
    delete record.operations.update;
    record.document = { operations: { approve: operation() } };
    wrapper = await render(model);
    const action = (key: string) =>
      document.querySelector(`[data-row-action="${key}"]`);
    expect(action("view")).not.toBeNull();
    expect(action("approve")).not.toBeNull();
    expect(action("edit")).toBeNull();
    record.operations.update = operation();
    await flushPromises();
    expect(action("edit")).not.toBeNull();
    record.operations.update.disabled = true;
    await flushPromises();
    expect(action("view")).not.toBeNull();
    expect(action("edit")).toBeNull();
  },
);

it("shows newly available approval inside an already open record", async () => {
  const { model, record } = fixture();
  delete record.operations.update;
  const approve = operation();
  approve.disabled = true;
  record.workflow = { operations: { approveChild: approve } };
  wrapper = await render(model);
  await click("查看");
  const detail = wrapper.get('[role="dialog"]');
  expect(detail.text()).not.toContain("批准子项");
  approve.disabled = false;
  await flushPromises();
  expect(detail.text()).toContain("批准子项");
  approve.disabled = true;
  await flushPromises();
  expect(detail.text()).not.toContain("批准子项");
});

it("locates a record message through the explicit navigation target", async () => {
  const { model, rows, record } = fixture();
  model.messages.push({
    id: "record-notice",
    level: "warning",
    text: "请查看记录",
    target: record,
  });
  wrapper = await render(model);
  const feedback = wrapper.get('[aria-label="页面消息"]');
  await feedback
    .findAll("button")
    .find((button) => button.text() === "查看")!
    .trigger("click");
  await flushPromises();
  expect(rows.selected).toBe(record);
  expect(window.location.pathname).toBe("/business/" + rows.key);
});

it("keeps a supplied collection blocker next to the query operation", async () => {
  const { model, rows } = fixture();
  rows.operations.query!.disabled = true;
  model.messages.push({
    id: "query-blocked",
    level: "warning",
    text: "需要先维护查询范围",
    target: rows,
  });
  wrapper = await render(model);
  const collection = wrapper.get('section[aria-label="记录集合"]');
  expect(collection.text()).toContain("需要先维护查询范围");
  expect(collection.find('button[aria-label="关闭警告提示"]').exists()).toBe(
    false,
  );
  expect(document.body.textContent?.split("需要先维护查询范围")).toHaveLength(
    2,
  );
});

it.each([false, true])(
  "preserves query recovery after acknowledging a blocking notice (disabled: %s)",
  async (disabled) => {
    const { model, rows } = fixture();
    const query = vi.fn(async () => {});
    rows.operations.query = operation(query);
    wrapper = await render(model);
    query.mockImplementationOnce(async () => {
      rows.operations.query!.disabled = disabled;
      model.messages.push(
        { id: "duplicate", level: "error", text: "查询受限", target: rows },
        {
          id: "blocked",
          level: "error",
          text: "请阅读查询限制",
          target: rows,
          blocking: true,
        },
      );
      throw Error("合成读取受限");
    });
    await click("查询");
    expect(
      document.querySelector('[role="alertdialog"]')?.textContent,
    ).toContain("请阅读查询限制");
    expect(document.body.textContent?.split("请阅读查询限制")).toHaveLength(2);
    await click("确定");
    expect(wrapper.get('[role="alert"]').text()).toContain("查询失败。");
    if (disabled) {
      expect(document.body.textContent).toContain("查询受限");
      expect(wrapper.text()).not.toContain("重试");
      return;
    }
    expect(document.body.textContent).not.toContain("查询受限");
    await click("重试");
    expect(query).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  },
);
