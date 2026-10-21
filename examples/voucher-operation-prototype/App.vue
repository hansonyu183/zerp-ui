<script setup lang="ts">
import { computed, ref } from "vue";
import OperationPrototype from "./OperationPrototype.vue";
import { actionLabels, type Action, type Intent } from "./contract";
import {
  synthetic,
  type SyntheticModel,
  type Identity,
  type Scenario,
} from "./synthetic";
const action = ref<Action>("void"),
  operator = ref("synthetic-a"),
  note = ref("合成办理原因"),
  scenario = ref<Scenario>("success"),
  eligible = ref(true);
const visible = ref(true),
  events = ref<string[]>([]);
const identity: Identity = { voucher: "SYN-24" };
const definition = synthetic(
  sessionStorage,
  () => scenario.value,
  (event) => events.value.push(event),
);
const intent = computed<Intent<SyntheticModel, Identity>>(() => ({
  action: action.value,
  identity,
  owner: {
    operator: operator.value,
    scope: "synthetic-session",
    resource: "synthetic-voucher",
  },
  input: { note: note.value },
}));
</script>
<template>
  <main>
    <h1>单据办理契约最小演示 · #24</h1>
    <p>
      仅合成数据；拟议契约及可丢弃原型，不是 @zerp/ui 正式导出。存储均以
      PROTOTYPE-24 标记。
    </p>
    <label
      >办理动作<select v-model="action" aria-label="办理动作">
        <option v-for="(label, key) in actionLabels" :key="key" :value="key">
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
      </select></label
    >
    <label
      ><input
        v-model="eligible"
        type="checkbox"
        aria-label="办理资格"
      />办理资格</label
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
    <OperationPrototype
      v-if="visible"
      :definition="definition"
      :intent="intent"
      :eligible="eligible"
    />
    <details open>
      <summary>合成 Adapter 观察记录</summary>
      <ol>
        <li v-for="(event, index) in events" :key="index">{{ event }}</li>
      </ol>
    </details>
    <p>
      未知时可切换操作者、卸载/重挂载或刷新整页，再核实原请求；新请求只可在终态/封存与读取完成后显式开始。关闭浏览器标签会清除此演示的
      sessionStorage。
    </p>
  </main>
</template>
