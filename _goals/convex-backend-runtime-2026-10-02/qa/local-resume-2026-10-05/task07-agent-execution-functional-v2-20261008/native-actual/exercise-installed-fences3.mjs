/** Native current-claim guard checks; no model result or paid admission is fabricated. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openOwnedContext,denied} from './common-installed.mjs';
const scenario=process.argv[2];assert.ok(['edit','remove','cancel','revoke','definition-revoke'].includes(scenario));
const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},prefix='installed-fence2-'+scenario,records=[];
const snapshot=runId=>c.admin.query('agentQualification:state',{tenantId:c.tenantId,...scope,runId});
async function call(label,kind,name,args,client=c.owner){try{const result=await client[kind](name,args);records.push({label,function:name,status:'PASS',result});return result;}
 catch(error){records.push({label,function:name,status:'FAIL',error:c.publicError(error)});throw error;}
 finally{await c.publish(prefix+'-calls',{operation,records});}}
try{
 await c.verifyTarget(prefix+'-target-verified');
 const registryHash=await c.admin.query('agentQualification:registryHash',{});
 const definition=await call('definition','mutation','agentDefinitions:publishVersion',{...scope,clientMutationId:operation,expectedPreviousVersion:0,
   definitionInput:{instructions:{text:'Return one short acknowledgement.',promptVersion:'task07-native-fence-v1'},tools:[],
     context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash,memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:4096},
     policies:[{policyId:'task07-fence',version:1,operationKey:'agent.respond',rules:{limits:{outputTokens:256,toolSteps:0}}}]}});
 const conversation=await call('conversation','mutation','runtimeTranscript:create',{...scope,clientRequestId:operation});
 if(['edit','remove'].includes(scenario))await call('unlock-before-cutoff','mutation','runtimeTranscript:setPolicy',{...scope,conversationId:conversation.conversationId,
   expectedRevision:conversation.historyRevision,manualWriteLocked:false});
 const run=await call('submit','mutation','runs:submit',{request:{version:1,agentId:definition.agentId,agentVersion:definition.version,conversationId:conversation.conversationId,
   clientRequestId:'task07-native-fence-'+operation,parts:[{type:'text',text:'This exact selected input will be fenced before dispatch.'}]}});
 const reference=await c.owner.query('agentQualification:reference',scope);
 const attempt=await call('native-claim','mutation','agentQualification:armSaveGap',{reference,runId:run.runId},c.admin);
 const before=await snapshot(run.runId);assert.equal(before.modelAttempts.length,0);assert.equal(before.operations.length,0);
 const selector={...scope,runId:run.runId};let expected;
 if(scenario==='edit'||scenario==='remove'){
   const view={...scope,conversationId:run.conversationId},head=await c.owner.query('runtimeTranscript:get',view),page=await c.owner.query('runtimeTranscript:messages',{...view,limit:100});
   const pin=page.page.find(row=>row.id===run.inputMessageIds[0]);assert.ok(pin);
   await call('selected-history-change','mutation',scenario==='edit'?'runtimeTranscript:edit':'runtimeTranscript:removeMessage',{
     ...view,expectedRevision:head.historyRevision,messageId:pin.id,expectedMessageRevision:pin.revision,
     ...(scenario==='edit'?{parts:[{type:'text',text:'Changed selected input is a distinct revision.'}]}:{})});
   expected=['STALE_TRANSCRIPT','STALE_CONTEXT','FORBIDDEN'];
 }else if(scenario==='cancel'){
   const cancelled=await call('public-cancel','mutation','runtimeAgent:cancel',selector);assert.equal(cancelled.cancelled,true);
   const output=await c.owner.query('runtimeAgent:observe',selector);assert.equal(output.state,'cancelled');
   assert.ok(output.parts.some(row=>row.part.type==='status'&&row.part.state==='cancelled'));expected=['INVALID_STATE'];
 }else if(scenario==='definition-revoke'){
   await call('revoke-executable-version','mutation','agentDefinitions:revokeVersion',{...scope,agentId:definition.agentId,version:definition.version,
     expectedDefinitionHash:definition.definitionHash,reason:'Owned actual safe cancellation after definition revocation.'});
   const safeRead=await call('safe-current-authority-get','query','runs:get',selector);assert.equal(safeRead.responseStatus,'running');
   const safeObserve=await call('safe-current-authority-observe','query','runtimeAgent:observe',selector);assert.equal(safeObserve.state,'ready');
   const safeAttempts=await call('safe-current-authority-attempts','query','runs:attempts',selector);assert.equal(safeAttempts.length,1);
   const deniedControls=[];for(const client of [c.anonymous,c.foreign])for(const name of ['runs:get','runtimeAgent:observe','runtimeAgent:cancel']){
     const error=await denied(()=>name==='runtimeAgent:cancel'?client.mutation(name,selector):client.query(name,selector));deniedControls.push({name,error:c.publicError(error)});}
   await c.publish(prefix+'-foreign-controls-denials',deniedControls);
   const cancelled=await call('safe-current-authority-cancel','mutation','runtimeAgent:cancel',selector);assert.equal(cancelled.cancelled,true);
   const output=await c.owner.query('runtimeAgent:observe',selector);assert.equal(output.state,'cancelled');
   assert.ok(output.parts.some(row=>row.part.type==='status'&&row.part.state==='cancelled'));expected=['POLICY_DENIED'];
 }else{
   await call('revoke-current-grant','mutation','runtimeAuth:revokeGrant',{grantId:reference.grantId},c.admin);expected=['FORBIDDEN'];
   const publicDenials=[];for(const name of ['runtimeAgent:observe','runtimeAgent:start','runtimeAgent:reconcile']){
     const error=await denied(()=>name==='runtimeAgent:observe'?c.owner.query(name,selector):c.owner.mutation(name,selector));
     assert.equal(error.data?.code,'FORBIDDEN');publicDenials.push({name,error:c.publicError(error)});}
   await c.publish(prefix+'-public-denials',publicDenials);
 }
 const first=await call('actual-model-handler-current-fence','action','agentFenceQualification:attemptModel',{...attempt,ordinal:0},c.admin);
 assert.equal(first.denied,true);assert.ok(expected.includes(first.error.data?.code),JSON.stringify(first.error));
 const second=await call('repeat-denied-handler','action','agentFenceQualification:attemptModel',{...attempt,ordinal:0},c.admin);
 assert.equal(second.denied,true);assert.ok(expected.includes(second.error.data?.code));
 const after=await snapshot(run.runId);assert.equal(after.modelAttempts.length,0);assert.equal(after.operations.length,0);assert.equal(after.ingestion.length,0);
 assert.equal(after.native.filter(row=>row.role==='assistant').length,0);
 if(!['revoke','cancel','definition-revoke'].includes(scenario))await call('cancel-stale-owned-work','mutation','runtimeAgent:cancel',selector);
 await c.publish(prefix+'-outcome',{operation,status:'PASS',scenario,before,first,second,after,currentGuardDenied:true,noPaidDispatch:true,
   noFinalTranscriptOrIngestion:true,sourceCandidate:'installed-final5-source-manifest.json',nativeHandlerUnchanged:true,fixtureOnlyAtomicClaimSetup:true});
}finally{await c.close();await c.publish(prefix+'-client-cleanup',{ownedClientsClosed:true});}
