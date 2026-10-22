<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import { VoucherView } from "@zerp/ui";
import {
  voucherOperationLabels,
  type VoucherOperationAction,
  type VoucherOperationIntent,
} from "@zerp/ui";
import {
  synthetic,
  decodeJournal,
  type SyntheticModel,
  type Identity,
  type Scenario,
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
const identity: Identity = { voucher: "SYN-25" };
const definition = synthetic(
  localStorage,
  () => scenario.value,
  (event) => events.value.push(event),
);
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
  remove: durable.persistence.remove,
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
    identity,
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
  () => ({
    action: action.value,
    identity,
    owner: {
      operator: operator.value,
      scope: "synthetic-session",
      resource: "synthetic-voucher",
    },
    input: { note: note.value },
  }),
);
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
      @click="definition.adapter.refresh({ owner: intent.owner, identity })"
    >
      普通读取
    </button>
    <button type="button" @click="visible = !visible">
      {{ visible ? "卸载演示" : "恢复演示" }}
    </button>
    <VoucherView
      v-if="visible"
      :definition="definition"
      :intent="intent"
      :eligible="eligible"
      :recovery-allowed="recoveryAllowed"
    />
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
