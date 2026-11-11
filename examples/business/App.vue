<script setup lang="ts">
import { ref } from "vue";
import { AppPage } from "@zerp/ui";
import { page, scenario } from "./consumer";
const version = ref(0);
</script>
<template>
  <AppPage
    :key="version"
    :page="page"
    scope="synthetic"
    :brand="{
      home: '/',
      productName: '独立示例',
      enterpriseName: '合成企业',
      mark: { kind: 'text', text: '例' },
    }"
    :brand-state="{ kind: 'ready' }"
    :navigation="[]"
    :navigation-state="{ kind: 'ready' }"
    footer="合成数据与 Adapter"
  />
  <aside class="example-controls" aria-label="合成场景">
    <label
      >保存结果<select v-model="scenario.result" aria-label="保存结果">
        <option value="success">成功</option>
        <option value="unknown">待核实</option>
        <option value="failure">失败</option>
      </select></label
    >
    <label
      ><input
        v-model="scenario.confirmed"
        type="checkbox"
        aria-label="确认已保存"
      />确认已保存</label
    >
    <button type="button" @click="version++">重新进入</button>
  </aside>
</template>
