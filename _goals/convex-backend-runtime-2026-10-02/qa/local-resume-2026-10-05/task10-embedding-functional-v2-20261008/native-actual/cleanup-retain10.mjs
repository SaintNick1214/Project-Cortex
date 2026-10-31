/** Explicit Task10 scope retirement; sole owned dev target retained for a new Task11 tenant. */
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha,authorityReference} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('cleanup10-target-verified');
 const baseline=JSON.parse(await readFile(join(q,'baseline-functional-auth-outcomes.json'))),managed=JSON.parse(await readFile(join(q,'managed-setup1.json')));
 const inspect=()=>c.admin.query('profileNative:cleanupState',{}),before=await inspect();await c.publish('cleanup10-before-state',before);
 const money={commission:await c.admin.query('profileNative:inspectLedger',{reference:authorityReference(baseline.owner)}),managed:await c.admin.query('profileNative:inspectLedger',{reference:managed.reference})};
 const calls=[];
 for(const source of before.sources){await c.admin.mutation('runtimeAuth:tombstoneResource',{tenantId:source.tenantId,memorySpaceId:source.memorySpaceId,resourceType:'source',resourceId:source.sourceId});calls.push({sourceId:source.sourceId,sourceTombstone:true});}
 for(const conversation of before.conversations){await c.admin.mutation('runtimeAuth:tombstoneResource',{tenantId:conversation.tenantId,memorySpaceId:conversation.memorySpaceId,resourceType:'conversation',resourceId:conversation.conversationId});calls.push({conversationId:conversation.conversationId,conversationTombstone:true});}
 for(const grant of before.grants){await c.admin.mutation('runtimeAuth:revokeGrant',{grantId:grant._id});calls.push({grantId:grant._id,grantRevoked:true});}
 const after=await inspect();await c.publish('cleanup10-after-state',after);
 assert.equal(after.runningStages.length,0);assert.ok(after.events.every(row=>['tombstoned','superseded','ineligible'].includes(row.eligibility)));assert.ok(after.grants.every(row=>row.revokedAt!==null));
 for(const source of before.sources)assert.ok(after.tombstones.some(row=>row.resourceType==='source'&&row.resourceId===source.sourceId&&row.tenantId===source.tenantId));
 for(const conversation of before.conversations)assert.ok(after.tombstones.some(row=>row.resourceType==='conversation'&&row.resourceId===conversation.conversationId&&row.tenantId===conversation.tenantId));
 assert.deepEqual(await c.admin.query('profileNative:inspectLedger',{reference:authorityReference(baseline.owner)}),money.commission);
 assert.deepEqual(await c.admin.query('profileNative:inspectLedger',{reference:managed.reference}),money.managed);
 const stock=JSON.parse(await readFile(join(q,'stock-host-live.json')));assert.deepEqual(await c.hostOwner.query('host:authenticated',{}),stock.rows);
 const node=await c.hostOwner.action('hostNode:health',{});assert.equal(node.runtime,'node');assert.equal(node.subject,'host-owner');
 const originals=JSON.parse(await readFile(join(q,'host-originals.json'))),preserved=[];
 for(const path of ['convex.json','custom/backend/host.ts','custom/backend/hostNode.ts','custom/backend/http.ts']){assert.equal(sha(await readFile(join(c.host,path))),originals[path].sha256);preserved.push(path);}
 const http=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/host-health',{signal:AbortSignal.timeout(30000)});assert.equal(http.status,200);assert.equal(await http.text(),'host-route-preserved');
 const secretMetadata=[];for(const path of ['credentials.json','jwt-private.pem','auth.json','state.json']){const metadata=await stat(join(c.pointer.privateDirectory,path));assert.equal(metadata.mode&0o777,0o600);secretMetadata.push({path,mode:'0600',retained:true,bodyNotPublished:true});}
 assert.equal((await stat(c.pointer.privateDirectory)).mode&0o777,0o700);
 await c.publish('cleanup10-result',{status:'PASS',calls,projectId:c.state.projectId,deploymentName:c.state.deploymentName,production:false,retirement:'RETAINED_EXPLICITLY_FOR_TASK11_NOT_DELETED',
  ownedTask10ScopesTombstoned:true,allTask10GrantsRevoked:true,remainingRunningStages:0,ledger:money,liabilityRefund:false,hostPreserved:preserved,hostNodePreserved:true,hostHTTPPreserved:true,
  privateDirectory:c.pointer.privateDirectory,secretMetadata,issuer:{type:'dataJWKS',serverProcess:false},nextTaskMustUseNewTenantAndFreshTargetVerification:true,finalGoalRetirementStillRequired:true});
}finally{await c.close();await c.publish('cleanup10-clients',{ownedClientsClosed:true,noIssuerProcess:true});}
