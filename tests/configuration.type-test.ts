import { defineConfiguration, type ConfigurationAdapter } from "../src/index";
type Draft = { name: string; enabled: boolean };
type Identity = { key: string; revision: string };
const adapter: ConfigurationAdapter<Draft, {}, Draft, Identity> = {
  query: async () => ({ items: [], total: 0 }),
  get: async () => ({
    values: { name: "", enabled: false },
    identity: { key: "x", revision: "opaque" },
  }),
  save: async (a) => {
    const revision: string | undefined = a.identity?.revision;
    void revision;
    return { status: "success" };
  },
};
const valid = defineConfiguration<Draft, {}, Draft, Identity>({
  resource: "x",
  title: "x",
  fields: [{ key: "enabled", label: "启用", type: "boolean" }],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "name", label: "名称" }],
  identity: () => ({ key: "x", revision: "opaque" }),
  adapter,
});
defineConfiguration<Draft, {}, Draft, Identity>({
  ...valid,
  fields: [
    // @ts-expect-error boolean fields cannot become decimal strings
    { key: "enabled", label: "bad", type: "decimal" },
  ],
});
defineConfiguration<Draft, {}, Draft, number>({
  ...valid,
  // @ts-expect-error identity is not interchangeable with a numeric id
  adapter,
});
const snapshot: import("../src/index").ConfigurationDraft<
  { nested: { label: string } },
  Identity
> = { values: { nested: { label: "snapshot" } } };
// @ts-expect-error draft snapshots are deeply readonly facts
snapshot.values.nested.label = "consumer must not own writes";
declare const entrance: import("../src/index").AppPageHandle;
const leave: Promise<boolean> = entrance.requestLeave();
// @ts-expect-error Complete pages expose no arbitrary runtime command.
entrance.execute("save");
void leave;
