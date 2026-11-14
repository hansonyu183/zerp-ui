import { printDocument, rotationDocument } from "./print-fixture";
import { reactive, watch, toRaw } from "vue";
import { router } from "./router";
import {
  application,
  object,
  collection,
  array,
  text,
  decimal,
  operation,
  batchOperations,
  documentOperations,
  voucherOperations,
  workflowOperations,
  type ModelNavigation,
  type ModelActionModel,
  type ModelOperationJournal,
  type ModelOperationPersistence,
  type ModelBatchEntry,
  type BatchJournal,
  type BatchPersistence,
} from "@zerp/ui/model";
import type {
  DocumentArchive,
  VoucherArchive,
  WorkflowInstance,
} from "@zerp/ui";
// Everything in this file is synthetic. No company API, credentials or production data.
const owner = { ledger: "synthetic", operator: "demo", generation: "1" };
const input = object(
  "办理输入",
  {
    note: text("处理说明", { value: "合成原始输入", required: true }),
  },
  {
    operations: {
      calculate: {
        async run({ input }) {
          return {
            value: input,
            interactions: [
              {
                kind: "confirm" as const,
                id: "business-basis",
                label: "已核对办理依据",
              },
            ],
          };
        },
      },
    },
  },
);
type M = ModelActionModel<"process", typeof input, { digest: string }>;
type Id = { id: string };
const json = <T>(key: string): T | null => {
  const value = localStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : null;
};
const persist: ModelOperationPersistence<M, Id, string> = {
  async load(owner) {
    return json<ModelOperationJournal<M, Id, string>>(
      `model-operation:${JSON.stringify(owner)}`,
    );
  },
  async save(journal, expectedId) {
    const key = `model-operation:${JSON.stringify(journal.request.owner)}`;
    const old = json<ModelOperationJournal<M, Id, string>>(key);
    if ((old && !old.completed ? old.request.requestId : null) !== expectedId)
      throw Error("原请求 CAS 冲突");
    localStorage.setItem(key, JSON.stringify(journal));
  },
  async remove(owner, expectedId) {
    const key = `model-operation:${JSON.stringify(owner)}`,
      old = json<ModelOperationJournal<M, Id, string>>(key);
    if (!old || old.request.requestId !== expectedId)
      throw Error("完成 CAS 冲突");
    localStorage.setItem(key, JSON.stringify({ ...old, completed: true }));
  },
};
const receipt = (request: ModelOperationJournal<M, Id, string>["request"]) => ({
  status: "applied" as const,
  owner: request.owner,
  action: request.action,
  requestId: request.requestId,
  binding: request.binding,
  evidence: { digest: request.binding },
});
const protocol = {
  persistence: persist,
  async prepare(
    intent: Parameters<
      ReturnType<
        typeof operation<
          "process",
          typeof input,
          Id,
          string,
          { digest: string }
        >
      >["prepare"]
    >[0],
  ) {
    const requestId = crypto.randomUUID();
    return {
      ...intent,
      requestId,
      concurrency: "revision-1",
      binding: JSON.stringify([intent, requestId]),
      preview: {
        title: "权威处理预览",
        sections: [
          {
            key: "input",
            title: "原始业务输入",
            rows: [
              {
                key: "one",
                fields: [
                  { label: "说明", value: intent.input.note },
                  {
                    label: "办理依据",
                    value: intent.answers["business-basis"] === true,
                  },
                ],
              },
            ],
          },
        ],
      },
    };
  },
  acceptsPreparation: (
    intent:
      | Parameters<typeof receipt>[0]
      | { owner: unknown; identity: unknown; action: string; input: unknown },
    request: Parameters<typeof receipt>[0],
  ) => request.binding === JSON.stringify([intent, request.requestId]),
  async run(request: Parameters<typeof receipt>[0]) {
    const key = `model-executions:${request.requestId}`;
    localStorage.setItem(
      key,
      String(Number(localStorage.getItem(key) ?? "0") + 1),
    );
    localStorage.setItem(
      `model-applied:${request.requestId}`,
      JSON.stringify(receipt(request)),
    );
    // Deliberately lose the response: recovery must read this exact original without resending.
    return { status: "unknown" as const };
  },
  async reconcile(request: Parameters<typeof receipt>[0]) {
    return (
      json<ReturnType<typeof receipt>>(
        `model-applied:${request.requestId}`,
      ) ?? { status: "unknown" as const }
    );
  },
  async seal(
    _request: Parameters<typeof receipt>[0],
    result:
      | ReturnType<typeof receipt>
      | {
          status: "not-applied";
          sealed: boolean;
          owner: ReturnType<typeof receipt>["owner"];
          action: "process";
          requestId: string;
          binding: string;
          evidence: { digest: string };
        },
  ) {
    return result;
  },
  async refresh(settlement: { request: Parameters<typeof receipt>[0] }) {
    localStorage.setItem("model-result", settlement.request.input.note ?? "");
  },
  accepts: (
    request: Parameters<typeof receipt>[0],
    result: { evidence: { digest: string } },
  ) => result.evidence.digest === request.binding,
};
const processing = object(
  "业务办理",
  { id: text("业务编号", { value: "job-1", readOnly: true }) },
  {
    identity: ["id"],
    operations: {
      process: operation<
        "process",
        typeof input,
        Id,
        string,
        { digest: string }
      >("process", input, protocol),
    },
  },
);
const resultRow = () =>
  object(
    "查询行",
    {
      id: text("行编号", { value: "R1", readOnly: true }),
      name: text("业务名称", { value: "合成分析" }),
      amount: decimal("金额", { value: "12345678901234567890.10" }),
    },
    { identity: ["id"] },
  );
