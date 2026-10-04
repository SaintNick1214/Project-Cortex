/** No standalone live entry. Parent supplies freshly reviewed native adapter. */
import assert from 'node:assert/strict';
import { captureArgs,equalRace,conflictRace,duplicate,denied,capturedUnknown,refined,moneyDelta,unchanged } from './assertions.mjs';
export async function refinementCases(native,kind){
 // These adapter methods are contract obligations, not mocked handler substitutes.
 assert.equal(native.status,'POST_PRODUCT_REFRESH_FROZEN_REVIEWED');
 assert.equal(native.parentOwned,true);
 assert.equal(native.newVerifiedDisposableTarget,true);
 const setup=await native.seedAdmitCheckpoint();
 const initial=await native.chargeReceipt(setup,{costSource:'unavailable'});
 const snapshot=()=>native.wholeDatabaseSnapshot();
 const capture=args=>native.internalMutation('runtimeModelPolicy:captureTerminalEvidence',args);
 const args=receipt=>captureArgs(setup.attemptId,setup.dispatchIdentity,receipt);
 const initialResult=await capture(args(initial));
 const pre=await native.boundState(setup);capturedUnknown(pre.attempt);
 assert.equal(initialResult.state,'uncertain');assert.equal(pre.operation.uncertainUnits,100);
 for(const row of pre.originalAccounts){assert.equal(row.uncertainUnits,100);assert.equal(row.activeConcurrency,0);}
 const final=await native.chargeReceipt(setup,{costSource:'gateway-aggregate-usd-v1',aggregateCostUsd:'0.000150'});
 const transition=async cost=>{const post=await native.boundState(setup);refined(pre.attempt,post.attempt,cost);assert.equal(post.operation.uncertainUnits,pre.operation.uncertainUnits-100);assert.equal(post.operation.settledUnits,pre.operation.settledUnits+cost);assert.equal(post.operation.overrun,true);assert.equal(post.originalAccounts.length,pre.originalAccounts.length);for(const row of pre.originalAccounts)moneyDelta(row,post.originalAccounts.find(x=>x._id===row._id),cost);};
 if(kind==='initial-duplicates')await duplicate(snapshot,()=>capture(args(initial)),initialResult.evidenceId);
 if(kind==='revoked-live-origin'){await native.revokeOnlyOriginGrant(setup);await native.assertLiveScopeNoTombstones(setup);await native.assertNoAdminInvocation();}
 if(kind==='parent-refinement-rollback'){await denied(snapshot,()=>native.internalMutation('qualificationCapture:parentRefinementRollback',{run:native.runId,...args(final)}),'QA_ROLLBACK');return;}
 let result;
 if(kind==='equal-refinements'){let cost;result=await equalRace(capture,snapshot,args(final),(_before,_after,c)=>{cost=c;});await transition(cost);}
 else if(kind==='conflicting-refinements'){let cost;const other=await native.chargeReceipt(setup,{costSource:'gateway-aggregate-usd-v1',aggregateCostUsd:'0.000151'});result=await conflictRace(capture,snapshot,args(final),args(other),(_before,_after,c)=>{cost=c;});await transition(cost);}
 else {result=await capture(args(final));await transition(150);}
 assert.equal(result.evidenceId,initialResult.evidenceId);
 if(kind==='initial-duplicates')await duplicate(snapshot,()=>capture(args(initial)),initialResult.evidenceId,150);
 if(kind==='final-lost-response'){result=undefined;await duplicate(snapshot,()=>capture(args(final)),initialResult.evidenceId,150);}
 await native.assertPeerDispatchCountsUnchanged();
}
export async function persistenceRetryOnly(native,args){const before=await native.peerCounts();await native.internalMutation('runtimeModelPolicy:captureTerminalEvidence',args);await native.internalMutation('runtimeModelPolicy:captureTerminalEvidence',args);unchanged(before,await native.peerCounts());}
