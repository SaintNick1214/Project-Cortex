/** Task10 disposable fixture orchestration. Native product guards remain in every called helper. */
import {internalMutation,internalQuery,internalAction,mutation} from './_generated/server';
import {v} from 'convex/values';
import {makeFunctionReference,getFunctionName} from 'convex/server';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
import {recheckAuthority} from './runtimeAuth';
import {manualAppend,reviseMessage} from './runtimeTranscript';
import {createActionMemoryRepository,ConvexMemoryRepository} from './runtimeMemoryRepository';
import {createGatewayMemoryModel} from './runtimeMemoryGateway';
import {ensureBackendGatewayBudget} from './runtimeGatewayBackend';
import {deriveSourceVectors} from './runtimeMemoryServices';
import {canonicalModelJson} from './_cortex/shared/domain/model_policy';
import {semanticHash} from './_cortex/shared/domain/profile';
const PREFIX='task10-fe3a2599-d6fd-41f1-984e-141c8373423e';
const own=(reference:{tenantId:string})=>{if(![PREFIX,PREFIX+'-managed'].includes(reference.tenantId))throw Error('FIXTURE_SCOPE_DENIED');};
export const hold = internalMutation({args:{reference:runtimeAuthorityReference,eventId:v.string(),stage:v.union(v.literal('extract'),v.literal('facts'),v.literal('vectors'))},handler:async(_ctx,args)=>{own(args.reference);return {heldBeforeClaim:true,eventId:args.eventId,stage:args.stage};}});
export const appendHeld = mutation({args:{tenantId:v.string(),memorySpaceId:v.string(),conversationId:v.string(),expectedRevision:v.number(),text:v.string()},handler:async(ctx,args)=>{
 own(args);const scheduler={...ctx.scheduler,runAfter:async(delay:number,reference:any,scheduledArgs:any)=>{
  if(getFunctionName(reference)==='runtimeIngestion:processStage')return ctx.scheduler.runAfter(delay,makeFunctionReference<'mutation'>('profileNative:hold'),scheduledArgs);
  return ctx.scheduler.runAfter(delay,reference,scheduledArgs);
 }};
 return await manualAppend({...ctx,scheduler}, {...args,role:'user',parts:[{type:'text',text:args.text}]});
}});
export const editHeld = mutation({args:{tenantId:v.string(),memorySpaceId:v.string(),conversationId:v.string(),expectedRevision:v.number(),messageId:v.string(),expectedMessageRevision:v.number(),text:v.string()},handler:async(ctx,args)=>{
 own(args);const scheduler={...ctx.scheduler,runAfter:async(delay:number,reference:any,scheduledArgs:any)=>{
  if(getFunctionName(reference)==='runtimeIngestion:processStage')return ctx.scheduler.runAfter(delay,makeFunctionReference<'mutation'>('profileNative:hold'),scheduledArgs);
  return ctx.scheduler.runAfter(delay,reference,scheduledArgs);
 }};
 const {text,...selector}=args;return await reviseMessage({...ctx,scheduler},{...selector,parts:[{type:'text',text}]},false);
}});
export const derive = internalAction({args:{reference:runtimeAuthorityReference,sourceId:v.string(),requestId:v.string()},handler:async(ctx,args)=>{
 own(args.reference);const repository=createActionMemoryRepository(ctx,args.reference,'write');
 const budget=await ensureBackendGatewayBudget(ctx,{reference:args.reference,operationKey:'embedding.memory',requestId:args.requestId,
  requestCanonical:canonicalModelJson({purpose:'single-source-profile-generation',sourceId:args.sourceId,requestId:args.requestId})});
 return {...await deriveSourceVectors({repository,model:createGatewayMemoryModel(ctx,repository,budget),clock:{now:()=>Date.now()}},{sourceId:args.sourceId,requestId:args.requestId}),runBudgetId:budget.runBudgetId};
}});
export const inspect = internalQuery({args:{reference:runtimeAuthorityReference},handler:async(ctx,args)=>{
 own(args.reference);await recheckAuthority(ctx,args.reference,{capability:'read',tenantId:args.reference.tenantId,memorySpaceId:args.reference.memorySpaceId});
 const scope=(row:{tenantId?:string,memorySpaceId?:string})=>row.tenantId===args.reference.tenantId&&row.memorySpaceId===args.reference.memorySpaceId;
 const sources=(await ctx.db.query('runtimeMemorySources').collect()).filter(scope);
 const chunks=(await ctx.db.query('runtimeMemoryChunks').collect()).filter(scope);
 const generations=(await ctx.db.query('runtimeMemoryVectorGenerations').collect()).filter(scope);
 const receipts=(await ctx.db.query('runtimeMemoryReceipts').collect()).filter(scope);
 const vectors=(await ctx.db.query('runtimeMemoryVectors').collect()).filter(scope);
 const events=(await ctx.db.query('runtimeIngestionEvents').collect()).filter(scope);
 const stages=(await ctx.db.query('runtimeIngestionStages').collect()).filter(scope);
 const ingestionScopes=(await ctx.db.query('runtimeIngestionScopes').collect()).filter(scope);
 return {sources,chunks,generations,events,stages,ingestionScopes,receipts:await Promise.all(receipts.map(async({_id,receiptId,identity,canonicalPayload})=>({_id,receiptId,identity,payloadBytes:new TextEncoder().encode(canonicalPayload).length,payloadHash:await semanticHash(canonicalPayload)}))),
  vectors:await Promise.all(vectors.map(async row=>{const vector=row.profile.dimensions===3072?row.embeddingLarge:row.embedding;return {_id:row._id,vectorId:row.vectorId,sourceId:row.sourceId,sourceEventId:row.sourceEventId,sourceRevision:row.sourceRevision,chunkId:row.chunkId,profile:row.profile,
   dimensions:vector?.length??null,finite:vector?.every(Number.isFinite)??false,vectorHash:vector?await semanticHash(canonicalModelJson(vector)):null,processingReceiptId:row.processingReceiptId,scopeProfileKey:row.scopeProfileKey,ownerPrincipalId:row.ownerPrincipalId};}))};
}});
export const repeatCommit = internalMutation({args:{reference:runtimeAuthorityReference,receiptId:v.string(),invalid:v.optional(v.union(v.literal('model'),v.literal('index'),v.literal('dimensions')))},handler:async(ctx,args)=>{
 own(args.reference);const receipt=await ctx.db.query('runtimeMemoryReceipts').withIndex('by_scope_receipt',q=>q.eq('tenantId',args.reference.tenantId).eq('memorySpaceId',args.reference.memorySpaceId!).eq('receiptId',args.receiptId)).unique();
 if(!receipt)throw Error('FIXTURE_GENUINE_RECEIPT_REQUIRED');
 const payload=JSON.parse(receipt.canonicalPayload);
 if(args.invalid){const vector=payload.vectors[0];if(!vector)throw Error('FIXTURE_GENUINE_VECTOR_REQUIRED');
  if(args.invalid==='model')vector.profile.modelId='fixture/foreign-same-dimensional-model';
  if(args.invalid==='index')vector.profile.indexName='by_fixture_unsupported';
  if(args.invalid==='dimensions')vector.embedding=vector.embedding.slice(1);
 }
 return await new ConvexMemoryRepository(ctx,args.reference,'write',ctx.db).commitDerived(payload);
}});
export const genuineQuery = internalQuery({args:{reference:runtimeAuthorityReference,attemptId:v.id('runtimeModelAttempts')},handler:async(ctx,args)=>{
 own(args.reference);await recheckAuthority(ctx,args.reference,{capability:'read',tenantId:args.reference.tenantId,memorySpaceId:args.reference.memorySpaceId});
 const attempt=await ctx.db.get('runtimeModelAttempts',args.attemptId),operation=attempt?await ctx.db.get('runtimeModelOperations',attempt.operationDocumentId):null;
 if(!attempt||!operation||operation.tenantId!==args.reference.tenantId||operation.operationKey!=='embedding.query'||attempt.resultWithheld||!attempt.privateResultCanonical)throw Error('FIXTURE_GENUINE_QUERY_REQUIRED');
 const run=await ctx.db.get('runtimeBudgetAccounts',operation.runAccountId),result=JSON.parse(attempt.privateResultCanonical);
 if(!run||!result.profile||result.vectors?.length!==1)throw Error('FIXTURE_GENUINE_QUERY_REQUIRED');
 return {profile:result.profile,embedding:result.vectors[0],embeddingRunBudgetId:run.runBudgetId};
}});
export const searchFromQuery = internalAction({args:{reference:runtimeAuthorityReference,attemptId:v.id('runtimeModelAttempts')},handler:async(ctx,args)=>{
 own(args.reference);const query=await ctx.runQuery(makeFunctionReference<'query'>('profileNative:genuineQuery'),args);
 const repository=createActionMemoryRepository(ctx,args.reference,'read');
 const matches=await repository.searchVectors({...query,text:'observatory project codeword'},5);
 return matches.map(match=>({score:match.score,sourceId:match.source.lineage.sourceId,sourceRevision:match.source.lineage.sourceRevision,chunkId:match.chunk.chunkId,text:match.chunk.text,profile:match.vector.profile}));
}});
export const inspectLedger = internalQuery({args:{reference:runtimeAuthorityReference},handler:async(ctx,args)=>{
 // Administrator-only accounting remains observable after grant retirement; no private vector/text output.
 own(args.reference);const accounts=(await ctx.db.query('runtimeBudgetAccounts').collect()).filter(row=>row.tenantId===args.reference.tenantId);
 const operations=(await ctx.db.query('runtimeModelOperations').collect()).filter(row=>row.tenantId===args.reference.tenantId);
 const ids=new Set(operations.map(row=>row._id)),attempts=(await ctx.db.query('runtimeModelAttempts').collect()).filter(row=>ids.has(row.operationDocumentId));
 return {accounts:accounts.map(({_id,kind,runBudgetId,limitUnits,reservedUnits,settledUnits,uncertainUnits,activeConcurrency,cancelled,root,current,windowId})=>({_id,kind,runBudgetId,limitUnits,reservedUnits,settledUnits,uncertainUnits,activeConcurrency,cancelled,current,windowId,
   root:{manifestId:root.manifestId,revision:root.revision,hash:root.hash,evidenceHash:root.evidenceHash,acceptanceHash:root.acceptanceHash}})),
  operations:operations.map(({_id,operationKey,source,parentOperationId,snapshotCanonical,runAccountId,resolutionCanonical,uncertainUnits})=>({_id,operationKey,source:source??null,parentOperationId:parentOperationId??null,runAccountId,snapshot:JSON.parse(snapshotCanonical),resolution:JSON.parse(resolutionCanonical),uncertainUnits})),
  attempts:attempts.map(({_id,operationDocumentId,state,dispatchIdentity,ordinal,measuredInputTokens,slotReleased,resultWithheld,receiptCanonical,terminalEvidenceCanonical,privateResultCanonical,reservationUnits,settledCostUnits})=>({_id,operationDocumentId,state,dispatchIdentity,ordinal,measuredInputTokens,slotReleased,resultWithheld,reservationUnits,settledCostUnits:settledCostUnits??null,receipt:terminalEvidenceCanonical?JSON.parse(terminalEvidenceCanonical):receiptCanonical?JSON.parse(receiptCanonical):null,legacyReceiptPresent:!!receiptCanonical,terminalEvidencePresent:!!terminalEvidenceCanonical,privateResultBytes:privateResultCanonical?new TextEncoder().encode(privateResultCanonical).length:0}))};
}});
export const cleanupState = internalQuery({args:{},handler:async(ctx)=>{
 const scope=(row:{tenantId?:string})=>[PREFIX,PREFIX+'-managed',PREFIX+'-foreign'].includes(row.tenantId??'');
 const sources=(await ctx.db.query('runtimeMemorySources').collect()).filter(scope);
 const events=(await ctx.db.query('runtimeIngestionEvents').collect()).filter(scope);
 const stages=(await ctx.db.query('runtimeIngestionStages').collect()).filter(scope);
 const grants=(await ctx.db.query('runtimeAuthGrants').collect()).filter(scope);
 const conversations=(await ctx.db.query('runtimeConversations').collect()).filter(scope);
 const tombstones=(await ctx.db.query('runtimeAuthTombstones').collect()).filter(scope);
 return {sources:sources.map(row=>({tenantId:row.tenantId,memorySpaceId:row.memorySpaceId,sourceId:row.lineage.sourceId,sourceRevision:row.lineage.sourceRevision,tombstonedAt:row.tombstonedAt??null})),
  events:events.map(row=>({tenantId:row.tenantId,eventId:row.eventId,sourceId:row.lineage.sourceId,eligibility:row.eligibility})),
  runningStages:stages.filter(row=>row.state==='running').map(row=>({eventId:row.eventId,stage:row.stage,state:row.state})),
  grants:grants.map(row=>({_id:row._id,tenantId:row.tenantId,memorySpaceId:row.memorySpaceId??null,revokedAt:row.revokedAt??null})),
  conversations:conversations.map(row=>({tenantId:row.tenantId,memorySpaceId:row.memorySpaceId,conversationId:row.conversationId,tombstonedAt:row.tombstonedAt??null})),
  tombstones:tombstones.map(({tenantId,memorySpaceId,resourceType,resourceId,deletedAt})=>({tenantId,memorySpaceId:memorySpaceId??null,resourceType,resourceId,deletedAt}))};
}});
