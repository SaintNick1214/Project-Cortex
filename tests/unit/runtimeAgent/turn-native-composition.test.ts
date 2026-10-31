/** Actual original/fresh native handlers on transactional ports; no inference/native OCC/SLO claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ApiFromModules, FunctionReturnType } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { GatewayAdmissionCheckpoint } from "../../../convex-dev/runtimeGateway";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { assertNativeArgs } from "./native-arguments";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class { define(input: { handler: unknown }) { return { _handler: input.handler }; } async start() { return "workflow:turn"; } } }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, ledger, clock } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const memory = await import("../../../convex-dev/runtimeMemory");
beforeEach(() => { installIngestionMockRoot(); }); afterEach(() => { jest.restoreAllMocks(); });
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
function state(f: Fixture) { return clone({ rows: f.db.rows, sequence: f.db.sequence, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled }); }
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
it.each([false, true])("native context+preparation+two resolutions equal original handler outcomes with warning=%s", async warning => {
  const f = await fixture(), args = await f.start(); if (warning) Object.assign(f.db.table("runtimeAgentExecutions")[0], { contextCompleteness: "incomplete", contextFailureCode: "MEMORY_STAGE_FAILED" });
  const before = state(f), stop = Error("REFERENCE_ROLLBACK"); let result: unknown, original: unknown;
  await expect(f.transaction(async () => {
    expect(await invoke(runtime.prepareRoutedContext, f.ctx, args)).toEqual({ state: "COMPLETE" });
    const prepared = await invoke<Extract<FunctionReturnType<RuntimeApi["prepareModelOperation"]>, { state: "started" }>>(runtime.prepareModelOperation, f.ctx, { ...args, ordinal: 0 });
    const resolutionArgs = { ...args, runBudgetId: prepared.current.run.runBudgetId };
    const initialResolution = await invoke(runtime.resolveModelOperation, f.ctx, resolutionArgs), governedResolution = await invoke(runtime.resolveModelOperation, f.ctx, resolutionArgs);
    result = { ...prepared, initialResolution, governedResolution }; original = state(f); throw stop;
  })).rejects.toBe(stop); expect(state(f)).toEqual(before);
  expect(await f.call(runtime.prepareTurnModel, args)).toEqual(result); expect(state(f)).toEqual(original);
  expect(f.db.table("runtimeAgentOperations")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("populated context returns to the unchanged Action before model preparation, without saved context or model effects", async () => {
  const f = await fixture(), source = await f.source("Prior authorized evidence", "prior"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); const args = await f.start(), before = state(f);
  expect(await f.call(runtime.prepareTurnModel, args)).toEqual({ state: "needs_context" }); expect(state(f)).toEqual(before);
  await runtime.prepareContextHandler(f.ctx as never, args);
  const prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 });
  expect(prepared.state).toBe("started"); expect(f.db.table("runtimeAgentExecutions")[0].sourceWitnesses).toMatchObject([{ sourceId: "prior" }]);
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it.each(["started", "unknown"])("original %s model step refuses without a resolution, paid attempt or state change", async status => {
  const f = await fixture(), args = await f.start(true); await f.call(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 }); f.db.table("runtimeAgentOperations")[0].state = status;
  const before = state(f), query = jest.spyOn(f.db, "query");
  await expect(f.call(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 })).rejects.toThrow("INTERRUPTED_REQUIRES_RECONCILIATION"); expect(state(f)).toEqual(before);
  expect(query.mock.calls.some(([table]) => table === "runtimeModelQualifications")).toBe(false); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("completed model result returns exactly once without new model/resolution work", async () => {
  const f = await fixture(), args = await f.start(true), prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 });
  const input = f.native.messages.values().next().value!, id = "native:completed", value = { savedMessageIds: [id], calls: [], final: true };
  f.native.messages.set(id, { ...input, _id: id, stepOrder: 1, message: { role: "assistant", content: "answer" } });
  await f.call(runtime.finishOperation, { ...args, operationId: prepared.op.operationId, resultCanonical: canonicalModelJson(value), nativeMessageIds: [id] }); const before = state(f);
  expect(await f.call(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 })).toEqual({ state: "completed", resultCanonical: canonicalModelJson(value) }); expect(state(f)).toEqual(before); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("pre-dispatch resolution failure rolls back grouped preparation/context and original interruption remains explicit", async () => {
  const f = await fixture(), args = await f.start(), before = state(f), patch = f.db.patch.bind(f.db); let reached = false;
  jest.spyOn(f.db, "patch").mockImplementation(async (tableOrId: string, idOrValue: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    if (typeof idOrValue === "string") await patch(tableOrId, idOrValue, value!); else await patch(tableOrId, idOrValue);
    if (tableOrId === "runtimeAgentOperations" && value?.state === "started") { reached = true; f.grant.revokedAt = clock; }
  });
  await expect(f.call(runtime.prepareTurnModel, args)).rejects.toThrow("FORBIDDEN"); expect(reached).toBe(true); expect(state(f)).toEqual(before);
  await f.call(runtime.endInterrupted, { ...args, cancelled: false }); expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ state: "unknown", failureCode: "INTERRUPTED_REQUIRES_RECONCILIATION" });
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("new atomic admission equals the original outer hydrate then complete admit/bind/checkpoint parent", async () => {
  const f = await fixture(), args = await f.start(true), prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 }), input = await admission(f, args, prepared), before = state(f), stop = Error("REFERENCE_ROLLBACK"); let result: unknown, original: unknown;
  await expect(f.transaction(async () => { await invoke(runtime.hydrateExecution, f.ctx, args); const { bindingCanonical: _binding, ...originalArgs } = input; assertNativeArgs(runtime.admitModelOperation, originalArgs); result = await invoke(runtime.admitModelOperation, f.ctx, originalArgs); original = state(f); throw stop; })).rejects.toBe(stop); expect(state(f)).toEqual(before);
  expect(await f.call(runtime.admitPreparedModelOperation, input)).toEqual(result); expect(state(f)).toEqual(original);
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", attemptNumber: 1, ordinal: 0, slotReleased: false });
});
it.each(["grant", "source", "source-owner", "source-tombstone", "profile", "transcript", "lease", "cancel", "qualification", "budget", "definition"])("proposed resolution cannot authorize %s changes before final atomic admission", async fault => {
  const f = await fixture(), args = await f.start(), source = fault.startsWith("source") ? await f.source("Current source witness", "source-witness") : undefined;
  await f.call(runtime.saveContext, { ...args, context: "", witnesses: source ? [{ sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash, permissions: ["canViewMemories"] }] : [], completeness: "complete" });
  const prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 }), input = await admission(f, args, prepared);
  if (fault === "grant") f.grant.revokedAt = clock;
  if (fault === "source") await f.source("Edited current witness", "source-witness");
  if (fault === "source-owner") f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId === "source-witness")!.ownerPrincipalId = "foreign";
  if (fault === "source-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: "source-witness", deletedAt: clock });
  if (fault === "transcript") f.native.messages.values().next().value!.message = { role: "user", content: "edited" };
  if (fault === "profile" || fault === "qualification") f.db.table("runtimeModelQualifications").find(row => fault === "qualification" ? true : (row.canonical as string).includes("embedding"))!.revokedAt = clock;
  if (fault === "lease") f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = clock;
  if (fault === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = clock;
  if (fault === "budget") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.cancelled = true;
  if (fault === "definition") f.db.table("runtimeAgentDefinitions")[0].revokedAt = clock;
  const before = state(f); await expect(f.call(runtime.admitPreparedModelOperation, input)).rejects.toThrow(); expect(state(f)).toEqual(before); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it.each(["operationKey", "runBudgetId", "semanticId", "ordinal", "reference", "source", "parentOperationId"])("request binding %s cannot choose another lane or bypass the original first-guard error order", async key => {
  const f = await fixture(), args = await f.start(true), prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 }), input = await admission(f, args, prepared), binding = JSON.parse(input.bindingCanonical) as Record<string, unknown>;
  binding[key] = "substituted"; input.bindingCanonical = canonicalModelJson(binding); const before = state(f);
  await expect(f.call(runtime.admitPreparedModelOperation, input)).rejects.toThrow("POLICY_DENIED"); expect(state(f)).toEqual(before);
  f.grant.revokedAt = clock; await expect(f.call(runtime.admitPreparedModelOperation, input)).rejects.toThrow("FORBIDDEN");
});
it.each(["reserve", "bind"])("late %s fault rolls back original account reservations/permit, retaining every post-write guard", async phase => {
  const f = await fixture(), args = await f.start(true), prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 }), input = await admission(f, args, prepared), before = state(f), patch = f.db.patch.bind(f.db); let reached = false;
  jest.spyOn(f.db, "patch").mockImplementation(async (tableOrId: string, idOrValue: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    if (typeof idOrValue === "string") await patch(tableOrId, idOrValue, value!); else await patch(tableOrId, idOrValue);
    if (typeof idOrValue === "string" && value && (phase === "reserve" ? tableOrId === "runtimeModelOperations" && "reservedUnits" in value : tableOrId === "runtimeAgentOperations" && "nativeModelOperationId" in value)) { reached = true; f.grant.revokedAt = clock; }
  });
  await expect(f.call(runtime.admitPreparedModelOperation, input)).rejects.toThrow(); expect(reached).toBe(true); expect(state(f)).toEqual(before); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("lost dispatch permit cannot fund/replay another model attempt and retains original UNKNOWN liability", async () => {
  const f = await fixture(), args = await f.start(true), prepared = await f.call<Prepared>(runtime.prepareResolvedModelOperation, { ...args, ordinal: 0 }), input = await admission(f, args, prepared), first = await f.call<GatewayAdmissionCheckpoint>(runtime.admitPreparedModelOperation, input);
  expect(first).toMatchObject({ admission: { status: "reserved" }, permit: { dispatchPermit: true } });
  expect(await f.call(runtime.admitPreparedModelOperation, input)).toMatchObject({ admission: { status: "uncertain", replayAllowed: false } });
  const attempt = f.db.table("runtimeModelAttempts")[0]; await f.call(ledger.recover, { reference: args.reference, attemptId: attempt._id });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeBudgetAccounts").filter(row => row.kind === "run" || row.kind === "tenant").map(row => [row.reservedUnits, row.uncertainUnits, row.activeConcurrency])).toEqual([[0, 100_000, 1], [0, 100_000, 1]]);
});
it("all new parents are internal exact schemas and reject caller-selected context/model proposals", async () => {
  const f = await fixture(), args = await f.start(); expect(runtime.prepareTurnModel.isInternal).toBe(true); expect(runtime.prepareResolvedModelOperation.isInternal).toBe(true); expect(runtime.admitPreparedModelOperation.isInternal).toBe(true);
  for (const key of ["ordinal", "context", "witnesses", "profile", "runBudgetId", "resolution"]) expect(() => assertNativeArgs(runtime.prepareTurnModel, { ...args, [key]: "injected" })).toThrow("Unknown native field");
});
