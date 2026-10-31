import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext(),records=[];
const scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId},state=()=>c.admin.query('ingestionQualification:state',scope);
async function call(label,kind,name,args,client=c.admin){try{const result=await client[kind](name,args);records.push({label,kind,function:name,args,result});await c.publish('owned08-cleanup-calls',{records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error)});await c.publish('owned08-cleanup-calls',{records});throw error;}}
try{
 await c.verifyTarget('owned08-cleanup-target-verified');
 const before=await state();await c.publish('owned08-pre-cleanup-state',before);
 const bootstrap=JSON.parse(await readFile(join(q,'baseline-functional-auth-outcomes.json'))),grants=new Map(),subjects=new Map();
 for(const [subject,authority] of [['cortex-owner',bootstrap.owner],['foreign-user',bootstrap.foreign]]){subjects.set(authority.principalId,subject);grants.set(authority.grantId,authority);}
 for(const file of ['delayed-calls.json','fences-first-calls.json','fences-shared2-calls.json','derivative-revoke-calls.json']){
  const packet=JSON.parse(await readFile(join(q,file)));for(const row of packet.records){if(row.function==='runtimeAuth:provision'&&row.result){assert.ok([c.tenantId,c.tenantId+'-foreign'].includes(row.args.tenantId));subjects.set(row.result.principalId,row.args.subject);grants.set(row.result.grantId,row.result);}}
 }
 for(const run of before.runtimeRuns){if(['complete','failed','cancelled'].includes(run.responseStatus))continue;const subject=subjects.get(run.ownerPrincipalId);assert.ok(subject,'Unknown owned run subject');await call('cancel-'+run.runId,'mutation','runtimeAgent:cancel',{memorySpaceId:c.memorySpaceId,runId:run.runId},c.http(subject));}
 const sourceIds=[...new Set(before.runtimeMemorySources.map(s=>s.lineage.sourceId))];
 for(const sourceId of sourceIds)await call('tombstone-'+sourceId,'mutation','runtimeAuth:tombstoneResource',{...scope,resourceType:'source',resourceId:sourceId});
 const retired=await state();assert.ok(retired.runtimeIngestionEvents.every(e=>['tombstoned','superseded'].includes(e.eligibility)));
 const heldCount=retired.task08HeldStages.length,cleared=await call('clear-exact-retired-held-fixtures','mutation','ingestionQualification:clearRetiredHeld',scope);assert.equal(cleared.deleted,heldCount);assert.equal(cleared.productRowsDeleted,0);
 for(const [grantId,authority] of grants){assert.ok([c.tenantId,c.tenantId+'-foreign'].includes(authority.tenantId));await call('revoke-'+grantId,'mutation','runtimeAuth:revokeGrant',{grantId});}
 const after=await state();assert.equal(after.task08HeldStages.length,0);assert.ok(after.runtimeIngestionEvents.every(e=>['tombstoned','superseded'].includes(e.eligibility)));assert.ok(after.runtimeRuns.every(r=>['complete','failed','cancelled'].includes(r.responseStatus)));
 assert.equal(after.runtimeModelAttempts.length,before.runtimeModelAttempts.length);
 for(const account of before.runtimeBudgetAccounts){const current=after.runtimeBudgetAccounts.find(a=>a._id===account._id);assert.equal(current.uncertainUnits,account.uncertainUnits);assert.equal(current.settledUnits,account.settledUnits);assert.equal(current.activeConcurrency,0);assert.equal(current.reservedUnits,0);}
 await c.publish('owned08-post-cleanup-state',after);
 const credentials=[];for(const name of ['credentials.json','auth.json','jwt-private.pem','state.json']){const info=await stat(join(c.pointer.privateDirectory,name));assert.equal(info.mode&0o777,0o600);credentials.push({path:join(c.pointer.privateDirectory,name),mode:'0600',bytes:info.size,secretPrinted:false});}
 assert.equal((await stat(c.pointer.privateDirectory)).mode&0o777,0o700);
 const candidate=JSON.parse(await readFile(join(q,'installed-task08-source-manifest3.json'))),helper=await readFile(join(c.host,'custom/backend/ingestionQualification.ts'));
 await c.publish('retained-for-task09',{status:'RETAINED_OWNED_NOT_RETIRED',purpose:'Original Task09 actual TypeScript/browser text slice after Task08 independent acceptance',operation:c.state.operation,teamId:c.state.teamId,projectId:c.state.projectId,deploymentName:c.state.deploymentName,url:c.state.url,production:false,soleOwnedCloudDevelopment:true,privateDirectory:c.pointer.privateDirectory,fixtureHost:c.host,functionsDirectory:c.functionsDirectory,credentialMetadata:credentials,issuer:c.auth.issuer,applicationID:c.auth.applicationID,baseline:candidate.packed,sourceManifest:'installed-task08-source-manifest3.json',fixtureHelperCleanupOnlyPostimage:{bytes:helper.length,sha256:sha(helper)},owned08Cleanup:{sourceIds:sourceIds.length,eventsRetired:after.runtimeIngestionEvents.length,heldRowsDeleted:cleared.deleted,scopedGrantsRevoked:grants.size,nonterminalRuns:0,activeModelSlots:0,paidAttemptsBefore:before.runtimeModelAttempts.length,paidAttemptsAfter:after.runtimeModelAttempts.length,liabilitiesRetained:true},historicalRowsPreserved:true,registeredQAHelpers:'Retained private disposable-fixture APIs; every owned08 source/event retired and grant revoked. Task09 must use a new authorized tenant scope.',targetRetirementDue:'After Task09 or when no longer needed; full-goal cleanup remains open.'});
}finally{await c.close();await c.publish('owned08-client-cleanup',{ownedClientsClosed:true,noReactiveClients:true});}
