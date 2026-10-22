<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { VoucherView, VoucherEditor, type VoucherEditorValue } from "@zerp/ui";
import {
  voucherOperationLabels,
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
  editorPending = ref(false),
  result = ref<{
    voucher: string;
    deleted: boolean;
    note: string;
    rows: typeof rows.value;
  } | null>(null);
const identity = computed<Identity>(() => ({
  voucher: action.value === "create" ? null : target.value,
}));
const recovered = ref<VoucherOperationIntent<SyntheticModel, Identity> | null>(
  null,
);
watch(operator, () => {
  result.value = null;
  recovered.value = null;
});
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
function showResult({
  request,
  receipt,
}: VoucherOperationSettlement<SyntheticModel, Identity, Baseline>) {
  if (receipt.status === "not-applied") {
    if (request.action === "create" || request.action === "edit")
      recovered.value = request;
    return;
  }
  if (receipt.status !== "applied" || !("result" in receipt.evidence)) return;
  if (!receipt.evidence.result.voucher) throw new Error("合成权威结果缺少身份");
  result.value = {
    ...receipt.evidence.result,
    voucher: receipt.evidence.result.voucher,
    note: request.input.note,
    rows: "rows" in request.input ? [...request.input.rows] : [],
  };
}
function restoreContent() {
  const original = recovered.value;
  if (!original || !("rows" in original.input)) return;
  target.value = original.identity.voucher ?? "";
  note.value = original.input.note;
  rows.value = original.input.rows.map((row) => ({ ...row }));
  action.value = original.action;
  recovered.value = null;
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
function editResult() {
  if (!result.value || result.value.deleted) return;
  target.value = result.value.voucher;
  note.value = result.value.note;
  rows.value = [...result.value.rows];
  action.value = "edit";
}
</script>
<template>
  <section aria-label="单据办理消费者">
    <h2>独立单据办理示例 · #25</h2>
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
    <label>原输入<input v-model="note" aria-label="原输入" /></label>
    <label
      >目标单据<input
        v-model="target"
        aria-label="目标单据"
        :disabled="action === 'create'"
    /></label>
    <VoucherEditor
      v-if="action === 'create' || action === 'edit'"
      v-model="editor"
      :header-fields="[{ key: 'note', label: '内容备注', type: 'text' }]"
      :row-fields="[{ key: 'quantity', label: '内容数量', type: 'decimal' }]"
      :columns="[{ key: 'quantity', label: '内容数量', type: 'decimal' }]"
      :row-key="(row) => row.key"
      :empty-row="emptyContentRow"
      scope="synthetic-session"
      mode="edit"
      @pending="editorPending = $event"
    />
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
    <button v-if="recovered" @click="restoreContent">恢复原内容</button>
    <VoucherView
      v-if="visible"
      :definition="definition"
      :intent="intent"
      :eligible="eligible && !editorPending"
      :recovery-allowed="recoveryAllowed"
      @settled="showResult"
    />
    <section v-if="result" aria-label="合成内容结果">
      <p>{{ result.deleted ? "已删除" : "权威结果" }}：{{ result.voucher }}</p>
      <p>{{ result.note }}</p>
      <p v-for="row in result.rows" :key="row.key">{{ row.quantity }}</p>
      <button v-if="!result.deleted" @click="editResult">编辑此结果</button>
    </section>
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
  </section>
</template>
