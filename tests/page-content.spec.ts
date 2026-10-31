import { mount, flushPromises } from '@vue/test-utils';
import { expect, it } from 'vitest';
import { AppPage, defineDetailsPage } from '../src/index';
import { createRouter, createMemoryHistory } from 'vue-router';

it('shows grouped facts and related intents through the complete page entrance', async () => {
  const related: string[] = [];
  const page = defineDetailsPage({
    title: '资料事实',
    instance: 'record-one',
    value: { amount: '9007199254740993.0100', reference: { id: 'old', label: '历史名称' } },
    groups: [{ key: 'facts', label: '历史事实', fields: [
      { key: 'amount', label: '金额', type: 'decimal' },
      { key: 'reference', label: '来源', type: 'reference', related: (value) => value.id },
    ] }],
    onRelated: (intent) => related.push(intent),
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [{path:'/',component:{template:'<span />'}}] });
  const wrapper = mount(AppPage, { props: {
    page, scope: 'synthetic', brand: { home:'/', productName: '合成库', enterpriseName: '合成公司', mark: { kind: 'text', text: '合' } },
    brandState: { kind: 'ready' }, navigationState: { kind: 'ready' }, navigation: [], footer: '合成验证',
  }, global: { plugins: [router] } });
  await flushPromises();
  expect(wrapper.findAll('h1').map(node => node.text())).toEqual(['资料事实']);
  expect(wrapper.text()).toContain('9007199254740993.0100');
  const button = wrapper.findAll('button').find(node => node.attributes('aria-label') === '查看来源：历史名称');
  expect(button).toBeDefined();
  await button!.trigger('click');
  expect(related).toEqual(['old']);
  wrapper.unmount();
});

import { defineCrud, defineCrudPage, domainBlocks } from '../src/index';
type Editable={name:string;settings:{count:number}};
function editablePage(write:()=>Promise<{status:'unknown'}|{status:'success'}>){
  const definition=defineCrud<Editable,{}, {id:string;name:string},string>({
    resource:'synthetic-records',title:'资料维护',fields:[{key:'name',label:'名称',type:'text'}],filters:[],initialFilters:()=>({}),columns:[{key:'name',label:'名称'}],identity:row=>row.id,actions:()=>['view','edit'],
    adapter:{query:async()=>({items:[{id:'one',name:'原名称'}],total:1}),get:async()=>({values:{name:'原名称',settings:{count:2}},identity:'one'}),empty:()=>({name:'',settings:{count:0}}),create:write,save:write},
  });
  return defineCrudPage({definition,permissions:{query:true,create:true,write:true},initialRow:{id:'one',name:'原名称'},readOnly:false,blocks:[domainBlocks<Editable>().fields({key:'settings',label:'设置',fields:[{key:'count',label:'数量',type:'integer'}]})]});
}
function mountPage(page:ReturnType<typeof defineDetailsPage>){
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{template:'<span />'}}]});
  return mount(AppPage,{props:{page,scope:'synthetic',brand:{home:'/',productName:'合成',enterpriseName:'合成',mark:{kind:'text',text:'合'}},brandState:{kind:'ready'},navigationState:{kind:'ready'},navigation:[],footer:'合成'},global:{plugins:[router]}});
}
it('keeps unfinished library block input protected when a different page is requested',async()=>{
  const wrapper=mountPage(editablePage(async()=>({status:'success'})));
  await flushPromises();
  const count=wrapper.get('input[aria-label="数量"]');
  await count.setValue('-');
  const save=wrapper.findAll('button').find(node=>node.text()==='保存')!;
  expect(save.attributes('disabled')).toBeDefined();
  const next=defineDetailsPage({title:'其它页面',instance:'two',value:{name:'其它'},groups:[{key:'base',label:'基本信息',fields:[{key:'name',label:'名称',type:'text'}]}]});
  await wrapper.setProps({page:next});
  expect(wrapper.get('[role="dialog"][aria-label="未保存修改"]').exists()).toBe(true);
  const continueEditing=wrapper.findAll('button').find(node=>node.text()==='继续编辑')!;
  await continueEditing.trigger('click');await flushPromises();
  expect(wrapper.get('h1').text()).toBe('资料维护');
  expect(wrapper.get('input[aria-label="数量"]').element.value).toBe('-');
  await wrapper.setProps({active:false});await flushPromises();
  expect(wrapper.findAll('input')).toHaveLength(0);
  wrapper.unmount();
});
it('keeps the current page and original write lock after an unknown save',async()=>{
  let writes=0;
  const wrapper=mountPage(editablePage(async()=>{writes++;return {status:'unknown'};}));
  await flushPromises();
  await wrapper.get('input[aria-label="名称"]').setValue('修改名称');
  await wrapper.findAll('button').find(node=>node.text()==='保存')!.trigger('click');
  await flushPromises();
  const next=defineDetailsPage({title:'其它页面',instance:'two',value:{name:'其它'},groups:[]});
  await wrapper.setProps({page:next});await flushPromises();
  expect(wrapper.get('h1').text()).toBe('资料维护');
  expect(wrapper.find('[aria-label="未保存修改"]').exists()).toBe(false);
  expect(wrapper.text()).toContain('未知');
  expect(writes).toBe(1);
  wrapper.unmount();
});

