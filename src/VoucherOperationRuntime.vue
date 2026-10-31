<script setup lang="ts" generic="M extends VoucherOperationModel, I, B">
import { computed, watch, onBeforeUnmount } from "vue";
import { operationSession } from "./voucher-operation-session";
import { clone } from "./clone";
import { voucherOperationLabels } from "./voucher-operation";
import type {
  VoucherOperationHandle,
  VoucherOperationModel,
  VoucherOperationDefinition,
  VoucherOperationIntent,
  VoucherOperationSettlement,
} from "./voucher-operation";
import type { EditProtection } from "./edit-guard";
const props = defineProps<{
  definition: VoucherOperationDefinition<M, I, B>;
  intent: VoucherOperationIntent<M, I>;
  eligible: boolean;
  recoveryAllowed: boolean;
}>();
const emit = defineEmits<{
  protection: [state: EditProtection];
  settled: [settlement: VoucherOperationSettlement<M, I, B>];
}>();
const session = computed(() =>
  operationSession(props.definition, props.intent.owner),
);
const state = computed(() => session.value.state);
const protection = computed<EditProtection>(() => {
  const phase = state.value.phase;
  return {
    dirty: phase === "preview" && !!state.value.prepared,
    localPending: phase === "preparing",
    invalid: false,
    writeState:
      phase === "pending" || (phase === "preview" && state.value.busy)
        ? "pending"
        : phase === "unknown" || phase === "seal" || phase === "refresh"
          ? phase
          : phase === "loading" || phase === "blocked"
            ? "blocked"
            : "idle",
  };
});
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
let generation = 0;
let attached: ReturnType<typeof operationSession<M, I, B>> | undefined;
function publish(
  current: number,
  target: ReturnType<typeof operationSession<M, I, B>>,
) {
  if (
    current === generation &&
    target === session.value &&
    (props.eligible || props.recoveryAllowed) &&
    target.state.settlement
  )
    emit("settled", clone(target.state.settlement));
}
async function restore(force = false) {
  const current = generation,
    target = session.value;
  await target.restore(force);
  publish(current, target);
}
watch(
  [
    () => props.intent.owner.scope,
    () => props.intent.owner.operator,
    () => props.intent.owner.resource,
    () => props.definition.persistence,
  ],
  () => {
    generation++;
    attached?.cancelPreview();
    attached = session.value;
    void restore();
  },
  { immediate: true, flush: "sync" },
);
watch(
  () => props.intent.identity,
  () => {
    // An authoritative read may adopt a created identity. Its original journal
    // still owns completion; an earlier target switch must not refresh a new target.
    if (state.value.phase !== "refresh") generation++;
    session.value.cancelPreview();
  },
  { deep: true, flush: "sync" },
);
watch(
  [() => props.intent.input, () => props.intent.action],
  () => {
    if (!state.value.journal) generation++;
    session.value.cancelPreview();
  },
  { deep: true, flush: "sync" },
);
watch(
  () => props.eligible,
  (allowed) => {
    if (!allowed) {
      if (!state.value.journal) generation++;
      session.value.cancelPreview();
    }
  },
  { flush: "sync" },
);
function live() {
  const current = generation;
  return () =>
    current === generation && (props.eligible || props.recoveryAllowed);
}
async function prepare() {
  if (props.eligible) await session.value.prepare(props.intent, live());
}
defineExpose<VoucherOperationHandle>({ prepare });
async function confirm() {
  const current = generation,
    target = session.value;
  await target.confirm(live(), () => current === generation && props.eligible);
  publish(current, target);
}
async function resume() {
  const current = generation,
    target = session.value;
  if (props.recoveryAllowed) {
    await target.resume(() => current === generation && props.recoveryAllowed);
    publish(current, target);
  }
}
onBeforeUnmount(() => {
  generation++;
  session.value.cancelPreview();
});
</script>
<template>
  <section
    v-if="eligible || recoveryAllowed"
    class="zerp-ui"
    aria-label="单据办理"
  >
    <p role="status">
      {{ state.notice }}
      <span v-if="state.journal">
        {{
          state.journal.receipt?.status === "applied"
            ? "已应用；原请求保持锁定直到读取及完成记录成功。"
            : state.journal.receipt?.status === "not-applied"
              ? state.journal.receipt.sealed
                ? "已确认未应用并封存；等待读取及完成记录。"
                : "已确认未应用；必须封存原请求。"
              : state.phase === "pending"
                ? "原请求处理中，暂不能开始新请求。"
                : "结果未知；须核实原请求。"
        }}
      </span>
    </p>
    <p v-if="state.busy" role="status">正在处理办理请求…</p>
    <p v-if="state.journal">
      原请求：{{ state.journal.request.requestId }} ·
      {{ voucherOperationLabels[state.journal.request.action] }}
    </p>
    <button
      type="button"
      :disabled="state.busy || state.phase !== 'idle' || !eligible"
      @click="prepare"
    >
      准备{{ voucherOperationLabels[intent.action] }}
    </button>
    <button
      v-if="state.phase === 'blocked'"
      type="button"
      :disabled="state.busy || !recoveryAllowed"
      @click="restore(true)"
    >
      重试恢复
    </button>
    <div
      v-if="state.prepared && eligible"
      role="dialog"
      aria-label="完整办理预览"
    >
      <h2>{{ state.prepared.preview.title }}</h2>
      <p>
        动作：{{ voucherOperationLabels[state.prepared.action] }} · 原请求：{{
          state.prepared.requestId
        }}
      </p>
      <section
        v-for="section in state.prepared.preview.sections"
        :key="section.key"
        :aria-label="section.title"
      >
        <h3>{{ section.title }}</h3>
        <dl v-for="row in section.rows" :key="row.key">
          <template v-for="field in row.fields" :key="field.label"
            ><dt>{{ field.label }}</dt>
            <dd>
              {{
                field.value === null
                  ? "—"
                  : field.value === ""
                    ? "（空字符串）"
                    : field.value
              }}
            </dd></template
          >
        </dl>
      </section>
      <button
        type="button"
        :disabled="state.busy || !eligible"
        @click="confirm"
      >
        {{
          definition.confirmationLabel ??
          `确认${voucherOperationLabels[state.prepared.action]}`
        }}</button
      ><button
        type="button"
        :disabled="state.busy"
        @click="session.cancelPreview()"
      >
        取消预览
      </button>
    </div>
    <button
      v-if="
        state.journal && ['unknown', 'seal', 'refresh'].includes(state.phase)
      "
      type="button"
      :disabled="state.busy || !recoveryAllowed"
      @click="resume"
    >
      {{
        state.phase === "refresh"
          ? "重试读取"
          : state.phase === "seal"
            ? (definition.sealLabel ?? "封存原请求")
            : (definition.reconcileLabel ?? "核实原请求")
      }}
    </button>
  </section>
  <p v-else role="status">无办理或核实权限。</p>
</template>
