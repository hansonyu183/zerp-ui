<script setup lang="ts">
import {computed,inject,ref,watch,toRaw,onMounted,onBeforeUnmount,nextTick} from 'vue';
import {VBtn} from 'vuetify/components';
import {directRuntimeKey,members,labels,isCollection,type Node,type CollectionNode,type ObjectNode} from './direct-model-runtime';
import type {BusinessNode as BusinessValue,RecordsNode,FieldNode} from './business-model';
import BusinessField from './BusinessField.vue';
import BusinessCollection from './BusinessCollection.vue';
import RecordDialog from './RecordDialog.vue';
import BusinessGroups from './BusinessGroups.vue';
import TemplatePrint from './TemplatePrint.vue';
import BusinessFamilyContent from './BusinessFamilyContent.vue';
const props=withDefaults(defineProps<{node:Node;focus?:Node;publicAuth?:boolean;autoRead?:boolean;readOnly?:boolean;filter?:boolean}>(),{autoRead:true});
const runtime=inject(directRuntimeKey)!;
const collection=computed(()=>props.node as CollectionNode);
const records=computed(()=>props.node as RecordsNode);
const field=computed(()=>props.node as FieldNode);
const visible=computed(()=>members(props.node).filter(([,node])=>node.label!==null&&(props.publicAuth||runtime.readable(node))));
const runs=computed(()=>{const result:{key:string;grouped:boolean;entries:[string,BusinessValue][]}[]=[];for(const entry of visible.value){const grouped=entry[1].kind==='object'||entry[1].kind==='records';const previous=result.at(-1);if(previous?.grouped===grouped)previous.entries.push(entry);else result.push({key:`${grouped?'groups':'fields'}-${entry[0]}`,grouped,entries:[entry]});}return result;});
const actions=computed(()=>Object.entries(runtime.operations(props.node)).filter(([key])=>key!=='query'&&(!props.readOnly||['get','reconcile','load'].includes(key))&&runtime.allowed(props.node,key,props.publicAuth)));
const pending=computed(()=>runtime.busy.value.has(toRaw(props.node)));
const dialogReady=ref(false);onMounted(()=>void nextTick(()=>{dialogReady.value=true;}));
const printRequested=ref(false);
const dismissedDraft=ref<ObjectNode|null>(null),detailMode=ref<'read'|'edit'>('edit');
const detail=computed(()=>collection.value.draft&&collection.value.draft!==dismissedDraft.value?collection.value.draft:collection.value.selected);
function closeDetail(){if(collection.value.draft===detail.value)dismissedDraft.value=detail.value;if(collection.value.selected===detail.value)collection.value.selected=null;detailMode.value='edit';printRequested.value=false;}
const canQuery=computed(()=>runtime.allowed(props.node,'query')&&!runtime.operations(props.node).query?.disabled&&!pending.value);
async function query(page=1){if(!canQuery.value)return;collection.value.page=page;await runtime.run(props.node,'query');}
watch(()=>props.node,()=>{if(props.autoRead&&!(isCollection(props.node)&&props.node.report&&runtime.reportViews.has(toRaw(props.node))))void runtime.run(props.node,isCollection(props.node)?'query':'get',props.publicAuth);},{immediate:true});
const initialScope=runtime.scope.value;
let scrollFrame:number|undefined;
onMounted(()=>{const saved=isCollection(props.node)&&props.node.report&&runtime.reportViews.get(toRaw(props.node));if(saved)scrollFrame=requestAnimationFrame(()=>window.scrollTo(saved.left,saved.top));});
onBeforeUnmount(()=>{if(scrollFrame!==undefined)cancelAnimationFrame(scrollFrame);if(isCollection(props.node)&&props.node.report&&initialScope===runtime.scope.value&&runtime.readable(props.node))runtime.reportViews.set(toRaw(props.node),{left:window.scrollX,top:window.scrollY});});
function localSelected(row:ObjectNode){if(props.readOnly||!runtime.writable(props.node))return;records.value.selected=row;}
</script>
<template>
 <section v-if="publicAuth || runtime.readable(node)" :aria-label="node.label??undefined">
  <template v-if="!isCollection(node)&&node.kind==='object'">
   <template v-for="run in runs" :key="run.key">
    <BusinessGroups v-if="run.grouped" :entries="run.entries" :name="node.label??''" :focus="focus" :public-auth="publicAuth" :read-only="readOnly" :filter="filter" />
    <div v-else class="zerp-direct-form" :class="{'zerp-direct-form--short':run.entries.length<=3,'zerp-direct-form--filter':filter}">
     <BusinessNode v-for="[key,child] in run.entries" :key="key" :node="child" :focus="focus" :public-auth="publicAuth" :auto-read="false" :read-only="readOnly" :class="{'zerp-direct-form-wide':child.kind==='longText'||child.kind==='records'}" />
    </div>
   </template>
  </template>
  <template v-else-if="isCollection(node)">
   <BusinessNode :node="collection.conditions" :auto-read="false" filter />
   <VBtn v-if="runtime.allowed(node,'query')" :disabled="!canQuery" @click="query()">查询</VBtn>
   <TemplatePrint :collection="collection" />
   <VBtn v-if="collection.draft&&collection.draft===dismissedDraft&&runtime.readable(collection.draft)" @click="dismissedDraft=null">继续编辑</VBtn>
   <BusinessCollection :node="collection" :loading="pending" :can-query="canQuery" @page="query" @open="detailMode=$event;printRequested=false" @print="collection.selected=$event;detailMode='read';printRequested=true" />
   <RecordDialog v-if="dialogReady&&detail&&runtime.readable(detail)" :title="collection.draft===detail?'新增':detail.label??''" @close="closeDetail">
    <BusinessNode :node="detail" :read-only="collection.draft===detail?false:detailMode==='read'" />
    <TemplatePrint v-if="collection.draft!==detail&&collection.items.includes(detail)&&detailMode==='read'" :collection="collection" :record="detail" :auto-open="printRequested" />
    <VBtn @click="closeDetail">关闭</VBtn>
   </RecordDialog>
  </template>
  <template v-else-if="node.kind==='records'">
   <div v-for="(row,index) in records.items.filter(item=>runtime.readable(item))" :key="row.identity??row.key">
    <input v-if="runtime.allowed(node,'remove')" type="radio" :aria-label="`选择第 ${index+1} 项`" :checked="records.selected===row" :disabled="readOnly||!runtime.writable(node)" @change="localSelected(row)" />
    <BusinessNode :node="row" :auto-read="false" :read-only="readOnly" />
   </div>
  </template>
  <BusinessFamilyContent v-else-if="node.kind==='output'||node.kind==='interactions'" :node="node" :read-only="readOnly" />
  <BusinessField v-else :node="field" :read-only="readOnly||(!publicAuth&&!runtime.writable(node))" :scope="runtime.scope.value" />
  <div v-if="actions.length" role="group" :aria-label="`${node.label??''}操作`">
   <VBtn v-for="[action,operation] in actions" :key="action" :disabled="pending||operation.disabled" @click="runtime.run(node,action,publicAuth)">{{labels[action]??action}}</VBtn>
  </div>
 </section>
</template>
<style scoped>
section{min-width:0;container-type:inline-size}.zerp-direct-form{display:grid;grid-template-columns:1fr;gap:12px}.zerp-direct-form>*{min-width:0}.zerp-direct-form-wide{grid-column:1/-1}@container (min-width:520px){.zerp-direct-form{grid-template-columns:repeat(2,minmax(0,1fr))}}@container (min-width:800px){.zerp-direct-form{grid-template-columns:repeat(3,minmax(0,1fr))}}@container (min-width:1060px){.zerp-direct-form--filter{grid-template-columns:repeat(4,minmax(0,1fr))}}.zerp-direct-form--short{grid-template-columns:1fr}
</style>
