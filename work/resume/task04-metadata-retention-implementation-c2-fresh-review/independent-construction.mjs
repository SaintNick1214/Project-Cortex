import assert from 'node:assert/strict';
import {selectGenerate,observeGenerate,nativeEvent,makeEvent} from '../../../_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2/fixture/convex/observer.ts';
import {BINDING} from '../../../_goals/convex-backend-runtime-2026-10-02/qa/task04-metadata-retention-implementation-c2/fixture/convex/installed.ts';
const ctx={binding:BINDING,scenarioId:'C01',dispatchIdentity:'a'.repeat(64),enteredAt:Date.now(),now:Date.now(),originalDeadline:Date.now()+15000,sourceClosureHash:BINDING.installedClosureHash};
const root={content:[{type:'text',text:'DUMMY'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:1},outputTokens:{total:1}},providerMetadata:{convexGateway:{cost:.000001}},response:{id:'DUMMY',modelId:'openai/gpt-4o-mini',body:{id:'DUMMY',model:'openai/gpt-4o-mini',choices:[{index:0,message:{content:'DUMMY'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,cost:.000001},padding:[]}}};
for(let i=0;i<1000;i++){root['ROOT'+i]=null;root.providerMetadata['META'+i]=null;root.providerMetadata.convexGateway['GW'+i]=null;}
const count=x=>1+(x&&typeof x==='object'?Object.values(x).reduce((n,y)=>n+count(y),0):0);
const initial=await observeGenerate(ctx,root),n=count(JSON.parse(initial.transcriptCanonical));root.response.body.padding=Array(4096-n).fill(null);
const exact=await observeGenerate(ctx,root);assert.equal(count(JSON.parse(exact.transcriptCanonical)),4096);
root.response.body.padding.push(null);
const sort=Array.prototype.sort,freeze=Object.freeze;let work=0;
Array.prototype.sort=function(...args){if(this.includes('ROOT999')||this.includes('META999')||this.includes('GW999'))work++;return sort.apply(this,args)};
Object.freeze=function(v){if(Array.isArray(v)&&(v.includes('ROOT999')||v.includes('META999')||v.includes('GW999')))work++;return freeze(v)};
try{assert.throws(()=>selectGenerate(root),/GRAPH_LIMIT/);assert.equal(work,0)}finally{Array.prototype.sort=sort;Object.freeze=freeze}
let getter=0;const malformed={};Object.defineProperty(malformed,'usage',{enumerable:true,get(){getter++;return {cost:0}}});
await assert.rejects(nativeEvent(1,{type:'finish',finishReason:root.finishReason,usage:root.usage,providerMetadata:{convexGateway:{cost:0}}},[{sequence:0,kind:'raw',digest:'0'.repeat(64),data:malformed}]),/OWN_DATA/);assert.equal(getter,0);
const before=await makeEvent(0,'raw',{choices:[]});await assert.rejects(nativeEvent(2,{type:'finish',finishReason:root.finishReason,usage:root.usage,providerMetadata:{convexGateway:{cost:0}}},[before]),/EVENT_IDENTITY/);assert.equal(before.sequence,0);
console.log(JSON.stringify({scope:'INDEPENDENT_THREE_PARENT_SHARED_REMAINING_CAPACITY_AND_CANONICAL_PREFLIGHT',exactNodes:4096,overNodes:4097,threeParentSortFreezeBeforeDenial:work,getterReads:getter,sequenceMismatchDenied:true,status:'PASS'}));
