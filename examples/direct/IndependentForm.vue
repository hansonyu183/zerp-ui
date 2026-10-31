<script setup lang="ts">
import { ref } from "vue";
import ExamplePage from "../shared/ExamplePage.vue";
import { defineAccountPage, type Fields, type EditProtection } from "@zerp/ui";
type Draft = { title: string; count: number | null; amount: string };
const fields: Fields<Draft> = [
  {
    key: "title",
    type: "text",
    label: "独立名称",
    required: true,
    minLength: 2,
    maxLength: 12,
  },
  {
    key: "count",
    type: "integer",
    label: "独立数量",
    required: true,
    min: 0,
    max: 20,
  },
  { key: "amount", type: "decimal", label: "独立金额", required: true },
];
const value = ref<Draft>({
  title: "",
  count: 0,
  amount: "9007199254740993.0100",
});
const protection = ref<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: true,
  writeState: "idle",
});
const submitted = ref("");
const revision = ref(0);
const page = defineAccountPage(() => ({
  kind: "profile",
  title: "合成账户资料验证",
  values: value.value,
  fields,
  submitLabel: "提交独立表单",
  submit: (values: Draft) => {
    value.value = values;
    submitted.value = JSON.stringify(values);
  },
  onProtection: (value: EditProtection) => (protection.value = value),
  onChange: (values: Draft) => (value.value = values),
}));
</script>
<template>
  <section aria-label="独立表单示例">
    <h2>独立表单</h2>
    <ExamplePage :page="page" scope="synthetic-form" />
    <aside class="example-controls">
      <button type="button" @click="value = { ...value, count: 20 }">
        父模型采用 20
      </button>
      <p role="status">
        {{
          protection.localPending
            ? "本地输入未完成"
            : !protection.invalid
              ? "输入有效"
              : "输入无效"
        }}
      </p>
      <p aria-label="独立提交值">{{ submitted }}</p>
    </aside>
  </section>
</template>
