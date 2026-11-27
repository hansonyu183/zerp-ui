import { ref, defineComponent, h } from "vue";
import { mount, flushPromises, DOMWrapper } from "@vue/test-utils";
import { it, expect, vi } from "vitest";
import type {
  ReferenceAdapter,
  ReferenceValue,
} from "../src/components/forms/reference-directory";
import ReferencePicker from "../src/components/forms/ReferencePicker.vue";

const click = async (w: DOMWrapper<Element>, text: string) => {
  await w
    .findAll("button")
    .find((b) => b.text() === text)!
    .trigger("click");
  await flushPromises();
};
it("keeps historical snapshots and toggles multiple values in the same dropdown", async () => {
  const selected: ReferenceValue = {
    id: "old",
    label: "历史采用名",
    snapshot: { revision: "old" },
    selectable: false,
  };
  const adapter: ReferenceAdapter = {
    directory: {},
    load: vi.fn(async () => [
      { id: "new", label: "新候选" },
      { id: "old", label: "当前新名", selectable: false },
    ]),
  };
  const value = ref<readonly ReferenceValue[]>([selected]);
  const w = mount(
    defineComponent({
      setup: () => () =>
        h(ReferencePicker, {
          adapter,
          modelValue: value.value,
          scope: "a",
          label: "引用",
          multiple: true,
          "onUpdate:modelValue": (next) =>
            (value.value = next as readonly ReferenceValue[]),
        }),
    }),
    { attachTo: document.body },
  );
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  expect(document.body.textContent).toContain("历史采用名");
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.includes("新候选"))!;
  option.click();
  await flushPromises();
  expect(value.value).toEqual([selected, { id: "new", label: "新候选" }]);
  option.click();
  await flushPromises();
  expect(value.value).toEqual([selected]);
  w.unmount();
});
it("retries a failed complete directory without losing historical selections", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("读取候选失败"))
    .mockResolvedValue([{ id: "new", label: "新候选" }]);
  const w = mount(ReferencePicker, {
    attachTo: document.body,
    props: {
      adapter: { directory: {}, load },
      modelValue: { id: "old", label: "历史" },
      scope: "a",
      label: "引用",
    },
  });
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  expect(document.body.textContent).toContain("读取候选失败");
  expect(document.body.textContent).toContain("历史");
  await w.get('button[aria-label="引用错误详情"]').trigger("click");
  await flushPromises();
  await click(new DOMWrapper(document.body), "重试引用");
  expect(document.body.textContent).toContain("新候选");
  expect(w.props("modelValue")).toEqual({ id: "old", label: "历史" });
  expect(load).toHaveBeenCalledTimes(2);
  w.unmount();
});
it("ignores a late directory after owner change and does not preload unused fields", async () => {
  let finish!: (v: readonly ReferenceValue[]) => void;
  const load = vi
    .fn()
    .mockImplementationOnce(() => new Promise((r) => (finish = r)))
    .mockResolvedValue([{ id: "new", label: "新作用域候选" }]);
  const w = mount(ReferencePicker, {
    attachTo: document.body,
    props: {
      adapter: { directory: {}, load },
      modelValue: null,
      scope: "a",
      label: "引用",
    },
  });
  await flushPromises();
  expect(load).not.toHaveBeenCalled();
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  await w.setProps({ scope: "b" });
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  finish([{ id: "old", label: "旧候选" }]);
  await flushPromises();
  expect(document.body.textContent).toContain("新作用域候选");
  expect(document.body.textContent).not.toContain("旧候选");
  w.unmount();
});
it("paginates a complete local directory and prevents unavailable choices", async () => {
  const load = vi.fn(async () => [
    { id: "blocked", label: "禁止选择", selectable: false },
    ...Array.from({ length: 44 }, (_, i) => ({
      id: String(i),
      label: `候选${i}`,
    })),
  ]);
  const w = mount(ReferencePicker, {
    attachTo: document.body,
    props: {
      adapter: { directory: {}, load },
      modelValue: null,
      scope: "a",
      label: "引用",
    },
  });
  await w.get('input[aria-label="引用"]').trigger("click");
  await flushPromises();
  const blocked = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.includes("禁止选择"))!;
  blocked.click();
  await flushPromises();
  expect(w.emitted("update:modelValue")).toBeUndefined();
  await click(new DOMWrapper(document.body), "下一页引用");
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((item) => item.textContent?.trim() === "候选20")!;
  option.click();
  await flushPromises();
  expect(w.emitted("update:modelValue")?.[0]?.[0]).toMatchObject({
    id: "20",
    label: "候选20",
  });
  expect(load).toHaveBeenCalledOnce();
  w.unmount();
});
