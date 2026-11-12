import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, expect, it, vi } from "vitest";
import {
  AppPage,
  defineWorkbenchPage,
  defineWorkbenchPreferencesPage,
  type PageDefinition,
  type WorkbenchSnapshot,
  type WorkbenchPreference,
  type WorkbenchRequest,
} from "./fixtures/assembly";
const mounted: VueWrapper[] = [];
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()));
async function start(page: PageDefinition) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { template: "<span />" } }],
  });
  await router.push("/");
  await router.isReady();
  const w = mount(AppPage, {
    attachTo: document.body,
    props: {
      page,
      scope: "one",
      brand: {
        home: "/",
        productName: "合成",
        enterpriseName: "测试",
        mark: { kind: "text", text: "合" },
      },
      brandState: { kind: "ready" },
      navigation: [],
      navigationState: { kind: "ready" },
      footer: "合成",
    },
    global: { plugins: [router] },
  });
  mounted.push(w);
  await flushPromises();
  return w;
}
function snapshot(name = "单据"): WorkbenchSnapshot {
  return {
    vouchers: {
      description: "最近100天",
      items: Array.from({ length: 13 }, (_, i) => ({
        key: String(i),
        name: name + i,
        to: "/voucher/" + i,
      })),
    },
    reports: { items: [] },
    masters: { items: [] },
    information: [],
  };
}
function button(w: VueWrapper, text: string) {
  return w.findAll("button").find((b) => b.text() === text)!;
}
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
it("shows four simultaneous sections, normal links and independent twelve-item expansion", async () => {
  const w = await start(
    defineWorkbenchPage({
      title: "工作台",
      instance: "a",
      manageReportsTo: "/preferences",
      adapter: { load: async () => snapshot() },
    }),
  );
  for (const name of ["常用单据", "常用报表", "常用资料", "重要信息"])
    expect(w.find(`section[aria-label="${name}"]`).exists()).toBe(true);
  expect(
    Array.from(w.find(".zerp-workbench-grid").element.children).map((element) =>
      element.getAttribute("aria-label"),
    ),
  ).toEqual(["重要信息", "常用单据", "常用报表", "常用资料"]);
  expect(w.text()).toContain("暂无信息");
  expect(w.text()).not.toContain("单据12");
  expect(w.find('a[href="/voucher/0"]').text()).toBe("单据0");
  expect(w.find('a[href="/preferences"]').text()).toBe("管理常用报表");
  await button(w, "展开全部").trigger("click");
  expect(w.text()).toContain("单据12");
  await button(w, "收起").trigger("click");
  expect(w.text()).not.toContain("单据12");
});
it("retries failed home reads through the public page", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(Error("工作台读取失败"))
    .mockResolvedValue(snapshot());
  const w = await start(
    defineWorkbenchPage({ title: "工作台", instance: "a", adapter: { load } }),
  );
  expect(document.body.textContent).toContain("工作台读取失败");
  const retry = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "重试",
  )!;
  retry.click();
  await flushPromises();
  expect(w.text()).toContain("单据0");
  expect(load).toHaveBeenCalledTimes(2);
});
it("aborts and ignores late home results after scope change and unmount", async () => {
  const old = deferred<WorkbenchSnapshot>();
  let signal!: AbortSignal;
  const load = vi.fn(({ scope, signal: s }: WorkbenchRequest) => {
    if (scope === "one") {
      signal = s;
      return old.promise;
    }
    return Promise.resolve(snapshot("新单据"));
  });
  const w = await start(
    defineWorkbenchPage({ title: "工作台", instance: "a", adapter: { load } }),
  );
  await w.setProps({ scope: "two" });
  await flushPromises();
  expect(signal.aborted).toBe(true);
  old.resolve(snapshot("旧单据"));
  await flushPromises();
  expect(w.text()).toContain("新单据0");
  expect(w.text()).not.toContain("旧单据");
});
type Key = { kind: "report" | "ds"; id: string };
const candidate = (i = 0): WorkbenchPreference<Key> => ({
  id: "report:" + i,
  key: { kind: "report", id: String(i) },
  name: "报表" + i,
  added: false,
});
it("searches, paginates and updates a typed desired preference without losing search", async () => {
  let items = Array.from({ length: 52 }, (_, i) => candidate(i));
  const setAdded = vi.fn(
    async ({ key, added }: { key: Key; added: boolean }) => {
      items = items.map((item) =>
        item.key.id === key.id ? { ...item, added } : item,
      );
    },
  );
  const w = await start(
    defineWorkbenchPreferencesPage({
      title: "管理常用报表",
      instance: "a",
      adapter: { load: async () => items, setAdded },
    }),
  );
  expect(w.findAll(".zerp-preference-list li")).toHaveLength(50);
  await w.find("input").setValue("报表51");
  expect(w.findAll(".zerp-preference-list li")).toHaveLength(1);
  await button(w, "添加").trigger("click");
  await flushPromises();
  expect(setAdded.mock.calls[0][0]).toMatchObject({
    key: { kind: "report", id: "51" },
    added: true,
  });
  expect(w.find("input").element.value).toBe("报表51");
  expect(button(w, "移除").exists()).toBe(true);
});
it("blocks duplicate/opposite operations while unknown and retries exactly the original desired value", async () => {
  const write = deferred<void>();
  const setAdded = vi
    .fn()
    .mockImplementationOnce(() => write.promise)
    .mockResolvedValue(undefined);
  let added = false;
  const load = vi.fn(async () => [{ ...candidate(), added }]);
  const w = await start(
    defineWorkbenchPreferencesPage({
      title: "管理",
      instance: "a",
      adapter: { load, setAdded },
    }),
  );
  await button(w, "添加").trigger("click");
  expect(button(w, "添加").attributes("disabled")).toBeDefined();
  write.reject(Error("网络中断"));
  await flushPromises();
  expect(document.body.textContent).toContain("操作结果待核对");
  expect(button(w, "添加").attributes("disabled")).toBeDefined();
  await button(w, "核对结果").trigger("click");
  await flushPromises();
  expect(button(w, "添加").attributes("disabled")).toBeDefined();
  added = true;
  await button(w, "重试原操作").trigger("click");
  await flushPromises();
  expect(setAdded).toHaveBeenCalledTimes(2);
  expect(
    setAdded.mock.calls.map((call) => ({
      key: call[0].key,
      added: call[0].added,
    })),
  ).toEqual([
    { key: { kind: "report", id: "0" }, added: true },
    { key: { kind: "report", id: "0" }, added: true },
  ]);
  expect(button(w, "移除").attributes("disabled")).toBeUndefined();
});
it("authoritative matching read settles unknown; confirmed write plus read failure permits read retry only", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce([candidate()])
    .mockRejectedValueOnce(Error("重读失败"))
    .mockResolvedValue([{ ...candidate(), added: true }]);
  const setAdded = vi.fn(async () => {});
  const w = await start(
    defineWorkbenchPreferencesPage({
      title: "管理",
      instance: "a",
      adapter: { load, setAdded },
    }),
  );
  await button(w, "添加").trigger("click");
  await flushPromises();
  expect(document.body.textContent).toContain("操作已完成");
  expect(w.text()).not.toContain("重试原操作");
  await button(w, "核对结果").trigger("click");
  await flushPromises();
  expect(setAdded).toHaveBeenCalledTimes(1);
  expect(button(w, "移除").exists()).toBe(true);
});
it("settles an applied unknown preference by a matching authoritative read", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce([candidate()])
    .mockResolvedValue([{ ...candidate(), added: true }]);
  const setAdded = vi.fn(async () => {
    throw Error("回包丢失");
  });
  const w = await start(
    defineWorkbenchPreferencesPage({
      title: "管理",
      instance: "a",
      adapter: { load, setAdded },
    }),
  );
  await button(w, "添加").trigger("click");
  await flushPromises();
  await button(w, "核对结果").trigger("click");
  await flushPromises();
  expect(button(w, "移除").attributes("disabled")).toBeUndefined();
  expect(setAdded).toHaveBeenCalledTimes(1);
});
it("does not re-read or adopt an old preference write after scope changes", async () => {
  const old = deferred<void>();
  let signal!: AbortSignal;
  const setAdded = vi.fn(({ signal: s }: WorkbenchRequest) => {
    signal = s;
    return old.promise;
  });
  const load = vi.fn(async ({ scope }: WorkbenchRequest) => [
    { ...candidate(), name: scope },
  ]);
  const w = await start(
    defineWorkbenchPreferencesPage({
      title: "管理",
      instance: "a",
      adapter: { load, setAdded },
    }),
  );
  await button(w, "添加").trigger("click");
  await w.setProps({ scope: "two" });
  await flushPromises();
  expect(signal.aborted).toBe(true);
  old.resolve();
  await flushPromises();
  expect(w.text()).toContain("two");
  expect(load).toHaveBeenCalledTimes(2);
  expect(button(w, "添加").attributes("disabled")).toBeUndefined();
});
