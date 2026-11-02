<script setup lang="ts" generic="I, N, R, T, D, A extends object, E = never">
import type { EditProtection } from "./edit-guard";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import Feedback from "./Feedback.vue";
import {
  VProgressLinear,
  VBtn,
  VTextField,
  VSelect,
  VCard,
  VCardText,
} from "vuetify/components";
import type { Page } from "./contracts";
import type {
  WorkflowAction,
  WorkflowAttempt,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNode,
} from "./workflow";
import { clone, message } from "./clone";
import { writeLock } from "./write-lock";
import DataList from "./DataList.vue";
const props = defineProps<{
  definition: WorkflowDefinition<I, N, R, T, D, A, E>;
  scope: string;
  discardVersion?: number;
  permissions: {
    read: boolean;
    audit: boolean;
    reconcile?: boolean;
    actions: readonly WorkflowAction[];
    targets: readonly string[];
  };
}>();
const emit = defineEmits<{
  "open-voucher": [voucher: D];
  protection: [state: EditProtection];
}>();
const result = shallowRef<Page<{ identity: I; label: string }>>({
  items: [],
  total: 0,
});
const instance = shallowRef<WorkflowInstance<I, N, R, T, D> | null>(null);
const audit = shallowRef<readonly A[]>([]);
const selected = shallowRef<{ identity: I } | null>(null);
const keyword = ref(""),
  applied = ref(""),
  reason = ref(""),
  page = ref(1),
  loading = ref(false),
  verifying = ref(false),
  error = ref(""),
  notice = ref("");
const targets = ref<Record<number, string>>({});
const captions: Record<WorkflowAction, string> = {
  OPEN_VOUCHER: "打开单据",
  CREATE_CHILD: "创建下级",
  APPROVE_CHILD: "批准下级",
  REJECT_CHILD: "驳回下级",
  RETRY_CHILD: "重试下级",
  CANCEL_CHILD: "取消下级",
};
const lock = computed(() =>
  writeLock<never, never, WorkflowAttempt<I, N, R, T, D>>(
    props.definition.adapter,
    `workflow:${props.definition.resource}`,
    props.scope,
  ),
);
const blocked = computed(() => lock.value.phase !== "idle");
watch(
  () => ({
    dirty: !!reason.value,
    localPending: false,
    invalid: false,
    writeState: lock.value.phase,
  }),
  (value) => emit("protection", value),
  { immediate: true, flush: "sync" },
);
watch(
  () => props.discardVersion,
  () => {
    if (lock.value.phase === "idle") reason.value = "";
  },
);
let generation = 0,
  request = 0,
  active = true;
