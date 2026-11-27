import { route } from "./fixtures/static-host";
import { computed, nextTick, watch } from "vue";
import { expect, it, vi } from "vitest";
import { fixture, field, object, operation } from "./fixtures/static-model";

it("observes direct input and backend results while preserving record identity", async () => {
  const { rows, name, record } = fixture();
  rows.selected = record;
  const displayed = computed(() => name.value);
  name.value = "input";
  expect(displayed.value).toBe("input");
  let resolve!: (value: string) => void;
  const response = new Promise<string>((yes) => {
    resolve = yes;
  });
  record.operations.update = operation(
    vi.fn(async () => {
      expect(name.value).toBe("input");
      name.value = await response;
    }),
  );
  const pending = record.operations.update.run(record);
  resolve("backend");
  await pending;
  expect(displayed.value).toBe("backend");
  expect(rows.selected).toBe(record);
});
it("reacts to ordered members, explicit columns, operation state and session permissions", async () => {
  const { model, record, rows, owner } = fixture();
  const observed = vi.fn();
  const stop = watch(
    () => [
      record.members,
      rows.columns,
      rows.operations,
      model.session,
      model.work.members,
    ],
    observed,
    { deep: true },
  );
  let updates = 0;
  async function changed() {
    await nextTick();
    expect(observed).toHaveBeenCalledTimes(++updates);
  }
  try {
    record.members.push(field("extra", "额外字段"));
    await changed();
    record.members.reverse();
    await changed();
    rows.columns = [{ key: "extra", label: "新标题" }];
    await changed();
    rows.operations.query!.disabled = true;
    await changed();
    model.session = {
      state: "ready",
      owner,
    };
    await changed();
    model.session = { state: "anonymous", owner: null };
    await changed();
  } finally {
    stop();
  }
});
it("keeps query, page and new-record input across collection navigation", async () => {
  const { rows, term } = fixture();
  term.value = "unfinished";
  rows.page = 3;
  rows.draft = object("draft", "新增", [field("name", "名称", "new input")]);
  const draft = rows.draft;
  route(null);
  await nextTick();
  route(rows);
  await nextTick();
  expect(term.value).toBe("unfinished");
  expect(rows.page).toBe(3);
  expect(rows.draft).toBe(draft);
  expect(rows.operations.query!.run).not.toHaveBeenCalled();
});
