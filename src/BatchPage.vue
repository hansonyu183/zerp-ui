<script setup lang="ts" generic="M extends OperationModel, I, B">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from "vue";
import OperationRuntime from "./OperationRuntime.vue";
import Feedback from "./Feedback.vue";
import { clone, message } from "./clone";
import { equalValues } from "./editor-values";
import type { OperationModel, OperationSettlement } from "./operation";
import type { BatchPage, BatchJournal } from "./batch";
import type { EditProtection } from "./edit-guard";
const props = defineProps<{ options: BatchPage<M, I, B>; scope: string }>();
const emit = defineEmits<{ protection: [state: EditProtection] }>();
const journal = shallowRef<BatchJournal<M, I, B> | null>(null),
  busy = ref(true),
  error = ref(""),
  ready = ref(false);
const runtime = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "blocked",
});
let alive = true;
const entry = computed(() => journal.value?.entries[journal.value.index]);
const displayed = computed(
  () =>
    journal.value?.entries ??
    props.options.entries.map((e) => ({
      ...e,
      settlement: undefined,
      skipped: undefined,
    })),
);
const terminal = computed(
  () => !!entry.value?.settlement || !!entry.value?.skipped,
);
const protection = computed<EditProtection>(() => ({
  dirty: !journal.value?.completed && (!!journal.value || runtime.value.dirty),
  localPending: busy.value || runtime.value.localPending,
  invalid: false,
  writeState:
    !ready.value || busy.value
      ? "blocked"
      : journal.value?.completed || !journal.value
        ? "idle"
        : runtime.value.writeState,
}));
watch(protection, (value) => emit("protection", value), {
  immediate: true,
  flush: "sync",
});
function check(value: BatchJournal<M, I, B>) {
  if (
    !value.id ||
    !equalValues(value.owner, props.options.owner) ||
    !Number.isInteger(value.index) ||
    value.index < 0 ||
    value.index >= value.entries.length ||
    !value.entries.length ||
    new Set(value.entries.map((e) => e.key)).size !== value.entries.length ||
    value.entries.some(
      (e) =>
        !e.key ||
        !equalValues(e.intent.owner, value.owner) ||
        (e.settlement &&
          (e.settlement.association?.kind !== "batch" ||
            e.settlement.association.batchId !== value.id ||
            e.settlement.association.entryKey !== e.key ||
            !equalValues(e.settlement.request.owner, value.owner) ||
            !equalValues(e.settlement.request.identity, e.intent.identity) ||
            !equalValues(e.settlement.request.input, e.intent.input) ||
            e.settlement.request.action !== e.intent.action ||
            e.settlement.receipt.requestId !== e.settlement.request.requestId ||
            e.settlement.receipt.binding !== e.settlement.request.binding ||
            e.settlement.receipt.action !== e.settlement.request.action ||
            !equalValues(
              e.settlement.receipt.owner,
              e.settlement.request.owner,
            ) ||
            (e.settlement.receipt.status !== "applied" &&
              !(
                e.settlement.receipt.status === "not-applied" &&
                e.settlement.receipt.sealed
              )) ||
            !props.options.definition.adapter.accepts(
              clone(e.settlement.request),
              clone(e.settlement.receipt),
            ))),
    ) ||
    (value.completed && value.entries.some((e) => !e.settlement && !e.skipped))
  )
    throw Error("批次记录不匹配，请重试恢复。");
}
async function load() {
  if (!props.options.recoveryAllowed && !props.options.eligible) {
    busy.value = false;
    error.value = "等待批量办理或恢复资格，请获权后重试恢复。";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const value = await props.options.persistence.load(
      clone(props.options.owner),
    );
    if (!alive) return;
    if (!props.options.recoveryAllowed && !props.options.eligible) {
      ready.value = false;
      error.value = "等待批量办理或恢复资格，请获权后重试恢复。";
      return;
    }
    if (value) check(value);
    journal.value = clone(value);
    ready.value = true;
  } catch (cause) {
    if (alive) {
      ready.value = false;
      error.value = message(cause);
    }
  } finally {
    if (alive) busy.value = false;
  }
}
async function save(value: BatchJournal<M, I, B>, expected: string | null) {
  check(value);
  await props.options.persistence.save(clone(value), expected);
  if (alive) journal.value = clone(value);
}
async function work(fn: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await fn();
  } catch (cause) {
    if (alive) {
      error.value = message(cause);
      ready.value = false;
    }
  } finally {
    if (alive) busy.value = false;
  }
}
async function start() {
  if (!ready.value || !props.options.eligible || !props.options.entries.length)
    return;
  await work(async () => {
    const value: BatchJournal<M, I, B> = {
      id: crypto.randomUUID(),
      owner: clone(props.options.owner),
      entries: clone(props.options.entries),
      index: 0,
    };
    await save(value, journal.value?.id ?? null);
  });
}
async function settled(value: OperationSettlement<M, I, B>) {
  const current = journal.value,
    selected = entry.value;
  if (!current || !selected || terminal.value || busy.value) return;
  if (
    value.association?.kind !== "batch" ||
    value.association.batchId !== current.id ||
    value.association.entryKey !== selected.key ||
    value.request.action !== selected.intent.action ||
    !equalValues(value.request.identity, selected.intent.identity) ||
    !equalValues(value.request.input, selected.intent.input) ||
    !equalValues(value.request.owner, current.owner)
  )
    return;
  await work(async () => {
    const entries = current.entries.map((e, i) =>
      i === current.index ? { ...e, settlement: clone(value) } : e,
    );
    await save({ ...current, entries }, current.id);
  });
}
async function next() {
  const current = journal.value;
  if (!current || !terminal.value || busy.value) return;
  await work(async () => {
    const index = current.entries.findIndex(
      (e, i) => i > current.index && !e.skipped && !e.settlement,
    );
    await save(
      index < 0 ? { ...current, completed: true } : { ...current, index },
      current.id,
    );
  });
}
async function stop() {
  const current = journal.value;
  if (
    !current ||
    busy.value ||
    runtime.value.writeState !== "idle" ||
    runtime.value.localPending
  )
    return;
  await work(async () => {
    const entries = current.entries.map((e, i) =>
      i >= current.index && !e.settlement
        ? { ...e, skipped: true as const }
        : e,
    );
    await save({ ...current, entries, completed: true }, current.id);
  });
}
watch(
  () => props.options.recoveryAllowed || props.options.eligible,
  (allowed) => {
    if (allowed && !ready.value && !busy.value) void load();
  },
);
void load();
onBeforeUnmount(() => {
  alive = false;
});
</script>
<template>
  <section aria-label="批量办理">
    <Feedback :message="error" kind="error" persistent
      ><button
        type="button"
        :disabled="busy || (!options.recoveryAllowed && !options.eligible)"
        @click="load"
      >
        重试恢复批次
      </button></Feedback
    >
    <p>每项分别预览、确认和提交。结果未确认时不能继续下一项。</p>
    <ul>
      <li v-for="item in displayed" :key="item.key">
        {{ item.label
        }}<template v-if="item.settlement">
          ·
          {{
            item.settlement.receipt.status === "applied"
              ? "已完成"
              : "已确认未应用"
          }}</template
        ><template v-else-if="item.skipped"> · 已停止</template>
      </li>
    </ul>
    <button
      v-if="!journal || journal.completed"
      type="button"
      :disabled="busy || !ready || !options.eligible || !options.entries.length"
      @click="start"
    >
      建立批次
    </button>
    <template v-else-if="entry && ready"
      ><h2>{{ entry.label }}</h2>
      <OperationRuntime
        :key="journal.index"
        :definition="options.definition"
        :intent="entry.intent"
        :association="{
          kind: 'batch',
          batchId: journal.id,
          entryKey: entry.key,
        }"
        :eligible="options.eligible && !terminal && !busy"
        :recovery-allowed="options.recoveryAllowed"
        @protection="runtime = $event"
        @settled="settled"
      /><button type="button" :disabled="busy || !terminal" @click="next">
        继续下一项</button
      ><button
        type="button"
        :disabled="
          busy || runtime.writeState !== 'idle' || runtime.localPending
        "
        @click="stop"
      >
        停止剩余操作
      </button></template
    >
  </section>
</template>