import { defineVoucherOperationPage, defineAccountPage } from '../src/index';
import { reactive } from 'vue';
import { synthetic, type Store, type Scenario, type Identity, type SyntheticModel, type Baseline } from '../examples/voucher/operation-adapter';
import type { VoucherOperationIntent, VoucherOperationSettlement } from '../src/index';
Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name:string,work:()=>Promise<unknown>)=>work()}});
it('owns voucher editing and restores an original not-applied request inside the complete page',async()=>{
  const values=new Map<string,string>();
  const storage:Store={getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}};
  const scenario:Scenario='not-applied';
  const events:string[]=[];
  const definition=synthetic(storage,()=>scenario,event=>events.push(event));
  const intent:VoucherOperationIntent<SyntheticModel,Identity>={action:'edit',owner:{scope:'synthetic',operator:'operator',resource:'voucher'},identity:{voucher:'one'},input:{note:'原内容',rows:[{key:'r1',quantity:'1.0100'}]}};
  const settlements:VoucherOperationSettlement<SyntheticModel,Identity,Baseline>[]=[];
  const page=defineVoucherOperationPage({title:'单据内容',definition,intent,eligible:true,recoveryAllowed:true,onSettled:value=>settlements.push(value),editor:{
    definition:{headerFields:[{key:'note',label:'内容备注',type:'text'}],rowFields:[{key:'quantity',label:'内容数量',type:'decimal'}],columns:[{key:'quantity',label:'数量',type:'decimal'}],rowKey:row=>row.key,emptyRow:()=>({key:'new',quantity:'0'})},
    value:{header:{note:'原内容'},rows:[{key:'r1',quantity:'1.0100'}]},
    toIntent:content=>({...intent,action:'edit',input:{note:content.header.note,rows:content.rows}}),
    restore:request=>request.action==='create'||request.action==='edit'?{header:{note:request.input.note},rows:request.input.rows}:null,
    adopt:()=>null,
  }});
  const wrapper=mountPage(page);await flushPromises();
  await wrapper.get('input[aria-label="内容备注"]').setValue('办理原输入');
  const click=async(text:string)=>{await wrapper.findAll('button').find(node=>node.text()===text)!.trigger('click');await flushPromises();};
  await click('准备保存修改');
  expect(wrapper.get('[aria-label="完整办理预览"]').text()).toContain('办理原输入');
  await click('确认保存修改');
  expect(wrapper.text()).toContain('必须封存');
  expect(wrapper.get('input[aria-label="内容备注"]').attributes('disabled')).toBeDefined();
  await click('封存原请求');
  expect(settlements).toHaveLength(1);
  await wrapper.get('input[aria-label="内容备注"]').setValue('尚未采用新值');
  await click('恢复原内容');
  expect(wrapper.get('input[aria-label="内容备注"]').element.value).toBe('办理原输入');
  expect(events.filter(event=>event.startsWith('execute:'))).toHaveLength(1);
  wrapper.unmount();
});
it('owns account validation, unfinished inputs and local cancel without inventing account rules',async()=>{
  const submissions:{name:string;count:number}[]=[];
  const facts=reactive({busy:false,error:'',notice:''});
  const page=defineAccountPage(()=>({kind:'profile',title:'账户名称与头像',values:{name:'原名称',count:2},fields:[{key:'name',label:'账户名称',type:'text',required:true},{key:'count',label:'验证数量',type:'integer'}],...facts,submit:value=>submissions.push(value)}));
  const wrapper=mountPage(page);await flushPromises();
  await wrapper.get('input[aria-label="账户名称"]').setValue('新名称');
  await wrapper.get('input[aria-label="验证数量"]').setValue('-');
  const submit=wrapper.findAll('button').find(node=>node.attributes('type')==='submit')!;
  expect(submit.attributes('disabled')).toBeDefined();
  expect(submissions).toHaveLength(0);
  await wrapper.get('input[aria-label="验证数量"]').setValue('3');
  await wrapper.get('form').trigger('submit');await flushPromises();
  expect(submissions).toEqual([{name:'新名称',count:3}]);
  facts.busy=true;await flushPromises();
  const next=defineDetailsPage({title:'其它页面',instance:'two',value:{},groups:[]});
  await wrapper.setProps({page:next});await flushPromises();
  expect(wrapper.get('h1').text()).toBe('账户名称与头像');
  wrapper.unmount();
});
