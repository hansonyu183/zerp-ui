<script setup lang="ts">
import { computed, inject } from "vue";
import { useDisplay } from "vuetify";
import { VTable, VCard, VCheckboxBtn } from "vuetify/components";
import type { RecordsNode, ObjectNode } from "./business-model";
import { directRuntimeKey } from "./direct-model-runtime";
import BusinessNode from "./BusinessNode.vue";
import Feedback from "./Feedback.vue";
import FeedbackRegion from "./FeedbackRegion.vue";
const props = defineProps<{ node: RecordsNode; readOnly?: boolean }>();
const runtime = inject(directRuntimeKey)!;
const { xs } = useDisplay();
const rows = computed(() =>
  props.node.items.filter(runtime.readable).map((row) => ({
    row,
    fields: new Map(row.members.map((member) => [member.key, member])),
  })),
);
const columns = computed(() =>
  [...(rows.value[0]?.fields.values() ?? [])].filter((column) =>
    rows.value.every(({ fields }) => {
      const child = fields.get(column.key);
      return (
        child?.label === column.label &&
        child.kind === column.kind &&
        runtime.readable(child)
      );
    }),
  ),
);
const modelError = computed(() => {
  const first = rows.value[0]?.row.members;
  if (!first) return "";
  return rows.value
    .flatMap(({ row, fields }, index) => {
      if (fields.size !== row.members.length)
        return [`第 ${index + 1} 项的成员键重复`];
      if (
        row.members.length !== first.length ||
        row.members.some((member, position) => {
          const expected = first[position]!;
          return (
            member.key !== expected.key ||
            member.label !== expected.label ||
            member.kind !== expected.kind
          );
        })
      )
        return [`第 1 项与第 ${index + 1} 项的行成员定义不一致`];
      return [];
    })
    .join("\n");
});
const selectable = computed(() => runtime.available(props.node, "remove"));
function select(row: ObjectNode, value: boolean | null) {
  if (
    props.readOnly ||
    !runtime.writable(props.node) ||
    !selectable.value ||
    !runtime.readable(row)
  )
    return;
  props.node.selected = value ? row : null;
}
</script>
<template>
  <div class="zerp-direct-records">
    <FeedbackRegion v-if="modelError">
      <Feedback :message="modelError" kind="error" />
    </FeedbackRegion>
    <p v-if="!rows.length">暂无记录</p>
    <template v-else-if="xs">
      <VCard
        v-for="({ row, fields }, index) in rows"
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
              :node="fields.get(column.key)!"
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
        <tr
          v-for="({ row, fields }, index) in rows"
          :key="row.identity ?? row.key"
        >
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
              :node="fields.get(column.key)!"
              :auto-read="false"
              :read-only="readOnly"
            />
          </td>
        </tr>
      </tbody>
    </VTable>
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
