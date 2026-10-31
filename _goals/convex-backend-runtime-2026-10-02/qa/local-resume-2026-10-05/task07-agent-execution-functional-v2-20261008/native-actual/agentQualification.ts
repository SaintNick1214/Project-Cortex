/** Owned disposable native observations and save-gap injection, never shipped. */
import { getFunctionName, makeFunctionReference } from 'convex/server';
import { v } from 'convex/values';
import { query, internalQuery, internalAction, internalMutation } from './_generated/server';
import type { PaginationResult } from 'convex/server';
import type { MessageDoc } from '@convex-dev/agent';
import type { ActionCtx } from './_generated/server';
import { agentAttempt } from './runtimeAgentSchema';
import { agentComponent } from './runtimeTranscript';
import { executableRegistryHash } from './agentDefinitions';
import { requireDataAuthority, dataAuthorityReference } from './runtimeDataAuth';
import { modelStepHandler } from './runtimeAgent';
import { currentRun } from './runs';
import { runtimeAuthorityReference } from './runtimeAuthSchema';

export const reference=query({args:{memorySpaceId:v.string()},handler:async(ctx,args)=>
  dataAuthorityReference(await requireDataAuthority(ctx,args,'admin'))});
export const registryHash=internalQuery({args:{},handler:async()=>await executableRegistryHash()});
export const state=internalQuery({args:{tenantId:v.string(),memorySpaceId:v.string(),runId:v.string()},handler:async(ctx,args)=>{
  const run=await ctx.db.query('runtimeRuns').withIndex('by_scoped_id',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('runId',args.runId)).unique();
  if(!run)throw new Error('UNKNOWN_OWNED_FIXTURE_RUN');
  const executions=await ctx.db.query('runtimeAgentExecutions').withIndex('by_attempt',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('runId',args.runId)).collect();
  const operations=(await ctx.db.query('runtimeAgentOperations').collect()).filter(row=>row.tenantId===args.tenantId&&row.memorySpaceId===args.memorySpaceId&&row.runId===args.runId);
  const ingestion=await ctx.db.query('runtimeAgentIngestion').withIndex('by_run',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('runId',args.runId)).collect();
  const budgetAccounts=(await ctx.db.query('runtimeBudgetAccounts').collect()).filter(row=>row.kind==='run'&&row.tenantId===args.tenantId&&row.runBudgetId===run.runBudgetId);
  const runById=new Map(budgetAccounts.map(row=>[row._id,row]));
  const modelOperations=(await ctx.db.query('runtimeModelOperations').collect()).filter(row=>row.tenantId===args.tenantId&&runById.has(row.runAccountId));
  const modelIds=new Set(modelOperations.map(row=>row._id));
  const attempts=(await ctx.db.query('runtimeModelAttempts').collect()).filter(row=>modelIds.has(row.operationDocumentId));
  const outbox=await ctx.db.query('runtimeRunOutbox').withIndex('by_run',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('runId',args.runId)).collect();
  const conversation=await ctx.db.query('runtimeConversations').withIndex('by_scoped_id',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('conversationId',run.conversationId)).unique();
  const bridges=(await ctx.db.query('runtimeTranscriptMessages').collect()).filter(row=>row.tenantId===args.tenantId&&row.memorySpaceId===args.memorySpaceId&&row.conversationId===run.conversationId);
  const native:unknown[]=[];let cursor:string|null=null;
  if(conversation){do{const page:PaginationResult<MessageDoc>=await ctx.runQuery(agentComponent.messages.listMessagesByThreadId,{threadId:conversation.threadId,order:'asc',paginationOpts:{cursor,numItems:100}});
    native.push(...page.page.map(message=>({_id:message._id,role:message.message?.role,status:message.status,order:message.order,stepOrder:message.stepOrder,agentName:message.agentName})));
    if(page.isDone)break;if(!page.continueCursor||page.continueCursor===cursor)throw new Error('NONADVANCING_CURSOR');cursor=page.continueCursor;if(native.length>1000)throw new Error('FIXTURE_NATIVE_LIMIT');}while(true);}
  return {run,executions,operations:operations.map(row=>({...row,resultCanonical:undefined,requestCanonical:undefined,
      resultBytes:row.resultCanonical?new TextEncoder().encode(row.resultCanonical).length:0})),ingestion,outbox,
    bridges:bridges.map(row=>({_id:row._id,nativeMessageId:row.nativeMessageId,sourceEventId:row.sourceEventId,sourceRevision:row.revision,tombstonedAt:row.tombstonedAt})),native,
    modelOperations:modelOperations.map(row=>({_id:row._id,runBudgetId:runById.get(row.runAccountId)!.runBudgetId,semanticId:row.semanticId,operationKey:row.operationKey,parentOperationId:row.parentOperationId,
      reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits})),
    modelAttempts:attempts.map(row=>({_id:row._id,operationDocumentId:row.operationDocumentId,state:row.state,dispatchIdentity:row.dispatchIdentity,
      slotReleased:row.slotReleased,resultWithheld:row.resultWithheld,reservationUnits:row.reservationUnits,receiptCanonical:row.receiptCanonical,terminalEvidenceCanonical:row.terminalEvidenceCanonical}))};
}});

