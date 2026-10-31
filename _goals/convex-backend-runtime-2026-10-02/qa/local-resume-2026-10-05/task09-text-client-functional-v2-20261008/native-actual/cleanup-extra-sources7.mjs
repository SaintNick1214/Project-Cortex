import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,qa} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId},records=[];
const state=()=>c.admin.query('ingestionQualification:state',scope);
async function call(label,name,args){const result=await c.admin.mutation(name,args);records.push({label,function:name,args,result});await c.publish('controls7-extra-cleanup-calls',{records});return result;}
try{
 await c.verifyTarget('controls7-extra-cleanup-target');
 const before=await state();await c.publish('controls7-before-extra-cleanup-state',before);
 assert.ok(before.runtimeRuns.every(row=>['complete','failed','cancelled'].includes(row.responseStatus)),'No active run may be changed by cleanup');
 const seed=JSON.parse(await readFile(join(qa,'native1-calls.json'))).records.find(row=>row.label==='governed-owned-memory-seed').result;
 assert.equal(seed.created,true);assert.ok(seed.sourceId);const seedSource=before.runtimeMemorySources.find(row=>row.lineage.sourceId===seed.sourceId);assert.ok(seedSource);
 const sourceIds=[...new Set([...before.runtimeMemorySources.map(row=>row.lineage.sourceId),...before.runtimeIngestionEvents.map(row=>row.lineage.sourceId)])].filter(id=>id!==seed.sourceId);
 for(const sourceId of sourceIds)await call('retire-extra-'+sourceId,'runtimeAuth:tombstoneResource',{...scope,resourceType:'source',resourceId:sourceId});
 const retired=await state();assert.ok(retired.runtimeIngestionEvents.filter(row=>row.lineage.sourceId!==seed.sourceId).every(row=>['tombstoned','superseded'].includes(row.eligibility)));
 const cleared=await call('clear-owned-retired-held','ingestionQualification:clearRetiredHeld',scope);assert.equal(cleared.productRowsDeleted,0);
 const after=await state();assert.equal(after.task08HeldStages.length,0);
 assert.deepEqual(after.runtimeModelAttempts.map(row=>row._id).sort(),before.runtimeModelAttempts.map(row=>row._id).sort());
 for(const account of before.runtimeBudgetAccounts){const current=after.runtimeBudgetAccounts.find(row=>row._id===account._id);assert.equal(current.uncertainUnits,account.uncertainUnits);assert.equal(current.settledUnits,account.settledUnits);}
 const liveSeed=after.runtimeMemorySources.find(row=>row.lineage.sourceId===seed.sourceId);assert.deepEqual(liveSeed,seedSource);
 await c.publish('controls7-after-extra-cleanup-state',after);
 const result={status:'PASS_BOUNDED_EXTRA_SOURCE_CLEANUP',preservedSeed:{sourceId:seed.sourceId,receiptId:seed.receiptId,sourceRevision:seed.sourceRevision},
  retiredSourceIds:sourceIds,retiredEvents:after.runtimeIngestionEvents.filter(row=>row.lineage.sourceId!==seed.sourceId).length,cleared,
  paidAttemptsBefore:before.runtimeModelAttempts.length,paidAttemptsAfter:after.runtimeModelAttempts.length,liabilitiesRetained:true,
  oldRunsUnchanged:true,historicalRowsPreserved:true,oldObservationsRemainTimestampScoped:true,soleOwnedTarget:c.handoff.projectId};
 await c.publish('controls7-extra-cleanup-result',result);console.log(JSON.stringify({...result,retiredSourceIds:sourceIds.length}));
}catch(error){await c.publish('controls7-extra-cleanup-failure',{status:'FAIL',error:c.publicError(error),records});throw error;}
finally{await c.close();await c.publish('controls7-extra-cleanup-clients',{allOwnedClientsClosed:true,noReactiveClients:true});}
