<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import {
  defineVoucherOperationPage,
  type VoucherEditorValue,
  type VoucherEditorDefinition,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import {
  voucherOperationLabels,
  type EditProtection,
  type VoucherOperationAction,
  type VoucherOperationIntent,
  type VoucherOperationSettlement,
} from "@zerp/ui";
import {
  synthetic,
  decodeJournal,
  type SyntheticModel,
  type Identity,
  type Scenario,
  type Baseline,
} from "./operation-adapter";
import { operationJournal } from "./operation-journal";
const protection = ref<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "blocked",
});
const action = ref<VoucherOperationAction>("void"),
  operator = ref("synthetic-a"),
  note = ref("合成办理原因"),
  scenario = ref<Scenario>("success"),
  eligible = ref(true),
  recoveryAllowed = ref(true);
const visible = ref(true),
  events = ref<string[]>([]);
const target = ref("SYN-25"),
  rows = ref([{ key: "r1", quantity: "9007199254740993.0100" }]),
  result = ref<{
    voucher: string;
    deleted: boolean;
    note: string;
    rows: typeof rows.value;
  } | null>(null);
const identity = computed<Identity>(() => ({
  voucher: action.value === "create" ? null : target.value,
}));
watch(operator, () => (result.value = null));
const editor = computed<
  VoucherEditorValue<{ note: string }, { key: string; quantity: string }>
