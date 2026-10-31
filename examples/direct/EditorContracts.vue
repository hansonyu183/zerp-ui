<script setup lang="ts">
import { ref, shallowRef } from "vue";
import {
  defineCrudPage,
  domainBlocks,
  defineCrud,
  type AppPageHandle,
  type EditProtection,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
type Draft = {
  name: string;
  settings: { code: number | null; enabled: boolean };
};
type Row = { id: string; name: string };
const row: Row = { id: "editable", name: "公开资料" };
const host = shallowRef<AppPageHandle>();
const target = shallowRef<Row>();
const readOnly = ref(false);
const protection = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "idle",
});
const adopted = shallowRef({ keyword: "" });
let saved: Draft = { name: row.name, settings: { code: 1, enabled: true } };
const definition = defineCrud<Draft, { keyword: string }, Row, string>({
  resource: "public-editor",
  title: "资料公开接缝",
  fields: [{ key: "name", type: "text", label: "资料名称", required: true }],
  filters: [{ key: "keyword", type: "text", label: "接缝筛选" }],
  initialFilters: () => ({ keyword: "" }),
  columns: [{ key: "name", label: "资料名称" }],
  identity: (r) => r.id,
  actions: () => ["view", "edit"],
  viewLabel: (r) => `查看 ${r.name}`,
  adapter: {
    empty: () => ({ name: "", settings: { code: null, enabled: false } }),
    query: async () => ({ items: [row], total: 1 }),
    get: async ({ identity }) => ({
      identity,
      values:
        identity === "history"
          ? { name: "", settings: { code: 2, enabled: false } }
          : structuredClone(saved),
      writable: identity !== "history",
    }),
    create: async () => ({ status: "success" }),
    save: async (a) => {
      saved = structuredClone(a.input!);
      return { status: "success" };
    },
  },
});
const blocks = [
  domainBlocks<Draft>().fields({
    key: "settings",
    label: "资料设置区块",
    fields: [
      { key: "code", label: "设置代码", type: "integer", required: true },
      { key: "enabled", label: "设置启用", type: "boolean" },
    ],
  }),
];
const page = defineCrudPage(() => ({
  definition,
  blocks,
  permissions: { query: true, create: true, write: true },
  initialRow: target.value,
  readOnly: readOnly.value,
  onProtection: (value: EditProtection) => (protection.value = value),
  onQueried: (value: { keyword: string }) => (adopted.value = value),
}));
async function open(history = false) {
  if (host.value && !(await host.value.requestLeave())) return;
  target.value = history ? { id: "history", name: "历史资料" } : row;
  readOnly.value = history;
}
</script>
<template>
  <section aria-label="资料接缝示例">
    <ExamplePage ref="host" :page="page" scope="public-session" />
    <aside class="example-controls">
      <button @click="open()">打开资料接缝</button
      ><button @click="open(true)">查看历史资料接缝</button>
      <output aria-label="资料保护事实">{{
        JSON.stringify(protection)
      }}</output>
      <output aria-label="已采用资料条件">{{ JSON.stringify(adopted) }}</output>
    </aside>
  </section>
</template>
