import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try {
 await c.verifyTarget('installed-financial-scope-target-verified');
 const old=JSON.parse(await readFile(join(q,'lifecycle-edit-calls.json'),'utf8'));
 const oldRun=old.records.find(row=>row.label==='submit').result.runId;
 const oldBefore=await c.admin.query('agentQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId,runId:oldRun});
 await c.owner.mutation('runtimeAgent:cancel',{memorySpaceId:c.memorySpaceId,runId:oldRun});
 const oldAfter=await c.admin.query('agentQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId,runId:oldRun});
 assert.equal(oldAfter.modelAttempts.length,oldBefore.modelAttempts.length);assert.equal(oldAfter.executions[0].state,'cancelled');
 await c.publish('lifecycle-edit-old-close',{oldRun,status:'PASS',beforeState:oldBefore.executions[0].state,afterState:oldAfter.executions[0].state,
    paidAttemptsUnchanged:oldAfter.modelAttempts.length,old180SecondFailurePreserved:true});
 const raw=await readFile(join(c.host,c.functionsDirectory,'runtimeGatewayQualifications.ts'),'utf8');
 const match=/export const DEFAULT_GATEWAY_POLICY_MANIFEST = (\{[\s\S]*\}) as const satisfies DeploymentPolicyManifest;/.exec(raw);assert.ok(match);
 const manifest=JSON.parse(match[1]);assert.equal(manifest.manifestId,'cortex-gateway-agent-defaults-2026-10-08');assert.equal(manifest.revision,5);
 assert.equal(manifest.classification,'reviewed-actual');assert.equal(manifest.dispatchEvidence.length,4);
 assert.equal(manifest.dispatchEvidence.filter(proof=>proof.inputBound.featureEnvelope==='agent-tools-chat-v1').length,1);
 const installed=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:manifest.revision});
 const operation=randomUUID(),tenantId='task07-installed-'+operation,ownerSubject=tenantId,memorySpaceId=tenantId+'-space';
 const reference=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:ownerSubject,actorKind:'user',tenantId,memorySpaceId,
   capabilities:['read','write','run','admin','tool','storage:read','storage:write'],resourceAccess:'space'});
 await c.publish('installed-financial-scope',{operation,tenantId,memorySpaceId,ownerSubject,reference,installed,
   manifestId:manifest.manifestId,revision:manifest.revision,classification:manifest.classification,qualificationSourceSha256:sha(raw),
   newTenantPreservesOldUncertainLiability:true,operatorFixtureExceptionRemoved:true,productionDeployment:false});
}finally{await c.close();}
