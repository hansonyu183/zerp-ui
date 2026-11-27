import { reactive } from "vue";
import type {
  BusinessNode,
  ListCollection,
  InteractionNode,
  ObjectNode,
  Owner,
  OutputNode,
} from "@zerp/ui/model";
const trace = (name: string) => console.log(`synthetic-call:${name}`);
const operation = (run: () => Promise<void>) => ({
  disabled: false,
  run,
});
const text = (key: string, label: string, value: string, readOnly = false) =>
  reactive({
    kind: "text" as const,
    key,
    label,
    value,
    readOnly,
    required: false,
  });
const object = (
  key: string,
  label: string,
  members: BusinessNode[],
): ObjectNode =>
  reactive({
    kind: "object",
    businessType: key,
    printable: false,
    family: "standard",
    key,
    label,
    identity: key,
    readOnly: false,
    members,
    operations: {},
  });
const collection = (
  key: string,
  label: string,
  row: ObjectNode,
): ListCollection =>
  reactive({
    key,
    label,
    columns: [
      { key: row.members[0]!.key, label: row.members[0]!.label ?? "名称" },
    ],
    conditions: object(`${key}-conditions`, "查询条件", []),
    items: [row],
    selected: null,
    draft: null,
    page: 1,
    pageSize: 20,
    total: 1,
    operations: {},
  });
