<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watchEffect } from "vue";
import {
  defineDetailsPage,
  type AppPageHandle,
  type EditProtection,
  type EditWriteState,
} from "@zerp/ui";
import ExamplePage from "../shared/ExamplePage.vue";
import {
  adapter,
  editor,
  groups,
  type RecordValue,
  type Related,
} from "./adapters";
const guard = ref<AppPageHandle | null>(null);
const protection = shallowRef<EditProtection>({
  dirty: false,
  localPending: false,
  invalid: false,
  writeState: "idle",
});
const active = ref(true),
  present = ref(true);
const scope = ref("synthetic-one"),
  instance = ref("one"),
  localPending = ref(false);
const writeState = ref<EditWriteState>("idle");
const record = shallowRef<RecordValue | null>(null);
const related = ref("");
let generation = 0;
async function load() {
  const epoch = ++generation;
  const value = await adapter.read({ scope: scope.value, id: instance.value });
  if (epoch !== generation || !active.value) return;
  record.value = value;
}
void load();
const dirty = computed(
  () => protection.value.dirty || protection.value.localPending,
);
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
  related.value = "";
  localPending.value = false;
}
async function switchRecord() {
  if (!(await guard.value?.requestLeave())) return;
  instance.value = instance.value === "one" ? "two" : "one";
  record.value = null;
  localPending.value = false;
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
const emptyRecord: RecordValue = {
  voucher: { header: { name: "", amount: "" }, rows: [] },
  facts: {
    reference: { id: "", label: "" },
    empty: "",
    zero: 0,
    enabled: false,
    history: [],
  },
};
const page = defineDetailsPage(() => ({
  title: "公共详情与编辑保护",
  value: (record.value ?? emptyRecord).facts,
  groups,
  instance: instance.value,
  writeState: writeState.value,
  onRelated: viewRelated,
  onProtection: (value: EditProtection) => {
    protection.value = value;
    localPending.value = value.localPending;
  },
  editor: {
    definition: editor,
    value: (record.value ?? emptyRecord).voucher,
    onChange: (value: RecordValue["voucher"]) => {
      if (record.value) record.value = { ...record.value, voucher: value };
    },
  },
}));
</script>
<template>
  <ExamplePage
    v-if="record && active && present"
    ref="guard"
    :page="page"
    :scope="scope"
    :active="active"
  />
  <section class="example-controls" aria-label="合成详情控制">
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

      <output role="status">{{ related }}</output>
    </template>
    <h2 v-else-if="!active">身份已失效，资料已清理</h2>
    <h2 v-else>已离开资料</h2>
  </section>
</template>
