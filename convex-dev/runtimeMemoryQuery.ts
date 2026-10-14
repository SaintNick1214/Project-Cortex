/** Original public recall preparation in one fresh native snapshot. */
import {v} from 'convex/values';
import {makeFunctionReference} from 'convex/server';
import type {FunctionReference} from 'convex/server';
import {internalQuery,internalMutation} from './_generated/server';
import type {QueryCtx,MutationCtx,ActionCtx} from './_generated/server';
import type {RuntimeAuthorityReference} from '../src/auth/verified';
import type {MemoryModel,MemoryRepository} from '../src/domain/contracts';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
import {createAuthorityReadScope} from './runtimeAuth';
import {canonicalModelJson} from '../src/domain/model-policy';
import {normalizeSourceText,semanticHash} from '../src/domain/profile';
import {ConvexMemoryRepository,memoryError} from './runtimeMemoryRepository';
import {assertMemoryRequestId,finishRecallFromEmbedding} from './runtimeMemoryServices';
import {readCurrentEmbeddingProfile,resolveHandler,admitHandler,MODEL_LEDGER_STORAGE_LIMITS} from './runtimeModelPolicy';
import {GatewayDispatchError,assertGatewayReservedRequest} from './runtimeGateway';
import type {GatewayBinding,GatewayResolution,GatewayCheckpoint,GatewayAdmissionCheckpoint} from './runtimeGateway';
import {createGatewayMemoryModel} from './runtimeMemoryGateway';
import {boundedRefusal,throwRefusal} from './runtimeMemoryRefusal';
import type {Refusal} from './runtimeMemoryRefusal';
type Input={text:string;requestId:string;limit:number};
type Args={reference:RuntimeAuthorityReference;runBudgetId:string;input:Input};
const args={reference:runtimeAuthorityReference,runBudgetId:v.string(),input:v.object({text:v.string(),requestId:v.string(),limit:v.number()})};
async function binding(ctx:Pick<QueryCtx,'db'|'runQuery'>,a:Args) {
  assertMemoryRequestId(a.input.requestId);const text=normalizeSourceText(a.input.text);
  if(!Number.isSafeInteger(a.input.limit)||a.input.limit<1||a.input.limit>100)memoryError('INVALID_INPUT','Limit must be between 1 and 100');
  const key=canonicalModelJson(['run',a.reference.tenantId,a.reference.memorySpaceId,a.reference.principalId,'embedding.query',a.input.requestId]);
  if(await semanticHash(key)!==a.runBudgetId)memoryError('POLICY_DENIED','Recall budget binding changed');
  const accounts=await ctx.db.query('runtimeBudgetAccounts').withIndex('by_run',q=>q.eq('runBudgetId',a.runBudgetId)).take(2);
  if(accounts.length!==1||accounts[0].requestCanonical!==canonicalModelJson({purpose:'recall',text,limit:a.input.limit}))memoryError('POLICY_DENIED','Recall request binding changed');
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
export const prepare=internalQuery({args,handler:(ctx,a)=>preparePublicRecallHandler(createAuthorityReadScope(ctx,{policyMetadata:true}),a)});
type AdmitArgs=Args&{bindingCanonical:string;requestCanonical:string;snapshotCanonical:string};
type Admission={result:GatewayAdmissionCheckpoint}|{refusal:Refusal};
const checkpoint=makeFunctionReference('runtimeModelPolicy:checkpoint') as unknown as FunctionReference<'mutation','internal',
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
/** Budget creation/capture/attachment keep their original independent committed boundaries. */
export async function recallPublicMemory(ctx:ActionCtx,reference:RuntimeAuthorityReference,repository:MemoryRepository,runBudgetId:string,input:Input,proposal:Awaited<ReturnType<typeof preparePublicRecallHandler>>) {
  if(proposal.kind==='refused')return throwRefusal(proposal.refusal);
  const native={reference,runBudgetId,input};
  const model=createGatewayMemoryModel(ctx,repository,{runBudgetId,queryEmbedding:{binding:proposal.binding,requestCanonical:canonicalModelJson(proposal.request),resolutions:proposal.resolutions,
    refresh:async()=>{const next=await ctx.runQuery(publicRecallPreparation,native);if(next.kind==='refused')return throwRefusal(next.refusal);return next.resolutions[1];},
    admitAndCheckpoint:async request=>{
      const result=await ctx.runMutation(admitRef,{...native,requestCanonical:request.requestCanonical,snapshotCanonical:request.snapshotCanonical,
        bindingCanonical:canonicalModelJson({reference:request.reference,operationKey:request.operationKey,runBudgetId:request.runBudgetId,semanticId:request.semanticId,ordinal:request.ordinal,
          ...(request.source===undefined?{}:{source:request.source}),...(request.parentOperationId===undefined?{}:{parentOperationId:request.parentOperationId})})});
      if('refusal' in result)return throwRefusal(result.refusal);return result.result;
    }}});
  const embedded=await model.embed(proposal.request);
  return finishRecallFromEmbedding({repository,clock:{now:()=>Date.now()}},{text:normalizeSourceText(input.text),limit:input.limit},{profile:proposal.profile,runBudgetId},embedded);
}