>({
  get: () => ({ header: { note: note.value }, rows: rows.value }),
  set: (value) => {
    note.value = value.header.note;
    rows.value = [...value.rows];
  },
});
const emptyContentRow = () => ({ key: crypto.randomUUID(), quantity: "" });
const definition = synthetic(
  localStorage,
  () => scenario.value,
  (event) => events.value.push(event),
);
definition.confirmationLabel = "确认本次办理";
definition.reconcileLabel = "核对原办理回执";
definition.sealLabel = "封存未应用办理";
function showResult({
  request,
  receipt,
}: VoucherOperationSettlement<SyntheticModel, Identity, Baseline>) {
  if (receipt.status !== "applied" || !("result" in receipt.evidence)) return;
  if (!receipt.evidence.result.voucher) throw new Error("合成权威结果缺少身份");
  result.value = {
    ...receipt.evidence.result,
    voucher: receipt.evidence.result.voucher,
    note: request.input.note,
    rows: "rows" in request.input ? [...request.input.rows] : [],
  };
}
const durable = operationJournal();
definition.persistence = {
  load: durable.persistence.load,
  save: async (record, expectedId) => {
    if (scenario.value === "save-failure") throw new Error("合成存储不可写");
    await durable.persistence.save(record, expectedId);
    events.value.push(
      `save:${record.request.requestId}:${record.receipt?.status ?? "unresolved"}`,
    );
  },
  remove: async (owner, requestId) => {
    if (scenario.value === "cleanup-failure")
      throw new Error("合成清理失败，原终态仍保留");
    await durable.persistence.remove(owner, requestId);
  },
};
async function verifyStorage() {
  const probe = synthetic(
    localStorage,
    () => "success",
    () => {},
  );
  const request = await probe.adapter.prepare({
    action: "void",
    owner: {
      scope: "synthetic-storage-check",
      operator: "synthetic-check",
      resource: crypto.randomUUID(),
    },
    identity: identity.value,
    input: { note: "合成存储验证" },
  });
  const receipt = {
    action: request.action,
    owner: request.owner,
    requestId: request.requestId,
    binding: request.binding,
    status: "not-applied",
    sealed: true,
    evidence: {
      action: request.action,
      receipt: `authority:${request.requestId}`,
    },
  };
  await durable.persistence.save(decodeJournal({ request }), null);
  await durable.persistence.save(
    decodeJournal({ request, receipt }),
    request.requestId,
  );
  for (const next of [
    { request },
    { request, receipt: { ...receipt, sealed: false } },
  ]) {
    let rejected = false;
    try {
      await durable.persistence.save(decodeJournal(next), request.requestId);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("存储允许封存终态回退");
  }
  const preserved = await durable.persistence.load(
    request.owner,
    request.requestId,
  );
  if (preserved?.receipt?.status !== "not-applied" || !preserved.receipt.sealed)
    throw new Error("封存证据未保留");
  await durable.persistence.save(
    decodeJournal({ request, receipt, refreshed: true }),
    request.requestId,
  );
  await durable.persistence.remove(request.owner, request.requestId);
  events.value.push("storage-check:已拒绝封存终态回退并保留原证据");
}
const close = () => durable.close();
window.addEventListener("pagehide", close, { once: true });
onBeforeUnmount(() => {
  window.removeEventListener("pagehide", close);
  close();
});
const intent = computed<VoucherOperationIntent<SyntheticModel, Identity>>(
  () => {
    const base = {
      identity: identity.value,
      owner: {
        operator: operator.value,
        scope: "synthetic-session",
        resource: "synthetic-voucher",
      },
    };
    return action.value === "create" || action.value === "edit"
      ? {
          ...base,
          action: action.value,
          input: {
            note: note.value,
            rows: rows.value.map((row) => ({ ...row })),
          },
        }
      : { ...base, action: action.value, input: { note: note.value } };
  },
);
type Header = { note: string };
type Row = { key: string; quantity: string };
const editorDefinition: VoucherEditorDefinition<Header, Row> = {
  headerFields: [{ key: "note", label: "原输入", type: "text" }],
  rowFields: [{ key: "quantity", label: "内容数量", type: "decimal" }],
  columns: [{ key: "quantity", label: "内容数量", type: "decimal" }],
  rowKey: (row) => row.key,
  emptyRow: emptyContentRow,
};
const page = defineVoucherOperationPage(() => ({
  title: "独立单据办理示例 · #25",
  definition,
  intent: intent.value,
  eligible: eligible.value,
  recoveryAllowed: recoveryAllowed.value,
  onProtection: (value: EditProtection) => (protection.value = value),
  onSettled: showResult,
  editor: {
    definition: editorDefinition,
    value: editor.value,
    toIntent: (
      content: VoucherEditorValue<Header, Row>,
      base: VoucherOperationIntent<SyntheticModel, Identity>,
    ): VoucherOperationIntent<SyntheticModel, Identity> =>
      base.action === "create" || base.action === "edit"
        ? {
            ...base,
            input: {
              note: content.header.note,
              rows: content.rows.map((row) => ({ ...row })),
            },
          }
        : { ...base, input: { note: content.header.note } },
    restore: (
      request: VoucherOperationSettlement<
        SyntheticModel,
        Identity,
        Baseline
      >["request"],
    ) =>
      "rows" in request.input
        ? { header: { note: request.input.note }, rows: request.input.rows }
        : null,
    adopt: (
      settlement: VoucherOperationSettlement<
        SyntheticModel,
        Identity,
        Baseline
      >,
    ) => {
      const { request, receipt } = settlement;
      if (
        receipt.status !== "applied" ||
        !("result" in receipt.evidence) ||
        receipt.evidence.result.deleted ||
        !receipt.evidence.result.voucher ||
        !("rows" in request.input)
      )
        return null;
      return {
        value: {
          header: { note: request.input.note },
          rows: request.input.rows,
        },
        intent: {
          ...request,
          action: "edit" as const,
          identity: { voucher: receipt.evidence.result.voucher },
          input: { note: request.input.note, rows: request.input.rows },
        },
      };
    },
  },
}));
</script>
<template>
  <section aria-label="单据办理消费者">
    <ExamplePage v-if="visible" :page="page" scope="synthetic-session" />
    <aside class="example-controls">
      <p>
        公开包入口与合成 Adapter，不连接真实业务 API。存储均以
        SYNTHETIC-OPERATIONS 标记。
      </p>
      <label
        >办理动作<select v-model="action" aria-label="办理动作">
          <option
            v-for="(label, key) in voucherOperationLabels"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select></label
      >
      <label
        >目标单据<input
          v-model="target"
          aria-label="目标单据"
          :disabled="action === 'create'"
      /></label>
      <label
        >操作者<select v-model="operator" aria-label="操作者">
          <option>synthetic-a</option>
          <option>synthetic-b</option>
        </select></label
      >
      <label
        >合成情景<select v-model="scenario" aria-label="合成情景">
          <option value="success">成功</option>
          <option value="unknown">未知后核实成功</option>
          <option value="not-applied">未应用待封存</option>
          <option value="wrong-proof">错误证据</option>
          <option value="refresh-failure">成功后刷新失败</option>
          <option value="save-failure">保存失败禁止写入</option>
          <option value="seal-failure">封存失败</option>
          <option value="no-evidence">证据不足</option>
          <option value="verification-failure">核实异常</option>
          <option value="cleanup-failure">读取后清理失败</option>
        </select></label
      >
      <label
        ><input
          v-model="eligible"
          type="checkbox"
          aria-label="办理资格"
        />办理资格</label
      >
      <label
        ><input
          v-model="recoveryAllowed"
          type="checkbox"
          aria-label="核实资格"
        />核实资格</label
      >
      <button
        type="button"
        @click="events.push(`read:${identity.voucher ?? 'new'}`)"
      >
        普通读取
      </button>
      <button type="button" @click="visible = !visible">
        {{ visible ? "卸载演示" : "恢复演示" }}
      </button>
      <output aria-label="办理保护状态">{{
        JSON.stringify(protection)
      }}</output>
      <output aria-label="合成 Adapter 结果">{{
        JSON.stringify(result)
      }}</output>
      <details open>
        <summary>合成 Adapter 观察记录</summary>
        <button type="button" @click="verifyStorage">验证合成存储终态</button>
        <ol>
          <li v-for="(event, index) in events" :key="index">{{ event }}</li>
        </ol>
      </details>
      <p>
        未知时可切换操作者、卸载/重挂载或刷新整页，再核实原请求；新请求只可在终态/封存与读取完成后显式开始。消费者
        IndexedDB 保存原请求，localStorage
        模拟合成回执；请仅在示例结束后清理这些合成存储。
      </p>
    </aside>
  </section>
</template>
