import { expect, it, vi } from "vitest";
import type { BusinessModel, modelMetadata } from "@zerp/ui/model";

type Node = BusinessModel[string];
type ObjectNode = Extract<Node, { [modelMetadata]: { kind: "object" } }>;
type CollectionNode = Extract<
  Node,
  { [modelMetadata]: { kind: "collection" } }
>;
type TextField = Extract<Node, { value: string }>;
const field = (node: ObjectNode, key: string) => node[key] as TextField;

async function fixture() {
  vi.resetModules();
  const [{ exampleModel: model }, { modelMetadata: meta }, { computed }] =
    await Promise.all([
      import("../examples/model-contract/model"),
      import("@zerp/ui/model"),
      import("vue"),
    ]);
  const aggregate = model.directory as ObjectNode;
  return {
    model,
    meta: meta as typeof modelMetadata,
    computed,
    aggregate,
    customers: aggregate.customers as CollectionNode,
    history: aggregate.history as CollectionNode,
  } as const;
}

it("keeps selected and navigated records canonical across query, save and delete", async () => {
  const context = await fixture();
  const { model, customers } = context;
  const meta: typeof modelMetadata = context.meta;
  await customers[meta].operations.query!.run();
  const record = customers.items[0]!;
  const name = field(record, "name");
  customers.selected = record;
  model[meta].navigation.visit(record);

  await customers[meta].operations.query!.run();
  expect(customers.items[0]).toBe(record);
  expect(field(customers.items[0]!, "name")).toBe(name);
  expect(customers.selected).toBe(record);
  expect(model[meta].navigation.current).toBe(record);

  name.value = "合成修改";
  await record[meta].operations.update!.run();
  expect(customers.items.map((row) => field(row, "id").value)).toEqual([
    "C1",
    "C2",
  ]);

  await record[meta].operations.delete!.run();
  expect(customers.items.map((row) => field(row, "id").value)).toEqual(["C2"]);
  expect(customers.selected).toBeNull();
  expect(model[meta].navigation.current).toBe(customers);
  await customers[meta].operations.query!.run();
  expect(customers.items.map((row) => field(row, "id").value)).toEqual(["C2"]);
});

it("retains model inputs on navigation and reuses the same reactive record across pages", async () => {
  const context = await fixture();
  const { model, aggregate, customers, computed } = context;
  const meta: typeof modelMetadata = context.meta;
  customers.pageSize = 1;
  await customers[meta].operations.query!.run();
  const record = customers.items[0]!;
  const name = field(record, "name");
  const displayedName = computed(() => name.value);
  customers.selected = record;
  model[meta].navigation.visit(record);
  name.value = "尚未保存";
  model[meta].navigation.visit(aggregate);
  model[meta].navigation.visit(record);
  expect(displayedName.value).toBe("尚未保存");

  customers.page = 2;
  await customers[meta].operations.query!.run();
  expect(field(customers.items[0]!, "id").value).toBe("C2");
  expect(customers.selected).toBe(record);
  expect(name.value).toBe("尚未保存");

  customers.page = 1;
  await customers[meta].operations.query!.run();
  expect(customers.items[0]).toBe(record);
  expect(field(record, "name")).toBe(name);
  // Explicit query adopts the backend value on the same reactive field.
  expect(displayedName.value).toBe("合成客户甲");
  expect(model[meta].navigation.current).toBe(record);
});

it("keeps a saved new record and queried history nodes stable", async () => {
  const context = await fixture();
  const { customers, history } = context;
  const meta: typeof modelMetadata = context.meta;
  await customers[meta].operations.create!.run();
  const draft = customers.draft!;
  const name = field(draft, "name");
  name.value = "合成新增";
  await draft[meta].operations.update!.run();
  const id = field(draft, "id").value;
  expect(customers.draft).toBeNull();

  await customers[meta].operations.query!.run();
  expect(customers.items.find((row) => field(row, "id").value === id)).toBe(
    draft,
  );
  expect(field(draft, "name")).toBe(name);

  await history[meta].operations.query!.run();
  const entry = history.items[0]!;
  const text = field(entry, "text");
  history.selected = entry;
  await history[meta].operations.query!.run();
  expect(history.items[0]).toBe(entry);
  expect(field(entry, "text")).toBe(text);
  expect(history.selected).toBe(entry);
});
