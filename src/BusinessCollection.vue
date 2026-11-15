<script setup lang="ts">
import {computed,inject,toRaw} from 'vue';
import DataList from './DataList.vue';
import type {Column} from './contracts';
import type {RowAction} from './row-action';
import {directRuntimeKey,labels,type CollectionNode,type ObjectNode,type Node} from './direct-model-runtime';
import type {FieldNode} from './business-model';
import {formatField} from './model-format';
type Values=Record<string,string|number|boolean|null>;
const props=defineProps<{node:CollectionNode;loading:boolean;canQuery:boolean}>();
const emit=defineEmits<{page:[page:number];open:[mode:'read'|'edit']}>();
const runtime=inject(directRuntimeKey)!;
function field(row:ObjectNode,key:string){return row.members.find(member=>member.key===key);}
const columns=computed<Column<Values>[]>(()=>props.node.columns.filter(column=>props.node.items.every(row=>{const n=field(row,column.key);return !n||runtime.readable(n);})).map(column=>({...column,type:'text'})));
function display(node:Node|undefined):Values[string]{if(!node||!runtime.readable(node)||!('value'in node))return null;if(node.kind==='secret'||node.kind==='password')return '••••••';try {return formatField(node as FieldNode);} catch(error) {return error instanceof Error ? error.message : "格式错误";}}
const projected=computed(()=>{const originals=new Map<Values,ObjectNode>();const rows=props.node.items.filter(row=>runtime.readable(row)).map(row=>{const values=Object.fromEntries(columns.value.map(column=>[column.key,display(field(row,column.key))]));originals.set(values,row);return values;});return {rows,originals};});
const original=(row:Values)=>projected.value.originals.get(row);
function key(row:Values){const node=original(row)!;return node.identity??String(props.node.items.indexOf(node));}
function actions(row:Values):RowAction[]{const source=original(row);if(!source||!runtime.readable(source))return [];const result:RowAction[]=[runtime.allowed(source,'update')&&runtime.writable(source)?'edit':'view'];const available=new Set(['delete','submit','approve','withdraw','reverse','calculate','clone','send','unapprove','complete','uncomplete','void','unvoid','enable','disable']);for(const action of Object.keys(runtime.operations(source)))if(available.has(action)&&runtime.allowed(source,action))result.push(action as RowAction);return result;}
function reasons(row:Values):Partial<Record<RowAction,string>>{const source=original(row);if(!source)return {};return Object.fromEntries(actions(row).filter(action=>runtime.busy.value.has(toRaw(source))||(action!=='edit'&&action!=='view'&&runtime.operations(source)[action]?.disabled)).map(action=>[action,'当前不可用']));}
function select(action:RowAction,row:Values){const source=original(row);if(!source||!props.node.items.includes(source)||!actions(row).includes(action)||reasons(row)[action])return;if(action==='view'||action==='edit'){props.node.selected=source;emit('open',action==='edit'?'edit':'read');}else void runtime.run(source,action);}
</script>
<template>
 <DataList :columns="columns" :result="{items:projected.rows,total:node.total}" :page="node.page" :page-size="node.pageSize" :loading="loading" :paging-disabled="!canQuery" :row-key="key" :actions="actions" :action-labels="labels" :disabled-actions="reasons" empty-caption="暂无记录" @page="emit('page',$event)" @action="select" />
</template>
