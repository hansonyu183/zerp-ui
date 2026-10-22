<script setup lang="ts" generic="M extends VoucherOperationModel, I, B">
import { computed, watch, onBeforeUnmount } from "vue";
import { operationSession } from "./voucher-operation-session";
import { voucherOperationLabels } from "./voucher-operation";
import type {
  VoucherOperationModel,
  VoucherOperationDefinition,
  VoucherOperationIntent,
} from "./voucher-operation";
const props = defineProps<{
  definition: VoucherOperationDefinition<M, I, B>;
  intent: VoucherOperationIntent<M, I>;
  eligible: boolean;
  recoveryAllowed: boolean;
}>();
const session = computed(() =>
  operationSession(props.definition, props.intent.owner),
);
const state = computed(() => session.value.state);
let generation = 0;
let attached: ReturnType<typeof operationSession<M, I, B>> | undefined;
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
    void attached.restore();
  },
  { immediate: true, flush: "sync" },
);
watch(
  () => props.intent.identity,
  () => {
    generation++;
    session.value.cancelPreview();
  },
  { deep: true, flush: "sync" },
);
watch(
  () => props.eligible,
  (allowed) => {
    if (!allowed) {
      generation++;
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
function prepare() {
  if (props.eligible) void session.value.prepare(props.intent, live());
}
function confirm() {
  const current = generation;
  void session.value.confirm(
    live(),
    () => current === generation && props.eligible,
  );
}
function resume() {
  const current = generation;
  if (props.recoveryAllowed)
    void session.value.resume(
      () => current === generation && props.recoveryAllowed,
    );
}
onBeforeUnmount(() => {
  generation++;
  session.value.cancelPreview();
});
</script>
<template>
  <section class="zerp-ui" aria-label="单据办理">
    <p role="status">{{ state.notice }}</p>
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
      @click="session.restore(true)"
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
        确认{{ voucherOperationLabels[state.prepared.action] }}</button
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
            ? "封存原请求"
            : "核实原请求"
      }}
    </button>
  </section>
</template>
