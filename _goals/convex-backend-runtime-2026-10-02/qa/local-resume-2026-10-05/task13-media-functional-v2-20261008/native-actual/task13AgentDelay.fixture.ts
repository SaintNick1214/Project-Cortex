/** Disposable scheduler-only overlay. The canonical submit handler and real worker are unchanged. */
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { ingestionStage } from "./runtimeIngestionSchema";
import type { RuntimeAuthorityReference } from "./_cortex/shared/auth/verified";
import type { IngestionStage } from "./_cortex/shared/domain/ingestion";
import { processStageHandler, readEventCurrent, readEventStages } from "./runtimeIngestion";
const TENANT="task13-agent-media-v2-3c1dcff16463", SPACE="agent-media-v2-3c1dcff16463";
const MAX_HOLD_MS=300000;
type StageArgs={reference:RuntimeAuthorityReference;eventId:string;stage:IngestionStage};
function ref<T extends "query"|"mutation"|"action",A extends Record<string,unknown>,R>(name:string){
 return makeFunctionReference<T,A,R>(name) as unknown as FunctionReference<T,"internal",A,R>;
}
const argsSchema={reference:runtimeAuthorityReference,eventId:v.string(),stage:ingestionStage};
const holdRef=ref<"mutation",StageArgs,null>("task13AgentDelay:hold");
const takeRef=ref<"mutation",StageArgs,boolean>("task13AgentDelay:take");
const releaseRef=ref<"action",StageArgs,null>("task13AgentDelay:release");
function exact(args:StageArgs){if(args.reference.tenantId!==TENANT||args.reference.memorySpaceId!==SPACE||args.stage!=="extract")
 throw new ConvexError({version:1,code:"FORBIDDEN",message:"Owned delay fixture denied.",retryable:false,outcome:"not_dispatched"});}
/** Bound only the exact new scope's initial extraction. No public fault flag, other scheduler changes, or paid retries. */
export async function withTask13HeldSubmit<Result>(ctx:MutationCtx,args:{request:unknown;tenantId?:string;memorySpaceId?:string},
 handler:(ctx:MutationCtx,args:{request:unknown;tenantId?:string;memorySpaceId?:string})=>Promise<Result>):Promise<Result>{
 if(args.tenantId!==TENANT||args.memorySpaceId!==SPACE)return await handler(ctx,args);
 const scheduler:MutationCtx["scheduler"]={...ctx.scheduler,runAfter:async(delay,name,...values)=>{
  if(getFunctionName(name)==="runtimeIngestion:processStage"){
   const value=values[0] as StageArgs;
   if(value?.reference.tenantId===TENANT&&value.reference.memorySpaceId===SPACE&&value.stage==="extract")
    return await ctx.scheduler.runAfter(delay,holdRef,value);
  }
  return await ctx.scheduler.runAfter(delay,name,...values);
 }};
 return await handler({...ctx,scheduler},args);
}
export const hold=internalMutation({args:argsSchema,handler:async(ctx,args)=>{
 exact(args);const current=await readEventCurrent(ctx,args.reference,args.eventId,"write"),stages=await readEventStages(ctx,current.event);
 const stage=stages.find(value=>value.stage==="extract");
 if(!stage||stage.state!=="pending"||stage.attempt!==0||stage.leaseVersion!==0)throw Error("INITIAL_UNCLAIMED_STAGE_REQUIRED");
 const old=await ctx.db.query("task13HeldIngestion").withIndex("by_event",q=>q.eq("tenantId",TENANT).eq("memorySpaceId",SPACE).eq("eventId",args.eventId)).unique();
 if(old)return null;
 const heldAt=Date.now(),scheduledId=await ctx.scheduler.runAfter(MAX_HOLD_MS,releaseRef,args);
 await ctx.db.insert("task13HeldIngestion",{...args,tenantId:TENANT,memorySpaceId:SPACE,state:"held",heldAt,deadlineAt:heldAt+MAX_HOLD_MS,scheduledId});return null;
}});
export const take=internalMutation({args:argsSchema,handler:async(ctx,args)=>{
 exact(args);const row=await ctx.db.query("task13HeldIngestion").withIndex("by_event",q=>q.eq("tenantId",TENANT).eq("memorySpaceId",SPACE).eq("eventId",args.eventId)).unique();
 if(!row||row.state!=="held")return false;
 await readEventCurrent(ctx,args.reference,args.eventId,"write");
 await ctx.db.patch("task13HeldIngestion",row._id,{state:"released",releaseIssuedAt:Date.now()});
 await ctx.scheduler.cancel(row.scheduledId);return true;
}});
export const release=internalAction({args:argsSchema,handler:async(ctx,args)=>{
 exact(args);if(!await ctx.runMutation(takeRef,args))return null;
 // Exactly one stage claim/dispatch path. Lost/unknown real worker outcomes are never re-issued by this fixture.
 await processStageHandler(ctx,args);return null;
}});
export const snapshot=internalQuery({args:{},handler:async(ctx)=>{
 const rows=await ctx.db.query("task13HeldIngestion").withIndex("by_event",q=>q.eq("tenantId",TENANT).eq("memorySpaceId",SPACE)).take(3);
 if(rows.length>1)throw Error("ONE_OWNED_USER_EVENT_EXPECTED");return rows;
}});
