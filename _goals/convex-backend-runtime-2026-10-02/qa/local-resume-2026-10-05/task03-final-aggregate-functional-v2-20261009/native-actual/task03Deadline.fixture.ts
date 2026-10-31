/** Owned unpaid integration fixture. No clock substitution or provider dispatch. */
import { getFunctionName } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { internalAction, internalMutation, internalQuery, httpAction } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { runtimeAuthorityReference } from './runtimeAuthSchema';
import { readPrivateProviderAsset, storeGeneratedAsset } from './runtimeAssets';
import { downloadAsset, uploadAsset } from './runtimeAssetsHttp';
import { bindTrustedBudget } from './runtimeModelPolicy';
import { conversationById, checkConversation } from './runtimeTranscript';
import { readArtifactContext, artifactMetadataWitness } from './runtimeArtifactContext';
const OWN = { tenantId: 'task03-aggregate-20261009', memorySpaceId: 'aggregate03-20261009' };
function scoped(reference: {tenantId: string; memorySpaceId?: string}) { if (reference.tenantId !== OWN.tenantId || reference.memorySpaceId !== OWN.memorySpaceId) throw Error('NOT_OWNED_TASK03_FIXTURE'); }
type Trace = { name: string; startedAt: number; rpcReturnedAt: number; returnedDeliveryExpiresAt: number | null; releasedAt: number; delayed: boolean };
function delayedContext(ctx: ActionCtx, target: string, delay: boolean, trace: Trace[]): ActionCtx {
  const forwarded = ctx.runMutation.bind(ctx);
  let delayed = false;
  return { ...ctx, runMutation: (async (ref, args) => {
    const name = getFunctionName(ref), startedAt = Date.now();
    const value = await forwarded(ref, args);
    const rpcReturnedAt = Date.now();
    const deadline = value && typeof value === 'object' && 'deliveryExpiresAt' in value ? value.deliveryExpiresAt : undefined;
    const shouldDelay = delay && name === target && !delayed;
    if (shouldDelay) {
      if (typeof deadline !== 'number' || !Number.isSafeInteger(deadline) || deadline < rpcReturnedAt || deadline - rpcReturnedAt > 8000) throw Error('NATIVE_DEADLINE_OUTSIDE_FIXTURE_BOUND');
      delayed = true;
      await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now() + 40)));
    }
    trace.push({ name, startedAt, rpcReturnedAt, returnedDeliveryExpiresAt: typeof deadline === 'number' ? deadline : null, releasedAt: Date.now(), delayed: shouldDelay });
    return value;
  }) as ActionCtx['runMutation'] };
}
function code(error: unknown) {
  return error instanceof ConvexError && typeof error.data === 'object' && error.data && 'code' in error.data ? String(error.data.code) : error instanceof Error ? error.message : 'UNKNOWN_FIXTURE_ERROR';
}
export const privateInput = internalAction({ args: {reference: runtimeAuthorityReference, assetId: v.string(), version: v.number(), delay: v.boolean()}, handler: async (ctx,args) => {
  scoped(args.reference); const trace: Trace[] = [];
  try { const result = await readPrivateProviderAsset(delayedContext(ctx,'runtimeAssets:downloadCheckpoint',args.delay,trace),args.reference,{assetId:args.assetId,version:args.version,protocol:'image-inline-v1'});
    return { outcome:'returned', metadata:result.metadata, protocolBytes:result.protocolBytes, trace, providerDispatches:0 };
  } catch(error) { return {outcome:'withheld',code:code(error),trace,providerDispatches:0}; }
} });
export const generated = internalAction({args:{reference:runtimeAuthorityReference,requestId:v.string(),delay:v.boolean()},handler:async(ctx,args)=>{
  scoped(args.reference); const trace:Trace[]=[];
  try { const result=await storeGeneratedAsset(delayedContext(ctx,'runtimeAssets:storedDeliveryCheckpoint',args.delay,trace),args.reference,
    {requestId:args.requestId,mimeType:'image/png',lineage:{kind:'generated',operationId:'qa-no-model:'+args.requestId,modelId:'fixture-byte-generator'}},new Blob([new Uint8Array([137,80,78,71,3,1,4])]));
    return {outcome:'returned',metadata:result,trace,providerDispatches:0,generatedByQA:true};
  } catch(error) {return {outcome:'withheld',code:code(error),trace,providerDispatches:0,generatedByQA:true};}
}});
type HttpRegistration={_handler:(ctx:ActionCtx,request:Request)=>Promise<Response>};
async function deadlineHttp(ctx:ActionCtx,request:Request,registration:unknown) {
  const url=new URL(request.url);scoped({tenantId:url.searchParams.get('tenantId')??'',memorySpaceId:url.searchParams.get('memorySpaceId')??''});
  const trace:Trace[]=[];const response=await (registration as HttpRegistration)._handler(delayedContext(ctx,'runtimeAssets:downloadCheckpoint',url.searchParams.get('delay')==='1',trace),request);
  const headers=new Headers(response.headers);headers.set('X-Cortex-QA-Trace',JSON.stringify(trace));headers.set('X-Cortex-QA-Only','real-rpc-real-clock-no-provider');
  return new Response(response.body,{status:response.status,headers});
}
export const downloadDeadline=httpAction((ctx,request)=>deadlineHttp(ctx,request,downloadAsset));
export const uploadDeadline=httpAction((ctx,request)=>deadlineHttp(ctx,request,uploadAsset));
/** Explicit projection fixture, not a claim that an LLM generated its text. */
export const seedObservation=internalMutation({args:{reference:runtimeAuthorityReference,conversationId:v.string(),artifactId:v.string(),requestId:v.string()},handler:async(ctx,args)=>{
  scoped(args.reference); const conversation=await conversationById(ctx,args.reference,args.conversationId);if(!conversation)throw Error('MISSING_FIXTURE_CONVERSATION');await checkConversation(ctx,args.reference,conversation,'write');
  const witness=await artifactMetadataWitness(await readArtifactContext(ctx,args.reference,args.artifactId));
  const budget=await bindTrustedBudget(ctx,{reference:args.reference,operationKey:'agent.respond',requestId:args.requestId,requestCanonical:JSON.stringify({kind:'unpaid-observer-projection-fixture',requestId:args.requestId})});
  const now=Date.now(),runId='run:'+args.requestId;
  if(await ctx.db.query('runtimeRuns').withIndex('by_scoped_id',q=>q.eq('tenantId',OWN.tenantId).eq('memorySpaceId',OWN.memorySpaceId).eq('runId',runId)).unique())throw Error('FIXTURE_ALREADY_SEEDED');
  await ctx.db.insert('runtimeRuns',{...OWN,ownerPrincipalId:args.reference.principalId,runId,conversationId:conversation.conversationId,conversationEpoch:conversation.epoch,requestIdentityCanonical:args.requestId,requestIdentityHash:args.requestId,requestCanonical:JSON.stringify({qaOnly:true}),agentId:'unpaid-projection-fixture',agentVersion:1,definitionHash:'a'.repeat(64),authorityReference:args.reference,inputMessageIds:[],queueSequence:1,historyRevision:conversation.historyRevision,...budget,responseStatus:'complete',memoryStatus:'not_requested',graphStatus:'not_requested',attemptNumber:1,outputMessageIds:[],createdAt:now,updatedAt:now});
  await ctx.db.insert('runtimeAgentExecutions',{...OWN,runId,attemptNumber:1,reference:args.reference,leaseVersion:1,state:'complete',streaming:true,nextOutputSequence:2,nextModelStep:0,toolCount:0,sourceWitnesses:[],artifactContextWitnesses:[witness],savedMessageIds:[],contextCompleteness:'complete',createdAt:now,updatedAt:now});
  await ctx.db.insert('runtimeAgentOutput',{...OWN,runId,attemptNumber:1,sequence:1,partCanonical:JSON.stringify({type:'text',text:'UNPAID_TASK03_PROJECTION_SENTINEL'}),final:true,createdAt:now});
  return {runId,conversationId:conversation.conversationId,artifactWitness:witness,runBudgetId:budget.runBudgetId,qaProjection:true,providerDispatches:0};
}});
export const artifactContext=internalMutation({args:{reference:runtimeAuthorityReference,artifactId:v.string()},handler:async(ctx,args)=>{scoped(args.reference);const deadlines:number[]=[];return {metadata:await readArtifactContext(ctx,args.reference,args.artifactId,deadlines),deadlines};}});
export const snapshot=internalQuery({args:{},handler:async ctx=>{
 const accounts=await ctx.db.query('runtimeBudgetAccounts').take(2049),attempts=await ctx.db.query('runtimeModelAttempts').take(2049);if(accounts.length>2048||attempts.length>2048)throw Error('FIXTURE_SNAPSHOT_BOUND');
 return {accounts:accounts.map(row=>({id:row._id,tenantId:row.tenantId,kind:row.kind,root:row.root,windowId:row.windowId,windowStart:row.windowStart,windowEnd:row.windowEnd,limitUnits:row.limitUnits,reservedUnits:row.reservedUnits,settledUnits:row.settledUnits,uncertainUnits:row.uncertainUnits,activeConcurrency:row.activeConcurrency,current:row.current,cancelled:row.cancelled})),attempts:attempts.map(row=>({id:row._id,state:row.state,slotReleased:row.slotReleased,reservationUnits:row.reservationUnits,checkpointAt:row.checkpointAt??null})),modelAttemptCount:attempts.length};
}});
