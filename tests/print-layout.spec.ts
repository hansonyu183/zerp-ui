import { afterEach, expect, it, vi } from "vitest";
import { layoutPrintTemplate } from "../src/components/printing/print-layout";
import type { ListCollection, PrintTemplate } from "../src/model";
const template: PrintTemplate = {
  label: "测试",
  page: { width: 80, height: 80, margin: 5 },
  header: { height: 0, items: [] },
  footer: { height: 0, items: [] },
  body: [
    {
      kind: "records",
      path: [],
      headerHeight: 5,
      rowHeight: 5,
      columns: [{ path: ["code"], label: "编号", width: 30, font: "cjk-sans" }],
    },
  ],
};
const source: ListCollection = {
  key: "rows",
  label: "测试",
  columns: [],
  conditions: {
    kind: "object",
    family: "standard",
    key: "conditions",
    label: "编号",
    identity: null,
    printable: false,
    readOnly: false,
    members: [],
    operations: {},
  },
  items: [],
  selected: null,
  draft: null,
  page: 1,
  pageSize: 20,
  total: 0,
  operations: {},
};
afterEach(() => {
  vi.restoreAllMocks();
});
it("removes the isolated measurement frame when cancelled before its load", async () => {
  const controller = new AbortController();
  const result = layoutPrintTemplate(
    template,
    source,
    () => true,
    controller.signal,
  );
  expect(document.querySelector('iframe[title="打印排版测量"]')).not.toBeNull();
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(document.querySelector("iframe")).toBeNull();
});
it("rejects unavailable controlled fonts and removes the frame", async () => {
  const result = layoutPrintTemplate(
    template,
    source,
    () => true,
    new AbortController().signal,
  );
  const frame = document.querySelector("iframe")!;
  Object.defineProperty(frame.contentDocument!, "fonts", {
    value: { load: async () => [], ready: Promise.resolve() },
  });
  frame.dispatchEvent(new Event("load"));
  await expect(result).rejects.toThrow("打印字体不可用");
  expect(document.querySelector("iframe")).toBeNull();
});
it("cancels a pending font load without waiting for its late completion", async () => {
  const controller = new AbortController();
  const result = layoutPrintTemplate(
    template,
    source,
    () => true,
    controller.signal,
  );
  let complete: (value: unknown[]) => void = () => {};
  const load = vi.fn(
    () =>
      new Promise<unknown[]>((resolve) => {
        complete = resolve;
      }),
  );
  const frame = document.querySelector("iframe")!;
  Object.defineProperty(frame.contentDocument!, "fonts", {
    value: { load, ready: Promise.resolve() },
  });
  frame.dispatchEvent(new Event("load"));
  await Promise.resolve();
  await Promise.resolve();
  expect(load).toHaveBeenCalled();
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(document.querySelector("iframe")).toBeNull();
  complete([{}]);
  await Promise.resolve();
  expect(document.querySelector("iframe")).toBeNull();
});
