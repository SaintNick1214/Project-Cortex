/** Differential actual preimage/current handlers; no inferred native latency. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName, getFunctionAddress } from "convex/server";
import type { ApiFromModules, FunctionReturnType } from "convex/server";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { assertNativeArgs } from "./native-arguments";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class { define(input: { handler: unknown }) { return { _handler: input.handler }; } async start() { return "workflow:turn"; } } }));
const { ingestionFixture, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, clock, ledger } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const memory = await import("../../../convex-dev/runtimeMemory");
// Deliberate original source controls built by the recorded TypeScript transform.
const legacy: typeof runtime = await import("../../fixtures/runtimeAgent/native-transcript-read-original-runtimeAgent.mjs");
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  f.ctx.runQuery = (async (ref, input) => { let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, input); } calls.push(name);
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name.startsWith("runtimeMemory:") ? memory[name.split(":")[1] as keyof typeof memory] : undefined;
    if (reg) { assertNativeArgs(reg, input); return invoke(reg, f.ctx, input); } return query(ref, input);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, input) => { let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, input); } calls.push(name);
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name === "runs:claimNext" ? runs.claimNext : undefined;
    if (reg) { assertNativeArgs(reg, input); return f.call(reg, input); } return mutation(ref, input);
  }) as MutationCtx["runMutation"];
  async function start(saved = false) { const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() }); await f.call(runtime.start, { runId: run.runId });
    const execution = f.db.table("runtimeAgentExecutions")[0], args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: execution.leaseVersion as number };
    await f.call(runtime.startContext, args); if (saved) await f.call(runtime.saveContext, { ...args, context: "", witnesses: [], completeness: "complete" }); return args; }
  return { ...f, get grant() { return f.grant; }, calls, start };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type RuntimeApi = ApiFromModules<{ runtimeAgent: typeof runtime }>["runtimeAgent"];
type Prepared = Extract<FunctionReturnType<RuntimeApi["prepareResolvedModelOperation"]>, { state: "started" }>;
async function admission(f: Fixture, args: Awaited<ReturnType<Fixture["start"]>>, prepared: Prepared) {
  const resolution = prepared.governedResolution, pins = resolution.snapshot.pins;
  const request: ModelCallRequest = { semanticId: prepared.op.semanticId, childCallId: "controlled-child", texts: ["Hello world!"], messages: [{ role: "user", parts: [{ type: "text", text: "Hello world!" }] }],
    inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1000, reservationUnits: resolution.snapshot.costBound.maximumCostUnits,
    promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion, extractionVersion: pins.extractionVersion, toolRegistryVersion: pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
  request.inputTokens = ledger.deriveQualifiedInputBound(resolution.dispatchEvidence, request);
  return { ...args, operationId: prepared.op.operationId, ordinal: 0, requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(resolution.snapshot),
    bindingCanonical: canonicalModelJson({ reference: args.reference, operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId, semanticId: prepared.op.semanticId, ordinal: 0 }) };
}

function state(f: Awaited<ReturnType<typeof fixture>>) { return clone({ rows: f.db.rows, sequence: f.db.sequence, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled }); }
function messageReads(spy: { mock: { calls: readonly (readonly unknown[])[] } }) { return spy.mock.calls.filter(([ref]) => getFunctionAddress(ref as Parameters<typeof getFunctionAddress>[0]).reference?.endsWith("/messages/getMessagesByIds")).length; }
it.each(["prepareTurnModel", "prepareResolvedModelOperation"] as const)("%s retains exact original output/writes with fewer official raw reads", async name => {
 const f = await fixture(), args = await f.start(name !== "prepareTurnModel"), before = state(f), spy = jest.spyOn(f.ctx,"runQuery"), input = name === "prepareTurnModel" ? args : { ...args, ordinal:0 }, stop=Error("REFERENCE_ROLLBACK"); let expected:unknown, expectedState:unknown;
 await expect(f.transaction(async()=>{expected=await invoke(legacy[name],f.ctx,input);expectedState=state(f);throw stop;})).rejects.toBe(stop); const referenceReads=messageReads(spy);expect(state(f)).toEqual(before);spy.mockClear();
 // The historical read-control predates the additive selection metadata. Derive
 // it from the same immutable pins while retaining exact existing output/state.
 const candidate=expected as Prepared;
 candidate.current.messageEntries=candidate.current.messages.map((message,index)=>({id:candidate.current.snapshot.messages[index]!.nativeMessageId,message,mandatory:candidate.current.run.inputMessageIds.includes(candidate.current.snapshot.messages[index]!.nativeMessageId)}));
 expect(await f.call(runtime[name],input)).toEqual(expected);expect(state(f)).toEqual(expectedState);const optimizedReads=messageReads(spy);console.info(JSON.stringify({type:"native-transcript-read-count",name,referenceReads,optimizedReads}));expect(optimizedReads).toBeLessThan(referenceReads);
 expect({referenceReads,optimizedReads}).toEqual(name === "prepareTurnModel" ? {referenceReads:32,optimizedReads:9}:{referenceReads:16,optimizedReads:3});
});
it.each(["grant", "native-content", "bridge", "cancel", "lease", "qualification"] as const)("fresh %s denial/error order and rollback match original parent",async change=>{
 const f=await fixture(),args=await f.start();
 if(change==="grant")f.grant.revokedAt=clock;
 if(change==="native-content")f.native.messages.values().next().value!.message={role:"user",content:"edited"};
 if(change==="bridge")f.db.table("runtimeTranscriptMessages")[0].revision=2;
 if(change==="cancel")f.db.table("runtimeRuns")[0].cancellationRequestedAt=clock;
 if(change==="lease")f.db.table("runtimeRunOutbox")[0].leaseVersion=999;
 if(change==="qualification")f.db.table("runtimeModelQualifications")[0].revokedAt=clock;
 const before=state(f);let error:unknown;try{await f.call(legacy.prepareTurnModel,args);}catch(caught){error=caught;}expect(error).toBeDefined();expect(state(f)).toEqual(before);
 await expect(f.call(runtime.prepareTurnModel,args)).rejects.toMatchObject({data:(error as {data:unknown}).data});expect(state(f)).toEqual(before);
});

it("admitPreparedModelOperation retains the original complete admission/checkpoint state with fewer raw lookups",async()=>{
 const f=await fixture(),args=await f.start(true),prepared=await f.call<Prepared>(runtime.prepareResolvedModelOperation,{...args,ordinal:0});const input=await admission(f,args,prepared),before=state(f),spy=jest.spyOn(f.ctx,"runQuery"),stop=Error("REFERENCE_ROLLBACK");let expected:unknown,expectedState:unknown;
 await expect(f.transaction(async()=>{expected=await invoke(legacy.admitPreparedModelOperation,f.ctx,input);expectedState=state(f);throw stop;})).rejects.toBe(stop);expect(state(f)).toEqual(before);const referenceReads=messageReads(spy);spy.mockClear();expect(await f.call(runtime.admitPreparedModelOperation,input)).toEqual(expected);expect(state(f)).toEqual(expectedState);const optimizedReads=messageReads(spy);console.info(JSON.stringify({type:"native-transcript-read-count",name:"admitPreparedModelOperation",referenceReads,optimizedReads}));expect(optimizedReads).toBeLessThan(referenceReads);
});
