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
