<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watchEffect } from "vue";
import {
  EditGuard,
  RecordDetails,
  VoucherEditor,
  type EditGuardHandle,
  type EditWriteState,
} from "@zerp/ui";
import {
  adapter,
  editor,
  groups,
  type RecordValue,
  type Related,
} from "./adapters";
const guard = ref<EditGuardHandle | null>(null);
const active = ref(true),
  present = ref(true),
  mode = ref<"read" | "edit">("read");
const scope = ref("synthetic-one"),
  instance = ref("one"),
  localPending = ref(false);
const writeState = ref<EditWriteState>("idle");
const record = shallowRef<RecordValue | null>(null),
  baseline = ref("");
const related = ref("");
let generation = 0;
async function load() {
  const epoch = ++generation;
  const value = await adapter.read({ scope: scope.value, id: instance.value });
  if (epoch !== generation || !active.value) return;
  record.value = value;
  baseline.value = JSON.stringify(value.voucher);
}
void load();
const dirty = computed(
  () =>
    !!record.value &&
    (JSON.stringify(record.value.voucher) !== baseline.value ||
      localPending.value),
);
function discard() {
  if (record.value)
    record.value = { ...record.value, voucher: JSON.parse(baseline.value) };
  mode.value = "read";
  localPending.value = false;
}
async function leave() {
  const epoch = generation;
  if (await guard.value?.requestLeave()) {
    if (epoch !== generation || !active.value || writeState.value !== "idle")
      return;
    present.value = false;
    record.value = null;
    generation++;
  }
}
function revoke() {
  // Authentication policy bypasses the ordinary navigation guard.
  generation++;
  active.value = false;
  record.value = null;
  baseline.value = "";
  related.value = "";
  localPending.value = false;
}
function switchRecord() {
  instance.value = instance.value === "one" ? "two" : "one";
  record.value = null;
  localPending.value = false;
  mode.value = "read";
  void load();
}
function viewRelated(intent: Related) {
  related.value = `宿主收到引用意图：${intent.id}`;
}
function beforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}
watchEffect((cleanup) => {
  if (
    active.value &&
    present.value &&
    (dirty.value || writeState.value !== "idle")
  ) {
    window.addEventListener("beforeunload", beforeUnload);
    cleanup(() => window.removeEventListener("beforeunload", beforeUnload));
  }
});
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <main>
    <h1>公共详情与编辑保护</h1>
    <p>仅使用合成数据与模拟 Adapter。路由、身份及写入状态由本示例宿主持有。</p>
    <template v-if="active && present">
      <a href="#left" @click.prevent="leave">离开资料</a>
      <button type="button" @click="revoke">模拟身份失效</button>
      <button
        type="button"
        :disabled="writeState !== 'idle'"
        @click="switchRecord"
      >
        切换记录
      </button>
      <button type="button" @click="writeState = 'pending'">
        模拟写入进行中
      </button>
      <button type="button" @click="writeState = 'unknown'">
        模拟结果未知
      </button>
      <button type="button" @click="writeState = 'idle'">
        模拟原请求已权威核实
      </button>
      <EditGuard
        ref="guard"
        :scope="scope"
        :instance="instance"
        :active="active"
        :dirty="dirty"
        :write-state="writeState"
        @discard="discard"
      >
        <template v-if="record">
          <button
            v-if="mode === 'read'"
            type="button"
            :disabled="writeState !== 'idle'"
            @click="mode = 'edit'"
          >
            编辑资料
          </button>
          <VoucherEditor
            v-bind="editor"
            :model-value="record.voucher"
            :scope="scope"
            :instance="instance"
            :mode="mode"
            :disabled="writeState !== 'idle'"
            @update:model-value="record = { ...record!, voucher: $event }"
            @pending="localPending = $event"
          />
          <RecordDetails
            :value="record.facts"
            :groups="groups"
            :scope="scope"
            :instance="instance"
            @related="viewRelated"
          />
          <p role="status">{{ related }}</p>
          <p>本地修改：{{ dirty ? "有" : "无" }}</p>
        </template>
      </EditGuard>
    </template>
    <h2 v-else-if="!active">身份已失效，资料已清理</h2>
    <h2 v-else>已离开资料</h2>
  </main>
</template>
