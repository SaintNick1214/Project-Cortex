/** Disposable fixed commissioning route. Constants are filled from owned local setup. */
import {v, ConvexError} from 'convex/values';
import {makeFunctionReference, getFunctionName} from 'convex/server';
import {mutation, internalMutation, internalAction, internalQuery} from './_generated/server';
import type {Doc} from './_generated/dataModel';
import type {MutationCtx} from './_generated/server';
import {submitMediaHandler} from './runtimeMediaJobs';
import {processSubmissionHandler, officialMediaFactory} from './runtimeMediaGateway';
import {canonicalModelJson} from './_cortex/shared/domain/model_policy';
import {withImageWireCollector} from './task13ImageCollector';
const TENANT='__TASK13_TENANT__',SPACE='__TASK13_SPACE__',OWNER='__TASK13_OWNER_SUBJECT__',KEY='__TASK13_IMAGE_REQUEST__';
const PROMPT='A small blue square centered on a plain white background. No text.';
const mutationRef=<A extends Record<string,unknown>,R>(name:string)=>makeFunctionReference<'mutation',A,R>(name);
const processRef=makeFunctionReference<'action',{jobId:string},null>('task13ImageCommission:process');
function deny():never{throw new ConvexError({version:1,code:'FORBIDDEN',message:'Commissioning denied.',retryable:false,outcome:'not_dispatched'});}
function exact(job:Doc<'runtimeMediaJobs'>){if(job.tenantId!==TENANT||job.memorySpaceId!==SPACE||job.requestId!==KEY||job.kind!=='image'||job.prompt!==PROMPT)deny();}
export const submitCommission=mutation({args:{},handler:async(ctx)=>{
 const identity=await ctx.auth.getUserIdentity();if(!identity||identity.subject!==OWNER)deny();
 const scheduler:MutationCtx['scheduler']={...ctx.scheduler,runAfter:async(delay,reference,...args)=>{
  if(getFunctionName(reference)==='runtimeMediaJobs:processSubmission'){
   const value=args[0] as {jobId?:unknown}|undefined;
   if(!value||typeof value.jobId!=='string')deny();
   return ctx.scheduler.runAfter(delay,processRef,{jobId:value.jobId});
  }
  return ctx.scheduler.runAfter(delay,reference,...args);
 }};
 const dto=await submitMediaHandler({...ctx,scheduler},{tenantId:TENANT,memorySpaceId:SPACE,requestId:KEY,kind:'image',prompt:PROMPT});
 const job=await ctx.db.query('runtimeMediaJobs').withIndex('by_job',q=>q.eq('jobId',dto.jobId)).unique();if(!job)deny();exact(job);
 const old=await ctx.db.query('task13ImageProbes').withIndex('by_job',q=>q.eq('jobId',job.jobId)).unique();
 if(!old)await ctx.db.insert('task13ImageProbes',{jobId:job.jobId,tenantId:TENANT,memorySpaceId:SPACE,requestId:KEY,issuedCount:0,createdAt:Date.now()});
 return dto;
}});
/** Recheck the existing permit after the official JWT await, never mint/readmit it. */
export const issued=internalMutation({args:{jobId:v.string()},handler:async(ctx,args)=>{
 const job=await ctx.runMutation(mutationRef<{jobId:string},Doc<'runtimeMediaJobs'>>('runtimeMediaJobs:checkpoint'),args);exact(job);
 if(!job.attemptId||!job.dispatchIdentity||!job.leaseToken||!job.modelOperationId)deny();
 await ctx.runMutation(mutationRef<{jobId:string;leaseToken:string},Doc<'runtimeMediaJobs'>>('runtimeMediaJobs:checkpoint'),{jobId:job.jobId,leaseToken:job.leaseToken});
 const row=await ctx.db.query('task13ImageProbes').withIndex('by_job',q=>q.eq('jobId',job.jobId)).unique();
 const attempt=await ctx.db.get('runtimeModelAttempts',job.attemptId);if(!row||row.issuedCount!==0||!attempt||attempt.state!=='dispatch_pending'||attempt.dispatchIdentity!==job.dispatchIdentity||attempt.operationDocumentId!==job.modelOperationId)deny();
 const stored=JSON.parse(attempt.inputProofCanonical) as {requestCanonical?:unknown};if(typeof stored.requestCanonical!=='string')deny();
 const guard=await ctx.runMutation(mutationRef<{reference:typeof job.reference;attemptId:typeof job.attemptId;requestCanonical:string},{dispatchPermit:boolean;state?:string}>('runtimeModelPolicy:checkpoint'),{reference:job.reference,attemptId:job.attemptId,requestCanonical:stored.requestCanonical});
 if(guard.dispatchPermit!==false||guard.state!=='dispatch_pending')deny();
 await ctx.db.patch('task13ImageProbes',row._id,{issuedCount:1,attemptId:job.attemptId,dispatchIdentity:job.dispatchIdentity,issuedAt:Date.now()});
 return null;
}});
export const observe=internalMutation({args:{jobId:v.string(),observation:v.any()},handler:async(ctx,args)=>{
 const row=await ctx.db.query('task13ImageProbes').withIndex('by_job',q=>q.eq('jobId',args.jobId)).unique();if(!row||row.issuedCount!==1||row.observation)deny();
 const value=args.observation;
 if(value.issuedRequests!==1||typeof value.requestHash!=='string'||!/^[a-f0-9]{64}$/.test(value.requestHash)||value.requestBytes>8192||value.encodedResponseBytes>28000000
  ||value.servingModelIdentityUnqualified!==true||value.aggregateCostCompletenessUnattested!==true||canonicalModelJson(value).length>12000)deny();
 await ctx.db.patch('task13ImageProbes',row._id,{observation:value,observedAt:Date.now()});return null;
}});
export const process=internalAction({args:{jobId:v.string()},handler:async(ctx,args)=>{
 await processSubmissionHandler(ctx,args,modelId=>{
  if(modelId!=='openai/gpt-image-1')deny();const official=officialMediaFactory(modelId);
  return {...official,image:async input=>withImageWireCollector({
   expectedBody:{model:'openai/gpt-image-1',prompt:PROMPT,n:1,size:'1024x1024',quality:'low',output_format:'png'},
   beforeDispatch:async()=>{await ctx.runMutation(mutationRef('task13ImageCommission:issued'),{jobId:args.jobId});},
   observe:async observation=>{await ctx.runMutation(mutationRef('task13ImageCommission:observe'),{jobId:args.jobId,observation});},
   work:()=>official.image(input),
  })};
 });return null;
}});
export const read=internalQuery({args:{},handler:async(ctx)=>{
 const rows=await ctx.db.query('task13ImageProbes').take(2);if(rows.length>1)deny();return rows;
}});
