/** One materially new native call. Never re-dispatch an unknown outcome. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied,authorityReference} from './common.mjs';
const c=await openOwnedContext(),started=Date.now(),observations=[];
try{
 await c.verifyTarget('large-commission1-target-verified');
 const ready=JSON.parse(await readFile(join(q,'commission-fixture-deployed1.json')));
 assert.equal(ready.projectId,c.state.projectId);assert.equal(ready.qualificationTrust,'private exact-object fixture-synthetic operator exception');
 assert.equal(ready.shippedRegistryChanged,false);assert.equal(ready.enabledDeploymentExit,0);
 const base=JSON.parse(await readFile(join(q,'baseline-functional-auth-outcomes.json'))),reference=authorityReference(base.owner);
 assert.equal(reference.tenantId,c.tenantId);assert.ok(reference.grantId);
 const state=()=>c.admin.query('profileQualification:state',{reference});
 const before=await state();await c.publish('large-commission1-before',before);
 assert.equal(before.operations.length,0);assert.equal(before.attempts.length,0);
 for(const client of [c.anonymous,c.owner])observations.push(c.publicError(await denied(()=>client.action('profileQualification:exercise',{reference}))));
 assert.deepEqual(await state(),before);
 let call;
 try{call=await c.admin.action('profileQualification:exercise',{reference});await c.publish('large-commission-call1',call);}
 catch(error){await c.publish('large-commission-call1',{status:'UNKNOWN_ACTION_ERROR',error:c.publicError(error),after:await state(),retryForbidden:true});throw error;}
 const after=await state();await c.publish('large-commission1-after',after);
 assert.equal(call.error,null);assert.equal(call.completionError,null);assert.equal(call.result.replay,false);
 assert.equal(call.result.dimensions,3072);assert.equal(call.result.finite,true);assert.ok(call.result.norm>0.9&&call.result.norm<1.1);
 assert.ok(Number.isSafeInteger(call.result.usage?.tokens));assert.ok(call.result.usage.tokens<=call.result.inputUtf8Bytes);
 assert.equal(after.operations.length,1);assert.equal(after.attempts.length,1);
 const attempt=after.attempts[0],operation=after.operations[0];
 assert.equal(attempt.slotReleased,true);assert.equal(attempt.resultWithheld,false);assert.equal(attempt.state,'uncertain');
 assert.equal(operation.uncertainUnits,100000);assert.equal(operation.snapshot.modelId,'openai/text-embedding-3-large');
 assert.equal(operation.snapshot.semanticProfile.dimensions,3072);assert.equal(attempt.receipt.actualModel,'text-embedding-3-large');
 assert.ok(attempt.privateResultBytes>0&&attempt.privateResultBytes<=131072);assert.deepEqual(attempt.privateDimensions,[3072]);
 const admit=call.events.find(event=>event.phase==='admit'&&event.status==='reserved');
 assert.ok(admit);assert.equal(admit.ledgerState.attempts[0].reservationUnits,100000);
 assert.ok(admit.ledgerState.accounts.some(account=>account.kind==='run'&&account.reservedUnits===100000&&account.activeConcurrency===1));
 for(const kind of ['tenant','run']){const account=after.accounts.find(row=>row.kind===kind);assert.ok(account);assert.equal(account.uncertainUnits,100000);assert.equal(account.reservedUnits,0);assert.equal(account.activeConcurrency,0);}
 const replay=await c.admin.action('profileQualification:exercise',{reference});await c.publish('large-commission-replay1',replay);
 assert.equal(replay.error,null);assert.equal(replay.result.replay,true);assert.equal(replay.result.dimensions,3072);assert.equal(replay.result.vectorHash,call.result.vectorHash);
 const final=await state();assert.deepEqual(final,after);
 await c.publish('large-commission-outcomes1',{status:'ACTUAL_NATIVE_PASS',projectId:c.state.projectId,modelId:operation.snapshot.modelId,profile:call.result.profile,
  dimensions:3072,actualWireModel:attempt.receipt.actualModel,usage:call.result.usage,inputUtf8Bytes:call.result.inputUtf8Bytes,vectorHash:call.result.vectorHash,
  reservationBeforeDispatch:true,finishedSlotReleased:true,terminalCost:'unavailable',fullRetainedLiabilityPerAccount:100000,replayNoAddedAttempt:true,
  internalReachabilityDenials:observations,oldQualificationsPreserved:4,shippedRegistryChanged:false,notIndependentAcceptance:true,elapsedMs:Date.now()-started});
}catch(error){await c.publish('large-commission-failure1',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),elapsedMs:Date.now()-started,noBlindPaidRetry:true});throw error;}
finally{await c.close();await c.publish('large-commission1-owned-cleanup',{clientsClosed:true,elapsedMs:Date.now()-started});}
