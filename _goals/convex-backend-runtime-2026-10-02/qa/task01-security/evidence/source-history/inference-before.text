import { Agent, createTool, mockModel, type ToolCtx } from "@convex-dev/agent";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { Output, generateText, stepCountIs } from "ai";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { principal } from "./auth";

type ErrorInfo = { version: 1; code: "CAPABILITY_UNAVAILABLE" | "CAPABILITY_UNSUPPORTED" | "UPSTREAM_REJECTED" | "UNCERTAIN_OUTCOME"; retryable: false; errorType: string; statusCode: number | null; message: string };
function unavailable(error: unknown): ErrorInfo {
  const record = error instanceof Error ? error as Error & { statusCode?: number; responseBody?: string } : null;
  const statusCode=record?.statusCode??null;
  const code=statusCode===401||statusCode===403 ? "CAPABILITY_UNAVAILABLE" : statusCode===404||statusCode===501 ? "CAPABILITY_UNSUPPORTED" : statusCode!==null&&statusCode>=400&&statusCode<500 ? "UPSTREAM_REJECTED" : "UNCERTAIN_OUTCOME";
  return { version: 1, code, retryable: false, errorType: record?.name ?? "UnknownError", statusCode, message: (record?.message ?? "Gateway operation outcome unknown").slice(0, 700) };
}

export const capability = action({ args: { interface: v.union(v.literal("chat"),v.literal("responses"),v.literal("structured")) }, handler: async (ctx,args) => {
  await principal(ctx);
  try {
    const model=args.interface==="responses" ? convexGateway.responses("openai/gpt-4o-mini") : convexGateway("openai/gpt-4o-mini");
    const result=await generateText({model,prompt:args.interface==="structured" ? "Return JSON with ready set to true." : "Reply exactly READY.",maxRetries:0,maxOutputTokens:32,...(args.interface==="structured" ? {output:Output.object({schema:z.object({ready:z.boolean()})})} : {})});
    return {version:1,ok:true,interface:args.interface,text:result.text,output:args.interface==="structured"?result.output:null,usage:result.usage};
  } catch(error) { return {ok:false,interface:args.interface,error:unavailable(error)}; }
} });

export const cursorGap = action({ args: { runId:v.id("runs") }, handler: async(ctx,args) => {
  const owner=await principal(ctx);
  const run=await ctx.runQuery(internal.runtime.getRun,args);
  if(!run||run.owner!==owner) throw new ConvexError({version:1,code:"FORBIDDEN",retryable:false});
  await ctx.runMutation(internal.runtime.canonicalOnly,args);
  throw new ConvexError({version:1,code:"FORCED_AFTER_FINAL_BEFORE_RECEIPT",retryable:false});
} });

export const execute = internalAction({ args: { runId:v.id("runs") }, handler: async(ctx,args):Promise<null> => {
  const run=await ctx.runQuery(internal.runtime.getRun,args);
  if(!run||run.status==="cancelled") return null;
  if(!await ctx.runMutation(internal.runtime.checkpoint,{...args,status:"running",incrementAttempt:true})) return null;
  const synthetic=run.scenario==="synthetic-stream";
  const model=synthetic ? mockModel({content:[{type:"reasoning",text:"private fixture reasoning"},{type:"text",text:"Cortex durable stream one two three four five six seven eight nine ten."}],initialDelayInMs:400,chunkDelayInMs:200}) : convexGateway("openai/gpt-4o-mini");
  const add=createTool({inputSchema:z.object({a:z.number(),b:z.number()}),description:"Add two numbers in the authorized backend.",execute:async(_toolCtx:ToolCtx,input,{toolCallId})=>{
    const result=await ctx.runMutation(internal.runtime.add,{runId:run._id,operationId:`${run._id}:tool:${toolCallId}`,a:input.a,b:input.b});
    // Owned nonbillable tool delay creates a bounded real observer disconnect window.
    await new Promise(resolve=>setTimeout(resolve,1800));
    return result;
  }});
  const agent=new Agent<ActionCtx>(components.agent,{name:"task01-qualified-agent",languageModel:model,instructions:"Be brief. Use add once when asked to calculate.",tools:run.scenario==="gateway-tool"?{add}:{},stopWhen:stepCountIs(2),contextOptions:{searchOtherThreads:false,recentMessages:10}});
  try {
    const result=await agent.streamText(ctx,{threadId:run.threadId,userId:run.owner},{promptMessageId:run.promptMessageId,maxRetries:0,maxOutputTokens:64},{saveStreamDeltas:{throttleMs:50,chunking:"word"}});
    await result.text;
    await ctx.runMutation(internal.runtime.checkpoint,{runId:run._id,status:"completed"});
  } catch(error) {
    await ctx.runMutation(internal.runtime.checkpoint,{runId:run._id,status:"failed",errorCode:synthetic?"STREAM_ABORTED":unavailable(error).code});
  }
  return null;
} });
