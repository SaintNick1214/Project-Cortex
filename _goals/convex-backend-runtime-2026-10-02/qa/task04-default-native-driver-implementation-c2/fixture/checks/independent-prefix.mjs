import assert from 'node:assert/strict';
import {Harness} from './harness.mjs';
import * as guard from '../convex/guard.ts';
import {BINDING} from '../convex/installed.ts';
import {CASES,ORDER} from '../convex/cases.ts';
import {canonical,micro} from '../convex/validate.ts';
import {observeGenerate,observeStream,observeEmbed,makeEvent} from '../convex/observer.ts';
const H='a'.repeat(64),cats=['cache-read','cache-write','cancelled','inference','rejected','routing','surcharge'];
// DUMMY conditional trusted server resolver; no installed actual registry/native/proof claims.
const resolver={lifetime:(_c,n)=>n.correlatedShape?{kind:'validated',proofHash:H,value:true}:{kind:'unknown',reason:'missing-evidence'},serving:()=>({kind:'validated',proofHash:H,value:{}}),money:(_c,n)=>({kind:'validated',proofHash:H,value:{microUSD:micro(n.rawCost),currency:'USD',categories:cats}})};
export const h=await new Harness().setup(guard.buildControls(resolver));
for(const scenarioId of ORDER){await h.reserve(scenarioId);await h.enter(scenarioId);if(scenarioId==='C09')break;const a=h.state().attempts.at(-1),c=CASES.find(c=>c.scenarioId===scenarioId),now=Date.now(),oc={binding:BINDING,scenarioId,dispatchIdentity:a.dispatchIdentity,enteredAt:now,now,originalDeadline:now+15000,sourceClosureHash:BINDING.installedClosureHash};let o;
if(c.method==='generate')o=await observeGenerate(oc,{content:[{type:'text',text:'DUMMY'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:1},outputTokens:{total:1}},response:{body:{id:'DUMMY',model:c.modelId,choices:[{index:0,message:{content:'DUMMY'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,cost:'0'}}}},resolver);
else if(c.method==='embed'){const v=Array(1536).fill(0);o=await observeEmbed(oc,{embeddings:[v],usage:{tokens:1},response:{body:{id:'DUMMY',model:c.modelId,data:[{embedding:v}],usage:{prompt_tokens:1,cost:'0'}}}},resolver)}
else {const e=[['raw',{id:'DUMMY',model:c.modelId,choices:[{index:0,delta:{content:'DUMMY'},finish_reason:null}]}],['text-start',{id:'DUMMY'}],['text-delta',{id:'DUMMY',delta:'DUMMY'}],['raw',{id:'DUMMY',model:c.modelId,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,cost:'0'}}],['text-end',{id:'DUMMY'}],['finish',{finish:{unified:'stop',raw:'stop'},usage:{input:1,output:1}}]];o=await observeStream(oc,await Promise.all(e.map(([k,d],i)=>makeEvent(i,k,d))),'reader-done',resolver)}
assert.equal(o.receipt.reason,'none');await h.mutation(h.controls.capture,{scenarioId,dispatchIdentity:a.dispatchIdentity,observationCanonical:canonical(o.receipt,8192),contextCanonical:canonical(oc),transcriptCanonical:o.transcriptCanonical});}
