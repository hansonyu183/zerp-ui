<script setup lang="ts">
const { showTitle = true } = defineProps<{ showTitle?: boolean }>();
import { shallowRef, ref } from "vue";
import { VApp, VMain } from "vuetify/components";
import { CrudView, DataList } from "@zerp/ui";
import IndependentForm from "./IndependentForm.vue";
import { exampleDefinition, resourceCases } from "./matrix";
const lastAction = ref("");
const selectedRows = ref<(string | number)[]>([]);
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
      >
      <h1 v-if="showTitle">{{ definition.title }}</h1>
      <section aria-label="资料示例">
        <CrudView
          :definition="definition"
          scope="synthetic-session"
          :permissions="{ query: true, create: true, write: true }"
        />
      </section>
      <IndependentForm v-if="showTitle" />
      <section v-if="showTitle" aria-label="行操作示例">
        <DataList
          :columns="[{ key: 'name', label: '名称' }]"
          :result="{
            items: [{ id: 'row-actions', name: '合成客户' }],
            total: 1,
          }"
          :page="1"
          :page-size="20"
          :row-key="(row) => row.id"
          v-model:selected-keys="selectedRows"
          :actions="
            () => [
              'view',
              'edit',
              'withdraw',
              'delete',
              'complete',
              'uncomplete',
            ]
          "
          @action="(action, row) => (lastAction = action + ':' + row.id)"
        />
        <p role="status">{{ lastAction }}</p>
        <p aria-label="已选记录">{{ selectedRows.join(",") }}</p>
      </section></VMain
    ></VApp
  >
</template>
