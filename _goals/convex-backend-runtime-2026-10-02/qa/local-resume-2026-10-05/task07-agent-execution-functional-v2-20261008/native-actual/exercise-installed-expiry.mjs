import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openOwnedContext,denied,waitUntil} from './common-installed.mjs';
const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},records=[];
const snapshot=runId=>c.admin.query('agentQualification:state',{tenantId:c.tenantId,...scope,runId});
async function call(label,kind,name,args,client=c.owner){try{const result=await client[kind](name,args);records.push({label,function:name,status:'PASS',result});return result;}
 catch(error){records.push({label,function:name,status:'FAIL',error:c.publicError(error)});throw error;}
 finally{await c.publish('installed-expiry-calls',{operation,records});}}
try{
 await c.verifyTarget('installed-expiry-target-verified');
 const registryHash=await c.admin.query('agentQualification:registryHash',{});
 const definition=await call('definition','mutation','agentDefinitions:publishVersion',{...scope,clientMutationId:operation,expectedPreviousVersion:0,
   definitionInput:{instructions:{text:'Use scoped memory only after explicit approval.',promptVersion:'task07-expiry-v1'},
     tools:[{toolId:'memory.recall',toolVersion:1,registryHash,requiredCapability:'tool',approval:'explicit'}],
     context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash,memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:4096},
     policies:[{policyId:'task07-expiry',version:1,operationKey:'agent.respond',rules:{limits:{outputTokens:256,toolSteps:1}}}]}});
 const first=await call('submit-A','mutation','runs:submit',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,
   clientRequestId:'task07-expiry-A-'+operation,parts:[{type:'text',text:'First owned waiting approval.'}]}});
 const reference=await c.owner.query('agentQualification:reference',scope);
 const attempt=await call('claim-A','mutation','agentQualification:armSaveGap',{reference,runId:first.runId},c.admin);
 const op=await call('native-tool-operation','mutation','runtimeAgent:beginOperation',{...attempt,kind:'tool',ordinal:0,
   toolCallId:'fixture-expiry-'+operation,toolName:'memory_recall',requestCanonical:'{"limit":1,"text":"tea"}'},c.admin);
 assert.equal(op.state,'waiting_approval');
 await call('native-wait-for-approval','mutation','runtimeAgent:waitForApproval',{...attempt,operationId:op.operationId},c.admin);
 const waiting=await c.owner.query('runtimeAgent:observe',{...scope,runId:first.runId});assert.equal(waiting.state,'waiting_approval');assert.equal(waiting.approvals.length,1);
 const second=await call('submit-B-behind-wait','mutation','runs:submit',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,
   conversationId:first.conversationId,clientRequestId:'task07-expiry-B-'+operation,parts:[{type:'text',text:'Later owned queued input.'}]}});
 const before=await snapshot(first.runId),queuedBefore=await snapshot(second.runId);assert.equal(before.modelAttempts.length,0);assert.equal(queuedBefore.modelAttempts.length,0);
 const expiry=await call('fixture-deadline-elapsed','mutation','agentFenceQualification:expireFixtureLease',attempt,c.admin);
 const deniedApproval=await denied(()=>c.owner.mutation('runtimeAgent:approveTool',{...scope,runId:first.runId,operationId:op.operationId,expectedRequestHash:waiting.approvals[0].requestHash}));
 assert.equal(deniedApproval.data?.code,'LEASE_EXPIRED');
 const rejected=await snapshot(first.runId);assert.equal(rejected.outbox[0].leaseExpiresAt,expiry.leaseExpiresAt);
 assert.equal(rejected.operations[0].state,'waiting_approval');assert.equal(rejected.modelAttempts.length,0);
 await call('native-owned-recovery','mutation','runs:recoverQueue',{reference,conversationId:first.conversationId},c.admin);
 const retired=await waitUntil('expired admitted wait retired',()=>snapshot(first.runId),state=>state.executions[0].state==='cancelled',{timeoutMs:15_000});
 assert.equal(retired.run.failureCode,'APPROVAL_EXPIRED');assert.equal(retired.outbox[0].state,'complete');assert.equal(retired.modelAttempts.length,0);
 const next=await call('claim-B-after-expiry','mutation','agentQualification:armSaveGap',{reference,runId:second.runId},c.admin);
 const nextBefore=await snapshot(second.runId);assert.equal(nextBefore.run.responseStatus,'running');assert.equal(nextBefore.executions[0].state,'ready');
 await call('late-old-scheduled-callback','mutation','runtimeAgent:expireApproval',{...attempt,leaseExpiresAt:expiry.previous},c.admin);
 await call('repeat-current-expired-callback','mutation','runtimeAgent:expireApproval',{...attempt,leaseExpiresAt:expiry.leaseExpiresAt},c.admin);
 const nextAfter=await snapshot(second.runId);assert.deepEqual(nextAfter,nextBefore);
 await call('cancel-B-no-retry','mutation','runtimeAgent:cancel',{...scope,runId:second.runId});
 const final=await snapshot(first.runId);assert.equal(final.modelAttempts.length,0);assert.equal(final.ingestion.length,0);assert.equal(final.operations.filter(op=>op.state==='approved'||op.state==='started'||op.state==='complete').length,0);
 await c.publish('installed-expiry-outcome',{operation,status:'PASS',before,queuedBefore,expiry,rejected,retired,next,nextBefore,nextAfter,final,
   approvalError:c.publicError(deniedApproval),noLeaseRenewal:true,queuedRunAdvances:true,staleCallbackNoEffect:true,noInference:true,
   fixtureSetup:'Real native beginOperation/waitForApproval; only owned outbox deadline adjusted. No fabricated native model result or ledger receipt.',sourceCandidate:'installed-final4-source-manifest.json'});
}finally{await c.close();await c.publish('installed-expiry-client-cleanup',{ownedClientsClosed:true});}
