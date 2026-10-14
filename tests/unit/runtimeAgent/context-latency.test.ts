/** Actual metadata/Agent handlers; no service or provider timing claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { contextSourceKey } from "../../../src/domain/memory-context";
import { assertNativeArgs } from "./native-arguments";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:context"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const context = await import("../../../convex-dev/runtimeMemoryContext");
const memory = await import("../../../convex-dev/runtimeMemory");
const { ledger } = await import("../runtimeTranscript/fixture");
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
async function fixture(options: { onFailure?: "fail" | "incomplete" } = {}) {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  const queries: { name: string; args: unknown }[] = [];
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    queries.push({ name, args });
    if (name.startsWith("runtimeAgent:")) {
      const registration = runtime[name.split(":")[1] as keyof typeof runtime]; assertNativeArgs(registration, args);
      return invoke(registration, f.ctx, args);
    }
    if (name === "runtimeMemoryContext:indexedContextAvailability") return invoke(context.indexedContextAvailability, f.ctx, args);
    if (name.startsWith("runtimeMemory:")) return invoke(memory[name.split(":")[1] as keyof typeof memory], f.ctx, args);
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
    if (name.startsWith("runtimeAgent:")) return f.transaction(() => invoke(runtime[name.split(":")[1] as keyof typeof runtime], f.ctx, args));
    if (name === "runs:claimNext") return invoke((await import("../../../convex-dev/runs")).claimNext, f.ctx, args);
    return mutation(ref, args);
  }) as MutationCtx["runMutation"];
  const start = async () => {
    let request = f.request();
    if (options.onFailure) {
      const definitions = await import("../../../convex-dev/agentDefinitions");
      const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "context-barrier-policy", expectedPreviousVersion: 0,
        definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, maxContextTokens: 16_384,
          barrier: { deadlineMs: 30_000, onFailure: options.onFailure } } } });
      request = { ...request, agentId: published.agentId, agentVersion: published.version };
    }
    const run = await f.call<ReturnType<typeof import("../../../convex-dev/runs")["publicRun"]>>((await import("../../../convex-dev/runs")).submit, { request });
    await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], row = f.db.table("runtimeRuns")[0];
    const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    await f.call(runtime.startContext, attempt);
    const snapshot = JSON.parse(row.snapshotCanonical as string);
    const probe = { reference: f.reference, cutoff: snapshot.ingestionCutoff.sequence as number,
      excludedSourceKeys: snapshot.messages.map((pin: { sourceEventId: string }) => contextSourceKey(row as never, { ...pin, sourceId: pin.sourceEventId } as never)) as string[],
      boundary: { conversationId: run.conversationId, runId: run.runId, queueSequence: row.queueSequence as number, anchor: snapshot.anchor as { order: number; stepOrder: number } }, runBudgetId: row.runBudgetId as string };
    return { run, attempt, probe };
  };
  // Actions have no encompassing mutation rollback. Each real nested save/fail
  // mutation uses the controlled transaction above and survives later action errors.
  const prepare = async (args: { runId: string; reference: typeof f.reference; attemptNumber: number; leaseVersion: number }) => await invoke<null>(runtime.prepareContext, f.ctx, args);
  return { ...f, get grant() { return f.grant; }, start, queries, prepare };
}
async function afterInputs(f: Awaited<ReturnType<typeof fixture>>, change: () => void | Promise<void>) {
  const native = f.ctx.runQuery.bind(f.ctx), reached = { value: false };
  f.ctx.runQuery = async (ref, ...args) => {
    const result = await native(ref, ...args);
    let name = ""; try { name = getFunctionName(ref); } catch { return result; }
    if (name === "runtimeAgent:contextInputs") { reached.value = true; await change(); }
    return result;
  };
  return reached;
}
function observeGovernedRetrieval(f: Awaited<ReturnType<typeof fixture>>) {
  const native = f.ctx.runQuery.bind(f.ctx), reached = jest.fn();
  f.ctx.runQuery = async (ref, ...args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return native(ref, ...args); }
    if (name === "runtimeModelPolicy:resolve" && (args[0] as { operationKey: string }).operationKey === "embedding.query") {
      reached(); await invoke(ledger.resolve, f.ctx, args[0]); throw new Error("ORIGINAL_GOVERNED_RETRIEVAL_REACHED");
    }
    return native(ref, ...args);
  };
  return reached;
}
it("empty eligible indexed context finishes real Agent context without creating a query embedding operation", async () => {
  const f = await fixture(), { attempt, probe } = await f.start();
  expect(await f.call(context.indexedContextAvailability, probe)).toMatchObject({ empty: true, profileId: DEFAULT_EMBEDDING_PROFILE.profileId });
  f.queries.length = 0; await f.prepare(attempt);
  expect(f.queries.filter(query => query.name === "runtimeAgent:contextInputs")).toEqual([{ name: "runtimeAgent:contextInputs", args: attempt }]);
  expect(f.queries.some(query => ["runtimeAgent:hydrateExecution", "runtimeMemoryContext:pendingContext", "runtimeMemoryContext:indexedContextAvailability"].includes(query.name))).toBe(false);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextCanonical: "", contextState: "complete", state: "running" });
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("authorized pending context survives the empty-index path with fresh source witnesses", async () => {
  const f = await fixture(), source = await f.source("The launch codename is Copper Lantern.", "pending-source");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const { attempt } = await f.start(); await f.prepare(attempt);
  const owned = f.db.table("runtimeAgentExecutions")[0];
  expect(owned.contextCanonical).toContain("Copper Lantern");
  expect(owned.sourceWitnesses).toMatchObject([{ sourceId: source.lineage.sourceId, contentHash: source.contentHash, permissions: ["canViewMemories"] }]);
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("an eligible indexed candidate falls back to original governed query embedding", async () => {
  const f = await fixture(), source = await f.source("Indexed prior knowledge", "indexed-source");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const event = f.db.table("runtimeIngestionEvents")[0]; event.factsState = event.vectorsState = "complete";
  const { attempt, probe } = await f.start();
  expect(await f.call(context.indexedContextAvailability, probe)).toMatchObject({ empty: false });
  const query = f.ctx.runQuery.bind(f.ctx), resolve = jest.fn();
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    if (name === "runtimeModelPolicy:resolve" && (args as { operationKey: string }).operationKey === "embedding.query") {
      resolve(); await invoke(ledger.resolve, f.ctx, args); throw new Error("ORIGINAL_GOVERNED_RETRIEVAL_REACHED");
    }
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  await expect(f.prepare(attempt)).rejects.toThrow("ORIGINAL_GOVERNED_RETRIEVAL_REACHED");
  expect(resolve).toHaveBeenCalledTimes(1); expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started");
});
it("cutoff/history exclusions and future queued inputs cannot become indexed context", async () => {
  const f = await fixture(), { probe, run, attempt } = await f.start();
  await f.run("future", run.conversationId);
  const source = await f.source("After cutoff", "future-source"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  expect(await f.call(context.indexedContextAvailability, probe)).toMatchObject({ empty: true });
  expect(await f.call(context.indexedContextAvailability, { ...probe, cutoff: 3 })).toMatchObject({ empty: false });
  const inputs = await f.call<{ kind: string; availability: { empty: boolean }; pending: { text: string }; current: { snapshot: { ingestionCutoff: { sequence: number } } } }>(runtime.contextInputs, attempt);
  expect(inputs).toMatchObject({ kind: "ready", availability: { empty: true }, pending: { text: "" } });
  expect(inputs.current.snapshot.ingestionCutoff.sequence).toBe(probe.cutoff);
});
it("metadata overflow conservatively retains ordinary retrieval", async () => {
  const f = await fixture(), { probe } = await f.start();
  for (let index = 2; index <= 1026; index++) f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    ownerPrincipalId: f.reference.principalId, sequence: index, eligibility: "superseded", lineage: { sourceId: `overflow:${index}`, sourceEventId: `overflow:${index}`, sourceRevision: 1 } });
  f.db.table("runtimeIngestionScopes")[0].sequence = 1026;
  // Manually seeded events advance both authoritative sequence records.
  f.db.table("runtimeIngestionSequenceHeads")[0].sequence = 1026;
  expect(await f.call(context.indexedContextAvailability, { ...probe, cutoff: 1026 })).toMatchObject({ empty: false });
});
it("stale profile readiness cannot be bypassed by empty exclusions", async () => {
  const f = await fixture(), source = await f.source("Old profile source", "old-profile");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  f.db.seed("runtimeMemoryVectorGenerations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
    ...source.lineage, contentHash: source.contentHash, profile: LARGE_EMBEDDING_PROFILE });
  const { probe } = await f.start();
  await expect(f.call(context.indexedContextAvailability, { ...probe, excludedSourceKeys: [...probe.excludedSourceKeys, contextSourceKey(source, source.lineage)] })).rejects.toThrow("PROFILE_NOT_READY");
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it.each(["approval", "profile-pin", "revocation"] as const)("the atomic save rechecks empty-context %s currentness", async fault => {
  const f = await fixture(), source = await f.source("Awaiting approval knowledge", "approval-source");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); f.db.table("runtimeIngestionEvents")[0].eligibility = "awaiting_approval";
  const { attempt, probe } = await f.start(); expect(await f.call(context.indexedContextAvailability, probe)).toMatchObject({ empty: true });
  if (fault === "approval") f.db.table("runtimeIngestionEvents")[0].eligibility = "eligible";
  if (fault === "revocation") f.grant.revokedAt = Date.now();
  await expect(f.call(runtime.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete", emptyIndexedProfileId: fault === "profile-pin" ? LARGE_EMBEDDING_PROFILE.profileId : DEFAULT_EMBEDDING_PROFILE.profileId })).rejects.toBeDefined();
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started"); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it.each(["cutoff", "maxBytes", "excludedSourceKeys", "profile", "runBudgetId"])("the internal query rejects caller-selected %s", async field => {
  const f = await fixture(), { attempt } = await f.start();
  expect(runtime.contextInputs.isInternal).toBe(true);
  expect(() => assertNativeArgs(runtime.contextInputs, { ...attempt, [field]: "injected" })).toThrow(`Unknown native field: ${field}`);
  expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started");
});
it.each(["scope", "reference", "attempt", "lease", "expired_lease", "cancel", "revocation", "tombstone", "epoch", "input_edit", "context_state"])(
  "the actual combined read denies %s before profile readiness/retrieval", async fault => {
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
    if (fault === "context_state") f.db.table("runtimeAgentExecutions")[0].contextState = "failed";
    if (fault === "input_edit") f.native.messages.values().next().value!.message = { role: "user", content: "changed" };
    const reads = jest.spyOn(f.db, "query");
    await expect(f.prepare(args)).rejects.toThrow();
    expect(reads.mock.calls.some(([table]) => table === "runtimeMemoryVectorGenerations")).toBe(false);
    expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
    expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
async function overflowingPending(f: Awaited<ReturnType<typeof fixture>>) {
  const sources = [];
  for (let index = 0; index < 33; index++) {
    const source = await f.source(`Authorized pending source ${index}`, `pending-overflow:${index}`);
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); sources.push(source);
  }
  return sources;
}
it("real pending overflow commits original action failure before an independently invalid profile-readiness check", async () => {
  const f = await fixture(), sources = await overflowingPending(f), { attempt } = await f.start();
  const source = sources[0];
  f.db.seed("runtimeMemoryVectorGenerations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
    ...source.lineage, contentHash: source.contentHash, profile: LARGE_EMBEDDING_PROFILE });
  const reads = jest.spyOn(f.db, "query");
  expect(await f.call(runtime.contextInputs, attempt)).toMatchObject({ kind: "pending_overflow", pending: { completeness: "incomplete", reason: "CONTEXT_OVERFLOW" } });
  expect(reads.mock.calls.some(([table]) => table === "runtimeMemoryVectorGenerations")).toBe(false);
  await expect(f.prepare(attempt)).rejects.toThrow("CONTEXT_OVERFLOW");
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "failed", contextCompleteness: "incomplete", contextFailureCode: "CONTEXT_OVERFLOW" });
  expect(f.db.table("runtimeRuns")[0]).toMatchObject({ contextCompleteness: "incomplete", contextFailureCode: "CONTEXT_OVERFLOW" });
  expect(reads.mock.calls.some(([table]) => table === "runtimeMemoryVectorGenerations")).toBe(false);
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("the existing incomplete policy keeps overflow on original availability and governed retrieval", async () => {
  const f = await fixture({ onFailure: "incomplete" }); await overflowingPending(f); const { attempt } = await f.start();
  expect(await f.call(runtime.contextInputs, attempt)).toMatchObject({ kind: "ready", pending: { completeness: "incomplete" }, availability: { empty: false } });
  const reached = observeGovernedRetrieval(f);
  await expect(f.prepare(attempt)).rejects.toThrow("ORIGINAL_GOVERNED_RETRIEVAL_REACHED");
  expect(reached).toHaveBeenCalledTimes(1); expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started");
});
it("the current barrier's incomplete code survives the combined read and original save", async () => {
  const f = await fixture(), { attempt } = await f.start();
  const owned = f.db.table("runtimeAgentExecutions")[0]; owned.contextCompleteness = "incomplete"; owned.contextFailureCode = "MEMORY_STAGE_FAILED";
  await f.prepare(attempt);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextState: "complete", contextCompleteness: "incomplete", contextFailureCode: "MEMORY_STAGE_FAILED" });
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toContain("Cortex context is incomplete (MEMORY_STAGE_FAILED)");
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("an unknown indexing outcome remains authorized pending context rather than a false memory-readiness claim", async () => {
  const f = await fixture(), source = await f.source("Pending unknown outcome", "unknown-context");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); f.db.table("runtimeIngestionEvents")[0].factsState = "unknown";
  const { attempt } = await f.start(); await f.prepare(attempt);
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toContain("Pending unknown outcome");
  expect(f.db.table("runtimeIngestionEvents")[0].factsState).toBe("unknown");
  expect(f.db.table("runtimeAgentExecutions")[0].sourceWitnesses).toMatchObject([{ sourceId: source.lineage.sourceId, contentHash: source.contentHash }]);
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("bounded metadata overflow from the actual combined read still reaches original governed retrieval", async () => {
  const f = await fixture(), source = await f.source("Superseded metadata seed", "overflow-seed");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); f.db.table("runtimeIngestionEvents")[0].eligibility = "superseded";
  for (let index = 2; index <= 1026; index++) f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    ownerPrincipalId: f.reference.principalId, sequence: index, eligibility: "superseded", lineage: { sourceId: `overflow:${index}`, sourceEventId: `overflow:${index}`, sourceRevision: 1 } });
  f.db.table("runtimeIngestionScopes")[0].sequence = 1026;
  // Manually seeded events advance both authoritative sequence records.
  f.db.table("runtimeIngestionSequenceHeads")[0].sequence = 1026;
  const { attempt } = await f.start();
  expect(await f.call(runtime.contextInputs, attempt)).toMatchObject({ kind: "ready", pending: { completeness: "complete" }, availability: { empty: false } });
  const reached = observeGovernedRetrieval(f);
  await expect(f.prepare(attempt)).rejects.toThrow("ORIGINAL_GOVERNED_RETRIEVAL_REACHED"); expect(reached).toHaveBeenCalledTimes(1);
});
it.each(["revocation", "grant_expired", "lease", "cancel", "transcript_edit", "source_revision", "source_hash", "source_tombstone", "source_owner"])(
  "the real atomic save rejects %s after actual combined read", async fault => {
    const f = await fixture(), source = await f.source("Current authorized pending text", "racing-source");
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); const { attempt } = await f.start();
    const reached = await afterInputs(f, async () => {
      if (fault === "revocation") f.grant.revokedAt = Date.now();
      if (fault === "grant_expired") f.grant.expiresAt = Date.now();
      if (fault === "lease") f.db.table("runtimeRunOutbox")[0].leaseVersion = attempt.leaseVersion + 1;
      if (fault === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = Date.now();
      if (fault === "transcript_edit") f.native.messages.values().next().value!.message = { role: "user", content: "changed after read" };
      if (fault === "source_revision") await f.source("Revised authorized text", source.lineage.sourceId, 2);
      if (fault === "source_hash") await f.source("Changed content at same revision", source.lineage.sourceId);
      if (fault === "source_tombstone") f.db.table("runtimeMemorySources")[0].tombstonedAt = Date.now();
      if (fault === "source_owner") f.db.table("runtimeMemorySources")[0].ownerPrincipalId = "foreign-principal";
    });
    await expect(f.prepare(attempt)).rejects.toThrow(); expect(reached.value).toBe(true);
    expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined();
    expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started");
    expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
it.each(["eligible_index", "profile_generation"])("the original save detects post-probe %s change within the captured cutoff", async fault => {
  const f = await fixture(), source = await f.source("Awaiting approval source", "post-probe-source");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); const event = f.db.table("runtimeIngestionEvents")[0]; event.eligibility = "awaiting_approval";
  const { attempt } = await f.start();
  const reached = await afterInputs(f, () => {
    if (fault === "eligible_index") { event.eligibility = "eligible"; event.factsState = event.vectorsState = "complete"; }
    else f.db.seed("runtimeMemoryVectorGenerations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
      ...source.lineage, contentHash: source.contentHash, profile: LARGE_EMBEDDING_PROFILE });
  });
  await expect(f.prepare(attempt)).rejects.toThrow(fault === "eligible_index" ? "STALE_CONTEXT" : "PROFILE_NOT_READY");
  expect(reached.value).toBe(true); expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started");
  expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined(); expect(f.db.table("runtimeModelOperations")).toEqual([]);
});
it("a context already committed after the combined read cannot be overwritten by the later save", async () => {
  const f = await fixture(), { attempt } = await f.start();
  const reached = await afterInputs(f, async () => {
    await f.call(runtime.saveContext, { ...attempt, context: "Winning current context", witnesses: [], completeness: "complete" });
  });
  await expect(f.prepare(attempt)).rejects.toThrow("INVALID_STATE"); expect(reached.value).toBe(true);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextCanonical: "Winning current context", contextState: "complete" });
});
