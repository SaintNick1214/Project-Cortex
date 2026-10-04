/** Trusted ROOT-only nonpaid source adapter. All authority/accounting ports consume s.rpc tickets. */
import assert from 'node:assert/strict';
import {governGatewayLanguageModel} from '../runtime/gateway.mjs';
import {canonical} from './original-b-cases.mjs';
export async function gatewayNative(s,id,{seed,b,args,call,snapshot,duplicate,denied}){
 const healthy=id==='gateway-native-healthy-attachment',cost=id==='gateway-native-drift-150'?150:40;
 const binding={reference:seed.reference,operationKey:'agent.respond',runBudgetId:b.runBudgetId,semanticId:'semantic',ordinal:0};
 let nativeCalls=0,captureCalls=0,attachCalls=0,attempt,captured;
 const ledger={resolve:a=>call('resolve',a),admit:async a=>{const r=await call('admit',a);if(r.status==='reserved')attempt=r;return r;},checkpoint:a=>call('checkpoint',a),markVisible:a=>call('markVisible',a),attachTerminalResult:async a=>{attachCalls++;return await call('attachTerminalResult',a);}};
 const terminalSink={capture:async a=>{captureCalls++;const result=await call('captureTerminalEvidence',a);captured={args:a,result};return result;}};
 const resolution=await ledger.resolve(binding);assert.equal(resolution.dispatchEvidence.providerVersion,'0.2.1');
 const usage={inputTokens:{total:15,noCache:undefined,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:2,text:undefined,reasoning:undefined}};
 const syntheticNative={specificationVersion:'v4',modelId:resolution.snapshot.modelId,provider:'convexGateway.chat',supportedUrls:{},doStream:async()=>{throw Error('QA_UNPLANNED_STREAM');},doGenerate:async()=>{nativeCalls++;assert.equal(nativeCalls,1);return{content:[{type:'text',text:'answer'}],finishReason:{unified:'stop',raw:'stop'},usage,warnings:[],response:{body:{id:'qa-'+id,model:healthy?resolution.snapshot.modelId:'qualification/drift-model',choices:[{finish_reason:'stop'}],usage:{prompt_tokens:15,completion_tokens:2,total_tokens:17,cost:'0.000'+String(cost).padStart(3,'0')}}}};}};
 const h=governGatewayLanguageModel(syntheticNative,{ledger,terminalSink},binding,resolution);
 const invoke=()=>h.model.doGenerate({prompt:[{role:'user',content:[{type:'text',text:'hello'}]}],maxOutputTokens:20});
 try{
  if(healthy){const result=await invoke();assert.equal(result.content[0].text,'answer');assert.equal(attachCalls,1);}else{await assert.rejects(invoke,e=>e?.code==='QUALIFICATION_OVERRUN');assert.equal(attachCalls,0);}
  await h.lifecycle.complete();assert.ok(Object.values(h.lifecycle.pendingWork()).every(value=>value===0));assert.equal(nativeCalls,1);assert.equal(captureCalls,1);assert.ok(attempt&&captured);
  const rows=await snapshot(),t=rows.find(x=>x.id===attempt.attemptId).row,o=rows.find(x=>x.id===t.operationDocumentId).row,accounts=[t.runAccountId,t.tenantAccountId].map(key=>rows.find(x=>x.id===key).row);
  for(const r of [o,...accounts]){assert.equal(r.reservedUnits,0);assert.equal(r.uncertainUnits,0);assert.equal(r.settledUnits,cost);assert.equal(r.overrun,!healthy);}for(const r of accounts)assert.equal(r.activeConcurrency,0);assert.equal(t.slotReleased,true);assert.equal(t.actualModel,healthy?resolution.snapshot.modelId:'qualification/drift-model');assert.equal(t.resultAttachmentState,healthy?'attached':'closed');assert.equal(t.privateResultCanonical,healthy?canonical({text:'answer'}):undefined);
  await duplicate(()=>call('captureTerminalEvidence',captured.args),captured.result);
  if(healthy)await duplicate(()=>ledger.attachTerminalResult({reference:seed.reference,attemptId:attempt.attemptId,evidenceId:captured.result.evidenceId,privateResultCanonical:canonical({text:'answer'})}),{attached:true,resultWithheld:false});
  else await denied(()=>call('admit',{...args,semanticId:'forbidden-replay',ordinal:1}));
  assert.equal(nativeCalls,1);const before=await snapshot();const replay=await call('checkpoint',{reference:seed.reference,attemptId:attempt.attemptId,requestCanonical:attempt.requestCanonical});assert.equal(replay.dispatchPermit,false);assert.equal(replay.replayAllowed,false);assert.equal(canonical(await snapshot()),canonical(before));assert.equal(nativeCalls,1);
 }finally{h.lifecycle.cancel();await h.lifecycle.complete();}
}
