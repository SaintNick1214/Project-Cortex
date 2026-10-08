/** Admin-internal fixed private-frame commissioning. Provisional fixture trust is not production qualification. */
import {v,ConvexError} from 'convex/values';
import {makeFunctionReference} from 'convex/server';
import {convexGateway} from '@convex-dev/ai-sdk-provider';
import {internalAction,internalMutation,internalQuery} from './_generated/server';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
import {readPrivateProviderAsset} from './runtimeAssets';
import {canonicalModelJson} from './_cortex/shared/domain/model_policy';
import type {ModelPolicySnapshotV1} from './_cortex/shared/domain/model_policy';
import {semanticHash} from './_cortex/shared/domain/profile';
const mutation=(name:string)=>makeFunctionReference<'mutation',Record<string,unknown>,unknown>(name);
const query=(name:string)=>makeFunctionReference<'query',Record<string,unknown>,unknown>(name);
const MODEL='google/veo-3.1',PROMPT='Animate a gentle slow drift in this solid blue frame. Keep the image simple. No text or audio.';
const publicError=(error:unknown)=>{const data=error instanceof ConvexError?error.data:undefined;const code=typeof data==='object'&&data!==null&&'code'in data?String(data.code):error instanceof Error?error.message:'UNKNOWN';return code.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted]').slice(0,512);};
export const begin=internalMutation({args:{key:v.string(),reference:runtimeAuthorityReference,assetId:v.string(),version:v.number(),frameVersionId:v.string(),frameHash:v.string(),bodyHash:v.string(),bodyBytes:v.number(),runBudgetId:v.string(),attemptId:v.id('runtimeModelAttempts')},handler:async(ctx,args)=>{
 const old=await ctx.db.query('task12MediaProbes').withIndex('by_key',q=>q.eq('key',args.key)).unique();if(old){if(old.bodyHash!==args.bodyHash||old.frameVersionId!==args.frameVersionId||old.attemptId!==args.attemptId)throw Error('COMMISSION_IDENTITY_CONFLICT');return {state:old.state,existing:true};}
 const now=Date.now();await ctx.db.insert('task12MediaProbes',{...args,state:'pending',issuedCount:0,createdAt:now,updatedAt:now});return {state:'pending',existing:false};
}});
export const issued=internalMutation({args:{key:v.string(),dispatchIdentity:v.string()},handler:async(ctx,args)=>{
 const row=await ctx.db.query('task12MediaProbes').withIndex('by_key',q=>q.eq('key',args.key)).unique();if(!row||row.state!=='pending'||row.issuedCount!==0)throw Error('COMMISSION_ALREADY_ISSUED');await ctx.db.patch('task12MediaProbes',row._id,{state:'issued',issuedCount:1,dispatchIdentity:args.dispatchIdentity,updatedAt:Date.now()});return null;
}});
export const update=internalMutation({args:{key:v.string(),state:v.union(v.literal('started'),v.literal('completed'),v.literal('failed'),v.literal('unknown')),operation:v.optional(v.string()),inferenceId:v.optional(v.string()),failureCode:v.optional(v.string()),terminalSummary:v.optional(v.any())},handler:async(ctx,args)=>{
 const row=await ctx.db.query('task12MediaProbes').withIndex('by_key',q=>q.eq('key',args.key)).unique();if(!row)throw Error('COMMISSION_MISSING');if(row.state==='completed'||row.state==='failed')throw Error('COMMISSION_TERMINAL');if(args.operation&&row.operation&&args.operation!==row.operation)throw Error('COMMISSION_OPERATION_CONFLICT');
 await ctx.db.patch('task12MediaProbes',row._id,{state:args.state,...args.operation?{operation:args.operation}:{},...args.inferenceId?{inferenceId:args.inferenceId}:{},...args.failureCode?{failureCode:args.failureCode}:{},...args.terminalSummary?{terminalSummary:args.terminalSummary}:{},updatedAt:Date.now()});return null;
}});
export const read=internalQuery({args:{key:v.string()},handler:async(ctx,args)=>await ctx.db.query('task12MediaProbes').withIndex('by_key',q=>q.eq('key',args.key)).unique()});
/** Redacted state, retaining financial and admission facts without private frame/operation bytes. */
export const ledger=internalQuery({args:{tenantId:v.string()},handler:async(ctx,args)=>{
 const accounts=await ctx.db.query('runtimeBudgetAccounts').filter(q=>q.eq(q.field('tenantId'),args.tenantId)).take(21);
 const operations=await ctx.db.query('runtimeModelOperations').withIndex('by_identity',q=>q.eq('tenantId',args.tenantId)).take(21);
 const probes=await ctx.db.query('task12MediaProbes').take(21);if(accounts.length>20||operations.length>20||probes.length>20)throw Error('COMMISSION_SCOPE_LIMIT');
 const attempts=[];for(const operation of operations){const rows=await ctx.db.query('runtimeModelAttempts').withIndex('by_child_attempt',q=>q.eq('operationDocumentId',operation._id)).take(3);for(const row of rows)attempts.push({attemptId:row._id,operationId:operation._id,ordinal:row.ordinal,state:row.state,hash:row.hash,measuredInputTokens:row.measuredInputTokens,maximumOutputTokens:row.maximumOutputTokens,reservationUnits:row.reservationUnits,slotReleased:row.slotReleased,resultWithheld:row.resultWithheld,checkpointAt:row.checkpointAt??null,dispatchIdentity:row.dispatchIdentity,terminalEvidenceHash:row.terminalEvidenceHash??null});}
 return {accounts:accounts.map(row=>({accountId:row._id,kind:row.kind,runBudgetId:row.runBudgetId??null,root:row.root,windowId:row.windowId,windowStart:row.windowStart,windowEnd:row.windowEnd,limitUnits:row.limitUnits,reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,activeConcurrency:row.activeConcurrency,version:row.version,cancelled:row.cancelled??false})),operations:operations.map(row=>({operationId:row._id,operationKey:row.operationKey,semanticId:row.semanticId,reference:row.reference,runAccountId:row.runAccountId,reservedUnits:row.reservedUnits,settledUnits:row.settledUnits,uncertainUnits:row.uncertainUnits,overrun:row.overrun,cancelled:row.cancelled,snapshot:JSON.parse(row.snapshotCanonical)})),attempts,probes:probes.filter(row=>row.reference.tenantId===args.tenantId).map(row=>({key:row.key,assetId:row.assetId,version:row.version,frameVersionId:row.frameVersionId,frameHash:row.frameHash,bodyHash:row.bodyHash,bodyBytes:row.bodyBytes,runBudgetId:row.runBudgetId,attemptId:row.attemptId,state:row.state,issuedCount:row.issuedCount,privateOperationHandleRetained:!!row.operation,failureCode:row.failureCode??null,terminalSummary:row.terminalSummary??null,createdAt:row.createdAt,updatedAt:row.updatedAt}))};
}});
/** Follow only the durable original operation. This does not start or readmit inference. */
export const status=internalAction({args:{reference:runtimeAuthorityReference,key:v.string()},handler:async(ctx,args)=>{
 const row=await ctx.runQuery(makeFunctionReference<'query',Record<string,unknown>,{reference:unknown;operation?:string;attemptId:string;runBudgetId:string;assetId:string;version:number}>('mediaProbe:read'),{key:args.key});
 if(!row||canonicalModelJson(row.reference)!==canonicalModelJson(args.reference))throw Error('COMMISSION_SCOPE_MISMATCH');
 await ctx.runQuery(query('runtimeModelPolicy:resolve'),{reference:args.reference,operationKey:'media.video.generate',runBudgetId:row.runBudgetId});
 await readPrivateProviderAsset(ctx,args.reference,{assetId:row.assetId,version:row.version,protocol:'image-inline-v1'});
 if(!row.operation)return {status:'NO_OBSERVABLE_OPERATION',newGenerationRequests:0,noStartRetry:true};
 const result=await convexGateway.videoModel(MODEL).getStatus({operation:row.operation,abortSignal:AbortSignal.timeout(15000)});
 await ctx.runMutation(mutation('mediaProbe:update'),{key:args.key,state:result.status==='pending'?'started':result.status==='completed'?'completed':'failed',...(result.status==='error'?{failureCode:publicError(Error(result.error))}:{}),terminalSummary:{status:result.status,requestedModelId:result.response.modelId,servingModelUnobserved:true,providerTerminalObserved:result.status!=='pending',costUnavailable:true,privateOutputWithheld:true}});
 // No invented video result, usage or settlement. Native full liability and genuine
 // terminal slot release require the exact later media accounting contract.
 return {status:result.status,requestedModelId:result.response.modelId,servingModelUnobserved:true,newGenerationRequests:0,costUnavailable:true,privateOutputWithheld:true,nativeFinancialReconciliationPending:true};
}});
export const start=internalAction({args:{reference:runtimeAuthorityReference,assetId:v.string(),version:v.number(),key:v.string()},handler:async(ctx,args)=>{
 const asset=await readPrivateProviderAsset(ctx,args.reference,{assetId:args.assetId,version:args.version,protocol:'image-inline-v1'});if(asset.metadata.mimeType!=='image/png'||asset.metadata.sizeBytes>4096||!('image'in asset.envelope))throw Error('COMMISSION_FRAME_UNSUPPORTED');
 const image=asset.envelope.image!;const body={model:MODEL,prompt:PROMPT,resolution:'720p',duration:4,generate_audio:false,frame_images:[{type:'image_url',image_url:{url:image},frame_type:'first_frame'}]};const wire=canonicalModelJson(body),bodyBytes=new TextEncoder().encode(wire).length;if(bodyBytes>8192)throw Error('COMMISSION_BODY_LIMIT');
 const bindingCanonical=canonicalModelJson({key:args.key,assetId:args.assetId,version:args.version,frameVersionId:asset.metadata.versionId,frameHash:asset.metadata.contentHash,bodyHash:await semanticHash(wire)});
 const budget=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{runBudgetId:string}>('runtimeModelPolicy:ensureBudget'),{reference:args.reference,operationKey:'media.video.generate',requestId:args.key,requestCanonical:bindingCanonical});
 const resolved=await ctx.runQuery(makeFunctionReference<'query',Record<string,unknown>,{snapshot:ModelPolicySnapshotV1}>('runtimeModelPolicy:resolve'),{reference:args.reference,operationKey:'media.video.generate',runBudgetId:budget.runBudgetId});const snapshot=resolved.snapshot;
 if(snapshot.modelId!==MODEL||snapshot.nativeInterface!=='video'||snapshot.costBound.maximumCostUnits!==2000000||snapshot.limits.inputTokens<8192||snapshot.fallbackCandidates.length)throw Error('COMMISSION_POLICY_MISMATCH');
 const request={semanticId:args.key,childCallId:args.key,texts:[wire],messages:[{role:'user',parts:[{type:'text',text:wire}]}],inputTokens:1,outputTokens:0,toolSteps:0,timeoutMs:60000,reservationUnits:snapshot.costBound.maximumCostUnits,promptVersion:snapshot.pins.promptVersion,schemaVersion:snapshot.pins.schemaVersion,extractionVersion:snapshot.pins.extractionVersion,toolRegistryVersion:snapshot.pins.toolRegistryVersion,tools:[],options:{maxRetries:0}};
 const admitted=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{status:string;attemptId?:string;requestCanonical?:string}>('runtimeModelPolicy:admit'),{reference:args.reference,operationKey:'media.video.generate',semanticId:args.key,ordinal:0,runBudgetId:budget.runBudgetId,requestCanonical:canonicalModelJson(request)});
 if(admitted.status!=='reserved'||!admitted.attemptId||!admitted.requestCanonical)return {status:'NO_NEW_DISPATCH',nativeAdmission:admitted.status,nativeStartRequests:0,confirmedModelCalls:null,runBudgetId:budget.runBudgetId};
 const attemptId=admitted.attemptId,requestCanonical=admitted.requestCanonical;
 const pending=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{existing:boolean}>('mediaProbe:begin'),{...args,frameVersionId:asset.metadata.versionId,frameHash:asset.metadata.contentHash,bodyHash:await semanticHash(wire),bodyBytes,runBudgetId:budget.runBudgetId,attemptId});
 if(pending.existing)throw Error('COMMISSION_PENDING_RECEIPT_EXISTS');
 const originalFetch=globalThis.fetch;let issued=false,dispatchIdentity:string|undefined,nativeHTTPStatus:number|undefined;
 const sourceBytes=Uint8Array.from(atob(image.slice('data:image/png;base64,'.length)),v=>v.charCodeAt(0));
 globalThis.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url!=='https://ai-gateway.convex.dev/v1/videos'||init?.method!=='POST'||typeof init.body!=='string'||canonicalModelJson(JSON.parse(init.body))!==wire||issued)throw Error('COMMISSION_NATIVE_WIRE_MISMATCH');
  const headers=new Headers(init.headers);if(!headers.get('Authorization')?.startsWith('Bearer '))throw Error('COMMISSION_SERVICE_JWT_MISSING');
  const current=await readPrivateProviderAsset(ctx,args.reference,{assetId:args.assetId,version:args.version,protocol:'image-inline-v1'});if(current.metadata.versionId!==asset.metadata.versionId||current.metadata.contentHash!==asset.metadata.contentHash||!('image'in current.envelope)||current.envelope.image!==image)throw Error('COMMISSION_FRAME_CHANGED');
  const permit=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{dispatchPermit:boolean;dispatchIdentity?:string}>('runtimeModelPolicy:checkpoint'),{reference:args.reference,attemptId,requestCanonical});if(!permit.dispatchPermit||!permit.dispatchIdentity)throw Error('COMMISSION_DISPATCH_DENIED');dispatchIdentity=permit.dispatchIdentity;
  await ctx.runMutation(mutation('mediaProbe:issued'),{key:args.key,dispatchIdentity});issued=true;const response=await originalFetch(input,init);nativeHTTPStatus=response.status;return response;
 };
 try{
  const result=await convexGateway.videoModel(MODEL).doStart({prompt:PROMPT,n:1,duration:4,image:{type:'file',mediaType:'image/png',data:sourceBytes},providerOptions:{convexGateway:{resolution:'720p',generate_audio:false}},abortSignal:AbortSignal.timeout(60000)});
  await ctx.runMutation(mutation('mediaProbe:update'),{key:args.key,state:'started',operation:String(result.operation),inferenceId:String(result.providerMetadata?.convexGateway?.inferenceId??''),terminalSummary:{requestedModelId:result.response.modelId,servingModelUnobserved:true,nativeHTTPStatus:nativeHTTPStatus??null,firstFrameVersionId:asset.metadata.versionId,firstFrameHash:asset.metadata.contentHash,bodyBytes,maxRetries:0,noStorageUrl:true}});
  return {status:'STARTED',key:args.key,runBudgetId:budget.runBudgetId,attemptId,frameVersionId:asset.metadata.versionId,frameHash:asset.metadata.contentHash,frameBytes:asset.metadata.sizeBytes,bodyBytes,requestedModelId:result.response.modelId,servingModelUnobserved:true,nativeHTTPStatus:nativeHTTPStatus??null,nativeStartRequests:1,confirmedModelCalls:null,fullLiabilityUnits:2000000,resultWithheld:true,privateOperationHandleRetained:true};
 }catch(error){
  const code=publicError(error);await ctx.runMutation(mutation('mediaProbe:update'),{key:args.key,state:issued?'unknown':'failed',failureCode:code});
  if(issued)await ctx.runMutation(mutation('runtimeModelPolicy:recover'),{reference:args.reference,attemptId});else await ctx.runMutation(mutation('runtimeModelPolicy:releaseNotDispatched'),{reference:args.reference,attemptId});
  return {status:issued?'UNKNOWN_REQUIRES_RECONCILIATION':'NOT_DISPATCHED',key:args.key,runBudgetId:budget.runBudgetId,attemptId,bodyBytes,errorCode:code,nativeHTTPStatus:nativeHTTPStatus??null,nativeStartRequests:issued?1:0,confirmedModelCalls:null,fullLiabilityUnits:issued?2000000:0,resultWithheld:true,neverRetryStart:true};
 }finally{globalThis.fetch=originalFetch;}
}});
