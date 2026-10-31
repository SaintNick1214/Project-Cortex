/** Close the already successful exact call. No new request or paid replay. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,authorityReference} from './common.mjs';
const c=await openOwnedContext(),read=name=>readFile(join(q,name+'.json'),'utf8').then(JSON.parse);
try{
 await c.verifyTarget('large-commission2-target-verified');
 const call=await read('large-commission-call1'),after=await read('large-commission1-after'),before=await read('large-commission1-before');
 const reference=authorityReference((await read('baseline-functional-auth-outcomes')).owner),state=()=>c.admin.query('profileQualification:state',{reference});
 assert.equal(call.error,null);assert.equal(call.completionError,null);assert.equal(call.result.dimensions,3072);assert.equal(call.result.finite,true);
 assert.ok(call.result.norm>0.9&&call.result.norm<1.1);assert.equal(call.result.usage.tokens,24);assert.ok(call.result.usage.tokens<=call.result.inputUtf8Bytes);
 assert.equal(before.operations.length,0);assert.equal(after.operations.length,1);assert.equal(after.attempts.length,1);
 const attempt=after.attempts[0],operation=after.operations[0],terminal=call.events.find(row=>row.phase==='terminal').receipt;
 assert.equal(terminal.actualModel,'text-embedding-3-large');assert.equal(terminal.outcome,'confirmed');assert.equal(terminal.costSource,'unavailable');assert.equal(terminal.dispatchIdentity,attempt.dispatchIdentity);
 assert.equal(attempt.receipt,null);assert.equal(attempt.resultWithheld,false);assert.equal(attempt.slotReleased,true);assert.equal(attempt.state,'uncertain');assert.equal(operation.uncertainUnits,100000);
 assert.equal(operation.snapshot.modelId,'openai/text-embedding-3-large');assert.equal(operation.snapshot.semanticProfile.dimensions,3072);assert.equal(attempt.privateResultBytes,60746);
 assert.deepEqual(attempt.privateDimensions,[3072]);assert.ok(attempt.privateResultBytes<=131072);
 const admit=call.events.find(row=>row.phase==='admit'&&row.status==='reserved');assert.equal(admit.ledgerState.attempts[0].reservationUnits,100000);
 for(const kind of ['tenant','run']){assert.ok(admit.ledgerState.accounts.some(row=>row.kind===kind&&row.reservedUnits===100000&&row.activeConcurrency===1));
  const account=after.accounts.find(row=>row.kind===kind);assert.equal(account.uncertainUnits,100000);assert.equal(account.reservedUnits,0);assert.equal(account.activeConcurrency,0);}
 assert.deepEqual(await state(),after);
 const replay=await c.admin.action('profileQualification:exercise',{reference});await c.publish('large-commission-replay1',replay);
 assert.equal(replay.error,null);assert.equal(replay.completionError,null);assert.equal(replay.result.replay,true);assert.equal(replay.result.dimensions,3072);assert.equal(replay.result.vectorHash,call.result.vectorHash);
 assert.deepEqual(await state(),after);
 await c.publish('large-commission-observation-correction2',{priorFailure:'large-commission-failure1.json',scope:'QA_FIELD_OBSERVATION_ONLY',legacyReceiptCanonical:null,
  actualTerminalFrom:'large-commission-call1.json/events/phase:terminal/receipt',durableUnknownPath:'terminalEvidenceCanonical',sameDispatchIdentity:true,noNewPaidCall:true});
 await c.publish('large-commission-outcomes1',{status:'ACTUAL_NATIVE_PASS',projectId:c.state.projectId,modelId:operation.snapshot.modelId,profile:call.result.profile,
  dimensions:3072,actualWireModel:terminal.actualModel,usage:call.result.usage,inputUtf8Bytes:call.result.inputUtf8Bytes,vectorHash:call.result.vectorHash,
  reservationBeforeDispatch:true,finishedSlotReleased:true,terminalCost:'unavailable',fullRetainedLiabilityPerAccount:100000,replayNoAddedAttempt:true,
  internalReachabilityDenialsAlreadyPreserved:'large-commission1-before.json and original script preflight',oldQualificationsPreserved:4,shippedRegistryChanged:false,
  notIndependentAcceptance:true,terminalReceipt:terminal,privateResultBytes:60746,priorQAObserverFailurePreserved:true});
}catch(e){await c.publish('large-commission-close2-failure',{status:'FAIL_OR_UNKNOWN',error:c.publicError(e),noBlindPaidRetry:true});throw e;}
finally{await c.close();await c.publish('large-commission2-owned-cleanup',{clientsClosed:true});}
