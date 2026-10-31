/** One authenticated canonical exchange capture. No app/model/fact writer. */
import {saveMessages} from '@convex-dev/agent';
import {v} from 'convex/values';
import {mutation} from './_generated/server';
import type {MutationCtx} from './_generated/server';
import type {Doc} from './_generated/dataModel';
import type {RuntimeRememberInput,RuntimeRememberResult} from '../src/client-runtime/types';
import {rememberInput} from '../src/client-runtime/remember';
import {canonicalModelJson} from '../src/domain/model-policy';
import {semanticHash,assertProfileMatches} from '../src/domain/profile';
import {requireDataAuthority,dataAuthorityReference,bindDataActor} from './runtimeDataAuth';
import {agentComponent,conversationById,createManagedConversation,requireConversation,registerMessages,manualAppend,bridgeFor,checkConversation,transcriptDenied} from './runtimeTranscript';
import {ConvexMemoryRepository,memoryReferences} from './runtimeMemoryRepository';
import {deliveryExpiresAt} from './runtimeDelivery';

const selectors={tenantId:v.optional(v.string()),memorySpaceId:v.optional(v.string())};
const inputValidator=v.object({conversationId:v.string(),requestId:v.string(),userMessage:v.string(),agentResponse:v.string(),
  userId:v.optional(v.string()),agentId:v.optional(v.string()),participantId:v.optional(v.string()),userName:v.optional(v.string()),
  expectedRevision:v.optional(v.number()),metadata:v.optional(v.any())});
