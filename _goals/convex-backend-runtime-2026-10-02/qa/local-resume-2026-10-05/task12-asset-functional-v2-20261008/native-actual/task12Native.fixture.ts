/** QA-only internal disposable fixture. Never part of a shipped backend. */
import {v} from 'convex/values';
import {makeFunctionReference} from 'convex/server';
import {internalAction,internalQuery,internalMutation} from './_generated/server';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
import {storeGeneratedAsset} from './runtimeAssets';
import {saveMessages} from '@convex-dev/agent';
import {agentComponent,conversationById,checkConversation,registerMessages} from './runtimeTranscript';
import {versionById,authorizeAsset} from './runtimeAssetCatalog';
const scope={tenantId:v.string(),memorySpaceId:v.string()};
export const snapshot=internalQuery({args:scope,handler:async(ctx,args)=>{
 const heads=await ctx.db.query('runtimeAssets').withIndex('by_asset',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId)).take(101);
 const jobs=await ctx.db.query('runtimeAssetJobs').withIndex('by_scope',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId)).take(101);
 if(heads.length>100||jobs.length>100)throw Error('FIXTURE_SCOPE_LIMIT');
 const versions=[];for(const head of heads)versions.push(...await ctx.db.query('runtimeAssetVersions').withIndex('by_version',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('assetId',head.assetId)).take(21));
 const result=[];for(const version of versions){const edges=await ctx.db.query('runtimeAssetReferences').withIndex('by_version',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('versionId',version.versionId)).take(101);result.push({...version,physicalStorage:await ctx.storage.getMetadata(version.storageId),edges});}
 const pending=[];for(const job of jobs)pending.push({...job,physicalStorage:job.storageId?await ctx.storage.getMetadata(job.storageId):null});
 return {heads,versions:result,jobs:pending};
}});
/** Allocate bytes inside the action, avoiding a 20MB JSON argument. */
export const oversizedGenerated=internalAction({args:{reference:runtimeAuthorityReference,requestId:v.string()},handler:async(ctx,args)=>{
 return storeGeneratedAsset(ctx,args.reference,{requestId:args.requestId,mimeType:'video/mp4',lineage:{kind:'generated',operationId:'qa-oversized-output-no-model',modelId:'fixture-byte-generator'}},new Blob([new Uint8Array(20000001)],{type:'video/mp4'}));
}});
/** Persist a real owned storage blob but stop before stage/finalize for tombstone/cancel tests. */
export const prepareHeldUpload=internalAction({args:{reference:runtimeAuthorityReference,requestId:v.string()},handler:async(ctx,args)=>{
 const bytes=new TextEncoder().encode('Task12 held private storage bytes.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 const job=await ctx.runMutation(makeFunctionReference<'mutation',Record<string,unknown>,{jobId:string;marker:string}>('runtimeAssets:beginGenerated'),{reference:args.reference,requestId:args.requestId,contentHash:digest,sizeBytes:bytes.length,mimeType:'application/octet-stream',lineage:{kind:'generated',operationId:'qa-held-no-model',modelId:'fixture-byte-generator'}});
 const storageId=await ctx.storage.store(new Blob([bytes],{type:job.marker}));
 return {...job,storageId,sizeBytes:bytes.length,contentHash:digest};
}});
export const heldJob=internalQuery({args:{jobId:v.string()},handler:async(ctx,args)=>{
 const job=await ctx.db.query('runtimeAssetJobs').withIndex('by_job',q=>q.eq('jobId',args.jobId)).unique();if(!job)throw Error('MISSING_HELD_JOB');return job;
}});
export const storageMetadata=internalMutation({args:{storageId:v.id('_storage')},handler:async(ctx,args)=>await ctx.storage.getMetadata(args.storageId)});
/** File-only real Agent message: no text, source extraction or billable scheduling. */
export const bindAgentFile=internalMutation({args:{reference:runtimeAuthorityReference,conversationId:v.string(),versionId:v.string()},handler:async(ctx,args)=>{
 const conversation=await conversationById(ctx,args.reference,args.conversationId);if(!conversation)throw Error('FIXTURE_CONVERSATION_MISSING');
 await checkConversation(ctx,args.reference,conversation,'write');
 const asset=await versionById(ctx,{tenantId:args.reference.tenantId,memorySpaceId:args.reference.memorySpaceId!},args.versionId);if(!asset)throw Error('FIXTURE_ASSET_MISSING');await authorizeAsset(ctx,args.reference,asset);
 const saved=await saveMessages(ctx,agentComponent,{threadId:conversation.threadId,userId:args.reference.principalId,order:'next',messages:[{role:'user',content:[{type:'file',data:'cortex-asset:'+args.versionId,mediaType:asset.mimeType}]}],failPendingSteps:false});
 const pins=await registerMessages(ctx,conversation,args.reference,saved.messages,{approved:true});return {pins,conversationId:conversation.conversationId,assetVersionId:args.versionId,textBytes:0,newModelCalls:0};
}});
/** Exercise orphan cleanup after a crash before stageStorage, on this exact QA job only. */
export const expireHeld=internalMutation({args:{jobId:v.string()},handler:async(ctx,args)=>{
 const job=await ctx.db.query('runtimeAssetJobs').withIndex('by_job',q=>q.eq('jobId',args.jobId)).unique();if(!job||job.lineage.kind!=='generated'||job.lineage.modelId!=='fixture-byte-generator'||job.state!=='uploading')throw Error('NOT_OWNED_HELD_FIXTURE');
 await ctx.db.patch('runtimeAssetJobs',job._id,{leaseExpiresAt:Date.now()-1});return null;
}});
