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
