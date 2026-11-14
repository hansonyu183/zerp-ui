import { computed, ref, toRaw, type ComputedRef,type Ref,type InjectionKey } from 'vue';
import type { BusinessModel } from './business-model';
import { nodeMetadata as meta } from './model-node';
export type Node = BusinessModel[string];
export type ObjectNode = Extract<Node,{[meta]:{kind:'object'}}>;
export type CollectionNode = Extract<Node,{[meta]:{kind:'collection'}}>;
export type Target = ObjectNode | CollectionNode;
export type Action = {disabledReason?:string;run():Promise<void>};
export function members(node:Node):[string,Node][] {
 if(node[meta].kind!=='object') return [];
 const object=node as ObjectNode;
 return (object[meta].form??Object.keys(object)).flatMap(key=>object[key] ? [[key,object[key]] as [string,Node]]:[]);
}
export interface DirectRuntime {
model:()=>BusinessModel;scope:ComputedRef<string>;ready:ComputedRef<boolean>;busy:Ref<Set<object>>;error:Ref<string>;ancestors(node:Node):Node[];readable(node:Node):boolean;writable(node:Node):boolean;allowed(node:Node,action:string,publicAuth?:boolean):boolean;operations(node:Node):Record<string,Action>;run(node:Node,action:string,publicAuth?:boolean):Promise<void>;invalidate():void;
}
export function createDirectRuntime(model:()=>BusinessModel):DirectRuntime{
 const scope=computed(()=>JSON.stringify(model()[meta].owner));
 const ready=computed(()=>!!model()[meta].owner && JSON.stringify(model()[meta].userPermissions?.owner)===scope.value);
 const busy=ref(new Set<object>()); const error=ref(''); let epoch=0;
 function paths():Map<object,Node[]> {
  const result=new Map<object,Node[]>();
  function walk(node:Node,parents:Node[]){if(result.has(toRaw(node)))return;result.set(toRaw(node),parents); if(node[meta].kind==='object')for(const child of Object.values(node))walk(child,[...parents,node]); else if(node[meta].kind==='array'){const a=node as Extract<Node,{[meta]:{kind:'array'}}>;walk(a[meta].element,[...parents,node]);for(const item of a.items)walk(item,[...parents,node]);} else if(node[meta].kind==='collection'){const c=node as CollectionNode;walk(c.query,[...parents,node]);walk(c[meta].element,[...parents,node]);for(const item of [...c.items,c.selected,c.draft])if(item)walk(item,[...parents,node]);}}
  for(const node of Object.values(model()))walk(node,[]); return result;
 }
 function ancestors(node:Node){return paths().get(toRaw(node))??[];}
 function grant(node:Node){const p=model()[meta].userPermissions;return p&&!p.administrator?p.grants.find(x=>toRaw(x.node)===toRaw(node)):undefined;}
 function boundary(node:Node):Node|undefined {const chain=[...ancestors(node),node];return chain.find((n,i)=>n[meta].kind==='collection'||(n[meta].kind==='object'&&Object.keys((n as ObjectNode)[meta].operations).length>0&&chain[i-1]?.[meta].kind!=='array'))??chain.find(n=>n[meta].kind==='object')??node;}
 function readable(node:Node):boolean {
  if(!ready.value)return false;
  const p=model()[meta].userPermissions!;if(p.administrator)return true;
  const direct=grant(node);if(direct?.read===false)return false;
  if(node[meta].kind==='collection')return direct?.read===true;
  const parent=ancestors(node).at(-1);
  if(node[meta].kind==='object'){
   if(parent?.[meta].kind==='collection'||parent?.[meta].kind==='array')return readable(parent);
   if(Object.keys((node as ObjectNode)[meta].operations).length)return direct?.read===true;
   if(direct?.read===true)return true;
   if(parent&&parent[meta].kind==='object'&&grant(parent)?.read)return readable(parent);
   return Object.values(node).some(child=>['object','collection'].includes(child[meta].kind)&&readable(child));
  }
  return !!parent&&readable(parent);
 }
 function writable(node:Node):boolean {if(!readable(node))return false; if([...ancestors(node),node].some(n=>'readOnly'in n[meta]&&n[meta].readOnly))return false;const p=model()[meta].userPermissions!;if(p.administrator)return true;const b=boundary(node);return !!b&&grant(b)?.write===true&&[...ancestors(node),node].every(n=>grant(n)?.write!==false);}
 function allowed(node:Node,action:string,publicAuth=false){
  if(publicAuth)return !model()[meta].owner&&['signIn','restoreSession','recover'].includes(action);
  if(!readable(node))return false;
  if(!['get','query','export','preview','reconcile'].includes(action)&&!writable(node))return false;
  const p=model()[meta].userPermissions!;if(p.administrator)return true;
  const b=boundary(node);const g=grant(node)??(b&&grant(b));return !!g&&Reflect.get(g.operations??{},action)===true;
 }
 function operations(node:Node):Record<string,Action>{return 'operations'in node[meta]?node[meta].operations as Record<string,Action>:{};}
 async function run(node:Node,action:string,publicAuth=false){const op=operations(node)[action];if(!op||op.disabledReason||busy.value.has(toRaw(node))||!allowed(node,action,publicAuth))return;const start=epoch;const owner=scope.value;busy.value.add(toRaw(node));error.value='';try{await op.run();}catch{if(start===epoch&&owner===scope.value)error.value='操作失败，请检查业务信息后重试。';}finally{busy.value.delete(toRaw(node));}}
 function invalidate(){epoch++;error.value='';}
 return {model,scope,ready,busy,error,ancestors,readable,writable,allowed,operations,run,invalidate};
}

export const directRuntimeKey:InjectionKey<DirectRuntime>=Symbol('direct-business-model');
export const labels:Record<string,string>={get:'刷新',update:'保存',delete:'删除',reconcile:'核对结果',query:'查询',create:'新增',export:'导出',signIn:'登录',restoreSession:'恢复会话',signOut:'退出',changePassword:'修改密码',submit:'提交',approve:'审批',enable:'启用',disable:'停用',transition:'流转',executeBatch:'执行批次',preview:'预览',print:'打印',confirmPrinted:'确认已打印',confirmNotPrinted:'确认未打印'};
