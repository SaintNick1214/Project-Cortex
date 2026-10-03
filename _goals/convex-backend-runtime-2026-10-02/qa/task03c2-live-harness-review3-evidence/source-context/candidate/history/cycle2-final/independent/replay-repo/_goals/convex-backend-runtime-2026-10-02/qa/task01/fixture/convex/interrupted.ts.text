import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { principal } from "./auth";
import { workflow } from "./runtime";

export const start = mutation({args:{operationId:v.string()},handler:async(ctx,args):Promise<string>=>{
  const owner=await principal(ctx);
  const operationId=`${owner}:${args.operationId}`;
  const old=await ctx.db.query("operations").withIndex("by_operation",q=>q.eq("operationId",operationId)).unique();
  if(old) return old._id;
  const id=await ctx.db.insert("operations",{owner,operationId,state:"queued",attempts:0,effects:0});
  await workflow.start(ctx,internal.interrupted.flow,{operationId});
  return id;
}});
export const observe=query({args:{operationId:v.string()},handler:async(ctx,args)=>{
  const owner=await principal(ctx);
  return ctx.db.query("operations").withIndex("by_operation",q=>q.eq("operationId",`${owner}:${args.operationId}`)).unique();
}});
export const recover=mutation({args:{operationId:v.string()},handler:async(ctx,args)=>{
  const owner=await principal(ctx);
  const operation=await ctx.db.query("operations").withIndex("by_operation",q=>q.eq("operationId",`${owner}:${args.operationId}`)).unique();
  if(!operation) throw new Error("OPERATION_NOT_FOUND");
  return {version:1,code:operation.state==="uncertain"?"UNCERTAIN_OUTCOME":"OPERATION_IN_PROGRESS",replayAllowed:false,attempts:operation.attempts};
}});
export const begin=internalMutation({args:{operationId:v.string()},handler:async(ctx,args)=>{
  const operation=await ctx.db.query("operations").withIndex("by_operation",q=>q.eq("operationId",args.operationId)).unique();
  if(!operation||operation.state!=="queued") return false;
  await ctx.db.patch(operation._id,{state:"started",attempts:operation.attempts+1});
  return true;
}});
export const effect=internalMutation({args:{operationId:v.string()},handler:async(ctx,args)=>{
  const operation=await ctx.db.query("operations").withIndex("by_operation",q=>q.eq("operationId",args.operationId)).unique();
  if(!operation) throw new Error("OPERATION_NOT_FOUND");
  await ctx.db.patch(operation._id,{effects:operation.effects+1});
  return {effectCommitted:true};
}});
export const uncertain=internalMutation({args:{operationId:v.string()},handler:async(ctx,args)=>{
  const operation=await ctx.db.query("operations").withIndex("by_operation",q=>q.eq("operationId",args.operationId)).unique();
  if(operation) await ctx.db.patch(operation._id,{state:"uncertain"});
}});
export const call=internalAction({args:{operationId:v.string()},handler:async(ctx,args):Promise<null>=>{
  if(!await ctx.runMutation(internal.interrupted.begin,args)) return null;
  const response=await fetch(`${process.env.CONVEX_SITE_URL}/fixture-effect`,{method:"POST",headers:{"content-type":"application/json","x-fixture-secret":process.env.QUALIFICATION_EFFECT_SECRET??""},body:JSON.stringify(args)});
  if(!response.ok) throw new Error("EXTERNAL_EFFECT_UNAVAILABLE");
  await response.json();
  // Real HTTP side effect committed. Deliberately lose the outcome before local receipt.
  throw new Error("FORCED_INTERRUPTION_AFTER_EXTERNAL_EFFECT");
}});
export const flow=workflow.define({args:{operationId:v.string()},returns:v.null(),handler:async(step,args):Promise<null>=>{
  try { await step.runAction(internal.interrupted.call,args,{retry:false}); }
  catch { await step.runMutation(internal.interrupted.uncertain,args); }
  return null;
}});
