<script setup lang="ts" generic="T extends object,I,H extends object,R extends object,C extends object=object">
import {computed,ref,shallowRef,watch} from 'vue';
import RecordDetails from './RecordDetails.vue';
import VoucherEditor from './VoucherEditor.vue';
import {clone} from './clone';
import {equalValues} from './editor-values';
import {validateVoucherContent,type VoucherEditorValue} from './voucher-editor';
import type {DetailsPage} from './pages';
import type {EditProtection} from './edit-guard';
const props=defineProps<{options:DetailsPage<T,I,H,R,C>;scope:string;discardVersion:number}>();
const emit=defineEmits<{protection:[value:EditProtection]}>();
const editing=ref(false),pending=ref(false),generation=ref(0);
const draft=shallowRef<VoucherEditorValue<H,R>|null>(null),baseline=shallowRef<VoucherEditorValue<H,R>|null>(null);
const writeState=computed(()=>props.options.writeState??'idle');
function reset(){const value=props.options.editor?.value;draft.value=value?clone(value):null;baseline.value=value?clone(value):null;editing.value=false;pending.value=false;generation.value++;}
watch(()=>[props.scope,props.options.instance],reset,{immediate:true,flush:'sync'});
watch(()=>props.options.editor?.value,value=>{if(equalValues(value,draft.value))return;draft.value=value?clone(value):null;baseline.value=value?clone(value):null;pending.value=false;generation.value++;},{deep:true});
function discard(){if(writeState.value!=='idle')return;draft.value=baseline.value?clone(baseline.value):null;editing.value=false;pending.value=false;generation.value++;if(draft.value)props.options.editor?.onChange?.(clone(draft.value));}
watch(()=>props.discardVersion,discard);
const protection=computed<EditProtection>(()=>({dirty:!!draft.value&&!equalValues(draft.value,baseline.value),localPending:pending.value,invalid:!!draft.value&&!!props.options.editor&&!!validateVoucherContent(props.options.editor.definition,draft.value),writeState:writeState.value}));
watch(protection,value=>emit('protection',value),{immediate:true,flush:'sync'});
const bindings=computed(()=>{const epoch=generation.value;return {change:(value:VoucherEditorValue<H,R>)=>{if(epoch!==generation.value||writeState.value!=='idle'||!editing.value)return;draft.value=clone(value);props.options.editor?.onChange?.(clone(value));},pending:(value:boolean)=>{if(epoch===generation.value)pending.value=value;}};});
</script>
<template>
  <section aria-label="完整资料详情">
    <template v-if="options.editor&&draft"><button v-if="!editing" type="button" :disabled="writeState!=='idle'" @click="editing=true">编辑资料</button><button v-else type="button" :disabled="writeState!=='idle'" @click="discard">取消编辑</button>
      <VoucherEditor :key="generation" v-bind="options.editor.definition" :model-value="draft" :scope="scope" :instance="generation" :mode="editing?'edit':'read'" :disabled="writeState!=='idle'" :onUpdate:modelValue="bindings.change" :onPending="bindings.pending" />
    </template>
    <RecordDetails :value="options.value" :groups="options.groups" :scope="scope" :instance="options.instance" @related="options.onRelated?.($event)" />
  </section>
</template>
