import { DOMWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { type EditWriteState } from "../src/index";
import EditGuard from "../src/EditGuard.vue";
import type { EditGuardHandle } from "../src/edit-guard";
function host() {
  const dirty = ref(false),
    localPending = ref(false),
    active = ref(true),
    state = ref<EditWriteState>("idle"),
    scope = ref("one"),
    instance = ref("record-one");
  let guard: EditGuardHandle | null = null;
  const departures: boolean[] = [];
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h("main", [
          h(
            "button",
            {
              onClick: async () => departures.push(await guard!.requestLeave()),
            },
            "离开",
          ),
          h(
            EditGuard,
            {
              ref: (value) => {
                guard = value as unknown as EditGuardHandle;
              },
              dirty: dirty.value,
              localPending: localPending.value,
              active: active.value,
              writeState: state.value,
              scope: scope.value,
              instance: instance.value,
              onDiscard: () => {
                dirty.value = false;
                localPending.value = false;
              },
            },
            { default: () => h("p", "敏感本地草稿") },
          ),
        ]),
    }),
    { attachTo: document.body },
  );
  return {
    wrapper,
    dirty,
    localPending,
    active,
    state,
    scope,
    instance,
    departures,
  };
}
async function click(wrapper: ReturnType<typeof mount>, text: string) {
  await flushPromises();
  await wrapper
    .findAll("button")
    .concat(
      Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
      ).map((el) => new DOMWrapper(el)),
    )
    .find((button) => button.text() === text)!
    .trigger("click");
  await flushPromises();
}
it("leaves clean input, continues editing, then discards only the local draft", async () => {
  const hostState = host();
  const { wrapper, dirty, departures } = hostState;
  await click(wrapper, "离开");
  expect(departures).toEqual([true]);
  dirty.value = true;
  await click(wrapper, "离开");
  expect(new DOMWrapper(document.body).get('[role="dialog"]').text()).toContain(
    "放弃本地修改",
  );
  expect(document.activeElement?.textContent?.trim()).toBe("继续编辑");
  await click(wrapper, "继续编辑");
  expect(departures).toEqual([true, false]);
  expect(dirty.value).toBe(true);
  await click(wrapper, "离开");
  await click(wrapper, "放弃本地修改");
  expect(dirty.value).toBe(false);
  expect(departures).toEqual([true, false, true]);
  wrapper.unmount();
});
it("keeps pending and unknown writes locked even when the local draft is clean", async () => {
  const { wrapper, state, departures } = host();
  state.value = "pending";
  await click(wrapper, "离开");
  expect(wrapper.text()).toContain("写入进行中");
  state.value = "unknown";
  await click(wrapper, "离开");
  expect(wrapper.text()).toContain("写入结果未知");
  expect(new DOMWrapper(document.body).find('[role="dialog"]').exists()).toBe(
    false,
  );
  expect(departures).toEqual([false, false]);
  wrapper.unmount();
});
it.each(["scope", "instance", "active", "state", "unmount"] as const)(
  "invalidates a pending confirmation on %s and rejects detached late choices",
  async (change) => {
    const context = host();
    context.dirty.value = true;
    await click(context.wrapper, "离开");
    const discard = context.wrapper
      .findAll("button")
      .concat(
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[role="dialog"] button',
          ),
        ).map((el) => new DOMWrapper(el)),
      )
      .find((b) => b.text() === "放弃本地修改")!;
    if (change === "unmount") context.wrapper.unmount();
    else if (change === "active") context.active.value = false;
    else if (change === "state") context.state.value = "unknown";
    else context[change].value = "two";
    await flushPromises();
    await discard.trigger("click");
    expect(context.departures).toEqual([false]);
    expect(context.dirty.value).toBe(true);
    if (change === "active")
      expect(context.wrapper.text()).not.toContain("敏感本地草稿");
    if (change !== "unmount") context.wrapper.unmount();
  },
);

it("protects unfinished local input independently of dirty and identifies known outcomes awaiting refresh", async () => {
  const { wrapper, localPending, state, departures } = host();
  localPending.value = true;
  await click(wrapper, "离开");
  expect(new DOMWrapper(document.body).find('[role="dialog"]').exists()).toBe(
    true,
  );
  await click(wrapper, "放弃本地修改");
  expect(departures).toEqual([true]);
  state.value = "refresh";
  await click(wrapper, "离开");
  expect(departures).toEqual([true, false]);
  expect(wrapper.text()).toContain("写入结果已确认，等待读取最新数据");
  expect(wrapper.text()).not.toContain("写入结果未知");
  wrapper.unmount();
});

it.each([
  ["seal", "已确认未应用"],
  ["blocked", "原请求恢复尚未确认"],
] as const)(
  "blocks leave with accurate %s recovery wording",
  async (value, message) => {
    const { wrapper: w, state, departures } = host();
    state.value = value;
    await click(w, "离开");
    expect(departures).toEqual([false]);
    expect(w.get('[role="status"]').text()).toContain(message);
    expect(w.text()).not.toContain("写入结果未知");
    w.unmount();
  },
);
