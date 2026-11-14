import { reactive } from "vue";
import { modelMetadata as meta, type BusinessModel } from "@zerp/ui/model";
const trace = (name: string) => console.log(`synthetic-call:${name}`);
const text = (name: string, value: string) => ({
  value,
  [meta]: { kind: "text" as const, name },
});

// These are consumer business facts and callbacks, not UI factories or a second schema.
export const document = reactive({
  title: text("资料标题", "候选资料"),
  status: {
    ...text("资料状态", "草稿"),
    [meta]: { kind: "text" as const, name: "资料状态", readOnly: true },
  },
  [meta]: {
    kind: "object",
    family: "document",
    name: "资料办理",
    form: ["title", "status"],
    operations: {
      submit: {
        async run() {
          trace("document.submit");
          document.status.value = "待审批";
        },
      },
      approve: {
        async run() {
          trace("document.approve");
          document.status.value = "已生效";
        },
      },
    },
  },
} satisfies BusinessModel[string]);

const line = {
  product: text("商品", "合成商品"),
  quantity: { value: "2", [meta]: { kind: "decimal" as const, name: "数量" } },
  [meta]: { kind: "object" as const, name: "明细行", operations: {} },
};
export const voucher = reactive({
  number: text("单据编号", "V001"),
  amount: {
    value: "20.00",
    [meta]: { kind: "decimal", name: "金额", readOnly: true },
  },
  files: {
    value: [] as File[],
    [meta]: { kind: "attachments", name: "单据附件", multiple: true },
  },
  status: text("单据状态", "草稿"),
  rows: {
    items: [line],
    [meta]: { kind: "array", name: "单据明细", element: line, operations: {} },
  },
  [meta]: {
    kind: "object",
    family: "voucher",
    name: "单据办理",
    form: ["number", "amount", "files", "status", "rows"],
    operations: {
      calculate: {
        async run() {
          trace("voucher.calculate");
          voucher.amount.value = (
            Number(voucher.rows.items[0]!.quantity.value) * 10
          ).toFixed(2);
        },
      },
      stageAttachments: {
        async run() {
          trace("voucher.stageAttachments");
          voucher.status.value = `已暂存 ${voucher.files.value.length} 个附件`;
        },
      },
      submit: {
        async run() {
          trace("voucher.submit");
          voucher.status.value = "已提交";
        },
      },
      withdraw: {
        async run() {
          trace("voucher.withdraw");
          voucher.status.value = "已撤回";
        },
      },
    },
  },
} satisfies BusinessModel[string]);

export const workflow = reactive({
  state: text("流程状态", "待启动"),
  [meta]: {
    kind: "object",
    family: "workflow",
    name: "流程办理",
    operations: {
      start: {
        async run() {
          trace("workflow.start");
          workflow.state.value = "办理中";
        },
      },
      advance: {
        async run() {
          trace("workflow.advance");
          workflow.state.value = "已完成";
        },
      },
    },
  },
} satisfies BusinessModel[string]);
const batchEntry = {
  result: text("项结果", "待执行"),
  [meta]: { kind: "object" as const, name: "批次项", operations: {} },
};
export const batch = reactive({
  entries: {
    items: [batchEntry],
    [meta]: {
      kind: "array",
      name: "批次项",
      element: batchEntry,
      operations: {},
    },
  },
  [meta]: {
    kind: "object",
    family: "batch",
    name: "批量办理",
    operations: {
      executeBatch: {
        async run() {
          trace("batch.executeBatch");
          batch.entries.items[0]!.result.value = "成功";
        },
      },
    },
  },
} satisfies BusinessModel[string]);
export const report = reactive({
  answers: {
    value: {} as Record<string, string | boolean>,
    [meta]: {
      kind: "interactions",
      name: "查询问题",
      items: [{ kind: "input", id: "factor", label: "计算系数" }],
    },
  },
  quantity: { value: "2", [meta]: { kind: "decimal", name: "查询数量" } },
  total: {
    value: "0.00",
    [meta]: { kind: "decimal", name: "查询合计", readOnly: true },
  },
  [meta]: {
    kind: "object",
    family: "report",
    name: "业务查询",
    operations: {
      calculate: {
        async run() {
          trace("report.calculate");
          report.total.value = (
            Number(report.quantity.value) *
            Number(report.answers.value.factor || 10)
          ).toFixed(2);
        },
      },
      export: {
        async run() {
          trace("report.export");
          const url = URL.createObjectURL(
            new Blob([`合计\n${report.total.value}\n`], { type: "text/csv" }),
          );
          const a = globalThis.document.createElement("a");
          a.href = url;
          a.download = "synthetic-report.csv";
          a.click();
          URL.revokeObjectURL(url);
        },
      },
    },
  },
} satisfies BusinessModel[string]);
type Output = Extract<BusinessModel[string], { [meta]: { kind: "output" } }>;
export const output = reactive({
  sheet: {
    value: null as Output["value"],
    [meta]: {
      kind: "output",
      name: "打印内容",
      operations: {
        print: {
          async run() {
            trace("output.print");
            output.result.value = "等待打印确认";
          },
        },
        confirmPrinted: {
          async run() {
            trace("output.confirmPrinted");
            output.result.value = "已确认打印";
          },
        },
        confirmNotPrinted: {
          async run() {
            trace("output.confirmNotPrinted");
            output.result.value = "已确认未打印";
          },
        },
      },
    },
  },
  result: text("打印结果", "未确认"),
  [meta]: {
    kind: "object",
    family: "output",
    name: "打印办理",
    operations: {
      preview: {
        async run() {
          trace("output.preview");
          output.sheet.value = {
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
                    text: "Synthetic output 154",
                  },
                ],
              },
            ],
          };
        },
      },
    },
  },
} satisfies BusinessModel[string]);
