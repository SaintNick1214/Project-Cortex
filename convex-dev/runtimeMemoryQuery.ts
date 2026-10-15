import { proveDirectFactLookup, directFactLookupSourceId, directFactProofCompatible, directFactTraversalComplete, DIRECT_FACT_RECALL_ROUTE } from "../src/domain/memory-direct-recall";
import type { DerivedFact } from "../src/domain/contracts";
import type { MemoryEffortRequest } from "../src/domain/memory-effort";
import { resolveMemoryEffortPolicy,memoryEffortCandidateLimit } from "../src/domain/memory-effort";
import { traverseConvexMemory,factEvidenceNode,sourceEvidenceNode,createMemoryRetrievalWorkClock } from "./runtimeMemoryTraversal";
import { memoryEffortRequest } from "./runtimeMemorySchema";
import { publicRecallBudgetRequest } from "./runtimeMemoryServices";
/** Original public recall preparation in one fresh native snapshot. */
import {v} from 'convex/values';
import {makeFunctionReference} from 'convex/server';
import type {FunctionReference} from 'convex/server';
import {internalQuery,internalMutation} from './_generated/server';
import type {QueryCtx,MutationCtx,ActionCtx} from './_generated/server';
import type {RuntimeAuthorityReference} from '../src/auth/verified';
import type {MemoryModel,MemoryRepository} from '../src/domain/contracts';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
import {createAuthorityReadScope,createMemorySourceReadScope,withNativeSnapshotReads} from './runtimeAuth';
import {canonicalModelJson} from '../src/domain/model-policy';
import {normalizeSourceText,semanticHash} from '../src/domain/profile';
import {ConvexMemoryRepository,memoryError,memoryScope,captureRecallVectors,captureRecallFact,vectorScopeKey,vectorOwnerScopeKey} from './runtimeMemoryRepository';
import type {MemoryDeliveryBindings} from './runtimeMemoryRepository';
import {assertMemoryRequestId,completeRecallDelivery,vectorRecallItems} from './runtimeMemoryServices';
import {validateModelEmbeddings} from '../src/domain/sources';
import {LARGE_EMBEDDING_PROFILE} from '../src/domain/profile';
import type {EmbeddingProfile} from '../src/domain/profile';
import type {Id} from './_generated/dataModel';
import {embeddingProfile,memoryDeliveryBindings} from './runtimeMemorySchema';
import {readCurrentEmbeddingProfile,resolveHandler,admitHandler,MODEL_LEDGER_STORAGE_LIMITS} from './runtimeModelPolicy';
import {GatewayDispatchError,assertGatewayReservedRequest} from './runtimeGateway';
import type {GatewayBinding,GatewayResolution,GatewayCheckpoint,GatewayAdmissionCheckpoint} from './runtimeGateway';
import {createGatewayMemoryModel} from './runtimeMemoryGateway';
import {boundedRefusal,throwRefusal} from './runtimeMemoryRefusal';
import type {Refusal} from './runtimeMemoryRefusal';
import {traceRuntimePhase} from './runtimeLatencyTrace';
type Input={text:string;requestId:string;limit:number;memory?:MemoryEffortRequest};
type Args={reference:RuntimeAuthorityReference;runBudgetId:string;input:Input};
const args={reference:runtimeAuthorityReference,runBudgetId:v.string(),input:v.object({text:v.string(),requestId:v.string(),limit:v.number(),memory:v.optional(memoryEffortRequest)})};
async function binding(ctx:Pick<QueryCtx,'db'|'runQuery'>,a:Args) {
  assertMemoryRequestId(a.input.requestId);const text=normalizeSourceText(a.input.text);
  if(!Number.isSafeInteger(a.input.limit)||a.input.limit<1||a.input.limit>100)memoryError('INVALID_INPUT','Limit must be between 1 and 100');
  const key=canonicalModelJson(['run',a.reference.tenantId,a.reference.memorySpaceId,a.reference.principalId,'embedding.query',a.input.requestId]);
  if(await semanticHash(key)!==a.runBudgetId)memoryError('POLICY_DENIED','Recall budget binding changed');
  const accounts=await ctx.db.query('runtimeBudgetAccounts').withIndex('by_run',q=>q.eq('runBudgetId',a.runBudgetId)).take(2);
  if(accounts.length!==1||accounts[0].requestCanonical!==canonicalModelJson(publicRecallBudgetRequest(text,a.input.limit,a.input.memory)))memoryError('POLICY_DENIED','Recall request binding changed');
  const profile=await readCurrentEmbeddingProfile(ctx,a.reference,'embedding.query',a.runBudgetId);
  const operationId=`embedding.query:${JSON.stringify([a.reference.tenantId,a.reference.memorySpaceId,a.reference.principalId,a.input.requestId,profile.profileId])}`;
  const request:Parameters<MemoryModel['embed']>[0]={purpose:'embedding.query',operationId,policyVersion:profile.profileId,attempt:1,profile,texts:[text]};
  const semanticId=await semanticHash(canonicalModelJson([request.purpose,request.operationId,request.policyVersion]));
  const selected:GatewayBinding={reference:a.reference,operationKey:'embedding.query',runBudgetId:a.runBudgetId,semanticId,ordinal:0};
  return {profile,request,binding:selected};
}
function resolution(value:Awaited<ReturnType<typeof resolveHandler>>):GatewayResolution {
  if(value.storageLimits.embeddingValuesPerCall!==1)throw new GatewayDispatchError('CAPABILITY_UNAVAILABLE');
  return {...value,storageLimits:{...value.storageLimits,embeddingValuesPerCall:1}};
}
export async function preparePublicRecallHandler(ctx:QueryCtx,a:Args) {
  const repository=new ConvexMemoryRepository(ctx,a.reference,'read',undefined,{now:()=>Date.now()},(key,id)=>readCurrentEmbeddingProfile(ctx,a.reference,key,id));
  // Original public readiness control remains first; its failures stay not-dispatched.
  const controlProfile=await readCurrentEmbeddingProfile(ctx,a.reference,'embedding.query',a.runBudgetId);
  await repository.assertProfileReady(controlProfile,a.runBudgetId);
  try {
    await repository.recheckAuthority();await repository.assertReadAuthority();
    await repository.recheckAuthority();const selected=await binding(ctx,a);
    await repository.assertProfileReady(selected.profile,a.runBudgetId);
    await repository.recheckAuthority();
    const initial=resolution(await resolveHandler(ctx,selected.binding)),governed=resolution(await resolveHandler(ctx,selected.binding));
    return {kind:'prepared' as const,...selected,resolutions:[initial,governed] as const};
  }catch(error){return {kind:'refused' as const,refusal:boundedRefusal(error)};}
}
export const prepare=internalQuery({args,handler:(ctx,a)=>preparePublicRecallHandler(createMemorySourceReadScope(ctx),a)});
type AdmitArgs=Args&{bindingCanonical:string;requestCanonical:string;snapshotCanonical:string};
type Admission={result:GatewayAdmissionCheckpoint}|{refusal:Refusal};
const checkpoint=makeFunctionReference('runtimeModelPolicy:checkpointRecall') as unknown as FunctionReference<'mutation','internal',
  {reference:RuntimeAuthorityReference;attemptId:Parameters<typeof assertGatewayReservedRequest>[0]['attemptId'];requestCanonical:string},GatewayCheckpoint>;
