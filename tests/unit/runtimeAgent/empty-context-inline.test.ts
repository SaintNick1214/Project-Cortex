/** Actual registered context handlers on transactional DB/component ports; no service/OCC timing claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { assertNativeArgs } from "./native-arguments";
const starts: unknown[][] = [];
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start(...args: unknown[]) { starts.push(args); return "workflow:empty-context"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone, ledger } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const memory = await import("../../../convex-dev/runtimeMemory");
const runs = await import("../../../convex-dev/runs");
beforeEach(() => { installIngestionMockRoot(); starts.length = 0; });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(options: { onFailure?: "fail" | "incomplete" } = {}) {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  const calls: string[] = [];
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    calls.push(name);
    if (name.startsWith("runtimeAgent:")) {
      const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, args);
      return invoke(registration, f.ctx, args);
    }
    if (name.startsWith("runtimeMemory:")) return invoke(memory[name.split(":")[1] as keyof typeof memory], f.ctx, args);
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
    calls.push(name);
    if (name.startsWith("runtimeAgent:")) {
      const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, args);
      return f.transaction(() => invoke(registration, f.ctx, args));
    }
    if (name === "runs:claimNext") return invoke(runs.claimNext, f.ctx, args);
    return mutation(ref, args);
  }) as MutationCtx["runMutation"];
  const start = async () => {
    let request = f.request();
    if (options.onFailure) {
      const definitions = await import("../../../convex-dev/agentDefinitions");
      const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
        memorySpaceId: "space-a", clientMutationId: "inline-empty-policy", expectedPreviousVersion: 0,
        definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, maxContextTokens: 16_384,
          barrier: { deadlineMs: 30_000, onFailure: options.onFailure } } },
      }); request = { ...request, agentId: published.agentId, agentVersion: published.version };
    }
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request });
    await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0];
    const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    await f.call(runtime.startContext, attempt); return { run, attempt };
  };
  return { ...f, get grant() { return f.grant; }, calls, start };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function state(f: Fixture) {
  return clone({ run: f.db.table("runtimeRuns"), execution: f.db.table("runtimeAgentExecutions"), outbox: f.db.table("runtimeRunOutbox"),
    accounts: f.db.table("runtimeBudgetAccounts"), sources: f.db.table("runtimeMemorySources"), events: f.db.table("runtimeIngestionEvents"),
    operations: f.db.table("runtimeModelOperations"), attempts: f.db.table("runtimeModelAttempts"), writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled });
}
function afterProbe(f: Fixture, change: () => void | Promise<void>) {
  const query = f.db.query.bind(f.db); let reached = false;
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const builder = query(table), take = builder.take;
    builder.take = async count => {
      const result = await take(count);
      if (!reached && table === "runtimeIngestionEvents" && count === 1025) { reached = true; await change(); }
      return result;
    }; return builder;
  });
  return () => reached;
}
function stopAtOriginalRetrieval(f: Fixture) {
  const query = f.ctx.runQuery.bind(f.ctx), reached = jest.fn();
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    if (name === "runtimeModelPolicy:resolve" && (args as { operationKey: string }).operationKey === "embedding.query") {
      reached(args); await invoke(ledger.resolve, f.ctx, args); throw new Error("ORIGINAL_GOVERNED_RETRIEVAL_REACHED");
    } return query(ref, args);
  }) as MutationCtx["runQuery"]; return reached;
}
it.each(["empty", "pending", "pending_unknown", "barrier_warning"])("inline %s context equals the original actual Action save byte/data outcome", async mode => {
  const f = await fixture();
  if (mode.startsWith("pending")) {
    const source = await f.source("Authorized pending evidence", "pending-inline"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    if (mode === "pending_unknown") f.db.table("runtimeIngestionEvents")[0].factsState = "unknown";
  }
  const { attempt } = await f.start();
  if (mode === "barrier_warning") Object.assign(f.db.table("runtimeAgentExecutions")[0], { contextCompleteness: "incomplete", contextFailureCode: "MEMORY_STAGE_FAILED" });
  const before = state(f), rollback = new Error("POSITIVE_REFERENCE_ROLLBACK"); let original: unknown;
  await expect(f.transaction(async () => {
    await invoke(runtime.prepareContext, f.ctx, attempt); original = state(f); throw rollback;
  })).rejects.toBe(rollback);
  expect(state(f)).toEqual(before); f.calls.length = 0;
  expect(await f.call(runtime.prepareEmptyContext, attempt)).toEqual({ state: "COMPLETE" });
  expect(state(f)).toEqual(original);
  expect(f.calls.some(name => ["runtimeAgent:contextInputs", "runtimeAgent:saveContext", "runtimeMemoryContext:pendingContext"].includes(name))).toBe(false);
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  if (mode === "pending_unknown") expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("unknown");
});
it("fresh starts dispatch the additive Workflow version and retain startAsync/onComplete and duplicate ownership", async () => {
  const f = await fixture(), { run } = await f.start();
  expect(starts).toHaveLength(1); expect(getFunctionName(starts[0][1] as never)).toBe("runtimeAgent:executeTurnV4");
  expect(starts[0][3]).toMatchObject({ startAsync: true, context: { runId: run.runId, attemptNumber: 1 } });
  expect(getFunctionName((starts[0][3] as { onComplete: never }).onComplete)).toBe("runtimeAgent:onWorkflowComplete");
  await f.call(runtime.start, { runId: run.runId }); expect(starts).toHaveLength(1);
});
it.each(["eligible_index", "metadata_overflow", "pending_overflow_warn"])("%s needs the unchanged Action without context or model effects", async mode => {
  const f = await fixture({ onFailure: mode === "pending_overflow_warn" ? "incomplete" : "fail" });
  if (mode === "metadata_overflow") {
    const source = await f.source("Superseded seed", "overflow-seed"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    f.db.table("runtimeIngestionEvents")[0].eligibility = "superseded";
    for (let index = 2; index <= 1026; index++) f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      ownerPrincipalId: f.reference.principalId, sequence: index, eligibility: "superseded", lineage: { sourceId: `overflow:${index}`, sourceEventId: `overflow:${index}`, sourceRevision: 1 } });
    f.db.table("runtimeIngestionScopes")[0].sequence = 1026;
  } else {
    for (let index = 0; index < (mode === "pending_overflow_warn" ? 33 : 1); index++) {
      const source = await f.source(`Unrepresented eligible evidence ${index}`, `indexed:${index}`); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    }
    if (mode === "eligible_index") f.db.table("runtimeIngestionEvents")[0].factsState = f.db.table("runtimeIngestionEvents")[0].vectorsState = "complete";
  }
  const { attempt } = await f.start(), before = state(f);
  expect(await f.call(runtime.prepareEmptyContext, attempt)).toEqual({ state: "NEEDS_ACTION" }); expect(state(f)).toEqual(before);
  const reached = stopAtOriginalRetrieval(f); await expect(invoke(runtime.prepareContext, f.ctx, attempt)).rejects.toThrow("ORIGINAL_GOVERNED_RETRIEVAL_REACHED");
  expect(reached).toHaveBeenCalledTimes(1); expect(reached.mock.calls[0][0]).toMatchObject({ reference: attempt.reference,
    operationKey: "embedding.query", runBudgetId: f.db.table("runtimeRuns")[0].runBudgetId });
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started"); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("fail overflow returns a marker before invalid profile availability, and original durable fail survives later rejection", async () => {
  const f = await fixture(); let first: Awaited<ReturnType<Fixture["source"]>> | undefined;
  for (let index = 0; index < 33; index++) {
    const source = await f.source(`Pending overflow ${index}`, `pending:${index}`); first ??= source; await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  }
  f.db.seed("runtimeMemoryVectorGenerations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
    ...first!.lineage, contentHash: first!.contentHash, profile: LARGE_EMBEDDING_PROFILE });
  const { attempt } = await f.start(), before = state(f), reads = jest.spyOn(f.db, "query");
  expect(await f.call(runtime.prepareEmptyContext, attempt)).toEqual({ state: "FAILED", failureCode: "CONTEXT_OVERFLOW" }); expect(state(f)).toEqual(before);
  expect(reads.mock.calls.some(([table]) => table === "runtimeMemoryVectorGenerations")).toBe(false);
  await expect(invoke(runtime.prepareContext, f.ctx, attempt)).rejects.toThrow("CONTEXT_OVERFLOW");
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "failed", contextCompleteness: "incomplete", contextFailureCode: "CONTEXT_OVERFLOW" });
  expect(f.db.table("runtimeRuns")[0]).toMatchObject({ contextCompleteness: "incomplete", contextFailureCode: "CONTEXT_OVERFLOW" });
});
it.each(["cutoff", "maxBytes", "excludedSourceKeys", "profile", "runBudgetId", "context", "witnesses"])("internal fast path rejects caller-selected %s", async field => {
  const f = await fixture(), { attempt } = await f.start(); expect(runtime.prepareEmptyContext.isInternal).toBe(true);
  expect(() => assertNativeArgs(runtime.prepareEmptyContext, { ...attempt, [field]: "injected" })).toThrow(`Unknown native field: ${field}`);
});
it.each(["scope", "reference", "attempt", "lease", "expired_lease", "cancel", "revocation", "tombstone", "epoch", "input_edit"])("original native read denies %s without context/model effects", async fault => {
  const f = await fixture(), { attempt } = await f.start(); let args = attempt;
  if (fault === "scope") args = { ...attempt, reference: { ...attempt.reference, memorySpaceId: "foreign" } };
  if (fault === "reference") args = { ...attempt, reference: { ...attempt.reference, grantVersion: 2 } };
  if (fault === "attempt") args = { ...attempt, attemptNumber: 0 };
  if (fault === "lease") args = { ...attempt, leaseVersion: attempt.leaseVersion + 1 };
  if (fault === "expired_lease") f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = Date.now();
  if (fault === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = Date.now();
  if (fault === "revocation") f.grant.revokedAt = Date.now();
  if (fault === "tombstone") f.db.table("runtimeConversations")[0].tombstonedAt = Date.now();
  if (fault === "epoch") f.db.table("runtimeConversations")[0].epoch = 2;
  if (fault === "input_edit") f.native.messages.values().next().value!.message = { role: "user", content: "edited" };
  const before = state(f); await expect(f.call(runtime.prepareEmptyContext, args)).rejects.toThrow(); expect(state(f)).toEqual(before);
});
it.each(["eligible_index", "profile_generation", "revocation", "lease", "source_hash", "source_owner", "source_tombstone"])("the original final save rejects post-probe %s rather than false completion", async fault => {
  const f = await fixture(), source = await f.source("Current pending witness", "racing-source"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const event = f.db.table("runtimeIngestionEvents")[0];
  if (fault === "eligible_index" || fault === "profile_generation") event.eligibility = "awaiting_approval";
  const { attempt } = await f.start(), before = state(f);
  const reached = afterProbe(f, async () => {
    if (fault === "eligible_index") { event.eligibility = "eligible"; event.factsState = event.vectorsState = "complete"; }
    if (fault === "profile_generation") f.db.seed("runtimeMemoryVectorGenerations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
      ...source.lineage, contentHash: source.contentHash, profile: LARGE_EMBEDDING_PROFILE });
    if (fault === "revocation") f.grant.revokedAt = Date.now();
    if (fault === "lease") f.db.table("runtimeRunOutbox")[0].leaseVersion = attempt.leaseVersion + 1;
    if (fault === "source_hash") await f.source("Changed content", source.lineage.sourceId);
    if (fault === "source_owner") f.db.table("runtimeMemorySources")[0].ownerPrincipalId = "foreign";
    if (fault === "source_tombstone") f.db.table("runtimeMemorySources")[0].tombstonedAt = Date.now();
  });
  await expect(f.call(runtime.prepareEmptyContext, attempt)).rejects.toThrow(); expect(reached()).toBe(true); expect(state(f)).toEqual(before);
});
it.each(["execution-write", "run-write"])("a %s failure rolls back the whole native context save", async fault => {
  const f = await fixture(), { attempt } = await f.start(), before = state(f), patch = f.db.patch.bind(f.db); let reached = false;
  jest.spyOn(f.db, "patch").mockImplementation(async (tableOrId: string, idOrPatch: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    if (typeof idOrPatch === "string") await patch(tableOrId, idOrPatch, value!); else await patch(tableOrId, idOrPatch);
    if (tableOrId === (fault === "execution-write" ? "runtimeAgentExecutions" : "runtimeRuns")) { reached = true; throw new Error("CONTROLLED_CONTEXT_WRITE_FAILURE"); }
  });
  await expect(f.call(runtime.prepareEmptyContext, attempt)).rejects.toThrow("CONTROLLED_CONTEXT_WRITE_FAILURE"); expect(reached).toBe(true); expect(state(f)).toEqual(before);
});
it("a lost standalone result cannot overwrite already saved context or admit model work", async () => {
  const f = await fixture(), { attempt } = await f.start(); await f.call(runtime.prepareEmptyContext, attempt); const before = state(f);
  await expect(f.call(runtime.prepareEmptyContext, attempt)).rejects.toThrow("INVALID_STATE"); expect(state(f)).toEqual(before);
});
it("the exact 32-source pending cap remains valid and the original size/cutoff construction is retained", async () => {
  const f = await fixture();
  for (let index = 0; index < 32; index++) {
    const source = await f.source(`Authorized source ${index}`, `bounded:${index}`); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  }
  const { attempt } = await f.start(); expect(await f.call(runtime.prepareEmptyContext, attempt)).toEqual({ state: "COMPLETE" });
  const owned = f.db.table("runtimeAgentExecutions")[0]; expect(owned.sourceWitnesses).toHaveLength(32);
  expect(new TextEncoder().encode(owned.contextCanonical as string).length).toBeLessThanOrEqual(16_384);
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it.each(["budget_cancel", "policy_revocation"])("the final local save rechecks post-probe %s", async fault => {
  const f = await fixture(), { attempt } = await f.start(), before = state(f);
  const reached = afterProbe(f, () => {
    if (fault === "budget_cancel") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run" && row.runBudgetId === f.db.table("runtimeRuns")[0].runBudgetId)!.cancelled = true;
    else f.db.table("runtimeModelPolicies").find(row => row.scope === "deployment")!.revokedAt = Date.now();
  });
  await expect(f.call(runtime.prepareEmptyContext, attempt)).rejects.toThrow(); expect(reached()).toBe(true); expect(state(f)).toEqual(before);
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
});
