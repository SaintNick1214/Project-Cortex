/** Distinct synchronous private-frame qualification, never an async retry or shipped bypass. */
import {v,ConvexError} from 'convex/values';
import {makeFunctionReference} from 'convex/server';
import {convexGateway} from '@convex-dev/ai-sdk-provider';
import {internalAction} from './_generated/server';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
import {readPrivateProviderAsset,storeGeneratedAsset} from './runtimeAssets';
import {canonicalModelJson} from './_cortex/shared/domain/model_policy';
import type {ModelPolicySnapshotV1} from './_cortex/shared/domain/model_policy';
import {semanticHash} from './_cortex/shared/domain/profile';
const mutation=(name:string)=>makeFunctionReference<'mutation',Record<string,unknown>,unknown>(name);
const MODEL='google/veo-3.1',PROMPT='Move this simple solid blue frame gently upward over the four second clip. Preserve the blue color. No text or sound.';
const publicError=(error:unknown)=>{const data=error instanceof ConvexError?error.data:undefined;return (typeof data==='object'&&data!==null&&'code'in data?String(data.code):error instanceof Error?error.message:'UNKNOWN').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted]').slice(0,512);};
export const start=internalAction({args:{reference:runtimeAuthorityReference,assetId:v.string(),version:v.number(),key:v.string()},handler:async(ctx,args)=>{
 const asset=await readPrivateProviderAsset(ctx,args.reference,{assetId:args.assetId,version:args.version,protocol:'image-inline-v1'});if(asset.metadata.mimeType!=='image/png'||asset.metadata.sizeBytes>4096||!('image'in asset.envelope))throw Error('COMMISSION_FRAME_UNSUPPORTED');
 const image=asset.envelope.image!;const body={model:MODEL,prompt:PROMPT,resolution:'720p',duration:4,generate_audio:false,frame_images:[{type:'image_url',image_url:{url:image},frame_type:'first_frame'}]};const wire=canonicalModelJson(body),bodyBytes=new TextEncoder().encode(wire).length;if(bodyBytes>8192)throw Error('COMMISSION_BODY_LIMIT');
 const bindingCanonical=canonicalModelJson({key:args.key,assetId:args.assetId,version:args.version,frameVersionId:asset.metadata.versionId,frameHash:asset.metadata.contentHash,bodyHash:await semanticHash(wire)});
 const budget=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{runBudgetId:string}>('runtimeModelPolicy:ensureBudget'),{reference:args.reference,operationKey:'media.video.generate',requestId:args.key,requestCanonical:bindingCanonical});
 const resolved=await ctx.runQuery(makeFunctionReference<'query',Record<string,unknown>,{snapshot:ModelPolicySnapshotV1}>('runtimeModelPolicy:resolve'),{reference:args.reference,operationKey:'media.video.generate',runBudgetId:budget.runBudgetId});const snapshot=resolved.snapshot;
 if(snapshot.modelId!==MODEL||snapshot.nativeInterface!=='video'||snapshot.costBound.maximumCostUnits!==2000000||snapshot.limits.inputTokens<8192||snapshot.fallbackCandidates.length)throw Error('COMMISSION_POLICY_MISMATCH');
 const request={semanticId:args.key,childCallId:args.key,texts:[wire],messages:[{role:'user',parts:[{type:'text',text:wire}]}],inputTokens:1,outputTokens:0,toolSteps:0,timeoutMs:180000,reservationUnits:snapshot.costBound.maximumCostUnits,promptVersion:snapshot.pins.promptVersion,schemaVersion:snapshot.pins.schemaVersion,extractionVersion:snapshot.pins.extractionVersion,toolRegistryVersion:snapshot.pins.toolRegistryVersion,tools:[],options:{maxRetries:0}};
 const admitted=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{status:string;attemptId?:string;requestCanonical?:string}>('runtimeModelPolicy:admit'),{reference:args.reference,operationKey:'media.video.generate',semanticId:args.key,ordinal:0,runBudgetId:budget.runBudgetId,requestCanonical:canonicalModelJson(request)});
 if(admitted.status!=='reserved'||!admitted.attemptId||!admitted.requestCanonical)return {status:'NO_NEW_DISPATCH',nativeAdmission:admitted.status,nativeStartRequests:0,confirmedModelCalls:null,runBudgetId:budget.runBudgetId};
 const attemptId=admitted.attemptId,requestCanonical=admitted.requestCanonical;
 const pending=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{existing:boolean}>('mediaProbe:begin'),{...args,frameVersionId:asset.metadata.versionId,frameHash:asset.metadata.contentHash,bodyHash:await semanticHash(wire),bodyBytes,runBudgetId:budget.runBudgetId,attemptId});
 if(pending.existing)throw Error('COMMISSION_PENDING_RECEIPT_EXISTS');
 const originalFetch=globalThis.fetch;let issued=false,dispatchIdentity:string|undefined,nativeHTTPStatus:number|undefined;
 const sourceBytes=Uint8Array.from(atob(image.slice('data:image/png;base64,'.length)),v=>v.charCodeAt(0));
 globalThis.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url!=='https://ai-gateway.convex.dev/v1/videos/generations'||init?.method!=='POST'||typeof init.body!=='string'||canonicalModelJson(JSON.parse(init.body))!==wire||issued)throw Error('COMMISSION_NATIVE_WIRE_MISMATCH');
  const headers=new Headers(init.headers);if(!headers.get('Authorization')?.startsWith('Bearer '))throw Error('COMMISSION_SERVICE_JWT_MISSING');
  const current=await readPrivateProviderAsset(ctx,args.reference,{assetId:args.assetId,version:args.version,protocol:'image-inline-v1'});if(current.metadata.versionId!==asset.metadata.versionId||current.metadata.contentHash!==asset.metadata.contentHash||!('image'in current.envelope)||current.envelope.image!==image)throw Error('COMMISSION_FRAME_CHANGED');
  const permit=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{dispatchPermit:boolean;dispatchIdentity?:string}>('runtimeModelPolicy:checkpoint'),{reference:args.reference,attemptId,requestCanonical});if(!permit.dispatchPermit||!permit.dispatchIdentity)throw Error('COMMISSION_DISPATCH_DENIED');dispatchIdentity=permit.dispatchIdentity;
  await ctx.runMutation(mutation('mediaProbe:issued'),{key:args.key,dispatchIdentity});issued=true;const response=await originalFetch(input,init);nativeHTTPStatus=response.status;
  if(!response.body)throw Error('NATIVE_RESPONSE_BODY_MISSING');const reader=response.body.getReader(),chunks:ArrayBuffer[]=[];let total=0;
  try{for(;;){const item=await reader.read();if(item.done)break;total+=item.value.byteLength;if(total>28000000)throw Error('NATIVE_ENCODED_RESPONSE_TOO_LARGE');chunks.push(new Uint8Array(item.value).buffer);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  return new Response(new Blob(chunks),{status:response.status,statusText:response.statusText,headers:response.headers});
 };
 try{
  const native=convexGateway.videoModel(MODEL);if(!native.doGenerate)throw Error('SYNC_VIDEO_UNAVAILABLE');
  const result=await native.doGenerate({prompt:PROMPT,n:1,duration:4,image:{type:'file',mediaType:'image/png',data:sourceBytes},providerOptions:{convexGateway:{resolution:'720p',generate_audio:false}},abortSignal:AbortSignal.timeout(180000)});
  if(result.videos.length!==1)throw Error('NATIVE_VIDEO_COUNT');const video=result.videos[0];
  if(video.type!=='base64'||typeof video.data!=='string'||video.mediaType!=='video/mp4')throw Error('NATIVE_VIDEO_FORMAT');
  const encoded=video.data;if(encoded.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('NATIVE_VIDEO_ENCODING');
  const padding=encoded.endsWith('==')?2:encoded.endsWith('=')?1:0,decodedBytes=encoded.length/4*3-padding;if(decodedBytes>20000000)throw Error('ASSET_TOO_LARGE');
  const decoded=atob(encoded),bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
  if(bytes.byteLength!==decodedBytes||bytes.length<12||String.fromCharCode(...bytes.subarray(4,8))!=='ftyp')throw Error('NATIVE_VIDEO_INVALID_MP4');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  // No video bytes enter the generic ledger result parser. Incurred cost remains fully uncertain.
  await ctx.runMutation(mutation('runtimeModelPolicy:recover'),{reference:args.reference,attemptId});
  const metadata=await storeGeneratedAsset(ctx,args.reference,{requestId:args.key+'-generated',mimeType:video.mediaType,lineage:{kind:'generated',operationId:dispatchIdentity!,modelId:MODEL,sourceVersionIds:[asset.metadata.versionId]}},new Blob([bytes],{type:video.mediaType}));
  if(metadata.contentHash!==hash||metadata.sizeBytes!==decodedBytes)throw Error('GENERATED_ASSET_IDENTITY');
  await ctx.runMutation(mutation('mediaProbe:update'),{key:args.key,state:'completed',terminalSummary:{requestedModelId:result.response.modelId,servingModelUnobserved:true,nativeHTTPStatus:nativeHTTPStatus??null,firstFrameVersionId:asset.metadata.versionId,firstFrameHash:asset.metadata.contentHash,bodyBytes,maxRetries:0,noStorageUrl:true,providerResponseComplete:true,generatedAsset:metadata,decodedVideoBytes:decodedBytes,videoHash:hash,mimeType:video.mediaType,maximumNativeResponseBytes:28000000,maximumDecodedAssetBytes:20000000,costUnavailable:true}});
  return {status:'ACTUAL_SYNC_VIDEO_MATERIALIZED',key:args.key,runBudgetId:budget.runBudgetId,attemptId,frameVersionId:asset.metadata.versionId,frameHash:asset.metadata.contentHash,frameBytes:asset.metadata.sizeBytes,bodyBytes,requestedModelId:result.response.modelId,servingModelUnobserved:true,nativeHTTPStatus:nativeHTTPStatus??null,nativeStartRequests:1,confirmedModelCalls:1,fullLiabilityUnits:2000000,genericLedgerResultWithheld:true,asset:metadata,videoHash:hash,videoBytes:decodedBytes,mimeType:video.mediaType,providerResponseComplete:true,nativeFinancialReconciliationPending:true};
 }catch(error){
  const code=publicError(error);await ctx.runMutation(mutation('mediaProbe:update'),{key:args.key,state:issued?'unknown':'failed',failureCode:code});
  if(issued)await ctx.runMutation(mutation('runtimeModelPolicy:recover'),{reference:args.reference,attemptId});else await ctx.runMutation(mutation('runtimeModelPolicy:releaseNotDispatched'),{reference:args.reference,attemptId});
  return {status:issued?'UNKNOWN_REQUIRES_RECONCILIATION':'NOT_DISPATCHED',key:args.key,runBudgetId:budget.runBudgetId,attemptId,bodyBytes,errorCode:code,nativeHTTPStatus:nativeHTTPStatus??null,nativeStartRequests:issued?1:0,confirmedModelCalls:null,fullLiabilityUnits:issued?2000000:0,resultWithheld:true,neverRetryStart:true};
 }finally{globalThis.fetch=originalFetch;}
}});
