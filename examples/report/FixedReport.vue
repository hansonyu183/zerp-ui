<script setup lang="ts">
import { ref, shallowRef, onBeforeUnmount } from "vue";
import {
  ReportView,
  defineReport,
  ReportUnavailable,
  type ReportSnapshot,
  type ReportColumn,
  type ReportPresentation,
  type ReportDrill,
  type ReportCancellation,
  type ReportValidity,
} from "@zerp/ui";
type Parameters = { keyword: string };
type Row = {
  id: string;
  record: string;
  amount: string;
  related: string;
  audit: string;
};
type ResultId = { snapshot: string };
type Target = { record: string };
type Snapshot = ReportSnapshot<Parameters, Row, ResultId, string, Target>;
const scenario = ref("success"),
  cancellation = ref<ReportCancellation["status"]>("cancelled");
const validity = ref<ReportValidity["status"]>("valid");
const visible = ref(true),
  detail = ref(""),
  scope = ref("synthetic-session-1");
const saved = shallowRef<Snapshot>();
const currentParameters = ref<Parameters>({ keyword: "" });
const adoptedContext = shallowRef<{
  parameters: Parameters;
  resultId: ResultId | null;
} | null>(null);
const rows: Row[] = [
  {
    id: "one",
    record: "合成记录甲",
    amount: "9007199254740993.0100",
    related: "2 张",
    audit: "旧文本 -.x",
  },
  {
    id: "two",
    record: "合成记录乙",
    amount: "0.0000",
    related: "1 张",
    audit: "",
  },
  ...Array.from({ length: 60 }, (_, index) => ({
    id: `row-${index}`,
    record: `合成记录 ${index}`,
    amount: "1.0000",
    related: "1 张",
    audit: "合成原值",
  })),
  {
    id: "last",
    record: "合成末页",
    amount: "-12.3400",
    related: "1 张",
    audit: "历史原值",
  },
];
const columns: readonly ReportColumn<Row>[] = [
  { key: "record", label: "关联单号", width: "28rem" },
  {
    key: "amount",
    label: "精确金额 · 本次定义",
    type: "decimal",
    width: "25rem",
  },
  { key: "related", label: "关联记录", width: "20rem" },
  { key: "audit", label: "审计原值", width: "20rem" },
];
function presentation(
  all: readonly Row[],
  page: number,
  pageSize: number,
): ReportPresentation<Row, string> {
  const items = all.slice((page - 1) * pageSize, page * pageSize);
  return {
    rows: items.map((row) => ({
      rowId: row.id,
      cells: {
        amount: {
          foreground: "#112233",
          background: "#fefefe",
          bold: true,
          align: "right",
        },
      },
    })),
    groups: items.length
      ? [
          {
            id: "synthetic-group",
            label: "合成分组",
            level: 0,
            firstKey: items[0]!.id,
            lastKey: items.at(-1)!.id,
            continuedBefore: page > 1,
            continuedAfter: page * pageSize < all.length,
            summary: {
              caption: "全组小计 · 合成权威值",
              values: { amount: "9007199254741040.6700" },
            },
          },
        ]
      : [],
  };
}
const results = new Map<string, Row[]>();
const deadlines = new Map<string, number>();
// This synthetic authority defines and renews its deadline; ReportView has no application TTL.
function renew(id: ResultId) {
  const expiresAt = Date.now() + 60 * 60 * 1000;
  deadlines.set(id.snapshot, expiresAt);
  return expiresAt;
}
const jobs = new Map<string, { finish: () => void; cancelled: boolean }>();
let sequence = 0;
function check(id: ResultId) {
  if (validity.value !== "valid")
    throw new ReportUnavailable(validity.value, "合成结果已失效或撤权");
  const all = results.get(id.snapshot);
  if (!all) throw new ReportUnavailable("expired", "合成结果不存在");
  if ((deadlines.get(id.snapshot) ?? 0) <= Date.now())
    throw new ReportUnavailable("expired", "合成结果期限已到");
  return all;
}
function finish() {
  for (const job of jobs.values()) job.finish();
}
onBeforeUnmount(finish);
const definition = defineReport<Parameters, Row, ResultId, string, Target>({
  kind: "fixed",
  resource: "synthetic-fixed",
  title: "合成报表 · 固定结果",
  parameters: [{ key: "keyword", label: "固定关键字", type: "text" }],
  initialParameters: () => ({ keyword: "" }),
  describeParameters: ({ keyword }) => keyword || "全部",
  rowKey: (row) => row.id,
  columns: [
    { key: "record", label: "关联单号", width: "28rem" },
    { key: "amount", label: "精确金额", type: "decimal", width: "25rem" },
    { key: "related", label: "关联记录", width: "20rem" },
    { key: "audit", label: "审计原值", width: "20rem" },
  ],
  cell: (row, key) =>
    key === "record"
      ? {
          kind: "record",
          href: `#synthetic-${row.id}`,
          target: { record: row.id },
          label: `查看 ${row.record}`,
        }
      : key === "amount"
        ? {
            kind: "detail",
            target: { record: row.id },
            label: `明细 ${row.record}`,
          }
        : key === "related"
          ? {
              kind: "select",
              target: { record: row.id },
              label: `选择 ${row.record}`,
            }
          : undefined,
  adapter: {
    async query({ parameters, requestId, page, pageSize }) {
      const mode = scenario.value;
      if (mode === "pending") {
        let finish!: () => void;
        const wait = new Promise<void>((resolve) => {
          finish = resolve;
        });
        const job = { finish, cancelled: false };
        jobs.set(requestId, job);
        await wait;
        jobs.delete(requestId);
        if (job.cancelled) throw new Error("合成查询已取消");
      }
      if (mode === "failure") throw new Error("合成新查询失败");
      if (mode === "expired")
        throw new ReportUnavailable("expired", "合成结果已过期");
      const all =
        mode === "empty"
          ? []
          : rows.filter((row) => row.record.includes(parameters.keyword));
      const id = { snapshot: `synthetic-${++sequence}` };
      results.set(id.snapshot, all);
      return {
        id,
        columns,
        expiresAt: renew(id),
        presentation: presentation(all, page, pageSize),
        items: all.slice((page - 1) * pageSize, page * pageSize),
        total: all.length,
        summary: {
          caption:
            "服务端全结果合计 · 合成权威值（用于核对身份绑定，不计算当前页）",
          values: { amount: "9007199254741040.6700" },
        },
        context: `采用关键字：${parameters.keyword || "全部"} · 业务日期由消费者提供`,
      };
    },
    async page({ resultId, page, pageSize }) {
      const all = check(resultId);
      if (scenario.value === "failure") throw new Error("合成翻页失败");
      return {
        expiresAt: renew(resultId),
        presentation: presentation(all, page, pageSize),
        items: all.slice((page - 1) * pageSize, page * pageSize),
        total: all.length,
      };
    },
    async export({ resultId }) {
      const all = check(resultId);
      return {
        content: new Blob([
          all.map((row) => `${row.record},${row.amount}`).join("\n"),
        ]),
        filename: `${resultId.snapshot}-complete.csv`,
      };
    },
    async revalidate({ resultId }) {
      if (scenario.value === "failure") throw new Error("合成重验连接失败");
      const status = results.has(resultId.snapshot)
        ? validity.value
        : "expired";
      if (status === "valid") check(resultId);
      return {
        status,
        ...(status === "valid" ? { expiresAt: renew(resultId) } : {}),
      };
    },
    async cancel({ requestId }) {
      const job = jobs.get(requestId);
      if (job && cancellation.value !== "cleanup-unconfirmed") {
        job.cancelled = cancellation.value === "cancelled";
        job.finish();
      }
      return { status: cancellation.value };
    },
  },
});
function drill(intent: ReportDrill<ResultId, string, Target>) {
  detail.value = `${intent.cell.kind} · ${intent.resultId.snapshot} · ${intent.rowId} · ${intent.cell.target.record}`;
  visible.value = false;
}
</script>
<template>
  <section aria-label="固定结果示例">
    <label
      >固定读取情景<select v-model="scenario" aria-label="固定读取情景">
        <option value="success">成功</option>
        <option value="failure">普通失败</option>
        <option value="empty">空结果</option>
        <option value="expired">过期</option>
        <option value="pending">可控待决查询</option>
      </select></label
    >
    <label
      >取消结果<select v-model="cancellation" aria-label="取消结果">
        <option value="cancelled">已取消</option>
        <option value="completed">已完成未取消</option>
        <option value="failed">执行失败</option>
        <option value="cleanup-unconfirmed">清理未确认</option>
      </select></label
    >
    <label
      >重验资格<select v-model="validity" aria-label="重验资格">
        <option value="valid">有效</option>
        <option value="expired">过期</option>
        <option value="forbidden">撤权</option>
        <option value="identity-invalid">身份失效</option>
      </select></label
    >
    <label
      >固定会话<select v-model="scope" aria-label="固定会话">
        <option>synthetic-session-1</option>
        <option>synthetic-session-2</option>
      </select></label
    >
    <button type="button" @click="finish">完成待决查询</button>
    <button v-if="visible" type="button" @click="visible = false">
      离开并保存报表
    </button>
    <button v-else type="button" @click="visible = true">返回报表</button>
    <p v-if="!visible" role="status">消费者关联读取/路由接缝：{{ detail }}</p>
    <p aria-label="当前编辑条件">
      当前编辑条件：{{ currentParameters.keyword || "全部" }}
    </p>
    <p aria-label="外围采用结果">
      {{
        adoptedContext
          ? `外部已采用：${adoptedContext.resultId?.snapshot} · ${adoptedContext.parameters.keyword || "全部"}`
          : "未采用结果"
      }}
    </p>
    <ReportView
      v-if="visible"
      :definition="definition"
      :scope="scope"
      :permissions="{ query: true, export: true }"
      :page-size="25"
      :restore="saved"
      @snapshot="saved = $event"
      @parameters="currentParameters = $event"
      @adopted="adoptedContext = $event"
      @drill="drill"
    />
  </section>
</template>
