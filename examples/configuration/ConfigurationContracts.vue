<script setup lang="ts">
import { shallowRef } from "vue";
import ExamplePage from "../shared/ExamplePage.vue";
import {
  defineConfigurationPage,
  defineConfiguration,
  type ConfigurationDraft,
  type EditProtection,
} from "@zerp/ui";
type Draft = { name: string };
type Row = { id: string; name: string };
type Identity = { id: string; revision: number };
const protection = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "idle",
});
const draft = shallowRef<ConfigurationDraft<Draft, Identity> | null>(null);
let revision = 1,
  values: Draft = { name: "初始配置" };
const identity = () => ({ id: "authoritative-config", revision });
const row: Row = { id: "authoritative-config", name: "配置" };
const definition = defineConfiguration<Draft, {}, Row, Identity>({
  resource: "configuration-entrances",
  title: "配置公开接缝",
  fields: [{ key: "name", label: "接缝配置名", type: "text", required: true }],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "name", label: "配置名" }],
  identity: (r) => ({ id: r.id, revision }),
  adapter: {
    empty: () => ({ name: "" }),
    query: async () => ({ items: [{ ...row, name: values.name }], total: 1 }),
    get: async () => ({
      values: structuredClone(values),
      identity: identity(),
    }),
    save: async (a) => {
      values = structuredClone(a.input);
      revision++;
      return { status: "success", identity: identity() };
    },
  },
});
const page = defineConfigurationPage(() => ({
  definition,
  initialRow: row,
  retainEditor: true,
  permissions: { read: true, write: true },
  onProtection: (value: EditProtection) => (protection.value = value),
  onDraft: (value: ConfigurationDraft<Draft, Identity> | null) =>
    (draft.value = value),
}));
</script>
<template>
  <section aria-label="配置接缝示例">
    <ExamplePage :page="page" scope="configuration-contracts" />
    <output aria-label="配置保护事实">{{ JSON.stringify(protection) }}</output
    ><output aria-label="配置草稿快照">{{ JSON.stringify(draft) }}</output>
  </section>
</template>
