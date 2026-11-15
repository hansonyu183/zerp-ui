<script setup lang="ts">
import { computed, provide, watch, h, ref, toRaw } from 'vue';
import type { BusinessModel, Collection, ObjectNode } from './business-model';
import { createDirectRuntime, directRuntimeKey, isCollection, type Node } from './direct-model-runtime';
import BusinessNode from './BusinessNode.vue';
import BusinessWorkbench from './BusinessWorkbench.vue';
import AppPage from './AppPage.vue';
import AuthFrame from './AuthFrame.vue';
import FeedbackRegion from './FeedbackRegion.vue';
import Feedback from './Feedback.vue';
import { snapshotPage, type PageDefinition } from './pages';
import { defaultThemeChoice, type NavigationGroup, type AccountIntent, type ThemeChoice } from './shell';
defineOptions({inheritAttrs:false}); defineSlots<{}>();
const props=defineProps<{model:BusinessModel}>();
const runtime=createDirectRuntime(()=>props.model);provide(directRuntimeKey,runtime);
const localTheme=ref(defaultThemeChoice);
const theme=computed(()=>props.model.theme?.value??localTheme.value);
function changeTheme(value:ThemeChoice){if(props.model.theme)props.model.theme.change(value);else localTheme.value=value;}
const groups=computed(()=>props.model.navigation.groups.map(group=>({...group,items:group.items.filter(node=>Object.values(props.model.members).includes(node)&&runtime.readable(node))})).filter(group=>group.items.length));
const accountView=ref<ObjectNode|null>(null);
const current=computed<Collection|null>(()=>{
 const requested=props.model.navigation.current;
 return requested&&Object.values(props.model.members).includes(requested)&&runtime.readable(requested)?requested:null;
});
watch([()=>props.model.navigation.current,groups,()=>props.model.workbench,runtime.ready],()=>{
 if(!runtime.ready.value||props.model.session.state!=='ready'||current.value||props.model.workbench) return;
 const first=groups.value[0]?.items[0];if(first)props.model.navigation.visit(first);
},{immediate:true});
const navigation=computed<NavigationGroup[]>(()=>props.model.session.state==='password-required'?[]:groups.value.map(group=>({key:group.key,caption:group.label,items:group.items.map((node,index)=>({key:`${group.key}:${index}`,caption:node.label,to:props.model.navigation.href(node)}))})));
const selectedKey=computed(()=>{for(const group of groups.value){const index=group.items.indexOf(current.value!);if(index>=0)return `${group.key}:${index}`;}return null;});
function visitKey(key:string){for(const group of groups.value){const index=group.items.findIndex((_,index)=>`${group.key}:${index}`===key);if(index>=0){accountView.value=null;props.model.navigation.visit(group.items[index]!);}}}
const brand=computed(()=>({productName:props.model.brand.productName,enterpriseName:props.model.brand.companyName,home:'/',mark:{kind:'text' as const,text:props.model.brand.productName.slice(0,1)}}));
const messageOwners=new WeakMap<object,string>();
watch(()=>props.model.messages.slice(),items=>{for(const item of items)if(!messageOwners.has(toRaw(item)))messageOwners.set(toRaw(item),runtime.scope.value);},{immediate:true,flush:'sync'});
const messages=computed(()=>props.model.messages.filter(message=>messageOwners.get(toRaw(message))===runtime.scope.value&&(!message.target||runtime.readable(message.target))));
function locate(target:Node){
 const collection=isCollection(target)?target:runtime.ancestors(target).find(isCollection);
 if(collection&&runtime.readable(collection)){
  if(!isCollection(target)) {const record=[...runtime.ancestors(target),target].find(node=>!isCollection(node)&&node.kind==='object'&&runtime.ancestors(node).at(-1)===collection);if(record&&!isCollection(record)&&record.kind==='object')collection.selected=record;}
  props.model.navigation.visit(collection);
 }
}
function feedback(){return h(FeedbackRegion,{},()=>[
 h(Feedback,{message:runtime.error.value,kind:'error'}),
 ...messages.value.map(message=>h(Feedback,{key:message.id,message:message.text,kind:message.level==='error'?'error':message.level==='warning'?'warning':'status'},message.target?()=>h('button',{onClick:()=>message.target&&locate(message.target)},'查看'):undefined))
]);}
const target=computed(()=>props.model.session.state==='password-required'?props.model.account.password:accountView.value??current.value);
const page=computed<PageDefinition>(()=>({kind:'details',title:target.value?.label??(props.model.workbench?'工作台':''),[snapshotPage]:()=>({title:target.value?.label??(props.model.workbench?'工作台':''),render:()=>[
 target.value?h(BusinessNode,{node:target.value}):props.model.workbench?h(BusinessWorkbench,{node:props.model.workbench}):h('p','暂无可用内容。'),feedback()
]})}));
async function accountAction(action:AccountIntent){if(action==='sign-out'){await runtime.runAccount();return;}const node=action==='profile'?props.model.account.profile:props.model.account.password;if(runtime.readable(node))accountView.value=node;}
function goHome(event:MouseEvent){const a=(event.target as Element).closest('a');if(!a||a.getAttribute('href')!=='/'||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();accountView.value=null;props.model.navigation.current=null;}
watch([()=>props.model,runtime.scope,()=>props.model.session.state],()=>{runtime.invalidate(true);accountView.value=null;},{flush:'sync'});
watch(target,()=>runtime.invalidate(),{flush:'sync'});
</script>
<template>
 <AuthFrame v-if="!runtime.ready.value" :brand="brand" :theme="theme">
  <BusinessNode :node="model.authentication.form" public-auth :auto-read="false" />
  <component :is="feedback" />
 </AuthFrame>
 <div v-else @click.capture="goHome">
  <AppPage :brand="brand" :brand-state="{kind:'ready'}" :navigation="navigation" :navigation-state="{kind:'ready'}" :selected-navigation-key="selectedKey" :visit="visitKey" :page="page" :scope="runtime.scope.value" :footer="model.label" :account="{label:model.account.label}" :theme="theme" @update:theme="changeTheme" @account-action="accountAction" />
 </div>
</template>
