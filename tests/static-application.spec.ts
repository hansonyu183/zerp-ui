import { mount, flushPromises, config } from '@vue/test-utils';
import { reactive } from 'vue';
import { expect, it, vi } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { BusinessApplication } from '../src/index';
import type { BusinessModel, ObjectNode, Collection, Operation } from '../src/model';
config.global.plugins.push(createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{template:'<div />'}}]}));
const operation = (run = vi.fn(async()=>{})): Operation => ({disabled:false,run});
function object(key:string,label=key): ObjectNode {return {kind:'object',family:'standard',key,label,identity:null,readOnly:false,members:[],operations:{}};}
function fixture() {
 const query=operation();
 const collection:Collection={key:'customers',label:'客户',columns:[{key:'code',label:'编号'}],conditions:object('conditions','条件'),items:[],selected:null,draft:null,page:1,pageSize:20,total:0,operations:{query}};
 const owner={ledger:'synthetic',operator:'tester',generation:'1'};
 const model=reactive<BusinessModel>({kind:'application',label:'合成应用',brand:{productName:'合成',companyName:'测试'},members:{customers:collection},authentication:{form:object('login','登录'),operations:{signIn:operation(),recover:operation()}},account:{label:'测试用户',profile:object('profile','个人资料'),password:object('password','修改密码'),operations:{changePassword:operation(),signOut:operation()}},session:{state:'ready',owner,userPermissions:{owner,administrator:true}},navigation:{current:null,groups:[{key:'main',label:'业务',items:[collection]}],href:()=>'/customers',visit(node){model.navigation.current=node;}},messages:[]});
 return {model,collection:model.members.customers!,query:query.run};
}
it('shows declared columns for an empty collection and queries the first authorized collection once',async()=>{
 const {model,query}=fixture(); const wrapper=mount(BusinessApplication,{props:{model}}); await flushPromises();
 expect(wrapper.findAll('th').map(x=>x.text())).toContain('编号'); expect(query).toHaveBeenCalledTimes(1); expect(model.navigation.current).toBe(model.members.customers); wrapper.unmount();
});
it('keeps the same root through anonymous authentication and isolates mismatched owners',async()=>{
 const {model}=fixture(); model.session={state:'anonymous',owner:null,userPermissions:null};
 const signIn=vi.fn(async()=>{const owner={ledger:'synthetic',operator:'next',generation:'2'};model.session={state:'ready',owner,userPermissions:{owner,administrator:true}};});model.authentication.operations.signIn.run=signIn;
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();
 expect(wrapper.findAll('th')).toHaveLength(0);await wrapper.findAll('button').find(b=>b.text()==='登录')!.trigger('click');await flushPromises();
 expect(signIn).toHaveBeenCalledTimes(1);expect(wrapper.findAll('th').map(x=>x.text())).toContain('编号');
 if(model.session.owner)model.session.owner.generation='3';await flushPromises();expect(wrapper.findAll('th')).toHaveLength(0);wrapper.unmount();
});
it('denies ordinary collection access by default and restores granted collections without deleting structure',async()=>{
 const {model,collection}=fixture();const owner=model.session.owner!;model.session={state:'ready',owner,userPermissions:{owner,administrator:false,grants:[]}};
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();expect(wrapper.findAll('th')).toHaveLength(0);
 model.session.userPermissions={owner,administrator:false,grants:[{node:collection,read:true,write:true,operations:{query:true}}]};await flushPromises();expect(wrapper.findAll('th').map(x=>x.text())).toContain('编号');expect(model.members.customers).toBe(collection);wrapper.unmount();
});
it('does not load a configured workbench again on return and retries a failed load explicitly',async()=>{
 const {model,collection}=fixture();const records=(key:string)=>({kind:'records' as const,key,label:key,readOnly:true,columns:[],items:[],selected:null,operations:{}});
 const load=operation(vi.fn(async()=>{throw Error('offline');}));model.workbench={load,information:records('重要信息'),vouchers:records('单据'),reports:records('报表'),masters:records('资料')};
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();expect(load.run).toHaveBeenCalledTimes(1);expect(wrapper.text()).toContain('操作失败');
 model.navigation.current=collection;await flushPromises();model.navigation.current=null;await flushPromises();expect(load.run).toHaveBeenCalledTimes(1);
 await wrapper.findAll('button').find(b=>b.text()==='刷新')!.trigger('click');await flushPromises();expect(load.run).toHaveBeenCalledTimes(2);wrapper.unmount();
});
