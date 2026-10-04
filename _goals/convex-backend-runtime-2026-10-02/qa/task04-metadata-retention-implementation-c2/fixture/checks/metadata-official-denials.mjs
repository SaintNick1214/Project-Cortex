import assert from 'node:assert/strict';
import {OFFICIAL_DRIVER} from '../../fixture-vm/convex/runner.ts';
import {setParts,setGeneration} from '../../fixture-vm/convex/dummy-port.mjs';
import {BINDING} from '../convex/installed.ts';
import {CASES} from '../convex/cases.ts';
import {nativeEvent,makeEvent} from '../convex/observer.ts';
const model='openai/gpt-4o-mini',cost=.000001;
const context=scenarioId=>({binding:BINDING,scenarioId,dispatchIdentity:'a'.repeat(64),enteredAt:Date.now(),now:Date.now(),originalDeadline:Date.now()+15000,sourceClosureHash:BINDING.installedClosureHash});
const outcomes=[];
const finish={type:'finish',finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:1},outputTokens:{total:1}},providerMetadata:{convexGateway:{cost}}};
for(let i=0;i<1000;i++)finish.providerMetadata.convexGateway['unused'+i]=null;
const sort=Array.prototype.sort,freeze=Object.freeze;
async function beforeKeys(fn){let sorted=0,frozen=0;Array.prototype.sort=function(...args){if(this.includes('unused999')&&this.includes('cost'))sorted++;return sort.apply(this,args);};Object.freeze=function(value){if(Array.isArray(value)&&value.includes('unused999')&&value.includes('cost'))frozen++;return freeze(value);};try{await fn();assert.equal(sorted,0);assert.equal(frozen,0);}finally{Array.prototype.sort=sort;Object.freeze=freeze;}}
const raw=()=>({type:'raw',rawValue:{id:'DUMMY',model,choices:[],usage:{cost}}});
await beforeKeys(async()=>{const prefix=[];for(let i=0;i<9;i++)prefix.push(await makeEvent(i,'raw',raw().rawValue));await assert.rejects(nativeEvent(9,finish,prefix),/SHAPE/);});
outcomes.push({name:'actual explicit V2 finish full raw9 prefix rejects before witness sort/freeze',status:'PASS'});
await beforeKeys(async()=>{const first=await nativeEvent(0,{...finish,providerMetadata:{convexGateway:{cost}}},[]);await assert.rejects(nativeEvent(1,finish,[first]),/SHAPE/);});
outcomes.push({name:'actual explicit V2 second finish rejects before witness sort/freeze',status:'PASS'});
for(const [name,parts] of [['raw9',[...Array.from({length:9},raw),finish]],['finish2',[{...finish,providerMetadata:{convexGateway:{cost}}},finish]]]){
 await beforeKeys(async()=>{setParts(parts);const o=await OFFICIAL_DRIVER.execute(CASES.find(c=>c.scenarioId==='C09'),context('C09'),new AbortController().signal,async()=>false);assert.equal(o.receipt.money,'unknown');assert.equal(o.amountEvidence,null);assert.equal(o.privateResultCanonical,null);assert.equal(o.receipt.reason,'unsupported');assert(o.readerOwnership.failures.some(e=>e.message==='SHAPE'));await o.readerOwnership.join();});
 outcomes.push({name:'ACTUAL official runner '+name+' structural error owned cancellation/marker/private withholding',status:'PASS'});
}
const r={content:[{type:'text',text:'DUMMY'}],finishReason:finish.finishReason,usage:finish.usage,providerMetadata:finish.providerMetadata,response:{id:'DUMMY',modelId:model,body:{id:'DUMMY',model,choices:[{index:0,message:{content:'DUMMY'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,cost},padding:Array(4050).fill(null)}}};
await beforeKeys(async()=>{setGeneration(r);await assert.rejects(OFFICIAL_DRIVER.execute(CASES.find(c=>c.scenarioId==='C01'),context('C01'),new AbortController().signal,async()=>false),/GRAPH_LIMIT/);});
outcomes.push({name:'ACTUAL official generate historical oversized source rejects before keys sort/freeze',status:'PASS'});
console.log(JSON.stringify({scope:'ACTUAL_OFFICIAL_SOURCE_EARLIER_CONSTRUCTION_DENIAL_SUPPLEMENT_OFFLINE_ONLY',outcomes,actual:'EMPTY/null/uninstalled',skipped:0}));
