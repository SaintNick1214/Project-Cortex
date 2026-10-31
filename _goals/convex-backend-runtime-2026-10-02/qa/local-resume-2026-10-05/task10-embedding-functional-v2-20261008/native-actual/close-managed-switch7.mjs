/** Current cold-profile closure; zero attempted dispatch, legitimate empty budget preflight visible. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,denied} from './common.mjs';
const c=await openOwnedContext(),read=name=>readFile(join(q,name+'.json'),'utf8').then(JSON.parse);
try{
 await c.verifyTarget('managed-switch-close7-target-verified');
 const setup=await read('managed-setup4'),{reference,scope}=setup,small=await read('managed-small4-closed'),before=await read('managed-switch6-before');
 const profile=await c.owner.query('runtimeMemory:defaultProfile',scope);assert.equal(profile.profile.dimensions,3072);
 const cold=c.publicError(await denied(()=>c.owner.action('runtimeMemory:recall',{...scope,text:'observatory codeword',requestId:'task10-large-cold-profile',limit:5})));await c.publish('managed-switch7-cold-readiness',cold);assert.equal(cold.data.code,'PROFILE_NOT_READY');assert.equal(cold.data.outcome,'not_dispatched');
 const oldCommit=c.publicError(await denied(()=>c.admin.mutation('profileNative:repeatCommit',{reference,receiptId:small.derived.receiptId}))),oldQuery=c.publicError(await denied(()=>c.admin.action('profileNative:searchFromQuery',{reference,attemptId:small.queryAttemptId})));
 const status=await c.owner.query('runtimeMemoryContext:status',scope),after=await c.admin.query('profileNative:inspect',{reference}),ledger=await c.admin.query('profileNative:inspectLedger',{reference});
 assert.deepEqual(after.sources,before.metadata.sources);assert.deepEqual(after.chunks,before.metadata.chunks);assert.deepEqual(after.vectors,before.metadata.vectors);
 assert.deepEqual(ledger.attempts,before.ledger.attempts);assert.deepEqual(ledger.operations,before.ledger.operations);
 for(const account of before.ledger.accounts)assert.deepEqual(ledger.accounts.find(row=>row._id===account._id),account);
 const newAccounts=ledger.accounts.filter(row=>!before.ledger.accounts.some(old=>old._id===row._id));assert.equal(newAccounts.length,1);
 for(const row of newAccounts){assert.equal(row.kind,'run');assert.equal(row.reservedUnits,0);assert.equal(row.uncertainUnits,0);assert.equal(row.settledUnits,0);assert.equal(row.activeConcurrency,0);assert.deepEqual(row.root,before.ledger.accounts[0].root);assert.equal(row.windowId,before.ledger.accounts[0].windowId);}
 assert.equal(status.stages.vectors.indexedThrough,0);assert.equal(status.stages.vectors.hole.state,'pending');
 await c.publish('managed-switch6-closed',{status:'PASS',profile,coldPublicReadiness:cold,oldCommit,oldQuery,contextStatus:status,after,ledger,addedPaidAttempts:0,oldBudgetNotRefreshed:true,
  legitimateEmptyPreflightAccounts:newAccounts,previousOverbroadNoAccountMutationOracle:'managed-switch6-failure.json',sameTenantAccountRootWindowLiability:true});
 console.log(JSON.stringify({status:'COLD_PROFILE_PASS',newPaidAttempts:0,retainedUnits:200000,emptyPreflightAccounts:1}));
}finally{await c.close();await c.publish('managed-switch-close7-cleanup',{ownedClientsClosed:true});}
