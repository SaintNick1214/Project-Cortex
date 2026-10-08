import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openOwnedContext,observeRun,waitUntil,denied} from './common.mjs';

const stage=process.argv[2];assert.ok(['live','save-gap'].includes(stage));
const context=await openOwnedContext();const operation=randomUUID();const outcomes=[];const observers=[];
async function call(label,kind,name,args,client=context.owner){const start=Date.now();try{const result=await client[kind](name,args);
  await context.publish(label,{function:name,kind,args,result,elapsedMs:Date.now()-start,status:'PASS'});return result;
}catch(error){await context.publish(label,{function:name,kind,args,error:context.publicError(error),elapsedMs:Date.now()-start,status:'FAIL'});throw error;}}
async function check(name,action){try{const evidence=await action();outcomes.push({name,status:'PASS',evidence});}
  catch(error){outcomes.push({name,status:'FAIL',error:context.publicError(error)});throw error;}
  finally{await context.publish(stage+'-outcomes',{operation,projectId:context.state.projectId,sourceCandidate:'deployment-source-manifest.json',outcomes});}}
const scoped={memorySpaceId:context.memorySpaceId};
async function state(runId){return await context.admin.query('agentQualification:state',{tenantId:context.tenantId,...scoped,runId});}
async function definition(instructions,tools=[]){const registryHash=await context.admin.query('agentQualification:registryHash',{});
  return await call(stage+'-definition','mutation','agentDefinitions:publishVersion',{...scoped,clientMutationId:operation,expectedPreviousVersion:0,
    definitionInput:{instructions:{text:instructions,promptVersion:'task07-functional-probe-v1'},tools:tools.map(toolId=>({toolId,toolVersion:1,registryHash,requiredCapability:'tool',approval:'explicit'})),
      context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash,memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:4096},
      policies:[{policyId:'task07-bounded-probe',version:1,operationKey:'agent.respond',rules:{limits:{outputTokens:256,toolSteps:tools.length?1:0}}}]}});}
async function submit(def,text){return await call(stage+'-submit','mutation','runs:submit',{request:{version:1,agentId:def.agentId,agentVersion:def.version,
  clientRequestId:'task07-'+operation,parts:[{type:'text',text}]}});}
