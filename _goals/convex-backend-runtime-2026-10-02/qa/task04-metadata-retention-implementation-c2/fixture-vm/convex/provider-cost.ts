import {retainProviderKeys} from './observation-builder.ts';
import {canonical,parseCanonical,record,one,fail} from './validate.ts';
export type Parent = {state:'record'|'missing'|'invalid';keys:string[]};
export type ProviderCost = {state:'present'|'missing'|'invalid';cost:number|null;reason:'none'|'missing'|'shape'|'number'|'bounds'};
export interface ProviderSnapshot {providerCost:ProviderCost;providerShape:[Parent,Parent,Parent]}
export interface AmountEvidence {version:2;source:'convexGateway.cost';extraction:'convex-metadata-cost-correlated-v2';method:'generate'|'stream';cost:number;providerEventSequence:number;rawUsageEventSequences:number[];responseId:string;actualModel:string;transcriptDigest:string}
type Descriptors=Record<string,PropertyDescriptor>;
const descriptorValue=(d:Descriptors,k:string):unknown=>Object.hasOwn(d,k)?d[k]!.value:undefined;
const noParent=(state:Parent['state']):Parent=>({state,keys:[]});
function inspectParent(value:unknown,ancestors:Set<object>):{parent:Parent;descriptors:Descriptors|null;sourceKeys:string[]}{
 if(value===null||value===undefined)return {parent:noParent('missing'),descriptors:null,sourceKeys:[]};
 if(typeof value!=='object'||Array.isArray(value)||ancestors.has(value))return {parent:noParent('invalid'),descriptors:null,sourceKeys:[]};
 try{
  if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))return {parent:noParent('invalid'),descriptors:null,sourceKeys:[]};
  const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d);
  for(const key of keys)if(typeof key!=='string'||!key.isWellFormed()||!('value'in d[key]!)||!d[key]!.enumerable)return {parent:noParent('invalid'),descriptors:null,sourceKeys:[]};
  ancestors.add(value);
  return {parent:{state:'record',keys:[]},descriptors:d,sourceKeys:keys as string[]};
 }catch(error){if(error instanceof Error&&error.message==='GRAPH_LIMIT')throw error;return {parent:noParent('invalid'),descriptors:null,sourceKeys:[]}}
}
function freezeSnapshot(x:ProviderSnapshot):ProviderSnapshot{
 const detached=parseCanonical(canonical(x,180000),180000) as unknown as ProviderSnapshot;
 for(const p of detached.providerShape){Object.freeze(p.keys);Object.freeze(p)}
 Object.freeze(detached.providerShape);Object.freeze(detached.providerCost);return Object.freeze(detached);
}
export function selectProviderSnapshot(root:unknown,prospective:(snapshot:ProviderSnapshot)=>unknown):ProviderSnapshot{
 const seen=new Set<object>(),a=inspectParent(root,seen);
 const b=a.parent.state==='record'?inspectParent(descriptorValue(a.descriptors!,'providerMetadata'),seen):{parent:noParent('invalid'),descriptors:null,sourceKeys:[]};
 const c=b.parent.state==='record'?inspectParent(descriptorValue(b.descriptors!,'convexGateway'),seen):{parent:noParent(b.parent.state),descriptors:null,sourceKeys:[]};
 let cost:ProviderCost;
 if([a,b,c].some(x=>x.parent.state==='invalid'))cost={state:'invalid',cost:null,reason:'shape'};
 else if(c.parent.state==='missing')cost={state:'missing',cost:null,reason:'missing'};
 else{const value=descriptorValue(c.descriptors!,'cost');
 if(value===null||value===undefined)cost={state:'missing',cost:null,reason:'missing'};
 else if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&!Object.is(value,-0))cost={state:'present',cost:value,reason:'none'};
 else cost={state:'invalid',cost:null,reason:'number'};}
 const snapshot:ProviderSnapshot={providerCost:cost,providerShape:[a.parent,b.parent,c.parent]};
 retainProviderKeys(snapshot,[a.sourceKeys,b.sourceKeys,c.sourceKeys],prospective);
 return freezeSnapshot(snapshot);
}
export function validateProviderSnapshot(costValue:unknown,shapeValue:unknown):ProviderSnapshot{
 const cost=record(costValue,'state cost reason'),state=one(cost.state,['present','missing','invalid']),reason=one(cost.reason,['none','missing','shape','number','bounds']);
 if(!Array.isArray(shapeValue)||shapeValue.length!==3)fail('PROVIDER_SHAPE');
 const shape=shapeValue.map(value=>{
  const p=record(value,'state keys'),s=one(p.state,['record','missing','invalid']);
  if(!Array.isArray(p.keys)||p.keys.some(k=>typeof k!=='string'||!k.isWellFormed()))fail('PROVIDER_KEYS');
  const keys=p.keys as string[];if(keys.length>4096||keys.some((k,i)=>i>0&&keys[i-1]!>=k)||s!=='record'&&keys.length!==0)fail('PROVIDER_KEYS');
  return {state:s,keys} as Parent;
 }) as [Parent,Parent,Parent];
 const [a,b,c]=shape;
 if(a.state!=='record'&&(b.state!=='invalid'||c.state!=='invalid'))fail('PROVIDER_PROPAGATION');
 if(b.state!=='record'&&c.state!==b.state)fail('PROVIDER_PROPAGATION');
 if(a.state==='record'&&!a.keys.includes('providerMetadata')&&b.state!=='missing')fail('PROVIDER_PROPAGATION');
 if(b.state==='record'&&!b.keys.includes('convexGateway')&&c.state!=='missing')fail('PROVIDER_PROPAGATION');
 const malformed=shape.some(p=>p.state==='invalid'),missing=c.state==='missing'||c.state==='record'&&!c.keys.includes('cost');
 if(state==='present'){
  if(malformed||missing||shape.some(p=>p.state!=='record')||reason!=='none'||typeof cost.cost!=='number'||!Number.isFinite(cost.cost)||cost.cost<0||Object.is(cost.cost,-0))fail('PROVIDER_COST');
 }else{
  if(cost.cost!==null)fail('PROVIDER_COST');
  if(state==='missing'&&(reason!=='missing'||malformed))fail('PROVIDER_COST');
  if(state==='invalid'&&((malformed&&reason!=='shape')||(!malformed&&(missing||reason!=='number'))))fail('PROVIDER_COST');
 }
 return freezeSnapshot({providerCost:cost as unknown as ProviderCost,providerShape:shape});
}
