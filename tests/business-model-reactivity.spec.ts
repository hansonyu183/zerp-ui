import { computed, nextTick, reactive, watch } from "vue";
import { expect, it, vi } from "vitest";
import { modelMetadata as meta, type BusinessModel } from "../src/model";

type ObjectNode = Extract<
  BusinessModel[string],
  { [meta]: { kind: "object" } }
>;
type CollectionNode = Extract<
  BusinessModel[string],
  { [meta]: { kind: "collection" } }
>;

// Contract fixture only: the type example stays compile-only, and the new
// BusinessApplication host is not yet implemented.
function fixture() {
  const record: ObjectNode = reactive({
    value: { value: "initial", [meta]: { kind: "text", name: "Value" } },
    [meta]: {
      kind: "object",
      name: "Record",
      identity: "r1",
      form: ["value"],
      operations: {
        update: { disabledReason: "", run: vi.fn(async () => {}) },
      },
    },
  });
  const rows: CollectionNode = reactive({
    items: [record],
    selected: record,
    draft: null,
    query: {
      term: { value: "", [meta]: { kind: "text", name: "Term" } },
      [meta]: { kind: "object", name: "Query", operations: {} },
    },
    page: 1,
    pageSize: 20,
    total: 1,
    [meta]: {
      kind: "collection",
      name: "Rows",
      element: record,
      list: ["value"],
      operations: { query: { run: vi.fn(async () => {}) } },
    },
  });
  const group: ObjectNode = reactive({
    rows,
    [meta]: { kind: "object", name: "Group", form: ["rows"], operations: {} },
  });
  // Widen nullable and permission slots through the public contract.
  const model: BusinessModel = reactive({
    group,
    [meta]: {
      kind: "application",
      name: "Contract test",
      brand: { productName: "Test", companyName: "Test" },
      owner: null,
      userPermissions: null,
      navigation: { current: group, href: () => "/", visit: vi.fn() },
      navigationProjection: [
        { key: "test", name: "Test", items: [{ node: group }] },
      ],
      messages: [],
    },
  });
  return { model, group, rows };
}

it("observes direct input and backend field results without replacing referenced records", async () => {
  const { model, rows } = fixture();
  const record = rows.items[0]!;
  const field = record.value;
  if (!("value" in field)) throw new Error("Expected field");
  const displayed = computed(() => field.value);
  expect(displayed.value).toBe("initial");
  field.value = "input";
  expect(displayed.value).toBe("input");

  let resolveResponse!: (value: string) => void;
  const response = new Promise<string>((resolve) => {
    resolveResponse = resolve;
  });
  const save = vi.fn(async () => {
    expect(field.value).toBe("input");
    field.value = await response;
  });
  record[meta].operations.update = { run: save };
  const pending = record[meta].operations.update.run();
  resolveResponse("backend");
  await pending;
  expect(displayed.value).toBe("backend");
  expect(rows.selected).toBe(record);
  expect(rows[meta].element).toBe(record);
  expect(model[meta].navigationProjection[0]!.items[0]!.node).toBe(model.group);
});

it("reacts to symbol metadata, structural projections and permission snapshot changes", async () => {
  const { model, group, rows } = fixture();
  const observed = vi.fn();
  const stop = watch(
    () => [
      group[meta],
      Object.keys(group),
      rows[meta],
      model[meta].navigationProjection,
      model[meta].userPermissions,
    ],
    observed,
    { deep: true },
  );
  let updates = 0;
  async function expectUpdate() {
    await nextTick();
    expect(observed).toHaveBeenCalledTimes(++updates);
  }
  try {
    group.extra = {
      value: true,
      [meta]: { kind: "boolean", name: "Extra", readOnly: true },
    };
    await expectUpdate();
    group[meta].form = ["extra", "rows"];
    await expectUpdate();
    rows[meta].name = "Renamed";
    await expectUpdate();
    rows[meta].list = [];
    await expectUpdate();
    rows[meta].operations.query!.disabledReason = "Unavailable";
    await expectUpdate();
    model[meta].navigationProjection[0]!.name = "Changed";
    await expectUpdate();
    const owner = { ledger: "test", operator: "test", generation: "1" };
    model[meta].owner = owner;
    model[meta].userPermissions = {
      owner,
      administrator: false,
      grants: [{ node: rows, read: true, operations: { query: false } }],
    };
    await expectUpdate();
    expect(model[meta].userPermissions.grants[0]!.node).toBe(rows);

    delete group.extra;
    await expectUpdate();
    group[meta].form = ["rows"];
    await expectUpdate();
    model[meta].userPermissions = null;
    await expectUpdate();
  } finally {
    stop();
  }
});

it("retains query, page, selection and new-record input across navigation changes", async () => {
  const { model, group, rows } = fixture();
  const term = rows.query.term;
  if (!("value" in term)) throw new Error("Expected query field");
  term.value = "unfinished query";
  rows.page = 3;
  rows.draft = {
    value: {
      value: "unfinished new record",
      [meta]: { kind: "text", name: "Value" },
    },
    [meta]: { kind: "object", name: "New", operations: {} },
  };
  const { selected, draft } = rows;
  model[meta].navigation.current = rows;
  await nextTick();
  model[meta].navigation.current = group;
  await nextTick();
  expect(model[meta].navigation.current).toBe(group);
  expect(term.value).toBe("unfinished query");
  expect(rows.page).toBe(3);
  expect(rows.selected).toBe(selected);
  expect(rows.draft).toBe(draft);
  expect(rows.draft!.value).toMatchObject({ value: "unfinished new record" });
  expect(rows[meta].operations.query!.run).not.toHaveBeenCalled();
  expect(rows.items[0]![meta].operations.update!.run).not.toHaveBeenCalled();
});