export async function admitPublicRecallHandler(ctx:MutationCtx,a:AdmitArgs):Promise<Admission> {
  const selected=await binding(ctx,a);
  if(a.bindingCanonical!==canonicalModelJson(selected.binding))memoryError('POLICY_DENIED','Recall admission binding changed');
  let request:Record<string,unknown>;
  try{request=JSON.parse(a.requestCanonical) as Record<string,unknown>;}catch{return memoryError('INVALID_INPUT','Invalid recall embedding request');}
  if(!request||request.semanticId!==selected.binding.semanticId||canonicalModelJson(request.texts)!==canonicalModelJson(selected.request.texts)
    ||canonicalModelJson(request.profile)!==canonicalModelJson(selected.profile)||canonicalModelJson(request.batch)!==canonicalModelJson({ordinal:0,start:0,end:1}))memoryError('POLICY_DENIED','Recall embedding request changed');
  const admission=await admitHandler(ctx,{...selected.binding,requestCanonical:a.requestCanonical});
  if(admission.status!=='reserved')return {result:{admission}};
  try {
    assertGatewayReservedRequest(admission,a.requestCanonical,a.snapshotCanonical,MODEL_LEDGER_STORAGE_LIMITS.canonicalBytes);
    const permit=await ctx.runMutation(checkpoint,{reference:a.reference,attemptId:admission.attemptId,requestCanonical:admission.requestCanonical});
    return {result:{admission,permit}};
  }catch(error){return {refusal:boundedRefusal(error)};}
}
export const admit=internalMutation({args:{...args,bindingCanonical:v.string(),requestCanonical:v.string(),snapshotCanonical:v.string()},
  handler:(ctx,a)=>admitPublicRecallHandler(createAuthorityReadScope(ctx,{policyMetadata:true}),a)});
