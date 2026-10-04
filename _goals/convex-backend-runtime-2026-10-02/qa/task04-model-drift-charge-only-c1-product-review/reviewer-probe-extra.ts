it.each([
  ['drift40','foreign/model','0.000040',15,2,40,0],
  ['drift150','foreign/model','0.000150',15,2,150,0],
  ['driftNoCost','foreign/model',undefined,15,2,0,100],
  ['driftUnsupported','foreign/model','0.000040',15,2,0,100],
  ['sameInputKnown','openai/gpt-4o-mini','0.000040',16,2,40,0],
  ['sameOutputUnknown','openai/gpt-4o-mini',undefined,15,21,0,100],
] as const)('independent actual adapter %s persists charge without private delivery',async (kind,served,cost,input,output,units,uncertain)=>{
 root={...root,dispatchEvidence:root.dispatchEvidence.map(p=>({...p,providerVersion:'0.2.1',...(kind==='driftUnsupported'?{terminalCost:'unavailable' as const}:{})}))};
 const f=fixture();await f.install();const b=await f.bind();const gateway=await import('/workspace/Project-Cortex/convex-dev/runtimeGateway');
 const resolution=await f.invoke<any>('resolve',{reference:f.reference,operationKey:'agent.respond',runBudgetId:b.runBudgetId});
 let captures=0,attachments=0,native=0,attemptId='',observed='';
 const h=gateway.governGatewayLanguageModel({specificationVersion:'v4',modelId:'openai/gpt-4o-mini',provider:'convexGateway.chat',supportedUrls:{},doStream:async()=>{throw Error('unused');},doGenerate:async()=>{native++;return {content:[{type:'text',text:'private answer'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:input},outputTokens:{total:output}},warnings:[],response:{body:{id:'review-terminal',model:served,choices:[{finish_reason:'stop'}],usage:{prompt_tokens:input,completion_tokens:output,total_tokens:input+output,...(cost===undefined?{}:{cost})}}}};}} as any,
 {now:()=>clock,ledger:{resolve:(a:any)=>f.invoke('resolve',a),admit:(a:any)=>f.invoke('admit',a),checkpoint:(a:any)=>f.invoke('checkpoint',a),markVisible:(a:any)=>f.invoke('markVisible',a),attachTerminalResult:(a:any)=>{attachments++;return f.invoke('attachTerminalResult',a);}},terminalSink:{capture:async(a:any)=>{captures++;attemptId=a.attemptId;observed=a.receiptCanonical;return await f.invoke<any>('captureTerminalEvidence',a);}}},
 {reference:f.reference,operationKey:'agent.respond',runBudgetId:b.runBudgetId,semanticId:'semantic',ordinal:0},resolution);
 await expect(h.model.doGenerate({prompt:[{role:'user',content:[{type:'text',text:'hello'}]}],maxOutputTokens:20})).rejects.toMatchObject({code:'QUALIFICATION_OVERRUN'});
 expect([captures,attachments,native]).toEqual([1,0,1]);expect(JSON.parse(observed)).toMatchObject({actualModel:served,modelId:'openai/gpt-4o-mini'});
 for(const k of ['tenant','run'])expect(f.account(k)).toMatchObject({reservedUnits:0,settledUnits:units,uncertainUnits:uncertain,activeConcurrency:0,overrun:true});
 expect(f.db.table('runtimeModelOperations')[0]).toMatchObject({reservedUnits:0,settledUnits:units,uncertainUnits:uncertain,overrun:true});
 const a=f.attempt(attemptId);expect(a).toMatchObject({actualModel:served,resultWithheld:true,resultAttachmentState:'closed',slotReleased:true});expect(a.privateResultCanonical).toBeUndefined();
 const writes=f.db.writes;await f.invoke('captureTerminalEvidence',{attemptId,dispatchIdentity:a.dispatchIdentity,receiptCanonical:observed});expect(f.db.writes).toBe(writes);
 await h.lifecycle.complete();expect(await h.lifecycle.consumeReplay()).toBeUndefined();expect(h.lifecycle.pendingWork()).toEqual({authority:0,capture:0,settlement:0,native:0,reader:0,cleanup:0});
});
it.each(['settle','recover','reconcileDeploymentLiability'] as const)('independent shared %s below monetary ceiling withholds model drift',async route=>{
 const {f,a}=await prepared();if(route==='reconcileDeploymentLiability')retired(f);
 await f.invoke(route,{attemptId:a.attemptId,receiptCanonical:f.receipt(a,'0.000040',{actualModel:'foreign/model'}),...(route==='reconcileDeploymentLiability'?{}:{reference:f.reference})});
 expect(f.attempt(a.attemptId)).toMatchObject({settledCostUnits:40,actualModel:'foreign/model',resultWithheld:true});expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
 for(const k of ['tenant','run'])expect(f.account(k)).toMatchObject({settledUnits:40,activeConcurrency:0,overrun:true});
});
it.each(['pending','attached'] as const)('independent healthy-rights %s refuses final-token observation despite false flags',async marker=>{
 const {f,a,b}=await prepared();await capture(f,a,charge(f,a,null));await capture(f,a,charge(f,a));const at=f.attempt(a.attemptId);
 const final=JSON.parse(at.receiptCanonical!);final.usage={outputTokens:21};at.receiptCanonical=canonicalModelJson(final);at.receiptHash=await semanticHash(at.receiptCanonical);
 at.resultAttachmentState=marker;at.resultWithheld=false;at.privateResultCanonical=canonicalModelJson({text:'host retained bytes'});at.outputVisible=true;
 for(const k of ['tenant','run'])f.account(k).overrun=false;f.db.table('runtimeModelOperations')[0]!.overrun=false;
 const id=await semanticHash(canonicalModelJson(['native-terminal-evidence-v1',at._id,at.dispatchIdentity,at.terminalEvidenceCanonical,at.terminalEvidenceHash]));
 const accounts=JSON.stringify(f.db.table('runtimeBudgetAccounts')),privateBytes=at.privateResultCanonical,writes=f.db.writes;
 expect(await attach(f,a,id)).toEqual({attached:false,resultWithheld:true});expect(JSON.stringify(f.db.table('runtimeBudgetAccounts'))).toBe(accounts);expect(at.privateResultCanonical).toBe(privateBytes);expect(f.db.writes-writes).toBe(marker==='pending'?1:0);
 await denied(f,()=>f.admit(b));const dw=f.db.writes;expect(await f.invoke('settle',{reference:f.reference,attemptId:a.attemptId,receiptCanonical:at.receiptCanonical})).toMatchObject({resultWithheld:true});expect(f.db.writes).toBe(dw);
});
