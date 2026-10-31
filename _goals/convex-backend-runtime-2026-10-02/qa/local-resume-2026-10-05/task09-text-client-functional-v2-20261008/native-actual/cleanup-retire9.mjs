import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {openOwnedContext,qa,denied} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId},records=[];
const state=()=>c.admin.query('ingestionQualification:state',scope);
async function call(label,name,args){const result=await c.admin.mutation(name,args);records.push({label,function:name,args,result});await c.publish('cleanup09-calls',{records});return result;}
try{
 await c.verifyTarget('cleanup09-target-verified');const before=await state();await c.publish('cleanup09-before-state',before);
 assert.ok(before.runtimeRuns.every(row=>['complete','failed','cancelled'].includes(row.responseStatus)));
 assert.ok(before.runtimeModelAttempts.every(row=>row.slotReleased===true));
 assert.ok(before.runtimeBudgetAccounts.every(row=>row.activeConcurrency===0&&row.reservedUnits===0));
 const sourceIds=[...new Set([...before.runtimeMemorySources.map(row=>row.lineage.sourceId),...before.runtimeIngestionEvents.map(row=>row.lineage.sourceId)])];
 for(const sourceId of sourceIds)await call('tombstone-'+sourceId,'runtimeAuth:tombstoneResource',{...scope,resourceType:'source',resourceId:sourceId});
 const retired=await state();assert.ok(retired.runtimeIngestionEvents.every(row=>['tombstoned','superseded'].includes(row.eligibility)));
 const cleared=await call('clear-retired-owned-held','ingestionQualification:clearRetiredHeld',scope);assert.equal(cleared.productRowsDeleted,0);
 const setup=JSON.parse(await readFile(join(qa,'owned-prerequisites1.json'))),grants=[setup.owner,setup.foreign];
 for(const authority of grants){assert.ok([c.tenantId,c.tenantId+'-foreign'].includes(authority.tenantId));await call('revoke-owned-'+authority.grantId,'runtimeAuth:revokeGrant',{grantId:authority.grantId});}
 const after=await state();assert.equal(after.task08HeldStages.length,0);assert.ok(after.runtimeIngestionEvents.every(row=>['tombstoned','superseded'].includes(row.eligibility)));
 assert.deepEqual(after.runtimeModelAttempts.map(row=>row._id).sort(),before.runtimeModelAttempts.map(row=>row._id).sort());
 for(const account of before.runtimeBudgetAccounts){const current=after.runtimeBudgetAccounts.find(row=>row._id===account._id);assert.equal(current.uncertainUnits,account.uncertainUnits);assert.equal(current.settledUnits,account.settledUnits);assert.equal(current.activeConcurrency,0);assert.equal(current.reservedUnits,0);}
 const deniedOwner=await denied(()=>c.owner.query('runtimeClient:session',scope));assert.match(c.publicError(deniedOwner).message,/FORBIDDEN/);
 await c.publish('cleanup09-after-state',after);await c.publish('cleanup09-result',{status:'PASS_OWNED_SCOPE_CLEANUP',sourceIds,eventsRetired:after.runtimeIngestionEvents.length,
  heldRowsDeleted:cleared.deleted,productRowsDeleted:0,grantsRevoked:grants.map(row=>row.grantId),nonterminalRuns:0,activeSlots:0,reservations:0,
  paidAttemptsBefore:before.runtimeModelAttempts.length,paidAttemptsAfter:after.runtimeModelAttempts.length,fullLiabilitiesRetained:true,
  revokedOwnerDenied:c.publicError(deniedOwner),sourceEligibilityRetired:true,historicalRowsPreserved:true});
 const account=JSON.parse(await readFile(join(homedir(),'.convex/config.json'))),headers={Authorization:'Bearer '+account.accessToken};
 const endpoint='https://api.convex.dev/v1/projects/'+c.handoff.projectId;
 const deletion=await fetch(endpoint+'/delete',{method:'POST',headers,signal:AbortSignal.timeout(30000)});
 await c.publish('retirement09-delete',{projectId:c.handoff.projectId,status:deletion.status,ownedOperation:c.state.operation,route:'POST /v1/projects/{ownedProjectId}/delete',secretPrinted:false});assert.equal(deletion.status,200);
 const readback=await fetch(endpoint,{headers,signal:AbortSignal.timeout(30000)});assert.equal(readback.status,404);
 const retiredState={...c.state,retired:true,retiredAt:new Date().toISOString(),retirement:{deleteStatus:deletion.status,readbackStatus:readback.status}};
 await writeFile(join(c.handoff.privateDirectory,'state.json'),JSON.stringify(retiredState,null,2)+'\n',{mode:0o600});
 const removed=[];
 for(const relative of ['credentials.json','jwt-private.pem','task09-owner-jwt.txt','task09-owner-refresh-jwt.txt','task09-foreign-jwt.txt','project/.env.local']){
  const path=join(c.handoff.privateDirectory,relative);let metadata;try{metadata=await stat(path);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  assert.ok(metadata.isFile());await unlink(path);removed.push({path,priorMode:(metadata.mode&0o777).toString(8),priorBytes:metadata.size,removed:true,valueNeverPrinted:true});
 }
 await c.publish('retirement09',{status:'RETIRED_OWNED_TARGET',projectId:c.handoff.projectId,deploymentName:c.handoff.deploymentName,production:false,
  deleteStatus:200,readbackStatus:404,removedPrivateCredentialFiles:removed,remainingPrivateFixture:'Installed source/package/preimage files retained solely for this same independent product review; no usable scoped credentials or active target.',
  rootOwnedFrontend:'Root owns closing Next process and browser tabs; its cleanup receipt is separate',noTargetRetainedForNextTask:true,noNewInference:true});
 console.log(JSON.stringify({status:'RETIRED_OWNED_TARGET',projectId:c.handoff.projectId,deleteStatus:200,readbackStatus:404,paidAttempts:after.runtimeModelAttempts.length,sourceIds:sourceIds.length,grantsRevoked:grants.length,removedCredentialFiles:removed.length}));
}catch(error){await c.publish('cleanup09-retirement-failure',{status:'FAIL',error:c.publicError(error),records});throw error;}
finally{await c.close();await c.publish('cleanup09-clients',{allOwnedClientsClosed:true,noReactiveClients:true});}