const documentStatus = text("status", "资料状态", "草稿", true);
export const documentRecord = object("document", "资料", [
  text("title", "资料标题", "候选资料"),
  documentStatus,
]);
documentRecord.document = {
  operations: {
    submit: operation(async () => {
      trace("document.submit");
      documentStatus.value = "待审批";
    }),
    approve: operation(async () => {
      trace("document.approve");
      documentStatus.value = "已生效";
    }),
  },
};
export const documents = collection("documents", "资料办理", documentRecord);
const workflowStatus = text("state", "流程状态", "待启动", true);
export const workflowRecord = object("workflow", "流程", [workflowStatus]);
workflowRecord.workflow = {
  operations: {
    start: operation(async () => {
      trace("workflow.start");
      workflowStatus.value = "办理中";
    }),
    advance: operation(async () => {
      trace("workflow.advance");
      workflowStatus.value = "已完成";
    }),
  },
};
export const workflows = collection("workflows", "流程办理", workflowRecord);
const batchResult = text("result", "项结果", "待执行", true);
export const batchRecord = object("batch", "批次", [
  {
    kind: "records",
    key: "entries",
    label: "批次项",
    readOnly: true,
    items: [object("entry", "批次项", [batchResult])],
    selected: null,
    operations: {},
  },
]);
batchRecord.batch = {
  operations: {
    executeBatch: operation(async () => {
      trace("batch.executeBatch");
      batchResult.value = "成功";
    }),
  },
};
export const batches = collection("batches", "批量办理", batchRecord);
const processingStatus = text("state", "处理状态", "待执行", true);
export const processingRecord = object("processing", "处理", [
  processingStatus,
]);
processingRecord.processing = {
  operations: {
    validate: operation(async () => {
      trace("processing.validate");
      processingStatus.value = "校验通过";
    }),
    run: operation(async () => {
      trace("processing.run");
      processingStatus.value = "执行完成";
    }),
  },
};
export const processing = collection(
  "processing",
  "业务处理",
  processingRecord,
);
const questions: InteractionNode = reactive({
  kind: "interactions",
  key: "questions",
  label: "查询问题",
  readOnly: false,
  value: {},
  items: [{ kind: "input", id: "factor", label: "计算系数" }],
});
const quantity = text("quantity", "查询数量", "2");
const result = text("result", "查询合计", "0.00", true);
export const reportRecord = object("report", "业务查询", [
  quantity,
  result,
  questions,
]);
function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function download() {
  downloadFile("synthetic-report.csv", `合计\n${result.value}\n`);
}
reportRecord.report = {
  operations: {
    calculate: operation(async () => {
      trace("report.calculate");
      result.value = (
        Number(quantity.value) * Number(questions.value.factor || 10)
      ).toFixed(2);
    }),
    export: operation(async () => {
      trace("report.export");
      download();
    }),
  },
};
export const reports = collection("reports", "业务查询", reportRecord);
reports.operations.export = operation(async () => {
  trace("report.export");
  download();
});
questions.items = [
  ...questions.items,
  {
    kind: "menu",
    id: "script-menu",
    label: "脚本菜单",
    items: [
      {
        key: "recalculate",
        label: "菜单计算",
        target: {
          kind: "action",
          operation: operation(async () => {
            trace("script.menu");
            await reportRecord.report!.operations.calculate!.run();
          }),
        },
      },
    ],
  },
  {
    kind: "tree",
    id: "script-tree",
    label: "脚本树",
    items: [
      {
        key: "root",
        label: "查询目录",
        target: { collection: reports },
        children: [
          {
            key: "recalculate",
            label: "树计算",
            target: {
              kind: "action",
              operation: operation(async () => {
                trace("script.tree");
                await reportRecord.report!.operations.calculate!.run();
              }),
            },
          },
        ],
      },
    ],
  },
  {
    kind: "download",
    id: "script-download",
    label: "下载脚本结果",
    target: { collection: reports },
  },
  ...(["甲", "乙"] as const).map((name) => ({
    kind: "download" as const,
    id: `script-file-${name}`,
    label: `下载文件${name}`,
    target: {
      kind: "download" as const,
      operation: operation(async () => {
        trace(`script.file.${name}`);
        downloadFile(`synthetic-${name}.csv`, `独立文件${name}\n`);
      }),
    },
  })),
];
const detailRecord = object("detail", "合成凭证详情", [
  text("number", "关联凭证编号", "S-001", true),
]);
export const details = collection("details", "关联凭证", detailRecord);
const sales = [
  object("sale-1", "销售记录", [
    text("name", "销售名称", "合成销售"),
    {
      kind: "decimal",
      key: "amount",
      label: "销售金额",
      required: false,
      readOnly: true,
      value: "12345678901234567890.10",
    },
  ]),
  ...Array.from({ length: 29 }, (_, index) =>
    object(`sale-${index + 2}`, "销售记录", [
      text("name", "销售名称", `合成销售${index + 2}`),
      {
        kind: "decimal",
        key: "amount",
        label: "销售金额",
        required: false,
        readOnly: true,
        value: "0.00",
      },
    ]),
  ),
];
export const structuredReport: ListCollection = reactive({
  ...collection("structured", "结构化报表", sales[0]!),
  items: sales,
  columns: [
    { key: "name", label: "销售名称" },
    { key: "amount", label: "销售金额" },
  ],
  pageSize: 30,
  total: 60,
  report: {
    summary: {
      caption: "销售总计",
      values: { amount: "12345678901234567890.10" },
    },
    presentation: {
      rows: [
        {
          rowId: "sale-1",
          appearance: { bold: true },
          cells: { amount: { align: "right" } },
        },
      ],
      groups: [
        {
          id: "group-1",
          label: "业务分组",
          level: 0,
          firstKey: "sale-1",
          lastKey: "sale-1",
          continuedBefore: false,
          continuedAfter: false,
          summary: {
            caption: "分组小计",
            values: { amount: "12345678901234567890.10" },
          },
        },
      ],
    },
    cells: [
      {
        row: sales[0]!,
        field: "amount",
        kind: "record",
        label: "打开合成凭证",
        target: { collection: details, record: detailRecord },
        disabled: false,
      },
      {
        row: sales.at(-1)!,
        field: "name",
        kind: "record",
        label: "打开底部凭证",
        target: { collection: details, record: detailRecord },
        disabled: false,
      },
    ],
  },
});
structuredReport.conditions.members = [text("period", "查询期间", "2026-11")];
structuredReport.operations.query = operation(async () => {
  trace("structured.query");
});
const outputResult = text("result", "打印结果", "未确认", true);
const sheet: OutputNode = reactive({
  kind: "output",
  key: "sheet",
  label: "打印内容",
  readOnly: false,
  value: null,
  operations: {
    print: operation(async () => {
      trace("output.print");
      outputResult.value = "等待打印确认";
    }),
    confirmPrinted: operation(async () => {
      trace("output.confirmPrinted");
      outputResult.value = "已确认打印";
    }),
    confirmNotPrinted: operation(async () => {
      trace("output.confirmNotPrinted");
      outputResult.value = "已确认未打印";
    }),
  },
});
export const outputRecord = object("output", "打印办理", [outputResult, sheet]);
outputRecord.output = {
  operations: {
    preview: operation(async () => {
      trace("output.preview");
      sheet.value = {
        id: "synthetic-output",
        title: "合成打印",
        width: 100,
        height: 100,
        pages: [
          {
            key: "one",
            items: [
              {
                key: "title",
                kind: "text",
                x: 10,
                y: 10,
                width: 80,
                height: 15,
                text: "Synthetic output 159",
              },
            ],
          },
        ],
      };
    }),
  },
};
export const outputs = collection("outputs", "打印办理", outputRecord);
export const familyCollections = {
  documents,
  workflows,
  batches,
  processing,
  reports,
  structuredReport,
  details,
  outputs,
};

// Synthetic backend seeds are not preloaded into the anonymous application model.
export function bindFamilyQueries(owner: () => Owner | null) {
  for (const rows of Object.values(familyCollections)) {
    const seed = rows.items;
    const query = rows.operations.query;
    rows.items = [];
    rows.total = 0;
    rows.operations.query = undefined;
    rows.load = async ({ page, pageSize }) => {
      if (!owner()) return;
      const requestOwner = JSON.stringify(owner());
      await query?.run({ page, pageSize });
      if (JSON.stringify(owner()) !== requestOwner) return;
      if (rows === structuredReport) {
        details.items = [detailRecord];
        details.total = 1;
      }
      rows.items = seed;
      rows.page = page;
      rows.total = rows === structuredReport ? 60 : seed.length;
    };
  }
}

export function clearFamilyInputs() {
  quantity.value = "2";
  questions.value = {};
  result.value = "0.00";
  sheet.value = null;
  outputResult.value = "未确认";
}