function normalized(input:RuntimeRememberInput):RuntimeRememberInput {
  try{return rememberInput(input);}catch {return transcriptDenied('INVALID_INPUT');}
}
function one<T>(rows:T[]):T|undefined {if(rows.length>1)transcriptDenied('TRANSCRIPT_CONFLICT');return rows[0];}
async function captureIngress(ctx:MutationCtx,conversation:Doc<'runtimeConversations'>) {
  const ingress=one(await ctx.db.query('runtimeMemoryCaptureConversations').withIndex('by_conversation',q=>q.eq('tenantId',conversation.tenantId)
    .eq('memorySpaceId',conversation.memorySpaceId).eq('conversationId',conversation.conversationId)).take(2));
  if(ingress&&(ingress.ownerPrincipalId!==conversation.ownerPrincipalId||ingress.conversationEpoch!==conversation.epoch||ingress.ingressKind!=='remember-exchange-v1'))transcriptDenied('STALE_TRANSCRIPT');
  return ingress;
}
async function projection(ctx:MutationCtx,row:Doc<'runtimeMemoryCaptures'>,created:boolean,writeIntent=true):Promise<RuntimeRememberResult> {
  const {conversation,reference}=await requireConversation(ctx,row,row.conversationId,'read');
  if(conversation.ownerPrincipalId!==row.ownerPrincipalId||conversation.epoch!==row.conversationEpoch)transcriptDenied('STALE_TRANSCRIPT');
  const ingress=await captureIngress(ctx,conversation);
  if(writeIntent&&(ingress?.captureAppendLocked||!ingress&&conversation.manualWriteLocked))transcriptDenied('TRANSCRIPT_LOCKED');
  if(writeIntent&&!ingress&&conversation.requireApproval)transcriptDenied('CAPABILITY_UNAVAILABLE');
  const profile=await ctx.runQuery(memoryReferences.profile,{reference,operationKey:'embedding.memory'});
  assertProfileMatches(profile,row.profile);
  if(row.messageIds.length!==2||row.sourceEventIds.length!==2)transcriptDenied('TRANSCRIPT_CONFLICT');
  const messages=await ctx.db.query('runtimeMemoryCaptureMessages').withIndex('by_receipt',q=>q.eq('tenantId',row.tenantId).eq('memorySpaceId',row.memorySpaceId).eq('receiptId',row.receiptId)).take(3);
  if(messages.length!==2)transcriptDenied('TRANSCRIPT_CONFLICT');
  const facts:string[]=[],vectors:string[]=[];
  for(let i=0;i<2;i++) {
    const id=row.messageIds[i]!,bridge=await bridgeFor(ctx,conversation,id),message=messages.find(m=>m.nativeMessageId===id);
    if(!bridge||!message||bridge.tombstonedAt!==undefined||bridge.revision!==message.sourceRevision||bridge.contentHash!==message.contentHash
      ||bridge.sourceEventId!==row.sourceEventIds[i]||message.ownerPrincipalId!==row.ownerPrincipalId)transcriptDenied('STALE_TRANSCRIPT');
    const source=await new ConvexMemoryRepository(ctx,reference,'read').getSource(bridge.sourceId);
    if(!source||source.lineage.sourceRevision!==message.sourceRevision||source.lineage.sourceEventId!==message.sourceEventId)transcriptDenied('STALE_TRANSCRIPT');
    // Read the production source lineage index; never invent an ingestion ID.
    const events=await ctx.db.query('runtimeIngestionEvents').withIndex('by_source',q=>q.eq('tenantId',row.tenantId).eq('memorySpaceId',row.memorySpaceId)
      .eq('lineage.sourceId',bridge.sourceId).eq('lineage.sourceRevision',bridge.revision)).take(2);
    const current=one(events);if(!current||current.contentHash!==source.contentHash||current.nativeMessageId!==id||current.eligibility!=='eligible')transcriptDenied('STALE_SOURCE');
    facts.push(current.factsState);vectors.push(current.vectorsState);
  }
  const all=[...facts,...vectors],memoryStatus=all.some(s=>['failed','unknown','dead_letter'].includes(s))?'failed':all.every(s=>s==='complete'||s==='skipped')?'complete':'pending';
  const expiry=await deliveryExpiresAt(ctx,reference);
  return {version:1,receiptId:row.receiptId,requestId:row.requestId,conversationId:row.conversationId,scope:{tenantId:row.tenantId,memorySpaceId:row.memorySpaceId},
    principalId:row.ownerPrincipalId,messageIds:row.messageIds as [string,string],sourceEventIds:row.sourceEventIds as [string,string],historyRevision:conversation.historyRevision,created,
    memoryStatus,profile,stages:{facts:facts as [string,string],vectors:vectors as [string,string]},...(expiry===undefined?{}:{deliveryExpiresAt:expiry})};
}
export async function rememberExchangeHandler(ctx:MutationCtx,args:{tenantId?:string;memorySpaceId?:string;input:RuntimeRememberInput}):Promise<RuntimeRememberResult> {
  const actor=await requireDataAuthority(ctx,args,'write'),reference=dataAuthorityReference(actor),input=normalized(args.input);
  bindDataActor(actor,input.userId);bindDataActor(actor,input.participantId);
  const requestCanonical=canonicalModelJson(input);
  const prior=one(await ctx.db.query('runtimeMemoryCaptures').withIndex('by_request',q=>q.eq('tenantId',actor.tenantId).eq('memorySpaceId',actor.memorySpaceId)
    .eq('ownerPrincipalId',actor.principalId).eq('requestId',input.requestId)).take(2));
  if(prior) {if(prior.requestCanonical!==requestCanonical)transcriptDenied('IDEMPOTENCY_CONFLICT');return projection(ctx,prior,false);}
  let conversation=await conversationById(ctx,reference,input.conversationId);
  if(!conversation) {
    const identity=canonicalModelJson(['remember.capture.conversation.v1',actor.tenantId,actor.memorySpaceId,actor.principalId,input.conversationId]);
    conversation=await createManagedConversation(ctx,actor,identity,identity);
    await ctx.db.patch('runtimeConversations',conversation._id,{legacyConversationId:input.conversationId});
    await ctx.db.insert('runtimeMemoryCaptureConversations',{tenantId:actor.tenantId,memorySpaceId:actor.memorySpaceId,ownerPrincipalId:actor.principalId,
      conversationId:conversation.conversationId,conversationEpoch:conversation.epoch,ingressKind:'remember-exchange-v1',captureAppendLocked:false});
  }
  await checkConversation(ctx,reference,conversation,'write');
  if(conversation.ownerPrincipalId!==actor.principalId)transcriptDenied('FORBIDDEN');
  const ingress=await captureIngress(ctx,conversation);
  if(ingress?.captureAppendLocked||!ingress&&conversation.manualWriteLocked)transcriptDenied('TRANSCRIPT_LOCKED');
  if(input.expectedRevision!==undefined&&input.expectedRevision!==conversation.historyRevision)transcriptDenied('IDEMPOTENCY_CONFLICT');
  const profile=await ctx.runQuery(memoryReferences.profile,{reference,operationKey:'embedding.memory'});
  const receiptId=`capture:${await semanticHash(canonicalModelJson([actor.tenantId,actor.memorySpaceId,actor.principalId,input.requestId]))}`;
  let pins;
  if(ingress) {
    const saved=await saveMessages(ctx,agentComponent,{threadId:conversation.threadId,userId:reference.principalId,order:'next',
      messages:[{role:'user',content:[{type:'text',text:input.userMessage}]},{role:'assistant',content:[{type:'text',text:input.agentResponse}]}],failPendingSteps:false});
    pins=await registerMessages(ctx,conversation,reference,saved.messages,{approved:true});
  } else {
    const user=await manualAppend(ctx,{conversationId:conversation.conversationId,expectedRevision:conversation.historyRevision,role:'user',parts:[{type:'text',text:input.userMessage}]});
    const current=(await ctx.db.get('runtimeConversations',conversation._id))!;
    const assistant=await manualAppend(ctx,{conversationId:conversation.conversationId,expectedRevision:current.historyRevision,role:'assistant',parts:[{type:'text',text:input.agentResponse}]});
    pins=[...user,...assistant];
  }
  if(pins.length!==2)transcriptDenied('TRANSCRIPT_CONFLICT');
  const current=(await ctx.db.get('runtimeConversations',conversation._id))!;
  for(let i=0;i<2;i++)await ctx.db.insert('runtimeMemoryCaptureMessages',{tenantId:actor.tenantId,memorySpaceId:actor.memorySpaceId,ownerPrincipalId:actor.principalId,
    receiptId,conversationId:current.conversationId,nativeMessageId:pins[i]!.nativeMessageId,sourceEventId:pins[i]!.sourceEventId,sourceRevision:pins[i]!.sourceRevision,
    contentHash:pins[i]!.contentHash,role:i===0?'user':'assistant',attribution:'external_capture',
    metadataCanonical:canonicalModelJson({actorUserId:actor.userId,actorPrincipalId:actor.principalId,requestId:input.requestId,
      ...(input.participantId?{participantId:input.participantId}:{}),...(input.agentId?{assistantLabel:input.agentId}:{}),...(input.userName?{userName:input.userName}:{}),...(input.metadata?{metadata:input.metadata}:{})}),createdAt:Date.now()});
  const id=await ctx.db.insert('runtimeMemoryCaptures',{tenantId:actor.tenantId,memorySpaceId:actor.memorySpaceId,ownerPrincipalId:actor.principalId,receiptId,
    requestId:input.requestId,requestCanonical,conversationId:current.conversationId,conversationEpoch:current.epoch,historyRevision:current.historyRevision,
    messageIds:pins.map(p=>p.nativeMessageId),sourceEventIds:pins.map(p=>p.sourceEventId),profile,authorityReference:reference,createdAt:Date.now()});
  return projection(ctx,(await ctx.db.get('runtimeMemoryCaptures',id))!,true);
}
export const rememberExchange=mutation({args:{...selectors,input:inputValidator},handler:rememberExchangeHandler});
export const rememberStatus=mutation({args:{...selectors,receiptId:v.string()},handler:async(ctx,args)=>{
  const actor=await requireDataAuthority(ctx,args,'read');
  const row=one(await ctx.db.query('runtimeMemoryCaptures').withIndex('by_receipt',q=>q.eq('tenantId',actor.tenantId).eq('memorySpaceId',actor.memorySpaceId).eq('receiptId',args.receiptId)).take(2));
  if(!row||row.ownerPrincipalId!==actor.principalId)transcriptDenied('FORBIDDEN');return projection(ctx,row,false,false);
}});
/** Capture admission lock is separate from the unchanged manual edit lock. */
export const setCaptureLock=mutation({args:{...selectors,conversationId:v.string(),expectedRevision:v.number(),locked:v.boolean()},handler:async(ctx,args)=>{
  const {conversation}=await requireConversation(ctx,args,args.conversationId,'admin');
  if(conversation.historyRevision!==args.expectedRevision)transcriptDenied('IDEMPOTENCY_CONFLICT');
  const ingress=await captureIngress(ctx,conversation);if(!ingress)transcriptDenied('INVALID_STATE');
  await ctx.db.patch('runtimeMemoryCaptureConversations',ingress._id,{captureAppendLocked:args.locked});return {locked:args.locked};
}});
