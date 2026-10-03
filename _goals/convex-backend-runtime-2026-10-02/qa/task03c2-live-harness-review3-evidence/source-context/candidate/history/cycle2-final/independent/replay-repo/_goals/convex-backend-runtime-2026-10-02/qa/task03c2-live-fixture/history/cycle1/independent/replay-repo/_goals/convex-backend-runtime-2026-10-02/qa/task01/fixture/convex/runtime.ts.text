import { abortStream, createThread, listMessages, listStreams, saveMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { WorkflowManager } from "@convex-dev/workflow";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { principal } from "./auth";

export const workflow = new WorkflowManager(components.workflow, { workpoolOptions: { maxParallelism: 2, retryActionsByDefault: false } });

function publicPart(part:unknown):Record<string,unknown>|null{
  if(!part||typeof part!=="object"||!("type" in part))return null;
  const p=part as Record<string,unknown>;
  if(p.type==="text"&&typeof p.text==="string")return{type:"text",text:p.text};
  if(p.type==="tool-call"&&p.toolName==="add"&&typeof p.toolCallId==="string"){
    const input=p.input??p.args;
    if(input&&typeof input==="object"&&"a" in input&&"b" in input&&typeof input.a==="number"&&typeof input.b==="number")return{type:"tool-call",toolCallId:p.toolCallId,toolName:"add",input:{a:input.a,b:input.b}};
  }
  if(p.type==="tool-result"&&p.toolName==="add"&&typeof p.toolCallId==="string"){
    const output=p.output??p.result;
    const value=typeof output==="number"?output:output&&typeof output==="object"&&"value" in output?output.value:null;
    if(typeof value==="number")return{type:"tool-result",toolCallId:p.toolCallId,toolName:"add",output:{type:"json",value}};
  }
  return null;
}
function publicStreamPart(part:unknown):Record<string,unknown>|null{
  if(!part||typeof part!=="object"||!("type" in part))return null;
  const p=part as Record<string,unknown>;
  if(p.type==="start")return{type:"start",...(typeof p.messageId==="string"?{messageId:p.messageId}:{})};
  if(p.type==="start-step"||p.type==="finish-step")return{type:p.type};
  if(p.type==="finish")return{type:"finish",finishReason:["stop","length","tool-calls","content-filter","error","other","unknown"].includes(String(p.finishReason))?p.finishReason:"other"};
  if(["text-start","text-end"].includes(String(p.type))&&typeof p.id==="string")return{type:p.type,id:p.id};
  if(p.type==="text-delta"&&typeof p.id==="string"&&typeof p.delta==="string")return{type:p.type,id:p.id,delta:p.delta};
  if(p.type==="tool-input-start"&&p.toolName==="add"&&typeof p.toolCallId==="string")return{type:p.type,toolName:"add",toolCallId:p.toolCallId};
  if(p.type==="tool-input-available"&&p.toolName==="add"&&typeof p.toolCallId==="string"){
    const input=p.input;
    if(input&&typeof input==="object"&&"a" in input&&"b" in input&&typeof input.a==="number"&&typeof input.b==="number")return{type:p.type,toolName:"add",toolCallId:p.toolCallId,input:{a:input.a,b:input.b}};
  }
  if(p.type==="tool-output-available"&&typeof p.toolCallId==="string"&&typeof p.output==="number")return{type:p.type,toolCallId:p.toolCallId,output:p.output};
  if(p.type==="error")return{type:"error",errorText:"RUN_FAILED"};
  if(p.type==="abort")return{type:"abort",reason:"cancelled"};
  return null;
}

async function owned(ctx: QueryCtx | MutationCtx, runId: Id<"runs">): Promise<Doc<"runs">> {
  const owner = await principal(ctx);
  const run = await ctx.db.get(runId);
  if (!run || run.owner !== owner) throw new ConvexError({ version: 1, code: "FORBIDDEN", retryable: false });
  return run;
}

export const identity = query({ args: {}, handler: async (ctx) => ({ version: 1, principal: await principal(ctx), grant: "fixture-text-only" }) });

export const start = mutation({
  args: { requestId: v.string(), scenario: v.union(v.literal("atomic"), v.literal("cursor"), v.literal("synthetic-stream"), v.literal("gateway-text"), v.literal("gateway-tool")) },
  handler: async (ctx, args): Promise<Id<"runs">> => {
    const owner = await principal(ctx);
    const old = await ctx.db.query("runs").withIndex("by_request", (q) => q.eq("owner", owner).eq("requestId", args.requestId)).unique();
    if (old) {
      if (old.scenario !== args.scenario) throw new ConvexError({ version: 1, code: "IDEMPOTENCY_CONFLICT", retryable: false });
      return old._id;
    }
    const threadId = await createThread(ctx, components.agent, { userId: owner });
    const prompt = args.scenario === "gateway-tool" ? "Use add exactly once to add 2 and 3, then reply with the sum." : "Say exactly: Cortex qualification ready.";
    const { messages } = await saveMessages(ctx, components.agent, { threadId, userId: owner, messages: [{ role: "user", content: prompt }] });
    const runId = await ctx.db.insert("runs", { owner, requestId: args.requestId, scenario: args.scenario, threadId, promptMessageId: messages[0]._id, status: "queued", attempt: 0 });
    if (!["atomic", "cursor"].includes(args.scenario)) {
      const workflowId = await workflow.start(ctx, internal.execution.execute, { runId });
      await ctx.db.patch(runId, { workflowId });
    }
    return runId;
  },
});

export const observe = query({
  args: { runId: v.id("runs"), streamArgs: v.optional(vStreamArgs) },
  handler: async (ctx, args) => {
    const run = await owned(ctx, args.runId);
    const messages = await listMessages(ctx, components.agent, { threadId: run.threadId, paginationOpts: { numItems: 100, cursor: null } });
    const streams = await listStreams(ctx, components.agent, { threadId: run.threadId, includeStatuses: ["streaming", "finished", "aborted"] });
    const deltas = args.streamArgs ? await syncStreams(ctx, components.agent, { threadId: run.threadId, streamArgs: args.streamArgs, includeStatuses: ["streaming", "finished", "aborted"] }) : undefined;
    let hiddenReasoningParts=0;
    const publicMessages=messages.page.map(doc=>{
      // Reconstruct approved fields; never spread raw Agent documents/parts.
      if(doc.message&&typeof doc.message.content!=="string")hiddenReasoningParts+=doc.message.content.filter(part=>part.type.startsWith("reasoning")||part.type==="redacted-reasoning").length;
      const content=!doc.message?null:typeof doc.message.content==="string"?doc.message.content:doc.message.content.flatMap(part=>{const visible=publicPart(part);return visible?[visible]:[];});
      return{_id:doc._id,_creationTime:doc._creationTime,order:doc.order,stepOrder:doc.stepOrder,status:doc.status,message:doc.message?{role:doc.message.role,content}:null};
    });
    const publicDeltas=deltas?.kind==="deltas" ? {kind:"deltas",deltas:deltas.deltas.map(delta=>({streamId:delta.streamId,start:delta.start,end:delta.end,parts:delta.parts.flatMap(part=>{const visible=publicStreamPart(part);return visible?[visible]:[];})}))} : deltas;
    return { version: 1, run, messages: publicMessages, hiddenReasoningParts, streams, deltas: publicDeltas ?? null, receipts: await ctx.db.query("receipts").withIndex("by_run", q => q.eq("runId", run._id)).collect(), tools: await ctx.db.query("tools").filter(q => q.eq(q.field("runId"), run._id)).collect() };
  },
});

export const atomicFinalize = mutation({
  args: { runId: v.id("runs"), forceFailure: v.boolean() },
  handler: async (ctx, args) => {
    const run = await owned(ctx, args.runId);
    const { messages } = await saveMessages(ctx, components.agent, { threadId: run.threadId, promptMessageId: run.promptMessageId, messages: [{ role: "assistant", content: "atomic-final" }] });
    await ctx.db.insert("receipts", { runId: run._id, messageId: messages[0]._id, revision: 1, stage: "registered" });
    if (args.forceFailure) throw new ConvexError({ version: 1, code: "FORCED_TRANSACTION_FAILURE", retryable: false });
    await ctx.db.patch(run._id, { status: "completed" });
    return messages[0]._id;
  },
});

async function reconcileMessages(ctx: MutationCtx, run: Doc<"runs">): Promise<number> {
  const { page } = await listMessages(ctx, components.agent, { threadId: run.threadId, paginationOpts: { numItems: 100, cursor: null }, statuses: ["success"] });
  const receipts = await ctx.db.query("receipts").withIndex("by_run", q => q.eq("runId", run._id)).collect();
  let added = 0;
  const finalMessages=page.filter(message=>message.message?.role==="assistant"&&(typeof message.message.content==="string" ? message.message.content.trim().length>0 : message.message.content.some(part=>part.type==="text"&&part.text.trim().length>0))).slice(0,1);
  for (const message of finalMessages) {
    if (message.message?.role === "assistant" && !receipts.some(r => r.messageId === message._id)) {
      await ctx.db.insert("receipts", { runId: run._id, messageId: message._id, revision: 1, stage: "registered" });
      added++;
    }
  }
  return added;
}

export const reconcile = mutation({ args: { runId: v.id("runs") }, handler: async (ctx,args) => reconcileMessages(ctx,await owned(ctx,args.runId)) });
export const getRun = internalQuery({ args: { runId: v.id("runs") }, handler: async (ctx,args) => ctx.db.get(args.runId) });
export const checkpoint = internalMutation({
  args: { runId: v.id("runs"), status: v.string(), errorCode: v.optional(v.string()), incrementAttempt: v.optional(v.boolean()) },
  handler: async (ctx,args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("RUN_NOT_FOUND");
    if (run.status === "cancelled") return false;
    await ctx.db.patch(run._id, { status: args.status, ...(args.errorCode ? { errorCode: args.errorCode } : {}), attempt: run.attempt + (args.incrementAttempt ? 1 : 0) });
    if (args.status === "completed") await reconcileMessages(ctx,run);
    return true;
  },
});
export const canonicalOnly = internalMutation({ args: { runId: v.id("runs") }, handler: async (ctx,args) => {
  const run = await ctx.db.get(args.runId);
  if (!run) throw new Error("RUN_NOT_FOUND");
  const { messages } = await saveMessages(ctx, components.agent, { threadId: run.threadId, promptMessageId: run.promptMessageId, messages: [{ role: "assistant", content: "cursor-final" }] });
  return messages[0]._id;
} });
export const cancel = mutation({ args: { runId: v.id("runs") }, handler: async (ctx,args) => {
  const run = await owned(ctx,args.runId);
  if(["completed","failed","uncertain","cancelled"].includes(run.status))return{version:1,status:run.status,abortedStreams:0,upstreamReversalGuaranteed:false};
  await ctx.db.patch(run._id,{ status:"cancelled" });
  const streams=await listStreams(ctx,components.agent,{threadId:run.threadId});
  for (const stream of streams) await abortStream(ctx,components.agent,{streamId:stream.streamId,reason:"fixture-user-cancel"});
  if(run.workflowId) await workflow.cancel(ctx,run.workflowId as import("@convex-dev/workflow").WorkflowId);
  return { version:1,status:"cancelled",abortedStreams:streams.length,upstreamReversalGuaranteed:false };
} });
export const add = internalMutation({args:{runId:v.id("runs"),operationId:v.string(),a:v.number(),b:v.number()},handler:async(ctx,args)=>{
  const run=await ctx.db.get(args.runId);
  if(!run||run.status==="cancelled") throw new Error("CANCELLED");
  const old=await ctx.db.query("tools").withIndex("by_operation",q=>q.eq("operationId",args.operationId)).unique();
  if(old) return old.result;
  const result=args.a+args.b;
  await ctx.db.insert("tools",{runId:args.runId,operationId:args.operationId,result});
  return result;
}});