try{
  await context.verifyTarget(stage+'-target-verified');
  if(stage==='live'){
    await call('live-remember','action','runtimeMemory:remember',{...scoped,requestId:'task07-seed-'+operation,text:'The user prefers jasmine tea.'});
    const def=await definition('Invoke memory_recall exactly once with text jasmine tea and limit 1, then answer CORTEX_AGENT_TOOL_STREAM_OK and state the recalled tea preference. Do not repeat a tool invocation after its result.',['memory.recall']);
    const run=await submit(def,'Recall my tea preference with the memory_recall tool, then respond.');const args={...scoped,runId:run.runId};
    const first=observeRun(context,'cortex-owner',run.runId,{label:'observer-a'});const second=observeRun(context,'cortex-owner',run.runId,{label:'observer-b'});
    const finalOnly=observeRun(context,'cortex-owner',run.runId,{label:'observer-final',finalOnly:true});observers.push(first,second,finalOnly);
    await call('live-start','mutation','runtimeAgent:start',{...args,streaming:true});
    const waiting=await waitUntil('explicit backend tool approval',async()=>second.latest,v=>v?.state==='waiting_approval'&&v.approvals.length===1,{timeoutMs:180_000});
    assert.equal(waiting.approvals[0].toolName,'memory_recall');
    await check('authenticated observers see the same durable tool approval and final-only withholds unfinished output',async()=>{
      await waitUntil('first observer checkpoint',async()=>first.latest,v=>v?.state==='waiting_approval',{timeoutMs:15_000});
      await waitUntil('final-only approval checkpoint',async()=>finalOnly.latest,v=>v?.state==='waiting_approval',{timeoutMs:15_000});
      assert.deepEqual(first.latest.parts,waiting.parts);assert.deepEqual(finalOnly.latest.parts,[]);
      for(const probe of [context.anonymous,context.foreign])await denied(()=>probe.query('runtimeAgent:observe',args));
      return {parts:waiting.parts.length,approval:waiting.approvals[0],publicObservers:2,finalOnlyWithheld:true,noAuthAndForeignDenied:true};});
    const savedCursor=first.latest.cursor;await first.disconnect();
    const resumed=observeRun(context,'cortex-owner',run.runId,{afterSequence:savedCursor,label:'observer-reconnected'});observers.push(resumed);
    await waitUntil('reconnect is authenticated and catches saved state',async()=>resumed.latest,v=>v?.state==='waiting_approval',{timeoutMs:15_000});
    await call('live-approve','mutation','runtimeAgent:approveTool',{...args,operationId:waiting.approvals[0].operationId,expectedRequestHash:waiting.approvals[0].requestHash});
    const finished=await resumed.terminal(180_000);assert.equal(finished.state,'complete');await second.terminal(15_000);await finalOnly.terminal(15_000);
    const all=await call('live-output','query','runtimeAgent:observe',{...args,limit:100});
    await check('server tool completes one canonical turn; reconnect and second observer converge on saved final output',async()=>{
      const records=await state(run.runId);const text=all.parts.filter(row=>row.part.type==='text-delta').map(row=>row.part.text??row.part.delta??'').join('');
      assert.match(text,/CORTEX_AGENT_TOOL_STREAM_OK/);assert.match(text,/jasmine/i);assert.equal(records.ingestion.length,1);
      assert.equal(records.run.responseStatus,'complete');assert.equal(records.outbox[0].state,'complete');
      assert.equal(records.operations.filter(op=>op.kind==='tool'&&op.state==='complete').length,1);
      assert.ok(records.modelOperations.every(op=>op.runBudgetId===records.run.runBudgetId));
      assert.ok(resumed.events.flatMap(event=>event.parts).every(row=>row.sequence>savedCursor));
      const secondParts=[...second.parts.values()].sort((a,b)=>a.sequence-b.sequence);assert.deepEqual(secondParts,all.parts);
      const finalParts=[...finalOnly.parts.values()].sort((a,b)=>a.sequence-b.sequence);
      const finalOutput=await context.owner.query('runtimeAgent:observe',{...args,limit:100,finalOnly:true});assert.deepEqual(finalParts,finalOutput.parts);
      assert.ok(finalParts.length);assert.ok(finalParts.every(row=>row.part.type==='text'||row.part.type==='status'&&row.part.state==='complete'));
      assert.match(finalParts.filter(row=>row.part.type==='text').map(row=>row.part.text).join(''),/CORTEX_AGENT_TOOL_STREAM_OK/);
      const publicJson=JSON.stringify(all);assert.ok(!/contextCanonical|sourceWitnesses|requestCanonical|reasoning-delta|privateResultCanonical|api[_-]?key|authorization/i.test(publicJson));
      await context.publish('live-native-state',records);await context.publish('live-observer-events',{first:first.events,second:second.events,resumed:resumed.events,finalOnly:finalOnly.events});
      return {ingestionReceiptId:records.ingestion[0].receiptId,outputMessageIds:records.run.outputMessageIds,modelAttemptCount:records.modelAttempts.length,
        toolsExecuted:1,sharedRunBudget:true,reconnectCursor:savedCursor,finalOnlyConverged:true,publicProjectionRedacted:true};});
    const before=await state(run.runId);const replay=await call('live-reconcile-repeat','mutation','runtimeAgent:reconcile',args);const after=await state(run.runId);
    assert.equal(replay.receiptId,before.ingestion[0].receiptId);assert.equal(after.modelAttempts.length,before.modelAttempts.length);assert.deepEqual(after.ingestion,before.ingestion);
  }else{
    const def=await definition('Answer exactly CORTEX_AGENT_SAVE_GAP_OK.');const run=await submit(def,'Please respond with the fixed save-gap confirmation.');const args={...scoped,runId:run.runId};
    const reference=await context.owner.query('agentQualification:reference',scoped);
    const attempt=await call('gap-arm','mutation','agentQualification:armSaveGap',{reference,runId:run.runId},context.admin);
    await call('gap-context','action','agentQualification:prepareSaveGap',attempt,context.admin);
    const gap=await call('gap-paid-save','action','agentQualification:modelSaveGap',{...attempt,ordinal:0},context.admin);assert.equal(gap.intercepted,true);
    const saved=await state(run.runId);assert.equal(saved.ingestion.length,0);assert.equal(saved.operations.filter(op=>op.kind==='model'&&op.state==='started').length,1);
    assert.ok(saved.native.some(row=>row.role==='assistant'&&row.status==='success'));assert.ok(saved.modelAttempts.some(row=>row.dispatchIdentity));
    await call('gap-interrupted','mutation','runtimeAgent:endInterrupted',{...attempt,cancelled:false},context.admin);
    const before=await state(run.runId);assert.equal(before.executions[0].state,'unknown');
    const repeatError=await denied(()=>context.admin.action('agentQualification:modelSaveGap',{...attempt,ordinal:0}));
    await context.publish('gap-repeat-model-denied',{error:context.publicError(repeatError),beforeAttempts:before.modelAttempts.length,
      afterAttempts:(await state(run.runId)).modelAttempts.length});assert.equal((await state(run.runId)).modelAttempts.length,before.modelAttempts.length);
    const first=await call('gap-reconcile','mutation','runtimeAgent:reconcile',args);const after=await state(run.runId);
    const again=await call('gap-reconcile-repeat','mutation','runtimeAgent:reconcile',args);const final=await state(run.runId);
    await check('actual paid Agent save gap is recovered once with no inference replay',async()=>{
      assert.equal(after.ingestion.length,1);assert.equal(final.ingestion.length,1);assert.equal(first.receiptId,again.receiptId);
      assert.equal(after.run.responseStatus,'complete');assert.equal(final.modelAttempts.length,before.modelAttempts.length);
      assert.deepEqual(final.run.outputMessageIds,after.run.outputMessageIds);assert.equal(new Set(final.bridges.map(row=>row.nativeMessageId)).size,final.bridges.length);
      await context.publish('gap-native-state',{saved,before,after,final});return {ingestionReceiptId:first.receiptId,modelAttempts:before.modelAttempts.length,
        outputMessageIds:final.run.outputMessageIds,oneTranscriptRegistration:true,noInferenceReplay:true};});
  }
}finally{
  const errors=[];for(const observer of observers)try{await observer.disconnect();}catch(error){errors.push(context.publicError(error));}
  try{await context.close();}catch(error){errors.push(context.publicError(error));}
  await context.publish(stage+'-client-cleanup',{ownedReactiveClients:observers.length,closedAll:true,errors});if(errors.length)throw new AggregateError(errors,'Owned clients failed cleanup');
}
