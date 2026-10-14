/** Actual direct V6 and original V5 controls; provider/Agent component ports are controlled, no inference. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { GatewayBinding, GatewayComposition, GatewayResolution, GatewayAdmissionCheckpoint } from "../../../convex-dev/runtimeGateway";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { agentToolCatalog } from "../../../src/domain/agent-tools";
import { assertNativeArgs } from "./native-arguments";
const agentModule = await import("@convex-dev/agent");
let active: Awaited<ReturnType<typeof fixture>>, composition: GatewayComposition, binding: GatewayBinding, resolution: GatewayResolution;
const assembledPrompts: unknown[] = [];
let providerCalls = 0, completionCalls = 0, beforeDispatch: (() => void) | undefined;
let mode: "final" | "tool" | "provider-failure" = "final";
const workflows: unknown[] = []; let workflowFailure = false;
jest.unstable_mockModule("@convex-dev/agent", () => ({ ...agentModule, Agent: class {
  constructor(_component: unknown, readonly options: { name: string; contextHandler: () => Promise<unknown> }) {}
  async generateText(ctx: ActionCtx, identity: unknown) { return await this.streamText(ctx, identity, { onChunk: async () => {} }); }
  async streamText(ctx: ActionCtx, _identity: unknown, args: { onChunk: (value: { chunk: unknown }) => Promise<void> }) {
    assembledPrompts.push(await this.options.contextHandler()); beforeDispatch?.();
    const request: ModelCallRequest = { semanticId: binding.semanticId, childCallId: "controlled-child", texts: ["Hello world!"], messages: [{ role: "user", parts: [{ type: "text", text: "Hello world!" }] }],
      inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1000, reservationUnits: resolution.snapshot.costBound.maximumCostUnits,
      promptVersion: resolution.snapshot.pins.promptVersion, schemaVersion: resolution.snapshot.pins.schemaVersion, extractionVersion: resolution.snapshot.pins.extractionVersion, toolRegistryVersion: resolution.snapshot.pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
    if (mode === "tool") { request.toolSteps = 1; request.tools = agentToolCatalog(resolution.snapshot.pins.toolRegistryVersion)!.filter(tool => tool.name === "memory_recall").map(tool => ({ name: tool.name, definition: { description: tool.description, inputSchema: tool.inputSchema } })); request.toolChoice = { type: "auto" }; }
    request.inputTokens = ledger.deriveQualifiedInputBound(resolution.dispatchEvidence, request);
    const admitted: GatewayAdmissionCheckpoint = await composition.ledger.admitAndCheckpoint!({ ...binding, requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(resolution.snapshot) });
    if (admitted.admission.status !== "reserved" || !("permit" in admitted) || !admitted.permit.dispatchPermit) throw Error("CONTROLLED_NO_DISPATCH_PERMIT");
    providerCalls++; if (mode === "provider-failure") throw Error("CONTROLLED_AMBIGUOUS_PROVIDER_FAILURE");
    await composition.ledger.markVisible({ reference: binding.reference, attemptId: admitted.admission.attemptId, outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false });
    const text = mode === "tool" ? "" : "safe final", calls = mode === "tool" ? [{ toolCallId: "controlled-call", toolName: "memory_recall", input: { text: "query", limit: 1 } }] : [];
    await args.onChunk({ chunk: mode === "tool" ? { type: "tool-call", ...calls[0] } : { type: "text-delta", text } });
    const privateResultCanonical = canonicalModelJson({ version: 1, kind: "language", content: calls.length
      ? calls.map(call => ({ type: "tool-call", toolCallId: call.toolCallId, toolName: call.toolName, input: canonicalModelJson(call.input) }))
      : [{ type: "text", text }], finishReason: calls.length ? "tool-calls" : "stop" });
    const capture = await composition.terminalSink.capture({ attemptId: admitted.admission.attemptId, dispatchIdentity: admitted.permit.dispatchIdentity,
      receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity: admitted.permit.dispatchIdentity, receiptId: "controlled-terminal", modelId: resolution.snapshot.modelId,
        nativeInterface: resolution.snapshot.nativeInterface, actualModel: qualifiedTerminalModelId(resolution.dispatchEvidence), usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable" }) });
    expect(await composition.ledger.attachTerminalResult({ reference: binding.reference, attemptId: admitted.admission.attemptId, evidenceId: capture.evidenceId, privateResultCanonical })).toMatchObject({ attached: true, resultWithheld: false });
    const input = active.native.messages.values().next().value!, id = `native:controlled:${binding.ordinal}`;
    const message = { ...input, _id: id, stepOrder: 1 + binding.ordinal * 2, agentName: this.options.name,
      message: { role: "assistant", content: calls.length ? [{ type: "tool-call", toolCallId: calls[0].toolCallId, toolName: calls[0].toolName, input: calls[0].input }] : text } };
    active.native.messages.set(id, message); void ctx;
    return { toolCalls: Promise.resolve(calls), savedMessages: [message], text: Promise.resolve(text) };
  }
} }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; } async start(_ctx: unknown, ref: unknown, args: unknown, options: unknown) { if (workflowFailure) throw Error("CONTROLLED_HANDOFF_FAILURE"); workflows.push({ name: getFunctionName(ref as never), args, options }); return "workflow:direct-tools"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, ledger, clock } = await import("../runtimeTranscript/fixture");
const { qualifiedTerminalModelId } = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
const gatewayModule = await import("../../../convex-dev/runtimeGateway");
jest.unstable_mockModule("../../../convex-dev/runtimeGateway", () => ({ ...gatewayModule, createGovernedGatewayModel: async (next: GatewayComposition, nextBinding: GatewayBinding) => {
  composition = next; binding = nextBinding; resolution = await next.ledger.resolve(nextBinding);
  return { model: { specificationVersion: "v4", provider: "controlled", modelId: "controlled/model", doStream: async () => {}, doGenerate: async () => {} },
    lifecycle: { complete: async () => { completionCalls++; }, signal: new AbortController().signal } };
} }));
const runtime = await import("../../../convex-dev/runtimeAgent"), runs = await import("../../../convex-dev/runs"), memory = await import("../../../convex-dev/runtimeMemory");
const definitions = await import("../../../convex-dev/agentDefinitions");
const queryEmbedding = await import("../../../convex-dev/runtimeAgentQueryEmbedding");
beforeEach(() => { installIngestionMockRoot(); providerCalls = completionCalls = 0; mode = "final"; beforeDispatch = undefined; assembledPrompts.length = 0; workflows.length = 0; workflowFailure = false; }); afterEach(() => { jest.restoreAllMocks(); });
async function fixture(tool = false) {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = []; let titleAfterCanonical = false;
  f.ctx.runQuery = (async (ref, input) => { let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, input); } calls.push(name);
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name.startsWith("runtimeMemory:") ? memory[name.split(":")[1] as keyof typeof memory] : name === "runtimeModelPolicy:resolve" ? ledger.resolve : undefined;
    if (reg) { assertNativeArgs(reg, input); return invoke(reg, f.ctx, input); } return query(ref, input);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, input) => { let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, input); } calls.push(name);
    if (name === "runtimeContentJobs:enqueueParentTitle") { titleAfterCanonical = f.db.table("runtimeRuns")[0].responseStatus === "complete" && f.db.table("runtimeAgentIngestion").length === 1; throw Error("CONTROLLED_OPTIONAL_TITLE_FAILURE"); }
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name.startsWith("runs:") ? runs[name.split(":")[1] as keyof typeof runs] : name.startsWith("runtimeModelPolicy:") ? ledger[name.split(":")[1] as keyof typeof ledger] : undefined;
    if (reg) { assertNativeArgs(reg, input); return f.call(reg, input); } return mutation(ref, input);
  }) as MutationCtx["runMutation"];
  async function start(streaming = true) { let request = f.request();
    if (tool) { f.grant.capabilities = [...f.grant.capabilities as string[], "tool"]; const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "turn-tools", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, tools: [{ toolId: "memory.recall", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "explicit" }], policies: [{ policyId: "turn-tools", version: 1, rules: { limits: { toolSteps: 4 } } }] } }); request = { ...request, agentId: published.agentId, agentVersion: published.version }; }
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId, streaming }); const owned = f.db.table("runtimeAgentExecutions")[0];
    const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number }; active = result; return args; }
  const result = { ...f, get grant() { return f.grant; }, calls, start, get titleAfterCanonical() { return titleAfterCanonical; } }; return result;
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const state = (f: Fixture) => clone({ rows: f.db.rows, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled });

const direct = (f: Fixture, args: Awaited<ReturnType<Fixture["start"]>>) => invoke(runtime.executeDirectV6, f.ctx, args);
it.each(["empty", "populated_pending", "final_only"])("one direct %s turn uses original finalization and registers ingestion once before title", async context => {
  const f = await fixture(); if (context === "populated_pending") { const source = await f.source("Authorized prior evidence", "prior"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); }
  const args = await f.start(context !== "final_only");
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ executionMode: "direct-v6", directState: "scheduled" });
  expect(f.scheduled.filter(x => x.name === "runtimeAgent:executeDirectV6")).toHaveLength(1); expect(workflows).toEqual([]);
  await direct(f, args); expect(providerCalls).toBe(1); expect(completionCalls).toBe(1); expect(f.titleAfterCanonical).toBe(true);
  expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("complete"); expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1);
  expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("complete"); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  // Both original context construction and terminal attachment retain fresh Action hydration.
  expect(f.calls.filter(x => x === "runtimeAgent:hydrateExecution")).toHaveLength(2);
  const before = state(f); await direct(f, args); expect(state(f)).toEqual(before); expect(providerCalls).toBe(1);
});
it("direct claim/preparation equals the original prefix and V5 preparation outcomes", async () => {
  const f = await fixture(), args = await f.start(), before = state(f), stop = Error("REFERENCE_ROLLBACK"); let original: unknown;
  await expect(f.transaction(async () => {
    await f.db.patch("runtimeAgentExecutions", f.db.table("runtimeAgentExecutions")[0]._id, { directState: "started" });
    await invoke(runtime.startContext, f.ctx, args); expect(await invoke(runtime.contextBarrier, f.ctx, args)).toMatchObject({ state: "ready" });
    original = await invoke(runtime.prepareTurnModel, f.ctx, args); throw stop;
  })).rejects.toBe(stop); expect(state(f)).toEqual(before);
  expect(await f.call(runtime.prepareDirectTurn, args)).toEqual({ ...original as object, requestPreflight: true }); expect(providerCalls).toBe(0); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  const completed = state(f); expect(await f.call(runtime.prepareDirectTurn, args)).toEqual({ state: "duplicate" }); expect(state(f)).toEqual(completed);
});
it.each(["grant", "transcript", "cancel", "lease", "source", "source-tombstone", "definition", "qualification", "budget"])("V6 prepared prompt cannot authorize %s changed before fresh atomic admission", async fault => {
  const f = await fixture(); const source = fault.startsWith("source") ? await f.source("Bound evidence", "witness") : undefined;
  if (source) await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const args = await f.start(); beforeDispatch = () => {
    if (fault === "grant") f.grant.revokedAt = clock;
    if (fault === "transcript") f.native.messages.values().next().value!.message = { role: "user", content: "edited" };
    if (fault === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = clock;
    if (fault === "lease") f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = 0;
    if (fault === "source") f.db.table("runtimeMemorySources").find(x => (x.lineage as { sourceId: string }).sourceId === "witness")!.contentHash = "tampered";
    if (fault === "source-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "witness", deletedAt: clock });
    if (fault === "definition") f.db.table("runtimeAgentDefinitions")[0].revokedAt = clock;
    if (fault === "qualification") f.db.table("runtimeModelQualifications")[0].revokedAt = clock;
    if (fault === "budget") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.cancelled = true;
  };
  await expect(direct(f, args)).rejects.toBeInstanceOf(ConvexError); expect(providerCalls).toBe(0); expect(f.db.table("runtimeAgentIngestion")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("provider failure keeps original UNKNOWN liability and duplicate direct Action cannot replay", async () => {
  const f = await fixture(), args = await f.start(); mode = "provider-failure";
  await expect(direct(f, args)).rejects.toThrow("CONTROLLED_AMBIGUOUS_PROVIDER_FAILURE"); expect(providerCalls).toBe(1);
  expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("unknown"); expect(f.db.table("runtimeAgentOperations")[0].state).toBe("unknown");
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
  await direct(f, args); expect(providerCalls).toBe(1);
});
it.each(["finishOperation", "finalize"])("a %s lost acknowledgement reconciles one final transcript and ingestion without paid retry", async boundary => {
  const f = await fixture(), args = await f.start(), mutation = f.ctx.runMutation.bind(f.ctx); let stop = true;
  f.ctx.runMutation = (async (ref, input) => { if (stop && getFunctionName(ref) === `runtimeAgent:${boundary}`) throw Error("CONTROLLED_NATIVE_CORE_GAP"); return mutation(ref, input); }) as MutationCtx["runMutation"];
  await expect(direct(f, args)).rejects.toThrow("CONTROLLED_NATIVE_CORE_GAP"); expect(providerCalls).toBe(1); expect(f.db.table("runtimeAgentIngestion")).toEqual([]); stop = false;
  const recovered = await f.call(runtime.reconcile, { runId: args.runId }); expect(recovered).toMatchObject({ receiptId: expect.any(String) });
  expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1); const before = state(f); expect(await f.call(runtime.reconcile, { runId: args.runId })).toEqual(recovered); expect(state(f)).toEqual(before); expect(providerCalls).toBe(1);
});
it("completed tool output attaches one asynchronous continuation; duplicate attachment never repeats first model", async () => {
  const f = await fixture(true), args = await f.start(); mode = "tool"; await direct(f, args);
  expect(workflows).toMatchObject([{ name: "runtimeAgent:executeToolsV7", args, options: { startAsync: true, context: args } }]);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ directState: "continuation", workflowId: "workflow:direct-tools" });
  const before = state(f); await f.call(runtime.attachDirectContinuation, args); expect(state(f)).toEqual(before); expect(workflows).toHaveLength(1); expect(providerCalls).toBe(1);
});
it("lost tool handoff retains explicit recovery and attaches persisted result with no first-model replay", async () => {
  const f = await fixture(true), args = await f.start(); mode = "tool"; workflowFailure = true;
  await expect(direct(f, args)).rejects.toThrow("CONTROLLED_HANDOFF_FAILURE"); expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ directState: "continuation_pending", state: "running" });
  expect(f.db.table("runtimeAgentOperations")[0].state).toBe("complete"); expect(providerCalls).toBe(1); workflowFailure = false;
  expect(await f.call(runtime.reconcile, { runId: args.runId })).toEqual({ workflowId: "workflow:direct-tools" }); expect(providerCalls).toBe(1); expect(workflows).toHaveLength(1);
});
it("revocation after completed tool output denies recovery without attaching a new Workflow", async () => {
  const f = await fixture(true), args = await f.start(); mode = "tool"; workflowFailure = true; await expect(direct(f, args)).rejects.toThrow(); f.grant.revokedAt = clock; workflowFailure = false;
  await expect(f.call(runtime.reconcile, { runId: args.runId })).rejects.toThrow("FORBIDDEN"); expect(workflows).toEqual([]); expect(providerCalls).toBe(1);
});
it("scheduler failure is atomic with claim/execution and never runs provider work", async () => {
  const f = await fixture(), run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() }), before = state(f);
  jest.spyOn(f.ctx.scheduler, "runAfter").mockRejectedValueOnce(Error("CONTROLLED_SCHEDULE_FAILURE"));
  await expect(f.call(runtime.start, { runId: run.runId })).rejects.toThrow("CONTROLLED_SCHEDULE_FAILURE"); expect(state(f)).toEqual(before); expect(providerCalls).toBe(0);
});

it("duplicate dispatch during a started operation cannot replay or change its UNKNOWN disposition", async () => {
  const f = await fixture(), args = await f.start(); await f.call(runtime.prepareDirectTurn, args); const before = state(f);
  await direct(f, args); expect(state(f)).toEqual(before); expect(providerCalls).toBe(0);
  await f.call(runtime.interruptDirect, args); expect(f.db.table("runtimeAgentOperations")[0].state).toBe("unknown");
  await direct(f, args); expect(providerCalls).toBe(0); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
});
it("direct cancellation preserves the original run/budget fence and cancels only the recorded scheduled Action", async () => {
  const f = await fixture(), args = await f.start(), cancellations: string[] = [];
  Object.assign(f.ctx.scheduler, { cancel: async (id: string) => { cancellations.push(id); } });
  await f.call(runtime.cancel, { runId: args.runId }); expect(cancellations).toEqual([f.db.table("runtimeAgentExecutions")[0].scheduledActionId]);
  await expect(direct(f, args)).rejects.toThrow("INVALID_STATE"); expect(providerCalls).toBe(0); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("cancelled");
});
it("the original lease timer retires a crashed direct claim without retrying model work", async () => {
  const f = await fixture(), args = await f.start(); await f.call(runtime.prepareDirectTurn, args); const originalScheduled = f.scheduled.length;
  await f.call(runtime.retireDirectV6, args); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("running");
  expect(f.scheduled.length).toBe(originalScheduled + 1); expect(f.scheduled.at(-1)!.name).toBe("runtimeAgent:retireDirectV6");
  f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = clock;
  await f.call(runtime.retireDirectV6, args); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("unknown"); expect(providerCalls).toBe(0);
  expect(f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.cancelled).toBe(true);
  expect(f.scheduled.filter(x => x.name === "runtimeAgent:executeDirectV6")).toHaveLength(1);
});

it.each([false, true])("V6 retains exactly the original V5 fresh Agent prompt with pending=%s", async pending => {
  const v5 = await fixture(); if (pending) { const source = await v5.source("Authorized untrusted context", "prior"); await ingestion.enqueueSourceEvent(v5.ctx, v5.reference, source); }
  const args5 = await v5.start(); await v5.call(runtime.startContext, args5); await runtime.turnStepV5Handler(v5.ctx as unknown as ActionCtx, { ...args5, ordinal: 0 });
  const original = clone(assembledPrompts.at(-1));
  const v6 = await fixture(); if (pending) { const source = await v6.source("Authorized untrusted context", "prior"); await ingestion.enqueueSourceEvent(v6.ctx, v6.reference, source); }
  const args6 = await v6.start(); await direct(v6, args6); expect(assembledPrompts.at(-1)).toEqual(original);
  expect(v5.calls.filter(x => x === "runtimeAgent:hydrateExecution")).toHaveLength(2); expect(v6.calls.filter(x => x === "runtimeAgent:hydrateExecution")).toHaveLength(2);
  expect(v6.db.table("runtimeAgentIngestion")).toHaveLength(1); expect(v5.db.table("runtimeAgentIngestion")).toHaveLength(1);
});

it("V6 populated indexed fallback invokes the actual private preparation parent with the original derived input", async () => {
  const f = await fixture(), source = await f.source("Eligible indexed evidence", "prior"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const event = f.db.table("runtimeIngestionEvents")[0]; event.factsState = event.vectorsState = "complete";
  const args = await f.start(), original = f.ctx.runQuery.bind(f.ctx); let reached = 0, nativeInput: unknown;
  f.ctx.runQuery = (async (ref, input) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return original(ref, input); }
    if (name === "runtimeAgentQueryEmbedding:prepare") {
      reached++; nativeInput = clone(input); assertNativeArgs(queryEmbedding.prepare, input);
      await invoke(queryEmbedding.prepare, f.ctx, input); throw Error("CONTROLLED_AFTER_ACTUAL_QUERY_PREFLIGHT");
    }
    return original(ref, input);
  }) as MutationCtx["runQuery"];
  await expect(direct(f, args)).rejects.toThrow("CONTROLLED_AFTER_ACTUAL_QUERY_PREFLIGHT"); expect(reached).toBe(1);
  expect(nativeInput).toEqual({ ...args, input: { text: "Hello \nworld!", requestId: `context:${await (await import("../../../src/domain/profile")).semanticHash(canonicalModelJson([args.runId, args.attemptNumber]))}`, limit: 10 } });
  expect(providerCalls).toBe(0); expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
});
