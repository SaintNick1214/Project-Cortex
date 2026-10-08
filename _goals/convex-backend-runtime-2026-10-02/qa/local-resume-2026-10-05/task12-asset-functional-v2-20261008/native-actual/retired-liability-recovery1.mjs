/** One existing native recovery call per original expired attempt; no fabricated terminal. */
import assert from 'node:assert/strict';
import {openOwnedContext,denied} from './common.mjs';
const c=await openOwnedContext({requestTimeoutMs:15000}),groups=[];
try {
 await c.verifyTarget('retired-liability-recovery1-target-verified');
 for(const tenantId of [c.tenantId,c.tenantId+'-sync']) {
  const before=await c.admin.query('mediaProbe:ledger',{tenantId});
  assert.equal(before.attempts.length,1);
  const attempt=before.attempts[0],operation=before.operations.find(row=>row.operationId===attempt.operationId);
  assert.ok(operation);assert.equal(attempt.state,'uncertain');assert.equal(attempt.slotReleased,false);
  const deadline=attempt.checkpointAt+operation.snapshot.limits.timeoutMs;
  assert.ok(Date.now()>deadline,'Original admitted timeout must actually have elapsed');
  const observedAt=Date.now();
  const error=await denied(()=>c.admin.mutation('runtimeModelPolicy:recover',{reference:operation.reference,attemptId:attempt.attemptId}));
  assert.match(JSON.stringify(c.publicError(error)),/FORBIDDEN|UNAUTHENTICATED/);
  const after=await c.admin.query('mediaProbe:ledger',{tenantId});
  assert.deepEqual(after.accounts,before.accounts);
  assert.deepEqual(after.attempts,before.attempts);
  assert.deepEqual(after.operations,before.operations);
  assert.deepEqual(after.probes,before.probes);
  await c.publish('retired-liability-recovery1-'+(tenantId.endsWith('-sync')?'sync':'async'),{tenantId,before,after,recovery:{attemptId:attempt.attemptId,receiptSupplied:false,originalCheckpointAt:attempt.checkpointAt,admittedTimeoutMs:operation.snapshot.limits.timeoutMs,deadline,observedAt,actuallyExpired:true,error:c.publicError(error)},modelCalls:0,scopeRestored:false,financialIdentityAndCountersUnchanged:true});
  groups.push({tenantId,attemptId:attempt.attemptId,actuallyExpired:true,code:error.data?.code??'DENIED',activeConcurrency:after.accounts.find(row=>row.kind==='tenant').activeConcurrency,uncertainUnits:after.accounts.find(row=>row.kind==='tenant').uncertainUnits,slotReleased:after.attempts[0].slotReleased});
 }
 await c.publish('retired-liability-recovery1-outcomes',{status:'ACTUAL_EXISTING_RECOVERY_UNREACHABLE_AFTER_SCOPE_RETIREMENT',groups,modelCalls:0,scopeRestored:false,noInventedTerminal:true,heldFinancialSlots:2,mediaLiabilityUnits:4000000,priorTask10LiabilityUnits:500000,totalRetainedUnits:4500000,currentSourceBehavior:'recover requires current admin authority; absent a genuine receipt, a checkpointed uncertain attempt is writeUnknown without slot release. No deadline branch exists.',supportedLaterRecovery:'Deployment-only reconcileDeploymentLiability accepts genuine terminal receiptCanonical for immutable original operation/window; Task13 must extend typed media terminal/accounting or add a reviewed cleanup-only deadline fence before these slots can be reclaimed.'});
 console.log(JSON.stringify({status:'EXISTING_RECOVERY_DENIED_NO_FINANCIAL_CHANGE',attempts:groups.length,modelCalls:0}));
}catch(error){await c.publish('retired-liability-recovery1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:c.publicError(error),modelCalls:0,noBlindRepeat:true});throw error;}finally{await c.close();}
