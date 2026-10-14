/** Final-only supplemental proof. Official bounded system queries, no product mutations. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {K19_PINS} from './k19-collector-pins.mjs';
import {requireK19ToolGo} from './k19-tool-supplement-pins.mjs';
import {completeNativeTokenUsage} from './verify-k6-native-usage.mjs';
import {loadSession,createContext,PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud,getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
import {semanticHash,assertSupportedEmbeddingProfile,assertEmbeddingVector} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile.ts';
import {prepareSourceContent} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/sources.ts';
import {canonicalModelJson} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy.ts';
import {explicitSourceLineage} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryServices.ts';
import {vectorScopeKey,vectorOwnerScopeKey} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryRepository.ts';

const Q=path.dirname(fileURLToPath(import.meta.url));
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const same=(a,b)=>canonicalModelJson(a)===canonicalModelJson(b);
const sameScope=(a,b)=>a?.tenantId===b.tenantId&&a?.memorySpaceId===b.memorySpaceId;
const sameLineage=(a,b)=>a?.sourceId===b.sourceId&&a?.sourceEventId===b.sourceEventId&&a?.sourceRevision===b.sourceRevision;
const strip=row=>{const {_id,_creationTime,...value}=row;return value;};
const one=(rows,label)=>{assert.equal(rows.length,1,'Exact row cardinality: '+label);return rows[0];};
const number=v=>Number.isFinite(v)?v:undefined;
let client,phase='interlock',freshVerifications=0;
const waiting=new Map(),tableCounts={};

function currentAuthority(rows,ref,required,resources=[]){
  const principal=one(rows.runtimeAuthPrincipals.filter(row=>row._id===ref.principalId),'principal');
  const membership=one(rows.runtimeAuthMemberships.filter(row=>row._id===ref.membershipId),'membership');
  const grant=one(rows.runtimeAuthGrants.filter(row=>row._id===ref.grantId),'grant');
  const tenant=one(rows.runtimeAuthScopes.filter(row=>row.tenantId===ref.tenantId&&row.memorySpaceId===undefined),'tenant');
  const space=one(rows.runtimeAuthScopes.filter(row=>sameScope(row,ref)),'space');
  assert.equal(principal.version,ref.principalVersion);assert.equal(principal.revokedAt,undefined);assert.equal(principal.deletedAt,undefined);
  assert.equal(membership.principalId,principal._id);assert.equal(membership.tenantId,ref.tenantId);assert.equal(membership.version,ref.membershipVersion);
  assert.equal(membership.revokedAt,undefined);assert.equal(membership.deletedAt,undefined);
  assert.equal(grant.principalId,principal._id);assert.equal(grant.membershipId,membership._id);assert.equal(grant.version,ref.grantVersion);
  assert.equal(grant.tenantId,ref.tenantId);assert.equal(grant.memorySpaceId,ref.memorySpaceId);assert.equal(grant.tenantEpoch,ref.tenantEpoch);assert.equal(grant.memorySpaceEpoch,ref.memorySpaceEpoch);
  assert.equal(grant.revokedAt,undefined);assert.equal(grant.deletedAt,undefined);assert.ok(grant.expiresAt===undefined||grant.expiresAt>Date.now());
  assert.equal(tenant.epoch,ref.tenantEpoch);assert.equal(space.epoch,ref.memorySpaceEpoch);assert.equal(tenant.deletedAt,undefined);assert.equal(space.deletedAt,undefined);
  assert.ok(required.every(capability=>grant.capabilities.includes(capability)),'Required current capabilities');
  assert.ok(!rows.runtimeAuthTombstones.some(row=>row.tenantId===ref.tenantId&&
    (row.resourceType==='tenant'&&row.resourceId===ref.tenantId||row.resourceType==='memorySpace'&&row.resourceId===ref.memorySpaceId||
      resources.some(resource=>row.resourceType===resource.type&&row.resourceId===resource.id&&(row.memorySpaceId===undefined||row.memorySpaceId===ref.memorySpaceId)))),'Current resource tombstone');
}

async function main(){
  const pins=requireK19ToolGo();
  assert.equal(process.versions.node,'24.15.0');
  assert.equal(process.env.CORTEX_K19_TOOL_COMPLETE_CONFIRMED,'1','Coordinator final supplemental GO required');
  assert.equal(process.argv.length,5,'Usage: SESSION NAME ID (run/approval bound by dedicated pins)');
  const [sessionId,name,id]=process.argv.slice(2);
  assert.equal(sessionId,K19_PINS.sessionId);assert.equal(name,K19_PINS.name);assert.equal(Number(id),K19_PINS.targetId);
  const proofPath=path.resolve(pins.fixedFourProof);assert.equal(path.dirname(proofPath),Q,'Fixed proof must be local Q receipt');
  const proofRaw=await fs.readFile(proofPath);assert.equal(hash(proofRaw),pins.fixedFourProofSha256);
  const proof=JSON.parse(proofRaw);assert.equal(proof.passed,true);assert.equal(proof.target.sessionId,sessionId);
  assert.equal(proof.target.name,name);assert.equal(proof.target.id,Number(id));assert.equal(proof.mode,'four-supplied-runs');
  assert.deepEqual(proof.runs.map(run=>run.runId),K19_PINS.runIds);assert.equal(proof.runs.reduce((n,run)=>n+run.events.length,0),8);
  assert.ok(proof.runs.every(run=>run.passed&&run.events.every(event=>event.passed)),'Original strict eight-event proof required before supplemental');
  const session=await loadSession(PROOFS_ROOT,sessionId);
  const exactTarget=async value=>{
    assert.equal(value.id,sessionId);assert.equal(value.phase,'READY');assert.equal(value.ownerUid,process.getuid());
    assert.equal(value.target.name,name);assert.equal(value.target.id,Number(id));assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);
    assert.equal(value.target.reference,'dev/cortex-sandbox-'+sessionId);assert.equal(value.target.isDefault,false);
    assert.equal(value.target.expiresAt,K19_PINS.expiresAt);assert.ok(value.target.expiresAt>Date.now());assert.equal(value.container.imageId,K19_PINS.imageId);
    const host=JSON.parse(await fs.readFile(path.join(value.receiptDir,'host-prepared.json'),'utf8'));assert.equal(host.sourceCommit,K19_PINS.sourceCommit);
  };
  await exactTarget(session);
  const artifactRaw=await fs.readFile(path.join(K19_PINS.kit,'image/archives/manifest.json'));assert.equal(hash(artifactRaw),K19_PINS.manifestSha256);
  const artifact=JSON.parse(artifactRaw);assert.equal(artifact.sourceCommit,K19_PINS.sourceCommit);assert.equal(artifact.backend.manifestSha256,K19_PINS.backendManifestSha256);
  const sdk=one(artifact.packages.filter(row=>row.role==='sdk'),'SDK archive');assert.equal(sdk.sha256,K19_PINS.sdkArchiveSha256);
  assert.equal(hash(await fs.readFile(path.join(K19_PINS.kit,'image/archives',sdk.filename))),sdk.sha256);
  assert.equal(hash(await fs.readFile(path.join(session.backendDir,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'))),K19_PINS.backendManifestSha256);
  const ctx=await createContext(session,{logger:()=>{}});ctx.persist=async()=>{};ctx.receipt=async name=>{if(name.startsWith('cloud-verified-'))freshVerifications++;};
  const fetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET','Management GET only');return fetch(url,options);};
  await verifyCloud(session,ctx);
  const stat=await fs.lstat(session.deploymentKeyPath);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o077)===0);
  const key=await getDeployKey(session,ctx),requireHost=createRequire(path.join(session.backendDir,'package.json'));
  const {BaseConvexClient}=requireHost('convex/browser');
  client=new BaseConvexClient(session.target.deploymentUrl,tokens=>{for(const token of tokens){const waiter=waiting.get(token);if(!waiter)continue;
    try{waiter.resolve(client.localQueryResultByToken(token));}catch(error){waiter.reject(error);}}},
    {logger:false,unsavedChangesWarning:false,webSocketConstructor:WebSocket});client.setAdminAuth(key);
  async function table(name,componentPath=''){
    phase='table.'+name;await exactTarget(await loadSession(PROOFS_ROOT,sessionId));await verifyCloud(session,ctx);
    const page=await new Promise((resolve,reject)=>{
      const subscription=client.subscribe('_system/cli/tableData',{table:name,order:'desc',paginationOpts:{cursor:null,numItems:256}},{componentPath});
      const timer=setTimeout(()=>{waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(Error('Bounded query deadline'));},30000);
      const finish=(fn,value)=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();fn(value);};
      waiting.set(subscription.queryToken,{resolve:value=>finish(resolve,value),reject:error=>finish(reject,error)});
    });
    assert.ok(Array.isArray(page.page));assert.equal(page.isDone,true,'Bounded scan overflow');tableCounts[componentPath+':'+name]=page.page.length;
    await exactTarget(await loadSession(PROOFS_ROOT,sessionId));await verifyCloud(session,ctx);return page.page;
  }
  const rows={};for(const name of ['runtimeRuns','runtimeAgentDefinitions','runtimeAgentExecutions','runtimeAgentOperations','runtimeAgentIngestion','runtimeAgentOutput','runtimeModelOperations','runtimeModelAttempts',
    'runtimeBudgetAccounts','runtimeModelQualifications','runtimeIngestionEvents','runtimeIngestionStages','runtimeIngestionScopes','runtimeMemorySources','runtimeMemoryChunks',
    'runtimeMemoryVectors','runtimeMemoryVectorGenerations','runtimeMemoryReceipts','facts','runtimeTranscriptMessages','runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthGrants','runtimeAuthScopes','runtimeAuthTombstones'])rows[name]=await table(name);
  const workflows=await table('workflows','workflow'),steps=await table('steps','workflow');phase='verify';
  const run=one(rows.runtimeRuns.filter(row=>row.runId===pins.runId),'run');assert.equal(run.responseStatus,'complete');assert.equal(run.memoryStatus,'complete');assert.equal(run.tombstonedAt,undefined);
  assert.ok(proof.runs.every(old=>old.runId!==run.runId));assert.ok(run.createdAt>=Date.parse(proof.observedAt),'Fixed proof precedes supplemental admission');
  const execution=one(rows.runtimeAgentExecutions.filter(row=>sameScope(row,run)&&row.runId===run.runId&&row.attemptNumber===run.attemptNumber),'attempt');
  assert.equal(execution.executionMode,'direct-v6');assert.equal(execution.directState,'continuation');assert.equal(execution.state,'complete');assert.ok(execution.scheduledActionId);
  assert.equal(execution.contextState,'complete');assert.ok(execution.workflowId);
  const ops=rows.runtimeAgentOperations.filter(row=>sameScope(row,run)&&row.runId===run.runId&&row.attemptNumber===run.attemptNumber);
  const model0=one(ops.filter(row=>row.kind==='model'&&row.ordinal===0),'model0');const model1=one(ops.filter(row=>row.kind==='model'&&row.ordinal===1),'model1');
  const tool=one(ops.filter(row=>row.kind==='tool'),'one tool');assert.equal(ops.length,3);assert.equal(model0.state,'complete');assert.equal(model1.state,'complete');
  const first=JSON.parse(model0.resultCanonical),final=JSON.parse(model1.resultCanonical);
  assert.equal(first.final,false);assert.equal(first.calls.length,1);assert.equal(first.calls[0].toolName,'memory_remember');assert.equal(final.final,true);assert.equal(final.calls.length,0);
  assert.equal(tool.operationId,pins.operationId);assert.equal(tool.toolName,'memory_remember');assert.equal(tool.ordinal,0);assert.equal(tool.state,'complete');
  assert.equal(first.calls[0].toolCallId,tool.toolCallId);assert.equal(first.calls[0].inputCanonical,tool.requestCanonical);
  assert.equal(await semanticHash(tool.requestCanonical),pins.expectedRequestHash);assert.ok(tool.approvalActor);
  currentAuthority(rows,execution.reference,['read','write','run','tool'],[{type:'run',id:run.runId},{type:'conversation',id:run.conversationId}]);
  currentAuthority(rows,tool.approvalActor,['admin'],[{type:'run',id:run.runId},{type:'conversation',id:run.conversationId}]);
  const definitionRow=one(rows.runtimeAgentDefinitions.filter(row=>sameScope(row,run)&&row.agentId===run.agentId&&row.version===run.agentVersion),'definition');
  assert.equal(definitionRow.revokedAt,undefined);assert.equal(definitionRow.definitionHash,run.definitionHash);assert.equal(await semanticHash(definitionRow.definitionCanonical),run.definitionHash);
  const definition=JSON.parse(definitionRow.definitionCanonical);assert.equal(definition.context.memoryMode,'indexed-plus-pending');
  assert.equal(one(definition.tools.filter(row=>row.toolId==='memory.remember'),'definition tool').approval,'explicit');
  const workflow=one(workflows.filter(row=>row._id===execution.workflowId),'continuation workflow');assert.equal(workflow.runResult?.kind,'success');
  const journal=steps.filter(row=>row.workflowId===execution.workflowId);
  assert.equal(journal.filter(row=>row.step.functionType==='query'&&row.step.name==='runtimeAgent:completedModelStep').length,1,'Persisted model0 journal read');
  assert.equal(journal.filter(row=>row.step.functionType==='action'&&row.step.name==='context and model turn 0').length,0,'No ordinal0 provider replay');
  assert.equal(journal.filter(row=>row.step.functionType==='action'&&row.step.name==='context and model turn 1').length,1);
  const output=rows.runtimeAgentOutput.filter(row=>row.runId===run.runId&&row.attemptNumber===run.attemptNumber).map(row=>JSON.parse(row.partCanonical));
  for(const status of ['requested','approved','running','succeeded'])assert.equal(output.filter(part=>part.type==='tool'&&part.toolCallId===tool.toolCallId&&part.name==='memory_remember'&&part.phase===status).length,1,'Exact tool phase: '+status);
  const ingestion=one(rows.runtimeAgentIngestion.filter(row=>sameScope(row,run)&&row.runId===run.runId),'final ingestion');
  assert.equal(ingestion.receiptId,execution.ingestionReceiptId);assert.deepEqual(ingestion.outputMessageIds,run.outputMessageIds);
  assert.deepEqual(execution.finalMessageIds,run.outputMessageIds);assert.deepEqual(final.savedMessageIds,run.outputMessageIds);assert.equal(run.outputMessageIds.length,1);
  assert.equal(ingestion.identityCanonical,canonicalModelJson([run.runId,run.attemptNumber,run.outputMessageIds]));
  const result=JSON.parse(tool.resultCanonical);assert.ok(typeof result.sourceId==='string'&&typeof result.receiptId==='string');
  const expected={...explicitSourceLineage({tenantId:run.tenantId,memorySpaceId:run.memorySpaceId,principalId:execution.reference.principalId},tool.operationId),role:'tool',trust:'verified_tool_evidence',operationId:tool.operationId};
  const toolSources=rows.runtimeMemorySources.filter(row=>sameScope(row,run)&&row.lineage?.operationId===tool.operationId);assert.equal(toolSources.length,1);
  const source=strip(toolSources[0]);assert.deepEqual(source.lineage,expected);assert.equal(source.lineage.sourceId,result.sourceId);assert.equal(source.tombstonedAt,undefined);
  const request=JSON.parse(tool.requestCanonical);assert.equal(source.content,request.text.normalize('NFC').replace(/\r\n?/g,'\n').trim());assert.equal(await semanticHash(source.content),source.contentHash);
  assert.equal(source.ownerPrincipalId,execution.reference.principalId);
  const toolEvent=one(rows.runtimeIngestionEvents.filter(row=>sameScope(row,run)&&row.toolOperationId===tool.operationId),'tool event');
  assert.equal(toolEvent.runId,run.runId);assert.equal(toolEvent.eligibility,'eligible');assert.equal(toolEvent.factsState,'complete');assert.equal(toolEvent.vectorsState,'complete');
  assert.equal(toolEvent.contentHash,source.contentHash);assert.deepEqual(toolEvent.lineage,source.lineage);assert.equal(toolEvent.ownerPrincipalId,source.ownerPrincipalId);
  currentAuthority(rows,toolEvent.authorityReference,['read','write'],[{type:'source',id:source.lineage.sourceId}]);
  assertSupportedEmbeddingProfile(toolEvent.profile);
  const receipt=one(rows.runtimeMemoryReceipts.filter(row=>sameScope(row,run)&&row.receiptId===result.receiptId),'tool receipt');const payload=JSON.parse(receipt.canonicalPayload);
  assert.ok(sameLineage(receipt.identity,source.lineage)&&sameLineage(payload.source,source.lineage));assert.equal(receipt.identity.stage,'facts');assert.equal(receipt.canonicalIdentity,canonicalModelJson(receipt.identity));assert.equal(receipt.canonicalPayload,canonicalModelJson(payload));
  const prepared=await prepareSourceContent(toolEvent.authorityReference,source.lineage,source.content,{now:()=>source.createdAt},toolEvent.profile);
  const chunks=rows.runtimeMemoryChunks.filter(row=>sameScope(row,run)&&sameLineage(row,source.lineage));assert.equal(chunks.length,prepared.chunks.length);assert.ok(chunks.length>0);
  for(const chunk of chunks)assert.ok(prepared.chunks.some(expected=>same(strip(chunk),expected)));
  const vectors=rows.runtimeMemoryVectors.filter(row=>sameScope(row,run)&&sameLineage(row,source.lineage));assert.equal(vectors.length,chunks.length);assert.equal(payload.vectors.length,vectors.length);
  for(const vector of vectors){const values=vector.profile.dimensions===3072?vector.embeddingLarge:vector.embedding;assertEmbeddingVector(values,vector.profile);assert.ok(values.some(value=>value!==0));
    assert.ok(same(vector.profile,toolEvent.profile));assert.equal(vector.ownerPrincipalId,source.ownerPrincipalId);assert.equal(vector.profileId,toolEvent.profile.profileId);assert.equal(vector.processingReceiptId,receipt.receiptId);
    assert.equal(vector.scopeProfileKey,vectorScopeKey(run.tenantId,run.memorySpaceId,toolEvent.profile.profileId));assert.equal(vector.scopeProfileOwnerKey,vectorOwnerScopeKey(run.tenantId,run.memorySpaceId,toolEvent.profile.profileId,source.ownerPrincipalId));
    const stored=strip(vector),{embeddingLarge,profileId,scopeProfileKey,ownerPrincipalId,scopeProfileOwnerKey,...logical}=stored;
    assert.ok(payload.vectors.some(native=>same(native,{...logical,embedding:values})));}
  const generation=one(rows.runtimeMemoryVectorGenerations.filter(row=>sameScope(row,run)&&sameLineage(row,source.lineage)&&same(row.profile,toolEvent.profile)),'generation');
  assert.equal(generation.contentHash,source.contentHash);assert.equal(generation.receiptId,receipt.receiptId);assert.equal(generation.ownerPrincipalId,source.ownerPrincipalId);
  const facts=rows.facts.filter(row=>sameScope(row,run)&&sameLineage(row.lineage,source.lineage));assert.equal(facts.length,payload.facts.length);
  for(const fact of facts){assert.equal(fact.tombstonedAt,undefined);assert.equal(fact.processingReceiptId,receipt.receiptId);assert.equal(fact.ownerPrincipalId,source.ownerPrincipalId);assert.deepEqual(fact.lineage,source.lineage);
    const {_id,_creationTime,processingReceiptId,...fields}=fact;assert.ok(payload.facts.some(({_id,...expected})=>same(expected,fields)));}
  const modelOps=rows.runtimeModelOperations.filter(row=>row.runAccountId===run.runAccountId),attempts=rows.runtimeModelAttempts.filter(row=>row.runAccountId===run.runAccountId);
  const account=one(rows.runtimeBudgetAccounts.filter(row=>row._id===run.runAccountId),'run account');assert.equal(account.current,true);assert.equal(account.cancelled,false);
  assert.equal(account.activeConcurrency,0);assert.equal(account.reservedUnits,0);assert.ok(same(account.reference,execution.reference));
  const nativeChecks=[];
  for(const op of modelOps){assert.equal(op.cancelled,false);assert.equal(op.overrun,false);assert.ok(same(op.reference,execution.reference));const attempt=one(attempts.filter(row=>row.operationDocumentId===op._id),'one native attempt per operation');
    const snapshot=JSON.parse(attempt.snapshotCanonical),terminal=JSON.parse(attempt.terminalEvidenceCanonical),input=JSON.parse(attempt.inputProofCanonical);
    assert.equal(attempt.slotReleased,true);assert.equal(attempt.resultAttachmentState,'attached');assert.equal(attempt.resultWithheld,false);assert.equal(terminal.outcome,'confirmed');
    assert.equal(terminal.nativeInterface,snapshot.nativeInterface);assert.equal(terminal.dispatchIdentity,attempt.dispatchIdentity);assert.ok(completeNativeTokenUsage(snapshot.nativeInterface,terminal.usage,attempt));
    const qualification=one(rows.runtimeModelQualifications.filter(row=>row.receiptId===snapshot.qualificationReceiptId&&row.version===account.root.revision),'qualification');assert.equal(qualification.active,true);assert.equal(qualification.revokedAt,undefined);
    assert.equal(input.proof.receiptId,snapshot.qualificationReceiptId);assert.ok(input.proof.expiresAt>Date.now());assert.equal(input.proof.nativeInterface,snapshot.nativeInterface);
    if(op.source?.sourceId===source.lineage.sourceId){assert.ok(sameLineage(op.source,source.lineage));assert.equal(op.source.contentHash,source.contentHash);assert.equal(op.parentOperationId,model0.nativeModelOperationId);}
    nativeChecks.push({operationKey:op.operationKey,operationHash:hash(op._id),nativeInterface:snapshot.nativeInterface,usageComplete:true,slotReleased:true,terminalConfirmed:true,attached:true,
      inputTokens:number(terminal.usage.inputTokens),outputTokens:number(terminal.usage.outputTokens),totalTokens:number(terminal.usage.totalTokens)});
  }
  for(const model of [model0,model1]){const native=one(modelOps.filter(op=>op._id===model.nativeModelOperationId),'model native');assert.equal(native.operationKey,'agent.respond');}
  const embeddings=modelOps.filter(op=>op.operationKey==='embedding.memory'&&op.source?.sourceId===source.lineage.sourceId);assert.equal(embeddings.length,1);
  const embeddingAttempt=one(attempts.filter(row=>row.operationDocumentId===embeddings[0]._id),'native vector');const retained=JSON.parse(embeddingAttempt.privateResultCanonical);
  for(const vector of vectors)assert.ok(retained.vectors.some(value=>same(value,vector.profile.dimensions===3072?vector.embeddingLarge:vector.embedding)));
  const sourceStages=rows.runtimeIngestionStages.filter(stage=>sameScope(stage,run)&&stage.eventId===toolEvent.eventId);assert.equal(sourceStages.length,3);
  assert.ok(sourceStages.every(stage=>stage.state===(stage.stage==='extract'?'skipped':'complete')&&stage.receiptId===receipt.receiptId));
  const scope=one(rows.runtimeIngestionScopes.filter(row=>sameScope(row,run)),'readiness scope'),events=rows.runtimeIngestionEvents.filter(row=>sameScope(row,run));
  assert.ok(Number.isSafeInteger(scope.sequence)&&scope.sequence<=256);for(let sequence=1;sequence<=scope.sequence;sequence++)one(events.filter(row=>row.sequence===sequence),'contiguous event');
  assert.ok(scope.factsThrough>=scope.sequence&&(scope.vectorProfileThrough?.[toolEvent.profile.profileId]??scope.vectorsThrough)>=scope.sequence);
  for(const event of events.filter(row=>row.runId===run.runId)){assert.equal(event.eligibility,'eligible');assert.ok(['complete','skipped'].includes(event.factsState));assert.equal(event.vectorsState,'complete');
    currentAuthority(rows,event.authorityReference,['read','write'],[{type:'source',id:event.lineage.sourceId}]);}
  await exactTarget(await loadSession(PROOFS_ROOT,sessionId));await verifyCloud(session,ctx);
  return {passed:true,readOnly:true,registration:'official system queries only',rawPrivatePayloadRetained:false,existingKeyOnly:true,managementGetOnly:true,freshVerifications,tableCounts,
    target:{sessionId,name,id:Number(id),sourceCommit:K19_PINS.sourceCommit,imageId:K19_PINS.imageId},runId:run.runId,
    fixedFourProofSha256:pins.fixedFourProofSha256,executionMode:execution.executionMode,directState:execution.directState,continuationWorkflowIdSha256:hash(execution.workflowId),
    oneOrdinal0:true,oneTool:true,oneOrdinal1Final:true,approvedRequestHash:pins.expectedRequestHash,oneCanonicalIngestionReceipt:true,receiptIdSha256:hash(ingestion.receiptId),
    toolSource:{sourceIdSha256:hash(source.lineage.sourceId),contentHash:source.contentHash,receiptIdSha256:hash(receipt.receiptId),facts:facts.length,vectors:vectors.length,profileId:toolEvent.profile.profileId,currentAuthority:true,currentSource:true},
    nativeChecks,readiness:{scopeSequence:scope.sequence,factsThrough:scope.factsThrough,vectorsThrough:scope.vectorProfileThrough?.[toolEvent.profile.profileId]??scope.vectorsThrough,contiguous:true},
    limitations:['Cross-table read snapshots; no single global transaction','Observer reconnect and one human approval are separately captured root UI observations','Supplemental functional outcome, not fixed-four SLO evidence']};
}

let outcome;
try{outcome=await main();}catch(error){const text=String(error?.message??error);outcome={passed:false,readOnly:true,phase,errorSha256:hash(text),errorBytes:Buffer.byteLength(text),rawPrivatePayloadRetained:false,
  classifications:{assertion:error?.code==='ERR_ASSERTION',timeout:/deadline|timeout/i.test(text),interlock:/UNREADY|Coordinator/.test(text)},freshVerifications,tableCounts};process.exitCode=1;}
finally{await client?.close();}
outcome.clientsClosed=true;
const destination=path.join(Q,'k19-tool-supplement-verification-'+Date.now()+'.json');await fs.writeFile(destination,JSON.stringify(outcome,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt:destination,passed:outcome.passed,clientsClosed:true,phase:outcome.phase,rawPrivatePayloadRetained:false}));
