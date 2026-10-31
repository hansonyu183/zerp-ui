<script setup lang="ts">
import { ref, shallowRef } from "vue";
import {
  ConfigurationView,
  EditGuard,
  defineConfiguration,
  type ConfigurationViewHandle,
  type ConfigurationDraft,
  type EditProtection,
  type EditGuardHandle,
} from "@zerp/ui";
type Draft = { name: string };
type Row = { id: string; name: string };
type Identity = { id: string; revision: number };
const visible = ref(false),
  runtime = shallowRef<ConfigurationViewHandle<Row> | null>(null),
  guard = shallowRef<EditGuardHandle | null>(null);
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
</script>
<template>
  <section aria-label="配置接缝示例">
    <button type="button" @click="visible = true">展示配置接缝</button
    ><template v-if="visible"
      ><button type="button" @click="runtime?.newDraft()">公开新建配置</button
      ><button type="button" @click="runtime?.openRow(row)">公开打开配置</button
      ><button type="button" @click="runtime?.refresh()">公开刷新配置</button
      ><button type="button" @click="runtime?.close()">公开关闭配置</button
      ><EditGuard
        ref="guard"
        scope="configuration-contracts"
        instance="editor"
        active
        :dirty="protection.dirty"
        :local-pending="protection.localPending"
        :write-state="protection.writeState"
      /><!-- @vue-generic {Draft, {}, Row, Identity} -->
      <ConfigurationView
        ref="runtime"
        :definition="definition"
        scope="configuration-contracts"
        :initial-row="row"
        retain-editor
        :permissions="{ read: true, write: true }"
        :before-close="async () => (await guard?.requestLeave()) ?? false"
        @protection="protection = $event"
        @draft="draft = $event"
      /><output aria-label="配置保护事实">{{
        JSON.stringify(protection)
      }}</output
      ><output aria-label="配置草稿快照">{{
        JSON.stringify(draft)
      }}</output></template
    >
  </section>
</template>
