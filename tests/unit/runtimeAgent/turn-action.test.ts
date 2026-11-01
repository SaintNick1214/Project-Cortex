/** Actual V5/context/model/native-ledger/finalization bodies; only provider/Agent component ports are controlled. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { GatewayBinding, GatewayComposition, GatewayResolution, GatewayAdmissionCheckpoint } from "../../../convex-dev/runtimeGateway";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { agentToolCatalog } from "../../../src/domain/agent-tools";
import { assertNativeArgs } from "./native-arguments";
const agentModule = await import("@convex-dev/agent");
let active: Awaited<ReturnType<typeof fixture>>, composition: GatewayComposition, binding: GatewayBinding, resolution: GatewayResolution;
let providerCalls = 0, completionCalls = 0, beforeDispatch: (() => void) | undefined;
let mode: "final" | "tool" | "provider-failure" = "final";
jest.unstable_mockModule("@convex-dev/agent", () => ({ ...agentModule, Agent: class {
  constructor(_component: unknown, readonly options: { name: string; contextHandler: () => Promise<unknown> }) {}
  async generateText(ctx: ActionCtx, identity: unknown) { return await this.streamText(ctx, identity, { onChunk: async () => {} }); }
  async streamText(ctx: ActionCtx, _identity: unknown, args: { onChunk: (value: { chunk: unknown }) => Promise<void> }) {
    await this.options.contextHandler(); beforeDispatch?.();
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
  define(input: { handler: unknown }) { return { _handler: input.handler }; } async start() { return "workflow:turn-action"; }
} }));
// Install the trusted policy fixture first, then replace the Gateway factory
// before ingestion loads runtimeMemory and its Gateway backend dependency.
const { clone, ledger, clock } = await import("../runtimeTranscript/fixture");
const { qualifiedTerminalModelId } = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
const gatewayModule = await import("../../../convex-dev/runtimeGateway");
jest.unstable_mockModule("../../../convex-dev/runtimeGateway", () => ({ ...gatewayModule, createGovernedGatewayModel: async (next: GatewayComposition, nextBinding: GatewayBinding) => {
  composition = next; binding = nextBinding; resolution = await next.ledger.resolve(nextBinding);
  return { model: { specificationVersion: "v4", provider: "controlled", modelId: "controlled/model", doStream: async () => {}, doGenerate: async () => {} },
    lifecycle: { complete: async () => { completionCalls++; }, signal: new AbortController().signal } };
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent"), runs = await import("../../../convex-dev/runs"), memory = await import("../../../convex-dev/runtimeMemory");
const definitions = await import("../../../convex-dev/agentDefinitions");
beforeEach(() => { installIngestionMockRoot(); providerCalls = completionCalls = 0; mode = "final"; beforeDispatch = undefined; }); afterEach(() => { jest.restoreAllMocks(); });
async function fixture(tool = false) {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = []; let titleAfterCanonical = false;
  f.ctx.runQuery = (async (ref, input) => { let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, input); } calls.push(name);
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name.startsWith("runtimeMemory:") ? memory[name.split(":")[1] as keyof typeof memory] : name === "runtimeModelPolicy:resolve" ? ledger.resolve : undefined;
    if (reg) { assertNativeArgs(reg, input); return invoke(reg, f.ctx, input); } return query(ref, input);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, input) => { let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, input); } calls.push(name);
    if (name === "runtimeContentJobs:enqueueParentTitle") { titleAfterCanonical = f.db.table("runtimeRuns")[0].responseStatus === "complete" && f.db.table("runtimeAgentIngestion").length === 1; throw Error("CONTROLLED_OPTIONAL_TITLE_FAILURE"); }
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name === "runs:claimNext" ? runs.claimNext : name.startsWith("runtimeModelPolicy:") ? ledger[name.split(":")[1] as keyof typeof ledger] : undefined;
    if (reg) { assertNativeArgs(reg, input); return f.call(reg, input); } return mutation(ref, input);
  }) as MutationCtx["runMutation"];
  async function start(streaming = true) { let request = f.request();
    if (tool) { f.grant.capabilities = [...f.grant.capabilities as string[], "tool"]; const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "turn-tools", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, tools: [{ toolId: "memory.recall", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "explicit" }], policies: [{ policyId: "turn-tools", version: 1, rules: { limits: { toolSteps: 4 } } }] } }); request = { ...request, agentId: published.agentId, agentVersion: published.version }; }
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request }); await f.call(runtime.start, { runId: run.runId, streaming }); const owned = f.db.table("runtimeAgentExecutions")[0];
    const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number }; await f.call(runtime.startContext, args); active = result; return args; }
  const result = { ...f, get grant() { return f.grant; }, calls, start, get titleAfterCanonical() { return titleAfterCanonical; } }; return result;
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const state = (f: Fixture) => clone({ rows: f.db.rows, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled });
it.each(["empty", "populated_pending", "final_only"])("one %s turn Action completes canonical answer and durable ingestion before optional title failure", async context => {
  const f = await fixture(); if (context === "populated_pending") { const source = await f.source("Authorized pending evidence", "prior"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); }
  const args = await f.start(context !== "final_only"), result = await runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 });
  expect(result).toMatchObject({ final: true, calls: [], savedMessageIds: ["native:controlled:0"] }); expect(providerCalls).toBe(1); expect(completionCalls).toBe(1);
  expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("complete"); expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("complete"); expect(f.titleAfterCanonical).toBe(true);
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", slotReleased: true, resultAttachmentState: "attached" });
  expect(f.calls).not.toContain("runtimeAgent:modelStep"); expect(f.calls).not.toContain("runtimeAgent:prepareContext"); expect(f.calls).not.toContain("runtimeAgent:resolveModelOperation"); expect(f.calls).toContain("runtimeAgent:admitPreparedModelOperation");
  expect(f.calls.indexOf("runtimeAgent:finalize")).toBeLessThan(f.calls.indexOf("runtimeContentJobs:enqueueParentTitle"));
  if (context === "populated_pending") expect(f.db.table("runtimeAgentExecutions")[0].sourceWitnesses).toMatchObject([{ sourceId: "prior" }]);
});
it.each(["grant", "transcript", "cancel"])("%s between proposed resolution/context hook and final admission denies before the controlled provider", async fault => {
  const f = await fixture(), args = await f.start(); beforeDispatch = () => { if (fault === "grant") f.grant.revokedAt = clock; if (fault === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = clock; if (fault === "transcript") f.native.messages.values().next().value!.message = { role: "user", content: "edited" }; };
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow(); expect(providerCalls).toBe(0); expect(completionCalls).toBe(1);
  expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
});
it("ambiguous provider failure closes once and is not retried; original interruption retains UNKNOWN liability", async () => {
  const f = await fixture(), args = await f.start(); mode = "provider-failure";
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow("CONTROLLED_AMBIGUOUS_PROVIDER_FAILURE"); expect(providerCalls).toBe(1); expect(completionCalls).toBe(1);
  await f.call(runtime.endInterrupted, { ...args, cancelled: false }); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("unknown");
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false }); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow(); expect(providerCalls).toBe(1);
});
it("component completion/Core finish gap stays reconcilable without another model or duplicate ingestion", async () => {
  const f = await fixture(), args = await f.start(), mutation = f.ctx.runMutation.bind(f.ctx); let stop = true;
  f.ctx.runMutation = (async (ref, input) => { if (stop && getFunctionName(ref) === "runtimeAgent:finishOperation") throw Error("CONTROLLED_COMPONENT_CORE_GAP"); return mutation(ref, input); }) as MutationCtx["runMutation"];
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow("CONTROLLED_COMPONENT_CORE_GAP"); expect(providerCalls).toBe(1); expect(f.native.messages.has("native:controlled:0")).toBe(true); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
  await f.call(runtime.endInterrupted, { ...args, cancelled: false }); stop = false;
  const recovered = await f.call(runtime.reconcile, { runId: args.runId }); expect(recovered).toMatchObject({ receiptId: expect.any(String) }); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("complete"); expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1);
  const before = state(f); expect(await f.call(runtime.reconcile, { runId: args.runId })).toEqual(recovered); expect(state(f)).toEqual(before); expect(providerCalls).toBe(1);
});
it("stale transcript after completed model operation cannot register/finalize obsolete assistant output", async () => {
  const f = await fixture(), args = await f.start(), mutation = f.ctx.runMutation.bind(f.ctx); let reached = false;
  f.ctx.runMutation = (async (ref, input) => { if (getFunctionName(ref) === "runtimeAgent:finalize") { reached = true; f.native.messages.values().next().value!.message = { role: "user", content: "edited" }; } return mutation(ref, input); }) as MutationCtx["runMutation"];
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow("STALE_TRANSCRIPT"); expect(reached).toBe(true); expect(providerCalls).toBe(1);
  expect(f.db.table("runtimeAgentIngestion")).toEqual([]); expect(f.db.table("runtimeRuns")[0].responseStatus).not.toBe("complete");
});
it("tool result returns to Workflow ownership without finalization or title work", async () => {
  const f = await fixture(true), args = await f.start(); mode = "tool";
  const result = await runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 }); expect(result).toMatchObject({ final: false, calls: [{ toolCallId: "controlled-call", toolName: "memory_recall" }] });
  expect(f.calls).not.toContain("runtimeAgent:finalize"); expect(f.calls).not.toContain("runtimeContentJobs:enqueueParentTitle"); expect(f.db.table("runtimeAgentIngestion")).toEqual([]); expect(providerCalls).toBe(1);
  const prepared = await f.call<{ operationId: string; state: string }>(runtime.beginOperation, { ...args, kind: "tool", ordinal: 0, requestCanonical: result.calls[0].inputCanonical, toolCallId: result.calls[0].toolCallId, toolName: result.calls[0].toolName });
  expect(prepared.state).toBe("waiting_approval"); await f.call(runtime.waitForApproval, { ...args, operationId: prepared.operationId }); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("waiting_approval");
  await expect(f.call(runtime.startOperation, { ...args, operationId: prepared.operationId })).rejects.toThrow(); expect(providerCalls).toBe(1);
});

it("lost Action acknowledgement after completed operation rejects a duplicate, then original reconciliation finalizes exactly once", async () => {
  const f = await fixture(), args = await f.start(), mutation = f.ctx.runMutation.bind(f.ctx); let stop = true;
  f.ctx.runMutation = (async (ref, input) => { if (stop && getFunctionName(ref) === "runtimeAgent:finalize") throw Error("CONTROLLED_COMPLETED_ACTION_GAP"); return mutation(ref, input); }) as MutationCtx["runMutation"];
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow("CONTROLLED_COMPLETED_ACTION_GAP");
  expect(f.db.table("runtimeAgentOperations")[0].state).toBe("complete"); expect(f.db.table("runtimeAgentIngestion")).toEqual([]); const before = state(f);
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow("INVALID_STATE"); expect(state(f)).toEqual(before); expect(providerCalls).toBe(1);
  stop = false; await f.call(runtime.endInterrupted, { ...args, cancelled: false }); const receipt = await f.call(runtime.reconcile, { runId: args.runId });
  expect(await f.call(runtime.reconcile, { runId: args.runId })).toEqual(receipt); expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1); expect(f.db.table("runtimeRuns")[0].outputMessageIds).toEqual(["native:controlled:0"]); expect(providerCalls).toBe(1);
});

it("populated indexed context invokes the unchanged governed query-embedding path before model preparation with the original account", async () => {
  const f = await fixture(), source = await f.source("Prior indexed evidence", "prior-indexed"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  f.db.table("runtimeIngestionEvents")[0].factsState = f.db.table("runtimeIngestionEvents")[0].vectorsState = "complete";
  const args = await f.start(), query = f.ctx.runQuery.bind(f.ctx); let reached: unknown;
  f.ctx.runQuery = (async (ref, input) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, input); }
    if (name === "runtimeModelPolicy:resolve" && (input as { operationKey: string }).operationKey === "embedding.query") { reached = input; await query(ref, input); throw Error("CONTROLLED_ORIGINAL_QUERY_EMBEDDING"); } return query(ref, input);
  }) as MutationCtx["runQuery"];
  await expect(runtime.turnStepV5Handler(f.ctx as unknown as ActionCtx, { ...args, ordinal: 0 })).rejects.toThrow("CONTROLLED_ORIGINAL_QUERY_EMBEDDING");
  expect(reached).toEqual({ reference: args.reference, operationKey: "embedding.query", runBudgetId: f.db.table("runtimeRuns")[0].runBudgetId });
  expect(f.db.table("runtimeAgentOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(providerCalls).toBe(0);
});