const parameters = object("查询参数", {
  keyword: text("查询内容", { value: "合成" }),
});
const results = collection("查询分析", resultRow, {
  operations: {
    query: {
      input: parameters,
      async run() {
        return {
          items: [resultRow()],
          total: 1,
          id: "result-1",
          summary: {
            caption: "权威合计",
            values: { amount: "12345678901234567890.10" },
          },
          context: "合成权威上下文",
        };
      },
      async page() {
        return { items: [resultRow()], total: 1 };
      },
      async revalidate() {
        return { status: "valid" as const };
      },
      drill: () => ({ node: processing, identity: { id: "job-1" } }),
    },
    export: {
      async run() {
        return {
          content: new Blob(["synthetic,12345678901234567890.10"]),
          filename: "synthetic.csv",
        };
      },
    },
  },
});
const batchStore: BatchPersistence<M, Id, string> = {
  async load(owner) {
    return json<BatchJournal<M, Id, string>>(
      `model-batch:${JSON.stringify(owner)}`,
    );
  },
  async save(journal, expectedId) {
    const key = `model-batch:${JSON.stringify(journal.owner)}`;
    await navigator.locks.request(key, async () => {
      const old = json<BatchJournal<M, Id, string>>(key);
      if ((old?.id ?? null) !== expectedId) throw Error("批次 CAS 冲突");
      localStorage.setItem(key, JSON.stringify(journal));
    });
  },
};
const batchItem = (id: string) =>
  object(
    "批次项目",
    {
      id: text("项目身份", { value: id }),
      note: text("项目说明", { value: `项目 ${id}` }),
    },
    { identity: ["id"] },
  );
const batches = collection("批量办理", () => batchItem(""), {
  items: [batchItem("one"), batchItem("two")],
  operations: batchOperations<M, Id, string>({
    ...protocol,
    journal: batchStore,
    get entries(): readonly ModelBatchEntry<M, Id>[] {
      return batches.items.map((row) => ({
        key: row.id.value!,
        label: `合成项目 ${row.id.value}`,
        intent: {
          owner: {
            scope: JSON.stringify(owner),
            operator: owner.operator,
            resource: JSON.stringify([["batches"], []]),
          },
          identity: { id: row.id.value! },
          action: "process",
          answers: { "batch-check": true },
          input: { note: row.note.value },
        },
      }));
    },
  }),
});

const content = () =>
  object("版本内容", {
    title: text("资料名称", { value: "合成版本" }),
    lines: array("明细", () =>
      object("明细行", {
        item: text("品名", { value: "合成行" }),
        amount: decimal("行金额", { value: "1.00" }),
        children: array("子明细", () =>
          object("子行", { note: text("子项说明", { value: "初值" }) }),
        ),
      }),
    ),
  });