const current = (g: number) => active && g === generation;
function availableTargets(node: WorkflowNode<N, R, T, D>) {
  return node.targets.filter((t) => props.permissions.targets.includes(t.key));
}
function actions(node: WorkflowNode<N, R, T, D>) {
  return (Object.keys(captions) as WorkflowAction[]).filter(
    (action) =>
      node.eligible.includes(action) &&
      props.permissions.actions.includes(action) &&
      (action !== "OPEN_VOUCHER" || node.voucher !== undefined) &&
      (action !== "CREATE_CHILD" || availableTargets(node).length > 0),
  );
}
async function read(next = page.value, submit = false) {
  if (!props.permissions.read || lock.value.phase === "pending") return;
  if (submit) applied.value = keyword.value;
  const g = generation,
    q = ++request,
    definition = props.definition,
    scope = props.scope,
    selection = selected.value,
    target = lock.value,
    attempt = target.attempt;
  loading.value = true;
  error.value = "";
  // A failed read must not leave actionable stale node facts.
  instance.value = null;
  audit.value = [];
  try {
    const [rows, detail, events] = await Promise.all([
      definition.adapter.list({
        scope,
        keyword: applied.value,
        page: next,
        pageSize: 20,
      }),
      selection
        ? definition.adapter.get({ scope, identity: clone(selection.identity) })
        : null,
      selection && props.permissions.audit
        ? definition.adapter.audit({
            scope,
            identity: clone(selection.identity),
          })
        : [],
    ]);
    if (!current(g) || q !== request) return;
    result.value = clone(rows);
    instance.value = clone(detail);
    audit.value = clone(events);
    page.value = next;
    targets.value = {};
    if (target.phase === "refresh" && target.attempt === attempt) {
      target.phase = "idle";
      target.attempt = null;
    }
  } catch (e) {
    if (current(g) && q === request) error.value = message(e);
  } finally {
    if (current(g) && q === request) loading.value = false;
  }
}
function select(identity: I) {
  if (!props.permissions.read || lock.value.phase === "pending") return;
  generation++;
  verifying.value = false;
  selected.value = { identity: clone(identity) };
  reason.value = "";
  targets.value = {};
  void read();
}
function close() {
  if (lock.value.phase === "pending") return;
  generation++;
  verifying.value = false;
  request++;
  selected.value = null;
  instance.value = null;
  audit.value = [];
  loading.value = false;
}
async function act(
  node: WorkflowNode<N, R, T, D>,
  operation: WorkflowAction,
  index: number,
) {
  if (
    !instance.value ||
    !props.permissions.read ||
    blocked.value ||
    loading.value ||
    !actions(node).includes(operation)
  )
    return;
  const targetValue = availableTargets(node).find(
    (t) => t.key === targets.value[index],
  );
  if (operation === "CREATE_CHILD" && !targetValue) return;
  const base = {
    id: crypto.randomUUID(),
    scope: props.scope,
    resource: props.definition.resource,
    instance: clone(instance.value.identity),
    node: clone(node.identity),
    revision: clone(node.revision),
    reason: reason.value,
  };
  const attempt: WorkflowAttempt<I, N, R, T, D> = Object.freeze(
    operation === "CREATE_CHILD"
      ? { ...base, operation, target: clone(targetValue!.identity) }
      : operation === "OPEN_VOUCHER"
        ? { ...base, operation, voucher: clone(node.voucher!) }
        : { ...base, operation },
  );
  const target = lock.value,
    definition = props.definition,
    g = generation;
  target.attempt = attempt;
  target.phase = "pending";
  request++;
  error.value = "";
  notice.value = "";
  try {
    const outcome = await definition.adapter.act(clone(attempt));
    if (outcome.status === "success") {
      target.phase = "refresh";
      if (current(g)) {
        notice.value = "节点动作已成功。";
        await read();
        if (current(g) && attempt.operation === "OPEN_VOUCHER")
          emit("open-voucher", clone(attempt.voucher));
      }
    } else if (outcome.status === "failure") {
      target.phase = "idle";
      target.attempt = null;
      if (current(g)) error.value = outcome.message;
    } else {
      target.phase = "unknown";
      if (current(g)) error.value = outcome.message ?? "节点动作结果未知。";
    }
  } catch {
    target.phase = "unknown";
    if (current(g)) error.value = "节点动作结果未知。";
  }
}
async function reconcile() {
  const target = lock.value,
    attempt = target.attempt,
    verify = props.definition.reconcile,
    g = generation;
  if (
    target.phase !== "unknown" ||
    !attempt ||
    !verify ||
    !props.permissions.read ||
    !props.permissions.audit ||
    !props.permissions.reconcile ||
    verifying.value
  )
    return;
  verifying.value = true;
  try {
    const outcome = await verify(clone(attempt));
    if (!current(g) || target.attempt !== attempt || target.phase !== "unknown")
      return;
    if (
      outcome.status !== "unknown" &&
      outcome.attemptId === attempt.id &&
      outcome.evidence != null
    ) {
      if (outcome.status === "applied") {
        target.phase = "refresh";
        notice.value = "已核实节点动作成功。";
        await read();
      } else {
        target.phase = "idle";
        target.attempt = null;
        notice.value = "已确认本次请求未应用。";
      }
    } else notice.value = "证据不足，结果仍未知。";
  } catch (e) {
    if (current(g)) error.value = message(e);
  } finally {
    if (current(g)) verifying.value = false;
  }
}
watch(
  [
    () => props.scope,
    () => props.definition,
    () => props.permissions.read,
    () => props.permissions.audit,
    () => props.permissions.reconcile,
  ],
  () => {
    generation++;
    generation++;
    verifying.value = false;
    request++;
    selected.value = null;
    instance.value = null;
    audit.value = [];
    result.value = { items: [], total: 0 };
    keyword.value =
      applied.value =
      reason.value =
      error.value =
      notice.value =
        "";
    targets.value = {};
    page.value = 1;
    loading.value = verifying.value = false;
    void read(1);
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => {
  active = false;
  generation++;
  request++;
});
</script>
<template>
  <section class="zerp-ui" :aria-label="definition.title">
    <form v-if="permissions.read" @submit.prevent="read(1, true)">
      <VTextField
        label="流程关键字"
        v-model="keyword"
        aria-label="流程关键字"
      />
      <VBtn type="submit" :disabled="loading || lock.phase === 'pending'"
        >查询</VBtn
      >
    </form>
    <div class="zerp-progress-reserve">
      <VProgressLinear v-if="loading" indeterminate aria-label="加载中" />
    </div>
    <div class="zerp-feedback-region">
      <Feedback :message="error" kind="error" />
      <Feedback :message="notice" />
      <Feedback
        :message="lock.phase === 'unknown' ? '请求结果未知' : undefined"
        kind="warning"
        persistent
      >
        节点动作结果未知，普通刷新或关闭不能解锁。
        <VBtn
          v-if="
            definition.reconcile &&
            permissions.read &&
            permissions.audit &&
            permissions.reconcile
          "
          :disabled="verifying"
          @click="reconcile"
        >
          核实本次请求
        </VBtn>
      </Feedback>
      <Feedback
        :message="lock.phase === 'refresh' ? '等待读取权威结果' : undefined"
        kind="warning"
        persistent
      >
        节点动作已成功，请重试读取；不会再次提交。
      </Feedback>
    </div>
    <VBtn
      variant="text"
      color=""
      v-if="permissions.read"
      :disabled="loading || lock.phase === 'pending'"
      @click="read()"
    >
      重试读取
    </VBtn>
    <DataList
      :columns="[{ key: 'label', label: '流程实例' }]"
      :result="result"
      :page="page"
      :page-size="20"
      :loading="loading"
      @page="read($event)"
    />
    <template v-if="permissions.read">
      <VBtn
        variant="text"
        color=""
        v-for="(row, index) in result.items"
        :key="index"
        :disabled="lock.phase === 'pending'"
        @click="select(row.identity)"
      >
        查看 {{ row.label }}
      </VBtn>
    </template>
    <VBtn
      variant="text"
      color=""
      v-if="selected"
      :disabled="lock.phase === 'pending'"
      @click="close"
    >
      关闭实例
    </VBtn>
    <section v-if="instance" aria-label="流程节点">
      <h2>{{ instance.label }}</h2>
      <VTextField
        label="操作原因"
        v-model="reason"
        aria-label="操作原因"
        :disabled="blocked"
      />
      <VCard
        tag="section"
        class="mb-4"
        v-for="(node, index) in instance.nodes"
        :key="index"
        :aria-label="node.label"
      >
        <VCardText>
          <h3>{{ node.label }}</h3>
          <p>{{ node.state }}</p>
          <VSelect
            v-if="actions(node).includes('CREATE_CHILD')"
            v-model="targets[index]"
            :label="`${node.label}创建目标`"
            :aria-label="`${node.label}创建目标`"
            :disabled="blocked"
            :items="availableTargets(node)"
            item-value="key"
            item-title="label"
            placeholder="选择目标"
          />
          <VBtn
            v-for="action in actions(node)"
            :key="action"
            :disabled="
              blocked ||
              loading ||
              (action === 'CREATE_CHILD' &&
                !availableTargets(node).some((t) => t.key === targets[index]))
            "
            @click="act(node, action, index)"
          >
            {{ captions[action] }}
          </VBtn>
        </VCardText>
      </VCard>
      <section v-if="permissions.audit" aria-label="运行审计">
        <h2>运行审计</h2>
        <DataList
          :columns="definition.auditColumns"
          :result="{ items: [...audit], total: audit.length }"
          :page="1"
          :page-size="Math.max(1, audit.length)"
        />
      </section>
    </section>
  </section>
</template>
