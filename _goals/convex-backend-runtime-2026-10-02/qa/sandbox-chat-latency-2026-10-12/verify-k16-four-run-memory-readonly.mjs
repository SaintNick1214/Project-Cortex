import {K16_PINS,requireK16ReadyPins} from './k16-collector-pins.mjs';
requireK16ReadyPins();
/** Parameterized K16, bounded official system queries only after coordinator-reported EOF.
 * Raw sources/prompts/results/vectors/errors stay private in memory only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {completeNativeTokenUsage} from './verify-k6-native-usage.mjs';
import {loadSession, createContext, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud, getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
import {parseSourceFactsResponse, prepareSourceContent, processingIdentityKey} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/sources.ts';
import {assertEmbeddingVector, assertSupportedEmbeddingProfile, normalizeSourceText, semanticHash} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile.ts';
import {canonicalModelJson, MEMORY_JSON_OBJECT_CONTRACT} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy.ts';
import {parseConflictDecision} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/conflicts.ts';
import {buildSourceExtractionFramingV4} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryGateway.ts';
import {canonicalMemoryValue, vectorScopeKey, vectorOwnerScopeKey} from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryRepository.ts';

const Q=path.dirname(fileURLToPath(import.meta.url));
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const fixed=(value,values)=>values.includes(value)?value:undefined;
const num=value=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
const states=['pending','running','complete','failed','unknown','dead_letter','skipped','reserved','dispatch_pending','settled','not_dispatched','confirmed_rejected','uncertain','cancelled'];
const strip=row=>{const {_id,_creationTime,...value}=row;return value;};
const same=(a,b)=>canonicalMemoryValue(a)===canonicalMemoryValue(b);
const sameRef=(row,source)=>row?.sourceId===source.lineage.sourceId&&row?.sourceEventId===source.lineage.sourceEventId&&row?.sourceRevision===source.lineage.sourceRevision;
const sameScope=(row,event)=>row?.tenantId===event.tenantId&&row?.memorySpaceId===event.memorySpaceId;
const one=(rows)=>{assert.equal(rows.length,1,'Exact owned row count mismatch');return rows[0];};
const errorSummary=error=>{const text=String(error?.message??error);return {sha256:hash(text),bytes:Buffer.byteLength(text),
  classifications:{assertion:/assert|mismatch|required|overflow/i.test(text),json:/JSON|Unexpected token/i.test(text),
    domain:/INVALID_INPUT|POLICY_DENIED|STALE_SOURCE/.test(text),timeout:/timeout|deadline/i.test(text),forbidden:/FORBIDDEN/i.test(text)}};};
const encoded=value=>({present:typeof value==='string',...(typeof value==='string'?{bytes:Buffer.byteLength(value),sha256:hash(value)}:{})});
const check=(invoke)=>{try{invoke();return {valid:true};}catch(error){return {valid:false,error:errorSummary(error)};}};
const selectNumbers=(row,names)=>Object.fromEntries(names.filter(key=>num(row?.[key])!==undefined).map(key=>[key,row[key]]));

let client;
const waiting=new Map();
async function main(){
  // This is a deliberate quiet-window interlock, not standalone authorization.
  assert.equal(process.env.CORTEX_K16_MEMORY_TURN_COMPLETE_CONFIRMED,'1','Coordinator actual turn-complete confirmation required');
  assert.equal(process.argv.length,9,'Usage: SESSION NAME ID BROWSER_FIRST BROWSER_WARM CLI_FIRST CLI_WARM');
  const [sessionId,expectedName,idText,...runIds]=process.argv.slice(2),expectedId=Number(idText);
  assert.match(sessionId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.match(expectedName,/^[a-z0-9]+(?:-[a-z0-9]+)+$/);assert.ok(Number.isSafeInteger(expectedId)&&expectedId>0);
  for(const runId of runIds)assert.match(runId,/^run:[a-f0-9]{64}$/);
  assert.equal(new Set(runIds).size,runIds.length,'Distinct owned run IDs required');
  const labels=['browser-first','browser-warm','cli-first','cli-warm'];
  const identities=runIds.map((runId,index)=>({label:labels[index],runId}));
  assert.equal(runIds[0],K16_PINS.runIds[0]);
  assert.equal(runIds[1],K16_PINS.runIds[1]);
  assert.equal(runIds[2],K16_PINS.runIds[2]);
  assert.equal(runIds[3],K16_PINS.runIds[3]);
  assert.equal(sessionId,K16_PINS.sessionId);
  const session=await loadSession(PROOFS_ROOT,sessionId);
  const targetCheck=value=>{assert.equal(value.phase,'READY');assert.equal(value.target.name,expectedName);assert.equal(value.target.id,expectedId);
    assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);assert.equal(value.target.reference,'dev/cortex-sandbox-'+sessionId);
    assert.equal(value.target.isDefault,false);assert.equal(value.target.name,K16_PINS.name);assert.equal(value.target.id,K16_PINS.targetId);
    assert.equal(value.target.expiresAt,K16_PINS.expiresAt);assert.ok(value.target.expiresAt>Date.now());
    assert.equal(value.container.imageId,K16_PINS.imageId);};
  targetCheck(session);
  const preparedHost=JSON.parse(await fs.readFile(path.join(session.receiptDir,'host-prepared.json'),'utf8'));assert.equal(preparedHost.sourceCommit,K16_PINS.sourceCommit);
  const ctx=await createContext(session,{logger:()=>{}});let freshVerifications=0;
  ctx.persist=async()=>{};ctx.receipt=async name=>{if(name.startsWith('cloud-verified-'))freshVerifications++;};
  const nativeFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET','Read-only management GET required');return nativeFetch(url,options);};
  await verifyCloud(session,ctx);
  const keyStat=await fs.lstat(session.deploymentKeyPath);assert.ok(keyStat.isFile()&&!keyStat.isSymbolicLink()&&keyStat.uid===process.getuid()&&(keyStat.mode&0o077)===0);
  const key=await getDeployKey(session,ctx);
  const requireHost=createRequire(path.join(session.backendDir,'package.json'));
  const {BaseConvexClient}=requireHost('convex/browser');
  client=new BaseConvexClient(session.target.deploymentUrl,tokens=>{
    for(const token of tokens){const waiter=waiting.get(token);if(!waiter)continue;
      try{waiter.resolve(client.localQueryResultByToken(token));}catch(error){waiter.reject(error);}}
  },{logger:false,unsavedChangesWarning:false,webSocketConstructor:WebSocket});client.setAdminAuth(key);
  const tableCounts={};
  const table=async name=>{
    targetCheck(await loadSession(PROOFS_ROOT,sessionId));await verifyCloud(session,ctx);
    const page=await new Promise((resolve,reject)=>{
      const subscription=client.subscribe('_system/cli/tableData',{table:name,order:'desc',paginationOpts:{cursor:null,numItems:256}},{componentPath:''});
      const timer=setTimeout(()=>{waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(Error('Bounded system query timeout'));},30000);
      waiting.set(subscription.queryToken,{resolve:value=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();resolve(value);},
        reject:error=>{clearTimeout(timer);waiting.delete(subscription.queryToken);subscription.unsubscribe();reject(error);}});
    });
    assert.ok(Array.isArray(page.page),'System table page required');assert.equal(page.isDone,true,'Bounded table scan overflow');tableCounts[name]=page.page.length;targetCheck(await loadSession(PROOFS_ROOT,sessionId));await verifyCloud(session,ctx);return page.page;
  };
  const rows={};
  for(const name of ['runtimeRuns','runtimeIngestionEvents','runtimeIngestionStages','runtimeIngestionJobs','runtimeMemorySources',
    'runtimeMemoryChunks','runtimeMemoryVectors','runtimeMemoryVectorGenerations','runtimeMemoryReceipts','facts','runtimeModelOperations',
    'runtimeModelAttempts','runtimeBudgetAccounts','runtimeTranscriptMessages','runtimeIngestionScopes','runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthGrants','runtimeAuthScopes','runtimeAuthTombstones'])rows[name]=await table(name);
  const summaries=[];
  for(const identity of identities){
    const run=one(rows.runtimeRuns.filter(row=>row.runId===identity.runId));
    const eventSummaries=[];
    assert.equal(run.tombstonedAt,undefined,'Run must be current');
    const linked=[];
    for(const [role,ids]of [['user',run.inputMessageIds],['assistant',run.outputMessageIds]]){
      assert.ok(Array.isArray(ids)&&ids.length===1,'One canonical input/final message required');
      const bridge=one(rows.runtimeTranscriptMessages.filter(row=>sameScope(row,run)&&row.runId===run.runId&&row.conversationId===run.conversationId&&row.nativeMessageId===ids[0]));
      assert.equal(bridge.role,role);assert.equal(bridge.approved,true);assert.equal(bridge.tombstonedAt,undefined);
      const event=one(rows.runtimeIngestionEvents.filter(row=>sameScope(row,run)&&row.runId===run.runId&&row.conversationId===run.conversationId
        &&row.lineage.sourceId===bridge.sourceId&&row.lineage.sourceEventId===bridge.sourceEventId&&row.lineage.sourceRevision===bridge.revision));
      assert.equal(event.contentHash,bridge.sourceContentHash,'Canonical bridge/event hash mismatch');
      linked.push({role,eventId:event.eventId,bridge});
    }
    for(const {role,eventId,bridge}of linked){
      const event=one(rows.runtimeIngestionEvents.filter(row=>row.eventId===eventId&&row.runId===identity.runId));
      const sourceRow=one(rows.runtimeMemorySources.filter(row=>sameScope(row,event)&&sameRef(row.lineage,{lineage:event.lineage})));
      const source=strip(sourceRow), stages=rows.runtimeIngestionStages.filter(row=>row.eventId===eventId&&sameScope(row,event));
      const job=one(rows.runtimeIngestionJobs.filter(row=>row.eventId===eventId&&sameScope(row,event)));
      const account=one(rows.runtimeBudgetAccounts.filter(row=>row._id===job.runAccountId));
      const operations=rows.runtimeModelOperations.filter(row=>row.runAccountId===job.runAccountId);
      const attempts=rows.runtimeModelAttempts.filter(row=>row.runAccountId===job.runAccountId);
      assertSupportedEmbeddingProfile(event.profile);
      const prepared=await prepareSourceContent(event.authorityReference,source.lineage,source.content,{now:()=>source.createdAt},event.profile);
      const sourceChecks={roleMatches:source.lineage.role===role,trustMatches:source.lineage.trust===(role==='user'?'user_assertion':'assistant_claim'),
        normalized:normalizeSourceText(source.content)===source.content,currentHashMatches:await semanticHash(source.content)===source.contentHash,
        eventHashMatches:event.contentHash===source.contentHash,eventLineageMatches:same(source.lineage,event.lineage),
        preparedIdentityMatches:prepared.source.contentHash===source.contentHash&&same(prepared.source.lineage,source.lineage),
        ownerMatches:source.ownerPrincipalId===event.ownerPrincipalId&&source.ownerPrincipalId===event.authorityReference.principalId,
        canonicalRunBridge:source.lineage.sourceId===bridge.sourceId&&source.lineage.sourceEventId===bridge.sourceEventId&&source.lineage.sourceRevision===bridge.revision&&source.contentHash===bridge.sourceContentHash,
        scopeMatches:sameScope(source,event)&&sameScope(event.authorityReference,event),notTombstoned:source.tombstonedAt===undefined};
      const principal=one(rows.runtimeAuthPrincipals.filter(row=>row._id===event.authorityReference.principalId));
      const membership=one(rows.runtimeAuthMemberships.filter(row=>row._id===event.authorityReference.membershipId));
      const grant=one(rows.runtimeAuthGrants.filter(row=>row._id===event.authorityReference.grantId));
      const tenant=one(rows.runtimeAuthScopes.filter(row=>row.tenantId===event.tenantId&&row.memorySpaceId===undefined));
      const space=one(rows.runtimeAuthScopes.filter(row=>sameScope(row,event)));
      const authorityChecks={principalCurrent:principal.version===event.authorityReference.principalVersion&&principal.revokedAt===undefined&&principal.deletedAt===undefined,
        membershipCurrent:membership.version===event.authorityReference.membershipVersion&&membership.principalId===principal._id&&membership.tenantId===event.tenantId&&membership.revokedAt===undefined&&membership.deletedAt===undefined,
        grantCurrent:grant.version===event.authorityReference.grantVersion&&grant.principalId===principal._id&&grant.membershipId===membership._id&&grant.revokedAt===undefined&&grant.deletedAt===undefined&&(grant.expiresAt===undefined||grant.expiresAt>Date.now()),
        scopeEpochCurrent:tenant.epoch===event.authorityReference.tenantEpoch&&space.epoch===event.authorityReference.memorySpaceEpoch&&tenant.deletedAt===undefined&&space.deletedAt===undefined,
        readWriteCapabilities:Array.isArray(grant.capabilities)&&grant.capabilities.includes('read')&&grant.capabilities.includes('write'),
        noSourceOrScopeTombstone:!rows.runtimeAuthTombstones.some(row=>row.tenantId===event.tenantId&&[
          row.resourceType==='tenant'&&row.resourceId===event.tenantId,
          row.resourceType==='memorySpace'&&row.memorySpaceId===event.memorySpaceId&&row.resourceId===event.memorySpaceId,
          row.resourceType==='source'&&row.resourceId===source.lineage.sourceId&&(row.memorySpaceId===undefined||row.memorySpaceId===event.memorySpaceId)
        ].some(Boolean))};
      const sourceChunks=rows.runtimeMemoryChunks.filter(row=>sameScope(row,event)&&sameRef(row,source));
      const sourceVectors=rows.runtimeMemoryVectors.filter(row=>sameScope(row,event)&&sameRef(row,source));
      const sourceReceipts=rows.runtimeMemoryReceipts.filter(row=>sameScope(row,event)&&sameRef(row.identity,source));
      const sourceFacts=rows.facts.filter(row=>sameScope(row,event)&&sameRef(row.lineage,source));
      const expectedIdentity={...source.lineage,stage:'vectors',semanticPolicyVersion:event.profile.profileId};
      const vectorIdentity={sourceId:expectedIdentity.sourceId,sourceEventId:expectedIdentity.sourceEventId,sourceRevision:expectedIdentity.sourceRevision,
        stage:'vectors',semanticPolicyVersion:event.profile.profileId};
      const vectorReceiptId=await processingIdentityKey(vectorIdentity);
      const vectorReceipts=sourceReceipts.filter(row=>row.receiptId===vectorReceiptId);assert.ok(vectorReceipts.length<2,'Duplicate vector receipt');
      const vectorReceipt=vectorReceipts[0], receiptPayload=vectorReceipt?JSON.parse(vectorReceipt.canonicalPayload):undefined;
      const receiptChecks={present:!!vectorReceipt,identityMatches:!!vectorReceipt&&same(vectorReceipt.identity,vectorIdentity),canonicalIdentityMatches:vectorReceipt?.canonicalIdentity===canonicalMemoryValue(vectorIdentity),
        canonicalPayloadMatches:!!vectorReceipt&&vectorReceipt.canonicalPayload===canonicalMemoryValue(receiptPayload),sourceMatches:sameRef(receiptPayload?.source,source),
        chunkCountMatches:receiptPayload?.chunks?.length===prepared.chunks.length,vectorCountMatches:!!receiptPayload&&receiptPayload.vectors?.length===sourceVectors.length,
        embeddingBudgetMatches:receiptPayload?.embeddingRunBudgetId===job.runBudgetId};
      const chunkSummaries=[];
      for(const chunk of sourceChunks){const expected=prepared.chunks.find(value=>value.chunkId===chunk.chunkId);chunkSummaries.push({
        chunkIdSha256:hash(chunk.chunkId),ordinal:num(chunk.ordinal),start:num(chunk.start),end:num(chunk.end),textBytes:Buffer.byteLength(chunk.text),textSha256:hash(chunk.text),
        checks:{expectedWindowMatches:!!expected&&same(strip(chunk),expected),textHashMatches:await semanticHash(chunk.text)===chunk.textHash,
          receiptWindowMatches:!!receiptPayload?.chunks?.some(value=>same(value,strip(chunk)))}});}
      const attemptSummaries=[];
      for(const attempt of attempts){
        const operation=one(operations.filter(row=>row._id===attempt.operationDocumentId)), snapshot=JSON.parse(attempt.snapshotCanonical), admitted=JSON.parse(attempt.canonical);
        const terminal=typeof attempt.terminalEvidenceCanonical==='string'?JSON.parse(attempt.terminalEvidenceCanonical):undefined;
        const retained=typeof attempt.privateResultCanonical==='string'?JSON.parse(attempt.privateResultCanonical):undefined;
        const summary={operationKey:fixed(operation.operationKey,['memory.extract','facts.resolve','embedding.memory']),operationDocumentIdSha256:hash(operation._id),
          state:fixed(attempt.state,states),...selectNumbers(attempt,['attemptNumber','ordinal','createdAt','checkpointAt','reservationUnits','settledCostUnits','measuredInputTokens','maximumOutputTokens']),
          slotReleased:attempt.slotReleased===true,resultWithheld:attempt.resultWithheld===true,resultAttachmentState:fixed(attempt.resultAttachmentState,['pending','attached','closed']),
          operationUnits:selectNumbers(operation,['reservedUnits','settledUnits','uncertainUnits']),sourceBindingMatches:sameRef(operation.source,source)&&operation.source.contentHash===source.contentHash,
          usageComplete:terminal?.nativeInterface===snapshot.nativeInterface&&completeNativeTokenUsage(snapshot.nativeInterface,terminal?.usage,attempt),
          snapshot:{nativeInterface:fixed(snapshot.nativeInterface,['chat','embedding']),promptVersion:fixed(snapshot.pins?.promptVersion,[MEMORY_JSON_OBJECT_CONTRACT.promptVersion]),schemaVersion:fixed(snapshot.pins?.schemaVersion,['facts-v1','conflicts-v1']),
            semanticProfileMatches:snapshot.semanticProfile===undefined?undefined:same(snapshot.semanticProfile,event.profile)},
          terminal:{present:!!terminal,outcome:fixed(terminal?.outcome,['confirmed','confirmed_rejected']),costSource:fixed(terminal?.costSource,['unavailable','gateway-aggregate-usd-v1']),
            dispatchIdentityMatches:terminal?.dispatchIdentity===attempt.dispatchIdentity,usage:selectNumbers(terminal?.usage,['inputTokens','outputTokens','totalTokens','cachedInputTokens','reasoningTokens'])},
          request:encoded(attempt.canonical),privateResult:encoded(attempt.privateResultCanonical)};
        if(operation.operationKey==='memory.extract'){
          const text=retained?.text;let parsed,facts,jsonError,domainError;
          if(typeof text==='string'){
            try{parsed=JSON.parse(text);}catch(error){jsonError=errorSummary(error);}
            try{facts=parseSourceFactsResponse(parsed,source);}catch(error){domainError=errorSummary(error);}
          }
          const framing=buildSourceExtractionFramingV4(source);
          const messages=admitted.request?.messages??[];
          const messageText=message=>message.parts?.filter(part=>part.type==='text').map(part=>part.text).join('')??'';
          const extractStage=one(stages.filter(row=>row.stage==='extract'));
          let persisted;try{persisted=JSON.parse(extractStage.payloadCanonical);}catch{}
          summary.extraction={textPresent:typeof text==='string',textBytes:typeof text==='string'?Buffer.byteLength(text):undefined,
            textSha256:typeof text==='string'?hash(text):undefined,jsonValid:typeof text==='string'&&!jsonError,strictDomainValid:!!facts,factCount:facts?.length,
            jsonError,domainError,parsedShape:parsed===undefined?undefined:{type:Array.isArray(parsed)?'array':parsed===null?'null':typeof parsed,
              topKeyCount:parsed&&typeof parsed==='object'?Object.keys(parsed).length:0,
              factsArray:Array.isArray(parsed?.facts),factCount:Array.isArray(parsed?.facts)?parsed.facts.length:undefined,
              schemaDefinitionShape:parsed?.type==='object'&&!!parsed?.properties},
            exactProductionSystem:messages[0]?.role==='system'&&messageText(messages[0])===framing.system,
            exactProductionQuotedUser:messages[1]?.role==='user'&&messageText(messages[1])===framing.prompt,
            exactlyTwoTrustedRoles:messages.length===2&&messages[0].role==='system'&&messages[1].role==='user',
            topLevelFactsOnly:!!parsed&&typeof parsed==='object'&&Object.keys(parsed).length===1&&Array.isArray(parsed.facts),
            nativeJsonObjectFormat:same(admitted.request?.responseFormat,{type:'json'}),
            compiledV5Pin:snapshot.pins?.promptVersion===MEMORY_JSON_OBJECT_CONTRACT.promptVersion&&snapshot.pins?.boundRevision===MEMORY_JSON_OBJECT_CONTRACT.boundRevision,
            persistedExtractPayloadMatches:!!facts&&same(persisted,JSON.parse(JSON.stringify(facts))),
            persistedExtractCountMatches:!!facts&&Array.isArray(persisted)&&persisted.length===facts.length,
            failureClass:typeof text!=='string'?'attached_text_missing':jsonError?'native_json_syntax_invalid':domainError?'strict_domain_contract_invalid':undefined};
        }else if(operation.operationKey==='facts.resolve'){
          const text=retained?.text;let result,error;
          if(typeof text==='string'){try{result=parseConflictDecision(text);}catch(caught){error=errorSummary(caught);}}
          summary.conflictResolution={textPresent:typeof text==='string',textBytes:typeof text==='string'?Buffer.byteLength(text):undefined,
            textSha256:typeof text==='string'?hash(text):undefined,strictDomainValid:!!result,
            action:fixed(result?.action,['ADD','UPDATE','SUPERSEDE','NONE']),error};
        }
        attemptSummaries.push(summary);
      }
      const vectorSummaries=[];
      for(const vector of sourceVectors){
        const payload=vector.profile.dimensions===3072?vector.embeddingLarge:vector.embedding;
        const stored=strip(vector),{embeddingLarge,profileId,scopeProfileKey,ownerPrincipalId,scopeProfileOwnerKey,...logical}=stored;
        const domainVector={...logical,embedding:payload};
        const natives=attempts.filter(attempt=>operations.some(op=>op._id===attempt.operationDocumentId&&op.operationKey==='embedding.memory'));
        const nativeMatch=natives.some(attempt=>{try{const value=JSON.parse(attempt.privateResultCanonical);return Array.isArray(value.vectors)&&value.vectors.some(native=>same(native,payload));}catch{return false;}});
        vectorSummaries.push({vectorIdSha256:hash(vector.vectorId),chunkIdSha256:hash(vector.chunkId),dimensions:Array.isArray(payload)?payload.length:0,
          embeddingSha256:hash(payload??[]),allFinite:Array.isArray(payload)&&payload.every(Number.isFinite),nonZero:Array.isArray(payload)&&payload.some(value=>value!==0),
          profile:{profileId:vector.profile.profileId,dimensions:vector.profile.dimensions,indexName:vector.profile.indexName,modelId:vector.profile.modelId},
          checks:{shapeValid:check(()=>assertEmbeddingVector(payload,vector.profile)).valid,profileMatches:same(vector.profile,event.profile)&&vector.profileId===event.profile.profileId,
            sourceChunkExists:sourceChunks.some(chunk=>chunk.chunkId===vector.chunkId),processingReceiptMatches:vector.processingReceiptId===vectorReceiptId,
            receiptVectorMatches:receiptPayload?.vectors?.some(value=>same(value,domainVector))===true,nativeAttachedVectorMatches:nativeMatch,
            scopeIndexKeyMatches:vector.scopeProfileKey===vectorScopeKey(event.tenantId,event.memorySpaceId,event.profile.profileId),
            ownerIndexKeyMatches:vector.ownerPrincipalId===source.ownerPrincipalId&&vector.scopeProfileOwnerKey===vectorOwnerScopeKey(event.tenantId,event.memorySpaceId,event.profile.profileId,source.ownerPrincipalId)}});
      }
      const generations=rows.runtimeMemoryVectorGenerations.filter(row=>sameScope(row,event)&&sameRef(row,source)&&same(row.profile,event.profile));
      const generationChecks={oneCurrentGeneration:generations.length===1,sourceHashMatches:generations.length===1&&generations[0].contentHash===source.contentHash,
        ownerMatches:generations.length===1&&generations[0].ownerPrincipalId===source.ownerPrincipalId,receiptMatches:generations.length===1&&generations[0].receiptId===vectorReceiptId};
      const factSummaries=sourceFacts.map(fact=>{const receipt=sourceReceipts.find(row=>row.receiptId===fact.processingReceiptId);let payload;try{payload=JSON.parse(receipt?.canonicalPayload);}catch{}
        const {_id,_creationTime,processingReceiptId,...fields}=fact;
        return {factIdSha256:hash(fact.factId),payloadSha256:hash(fields),version:num(fact.version),confidence:num(fact.confidence),

          checks:{exactSourceLineage:same(fact.lineage,source.lineage),ownerMatches:fact.ownerPrincipalId===source.ownerPrincipalId,notAssistant:source.lineage.role!=='assistant',
            notTombstoned:fact.tombstonedAt===undefined,receiptExists:!!receipt,receiptFactMatches:payload?.facts?.some(value=>{const {_id,...expected}=value;return same(expected,fields);})===true}};});
      const extractCount=operations.filter(row=>row.operationKey==='memory.extract').length;
      const nativeChecks={completeTerminalAttachment:attemptSummaries.every(attempt=>attempt.resultAttachmentState==='attached'&&attempt.terminal.present&&attempt.terminal.outcome==='confirmed'&&attempt.terminal.dispatchIdentityMatches&&!attempt.resultWithheld),
        completeTokenUsage:attemptSummaries.every(attempt=>attempt.usageComplete===true),
        exactSourceBindings:attemptSummaries.every(attempt=>attempt.sourceBindingMatches),
        currentAccount:account.current===true&&account.cancelled!==true&&same(account.reference,event.authorityReference),
        currentOperationAuthority:operations.every(op=>same(op.reference,event.authorityReference)&&op.cancelled!==true&&op.overrun!==true)};
      const completeFlags={...nativeChecks,facts:event.factsState===(role==='user'?'complete':'skipped'),vectors:event.vectorsState==='complete',
        stageAttemptsNoRetries:stages.every(row=>row.attempt<2),oneExtractionAsEligible:extractCount===(role==='user'?1:0),
        oneAttemptPerOperation:operations.every(op=>attempts.filter(attempt=>attempt.operationDocumentId===op._id).length===1),
        allSlotsReleased:attempts.every(attempt=>attempt.slotReleased===true),noReservedLiability:account.reservedUnits===0&&account.activeConcurrency===0,
        positiveCanonicalVectors:sourceVectors.length===prepared.chunks.length&&sourceVectors.length>0&&vectorSummaries.every(vector=>vector.allFinite&&vector.nonZero&&Object.values(vector.checks).every(Boolean)),
        canonicalChunks:sourceChunks.length===prepared.chunks.length&&chunkSummaries.every(chunk=>Object.values(chunk.checks).every(Boolean)),
        currentGeneration:Object.values(generationChecks).every(Boolean),matchingReceipt:Object.values(receiptChecks).every(Boolean),
        currentSource:Object.values(sourceChecks).every(Boolean),currentAuthority:Object.values(authorityChecks).every(Boolean),
        allFactsAttributed:factSummaries.every(fact=>Object.values(fact.checks).every(Boolean)),
        extractionV5Valid:role==='assistant'||attemptSummaries.filter(attempt=>attempt.operationKey==='memory.extract').every(attempt=>attempt.snapshot.promptVersion===MEMORY_JSON_OBJECT_CONTRACT.promptVersion&&attempt.extraction?.strictDomainValid&&attempt.extraction.exactProductionSystem&&attempt.extraction.exactProductionQuotedUser&&attempt.extraction.nativeJsonObjectFormat&&attempt.extraction.compiledV5Pin&&attempt.extraction.persistedExtractPayloadMatches)};
      eventSummaries.push({eventId,sequence:num(event.sequence),role,eligibility:fixed(event.eligibility,['eligible','ineligible','superseded','tombstoned']),
        factsState:fixed(event.factsState,states),vectorsState:fixed(event.vectorsState,states),source:{lineageSha256:hash(source.lineage),contentBytes:Buffer.byteLength(source.content),contentHash:source.contentHash,
checks:sourceChecks,authorityChecks},
        stages:stages.map(row=>({stage:fixed(row.stage,['extract','facts','vectors']),state:fixed(row.state,states),attempt:num(row.attempt),leaseVersion:num(row.leaseVersion),
          failureCode:fixed(row.failureCode,['INDEXING_OUTCOME_UNKNOWN','INDEXING_FAILED','INDEXING_ADMISSION_FAILED','REPLAN_REQUIRED']),
          receiptIdSha256:row.receiptId?hash(row.receiptId):undefined,payload:encoded(row.payloadCanonical)})),
        job:{runBudgetIdSha256:hash(job.runBudgetId),runAccountIdSha256:hash(job.runAccountId),createdAt:num(job.createdAt)},
        account:{...selectNumbers(account,['reservedUnits','settledUnits','uncertainUnits','activeConcurrency']),cancelled:account.cancelled===true,current:account.current===true},
        operationCount:operations.length,attemptCount:attempts.length,attempts:attemptSummaries,chunkCount:sourceChunks.length,chunks:chunkSummaries,
        vectorCount:sourceVectors.length,vectors:vectorSummaries,generationChecks,receiptChecks,receiptCount:sourceReceipts.length,
        factCount:sourceFacts.length,facts:factSummaries,checks:completeFlags,passed:Object.values(completeFlags).every(Boolean)});
    }
    const ordinal=identities.indexOf(identity),scope=one(rows.runtimeIngestionScopes.filter(row=>sameScope(row,run)));
    const expectedThrough=(ordinal+1)*2,profileId=eventSummaries[0].vectors[0]?.profile.profileId;
    const progress={expectedThrough,scopeSequence:num(scope.sequence),factsThrough:num(scope.factsThrough),vectorsThrough:num(scope.vectorsThrough),
      selectedProfileThrough:num(scope.vectorProfileThrough?.[profileId]),profileId};
    const progressChecks={exactEventSequences:eventSummaries.every((event,index)=>event.sequence===ordinal*2+index+1),
      noMissingScopeEvents:[...Array(expectedThrough)].every((_,index)=>rows.runtimeIngestionEvents.filter(event=>sameScope(event,run)&&event.sequence===index+1).length===1),
      factsContiguous:scope.factsThrough>=expectedThrough,vectorsContiguous:(scope.vectorProfileThrough?.[profileId]??scope.vectorsThrough)>=expectedThrough,
      profileConsistent:eventSummaries.every(event=>event.vectors.every(vector=>vector.profile.profileId===profileId))};
    const userDurableFact=eventSummaries.find(event=>event.role==='user').factCount>0;
    summaries.push({label:identity.label,runId:identity.runId,responseStatus:fixed(run.responseStatus,['complete','failed','running','cancelled']),
      memoryStatus:fixed(run.memoryStatus,['complete','failed','pending']),events:eventSummaries,progress,progressChecks,userDurableFact,
      passed:run.responseStatus==='complete'&&run.memoryStatus==='complete'&&eventSummaries.every(event=>event.passed)&&Object.values(progressChecks).every(Boolean)
        &&userDurableFact});
  }
  const finalSession=await loadSession(PROOFS_ROOT,sessionId);targetCheck(finalSession);await verifyCloud(finalSession,ctx);
  const output={version:2,observedAt:new Date().toISOString(),target:{sessionId,name:session.target.name,id:session.target.id,teamId:325340,projectId:3200658,reference:session.target.reference},
    readOnly:true,managementNonGetBlocked:true,existingKeyOnly:true,rawPrivatePayloadRetained:false,freshVerifications,tableCounts,runs:summaries,
    note:'Actual stored vector field/index provenance is checked; no ANN query, inference, mutation, retry, refund or previous-generation access. Read snapshots are bounded per table, not one cross-table transaction.',
    mode:'four-supplied-runs',passed:summaries.every(run=>run.passed)};
  const receipt=path.join(Q,'k16-memory-native-v2-four-run-verification-'+Date.now()+'.json');
  await fs.writeFile(receipt,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({receipt,passed:output.passed,mode:output.mode,freshVerifications,
    runs:summaries.map(run=>({label:run.label,passed:run.passed,userDurableFact:run.userDurableFact,progress:run.progress,progressChecks:run.progressChecks,
      events:run.events.map(event=>({role:event.role,sequence:event.sequence,factsState:event.factsState,vectorsState:event.vectorsState,factCount:event.factCount,vectorCount:event.vectorCount,
        failedChecks:Object.entries(event.checks).filter(([,value])=>!value).map(([key])=>key)}))}))})+'\n');
  if(!output.passed)process.exitCode=1;
}
try{await main();}catch(error){process.stdout.write(JSON.stringify({readOnlyVerificationFailed:true,error:errorSummary(error),rawPrivatePayloadRetained:false})+'\n');process.exitCode=1;}
finally{await client?.close();}