const audit = object("审计", { message: text("审计说明") });
type Content = {
  title: string | null;
  lines: {
    item: string | null;
    amount: string | null;
    children: { note: string | null }[];
  }[];
};
type Audit = { message: string | null };
const initialContent: Content = { title: "合成正式内容", lines: [] };
const snapshot = {
  label: "正式 v1",
  identity: "document-1",
  state: "v1",
  values: initialContent,
  owner: "synthetic-owner",
  attachments: [] as { label: string; handle: string }[],
  eligible: { edit: true, approve: true, enable: true, disable: true },
};
let documentArchive: DocumentArchive<
  Content,
  string,
  string,
  string,
  string,
  Audit
> = { official: snapshot, candidate: null, history: [], audit: [] };
const candidate = content(),
  official = content();
const versions = { official, candidate, history: array("精确历史", content) };
const documents = object("正式候选与附件", versions, {
  operations: documentOperations<
    typeof candidate,
    string,
    string,
    string,
    string,
    typeof audit,
    { id: string }
  >(versions, audit, {
    get: {
      async run() {
        return structuredClone(documentArchive);
      },
    },
    submit: {
      async run(attempt) {
        localStorage.setItem("model-doc-original", JSON.stringify(attempt));
        const count = Number(localStorage.getItem("model-doc-submits") ?? "0");
        localStorage.setItem("model-doc-submits", String(count + 1));
        if (!count)
          return {
            status: "failure" as const,
            message: "合成暂存后业务校验失败",
          };
        documentArchive = {
          ...documentArchive,
          candidate: {
            ...snapshot,
            label: "候选 v2",
            state: "v2",
            values: attempt.input,
            attachments: attempt.attachments.map((handle) => ({
              label: handle,
              handle,
            })),
          },
        };
        return { status: "success" };
      },
    },
    approve: {
      async run() {
        if (documentArchive.candidate) {
          documentArchive = {
            ...documentArchive,
            official: documentArchive.candidate,
            candidate: null,
            history: documentArchive.official ? [documentArchive.official] : [],
          };
        }
        return { status: "success" };
      },
    },
    stage: {
      validate: () => undefined,
      async stage(attempt) {
        const key = `model-stage:${attempt.fileId}`;
        localStorage.setItem(
          key,
          String(Number(localStorage.getItem(key) ?? "0") + 1),
        );
        return { status: "success", handle: `staged-${attempt.fileId}` };
      },
      async read({ handle }) {
        return { content: new Blob([handle]), filename: "synthetic.txt" };
      },
    },
  }),
});
let voucherArchive: VoucherArchive<
  Content,
  string,
  string,
  { id: string },
  string,
  string,
  string,
  Audit
