import { afterEach, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { fixture, operation } from "./fixtures/static-model";
import { render } from "./fixtures/static-host";
let wrapper: Awaited<ReturnType<typeof render>> | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});
it("declares the operation column for an empty public collection", async () => {
  const f = fixture();
  f.rows.items = [];
  wrapper = await render(f.model);
  expect(wrapper.findAll("th").map((n) => n.text())).toContain("操作");
});
it("keeps first-read status separate from an empty result and its pagination", async () => {
  const f = fixture();
  f.rows.items = [];
  let complete!: () => void;
  f.rows.operations.query = operation(
    vi.fn(async () => {
      await new Promise<void>((r) => {
        complete = r;
      });
    }),
  );
  wrapper = await render(f.model);
  expect(wrapper.text()).toContain("正在读取");
  expect(wrapper.find('nav[aria-label="分页"]').exists()).toBe(false);
  expect(wrapper.text()).not.toContain("暂无记录");
  complete();
  await flushPromises();
  expect(wrapper.find('nav[aria-label="分页"]').exists()).toBe(false);
  expect(wrapper.text()).toContain("暂无记录");
});
it("restores focus to the same record after async detail changes edit into view", async () => {
  const f = fixture();
  let complete!: () => void;
  f.record.operations.get = operation(
    vi.fn(async () => {
      await new Promise<void>((r) => {
        complete = r;
      });
      f.record.readOnly = true;
    }),
  );
  wrapper = await render(f.model);
  const edit = wrapper.get('button[aria-label="编辑"]');
  (edit.element as HTMLElement).focus();
  await edit.trigger("click");
  await flushPromises();
  complete();
  await flushPromises();
  expect(wrapper.find('button[aria-label="查看"]').exists()).toBe(true);
  const close = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ).find((b) => b.textContent?.trim() === "关闭")!;
  close.click();
  await flushPromises();
  expect(document.activeElement?.getAttribute("aria-label")).toBe("查看");
  expect(
    document.activeElement
      ?.closest("[data-record-key]")
      ?.getAttribute("data-record-key"),
  ).toBe(f.record.identity);
});

it("restores the disabled hint while detail is still reading, then its available button", async () => {
  const f = fixture();
  let complete!: () => void;
  f.record.operations.get = operation(
    vi.fn(async () => {
      f.record.readOnly = true;
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      f.record.readOnly = false;
    }),
  );
  wrapper = await render(f.model);
  const edit = wrapper.get('button[aria-label="编辑"]');
  (edit.element as HTMLElement).focus();
  await edit.trigger("click");
  await flushPromises();
  const close = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ).find((button) => button.textContent?.trim() === "关闭")!;
  close.click();
  await flushPromises();
  expect(document.activeElement?.getAttribute("data-row-action-hint")).toBe(
    "view",
  );
  expect(
    document.activeElement
      ?.closest("[data-record-key]")
      ?.getAttribute("data-record-key"),
  ).toBe(f.record.identity);
  complete();
  await flushPromises();
  expect(document.activeElement?.getAttribute("aria-label")).toBe("编辑");
});

it("does not reclaim focus after the user moves away from the pending detail hint", async () => {
  const f = fixture();
  let complete!: () => void;
  f.record.operations.get = operation(
    vi.fn(async () => {
      f.record.readOnly = true;
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      f.record.readOnly = false;
    }),
  );
  wrapper = await render(f.model);
  const edit = wrapper.get('button[aria-label="编辑"]');
  (edit.element as HTMLElement).focus();
  await edit.trigger("click");
  await flushPromises();
  Array.from(
    document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  )
    .find((button) => button.textContent?.trim() === "关闭")!
    .click();
  await flushPromises();
  const query = wrapper
    .findAll("button")
    .find((button) => button.text() === "查询")!;
  (query.element as HTMLElement).focus();
  complete();
  await flushPromises();
  expect(document.activeElement).toBe(query.element);
});
