<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import EditGuard from './EditGuard.vue';
import { renderPage, type AppPageHandle, type PageDefinition } from './pages';
import type { EditGuardHandle, EditProtection } from './edit-guard';
const props = withDefaults(defineProps<{page: PageDefinition; scope: string; active?: boolean}>(), {active:true});
const emit = defineEmits<{protection: [value: EditProtection]}>();
const clear: EditProtection = {dirty:false, localPending:false, invalid:false, writeState:'idle'};
const protection = shallowRef<EditProtection>(clear);
const guard = shallowRef<EditGuardHandle | null>(null);
const admittedPage=shallowRef(props.page);
const generation = ref(0), discardVersion = ref(0);
let switchRequest=0;
function reset(){switchRequest++;generation.value++;protection.value=clear;admittedPage.value=props.page;}
watch(() => [props.scope, props.active], reset, {flush:'sync'});
watch(()=>props.page,async next=>{
  const request=++switchRequest,epoch=generation.value;
  if(next===admittedPage.value)return;
  if(!props.active){reset();return;}
  if(!(await requestLeave()) || request!==switchRequest || epoch!==generation.value || !props.active)return;
  admittedPage.value=next;generation.value++;protection.value=clear;
},{flush:'sync'});
watch(protection, value => emit('protection', value), {immediate:true, flush:'sync'});
const content = computed(() => {
  const epoch = generation.value;
  return () => props.active ? admittedPage.value[renderPage]({
    scope:props.scope, active:props.active, discardVersion:discardVersion.value,
    protection: value => {if(epoch === generation.value && props.active) protection.value = value;},
    requestLeave,
  }) : null;
});
async function requestLeave(): Promise<boolean> {const epoch=generation.value;const allowed=await guard.value?.requestLeave();return allowed===true&&epoch===generation.value&&props.active;}
defineExpose<AppPageHandle>({requestLeave});
</script>
<template>
  <h1>{{ admittedPage.title }}</h1>
  <EditGuard ref="guard" :scope="scope" :instance="generation" :active="active" :dirty="protection.dirty" :local-pending="protection.localPending" :write-state="protection.writeState" @discard="discardVersion++" />
  <component :is="content" :key="generation" />
</template>
