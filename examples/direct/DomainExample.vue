<script setup lang="ts">
import { ref, computed } from "vue";
import {
  CrudView,
  defineCrud,
  configurationBlock,
  type Attempt,
} from "@zerp/ui";
import NativeBlock from "./NativeBlock.vue";
type Draft = { native: { quantity: string } };
type Row = { id: string; name: string };
type Identity = { id: string; revision: number };
const readonly = ref(false),
  uncertain = ref(false),
  last = ref("");
const rows = new Map([
    ["one", { name: "合成物资", quantity: "0.10", revision: 1 }],
  ]),
  receipts = new Map<string, boolean>();
let sequence = 1;
async function save(attempt: Attempt<Draft, Identity>) {
  const id = attempt.identity?.id ?? "new-" + ++sequence;
  rows.set(id, {
    name: id === "one" ? "合成物资" : "新记录",
    quantity: attempt.input!.native.quantity,
    revision: (rows.get(id)?.revision ?? 0) + 1,
  });
  receipts.set(attempt.id, true);
  last.value = attempt.input!.native.quantity;
  return uncertain.value
    ? { status: "unknown" as const }
    : { status: "success" as const };
}
const definition = defineCrud<Draft, {}, Row, Identity, boolean>({
  resource: "synthetic-domain",
  title: "领域资料",
  fields: [],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "name", label: "名称" }],
  identity: (r) => ({ id: r.id, revision: rows.get(r.id)!.revision }),
  actions: () => ["view", "edit", "delete"],
  adapter: {
    query: async () => ({
      items: [...rows].map(([id, r]) => ({ id, name: r.name })),
      total: rows.size,
    }),
    empty: () => ({ native: { quantity: "" } }),
    get: async ({ identity }) => ({
      values: { native: { quantity: rows.get(identity.id)!.quantity } },
      identity,
      writable: !readonly.value,
    }),
    create: save,
    save,
    delete: async (a) => {
      rows.delete(a.identity!.id);
      return { status: "success" };
    },
  },
  reconcile: async (a) => ({
    status: receipts.has(a.id) ? "applied" : "not-applied",
    attemptId: a.id,
    evidence: true,
  }),
});
const blocks = [
  configurationBlock<Draft>()({
    key: "native",
    component: NativeBlock,
    catalog: { unit: "kg" },
  }),
];
const permissions = computed(() => ({
  query: true,
  create: !readonly.value,
  write: !readonly.value,
  reconcile: true,
}));
</script>
<template>
  <section aria-label="领域资料示例">
    <label><input v-model="readonly" type="checkbox" />仅查看</label
    ><label><input v-model="uncertain" type="checkbox" />模拟回复不确定</label
    ><CrudView
      :definition="definition"
      scope="synthetic-domain-session"
      :blocks="blocks"
      :permissions="permissions"
    />
    <p aria-label="最近保存数量">{{ last }}</p>
  </section>
</template>
