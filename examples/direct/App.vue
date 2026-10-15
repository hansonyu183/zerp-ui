<script setup lang="ts">
import { shallowRef } from "vue";
import { VApp, VMain } from "vuetify/components";
import { DirectRuntime } from "@zerp/ui";
import { exampleDefinition, resourceCases } from "./matrix";
const selected = shallowRef(
  resourceCases[0][0] as (typeof resourceCases)[number][0],
);
const definitions = new Map(
  resourceCases.map((item) => [item[0], exampleDefinition(item[0])]),
);
const definition = shallowRef(definitions.get(selected.value)!);
function change() {
  definition.value = definitions.get(selected.value)!;
}
</script>
<template>
  <VApp
    ><VMain
      ><p>独立安装消费者：仅合成数据与模拟 Adapter，不连接 ZERP API。</p>
      <label
        >资源<select v-model="selected" @change="change">
          <option v-for="item in resourceCases" :key="item[0]" :value="item[0]">
            {{ item[1] }}
          </option>
        </select></label
      ><DirectRuntime
        :definition="definition"
        scope="synthetic-session"
        :permissions="{ query: true, create: true, write: true }" /></VMain
  ></VApp>
</template>
