<script setup lang="ts">
import { shallowRef, ref } from "vue";
import { defineCrud, defineCrudPage } from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import EditorContracts from "./EditorContracts.vue";
import IndependentForm from "./IndependentForm.vue";
import { exampleDefinition, resourceCases } from "./matrix";
const selected = shallowRef(
  resourceCases[0][0] as (typeof resourceCases)[number][0],
);
const mode = ref("resources");
const definitions = new Map(
  resourceCases.map((item) => [item[0], exampleDefinition(item[0])]),
);
const page = defineCrudPage(() => ({
  definition: definitions.get(selected.value)!,
  permissions: { query: true, create: true, write: true },
}));
const selectedRows = ref<(string | number)[]>([]),
  lastAction = ref("");
const row = { id: "row-actions", name: "合成客户" };
const listDefinition = defineCrud({
  resource: "synthetic-actions",
  title: "行操作示例",
  fields: [{ key: "name", label: "名称", type: "text" }],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "name", label: "名称" }],
  identity: (value: typeof row) => value.id,
  actions: () => ["view", "edit", "delete"],
  adapter: {
    empty: () => ({ name: "" }),
    query: async () => ({ items: [row], total: 1 }),
    get: async () => ({ values: { name: row.name }, identity: row.id }),
    create: async () => ({ status: "success" }),
    save: async () => ({ status: "success" }),
    delete: async () => {
      lastAction.value = "delete:row-actions";
      return { status: "success" };
    },
  },
});
const listPage = defineCrudPage(() => ({
  definition: listDefinition,
  permissions: { query: true, create: false, write: true },
  selection: {
    rowKey: (value: typeof row) => value.id,
    selectedKeys: selectedRows.value,
    onChange: (keys: (string | number)[]) => (selectedRows.value = keys),
  },
  listActions: () => ["withdraw", "complete", "uncomplete"],
  onListAction: (action: string, value: typeof row) =>
    (lastAction.value = action + ":" + value.id),
}));
</script>
<template>
  <section v-if="mode === 'resources'" aria-label="资料示例">
    <ExamplePage :page="page" />
  </section>
  <IndependentForm v-else-if="mode === 'form'" />
  <EditorContracts v-else-if="mode === 'contracts'" />
  <section v-else aria-label="行操作示例">
    <ExamplePage :page="listPage" />
    <p role="status">{{ lastAction }}</p>
    <output aria-label="已选记录">{{ selectedRows.join(",") }}</output>
  </section>
  <aside class="example-controls" aria-label="合成资料控制">
    <p>独立安装消费者：仅合成数据与模拟 Adapter，不连接 ZERP API。</p>
    <label
      >资料演示<select v-model="mode" aria-label="资料演示">
        <option value="resources">业务资料</option>
        <option value="form">账户资料字段验证</option>
        <option value="contracts">资料编辑与保护</option>
        <option value="actions">列表操作</option>
      </select></label
    ><label
      >资源<select v-model="selected" aria-label="资源">
        <option v-for="item in resourceCases" :key="item[0]" :value="item[0]">
          {{ item[1] }}
        </option>
      </select></label
    >
  </aside>
</template>
