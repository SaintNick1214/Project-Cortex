/** Focused actual stale/cancel/authority cases. Run revoke last, before retirement. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openOwnedContext,waitUntil,denied} from './common.mjs';
const scenario=process.argv[2];assert.ok(['edit','tombstone','cancel','revoke'].includes(scenario));
const context=await openOwnedContext();const operation=randomUUID(),scoped={memorySpaceId:context.memorySpaceId};
const prefix='lifecycle-'+scenario;const records=[];
const snapshot=runId=>context.admin.query('agentQualification:state',{tenantId:context.tenantId,...scoped,runId});
async function call(label,kind,name,args,client=context.owner){const start=Date.now();try{const result=await client[kind](name,args);records.push({label,kind,function:name,status:'PASS',result,elapsedMs:Date.now()-start});return result;}
  catch(e){records.push({label,kind,function:name,status:'FAIL',error:context.publicError(e),elapsedMs:Date.now()-start});throw e;}
  finally{await context.publish(prefix+'-calls',{operation,records});}}
try{
  await context.verifyTarget(prefix+'-target-verified');
  const registryHash=await context.admin.query('agentQualification:registryHash',{});
  const definition=await call('definition','mutation','agentDefinitions:publishVersion',{...scoped,clientMutationId:operation,expectedPreviousVersion:0,
    definitionInput:{instructions:{text:'Use memory_recall exactly once with text jasmine tea and limit 1, then answer with the recalled tea preference.',promptVersion:'task07-functional-probe-v1'},
      tools:[{toolId:'memory.recall',toolVersion:1,registryHash,requiredCapability:'tool',approval:'explicit'}],
      context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash,memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:4096},
      policies:[{policyId:'task07-lifecycle-probe',version:1,operationKey:'agent.respond',rules:{limits:{outputTokens:256,toolSteps:1}}}]}});
  const conversation=await call('conversation','mutation','runtimeTranscript:create',{...scoped,clientRequestId:operation});
  if(['edit','tombstone'].includes(scenario))await call('unlock-before-cutoff','mutation','runtimeTranscript:setPolicy',{...scoped,conversationId:conversation.conversationId,expectedRevision:conversation.historyRevision,manualWriteLocked:false});
  const run=await call('submit','mutation','runs:submit',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,conversationId:conversation.conversationId,
    clientRequestId:'task07-'+operation,parts:[{type:'text',text:'Use the memory_recall tool to recall my jasmine tea preference.'}]}});
  const args={...scoped,runId:run.runId};await call('start','mutation','runtimeAgent:start',{...args,streaming:true});
  const waiting=await waitUntil('explicit tool approval',()=>context.owner.query('runtimeAgent:observe',args),v=>v.state==='waiting_approval'&&v.approvals.length===1,{timeoutMs:180_000});
  const before=await snapshot(run.runId);assert.equal(before.operations.filter(row=>row.kind==='tool'&&row.state==='waiting_approval').length,1);
  const approval={...args,operationId:waiting.approvals[0].operationId,expectedRequestHash:waiting.approvals[0].requestHash};
  if(scenario==='cancel'){
    await call('cancel','mutation','runtimeAgent:cancel',args);
    await denied(()=>context.owner.mutation('runtimeAgent:approveTool',approval));
    const observed=await context.owner.query('runtimeAgent:observe',args);assert.equal(observed.state,'cancelled');
    assert.ok(observed.parts.some(row=>row.part.type==='status'&&row.part.state==='cancelled'));
  }else if(scenario==='revoke'){
    const reference=await context.owner.query('agentQualification:reference',scoped);
    await call('revoke','mutation','runtimeAuth:revokeGrant',{grantId:reference.grantId},context.admin);
    for(const name of ['runtimeAgent:observe','runtimeAgent:approveTool','runtimeAgent:reconcile'])await denied(()=>
      name==='runtimeAgent:observe'?context.owner.query(name,args):context.owner.mutation(name,name==='runtimeAgent:approveTool'?approval:args));
  }else{
    const selector={...scoped,conversationId:run.conversationId};const head=await context.owner.query('runtimeTranscript:get',selector);
    const page=await context.owner.query('runtimeTranscript:messages',{...selector,limit:100});const pin=page.page.find(message=>message.id===run.inputMessageIds[0]);assert.ok(pin);
    await call('revise-selected','mutation',scenario==='edit'?'runtimeTranscript:edit':'runtimeTranscript:removeMessage',{
      ...selector,expectedRevision:head.historyRevision,messageId:pin.id,expectedMessageRevision:pin.revision,
      ...(scenario==='edit'?{parts:[{type:'text',text:'The selected executable input was manually changed.'}]}:{})});
    await denied(()=>context.owner.mutation('runtimeAgent:approveTool',approval));await denied(()=>context.owner.mutation('runtimeAgent:reconcile',args));
    await call('cancel-stale-workflow','mutation','runtimeAgent:cancel',args);
  }
  // Waiting workflow has no outstanding model request: a denied continuation must
  // leave both paid attempts and durable tool-effect registrations unchanged.
  await new Promise(resolve=>setTimeout(resolve,1000));const after=await snapshot(run.runId);
  assert.equal(after.modelAttempts.length,before.modelAttempts.length);assert.equal(after.ingestion.length,0);
  assert.equal(after.operations.filter(row=>row.kind==='tool'&&row.state==='complete').length,0);
  await context.publish(prefix+'-outcome',{operation,status:'PASS',scenario,before,after,currentGuardDenied:true,noSubsequentPaidAttempt:true,
    noToolEffectCommitted:true,originalBoundaries:'current authority/source/revision/tombstone checked by backend; no client model/tool loop'});
}finally{await context.close();await context.publish(prefix+'-client-cleanup',{ownedClientsClosed:true});}