export const publicRecallPreparation=makeFunctionReference('runtimeMemoryQuery:prepare') as unknown as FunctionReference<'query','internal',Args,Awaited<ReturnType<typeof preparePublicRecallHandler>>>;
const admitRef=makeFunctionReference('runtimeMemoryQuery:admit') as unknown as FunctionReference<'mutation','internal',AdmitArgs,Admission>;
/** Public native read parents only. No model proposal grants retrieval authority.
 * Keep ANN outside Convex queries and ranking before the independent final mutation. */
// Private Action epoch, not a client deadline/policy or a delivery authority proof.
type ReadArgs=Args&{profile:EmbeddingProfile;retrievalStartedAt?:number};
function directLimit(input:Input){return input.memory===undefined?input.limit:Math.min(input.limit,memoryEffortCandidateLimit(resolveMemoryEffortPolicy(input.memory)));}
const readArgs={...args,profile:embeddingProfile,retrievalStartedAt:v.optional(v.number())};
function readRepository(ctx:QueryCtx,a:ReadArgs) {
  assertMemoryRequestId(a.input.requestId);
  if(!Number.isSafeInteger(a.input.limit)||a.input.limit<1||a.input.limit>100)memoryError('INVALID_INPUT','Limit must be between 1 and 100');
  return new ConvexMemoryRepository(ctx,a.reference,'read',undefined,{now:()=>Date.now()},
    (key,id)=>readCurrentEmbeddingProfile(ctx,a.reference,key,id));
}
export async function prepareRecallReadsHandler(nativeCtx:QueryCtx,a:ReadArgs) {
  const ctx=createMemorySourceReadScope(nativeCtx),repository=readRepository(ctx,a);
  const authority=await repository.authority(undefined,'read');
  await repository.assertProfileReady(a.profile,a.runBudgetId);
  return {resourceAccess:authority.resourceAccess};
}
export const prepareReads=internalQuery({args:readArgs,handler:prepareRecallReadsHandler});
export async function readRecallMatchesHandler(nativeCtx:QueryCtx,a:ReadArgs&{hits:{id:Id<'runtimeMemoryVectors'>;score:number}[]},directFacts?:{facts:DerivedFact[];candidateWorkBound:boolean},inspectFact?:(fact:DerivedFact)=>void,workClock=createMemoryRetrievalWorkClock()) {
  const ctx=createMemorySourceReadScope(nativeCtx),repository=readRepository(ctx,a);
  const bindings:MemoryDeliveryBindings={sources:[],facts:[],vectors:[]};
  const sourceCtx=withNativeSnapshotReads(nativeCtx,ctx);
  // Isolated branches retain the original staged vector-first failure order;
  // both reads run even when a peer fails, with no unowned late rejection.
  const [vectorRead,factRead]=await Promise.allSettled([
    Promise.resolve().then(async()=>{
      const matches=await repository.hydrateVectors(a.hits,a.profile,a.runBudgetId),branch:MemoryDeliveryBindings={sources:[],facts:[],vectors:[]};
      await captureRecallVectors(branch,matches,a.profile,{runBudgetId:a.runBudgetId});return {matches,bindings:branch};
    }),
    Promise.resolve().then(async()=>{
      const candidates=directFacts??(a.input.memory===undefined?{facts:await repository.listFacts({limit:a.input.limit}),candidateWorkBound:false}:await repository.searchFactCandidates(a.input.text,directLimit(a.input))),facts=candidates.facts,branch:MemoryDeliveryBindings={sources:[],facts:[],vectors:[]};
      for(const fact of facts)await captureRecallFact(branch,fact,
        await new ConvexMemoryRepository(sourceCtx,a.reference,'read').getSource(fact.lineage.sourceId,directFacts?'canViewFacts':undefined));
      await new ConvexMemoryRepository(nativeCtx,a.reference,'read').recheckAuthority();
      return {facts,bindings:branch,candidateWorkBound:candidates.candidateWorkBound};
    }),
  ]);
  if(vectorRead.status==='rejected')throw vectorRead.reason;
  if(factRead.status==='rejected')throw factRead.reason;
  const {matches}=vectorRead.value,{facts}=factRead.value;
  for(const branch of [vectorRead.value.bindings,factRead.value.bindings]) {
    for(const source of branch.sources)if(!bindings.sources.some(value=>canonicalModelJson(value)===canonicalModelJson(source)))bindings.sources.push(source);
    for(const fact of branch.facts)if(!bindings.facts.some(value=>value.factId===fact.factId&&value.payloadHash===fact.payloadHash))bindings.facts.push(fact);
    bindings.vectors.push(...branch.vectors);
  }
  // Original post-staged authority fence remains raw and current.
  await new ConvexMemoryRepository(nativeCtx,a.reference,'read').recheckAuthority();
  const effortResult=a.input.memory===undefined?undefined:await traverseConvexMemory(sourceCtx,repository,[...matches.map(match=>({...sourceEvidenceNode(match.source,match.score),item:vectorRecallItems([match])[0]!})),...facts.map(fact=>factEvidenceNode(fact,directFacts?1:undefined))],resolveMemoryEffortPolicy(a.input.memory),bindings,undefined,inspectFact,a.input.text,a.retrievalStartedAt,workClock);
  if(effortResult)for(const stage of [...(factRead.value.candidateWorkBound?["direct-fact-candidate-work-bound"]:[]),...(a.hits.length===directLimit(a.input)?["direct-vector-candidate-work-bound"]:[])]){
    if(!effortResult.memoryEffort.unavailableStages.includes(stage))effortResult.memoryEffort.unavailableStages.push(stage);
    if(!effortResult.memoryEffort.stopReasons.includes("work"))effortResult.memoryEffort.stopReasons.push("work");
  }
  if(effortResult&&a.input.text.length>1024){effortResult.memoryEffort.unavailableStages.push("query-search-work-bound");effortResult.memoryEffort.stopReasons.push("work");}
  if(effortResult)effortResult.memoryEffort.retrievalRoute=directFacts?DIRECT_FACT_RECALL_ROUTE:'semantic-v1';
  return {vectorItems:vectorRecallItems(matches),facts,bindings,...(effortResult?{effortResult}:{})};
}
export const readMatches=internalQuery({args:{...readArgs,hits:v.array(v.object({id:v.id('runtimeMemoryVectors'),score:v.number()}))},handler:readRecallMatchesHandler});
/** Independent final mutation follows Action ranking; every source is read again. */
export async function finalRecallDeliveryHandler(nativeCtx:QueryCtx|MutationCtx,a:{reference:RuntimeAuthorityReference;bindings:MemoryDeliveryBindings}) {
  const ctx=createMemorySourceReadScope(nativeCtx);
  return await new ConvexMemoryRepository(ctx,a.reference,'read',undefined,{now:()=>Date.now()},
    (key,id)=>readCurrentEmbeddingProfile(ctx,a.reference,key,id)).checkDelivery(a.bindings,nativeCtx);
}
export const finalRecallDelivery=internalMutation({args:{reference:runtimeAuthorityReference,bindings:memoryDeliveryBindings},handler:finalRecallDeliveryHandler});
const finalRecallDeliveryRef=makeFunctionReference('runtimeMemoryQuery:finalRecallDelivery') as unknown as FunctionReference<'mutation','internal',Parameters<typeof finalRecallDeliveryHandler>[1],Awaited<ReturnType<typeof finalRecallDeliveryHandler>>>;
const prepareReadsRef=makeFunctionReference('runtimeMemoryQuery:prepareReads') as unknown as FunctionReference<'query','internal',ReadArgs,Awaited<ReturnType<typeof prepareRecallReadsHandler>>>;
const readMatchesRef=makeFunctionReference('runtimeMemoryQuery:readMatches') as unknown as FunctionReference<'query','internal',Parameters<typeof readRecallMatchesHandler>[1],Awaited<ReturnType<typeof readRecallMatchesHandler>>>;
export async function finishPublicRecall(ctx:ActionCtx,a:ReadArgs,embedded:Awaited<ReturnType<MemoryModel['embed']>>,clock={now:()=>Date.now()},startedAt?:number) {
  validateModelEmbeddings(embedded,a.profile,1);
  if(startedAt===undefined&&a.input.memory!==undefined)startedAt=clock.now();
  const plan=await ctx.runQuery(prepareReadsRef,a),scope=memoryScope(a.reference);
  const hits=await ctx.vectorSearch('runtimeMemoryVectors',a.profile.indexName===LARGE_EMBEDDING_PROFILE.indexName?'by_large_embedding_v1':'by_default_embedding_v1',{
    vector:[...embedded.vectors[0]!],limit:directLimit(a.input),filter:q=>plan.resourceAccess==='own'
      ?q.eq('scopeProfileOwnerKey',vectorOwnerScopeKey(scope.tenantId,scope.memorySpaceId,a.profile.profileId,scope.principalId))
      :q.eq('scopeProfileKey',vectorScopeKey(scope.tenantId,scope.memorySpaceId,a.profile.profileId)),
  });
  const read=await ctx.runQuery(readMatchesRef,{...a,...(startedAt===undefined?{}:{retrievalStartedAt:startedAt}),hits:hits.map(hit=>({id:hit._id,score:hit._score}))});
  return await completeRecallDelivery({clock,finalDelivery:async()=>await ctx.runMutation(finalRecallDeliveryRef,{reference:a.reference,bindings:read.bindings})},
    a.input,a.profile.profileId,read.vectorItems,read.facts,read.effortResult,startedAt);
}
/** A direct miss is a discovery decision only. Errors propagate, and fallback
 * keeps the exact original governed embedding operation/financial boundaries. */
