<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  DynamicForm,
  ReferencePicker,
  type ConfigurationBlockProps,
  type Fields,
} from "@zerp/ui";
import type { Entry } from "./adapters";
const props =
  defineProps<
    ConfigurationBlockProps<
      Entry["entry"],
      readonly { id: string; label: string; revision: string }[]
    >
  >();
const fields: Fields<Pick<Entry["entry"], "amount" | "rows">> = [
  { key: "amount", label: "精确金额", type: "decimal" },
  {
    key: "rows",
    label: "期初行",
    type: "rows",
    empty: () => ({ name: "新行", children: [] }),
    fields: [
      { key: "name", label: "行名称", type: "text" },
      {
        key: "children",
        label: "子项",
        type: "rows",
        empty: () => ({ amount: "0.0100" }),
        fields: [{ key: "amount", label: "子项金额", type: "decimal" }],
      },
    ],
  },
];
const value = computed(() => ({
  amount: props.modelValue.amount,
  rows: props.modelValue.rows,
}));
function change(v: typeof value.value) {
  if (!props.disabled)
    props["onUpdate:modelValue"]?.({ ...props.modelValue, ...v });
}
const preparing = ref(false),
  formPending = ref(false),
  sourcePending = ref(false);
function pending() {
  props.onPending?.(
    preparing.value || formPending.value || sourcePending.value,
  );
}
let active = true;
onBeforeUnmount(() => {
  active = false;
});
async function prepare() {
  preparing.value = true;
  pending();
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!active) return;
  preparing.value = false;
  pending();
}
const source = {
  search: async () => ({
    items: props.catalog.map((c) => ({
      id: c.id,
      label: c.label,
      snapshot: { revision: c.revision, rate: "0.0100" },
    })),
    hasMore: false,
  }),
  resolve: async ({ ids }: { ids: readonly string[] }) =>
    ids.map((id) => ({ id, label: `已采用 ${id}`, selectable: false })),
};
</script>
<template>
  <section aria-label="专用录入区块">
    <p>区块模式：{{ mode }}；来源采用快照：{{ modelValue.source?.snapshot }}</p>
    <button
      v-if="mode === 'edit'"
      :disabled="disabled || preparing"
      @click="prepare"
    >
      准备录入目录
    </button>
    <DynamicForm
      :model-value="value"
      :fields="fields"
      scope="synthetic-entry"
      :disabled="disabled"
      :onUpdate:modelValue="change"
      :onPending="
        (v) => {
          formPending = v;
          pending();
        }
      "
    />
    <ReferencePicker
      label="精确来源"
      :model-value="modelValue.source"
      :adapter="source"
      scope="synthetic-entry"
      :disabled="disabled"
      :onUpdate:modelValue="
        (v) => {
          if (!disabled && (v === null || 'id' in v))
            props['onUpdate:modelValue']?.({ ...modelValue, source: v });
        }
      "
      :onPending="
        (v) => {
          sourcePending = v;
          pending();
        }
      "
    />
  </section>
</template>
