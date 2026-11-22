import { flushPromises } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { fixture, operation } from "./fixtures/static-model";
import { render, click, input } from "./fixtures/static-host";
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
it("keeps null-label values available for explicit column references", async () => {
  const { model, name } = fixture();
  name.label = null;
  wrapper = await render(model);
  expect(document.querySelector("table")?.textContent).toContain("initial");
  await click("编辑");
  expect(document.querySelector('input[aria-label="名称"]')).toBeNull();
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

it("updates row operations when eligibility or permission changes and keeps running actions guarded", async () => {
  const { model, rows, record, owner } = fixture();
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

  record.operations.delete.disabled = false;
  model.session.userPermissions = {
    owner,
    administrator: false,
    grants: [
      { node: rows, read: true, write: true, operations: { query: true } },
    ],
  };
  await flushPromises();
  expect(removeButton()).toBeNull();
  expect(document.querySelector('button[aria-label="查看"]')).not.toBeNull();
  if (!model.session.userPermissions.administrator)
    model.session.userPermissions.grants[0]!.operations.delete = true;
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