> = {
  current: {
    identity: { voucher: "V1", revision: "1", submission: null },
    number: "合成单据 V1",
    handler: "合成经办",
    state: "draft",
    values: initialContent,
    owner: "synthetic-owner",
    attachments: [],
    eligible: { edit: true, clone: true, approve: true },
  },
  history: [],
  audit: [],
};
const voucherContent = content();
const vouchers = object(
  "单据录入",
  { content: voucherContent },
  {
    operations: voucherOperations<
      typeof voucherContent,
      string,
      string,
      { id: string },
      string,
      string,
      string,
      typeof audit
    >(voucherContent, audit, {
      query: {
        async run() {
          return {
            items: voucherArchive.current
              ? [
                  {
                    identity: voucherArchive.current.identity,
                    number: voucherArchive.current.number,
                    handler: voucherArchive.current.handler,
                  },
                ]
              : [],
            total: 1,
          };
        },
      },
      get: {
        async run() {
          return structuredClone(voucherArchive);
        },
      },
      create: {
        run() {
          return {
            ...voucherArchive.current!,
            identity: {
              voucher: crypto.randomUUID(),
              revision: "0",
              submission: null,
            },
            number: "合成新单据",
            values: { title: "新单据", lines: [] },
          };
        },
      },
      clone: {
        run({ source }) {
          return {
            ...source,
            identity: {
              voucher: crypto.randomUUID(),
              revision: "0",
              submission: null,
            },
            number: "合成克隆",
          };
        },
      },
      submit: {
        async run(attempt) {
          localStorage.setItem(
            "model-voucher-original",
            JSON.stringify(attempt),
          );
          voucherArchive = {
            ...voucherArchive,
            current: {
              ...voucherArchive.current!,
              identity: attempt.identity,
              values: attempt.input,
            },
          };
          return { status: "success" };
        },
      },
      approve: {
        async run() {
          return { status: "success" };
        },
      },
    }),
  },
);
const workflow: WorkflowInstance<string, string, string, string, string> = {
  identity: "F1",
  label: "合成流程",
  nodes: [
    {
      identity: "N1",
      revision: "1",
      label: "合成审批节点",
      state: "open",
      eligible: ["APPROVE_CHILD", "OPEN_VOUCHER"],
      targets: [],
      voucher: "V1",
    },
  ],
};
const workflows = object(
  "流程节点",
  {},
  {
    operations: workflowOperations<
      string,
      string,
      string,
      string,
      string,
      typeof audit,
      { id: string }
    >(audit, {
      query: {
        async run() {
          return { items: [{ identity: "F1", label: "合成流程" }], total: 1 };
        },
      },
      get: {
        async run() {
          return structuredClone(workflow);
        },
      },
      audit: {
        async run() {
          return [];
        },
      },
      approveChild: {
        async run(attempt) {
          localStorage.setItem("model-flow-original", JSON.stringify(attempt));
          return { status: "success" };
        },
      },
      openVoucher: {
        async run() {
          return { status: "success" };
        },
        target: () => ({ node: vouchers }),
      },
    }),
  },
);
const printInput = object("打印参数", {
  note: text("打印说明", { value: "合成打印" }),
});
type PrintAction = "preview" | "print" | "printed" | "not-printed";
type PM = ModelActionModel<PrintAction, typeof printInput, { digest: string }>;
const printStore: ModelOperationPersistence<PM, Id, string> = {
  async load(owner) {
    return json<ModelOperationJournal<PM, Id, string>>(
      `model-print:${JSON.stringify(owner)}`,
    );
  },
  async save(journal, expectedId) {
    const key = `model-print:${JSON.stringify(journal.request.owner)}`,
      old = json<ModelOperationJournal<PM, Id, string>>(key);
    if ((old && !old.completed ? old.request.requestId : null) !== expectedId)
      throw Error("打印 CAS 冲突");
    localStorage.setItem(key, JSON.stringify(journal));
  },
  async remove(owner, expectedId) {
    const key = `model-print:${JSON.stringify(owner)}`,
      old = json<ModelOperationJournal<PM, Id, string>>(key);
    if (!old || old.request.requestId !== expectedId)
      throw Error("打印完成 CAS 冲突");
    localStorage.setItem(key, JSON.stringify({ ...old, completed: true }));
  },
};
const printingFacts = reactive({
  document: (() => {
    const value = new URLSearchParams(location.search).get("rotation");
    return value !== null && ["0", "90", "180", "270"].includes(value)
      ? rotationDocument(Number(value) as 0 | 90 | 180 | 270)
      : printDocument;
  })(),
  state: "preview" as "preview" | "opened" | "printed" | "not-printed",
});
const previewAction = operation<
  "preview",
  typeof printInput,
  Id,
  string,
  { digest: string },
  PM
>("preview", printInput, {
  persistence: printStore,
  printing: printingFacts,
  async prepare(intent) {
    const requestId = crypto.randomUUID();
    return {
      ...intent,
      requestId,
      concurrency: "1",
      binding: JSON.stringify([intent, requestId]),
      preview: { title: "打印确认：preview", sections: [] },
    };
  },
  acceptsPreparation: (intent, request) =>
    request.binding === JSON.stringify([intent, request.requestId]),
  async run(request) {
    return {
      status: "applied",
      action: request.action,
      owner: request.owner,
      requestId: request.requestId,
      binding: request.binding,
      evidence: { digest: request.binding },
    };
  },
  async reconcile() {
    return { status: "unknown" };
  },
  async seal(_request, result) {
    return result;
  },
  async refresh() {
    printingFacts.state = "preview";
  },
  accepts: (request, result) => result.evidence.digest === request.binding,
});
const printAction = operation<
  "print",
  typeof printInput,
  Id,
  string,
  { digest: string },
  PM
