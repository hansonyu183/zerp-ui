<script setup lang="ts">
import { ref, shallowRef } from "vue";
import {
  CrudView,
  EditGuard,
  configurationBlock,
  defineCrud,
  type CrudViewHandle,
  type EditGuardHandle,
  type EditProtection,
} from "@zerp/ui";
import SettingsBlock from "./SettingsBlock.vue";
type Draft = { name: string; settings: { code: string; enabled: boolean } };
type Row = { id: string; name: string };
const visible = ref(false);
const row: Row = { id: "editable", name: "公开资料" };
const runtime = shallowRef<CrudViewHandle<Row> | null>(null),
  guard = shallowRef<EditGuardHandle | null>(null);
const protection = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "idle",
});
const adopted = shallowRef({ keyword: "" });
let saved: Draft = { name: row.name, settings: { code: "A", enabled: true } };
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
    empty: () => ({ name: "", settings: { code: "", enabled: false } }),
    query: async () => ({ items: [row], total: 1 }),
    get: async ({ identity }) => ({
      identity,
      values:
        identity === "history"
          ? { name: "", settings: { code: "历史代码", enabled: false } }
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
  configurationBlock<Draft>()({
    key: "settings",
    component: SettingsBlock,
    catalog: ["合成设置目录"] as readonly string[],
  }),
];
</script>
<template>
  <section aria-label="资料接缝示例">
    <button type="button" @click="visible = true">展示资料接缝</button>
    <template v-if="visible">
      <h2>有限入口与保护</h2>
      <button type="button" @click="runtime?.openRow(row, false)">
        公开打开编辑</button
      ><button
        type="button"
        @click="runtime?.openRow({ id: 'history', name: '历史资料' }, true)"
      >
        公开查看历史</button
      ><button type="button" @click="runtime?.close()">公开关闭资料</button
      ><EditGuard
        ref="guard"
        scope="public-session"
        instance="public-editor"
        active
        :dirty="protection.dirty"
        :local-pending="protection.localPending"
        :write-state="protection.writeState"
      /><!-- @vue-generic {Draft, {keyword:string}, Row, string} -->
      <CrudView
        ref="runtime"
        :definition="definition"
        :blocks="blocks"
        scope="public-session"
        :permissions="{ query: true, create: true, write: true }"
        :before-close="async () => (await guard?.requestLeave()) ?? false"
        @protection="protection = $event"
        @queried="adopted = $event"
      /><output aria-label="资料保护事实">{{
        JSON.stringify(protection)
      }}</output
      ><output aria-label="已采用资料条件">{{
        JSON.stringify(adopted)
      }}</output>
    </template>
  </section>
</template>
