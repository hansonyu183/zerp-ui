<script setup lang="ts" generic="M extends Model, I, B">
// Throwaway interaction probe for #24; replace with VoucherView's operation branch in implementation.
import { ref, shallowRef, watch, onBeforeUnmount, toRaw } from "vue";
import { actionLabels, sameOwner } from "./contract";
import type {
  Model,
  Definition,
  Intent,
  Request,
  Journal,
  Receipt,
} from "./contract";
const props = defineProps<{
  definition: Definition<M, I, B>;
  intent: Intent<M, I>;
  eligible: boolean;
}>();
const prepared = shallowRef<Request<M, I, B>>();
const journal = shallowRef<Journal<M, I, B>>();
const phase = ref<
  | "loading"
  | "idle"
  | "preview"
  | "pending"
  | "unknown"
  | "seal"
  | "refresh"
  | "blocked"
>("loading");
const busy = ref(false),
  notice = ref("");
let generation = 0;
const copy = <T,>(value: T): T => structuredClone(toRaw(value));
const message = (e: unknown) =>
  e instanceof Error ? e.message : "合成请求失败";
function context() {
  return {
    generation,
    definition: props.definition,
    owner: copy(props.intent.owner),
  };
}
type Context = ReturnType<typeof context>;
function current(c: Context) {
  return c.generation === generation;
}
function accepted(c: Context, request: Request<M, I, B>, receipt: Receipt<M>) {
  return (
    sameOwner(request.owner, receipt.owner) &&
    request.action === receipt.action &&
    request.requestId === receipt.requestId &&
    request.binding === receipt.binding &&
    c.definition.adapter.accepts(copy(request), copy(receipt))
  );
}
async function load() {
  const c = context();
  phase.value = "loading";
  busy.value = true;
  prepared.value = undefined;
  journal.value = undefined;
  notice.value = "";
  try {
    const stored = await c.definition.persistence.load(c.owner);
    if (!current(c)) return;
    if (
      stored &&
      (!sameOwner(stored.request.owner, c.owner) ||
        (stored.receipt && !accepted(c, stored.request, stored.receipt)))
    )
      throw new Error("恢复记录归属或回执不匹配；保留原记录，禁止新办理。");
    journal.value = stored ? copy(stored) : undefined;
    phase.value = !stored
      ? "idle"
      : !stored.receipt
        ? "unknown"
        : stored.receipt.status === "not-applied" && !stored.receipt.sealed
          ? "seal"
          : "refresh";
    notice.value = stored
      ? `已恢复原请求 ${stored.request.requestId}，不会重新执行。`
      : "可以准备办理。";
  } catch (e) {
    if (current(c)) {
      phase.value = "blocked";
      notice.value = message(e);
    }
  } finally {
    if (current(c)) busy.value = false;
  }
}
async function prepare() {
  if (phase.value !== "idle" || busy.value || !props.eligible) return;
  const c = context(),
    intent = copy(props.intent);
  busy.value = true;
  notice.value = "正在准备完整预览。";
  try {
    const value = await c.definition.adapter.prepare(copy(intent));
    if (!current(c)) return;
    if (
      !sameOwner(value.owner, intent.owner) ||
      value.action !== intent.action ||
      !c.definition.adapter.acceptsPreparation(copy(intent), copy(value))
    )
      throw new Error("准备结果不匹配。");
    prepared.value = copy(value);
    phase.value = "preview";
    notice.value = "尚未执行业务写入；确认将采用本次原输入和并发事实。";
  } catch (e) {
    if (current(c)) notice.value = message(e);
  } finally {
    if (current(c)) busy.value = false;
  }
}
async function refresh(c: Context, record: Journal<M, I, B>) {
  await c.definition.adapter.refresh({
    owner: record.request.owner,
    identity: record.request.identity,
  });
  await c.definition.persistence.remove(
    record.request.owner,
    record.request.requestId,
  );
  if (current(c)) {
    journal.value = undefined;
    prepared.value = undefined;
    phase.value = "idle";
    notice.value = "终态已保存且读取完成；可显式开始新请求。";
  }
}
async function receive(
  c: Context,
  record: Journal<M, I, B>,
  receipt: Receipt<M>,
) {
  if (!accepted(c, record.request, receipt))
    throw new Error("证据不匹配，原请求继续锁定。");
  const settled = {
    request: record.request,
    receipt: copy(receipt),
  } as Journal<M, I, B>;
  await c.definition.persistence.save(copy(settled), record.request.requestId);
  if (!current(c)) return; // Old owner keeps its durable terminal record; never refresh the new screen.
  journal.value = settled;
  prepared.value = undefined;
  phase.value =
    receipt.status === "not-applied" && !receipt.sealed ? "seal" : "refresh";
  notice.value =
    phase.value === "seal"
      ? "已确认未应用，必须封存原请求。"
      : "已确认终态，正在读取。";
  if (phase.value === "refresh") await refresh(c, settled);
}
async function confirm() {
  if (
    phase.value !== "preview" ||
    !prepared.value ||
    busy.value ||
    !props.eligible
  )
    return;
  const c = context(),
    record = { request: copy(prepared.value) } as Journal<M, I, B>;
  busy.value = true;
  notice.value = "正在可靠保存原请求。";
  try {
    try {
      await c.definition.persistence.save(copy(record), null);
    } catch (e) {
      if (current(c)) {
        phase.value = "blocked";
        prepared.value = undefined;
        notice.value = `保存失败，本次未发送写入：${message(e)}；先重试恢复确认存储槽。`;
      }
      return;
    }
    if (!current(c)) return; // A reserved but unsent request is recovered/reconciled, never silently discarded.
    journal.value = record;
    prepared.value = undefined;
    phase.value = "pending";
    const outcome = await c.definition.adapter.execute(copy(record.request));
    if (outcome.status === "unknown") {
      if (current(c)) {
        phase.value = "unknown";
        notice.value = "结果未知；查询、关闭或取消均不能解锁。";
      }
    } else await receive(c, record, outcome);
  } catch (e) {
    if (current(c)) {
      if (phase.value === "pending") phase.value = "unknown";
      notice.value = message(e);
    }
  } finally {
    if (current(c)) busy.value = false;
  }
}
async function resume() {
  if (!journal.value || busy.value) return;
  const c = context(),
    record = copy(journal.value);
  busy.value = true;
  try {
    if (phase.value === "refresh") {
      await refresh(c, record);
      return;
    }
    const outcome =
      phase.value === "seal" && record.receipt
        ? await c.definition.adapter.seal(
            copy(record.request),
            copy(record.receipt),
          )
        : await c.definition.adapter.reconcile(copy(record.request));
    if (outcome.status === "unknown") {
      if (current(c)) notice.value = "证据不足，原请求继续锁定。";
    } else await receive(c, record, outcome);
  } catch (e) {
    if (current(c)) notice.value = message(e);
  } finally {
    if (current(c)) busy.value = false;
  }
}
function cancelPreview() {
  if (!busy.value && phase.value === "preview") {
    prepared.value = undefined;
    phase.value = "idle";
    notice.value = "已取消本地预览，未发送写入。";
  }
}
watch(
  [
    () => props.intent.owner.scope,
    () => props.intent.owner.operator,
    () => props.intent.owner.resource,
    () => props.intent.identity,
    () => props.definition,
  ],
  () => {
    generation++;
    void load();
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <section aria-label="办理契约原型">
    <p>可丢弃原型 · 拟扩展 VoucherView · 非发布能力</p>
    <p role="status">阶段：{{ phase }} · {{ notice }}</p>
    <p v-if="journal">
      原请求：{{ journal.request.requestId }} ·
      {{ journal.request.owner.operator }} ·
      {{ actionLabels[journal.request.action] }}
    </p>
    <button
      type="button"
      :disabled="busy || phase !== 'idle' || !eligible"
      @click="prepare"
    >
      准备{{ actionLabels[intent.action] }}
    </button>
    <button
      v-if="phase === 'blocked'"
      type="button"
      :disabled="busy"
      @click="load"
    >
      重试恢复
    </button>
    <div v-if="prepared" role="dialog" aria-label="完整办理预览">
      <h2>{{ prepared.preview.title }}</h2>
      <p>
        动作：{{ actionLabels[prepared.action] }} · 原请求：{{
          prepared.requestId
        }}
      </p>
      <section
        v-for="section in prepared.preview.sections"
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
      <button type="button" :disabled="busy || !eligible" @click="confirm">
        确认{{ actionLabels[prepared.action] }}
      </button>
      <button type="button" :disabled="busy" @click="cancelPreview">
        取消预览
      </button>
    </div>
    <button
      v-if="journal && phase !== 'pending'"
      type="button"
      :disabled="busy"
      @click="resume"
    >
      {{
        phase === "refresh"
          ? "重试读取"
          : phase === "seal"
            ? "封存原请求"
            : "核实原请求"
      }}
    </button>
  </section>
</template>
