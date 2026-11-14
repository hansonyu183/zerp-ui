import { mount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { expect, it, vi } from 'vitest';
import {createRouter,createMemoryHistory} from 'vue-router';
import {config} from '@vue/test-utils';
config.global.plugins.push(createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{template:'<div />'}}]}));
import { BusinessApplication } from '../src/index';
import { modelMetadata as meta, type BusinessModel } from '../src/model';
function fixture() {
 const query = vi.fn(async()=>{});
 const rows = {items:[],selected:null,draft:null,query:{[meta]:{kind:'object',name:'Filters',operations:{}}},page:1,pageSize:20,total:0,[meta]:{kind:'collection',name:'Changes',element:{code:{value:'',[meta]:{kind:'text',name:'Code'}},[meta]:{kind:'object',name:'Change',operations:{}}},list:['code'],operations:{query:{run:query}}}};
 const group={intro:{value:'hello',[meta]:{kind:'text',name:'Introduction'}},rows,[meta]:{kind:'object',name:'Partners',form:['intro','rows'],operations:{}}};
 const owner={ledger:'synthetic',operator:'test',generation:'1'};
 const model=reactive({group,[meta]:{kind:'application',name:'Test',brand:{productName:'Test',companyName:'Synthetic'},owner,userPermissions:{owner,administrator:true},navigation:{current:group,href:()=> '/',visit(node:unknown){model[meta].navigation.current=node as typeof group;}},navigationProjection:[{key:'main',name:'Main',items:[{node:group}]}],messages:[]}}) as unknown as BusinessModel;
 return {model,query};
}
it('keeps aggregate context and opens empty collection only when its tab becomes visible',async()=>{
 const {model,query}=fixture();
 const wrapper=mount(BusinessApplication,{props:{model}});
 await flushPromises();
 expect(wrapper.text()).toContain('Partners');
 expect(query).not.toHaveBeenCalled();
 await wrapper.get('[role="tab"][data-member="rows"]').trigger('click');
 await flushPromises();
 expect(wrapper.findAll('th').map(x=>x.text())).toContain('Code');
 expect(query).toHaveBeenCalledTimes(1);
 expect(model[meta].navigation.current).toBe(model.group);
 wrapper.unmount();
});
it('edits model values directly and retains failed input without automatic writes',async()=>{
 const {model}=fixture();
 const update=vi.fn(async()=>{throw Error('business rejection');});
 const record=model.group as Extract<BusinessModel[string],{[meta]:{kind:'object'}}>;
 record[meta].form=['intro']; record[meta].operations={update:{run:update}};
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();
 await wrapper.get('input[aria-label="Introduction"]').setValue('edited');
 expect((record.intro as {value:string}).value).toBe('edited');expect(update).not.toHaveBeenCalled();
 await wrapper.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises();
 expect(update).toHaveBeenCalledTimes(1);expect(wrapper.get('input').element.value).toBe('edited');
 expect(wrapper.text()).toContain('操作失败');wrapper.unmount();
});
it('does not display workspace or old messages after owner permissions cease to match',async()=>{
 const {model}=fixture();model[meta].messages=[{id:'old',level:'info',text:'old owner notification'}];
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();
 model[meta].owner={ledger:'new',operator:'next',generation:'2'};await flushPromises();
 expect(wrapper.text()).not.toContain('Partners');expect(wrapper.text()).not.toContain('old owner notification');wrapper.unmount();
});
it('inherits collection grants for records and narrows field writes for ordinary users',async()=>{
 const {model}=fixture();const group=model.group as Extract<BusinessModel[string],{[meta]:{kind:'object'}}>;
 const rows=group.rows as Extract<BusinessModel[string],{[meta]:{kind:'collection'}}>;
 const save=vi.fn(async()=>{});
 const record={code:{value:'original',[meta]:{kind:'text' as const,name:'Code'}},[meta]:{kind:'object' as const,name:'Record',operations:{update:{run:save}}}};
 rows.items=[record];rows.selected=record;group[meta].form=['rows'];
 model[meta].userPermissions={owner:model[meta].owner!,administrator:false,grants:[{node:rows,read:true,write:true,operations:{query:true,update:true}}]};
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();
 await wrapper.get('input[aria-label="Code"]').setValue('changed');
 await wrapper.findAll('button').find(b=>b.text()==='保存')!.trigger('click');await flushPromises();expect(save).toHaveBeenCalledTimes(1);
 wrapper.unmount();
});
it('shows an unprojected deep linked record inside its owning aggregate',async()=>{
 const {model}=fixture();const group=model.group as Extract<BusinessModel[string],{[meta]:{kind:'object'}}>;
 const rows=group.rows as Extract<BusinessModel[string],{[meta]:{kind:'collection'}}>;
 const record={code:{value:'deep link',[meta]:{kind:'text' as const,name:'Code'}},[meta]:{kind:'object' as const,name:'Record',operations:{}}};
 rows.items=[record];group[meta].form=['intro'];model[meta].navigation.current=record;
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();
 expect(wrapper.text()).toContain('Partners');expect(wrapper.get('input[aria-label="Code"]').element.value).toBe('deep link');wrapper.unmount();
});
