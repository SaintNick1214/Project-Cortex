import assert from 'node:assert/strict';
import {observeGenerate,observeTranscript,observeStream,makeEvent} from '../convex/observer.ts';
import {canonical,digest} from '../convex/validate.ts';
import {BINDING} from '../convex/installed.ts';
import {Harness} from './harness.mjs';
import * as guard from '../convex/guard.ts';
const context=(scenarioId='C01')=>({binding:BINDING,scenarioId,dispatchIdentity:'a'.repeat(64),enteredAt:Date.now(),now:Date.now(),originalDeadline:Date.now()+15000,sourceClosureHash:BINDING.installedClosureHash});
function result(){const model='openai/gpt-4o-mini',cost=.000001;return {content:[{type:'text',text:'DUMMY'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:1},outputTokens:{total:1}},providerMetadata:{convexGateway:{cost}},response:{id:'DUMMY',modelId:model,body:{id:'DUMMY',model,choices:[{index:0,message:{content:'DUMMY'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,cost}}}}}
async function captured(input){const h=await new Harness().setup();await h.reserve();await h.enter();const ctx={...context(),dispatchIdentity:h.state().attempts.at(-1).dispatchIdentity},o=await observeGenerate(ctx,input);const again=await observeTranscript(ctx,o.transcriptCanonical);assert.deepEqual(again.amountEvidence,o.amountEvidence);const before=h.state().reserved;const got=await h.mutation(guard.capture,{scenarioId:'C01',dispatchIdentity:ctx.dispatchIdentity,observationCanonical:canonical(o.receipt,8192),contextCanonical:canonical(ctx,4096),transcriptCanonical:o.transcriptCanonical});assert.equal(got.slotReleased,false);assert.equal(h.state().reserved,before);assert.equal(h.state().attempts.at(-1).known,null);assert.equal(o.receipt.money,'unknown');return o}
const outcomes=[];
const input=result();input.response.body.padding=[];
const base=await observeGenerate(context(),input),tr=JSON.parse(base.transcriptCanonical);
function nodes(x){return 1+(x&&typeof x==='object'?Object.values(x).reduce((sum,v)=>sum+nodes(v),0):0)}
const count=nodes(tr);input.response.body.padding=Array(4096-count).fill(null);
const full=await captured(input);assert.equal(nodes(JSON.parse(full.transcriptCanonical)),4096);
const extra=result();extra.response.body.padding=[...input.response.body.padding,null];await assert.rejects(observeGenerate(context(),extra),/GRAPH_LIMIT/);
const differentParent=result();differentParent.response.body.padding=[...input.response.body.padding];differentParent.providerMetadata.convexGateway.unused=1;await assert.rejects(observeGenerate(context(),differentParent),/GRAPH_LIMIT/);
outcomes.push({name:'actual native selector and registered capture equality at4096,4097 and identical cost extra parent key',status:'PASS'});
const byteInput=result();byteInput.response.body.padding='';const empty=await observeGenerate(context(),byteInput);
byteInput.response.body.padding='x'.repeat(180000-Buffer.byteLength(empty.transcriptCanonical));const fullByte=await captured(byteInput);assert.equal(Buffer.byteLength(fullByte.transcriptCanonical),180000);
byteInput.response.body.padding+='x';await assert.rejects(observeGenerate(context(),byteInput),/BYTE_LIMIT/);
outcomes.push({name:'actual selector registered capture exact180000 vs180001 full UTF8 bytes',status:'PASS'});
const deep=result();let nested=null;for(let i=0;i<11;i++)nested={child:nested};deep.response.body.padding=nested;await captured(deep);deep.response.body.padding={child:nested};await assert.rejects(observeGenerate(context(),deep),/GRAPH_LIMIT/);
outcomes.push({name:'actual selector/capture root0 depth16 accepts depth17 denies',status:'PASS'});
const raw=await makeEvent(0,'raw',{id:'DUMMY',model:'openai/gpt-4o-mini',choices:[],padding:Array(4044).fill(null)});
let one={version:2,method:'stream',events:[raw],ended:'reader-done'};
while(nodes(one)<4096){one.events[0].data.padding.push(null)}
assert.equal(nodes(one),4096);one.events[0].digest=await digest(canonical(one.events[0].data,180000));const ctx=context('C09'),text=canonical(one,180000),first=await observeTranscript(ctx,text);for(let i=0;i<50;i++)assert.deepEqual((await observeTranscript(ctx,text)).receipt,first.receipt);
const additional=await makeEvent(1,'response-metadata',{id:'DUMMY',modelId:'openai/gpt-4o-mini'});await assert.rejects(observeStream(ctx,[raw,additional],'reader-done',undefined,2),/GRAPH_LIMIT/);
const many=[];for(let i=0;i<512;i++)many.push(await makeEvent(i,'unsupported',{type:'DUMMY'}));assert.equal((await observeStream(ctx,many,'reader-done',undefined,2)).receipt.money,'unknown');many.push(await makeEvent(512,'unsupported',{type:'DUMMY'}));await assert.rejects(observeStream(ctx,many,'reader-done',undefined,2),/TRANSCRIPT/);
outcomes.push({name:'actual observer repeated identical prefix50 times does not doublecharge, new cumulative event and513 limit deny',status:'PASS'});
console.log(JSON.stringify({scope:'ACTUAL_CANDIDATE_NATIVE_SELECTOR_REGISTERED_CAPTURE_EXACT_RESOURCE_BOUNDARIES',outcomes,actualMoney:'EMPTY',skipped:0}));
