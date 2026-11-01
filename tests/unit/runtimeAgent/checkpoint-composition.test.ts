/** Offline actual-handler transaction model. Real Convex OCC and latency remain separate live gates. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import { getFunctionName } from "convex/server";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { GatewayAdmissionCheckpoint, GatewayResolution } from "../../../convex-dev/runtimeGateway";
import { assertNativeArgs } from "./native-arguments";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; } async start() { return "workflow:composition"; }
} }));
const { transcriptFixture, installMockRoot, ledger, runs, invoke, clone, clock } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const { assertGatewayReservedRequest } = await import("../../../convex-dev/runtimeGateway");
beforeEach(() => { installMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await transcriptFixture(), mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (reference: unknown, args: unknown) => {
    let name = ""; try { name = getFunctionName(reference as never); } catch { /* Native component. */ }
    const reg = name === "runs:claimNext" ? runs.claimNext : name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : undefined;
    if (reg) { assertNativeArgs(reg, args); return await invoke(reg, f.ctx, args); }
    return await mutation(reference as never, args as never);
  }) as typeof f.ctx.runMutation;
  const run = await f.run(); await f.call(runtime.start, { runId: run.runId });
  const execution = f.db.table("runtimeAgentExecutions")[0];
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: execution.leaseVersion as number };
  await f.call(runtime.saveContext, { ...attempt, context: "Private indexed evidence", witnesses: [], completeness: "complete" });
  const prepared = await f.call<{ state: "started"; op: { operationId: string; semanticId: string }; current: { run: { runBudgetId: string } } }>(runtime.prepareModelOperation, { ...attempt, ordinal: 0 });
  const resolution = await f.call<GatewayResolution>(ledger.resolve, { reference: f.reference, operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId });
  const request: ModelCallRequest = { semanticId: prepared.op.semanticId, childCallId: "action-normalized-child", texts: ["Hello world!"], messages: [{ role: "user", parts: [{ type: "text", text: "Hello world!" }] }],
    inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1000, reservationUnits: resolution.snapshot.costBound.maximumCostUnits,
    promptVersion: resolution.snapshot.pins.promptVersion, schemaVersion: resolution.snapshot.pins.schemaVersion,
    extractionVersion: resolution.snapshot.pins.extractionVersion, toolRegistryVersion: resolution.snapshot.pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
  request.inputTokens = ledger.deriveQualifiedInputBound(resolution.dispatchEvidence, request);
  const args = { ...attempt, operationId: prepared.op.operationId, ordinal: 0, requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(resolution.snapshot) };
  const originalArgs = { reference: f.reference, operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId,
    semanticId: prepared.op.semanticId, ordinal: 0, requestCanonical: args.requestCanonical };
  const call = async () => { assertNativeArgs(runtime.admitModelOperation, args); return await f.call<GatewayAdmissionCheckpoint>(runtime.admitModelOperation, args); };
  const original = async () => await f.transaction(async () => {
    const admission = await f.call<GatewayAdmissionCheckpoint["admission"]>(ledger.admit, originalArgs);
    await f.call(runtime.bindNativeOperation, { ...attempt, operationId: prepared.op.operationId, nativeOperationId: admission.operationId });
    if (admission.status !== "reserved") return { admission };
    assertGatewayReservedRequest(admission, args.requestCanonical, args.snapshotCanonical, resolution.storageLimits.canonicalBytes);
    await f.call(runtime.hydrateExecution, attempt);
    return { admission, permit: await f.call(ledger.checkpoint, { reference: f.reference, attemptId: admission.attemptId, requestCanonical: admission.requestCanonical }) };
  });
  const state = () => clone({ rows: f.db.rows, writes: f.db.writes, sequence: f.db.sequence, effects: f.effects, native: f.native, scheduled: f.scheduled });
  return { f, args, attempt, originalArgs, call, original, state, prepared, resolution, request };
}
describe("Agent-only admission, binding and checkpoint parent", () => {
  it("is internal with an exact original-attempt schema, rejecting caller-selected lanes", async () => {
    const x = await fixture(); expect(runtime.admitModelOperation.isInternal).toBe(true);
    for (const field of ["referenceOverride", "runBudgetId", "operationKey", "semanticId", "parentOperationId", "source", "nativeOperationId"]) {
      expect(() => assertNativeArgs(runtime.admitModelOperation, { ...x.args, [field]: "substituted" })).toThrow("Unknown native field");
    }
  });
  it("matches original handler return and all persisted tables/effects at a fixed native transaction clock", async () => {
    const x = await fixture(), before = x.state(); const composed = await x.call(), after = x.state();
    x.f.db.rows = clone(before.rows); x.f.db.writes = before.writes; x.f.db.sequence = before.sequence; Object.assign(x.f.native, clone(before.native)); Object.assign(x.f.effects, before.effects);
    const original = await x.original(); expect(composed).toEqual(original); expect(x.state()).toEqual(after);
    expect(composed).toMatchObject({ admission: { status: "reserved" }, permit: { dispatchPermit: true } });
    expect(x.f.db.table("runtimeModelAttempts")).toHaveLength(1);
    expect(x.f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", ordinal: 0, attemptNumber: 1, reservationUnits: 100, checkpointAt: clock });
    const native = x.f.db.table("runtimeModelOperations")[0]; expect(native.parentOperationId).toBeUndefined();
    expect(x.f.db.table("runtimeAgentOperations")[0].nativeModelOperationId).toBe(native._id);
    expect(x.f.db.table("runtimeBudgetAccounts").filter(row => ["tenant", "run"].includes(row.kind as string)).map(row => [row.reservedUnits, row.activeConcurrency])).toEqual([[100, 1], [100, 1]]);
    expect(x.f.db.table("runtimeAgentOutput")).toEqual([]);
  });
  it.each(["ordinal", "operation", "semantic", "stored-model-binding", "kind", "agent-unknown", "native-parent", "native-account", "native-ordinal", "native-attempt-number"])("denies substituted %s without any persisted effect", async kind => {
    const x = await fixture(), op = x.f.db.table("runtimeAgentOperations")[0];
    if (kind === "ordinal") x.args.ordinal = 1;
    if (kind === "operation") x.args.operationId = "agent-op:foreign";
    if (kind === "semantic") op.semanticId = "foreign";
    if (kind === "stored-model-binding") op.requestCanonical = "{}";
    if (kind === "kind") op.kind = "tool";
    if (kind === "agent-unknown") op.state = "unknown";
    if (["native-parent", "native-account", "native-ordinal", "native-attempt-number"].includes(kind)) {
      const admission = await x.f.call<{ operationId: string }>(ledger.admit, x.originalArgs);
      const native = x.f.db.table("runtimeModelOperations").find(row => row._id === admission.operationId)!;
      if (kind === "native-parent") native.parentOperationId = "runtimeModelOperations:foreign";
      else if (kind === "native-account") native.runAccountId = "runtimeBudgetAccounts:foreign";
      else if (kind === "native-ordinal") x.f.db.table("runtimeModelAttempts")[0].ordinal = 1;
      else x.f.db.table("runtimeModelAttempts")[0].attemptNumber = 2;
    }
    const before = x.state(); await expect(x.call()).rejects.toThrow(); expect(x.state()).toEqual(before);
  });
  it.each(["revoked", "tenant-epoch", "space-epoch", "cancelled", "lease-expired", "definition", "source-edited", "proof-expired", "budget-corrupt", "snapshot"])("fences current %s before issuing a permit", async kind => {
    const x = await fixture();
    if (kind === "revoked") x.f.grant.revokedAt = clock;
    if (kind === "tenant-epoch") x.f.db.table("runtimeAuthScopes").find(row => !row.memorySpaceId)!.epoch = 2;
    if (kind === "space-epoch") x.f.db.table("runtimeAuthScopes").find(row => !!row.memorySpaceId)!.epoch = 2;
    if (kind === "cancelled") x.f.db.table("runtimeRuns")[0].cancellationRequestedAt = clock;
    if (kind === "lease-expired") x.f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = clock;
    if (kind === "definition") x.f.db.table("runtimeAgentDefinitions")[0].revokedAt = clock;
    if (kind === "source-edited") (x.f.native.messages.values().next().value!.message as Record<string, unknown>).content = "changed source";
    if (kind === "proof-expired") jest.spyOn(Date, "now").mockReturnValue(clock + 100001);
    if (kind === "budget-corrupt") x.f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.windowId = "foreign-window";
    if (kind === "snapshot") x.args.snapshotCanonical = canonicalModelJson({ ...x.resolution.snapshot, modelId: "substituted/model" });
    const before = x.state(); await expect(x.call()).rejects.toThrow(); expect(x.state()).toEqual(before);
  });
  it.each(["binding", "post-binding-checkpoint"])("rolls back admission and all reservations when the original %s guard fails late", async phase => {
    const x = await fixture(), before = x.state(), patch = x.f.db.patch.bind(x.f.db);
    x.f.db.patch = (async (table: string, id: string, value: Record<string, unknown>) => {
      await patch(table, id, value);
      if (phase === "binding" && table === "runtimeModelOperations" && "reservedUnits" in value) x.f.grant.revokedAt = clock;
      if (phase === "post-binding-checkpoint" && table === "runtimeAgentOperations" && "nativeModelOperationId" in value) x.f.grant.revokedAt = clock;
    }) as typeof x.f.db.patch;
    await expect(x.call()).rejects.toThrow(); expect(x.state()).toEqual(before);
    expect(x.f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("an existing reserved attempt returns inflight without dispatching or changing its reservation", async () => {
    const x = await fixture(); await x.f.call(ledger.admit, x.originalArgs);
    const accounts = clone(x.f.db.table("runtimeBudgetAccounts"));
    expect(await x.call()).toMatchObject({ admission: { status: "inflight" } });
    expect(x.f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(x.f.db.table("runtimeModelAttempts")[0].state).toBe("reserved");
    expect(x.f.db.table("runtimeBudgetAccounts")).toEqual(accounts);
  });
  it("lost committed permit response cannot obtain a new paid attempt or pre-dispatch release; recovery retains UNKNOWN ceiling", async () => {
    const x = await fixture(), result = await x.call(); if (result.admission.status !== "reserved" || !("permit" in result)) throw new Error("Fixture reserved permit required");
    const before = x.state(), repeated = await x.call();
    expect(repeated).toMatchObject({ admission: { status: "uncertain", attemptId: result.admission.attemptId, replayAllowed: false } });
    expect(repeated).not.toHaveProperty("permit"); expect(x.f.db.table("runtimeModelAttempts")).toHaveLength(1);
    // An idempotent parent binding may write again; balances/native identities stay unchanged.
    expect(x.f.db.table("runtimeBudgetAccounts")).toEqual(before.rows.get("runtimeBudgetAccounts"));
    await expect(x.f.call(ledger.releaseNotDispatched, { reference: x.f.reference, attemptId: result.admission.attemptId })).rejects.toThrow("UNCERTAIN_OUTCOME");
    await x.f.call(ledger.recover, { reference: x.f.reference, attemptId: result.admission.attemptId });
    expect(x.f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", reservationUnits: 100, slotReleased: false });
    expect(x.f.db.table("runtimeBudgetAccounts").filter(row => ["tenant", "run"].includes(row.kind as string)).map(row => [row.reservedUnits, row.uncertainUnits, row.activeConcurrency])).toEqual([[0, 100, 1], [0, 100, 1]]);
    expect(await x.call()).toMatchObject({ admission: { status: "uncertain", replayAllowed: false } });
  });
  it("confirmed complete native replay binds the same original parent without another permit or reservation", async () => {
    const x = await fixture(), first = await x.call(); if (first.admission.status !== "reserved" || !("permit" in first) || !first.permit.dispatchPermit) throw new Error("Fixture reserved permit required");
    await x.f.call(ledger.settle, { reference: x.f.reference, attemptId: first.admission.attemptId, receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity: first.permit.dispatchIdentity,
      receiptId: "controlled-terminal", modelId: "openai/gpt-4o-mini", nativeInterface: "chat", outcome: "confirmed", proof: "provider-terminal-v1", costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000040", privateResultCanonical: canonicalModelJson({ text: "answer" }) }) });
    const accounts = clone(x.f.db.table("runtimeBudgetAccounts"));
    expect(await x.call()).toMatchObject({ admission: { status: "replay", operationId: first.admission.operationId, resultCanonical: canonicalModelJson({ text: "answer" }) } });
    expect(x.f.db.table("runtimeBudgetAccounts")).toEqual(accounts); expect(x.f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  it("post-permit cancellation retains liability and denies native visibility and attachment", async () => {
    const x = await fixture(), first = await x.call(); if (first.admission.status !== "reserved" || !("permit" in first) || !first.permit.dispatchPermit) throw new Error("Fixture reserved permit required");
    x.f.db.table("runtimeRuns")[0].cancellationRequestedAt = clock;
    await expect(x.f.call(ledger.markVisible, { reference: x.f.reference, attemptId: first.admission.attemptId, outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false })).rejects.toThrow();
    const capture = await x.f.call<{ evidenceId: string }>(ledger.captureTerminalEvidence, { attemptId: first.admission.attemptId, dispatchIdentity: first.permit.dispatchIdentity,
      receiptCanonical: canonicalModelJson({ version: 1, dispatchIdentity: first.permit.dispatchIdentity, receiptId: "cancelled-native", modelId: "openai/gpt-4o-mini", nativeInterface: "chat", outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable" }) });
    expect(await x.f.call(ledger.attachTerminalResult, { reference: x.f.reference, attemptId: first.admission.attemptId, evidenceId: capture.evidenceId, privateResultCanonical: canonicalModelJson({ text: "private" }) })).toEqual({ attached: false, resultWithheld: true });
    expect(x.f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "uncertain", reservationUnits: 100, slotReleased: true, outputVisible: false });
  });
});
