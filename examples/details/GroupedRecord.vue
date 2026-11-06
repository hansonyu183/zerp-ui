<script setup lang="ts">
import { ref } from "vue";
import { defineCrud, defineCrudPage, domainBlocks } from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
type Local = {
  name: string;
  code: string;
  zero: number;
  enabled: boolean;
  empty: string;
  missing?: string;
  note: string;
  tags: string[];
  password: string;
  other: string;
};
type Draft = { values: Local };
const saved = ref<Draft>();
const rows = [
  { id: "one", name: "合成客户甲" },
  { id: "two", name: "合成客户乙" },
];
const definition = defineCrud<Draft, {}, (typeof rows)[number], string>({
  resource: "grouped-records",
  title: "分组资料",
  fields: [],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "name", label: "名称" }],
  identity: (row) => row.id,
  actions: () => ["view", "edit"],
  adapter: {
    query: async () => ({ items: rows, total: 2 }),
    get: async ({ identity }) => ({
      identity,
      values: {
        values: {
          name: rows.find((row) => row.id === identity)!.name,
          code: identity,
          zero: 0,
          enabled: false,
          empty: "",
          note: "背景第一行\n背景第二行 " + "长文本".repeat(120),
          tags: ["合成标签"],
          password: "synthetic-hidden",
          other: "未归组原值",
        },
      },
    }),
    empty: () => ({
      values: {
        name: "",
        code: "",
        zero: 0,
        enabled: false,
        empty: "",
        note: "",
        tags: [],
        password: "",
        other: "",
      },
    }),
    create: async () => ({ status: "success" }),
    save: async (attempt) => {
      saved.value = attempt.input;
      return { status: "success" };
    },
  },
});
const page = defineCrudPage({
  definition,
  permissions: { query: true, create: false, write: true },
  initialRow: rows[0],
  readOnly: true,
  blocks: [
    domainBlocks<Draft>().fields({
      key: "values",
      label: "客户资料",
      fields: [
        { key: "name", label: "客户名称", type: "text" },
        { key: "code", label: "简码", type: "text" },
        { key: "zero", label: "零值", type: "integer" },
        { key: "enabled", label: "启用", type: "boolean" },
        { key: "empty", label: "空文本", type: "text" },
        { key: "missing", label: "缺失值", type: "text" },
        { key: "note", label: "背景信息", type: "textarea" },
        {
          key: "tags",
          label: "标签",
          type: "multi-enum",
          options: [{ value: "合成标签", label: "合成标签" }],
        },
        { key: "password", label: "密码", type: "password" },
        { key: "other", label: "新增字段", type: "text", required: true },
      ],
      groups: [
        {
          key: "basic",
          label: "基本资料",
          fields: ["name", "code", "zero", "enabled", "empty", "missing"],
        },
        { key: "notes", label: "背景与备注", fields: ["note", "tags", "name"] },
        { key: "secret", label: "密码组", fields: ["password"] },
      ],
    }),
  ],
});
</script>
<template>
  <ExamplePage :page="page" />
  <output aria-label="分组保存内容">{{ JSON.stringify(saved) }}</output>
</template>
