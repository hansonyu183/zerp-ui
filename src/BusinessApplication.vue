<script setup lang="ts">
import {computed,provide,watch,h,ref,toRaw} from 'vue';
import type {BusinessModel} from './business-model';
import {nodeMetadata as meta} from './model-node';
import {createDirectRuntime,directRuntimeKey,type Target} from './direct-model-runtime';
import BusinessNode from './BusinessNode.vue';
import AppPage from './AppPage.vue';
import AuthFrame from './AuthFrame.vue';
import FeedbackRegion from './FeedbackRegion.vue';
import Feedback from './Feedback.vue';
import {snapshotPage,type PageDefinition} from './pages';
import {defaultThemeChoice,type NavigationGroup,type AccountIntent} from './shell';
defineOptions({inheritAttrs:false});defineSlots<{}>();
const props=defineProps<{model:BusinessModel}>();
const runtime=createDirectRuntime(()=>props.model);provide(directRuntimeKey,runtime);
const options=computed(()=>props.model[meta]);
const theme=ref(defaultThemeChoice);
const groups=computed(()=>options.value.navigationProjection.map(group=>({...group,items:group.items.filter(item=>runtime.readable(item.node))})).filter(group=>group.items.length));
const current=computed(()=>options.value.session?.state==='password-required'?options.value.account?.password:options.value.navigation.current??groups.value[0]?.items[0]?.node);
const root=computed(()=>{const n=current.value;if(!n||!runtime.readable(n))return null;return runtime.ancestors(n).find(a=>a[meta].kind==='object')??n;});
const navigation=computed<NavigationGroup[]>(()=>groups.value.map(g=>({key:g.key,caption:g.name,items:g.items.map((item,index)=>({key:`${g.key}:${index}`,caption:item.node[meta].name,to:options.value.navigation.href(item.node)}))})));
const selectedKey=computed(()=>{for(const g of groups.value){const i=g.items.findIndex(x=>toRaw(x.node)===toRaw(root.value));if(i>=0)return `${g.key}:${i}`;}return null;});
function visitKey(key:string){for(const g of groups.value){const i=g.items.findIndex((_,i)=>`${g.key}:${i}`===key);if(i>=0)options.value.navigation.visit(g.items[i]!.node);}}
const brand=computed(()=>({productName:options.value.brand.productName,enterpriseName:options.value.brand.companyName,home:'/',mark:{kind:'text' as const,text:options.value.brand.productName.slice(0,1)}}));
const messageOwners=new WeakMap<object,string>();
watch(runtime.scope,(next,previous)=>{for(const message of options.value.messages)if(!messageOwners.has(toRaw(message)))messageOwners.set(toRaw(message),previous??next);},{immediate:true,flush:'sync'});
const messages=computed(()=>options.value.messages.filter(message=>{if(!messageOwners.has(toRaw(message)))messageOwners.set(toRaw(message),runtime.scope.value);return messageOwners.get(toRaw(message))===runtime.scope.value;}));
function feedback(){return h(FeedbackRegion,{},()=>[h(Feedback,{message:runtime.error.value,kind:'error'}),...messages.value.map(message=>h(Feedback,{key:message.id,message:message.text,kind:message.level==='error'?'error':'status'}))]);}
const page=computed<PageDefinition>(()=>({kind:'details',title:root.value?.[meta].name??'工作台',[snapshotPage]:()=>({title:root.value?.[meta].name??'工作台',render:()=>[root.value?h(BusinessNode,{node:root.value,focus:current.value}):h('p','暂无可用内容。'),feedback()]})}));
async function accountAction(action:AccountIntent){const account=options.value.account;if(!account)return;const target=action==='profile'?account.profile:account.password;if(action!=='sign-out'){if(target&&runtime.readable(target))options.value.navigation.visit(target);return;}if(account.signOut&&!account.signOut.disabledReason)await account.signOut.run();}
watch([()=>props.model,runtime.scope,current],()=>runtime.invalidate(),{flush:'sync'});
</script>
<template>
 <AuthFrame v-if="!options.owner" :brand="brand" :theme="theme">
  <BusinessNode v-if="options.authentication" :node="options.authentication" public-auth :auto-read="false" />
  <p v-else>会话不可用。</p><component :is="feedback" />
 </AuthFrame>
 <AppPage v-else :brand="brand" :brand-state="{kind:'ready'}" :navigation="navigation" :navigation-state="{kind:'ready'}" :selected-navigation-key="selectedKey" :visit="visitKey" :page="page" :scope="runtime.scope.value" :footer="options.name" :account="options.account?{label:options.account.name}:undefined" :theme="theme" @update:theme="theme=$event" @account-action="accountAction" />
</template>
