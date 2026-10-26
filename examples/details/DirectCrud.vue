<script setup lang="ts">
import { shallowRef } from "vue";
import { CrudView, defineCrud } from "@zerp/ui";
type Draft = { name: string };
type Identity = { id: string; baseline?: string };
const open = shallowRef<{ identity: Identity; readonly?: boolean }>();
const definition = defineCrud<Draft, {}, { id: string }, Identity>({
  resource: "direct-identity-example",
  title: "公共身份详情",
  fields: [{ key: "name", label: "详情名称", type: "text" }],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "id", label: "编号" }],
  identity: (r) => ({ id: r.id }),
  actions: () => ["view"],
  adapter: {
    query: async () => ({ items: [], total: 0 }),
    empty: () => ({ name: "" }),
    get: async ({ identity }) => ({
      identity: { ...identity, baseline: "authoritative-v1" },
      values: { name: "原生身份 " + identity.id },
    }),
    create: async () => ({ status: "failure" as const, message: "只读示例" }),
    save: async () => ({ status: "failure" as const, message: "只读示例" }),
  },
});
</script>
<template>
  <section aria-label="公共身份详情">
    <button
      type="button"
      @click="open = { identity: { id: 'direct-one' }, readonly: true }"
    >
      打开公共只读详情
    </button>
    <CrudView
      :definition="definition"
      scope="synthetic-direct"
      :permissions="{ query: true, create: false, write: false }"
      :open="open"
    />
  </section>
</template>
