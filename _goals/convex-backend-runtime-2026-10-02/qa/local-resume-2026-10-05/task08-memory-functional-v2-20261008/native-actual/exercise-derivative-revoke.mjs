import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,waitUntil,denied} from './common.mjs';

const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},records=[];
const candidate=JSON.parse(await readFile(join(q,process.argv[2]??'installed-task08-source-manifest3.json')));
const old=JSON.parse(await readFile(join(q,'delayed-calls.json'))),a=old.records.find(row=>row.label==='turn-a').result;
const codeword=old.records.find(row=>row.label==='turn-a').args.request.parts[0].text.match(/KUMQUAT_[a-f0-9]+/)[0];
let ownedRun,consumer;
async function call(label,kind,name,args,client=c.admin){try{const result=await client[kind](name,args);records.push({label,kind,function:name,args,result});await c.publish('derivative-revoke-calls',{operation,candidate:candidate.manifestSha256,records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error)});await c.publish('derivative-revoke-calls',{operation,candidate:candidate.manifestSha256,records});throw error;}}
const state=()=>c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,...scope});
const reference=full=>Object.fromEntries(['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'].map(key=>[key,full[key]]));
try{
 await c.verifyTarget('derivative-revoke-target-verified');
 const subject='task08-cached-reader-'+operation,full=await call('consumer-provision','mutation','runtimeAuth:provision',{issuer:c.auth.issuer,subject,actorKind:'user',tenantId:c.tenantId,...scope,capabilities:['read','write','run','admin','tool'],resourceAccess:'space'});
 const ref=reference(full);consumer=c.http(subject);const ownerRef=await c.owner.query('ingestionQualification:reference',scope);
 const selector={...scope,conversationId:a.conversationId},permissions={canView:true,canViewFacts:true,canViewMemories:true,canContinue:false,canFork:false,canExport:false};
 const factShare=await call('facts-and-memory-share','mutation','conversationShares:create',{...selector,grantedBy:ownerRef.principalId,grantType:'user',grantedTo:full.principalId,permissions},c.owner);
 await call('memory-only-fallback-share','mutation','conversationShares:create',{...selector,grantedBy:ownerRef.principalId,grantType:'user',grantedTo:full.principalId,permissions:{...permissions,canViewFacts:false}},c.owner);
 const registryHash=await c.admin.query('ingestionQualification:registryHash',{});
 const definition=await call('definition','mutation','agentDefinitions:publishVersion',{...scope,clientMutationId:operation+'-definition',expectedPreviousVersion:0,definitionInput:{instructions:{text:'Answer only the exact user codeword recorded in shared Cortex facts. Do not infer it from this question. Use no tools.',promptVersion:'task08-cached-delivery-v1'},tools:[],context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash,memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:8192,barrier:{deadlineMs:1200,onFailure:'incomplete'}},policies:[{policyId:'task08-cached-'+operation,version:1,operationKey:'agent.respond',rules:{limits:{outputTokens:128,toolSteps:0}}}]}},consumer);
 ownedRun=await call('submit','mutation','ingestionQualification:submitHeld',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,clientRequestId:operation+'-input',parts:[{type:'text',text:'What is my recorded codeword?'}]}},consumer);
 await call('start','mutation','runtimeAgent:start',{...scope,runId:ownedRun.runId,streaming:true},consumer);
 const final=await waitUntil('cached shared facts final',()=>consumer.query('runtimeAgent:observe',{...scope,runId:ownedRun.runId,finalOnly:true}),v=>['complete','failed','unknown','cancelled'].includes(v.state),{timeoutMs:120000,pollMs:400});
 assert.equal(final.state,'complete',JSON.stringify(final));assert.ok(JSON.stringify(final.parts).includes(codeword),'Actual saved output must contain the shared fact sentinel');
 const execution=(await state()).runtimeAgentExecutions.find(row=>row.runId===ownedRun.runId);
 assert.ok(execution.sourceWitnesses.some(w=>w.permissions.includes('canViewFacts')),'This case requires a genuinely consumed fact permission');
 const ownSelector={...scope,conversationId:ownedRun.conversationId};
 const messages=await call('messages-before','query','runtimeTranscript:messages',{...ownSelector,limit:100},consumer),exported=await call('export-before','query','runtimeTranscript:exportPage',{...ownSelector,limit:100},consumer);
 assert.ok(JSON.stringify(messages).includes(codeword));assert.ok(JSON.stringify(exported).includes(codeword));
 const saved=await waitUntil('completed assistant vector',state,s=>s.runtimeMemoryVectors.some(v=>s.runtimeIngestionEvents.some(e=>e.runId===ownedRun.runId&&e.lineage.role==='assistant'&&e.lineage.sourceId===v.sourceId)),{timeoutMs:120000,pollMs:400});
 const assistantEvent=saved.runtimeIngestionEvents.find(e=>e.runId===ownedRun.runId&&e.lineage.role==='assistant');
 const vectors=saved.runtimeMemoryVectors.filter(v=>v.sourceId===assistantEvent.lineage.sourceId),hits=vectors.map(v=>({id:v._id,score:1}));assert.ok(hits.length);
 const preVectors=await call('vectors-before','query','runtimeMemory:readVectorMatches',{reference:ref,capability:'read',hits});assert.ok(JSON.stringify(preVectors).includes(codeword));
 const before=await state();await call('selective-fact-share-revocation','mutation','conversationShares:revoke',{...scope,shareId:factShare.shareId},c.owner);
 const access=await call('remaining-memory-only-access','query','conversationShares:checkAccess',selector,consumer);assert.equal(access.permissions.canViewFacts,false);assert.equal(access.permissions.canViewMemories,true);
 const outcomes=[];
 for(const [label,name,args,client] of [
  ['observe','runtimeAgent:observe',{...scope,runId:ownedRun.runId,finalOnly:true},consumer],
  ['messages','runtimeTranscript:messages',{...ownSelector,limit:100},consumer],
  ['export','runtimeTranscript:exportPage',{...ownSelector,limit:100},consumer],
  ['vector','runtimeMemory:readVectorMatches',{reference:ref,capability:'read',hits},c.admin]]){
   try{const result=await call(label+'-after','query',name,args,client);assert.ok(!JSON.stringify(result).includes(codeword),label+' leaked cached shared sentinel');outcomes.push({name:label,status:'PASS',result});}
   catch(error){assert.ok(['FORBIDDEN','STALE_CONTEXT'].includes(error.data?.code),JSON.stringify(c.publicError(error)));outcomes.push({name:label,status:'PASS',denial:c.publicError(error)});}
 }
 const after=await state();assert.equal(after.runtimeModelAttempts.length,before.runtimeModelAttempts.length);
 await c.publish('derivative-revoke-final',{status:'PASS',operation,candidate:candidate.manifestSha256,runId:ownedRun.runId,sentinel:codeword,sourceWitnesses:execution.sourceWitnesses,actualSavedFinal:true,actualDefaultVectorDimensions:vectors.map(v=>v.dimensions),remainingMemoryPermission:true,modelAttemptsBefore:before.runtimeModelAttempts.length,modelAttemptsAfter:after.runtimeModelAttempts.length,outcomes,unknownCostsRetained:true});
}finally{
 const errors=[];if(ownedRun&&consumer){try{const row=await consumer.query('runs:get',{...scope,runId:ownedRun.runId});if(!['complete','failed','cancelled'].includes(row.responseStatus))await consumer.mutation('runtimeAgent:cancel',{...scope,runId:ownedRun.runId});}catch(error){errors.push(c.publicError(error));}}
 try{await c.close();}catch(error){errors.push(c.publicError(error));}await c.publish('derivative-revoke-cleanup',{ownedClientsClosed:true,errors});if(errors.length)throw new AggregateError(errors,'Cached delivery cleanup failed');
}
