import { mount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { expect, it, vi } from 'vitest';
import { createVuetify } from 'vuetify';
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
 const wrapper=mount(BusinessApplication,{props:{model},global:{plugins:[createVuetify()]}});
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
 expect(wrapper.get('[role="alert"]').text()).toContain('操作失败');wrapper.unmount();
});
it('does not display workspace or old messages after owner permissions cease to match',async()=>{
 const {model}=fixture();model[meta].messages=[{id:'old',level:'info',text:'old owner notification'}];
 const wrapper=mount(BusinessApplication,{props:{model}});await flushPromises();
 model[meta].owner={ledger:'new',operator:'next',generation:'2'};await flushPromises();
 expect(wrapper.find('nav').exists()).toBe(false);expect(wrapper.text()).not.toContain('old owner notification');wrapper.unmount();
});
