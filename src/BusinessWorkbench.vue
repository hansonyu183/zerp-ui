<script setup lang="ts">
import {computed,inject,toRaw,watch} from 'vue';
import {VCard,VCardTitle,VCardText,VBtn,VList,VListItem,VListItemTitle} from 'vuetify/components';
import type {Workbench,RecordsNode,ObjectNode,FieldNode} from './business-model';
import {directRuntimeKey} from './direct-model-runtime';
import {formatField} from './model-format';
const props=defineProps<{node:Workbench}>();const runtime=inject(directRuntimeKey)!;
const sections=computed(()=>(['information','vouchers','reports','masters']as const).map(role=>({role,node:props.node[role]})).filter(section=>runtime.readable(section.node)));
function caption(collection:RecordsNode,row:ObjectNode){return collection.columns.flatMap(column=>{const field=row.members.find(node=>node.key===column.key);if(!field||!runtime.readable(field)||!('value'in field)||['secret','password','attachments'].includes(field.kind))return [];try{return [formatField(field as FieldNode)];}catch(error){return [error instanceof Error?error.message:'格式错误'];}}).filter(Boolean).join(' · ');}
const activated=new Set<string>();
watch([runtime.scope,()=>sections.value.length,()=>props.node.load?.disabled],()=>{const owner=runtime.scope.value;if(!sections.value.length||!runtime.ready.value||activated.has(owner)||!props.node.load||props.node.load.disabled)return;activated.add(owner);void runtime.runWorkbench(true);},{immediate:true});
</script>
<template>
 <section class="zerp-workbench" aria-label="工作台">
  <VBtn v-if="node.load" :disabled="node.load.disabled||runtime.busy.value.has(toRaw(node))||!sections.length" @click="runtime.runWorkbench">刷新</VBtn>
  <div class="zerp-workbench-grid">
   <VCard v-for="section in sections" :key="section.role" tag="section" :aria-label="section.node.label??undefined" :class="{'zerp-workbench-information':section.role==='information'}">
    <VCardTitle tag="h2">{{section.node.label}}</VCardTitle>
    <VCardText><VList v-if="section.node.items.some(row=>runtime.readable(row))" class="zerp-workbench-links">
     <VListItem v-for="row in section.node.items.filter(row=>runtime.readable(row))" :key="row.identity??row.key" :disabled="!runtime.allowed(row,'get')||!!row.operations.get?.disabled||runtime.busy.value.has(toRaw(row))" @click="runtime.run(row,'get')"><VListItemTitle>{{caption(section.node,row)}}</VListItemTitle></VListItem>
    </VList><p v-else>暂无内容</p></VCardText>
   </VCard>
  </div>
 </section>
</template>
