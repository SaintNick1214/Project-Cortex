/** Disposable unpaid scheduler seam. No native model method is invoked. */
import {v,ConvexError} from 'convex/values';
import {getFunctionName,makeFunctionReference} from 'convex/server';
import {mutation,internalAction} from './_generated/server';
import type {MutationCtx} from './_generated/server';
import {submitMediaHandler} from './runtimeMediaJobs';
const TENANT='__TASK13_TENANT__',SPACE='__TASK13_SPACE__',OWNER='__TASK13_OWNER_SUBJECT__';
const holdRef=makeFunctionReference<'action',{jobId:string},null>('task13Held:hold');
export const hold=internalAction({args:{jobId:v.string()},handler:async()=>null});
export const submit=mutation({args:{requestId:v.union(v.literal('task13-unpaid-cancel'),v.literal('task13-unpaid-currentness'))},handler:async(ctx,args)=>{
 const identity=await ctx.auth.getUserIdentity();if(!identity||identity.subject!==OWNER)throw new ConvexError({version:1,code:'FORBIDDEN',message:'Fixture denied.',retryable:false,outcome:'not_dispatched'});
 const scheduler:MutationCtx['scheduler']={...ctx.scheduler,runAfter:async(delay,reference,...values)=>{
  if(getFunctionName(reference)==='runtimeMediaJobs:processSubmission')return ctx.scheduler.runAfter(delay,holdRef,values[0] as {jobId:string});
  return ctx.scheduler.runAfter(delay,reference,...values);
 }};
 return submitMediaHandler({...ctx,scheduler},{tenantId:TENANT,memorySpaceId:SPACE,requestId:args.requestId,kind:'image',prompt:'Held unpaid fixture. No generation is requested.'});
}});
