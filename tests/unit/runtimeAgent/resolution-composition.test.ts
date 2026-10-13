/** Original registered handlers on a controlled native/component port; no live OCC or paid inference claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { GatewayResolution } from "../../../convex-dev/runtimeGateway";
import { assertNativeArgs } from "./native-arguments";
const nativeAgent = await import("@convex-dev/agent");
let options: { contextHandler: () => Promise<unknown> }, finalMessage: Record<string, unknown>;
jest.unstable_mockModule("@convex-dev/agent", () => ({ ...nativeAgent, Agent: class {
  constructor(_component: unknown, value: typeof options) { options = value; }
  async streamText() {
    await options.contextHandler();
    return { toolCalls: Promise.resolve([]), savedMessages: [finalMessage], text: Promise.resolve("controlled answer") };
  }
} }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; } async start() { return "workflow:resolution"; }
} }));
const { transcriptFixture, installMockRoot, installIngestionMockRoot, ledger, runs, invoke, clone, clock } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
beforeEach(() => { installMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  f.ctx.runQuery = (async (reference, args) => {
    let name = ""; try { name = getFunctionName(reference); } catch { /* Native component. */ }
    const reg = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name === "runtimeModelPolicy:resolve" ? ledger.resolve : undefined;
    if (reg) { calls.push(name); assertNativeArgs(reg, args); return await invoke(reg, f.ctx, args); }
    return await query(reference, args);
  }) as typeof f.ctx.runQuery;
  f.ctx.runMutation = (async (reference, args) => {
    let name = ""; try { name = getFunctionName(reference); } catch { /* Native component. */ }
    const reg = name === "runs:claimNext" ? runs.claimNext : name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : undefined;
    if (reg) { calls.push(name); assertNativeArgs(reg, args); return await f.transaction(async () => await invoke(reg, f.ctx, args)); }
    return await mutation(reference, args);
  }) as typeof f.ctx.runMutation;
  const run = await f.run(); await f.call(runtime.start, { runId: run.runId });
  const execution = f.db.table("runtimeAgentExecutions")[0], row = f.db.table("runtimeRuns")[0];
  const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: execution.leaseVersion as number };
  await f.call(runtime.saveContext, { ...attempt, context: "private authorized evidence", witnesses: [], completeness: "complete" });
  const args = { ...attempt, runBudgetId: row.runBudgetId as string };
  const call = async () => { assertNativeArgs(runtime.resolveModelOperation, args); return await f.call<GatewayResolution>(runtime.resolveModelOperation, args); };
  const original = async () => {
    await f.call(runtime.hydrateExecution, attempt);
    return await f.call<GatewayResolution>(ledger.resolve, { reference: attempt.reference, operationKey: "agent.respond", runBudgetId: args.runBudgetId });
  };
  const state = () => clone({ rows: new Map([...f.db.rows].filter(([, rows]) => rows.length)), writes: f.db.writes, sequence: f.db.sequence,
    native: f.native, effects: f.effects, scheduled: f.scheduled });
  return { f, args, attempt, execution, row, calls, call, original, state };
}
async function failure(call: () => Promise<unknown>) {
  try { await call(); throw new Error("Expected original guard rejection"); }
  catch (error) {
    if (!(error instanceof Error) || error.message === "Expected original guard rejection") throw error;
    return { name: error.name, message: error.message, data: "data" in error ? error.data : undefined };
  }
}
describe("Agent-only fresh hydration and native policy resolution", () => {
  it("retains exact original output, all native/component read order and zero effects", async () => {
    const x = await fixture(), reads: unknown[] = [], query = x.f.db.query.bind(x.f.db), get = x.f.db.get.bind(x.f.db);
    jest.spyOn(x.f.db, "query").mockImplementation(table => {
      reads.push(["query", table]); const builder = query(table), withIndex = builder.withIndex.bind(builder);
      builder.withIndex = (name, callback) => { reads.push(["index", table, name]); return withIndex(name, callback); };
      return builder;
    });
    jest.spyOn(x.f.db, "get").mockImplementation(async (table, id) => { reads.push(["get", table, id]); return await get(table, id); });
    const component = x.f.ctx.runQuery.bind(x.f.ctx);
    x.f.ctx.runQuery = (async (reference, args) => { reads.push(["component", clone(reference), clone(args)]); return await component(reference, args); }) as typeof x.f.ctx.runQuery;
    const before = x.state(), combined = await x.call(), composedReads = clone(reads); reads.length = 0;
    expect(await x.original()).toEqual(combined); expect(reads).toEqual(composedReads); expect(x.state()).toEqual(before);
    expect(combined).toMatchObject({ snapshot: { modelId: "openai/gpt-4o-mini", nativeInterface: "chat" }, storageLimits: { embeddingValuesPerCall: 1 } });
    expect(x.f.db.table("runtimeModelOperations")).toEqual([]); expect(x.f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("is internal and cannot select a model, policy lane, source, parent, account or request", async () => {
    const x = await fixture(); expect(runtime.resolveModelOperation.isInternal).toBe(true);
    for (const field of ["operationKey", "modelId", "source", "parentOperationId", "runAccountId", "requestCanonical", "snapshotCanonical", "messages", "context"]) {
      expect(() => assertNativeArgs(runtime.resolveModelOperation, { ...x.args, [field]: "substituted" })).toThrow("Unknown native field");
    }
    const before = x.state(); x.args.runBudgetId = "foreign-budget";
    await expect(x.call()).rejects.toThrow("POLICY_DENIED"); expect(x.state()).toEqual(before);
  });
  it.each(["grant", "principal", "membership", "tenant-epoch", "space-epoch", "cancel", "lease", "attempt", "definition", "conversation", "transcript", "context-hash", "context-tombstone", "policy-root", "policy-payload", "qualification", "account-reference", "account-agent-pin", "proof-expiry"])("preserves the original %s failure code/order and leaves state unchanged", async fault => {
    const x = await fixture();
    if (fault === "grant") x.f.grant.revokedAt = clock;
    if (fault === "principal") x.f.principal.version = 2;
    if (fault === "membership") x.f.membership.version = 2;
    if (fault === "tenant-epoch") x.f.db.table("runtimeAuthScopes").find(row => !row.memorySpaceId)!.epoch = 2;
    if (fault === "space-epoch") x.f.db.table("runtimeAuthScopes").find(row => !!row.memorySpaceId)!.epoch = 2;
    if (fault === "cancel") x.row.cancellationRequestedAt = clock;
    if (fault === "lease") x.f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = clock;
    if (fault === "attempt") { x.attempt.attemptNumber = 2; x.args.attemptNumber = 2; }
    if (fault === "definition") x.f.db.table("runtimeAgentDefinitions")[0].revokedAt = clock;
    if (fault === "conversation") x.f.db.table("runtimeConversations")[0].tombstonedAt = clock;
    if (fault === "transcript") x.f.native.messages.get((x.row.inputMessageIds as string[])[0])!.message = { role: "user", content: "edited pinned input" };
    if (fault.startsWith("context-")) {
      const source = x.f.db.seed("runtimeMemorySources", { tenantId: x.f.reference.tenantId, memorySpaceId: x.f.reference.memorySpaceId,
        ownerPrincipalId: x.f.reference.principalId, lineage: { sourceId: "resolution-source", sourceEventId: "resolution-event", sourceRevision: 1, role: "user", trust: "user_assertion" },
        content: "private evidence", contentHash: await x.f.hash("private evidence"), createdAt: clock });
      x.execution.sourceWitnesses = [{ sourceId: "resolution-source", sourceEventId: "resolution-event", sourceRevision: 1, contentHash: source.contentHash }];
      await x.call();
      if (fault === "context-hash") source.contentHash = "edited"; else source.tombstonedAt = clock;
    }
    if (fault === "policy-root") (x.f.db.table("runtimeModelPolicies")[0].root as Record<string, unknown>).revision = 999;
    if (fault === "policy-payload") x.f.db.table("runtimeModelPolicies")[0].canonical = "{}";
    if (fault === "qualification") x.f.db.table("runtimeModelQualifications")[0].revokedAt = clock;
    if (fault === "account-reference") x.f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.reference = { ...x.f.reference, grantVersion: 999 };
    if (fault === "account-agent-pin") x.f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.agentVersion = 999;
    if (fault === "proof-expiry") {
      // Leave the Agent lease valid so this fault reaches the original policy proof fence.
      x.f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = clock + 500_000;
      jest.spyOn(Date, "now").mockReturnValue(clock + 100_001);
    }
    const before = x.state(); expect(await failure(x.call)).toEqual(await failure(x.original)); expect(x.state()).toEqual(before);
  });
  it("retains Agent-before-policy precedence when transcript and qualification are both invalid", async () => {
    const x = await fixture(); x.f.native.messages.get((x.row.inputMessageIds as string[])[0])!.message = { role: "user", content: "edited" };
    x.f.db.table("runtimeModelQualifications")[0].active = false;
    expect(await failure(x.call)).toEqual(await failure(x.original)); expect(await failure(x.call)).toMatchObject({ data: { code: "STALE_TRANSCRIPT" } });
  });
  it("fresh native invocations recheck both Agent and model-policy changes without cached resolution", async () => {
    const x = await fixture(), first = await x.call(); expect(first.snapshot.modelId).toBe("openai/gpt-4o-mini");
    x.f.db.table("runtimeModelQualifications")[0].active = false;
    await expect(x.call()).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    x.f.db.table("runtimeModelQualifications")[0].active = true; x.f.grant.revokedAt = clock;
    await expect(x.call()).rejects.toThrow("FORBIDDEN");
    expect(x.f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("the real governed constructor retains two fresh resolutions while removing two action RPCs", async () => {
    installIngestionMockRoot();
    const x = await fixture(), input = x.f.native.messages.get((x.row.inputMessageIds as string[])[0])!;
    finalMessage = { ...input, _id: "resolution:final", stepOrder: 1, agentName: `cortex:${x.args.runId}:1:0`, message: { role: "assistant", content: "controlled answer" } };
    x.f.native.messages.set(finalMessage._id as string, finalMessage); x.calls.length = 0;
    expect(await runtime.modelStepHandler(x.f.ctx as unknown as ActionCtx, { ...x.attempt, ordinal: 0 })).toEqual({ savedMessageIds: ["resolution:final"], calls: [], final: true });
    expect(x.calls.filter(name => name === "runtimeAgent:resolveModelOperation")).toHaveLength(2);
    expect(x.calls.slice(0, 3)).toEqual(["runtimeAgent:prepareModelOperation", "runtimeAgent:resolveModelOperation", "runtimeAgent:resolveModelOperation"]);
    expect(x.calls).not.toContain("runtimeModelPolicy:resolve");
    // Native Agent's context handler still has its independent, later hydration interval.
    expect(x.calls).toContain("runtimeAgent:hydrateExecution"); expect(x.calls).toContain("runtimeAgent:finishOperation");
    expect(x.f.db.table("runtimeModelAttempts")).toEqual([]); // Controlled Agent does not invoke the paid model port.
  });
  it.each(["grant", "qualification"])("the second real-constructor resolution fences late %s after the first succeeds", async fault => {
    installIngestionMockRoot();
    const x = await fixture(), query = x.f.ctx.runQuery.bind(x.f.ctx); let resolutions = 0;
    x.f.ctx.runQuery = (async (reference, args) => {
      let name = ""; try { name = getFunctionName(reference); } catch { /* Native component. */ }
      if (name === "runtimeAgent:resolveModelOperation" && ++resolutions === 2) {
        if (fault === "grant") x.f.grant.revokedAt = clock; else x.f.db.table("runtimeModelQualifications")[0].active = false;
      }
      return await query(reference, args);
    }) as typeof x.f.ctx.runQuery;
    await expect(runtime.modelStepHandler(x.f.ctx as unknown as ActionCtx, { ...x.attempt, ordinal: 0 })).rejects.toThrow(fault === "grant" ? "FORBIDDEN" : "CAPABILITY_UNAVAILABLE");
    expect(resolutions).toBe(2); expect(x.f.db.table("runtimeModelAttempts")).toEqual([]); expect(x.f.db.table("runtimeAgentIngestion")).toEqual([]);
    expect(x.f.db.table("runtimeAgentOperations")[0].state).toBe("started");
  });
});
