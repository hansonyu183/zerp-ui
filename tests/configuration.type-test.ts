import {
  defineConfiguration,
  configurationBlock,
  type ConfigurationBlockProps,
  type ConfigurationAdapter,
} from "../src/index";
import { defineComponent } from "vue";
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
const TextBlock = defineComponent(
  (props: ConfigurationBlockProps<string, readonly string[]>) => () =>
    props.modelValue,
);
configurationBlock<Draft>()({
  key: "name",
  component: TextBlock,
  catalog: [] as readonly string[],
});
configurationBlock<Draft>()({
  key: "enabled",
  // @ts-expect-error string block cannot edit a boolean field
  component: TextBlock,
  catalog: [] as readonly string[],
});
configurationBlock<Draft>()({
  key: "name",
  component: TextBlock,
  // @ts-expect-error catalog must match the component contract
  catalog: 123,
});
const snapshot: import("../src/index").ConfigurationDraft<
  { nested: { label: string } },
  Identity
> = { values: { nested: { label: "snapshot" } } };
// @ts-expect-error draft snapshots are deeply readonly facts
snapshot.values.nested.label = "consumer must not own writes";
const entrances: import("../src/index").ConfigurationViewHandle<Draft> = {
  newDraft: async () => true,
  openRow: async () => true,
  close: async () => true,
  refresh: async () => {},
};
// @ts-expect-error finite handles do not expose arbitrary commands
entrances.execute("save");
