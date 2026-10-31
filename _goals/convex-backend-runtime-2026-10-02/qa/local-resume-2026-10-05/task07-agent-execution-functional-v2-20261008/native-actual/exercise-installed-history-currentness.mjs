/** After the real live turn: invalidate its recalled source, then hydrate a later
 * native claimed turn without starting a Workflow or dispatching a model. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openOwnedContext,q,denied} from './common-installed.mjs';
const context=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:context.memorySpaceId};
try{
  await context.verifyTarget('installed-history-currentness-target-verified');
  const remembered=JSON.parse(await readFile(join(q,'installed-live-remember.json'),'utf8')).result;
  const prior=JSON.parse(await readFile(join(q,'installed-live-submit.json'),'utf8')).result;
  const definition=JSON.parse(await readFile(join(q,'installed-live-definition.json'),'utf8')).result;
  const priorState=await context.admin.query('agentQualification:state',{tenantId:context.tenantId,...scope,runId:prior.runId});
  assert.equal(priorState.run.responseStatus,'complete');assert.ok(priorState.executions.some(row=>row.sourceWitnesses.some(witness=>witness.sourceId===remembered.sourceId)));
  await context.admin.mutation('runtimeAuth:tombstoneResource',{tenantId:context.tenantId,...scope,resourceType:'source',resourceId:remembered.sourceId});
  const later=await context.owner.mutation('runs:submit',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,
    conversationId:prior.conversationId,clientRequestId:'task07-later-'+operation,parts:[{type:'text',text:'Continue the same conversation.'}]}});
  const reference=await context.owner.query('agentQualification:reference',scope);
  let phase='claim';const error=await denied(async()=>{
    const attempt=await context.admin.mutation('agentQualification:armSaveGap',{reference,runId:later.runId});
    phase='private-hydrate';await context.admin.query('runtimeAgent:hydrateExecution',attempt);
  });
  // The existing source repository retains its typed FORBIDDEN tombstone fence;
  // the higher-level historical witness fence reports STALE_CONTEXT.
  assert.ok(['STALE_CONTEXT','FORBIDDEN'].includes(error.data?.code));
  const after=await context.admin.query('agentQualification:state',{tenantId:context.tenantId,...scope,runId:later.runId});
  assert.equal(after.modelAttempts.length,0);assert.equal(after.operations.length,0);assert.equal(after.ingestion.length,0);
  const priorAfter=await context.admin.query('agentQualification:state',{tenantId:context.tenantId,...scope,runId:prior.runId});
  assert.equal(priorAfter.modelAttempts.length,priorState.modelAttempts.length);
  await context.owner.mutation('runtimeAgent:cancel',{...scope,runId:later.runId});
  await context.publish('installed-history-currentness-outcome',{operation,status:'PASS',sourceId:remembered.sourceId,priorRunId:prior.runId,laterRunId:later.runId,
    staleHistoryDeniedAt:phase,error:context.publicError(error),after,noSubsequentPaidAttempt:true,completedPriorPaidAttemptCount:priorState.modelAttempts.length,
    originalCompletedTurnPreserved:true,usesActualCachedToolPayload:true});
}finally{await context.close();}