export async function readDirectPublicRecallHandler(nativeCtx:QueryCtx,a:Args&{retrievalStartedAt?:number}){
  const workClock=createMemoryRetrievalWorkClock();
  if(a.input.memory===undefined)return null;
  const ctx=createMemorySourceReadScope(nativeCtx),selected=await binding(ctx,a);
  const repository=readRepository(ctx,{...a,profile:selected.profile});
  await repository.assertReadAuthority();await repository.assertProfileReady(selected.profile,a.runBudgetId);
  const candidates=await repository.searchFactCandidates(a.input.text,directLimit(a.input));
  const proofVersion=resolveMemoryEffortPolicy(a.input.memory).literalSourceProofVersion;
  const sourceId=directFactLookupSourceId(a.input.text,candidates,Date.now(),proofVersion);
  const source=sourceId===undefined?undefined:await repository.getSource(sourceId,'canViewFacts');
  const proof=proveDirectFactLookup(a.input.text,candidates,Date.now(),proofVersion,source??undefined),sufficient=proof!==undefined;
  traceRuntimePhase(a.runBudgetId,1,`recall.direct.candidates.${candidates.candidateWorkBound?'work-bound':sufficient?'sufficient':'insufficient'}`,{selectedFacts:candidates.facts.length});
  if(!proof)return null;
  let compatible=true;
  const read=await readRecallMatchesHandler(nativeCtx,{...a,profile:selected.profile,hits:[]},candidates,fact=>{compatible=compatible&&directFactProofCompatible(proof,[fact],Date.now());},workClock);
  const trace=read.effortResult?.memoryEffort,hasFact=!!read.effortResult?.items.some(item=>item.type==='fact');
  const complete=trace!==undefined&&directFactTraversalComplete(trace);
  traceRuntimePhase(a.runBudgetId,1,`recall.direct.traversal.${!hasFact?'no-fact':!compatible?'conflict':!complete?'partial':'ready'}`,{selectedFacts:trace?.entriesByKind.fact,selectedMemories:trace?.entriesByKind.memory,durationMs:trace?.durationMs});
  for(const reason of trace?.stopReasons??[])traceRuntimePhase(a.runBudgetId,1,`recall.direct.stop.${reason}`);
  if(!hasFact||!compatible||!complete||!read.effortResult)return null;
  const delivery=await finalRecallDeliveryHandler(nativeCtx,{reference:a.reference,bindings:read.bindings});
  return {read,delivery,profileId:selected.profile.profileId};
}
export const directReads=internalQuery({args:{...args,retrievalStartedAt:v.optional(v.number())},handler:readDirectPublicRecallHandler});
const directReadsRef=makeFunctionReference('runtimeMemoryQuery:directReads') as unknown as FunctionReference<'query','internal',Parameters<typeof readDirectPublicRecallHandler>[1],Awaited<ReturnType<typeof readDirectPublicRecallHandler>>>;
/** Budget creation/capture/attachment keep their original independent committed boundaries. */
export async function recallPublicMemory(ctx:ActionCtx,reference:RuntimeAuthorityReference,repository:MemoryRepository,runBudgetId:string,input:Input,proposal:Awaited<ReturnType<typeof preparePublicRecallHandler>>) {
  if(proposal.kind==='refused')return throwRefusal(proposal.refusal);
  const native={reference,runBudgetId,input};
  if(input.memory!==undefined){
    const startedAt=Date.now(),direct=await ctx.runQuery(directReadsRef,{...native,retrievalStartedAt:startedAt});
    if(direct)return await completeRecallDelivery({clock:{now:()=>Date.now()},finalDelivery:async()=>direct.delivery},input,direct.profileId,direct.read.vectorItems,direct.read.facts,direct.read.effortResult,startedAt);
  }
  const model=createGatewayMemoryModel(ctx,repository,{runBudgetId,queryEmbedding:{binding:proposal.binding,requestCanonical:canonicalModelJson(proposal.request),resolutions:proposal.resolutions,
    refresh:async()=>{const next=await ctx.runQuery(publicRecallPreparation,native);if(next.kind==='refused')return throwRefusal(next.refusal);return next.resolutions[1];},
    admitAndCheckpoint:async request=>{
      const result=await ctx.runMutation(admitRef,{...native,requestCanonical:request.requestCanonical,snapshotCanonical:request.snapshotCanonical,
        bindingCanonical:canonicalModelJson({reference:request.reference,operationKey:request.operationKey,runBudgetId:request.runBudgetId,semanticId:request.semanticId,ordinal:request.ordinal,
          ...(request.source===undefined?{}:{source:request.source}),...(request.parentOperationId===undefined?{}:{parentOperationId:request.parentOperationId})})});
      if('refusal' in result)return throwRefusal(result.refusal);return result.result;
    }}});
  const embedded=await model.embed(proposal.request);
  const startedAt=Date.now();
  return await finishPublicRecall(ctx,{...native,input:{...input,text:normalizeSourceText(input.text)},profile:proposal.profile},embedded,undefined,startedAt);
}
