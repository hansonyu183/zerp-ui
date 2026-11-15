<script setup lang="ts">
import { computed, inject } from "vue";
import { useDisplay } from "vuetify";
import { VTable, VCard, VCheckboxBtn } from "vuetify/components";
import type { RecordsNode, ObjectNode } from "./business-model";
import { directRuntimeKey } from "./direct-model-runtime";
import BusinessNode from "./BusinessNode.vue";
const props = defineProps<{ node: RecordsNode; readOnly?: boolean }>();
const runtime = inject(directRuntimeKey)!;
const { xs } = useDisplay();
const rows = computed(() =>
  props.node.items.filter((row) => runtime.readable(row)),
);
const columns = computed(() =>
  props.node.columns.filter((column) =>
    rows.value.every((row) => {
      const child = row.members.find((member) => member.key === column.key);
      return !child || runtime.readable(child);
    }),
  ),
);
const selectable = computed(() => runtime.allowed(props.node, "remove"));
function field(row: ObjectNode, key: string) {
  return row.members.find((member) => member.key === key);
}
function select(row: ObjectNode, value: boolean | null) {
  if (props.readOnly || !runtime.writable(props.node)) return;
  props.node.selected = value ? row : null;
}
</script>
<template>
  <div class="zerp-direct-records">
    <template v-if="xs">
      <VCard
        v-for="(row, index) in rows"
        :key="row.identity ?? row.key"
        class="zerp-owned-card"
        tag="article"
        :aria-label="row.label ?? `第 ${index + 1} 项`"
      >
        <div v-if="selectable" class="zerp-owned-card-header">
          <VCheckboxBtn
            :aria-label="`选择第 ${index + 1} 项`"
            :model-value="node.selected === row"
            :disabled="readOnly || !runtime.writable(node)"
            @update:model-value="select(row, $event)"
          /><span>已选 {{ node.selected === row ? 1 : 0 }} 项</span>
        </div>
        <div class="zerp-owned-fields">
          <div
            v-for="column in columns"
            :key="column.key"
            class="zerp-owned-field"
          >
            <span>{{ column.label }}</span
            ><BusinessNode
              v-if="field(row, column.key)"
              :node="field(row, column.key)!"
              :auto-read="false"
              :read-only="readOnly"
            />
          </div>
        </div>
      </VCard>
    </template>
    <VTable v-else density="compact" class="zerp-compact-table">
      <thead>
        <tr>
          <th v-if="selectable" scope="col">选择</th>
          <th v-for="column in columns" :key="column.key" scope="col">
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.identity ?? row.key">
          <td v-if="selectable">
            <VCheckboxBtn
              :aria-label="`选择第 ${index + 1} 项`"
              :model-value="node.selected === row"
              :disabled="readOnly || !runtime.writable(node)"
              @update:model-value="select(row, $event)"
            />
          </td>
          <td v-for="column in columns" :key="column.key">
            <BusinessNode
              v-if="field(row, column.key)"
              :node="field(row, column.key)!"
              :auto-read="false"
              :read-only="readOnly"
            />
          </td>
        </tr>
      </tbody>
    </VTable>
    <p v-if="!rows.length">暂无记录</p>
  </div>
</template>
<style scoped>
.zerp-owned-card {
  padding: 8px;
  margin-block: 8px;
  min-width: 0;
}
.zerp-owned-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.zerp-owned-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.zerp-owned-field {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 12rem;
  min-width: 0;
  max-width: 100%;
}
.zerp-owned-field > span {
  flex-shrink: 0;
}
.zerp-owned-field > section {
  flex: 1;
  min-width: 0;
}
.zerp-direct-records :deep(.v-field__outline) {
  display: none;
}
.zerp-direct-records :deep(.v-field-label) {
  visibility: hidden;
}
.zerp-direct-records :deep(.v-field__input) {
  padding-block: 4px;
}
.zerp-direct-records :deep(input) {
  min-width: 0;
}
</style>
