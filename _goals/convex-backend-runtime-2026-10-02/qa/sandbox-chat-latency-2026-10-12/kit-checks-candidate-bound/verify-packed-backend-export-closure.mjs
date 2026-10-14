import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion', q=path.dirname(new URL(import.meta.url).pathname);
const ts=createRequire(path.join(r,'package.json'))('typescript');
const kit='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-candidate-bound-2026-10-14';
const commit='PENDING_COMMITTED_SOURCE_GO';
assert.match(commit,/^[a-f0-9]{40}$/,'Root accepted commit GO required');
const artifact=JSON.parse(fs.readFileSync(path.join(q,'artifact-receipt.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(kit,'staging',commit,'dist/backend/v1/manifest.json')));
const archive=path.join(kit,'artifacts',commit,artifact.packages.find(p=>p.role==='sdk').filename);
const digest=b=>createHash('sha256').update(b).digest('hex');
function exportsOf(text,name) {
 const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS); const names=[];
 for(const statement of ast.statements) {
  if(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause)){for(const entry of statement.exportClause.elements)names.push(entry.name.text);continue;}
  if(!statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)) continue;
  if(ts.isVariableStatement(statement)) for(const d of statement.declarationList.declarations) {assert(ts.isIdentifier(d.name)); names.push(d.name.text);}
  else if(statement.name && ts.isIdentifier(statement.name)) names.push(statement.name.text);
  else if(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause))for(const entry of statement.exportClause.elements)names.push(entry.name.text);
 }
 return names;
}
function declarationsOf(text,name) {
 const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const names=[]; const endpoints=[];
 for(const statement of ast.statements) {
  if(statement.name&&ts.isIdentifier(statement.name))names.push(statement.name.text);
  if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations) {
   if(!ts.isIdentifier(d.name))continue; names.push(d.name.text);
   if(d.initializer&&ts.isCallExpression(d.initializer)) {
    const called=d.initializer.expression.getText(ast);
    if(['query','mutation','action','internalQuery','internalMutation','internalAction','httpAction','workflow.define'].includes(called))endpoints.push({name:d.name.text,registeredAs:called});
   }
  }
 }
 return {ast,names,endpoints};
}
const paths=['convex-dev/runtimeGatewayBackend.ts','convex-dev/runtimeIngestionPriority.ts','convex-dev/runtimeTranscript.ts','convex-dev/runtimeAgent.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeMemoryRepository.ts','convex-dev/runtimeLatencyTrace.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeClient.ts','convex-dev/runtimeMemory.ts','convex-dev/runtimeAgentQueryEmbedding.ts','convex-dev/runtimeMemoryGateway.ts','convex-dev/runtimeMemoryServices.ts','convex-dev/runtimeGateway.ts','convex-dev/runtimeIngestion.ts','convex-dev/runtimeIngestionSchema.ts','convex-dev/runtimeBeliefs.ts','convex-dev/runtimeMemoryContext.ts','convex-dev/runtimeAgentRecall.ts','convex-dev/runs.ts','convex-dev/agentDefinitions.ts','convex-dev/runtimeAgentSchema.ts','convex-dev/runtimeTranscriptSchema.ts','convex-dev/runtimeMemorySchema.ts','convex-dev/runtimeMemoryCapture.ts','convex-dev/runtimeMemoryQuery.ts','convex-dev/runtimeMemoryRefusal.ts','src/domain/model-input-selection.ts','src/client-runtime/remember.ts','src/domain/belief-plan.ts'];
const files=paths.map(sourcePath=>{
 const row=manifest.files.find(f=>f.sourcePath===sourcePath); assert(row);
 const committed=execFileSync('git',['show',commit+':'+sourcePath],{cwd:r,maxBuffer:2*1024*1024});
 const packed=execFileSync('tar',['-xOf',archive,'package/dist/backend/v1/'+row.path],{maxBuffer:2*1024*1024});
 assert.equal(digest(committed),row.sourceSha256); assert.equal(digest(packed),row.sha256);
 const names=exportsOf(packed.toString(),row.path); assert.deepEqual(names,exportsOf(committed.toString(),sourcePath));
 const current=declarationsOf(committed.toString(),sourcePath),packedDeclarations=declarationsOf(packed.toString(),row.path);
 assert.deepEqual(packedDeclarations.endpoints,current.endpoints);
 const additions={
  'convex-dev/runtimeModelPolicy.ts':[['captureTerminalEvidenceV8','internalMutation'],['attachTerminalResultV8','internalMutation']],
  'convex-dev/runtimeIngestionPriority.ts':[['expireForeground','internalMutation']],
  'convex-dev/runtimeAgent.ts':[['admitPreparedModelOperationV8','internalMutation'],['contextInputsV8','internalQuery'],['contextInputsAndEmbeddingV8','internalQuery'],['saveContextV8','internalMutation'],['saveAndPrepareContextV8','internalMutation'],['prepareResolvedModelCandidateV8','internalMutation'],['turnStepV8','internalAction'],['prepareTurnModelV8','internalMutation'],['prepareDirectTurnV8','internalMutation'],['attachDirectContinuationV8','internalMutation'],['interruptDirectV8','internalMutation'],['executeDirectV8','internalAction'],['retireDirectV8','internalMutation'],['executeToolsV8','workflow.define'],['executeTurnV8','workflow.define']],
  'convex-dev/runs.ts':[['claimNextV8','internalMutation']],
  'convex-dev/runtimeMemoryCapture.ts':[['rememberExchange','mutation'],['rememberStatus','mutation'],['setCaptureLock','mutation']],
  'convex-dev/runtimeAgentQueryEmbedding.ts':[['prepareV8','internalQuery'],['admitV8','internalMutation']],
  'convex-dev/runtimeAgentRecall.ts':[['prepareReadsV8','internalQuery'],['readMatchesV8','internalQuery'],['finalDeliveryV8','internalMutation'],['readMatchesAndDeliveryV8','internalMutation']],
  'convex-dev/runtimeMemoryQuery.ts':[['prepare','internalQuery'],['admit','internalMutation']],
  'convex-dev/runtimeIngestion.ts':[['waitForCapacity','internalMutation']],
  'convex-dev/runtimeBeliefs.ts':[['replan','internalMutation']],
 };
 const expectedAdditions=(additions[sourcePath]??[]).map(([name,registeredAs])=>({name,registeredAs}));
 const namesOfAdditions=expectedAdditions.map(e=>e.name);
 const newFiles=['convex-dev/runtimeIngestionPriority.ts','convex-dev/runtimeMemoryCapture.ts','convex-dev/runtimeMemoryQuery.ts','convex-dev/runtimeMemoryRefusal.ts','src/domain/model-input-selection.ts','src/client-runtime/remember.ts'];
 if(!newFiles.includes(sourcePath)){
  const historical=execFileSync('git',['show','53421e78165fb12a16a11faa19db9372fa8ddfd4:'+sourcePath],{cwd:r,maxBuffer:2*1024*1024});
  assert.deepEqual(current.endpoints.filter(e=>!namesOfAdditions.includes(e.name)),declarationsOf(historical.toString(),sourcePath).endpoints);
  for(const name of exportsOf(historical.toString(),sourcePath))assert(names.includes(name),`Historical export missing: ${sourcePath}:${name}`);
 }
 assert.deepEqual(current.endpoints.filter(e=>namesOfAdditions.includes(e.name)),expectedAdditions);
 if(sourcePath==='convex-dev/runtimeAgent.ts')for(const [name]of additions[sourcePath])assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeIngestionPriority.ts')for(const name of ['holdForegroundIngestion','releaseForegroundIngestion','promoteForegroundIngestion','deferForegroundStage','FOREGROUND_INGESTION_MAX_DELAY_MS','FOREGROUND_INGESTION_MAX_HELD_RUNS','expireForeground'])assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeGatewayBackend.ts')assert(names.includes('withV8GatewayTerminalPorts'));
 if(sourcePath==='convex-dev/agentDefinitions.ts')for(const name of ['EXECUTABLE_REGISTRY','EXECUTABLE_REGISTRY_V2','EXECUTABLE_REGISTRY_V3','executableRegistryHashV3'])assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeMemoryCapture.ts')for(const text of ['saveMessages','registerMessages','projection','rememberExchangeHandler'])assert(packed.toString().includes(text),text);
 if(sourcePath==='convex-dev/runtimeMemoryQuery.ts')for(const name of ['preparePublicRecallHandler','admitPublicRecallHandler','recallPublicMemory'])assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeMemoryRefusal.ts')for(const name of ['Refusal','boundedRefusal','throwRefusal'])assert(names.includes(name),name);
 if(sourcePath==='src/domain/model-input-selection.ts')for(const name of ['MODEL_INPUT_SELECTION_V1','fitModelInput','fitModelInputAsync','relevantRecallItems','assertCompleteToolGroups'])assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeIngestion.ts')for(const text of ['assertUnreservedIngestionCapacity','capacityWait','runtimeBeliefs:replan','identicalBelief'])assert(packed.toString().includes(text),text);
 if(sourcePath==='convex-dev/runtimeBeliefs.ts')for(const text of ['commitBeliefPlan','REPLAN_REQUIRED','identicalBelief'])assert(packed.toString().includes(text),text);
 if(sourcePath==='convex-dev/runtimeIngestionSchema.ts')assert(packed.toString().includes('runtimeRunMemoryProgress: defineTable'));
 if(sourcePath==='convex-dev/runtimeAgent.ts'){assert(packedDeclarations.names.includes('contextSourceBatchHandler'));assert(packed.toString().includes('items.length > 100')&&packed.toString().includes('priorWitnesses.length > 100')&&packed.toString().includes('witnesses.length > 200'));}
 if(sourcePath==='convex-dev/runtimeAgentQueryEmbedding.ts'){assert(names.includes('recallAgentMemory'));assert(packed.toString().includes('ctx.runMutation(checkpointRef'));assert(packed.toString().includes('finishRecallFromEmbedding'));}
 if(sourcePath==='convex-dev/runtimeLatencyTrace.ts') { assert(names.includes('traceRuntimeMutationSpan'));assert(packed.toString().includes('typeof process === "undefined"')&&packed.toString().includes('performance.now()')&&packed.toString().includes('Number.isFinite(durationMs)')); }
 if(sourcePath==='convex-dev/runtimeAgent.ts') {assert(packed.toString().includes('executionContext(createAuthorityReadScope(ctx, { nativeTranscript: true }), args)')); assert(packed.toString().includes('handler: async (nativeCtx, args)'));assert(packed.toString().includes('"start.claimNext"')&&packed.toString().includes('"start.workflow"'));}
 if(sourcePath==='convex-dev/runtimeModelPolicy.ts') {assert(packed.toString().includes('const ctx = createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true });'));}
 if(sourcePath==='convex-dev/runtimeClient.ts') for(const phase of ['admission.submit','admission.start','admission.get'])assert(packed.toString().includes(phase));
 if(sourcePath==='convex-dev/runtimeAuth.ts') {
  for(const name of ['readNativeTranscriptMessages','freshNativeTranscriptReads','NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES','NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES'])assert(names.includes(name),name);
  assert(packedDeclarations.names.includes('createNativeTranscriptReader'));
  for(const [name,value] of [['NATIVE_TRANSCRIPT_READ_SCOPE_MAX_ENTRIES',16],['NATIVE_TRANSCRIPT_READ_SCOPE_MAX_BYTES',250000]]) {
   let initializer;
   for(const statement of packedDeclarations.ast.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(d.name.getText()===name)initializer=d.initializer;
   assert(initializer&&ts.isNumericLiteral(initializer));assert.equal(Number(initializer.text),value);
  }
 }
 if(sourcePath==='convex-dev/runtimeAuth.ts') for(const name of ['createAuthorityReadScope','createV8AuthorityReadScope','readDeploymentPolicyRows','readQualificationRows','freshPolicyMetadataReads']) assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeAgent.ts') for(const name of ['executeTurn','executeTurnV2','executeTurnV3','executeTurnV4','prepareRoutedContext','prepareEmptyContext','contextSource','contextSourceBatch','resolveModelOperation','admitModelOperation','onInitialWorkflowComplete','executeTurnV5','prepareTurnModel','prepareResolvedModelOperation','admitPreparedModelOperation','turnStepV5','turnStepV5Handler','prepareDirectTurn','attachDirectContinuation','interruptDirect','executeDirectV6','retireDirectV6','executeToolsV6','prepareResolvedModelCandidate','saveAndPrepareContext','turnStepV7','executeToolsV7']) assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeAgentRecall.ts') {for(const name of ['prepareReads','prepareReadsHandler','readMatches','readMatchesHandler','finishAgentRecall']) assert(names.includes(name),name);for(const text of ['contextSourceBatchHandler','captureRecallFact','captureRecallVectors','completeRecallDelivery','memoryReferences.finalDelivery']) assert(packed.toString().includes(text),text);}
 if(sourcePath==='convex-dev/runtimeGateway.ts') {assert(names.includes('preflightAgentModelRequest'));for(const text of ['traceModelBounds(binding, s, request, stage)','validateModelRequest(s, request)','gateway.model.bounds']) assert(packed.toString().includes(text),text);}
 if(sourcePath==='convex-dev/runtimeIngestionSchema.ts') assert(packed.toString().includes('runtimeIngestionSequenceHeads: defineTable')&&packed.toString().includes('by_owner_sequence'));
 return {sourcePath,outputPath:row.path,sourceSha256:row.sourceSha256,packedOutputSha256:row.sha256,exportNames:names,exactCommittedExportsPreserved:true,registeredEndpoints:current.endpoints,registeredEndpointDelta:expectedAdditions};
});
const receipt={sourceCommit:commit,files,rawAuthorityFactoryExportPresent:true,allHistoricalAndNewAgentParentsPresent:true,actualV5ParentAndTurnExportsPresent:true,actualFreshSdkArchive:true,actualTranscriptReaderExportsAndPrivateFactoryPresent:true,transcriptReaderBounds:{entries:16,bytes:250000},registeredEndpointAdditions:'Original bounded-repair additions, private V8 terminal scopes, foreground expiry and two ordered private V8 read parents; every53421 historical endpoint/export preserved',serviceCalls:0};
fs.writeFileSync(path.join(q,'packed-backend-export-closure.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({sourceCommit:commit,checkedChangedBackendRoots:files.length,allExportsPreserved:true}));
