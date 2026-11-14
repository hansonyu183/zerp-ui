<script setup lang="ts">
import {computed,provide,watch} from 'vue';
import type {BusinessModel} from './business-model';
import {nodeMetadata as meta} from './model-node';
import {createDirectRuntime,directRuntimeKey,type Target} from './direct-model-runtime';
import BusinessNode from './BusinessNode.vue';
defineOptions({inheritAttrs:false});
defineSlots<{}>();
const props=defineProps<{model:BusinessModel}>();
const runtime=createDirectRuntime(()=>props.model);provide(directRuntimeKey,runtime);
const options=computed(()=>props.model[meta]);
const groups=computed(()=>options.value.navigationProjection.map(group=>({...group,items:group.items.filter(item=>runtime.readable(item.node))})).filter(group=>group.items.length));
const current=computed(()=>options.value.navigation.current??groups.value[0]?.items[0]?.node);
const root=computed(()=>{const n=current.value;if(!n||!runtime.readable(n))return null;return runtime.ancestors(n).find(a=>a[meta].kind==='object')??n;});
function visit(node:Target){options.value.navigation.visit(node);}
watch([()=>props.model,runtime.scope,current],()=>runtime.invalidate(),{flush:'sync'});
</script>
<template>
<div class="business-application">
 <header><h1>{{options.brand.productName}}</h1><p>{{options.brand.companyName}}</p></header>
 <template v-if="runtime.ready.value">
  <nav aria-label="业务导航"><section v-for="group in groups" :key="group.key"><h2>{{group.name}}</h2><a v-for="item in group.items" :key="item.node[meta].name" :href="options.navigation.href(item.node)" :aria-current="current===item.node?'page':undefined" @click.prevent="visit(item.node)">{{item.node[meta].name}}</a></section></nav>
  <main v-if="root"><h2>{{root[meta].name}}</h2><BusinessNode :node="root" /></main>
  <p v-else>暂无可用内容。</p>
 </template>
 <p v-else>正在等待会话与权限。</p>
 <aside aria-live="polite"><p v-if="runtime.error.value" role="alert">{{runtime.error.value}}</p><p v-for="message in options.messages" :key="message.id" :role="message.level==='error'?'alert':'status'">{{message.text}}</p></aside>
</div>
</template>
<style scoped>
.business-application {max-width:80rem;margin:auto;padding:1rem} header,nav {border-bottom:1px solid #ddd}nav section{display:inline-block;padding:1rem}nav a{display:inline-block;margin-inline-end:1rem}main{padding-block:1rem}aside{min-height:2rem}
</style>
