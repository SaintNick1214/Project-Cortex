import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,qa,waitUntil} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const setup=JSON.parse(await readFile(join(qa,'owned-prerequisites1.json')));
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>c.token('cortex-owner')});
try{
 await c.verifyTarget('controls7-small-approval-target');
 const request={version:1,agentId:setup.definitions.approval.agentId,agentVersion:1,clientRequestId:'task09-small-approval-'+c.pointer.operation,
  parts:[{type:'text',text:'Recall my project codeword with limit 1. Await my approval, then reply only with the codeword.'}]};
 const submitted=await c.owner.mutation('ingestionQualification:submitHeld',{request});
 await c.publish('controls7-small-approval-submission',{request,submitted,newLogicalRequest:true,priorDNotRetried:true,sourceScope:'installed-task09-source-manifest4.json'});
 const handle=await client.attach(submitted.runId);await client.start(handle,{streaming:true});
 const waiting=await waitUntil('new small approval',()=>client.observe(handle),row=>row.state==='waiting_approval'||['failed','unknown','cancelled','complete'].includes(row.state),{timeoutMs:120000});
 assert.equal(waiting.state,'waiting_approval');assert.ok(waiting.approvals.length);
 const state=await c.admin.query('ingestionQualification:state',scope),run=state.runtimeRuns.find(row=>row.runId===handle.runId);
 const operations=state.runtimeModelOperations.filter(row=>row.runAccountId===run.runAccountId);
 const model=operations.find(row=>row.operationKey==='agent.respond');assert.ok(model);
 const attempt=state.runtimeModelAttempts.find(row=>row.operationDocumentId===model._id);assert.ok(attempt);
 const validated=JSON.parse(JSON.parse(attempt.inputProofCanonical).requestCanonical),policy=JSON.parse(attempt.snapshotCanonical);
 assert.ok(validated.inputTokens<policy.limits.inputTokens-6000,'Need measured continuation headroom under unchanged policy');
 const result={status:'WAITING_ACTUAL_UI_SMALL_APPROVAL',handle,waiting,priorDNotRetried:true,newLogicalRequest:true,
  firstRequestBound:validated.inputTokens,inputLimit:policy.limits.inputTokens,headroom:policy.limits.inputTokens-validated.inputTokens,
  firstAdmittedRequest:validated,firstModelAttempt:attempt,originalPublishedDefinition:setup.definitions.approval,
  sourceScope:'installed-task09-source-manifest4.json',cleanupOnlyChanges:'Extra sources retired, explicit codeword seed retained; old uncertain accounts unchanged'};
 await c.publish('controls7-small-approval-ready',result);console.log(JSON.stringify({status:result.status,handle,approvals:waiting.approvals,firstRequestBound:result.firstRequestBound,headroom:result.headroom}));
}catch(error){await c.publish('controls7-small-approval-failure',{status:'FAIL',error:c.publicError(error)});throw error;}
finally{const errors=[];try{await client.close();}catch(error){errors.push(c.publicError(error));}try{await c.close();}catch(error){errors.push(c.publicError(error));}await c.publish('controls7-small-approval-client-cleanup',{allOwnedClientsCloseAttempted:true,errors});}
