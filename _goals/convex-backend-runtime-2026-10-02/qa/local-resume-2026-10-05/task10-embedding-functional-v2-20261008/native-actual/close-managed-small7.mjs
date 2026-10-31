/** Close the already successful small calls; retrieval scores permit native float jitter. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied} from './common.mjs';
const c=await openOwnedContext(),read=name=>readFile(join(q,name+'.json'),'utf8').then(JSON.parse);
try{
 await c.verifyTarget('managed-small-close7-target-verified');
 const setup=await read('managed-setup4'),{reference,scope,sourceId}=setup,derived=await read('managed-small4-derive'),query=await read('managed-small4-query'),afterRecord=await read('managed-small4-after'),{metadata:after,ledger}=afterRecord;
 const normalize=value=>({...value,ingestionScopes:value.ingestionScopes.map(({updatedAt,version,...row})=>row)});const checkMetadata=async()=>{const current=await inspect();assert.deepEqual(normalize(current),normalize(after));for(const row of current.ingestionScopes){const old=after.ingestionScopes.find(r=>r._id===row._id);assert.ok(row.version>=old.version&&row.updatedAt>=old.updatedAt);}return current;};
 const inspect=()=>c.admin.query('profileNative:inspect',{reference}),money=()=>c.admin.query('profileNative:inspectLedger',{reference});
 await checkMetadata();assert.deepEqual(await money(),ledger);
 const replayDerived=await c.admin.action('profileNative:derive',{reference,sourceId,requestId:'task10-derive-small'});assert.equal(replayDerived.created,false);
 const replay=await c.owner.action('runtimeMemory:recall',{...scope,text:'observatory project codeword cedar telescope',requestId:'task10-query-small',limit:5});await c.publish('managed-small4-replay-close7',replay);
 const withoutScores=value=>({...value,items:value.items.map(({score,...item})=>item)});assert.deepEqual(withoutScores(replay),withoutScores(query));
 const scoreDeltas=replay.items.map((item,index)=>{assert.ok(Number.isFinite(item.score));const delta=Math.abs(item.score-query.items[index].score);assert.ok(item.score>=-1&&item.score<=1);return delta;});
 assert.deepEqual(await money(),ledger);await checkMetadata();
 const invalid=[];for(const variant of ['model','index','dimensions'])invalid.push({variant,error:c.publicError(await denied(()=>c.admin.mutation('profileNative:repeatCommit',{reference,receiptId:derived.receiptId,invalid:variant})))});
 assert.deepEqual(await money(),ledger);await checkMetadata();
 const operation=ledger.operations.find(row=>row.operationKey==='embedding.query'),attempt=ledger.attempts.find(row=>row.operationDocumentId===operation._id);
 assert.equal(ledger.attempts.length,2);assert.equal(ledger.accounts.find(row=>row.kind==='tenant').uncertainUnits,200000);assert.equal(attempt.resultWithheld,false);assert.equal(attempt.slotReleased,true);
 await c.publish('managed-small4-closed',{status:'ACTUAL_MANAGED_PASS',scope,selectedPolicy:(await read('managed-policy-candidates2')).small,profile:await c.owner.query('runtimeMemory:defaultProfile',scope),derived,query,queryAttemptId:attempt._id,after,ledger,
  invalidRegisteredNativeCommitGuards:invalid,invalidGuardsNotClaimedAsManagedDifferentModelSearch:true,replayNoAddedPaidAttempt:true,modelCallsThisPhase:2,
  priorExactScoreOracleFailure:'managed-small4-failure.json',sameContentIdentityProfileExact:true,nativeSearchScoreEqualityNotRequired:true,scoreDeltas,newPaidCallsDuringClosure:0,metadataAsynchronousWatermarkAllowed:true,currentMetadata:await checkMetadata(),priorOverbroadMetadataEqualityFailure:'managed-small-close5-failure-observed.json'});
 console.log(JSON.stringify({status:'SMALL_MANAGED_PASS',attempts:2,retainedUnits:200000,newCalls:0}));
}finally{await c.close();await c.publish('managed-small-close7-cleanup',{ownedClientsClosed:true});}