/** Native Agent stream/save and terminal accounting run normally. Only the subsequent
 * core operation-registration mutation is intentionally dropped; reconcile never bills. */
export const modelSaveGap=internalAction({args:{...agentAttempt,ordinal:v.number()},handler:async(ctx,args)=>{
  let intercepted=false;
  const forwarded:ActionCtx={...ctx,runMutation:async(reference,input)=>{
    if(getFunctionName(reference)==='runtimeAgent:finishOperation'){intercepted=true;throw new Error('INTENTIONAL_COMPONENT_SAVE_CORE_REGISTRATION_GAP');}
    return await ctx.runMutation(reference,input);
  }};
  let failure:unknown;
  try{await modelStepHandler(forwarded,args);}catch(e){failure={name:e instanceof Error?e.name:'unknown',message:e instanceof Error?e.message:'unknown'};}
  if(!intercepted)throw new Error('MODEL_SAVE_GAP_NOT_REACHED');
  return {intercepted, failure, protectedModelNotRetried:true};
}});

/** Fixture-only metadata setup uses the real atomic claim/current authority. It
 * intentionally does not create a Workflow so the single paid save-gap action
 * cannot race a production execution; no executable/model result is fabricated. */
export const armSaveGap=internalMutation({args:{reference:runtimeAuthorityReference,runId:v.string()},handler:async(ctx,args)=>{
  const current=await currentRun(ctx,args.reference,args.runId,'run');
  if(current.row.executionRequested)throw new Error('SAVE_GAP_ALREADY_ARMED');
  await ctx.db.patch('runtimeRuns',current.row._id,{executionRequested:true,streamingRequested:true});
  const claim=await ctx.runMutation(makeFunctionReference<'mutation'>('runs:claimNext'),
    {reference:args.reference,conversationId:current.row.conversationId,leaseMs:300_000});
  if(!claim||claim.runId!==args.runId)throw new Error('SAVE_GAP_CLAIM_FAILED');
  const now=Date.now();
  await ctx.db.insert('runtimeAgentExecutions',{tenantId:args.reference.tenantId,memorySpaceId:args.reference.memorySpaceId!,runId:args.runId,
    attemptNumber:claim.attemptNumber,leaseVersion:claim.leaseVersion,reference:args.reference,state:'ready',streaming:true,
    nextOutputSequence:0,nextModelStep:0,toolCount:0,sourceWitnesses:[],savedMessageIds:[],savedMessagePins:[],createdAt:now,updatedAt:now});
  return {reference:args.reference,runId:args.runId,attemptNumber:claim.attemptNumber,leaseVersion:claim.leaseVersion};
}});

export const prepareSaveGap=internalAction({args:agentAttempt,handler:async(ctx,args)=>{
  await ctx.runAction(makeFunctionReference<'action'>('runtimeAgent:prepareContext'),args);return {prepared:true};
}});
