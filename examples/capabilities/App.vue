<script setup lang="ts">
import { computed, provide, ref } from "vue";
import { useRoute } from "vue-router";
import {
  defineTaskPage,
  defineBatchPage,
  defineCrud,
  defineCrudPage,
  type DraftCollaboration,
  type PrintDocument,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import { createExampleShell, exampleShellKey } from "../shared/shell";
import { operation, batches, recovery, type Model } from "./adapters";
const route = useRoute(),
  shell = createExampleShell();
shell.navigation = [
  {
    key: "capabilities",
    caption: "完整能力示例",
    items: [
      ["task", "业务处理"],
      ["batch", "批量办理"],
      ["printing", "打印输出"],
      ["recovery", "资料恢复"],
    ].map(([key, caption]) => ({
      key: key!,
      caption: caption!,
      to: "/" + key,
    })),
  },
];
provide(exampleShellKey, shell);
const owner = {
  scope: "synthetic-session",
  operator: "synthetic-operator",
  resource: "task-demo",
};
const collaborator: DraftCollaboration<{ value: string }, unknown> = {
  change: async ({ value, answers, signal }) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 20);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(Error("已取消。"));
        },
        { once: true },
      );
    });
    return {
      value: {
        value:
          answers["confirm"] === true ? value.value + " · 已确认" : value.value,
      },
      interactions: [
        {
          kind: "confirm",
          id: "confirm",
          label: "我已核对业务输入",
          required: true,
        },
        {
          kind: "grid",
          id: "facts",
          label: "计算结果",
          columns: [{ key: "value", label: "内容" }],
          rows: [{ key: "one", values: { value: value.value } }],
        },
      ],
    };
  },
};
const taskDefinition = operation(owner);
const task = defineTaskPage<{ value: string }, Model, string, number>({
  title: "业务处理",
  instance: "task",
  owner,
  identity: "process-one",
  definition: taskDefinition,
  values: { value: "合成业务" },
  fields: [{ key: "value", label: "内容", type: "text", required: true }],
  actions: [
    "process",
    "validate",
    "publish",
    "restore",
    "run",
    "stop",
    "import",
  ],
  toIntent: (value, action, base) => ({ ...base, action, input: value }),
  eligible: true,
  recoveryAllowed: true,
  collaboration: collaborator,
  importResource: {
    label: "读取资源包",
    accept: ".json",
    read: async ({ file }) => {
      const value = JSON.parse(await file.text());
      if (typeof value.value !== "string") throw Error("资源包缺少内容。");
      return { value: value.value };
    },
  },
  downloads: [
    {
      key: "export",
      label: "导出资源包",
      read: async ({ value }) => ({
        content: new Blob([JSON.stringify(value)], {
          type: "application/json",
        }),
        filename: "synthetic.json",
      }),
    },
  ],
});
const batchOwner = { ...owner, resource: "batch-demo" },
  batchDefinition = operation(batchOwner),
  batchStore = batches(batchOwner);
const batch = defineBatchPage({
  title: "批量办理",
  owner: batchOwner,
  definition: batchDefinition,
  persistence: batchStore,
  entries: ["first", "second"].map((key) => ({
    key,
    label: key === "first" ? "第一项" : "第二项",
    intent: {
      owner: batchOwner,
      identity: key,
      action: "process" as const,
      input: { value: key },
    },
  })),
  eligible: true,
  recoveryAllowed: true,
});
const printOwner = { ...owner, resource: "printing-demo" },
  printState = ref<"preview" | "opened" | "printed" | "not-printed">("preview");
const printDocument: PrintDocument = {
  id: "fixed-print-one",
  title: "合成业务输出",
  width: 210,
  height: 297,
  pages: [
    {
      key: "one",
      items: [
        {
          key: "title",
          kind: "text",
          text: "合成打印输出",
          x: 10,
          y: 10,
          width: 180,
          height: 12,
          size: 18,
        },
        {
          key: "amount",
          kind: "text",
          text: "金额：9007199254740993.0100",
          x: 10,
          y: 30,
          width: 180,
          height: 10,
        },
      ],
    },
  ],
};
const printDefinition = operation(printOwner, (request) => {
  if (request.action === "print") printState.value = "opened";
  if (request.action === "printed") printState.value = "printed";
  if (request.action === "not-printed") printState.value = "not-printed";
});
const printing = defineTaskPage<{ value: string }, Model, string, number>(
  () => ({
    title: "打印输出",
    instance: printDocument.id,
    owner: printOwner,
    identity: printDocument.id,
    definition: printDefinition,
    values: { value: printDocument.id },
    fields: [],
    actions:
      printState.value === "preview"
        ? ["preview", "print"]
        : ["printed", "not-printed"],
    toIntent: (value, action, base) => ({ ...base, action, input: value }),
    eligible: true,
    recoveryAllowed: true,
    printing: { document: printDocument, state: printState.value },
    onSettled: (settlement) => {
      if (settlement.receipt.status === "applied") {
        if (settlement.request.action === "print") printState.value = "opened";
        if (settlement.request.action === "printed")
          printState.value = "printed";
        if (settlement.request.action === "not-printed")
          printState.value = "not-printed";
      }
    },
  }),
);
const persistence = recovery(),
  name = ref(localStorage.getItem("capabilities:name") ?? "原名称");
const crud = defineCrud<
  { name: string },
  {},
  { id: string; name: string },
  string,
  { id: string }
>({
  resource: "recovery-demo",
  title: "资料恢复",
  fields: [{ key: "name", label: "名称", type: "text" }],
  filters: [],
  initialFilters: () => ({}),
  columns: [{ key: "name", label: "名称" }],
  identity: (row) => row.id,
  actions: () => ["view", "edit"],
  persistence,
  adapter: {
    query: async () => ({ items: [{ id: "one", name: name.value }], total: 1 }),
    get: async () => ({ values: { name: name.value }, identity: "one" }),
    empty: () => ({ name: "" }),
    create: async () => ({ status: "failure", message: "仅演示修改。" }),
    save: async (attempt) => {
      name.value = attempt.input!.name;
      localStorage.setItem("capabilities:name", name.value);
      localStorage.setItem("capabilities:receipt", attempt.id);
      return { status: "unknown" };
    },
  },
  reconcile: async (attempt) =>
    localStorage.getItem("capabilities:receipt") === attempt.id
      ? {
          status: "applied",
          attemptId: attempt.id,
          evidence: { id: attempt.id },
        }
      : { status: "unknown" },
});
const recovering = defineCrudPage({
  definition: crud,
  permissions: { query: true, create: false, write: true, reconcile: true },
});
const page = computed(() =>
  route.path === "/batch"
    ? batch
    : route.path === "/printing"
      ? printing
      : route.path === "/recovery"
        ? recovering
        : task,
);
</script>
<template><ExamplePage :page="page" /></template>
