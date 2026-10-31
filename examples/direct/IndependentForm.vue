<script setup lang="ts">
import { ref } from "vue";
import {
  DynamicForm,
  validateFields,
  type Fields,
  type FormValidationState,
} from "@zerp/ui";
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
const validation = ref<FormValidationState<Draft>>({
  ...validateFields(fields, value.value),
  pending: false,
});
const submitted = ref("");
function submit() {
  if (!validation.value.valid || validation.value.pending) return;
  submitted.value = JSON.stringify(value.value);
}
</script>
<template>
  <section aria-label="独立表单示例">
    <h2>独立表单</h2>
    <DynamicForm
      v-model="value"
      :fields="fields"
      scope="synthetic-form"
      @validation="validation = $event"
    />
    <button type="button" @click="value = { ...value, count: 20 }">
      父模型采用 20
    </button>
    <button
      type="button"
      :disabled="!validation.valid || validation.pending"
      @click="submit"
    >
      提交独立表单
    </button>
    <p role="status">
      {{
        validation.pending
          ? "本地输入未完成"
          : validation.valid
            ? "输入有效"
            : "输入无效"
      }}
    </p>
    <p aria-label="独立提交值">{{ submitted }}</p>
  </section>
</template>