>("print", printInput, {
  persistence: printStore,
  printing: printingFacts,
  async prepare(intent) {
    const requestId = crypto.randomUUID();
    return {
      ...intent,
      requestId,
      concurrency: "1",
      binding: JSON.stringify([intent, requestId]),
      preview: { title: "打印确认：print", sections: [] },
    };
  },
  acceptsPreparation: (intent, request) =>
    request.binding === JSON.stringify([intent, request.requestId]),
  async run(request) {
    return {
      status: "applied",
      action: request.action,
      owner: request.owner,
      requestId: request.requestId,
      binding: request.binding,
      evidence: { digest: request.binding },
    };
  },
  async reconcile() {
    return { status: "unknown" };
  },
  async seal(_request, result) {
    return result;
  },
  async refresh() {
    printingFacts.state = "opened";
  },
  accepts: (request, result) => result.evidence.digest === request.binding,
});
const printedAction = operation<
  "printed",
  typeof printInput,
  Id,
  string,
  { digest: string },
  PM
>("printed", printInput, {
  persistence: printStore,
  printing: printingFacts,
  async prepare(intent) {
    const requestId = crypto.randomUUID();
    return {
      ...intent,
      requestId,
      concurrency: "1",
      binding: JSON.stringify([intent, requestId]),
      preview: { title: "打印确认：printed", sections: [] },
    };
  },
  acceptsPreparation: (intent, request) =>
    request.binding === JSON.stringify([intent, request.requestId]),
  async run(request) {
    return {
      status: "applied",
      action: request.action,
      owner: request.owner,
      requestId: request.requestId,
      binding: request.binding,
      evidence: { digest: request.binding },
    };
  },
  async reconcile() {
    return { status: "unknown" };
  },
  async seal(_request, result) {
    return result;
  },
  async refresh() {
    printingFacts.state = "printed";
  },
  accepts: (request, result) => result.evidence.digest === request.binding,
});
const notPrintedAction = operation<
  "not-printed",
  typeof printInput,
  Id,
  string,
  { digest: string },
  PM
>("not-printed", printInput, {
  persistence: printStore,
  printing: printingFacts,
  async prepare(intent) {
    const requestId = crypto.randomUUID();
    return {
      ...intent,
      requestId,
      concurrency: "1",
      binding: JSON.stringify([intent, requestId]),
      preview: { title: "打印确认：not-printed", sections: [] },
    };
  },
  acceptsPreparation: (intent, request) =>
    request.binding === JSON.stringify([intent, request.requestId]),
  async run(request) {
    return {
      status: "applied",
      action: request.action,
      owner: request.owner,
      requestId: request.requestId,
      binding: request.binding,
      evidence: { digest: request.binding },
    };
  },
  async reconcile() {
    return { status: "unknown" };
  },
  async seal(_request, result) {
    return result;
  },
  async refresh() {
    printingFacts.state = "not-printed";
  },
  accepts: (request, result) => result.evidence.digest === request.binding,
});
const printing = object(
  "图文打印",
  { id: text("打印身份", { value: "print-1", readOnly: true }) },
  {
    identity: ["id"],
    operations: {
      preview: previewAction,
      print: printAction,
      printed: printedAction,
      "not-printed": notPrintedAction,
    },
  },
);
const nodes = {
  results,
  processing,
  documents,
  vouchers,
  workflows,
  batches,
  printing,
};
const navigation = reactive<ModelNavigation>({
  current: { node: results },
  href(node) {
    return `/${Object.entries(nodes).find(([, value]) => toRaw(value) === toRaw(node))?.[0] ?? "results"}`;
  },
  visit(node) {
    void router.push(navigation.href(node));
  },
  guard(check) {
    return router.beforeEach(
      async (to) =>
        await check({
          node: nodes[to.path.slice(1) as keyof typeof nodes] ?? results,
        }),
    );
  },
});
export const model = reactive(
  application("模型查询与办理", nodes, {
    owner,
    userPermissions: { owner: { ...owner }, administrator: true },
    navigationProjection: [
      {
        key: "business",
        name: "查询与办理",
        items: Object.values(nodes).map((node) => ({ node })),
      },
    ],
    brand: {
      home: "/results",
      productName: "模型业务应用",
      enterpriseName: "合成验收",
      mark: { kind: "text", text: "例" },
    },
    navigation,
  }),
);
watch(
  () => router.currentRoute.value.path,
  (path) => {
    const key = path.slice(1) as keyof typeof nodes;
    navigation.current = { node: model[key] ?? model.results };
  },
  { immediate: true },
);
