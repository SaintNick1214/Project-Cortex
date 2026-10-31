/** Real ledger/Workflow handler composition with a credential-free controlled native peer. */
import { beforeEach, afterEach, it, expect, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { LanguageModelV4 } from "@ai-sdk/provider";
const workflows: unknown[] = [];
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class { define(input: { handler: unknown }) { return { _handler: input.handler }; } async start(...args: unknown[]) { workflows.push(args); return "workflow:content"; } async cancel() {} } }));
const { transcriptFixture, installIngestionMockRoot, ledger, invoke, clock, runs } = await import("../runtimeTranscript/fixture");
const jobs = await import("../../../convex-dev/runtimeContentJobs");
const { processContentStageHandler } = await import("../../../convex-dev/runtimeContentGateway");
const { governGatewayLanguageModel } = await import("../../../convex-dev/runtimeGateway");
const runtime = await import("../../../convex-dev/runtimeAgent");
const { createBackendGatewayComposition } = await import("../../../convex-dev/runtimeGatewayBackend");
const { contentSubmitSchema, parseContentOutput } = await import("../../../src/domain/content");
const { artifactMetadataWitness, readArtifactContext } = await import("../../../convex-dev/runtimeArtifactContext");
beforeEach(() => { installIngestionMockRoot(); workflows.length = 0; }); afterEach(() => { jest.restoreAllMocks(); });
it("accepts quoted CSV with multiline cells and denies malformed generated sheet content",()=>{
  const value='name,note\nAlpha,"first line\nsecond line"\nBeta,"say ""hello"""';expect(parseContentOutput("sheet",value)).toBe(value);
  for (const invalid of ['a,b\nonly-one','a,b\n"unclosed,b','a,b\n"closed"garbage,b']) expect(()=>parseContentOutput("sheet",invalid)).toThrow("CONTENT_OUTPUT_INVALID");
});
async function fixture() {
  const f = await transcriptFixture({ maxContextTokens: 16384 }); const query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  const route = (ref: unknown) => { let name = ""; try { name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]); } catch { return; }
    if (name.startsWith("runtimeAgent:")) return runtime[name.split(":")[1] as keyof typeof runtime];
    if (name.startsWith("runs:")) return runs[name.split(":")[1] as keyof typeof runs];
    if (name.startsWith("runtimeContentJobs:")) return jobs[name.split(":")[1] as keyof typeof jobs];
    if (name.startsWith("runtimeModelPolicy:")) return ledger[name.split(":")[1] as keyof typeof ledger]; };
  f.ctx.runQuery = (async (ref, args) => route(ref) ? invoke(route(ref), f.ctx, args) : query(ref, args)) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => route(ref) ? f.transaction(() => invoke(route(ref), f.ctx, args)) : mutation(ref, args)) as MutationCtx["runMutation"];
  const calls: string[] = [];
  const generate = async (jobId: string, leaseToken: string, text: string) => processContentStageHandler(f.ctx as unknown as ActionCtx, { jobId, leaseToken }, async (composition, binding) => {
    const r = await composition.ledger.resolve(binding);
    const model: LanguageModelV4 = { specificationVersion: "v4", provider: "convexGateway.chat", modelId: r.snapshot.modelId, supportedUrls: {}, doStream: async () => { throw new Error("No stream"); }, doGenerate: async () => {
      calls.push(binding.operationKey); return { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, warnings: [], usage: { inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: 0 } },
        response: { body: { id: "fixture", model: r.snapshot.modelId, choices: [{ finish_reason: "stop", message: { content: text } }], usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 } } } };
    } }; return governGatewayLanguageModel(model, composition, binding, r);
  });
  const submit = (requestId: string, intent: "text" | "code" | "sheet" = "text") => f.call<{ jobId: string; artifactId: string }>(jobs.submit, { version: 1, requestId, intent, prompt: "Create a short useful document" });
  const claim = (jobId: string) => f.call<{ jobId: string; leaseToken: string }>(jobs.claim, { jobId });
  return { ...f, generate, calls, submit, claim };
}
it.each(["text", "code", "sheet"] as const)("creates %s with a real secondary title and one shared native account", async intent => {
  const f = await fixture(), job = await f.submit(`new-${intent}`, intent), lease = await f.claim(job.jobId);
  await f.generate(job.jobId, lease.leaseToken, intent === "sheet" ? "name,value\nalpha,1" : "Useful generated content");
  expect(await f.call(jobs.next, lease)).toBe(true); await f.generate(job.jobId, lease.leaseToken, "Useful Document"); await f.call(jobs.publish, lease);
  const ready = await f.call<{ state: string; artifactVersion: number }>(jobs.get, { jobId: job.jobId }); expect(ready).toMatchObject({ state: "ready", artifactVersion: 2 });
  expect(f.calls).toEqual([`artifact.${intent}`, "conversation.title"]); expect(new Set(f.db.table("runtimeModelOperations").map(op => op.runAccountId)).size).toBe(1);
  expect(f.db.table("artifacts")[0].versionHistory).toHaveLength(2);
  const attempts = f.db.table("runtimeModelAttempts").length; await f.call(jobs.reconcile, { jobId: job.jobId }); expect(f.db.table("runtimeModelAttempts")).toHaveLength(attempts);
});
it("rejects model/authority/budget extras before any job or artifact", async () => { const f = await fixture(); expect(contentSubmitSchema.safeParse({ version: 1, requestId: "x", intent: "text", prompt: "draft", modelId: "invented" }).success).toBe(false); await expect(f.call(jobs.submit, { version: 1, requestId: "x", intent: "text", prompt: "x".repeat(4097) })).rejects.toMatchObject({ data: { code: "INVALID_CONTENT_INPUT" } }); expect(f.db.table("artifacts")).toHaveLength(0); });
it("retains idempotent job/account and denies a conflicting request", async () => { const f = await fixture(), a = await f.submit("same"), b = await f.submit("same"); expect(a.jobId).toBe(b.jobId); expect(workflows).toHaveLength(1); await expect(f.call(jobs.submit, { version: 1, requestId: "same", intent: "code", prompt: "Create a short useful document" })).rejects.toMatchObject({ data: { code: "CONTENT_IDEMPOTENCY_CONFLICT" } }); });
it("cancellation blocks actual native admission without refunding the account", async () => { const f = await fixture(), job = await f.submit("cancel"), lease = await f.claim(job.jobId); await f.call(jobs.cancel, { jobId: job.jobId }); await expect(f.generate(job.jobId, lease.leaseToken, "late")).rejects.toBeDefined(); expect(f.calls).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); });
it("saved primary crash never pays again and cannot publish without the secondary title", async () => { const f = await fixture(), job = await f.submit("gap"), lease = await f.claim(job.jobId); await f.generate(job.jobId, lease.leaseToken, "Draft"); const attempts = f.db.table("runtimeModelAttempts").length; await f.call(jobs.failed, { ...lease, uncertain: true }); await expect(f.call(jobs.reconcile, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "CONTENT_RECOVERY_INCOMPLETE" } }); expect(f.db.table("runtimeModelAttempts")).toHaveLength(attempts); expect(f.db.table("artifacts")[0].version).toBe(1); });
it("unknown work cannot reclaim or fabricate a confirmed draft", async () => { const f = await fixture(), job = await f.submit("unknown"), lease = await f.claim(job.jobId); await expect(f.call(jobs.save, { ...lease, text: "made up" })).rejects.toMatchObject({ data: { code: "CONTENT_RECOVERY_INCOMPLETE" } }); jest.spyOn(Date, "now").mockReturnValue(clock + 120001); expect(await f.call(jobs.claim, { jobId: job.jobId })).toBeNull(); expect(f.db.table("runtimeContentJobs")[0].state).toBe("unknown"); });
it("deletion after paid draft prevents atomic publication with retained liability", async () => { const f = await fixture(), job = await f.submit("deleted"), lease = await f.claim(job.jobId); await f.generate(job.jobId, lease.leaseToken, "Draft"); await f.call(jobs.next, lease); await f.generate(job.jobId, lease.leaseToken, "Title"); const artifact = f.db.table("artifacts")[0]; await f.db.patch("artifacts", artifact._id, { isDeleted: true }); await expect(f.call(jobs.publish, lease)).rejects.toBeDefined(); expect(artifact.version).toBe(1); expect(f.db.table("runtimeBudgetAccounts").filter(row => row.kind === "run")[0].uncertainUnits).toBe(200000); });
it("foreign/no-JWT callers cannot deliver owned jobs", async () => { const f = await fixture(), job = await f.submit("private"); f.identity(null); await expect(f.call(jobs.get, { jobId: job.jobId })).rejects.toBeDefined(); });
async function document(f: Awaited<ReturnType<typeof fixture>>, requestId: string) {
  const job = await f.submit(requestId), lease = await f.claim(job.jobId);
  await f.generate(job.jobId, lease.leaseToken, "Alpha sentence. Beta sentence.");
  await f.call(jobs.next, lease); await f.generate(job.jobId, lease.leaseToken, "Original Title"); await f.call(jobs.publish, lease);
  return job;
}
it("updates an exact retained artifact version while preserving the original history and title", async () => {
  const f = await fixture(), source = await document(f, "source-update");
  const job = await f.call<{jobId: string}>(jobs.submit, {version:1, requestId:"update", intent:"text", prompt:"Correct the document", artifact:{artifactId:source.artifactId, version:2}}), lease = await f.claim(job.jobId);
  await f.generate(job.jobId, lease.leaseToken, "Updated document"); expect(await f.call(jobs.next, lease)).toBe(false); await f.call(jobs.publish, lease);
  expect(await f.call(jobs.get, {jobId:job.jobId})).toMatchObject({state:"ready",artifactVersion:3,title:"Original Title",content:"Updated document"});
  expect(f.db.table("artifacts")[0].versionHistory).toMatchObject([{version:1},{version:2,content:"Alpha sentence. Beta sentence."},{version:3,content:"Updated document"}]);
  await expect(f.call(jobs.submit, {version:1,requestId:"stale-update",intent:"text",prompt:"Edit",artifact:{artifactId:source.artifactId,version:2}})).rejects.toMatchObject({data:{code:"STALE_CONTEXT"}});
});
it("suggestions remain unapplied until one exact user choice; replay never pays or edits twice", async () => {
  const f = await fixture(), source = await document(f, "source-suggest");
  const job = await f.call<{jobId:string}>(jobs.submit,{version:1,requestId:"suggest",intent:"suggestions",prompt:"Improve the alpha sentence",artifact:{artifactId:source.artifactId,version:2}}), lease=await f.claim(job.jobId);
  await f.generate(job.jobId,lease.leaseToken,JSON.stringify([{originalText:"Alpha sentence.",suggestedText:"Clear alpha sentence.",description:"Clarity"}])); expect(await f.call(jobs.next,lease)).toBe(false); await f.call(jobs.publish,lease);
  const result = await f.call<{suggestions:{suggestionId:string}[]}>(jobs.get,{jobId:job.jobId}), suggestionId=result.suggestions[0].suggestionId;
  expect(f.db.table("artifacts")[0].version).toBe(2);
  await expect(f.call(jobs.applySuggestion,{jobId:job.jobId,suggestionId,artifactVersion:1})).rejects.toMatchObject({data:{code:"STALE_CONTEXT"}});
  const attempts=f.db.table("runtimeModelAttempts").length;
  expect(await f.call(jobs.applySuggestion,{jobId:job.jobId,suggestionId,artifactVersion:2})).toMatchObject({artifactVersion:3,content:"Clear alpha sentence. Beta sentence."});
  await f.call(jobs.applySuggestion,{jobId:job.jobId,suggestionId,artifactVersion:2});
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(attempts); expect(f.db.table("artifacts")[0].versionHistory).toHaveLength(3);
});
it("recovers two confirmed durable drafts exactly once without another native attempt", async () => {
  const f=await fixture(),job=await f.submit("recover-both"),lease=await f.claim(job.jobId);
  await f.generate(job.jobId,lease.leaseToken,"Recovered document"); await f.call(jobs.next,lease); await f.generate(job.jobId,lease.leaseToken,"Recovered Title"); await f.call(jobs.failed,{...lease,uncertain:true});
  const count=f.db.table("runtimeModelAttempts").length, account=structuredClone(f.db.table("runtimeBudgetAccounts").find(row=>row.kind==="run"));
  expect(await f.call(jobs.reconcile,{jobId:job.jobId})).toMatchObject({state:"ready",artifactVersion:2}); await f.call(jobs.reconcile,{jobId:job.jobId});
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(count);expect(f.db.table("artifacts")[0].versionHistory).toHaveLength(2);expect(f.db.table("runtimeBudgetAccounts").find(row=>row.kind==="run")).toEqual(account);
});
it("automatic conversation title binds a genuine active parent model and shares its existing financial account", async () => {
  const f=await fixture(),run=await f.run(); await f.call(runtime.start,{runId:run.runId});
  const execution=f.db.table("runtimeAgentExecutions")[0], row=f.db.table("runtimeRuns")[0], attempt={reference:f.reference,runId:run.runId,attemptNumber:1,leaseVersion:execution.leaseVersion};
  await f.call(runtime.saveContext,{...attempt,context:"",witnesses:[],completeness:"complete"});
  const op=await f.call<{operationId:string;semanticId:string}>(runtime.beginOperation,{...attempt,kind:"model",ordinal:0,requestCanonical:"{}"}); await f.call(runtime.startOperation,{...attempt,operationId:op.operationId});
  const composition=createBackendGatewayComposition(f.ctx as unknown as ActionCtx),binding={reference:f.reference,operationKey:"agent.respond" as const,runBudgetId:row.runBudgetId as string,semanticId:op.semanticId,ordinal:0},resolution=await composition.ledger.resolve(binding);
  const governed=governGatewayLanguageModel({specificationVersion:"v4",provider:"convexGateway.chat",modelId:resolution.snapshot.modelId,supportedUrls:{},doStream:async()=>{throw Error("No stream");},doGenerate:async()=>({content:[{type:"text",text:"Parent answer"}],finishReason:{unified:"stop",raw:"stop"},warnings:[],usage:{inputTokens:{total:8,noCache:8,cacheRead:0,cacheWrite:undefined},outputTokens:{total:2,text:2,reasoning:0}},response:{body:{id:"fixture-parent",model:resolution.snapshot.modelId,choices:[{finish_reason:"stop",message:{content:"Parent answer"}}],usage:{prompt_tokens:8,completion_tokens:2,total_tokens:10}}}})}, {...composition,ledger:{...composition.ledger,admit:async request=>{const permit=await composition.ledger.admit(request);await f.call(runtime.bindNativeOperation,{...attempt,operationId:op.operationId,nativeOperationId:permit.operationId});return permit;}}},binding,resolution);
  try { await governed.model.doGenerate({prompt:[{role:"user",content:[{type:"text",text:"Hello"}]}],maxOutputTokens:resolution.snapshot.limits.outputTokens,abortSignal:governed.lifecycle.signal}); } finally { await governed.lifecycle.complete(); }
  const input=f.native.messages.get((row.inputMessageIds as string[])[0])!,finalId="native:parent-final";
  f.native.messages.set(finalId,{...input,_id:finalId,stepOrder:1,agentName:`cortex:${run.runId}:1:0`,message:{role:"assistant",content:"Parent answer"}});
  await f.call(runtime.finishOperation,{...attempt,operationId:op.operationId,resultCanonical:"{}",nativeMessageIds:[finalId]});
  const jobId=await f.call<string>(jobs.enqueueParentTitle,{reference:f.reference,runId:run.runId}),lease=await f.claim(jobId),accounts=f.db.table("runtimeBudgetAccounts").length;
  await f.generate(jobId,lease.leaseToken,"Hello World");await f.call(jobs.publish,lease);
  const job=f.db.table("runtimeContentJobs")[0];expect(job.runAccountId).toBe(row.runAccountId);expect(job.parentOperationId).toBe(f.db.table("runtimeModelOperations")[0]._id);expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(accounts);
  expect(JSON.parse(f.db.table("runtimeConversations")[0].metadataCanonical as string)).toMatchObject({title:"Hello World"});
  expect(await f.call(jobs.enqueueParentTitle,{reference:f.reference,runId:run.runId})).toBeNull();
  await expect(f.call(jobs.submit,{version:1,requestId:"invented-parent",intent:"title",prompt:"Title",conversationId:run.conversationId,parentRunId:"invented"})).rejects.toBeDefined();
});
it("ready derived content rechecks consumed artifact metadata independently of its own output version", async()=>{
  const f=await fixture(),upstream=await document(f,"upstream"),run=await f.run(),row=f.db.table("runtimeRuns")[0],messageId=(row.inputMessageIds as string[])[0];
  const bridge=f.db.table("runtimeTranscriptMessages").find(row=>row.nativeMessageId===messageId)!;
  bridge.artifactContextWitnesses=[await artifactMetadataWitness(await readArtifactContext(f.ctx,f.reference,upstream.artifactId))];
  const job=await f.call<{jobId:string}>(jobs.submit,{version:1,requestId:"derived",intent:"text",prompt:"Draft from the selected message",conversationId:run.conversationId,sourceMessageId:messageId}),lease=await f.claim(job.jobId);
  await f.generate(job.jobId,lease.leaseToken,"Derived content");await f.call(jobs.next,lease);await f.generate(job.jobId,lease.leaseToken,"Derived Title");await f.call(jobs.publish,lease);
  expect(await f.call(jobs.get,{jobId:job.jobId})).toMatchObject({state:"ready",content:"Derived content"});
  const original=f.db.table("artifacts").find(row=>row.artifactId===upstream.artifactId)!;await f.db.patch("artifacts",original._id,{isDeleted:true});
  await expect(f.call(jobs.get,{jobId:job.jobId})).rejects.toMatchObject({data:{code:"FORBIDDEN"}});
});
