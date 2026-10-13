/** Actual metadata/Agent handlers; no service or provider timing claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { contextSourceKey } from "../../../src/domain/memory-context";
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
async function fixture() {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    if (name.startsWith("runtimeAgent:")) return invoke(runtime[name.split(":")[1] as keyof typeof runtime], f.ctx, args);
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
    const run = await f.run(); await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], row = f.db.table("runtimeRuns")[0];
    const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    await f.call(runtime.startContext, attempt);
    const snapshot = JSON.parse(row.snapshotCanonical as string);
    const probe = { reference: f.reference, cutoff: snapshot.ingestionCutoff.sequence as number,
      excludedSourceKeys: snapshot.messages.map((pin: { sourceEventId: string }) => contextSourceKey(row as never, { ...pin, sourceId: pin.sourceEventId } as never)) as string[],
      boundary: { conversationId: run.conversationId, runId: run.runId, queueSequence: row.queueSequence as number, anchor: snapshot.anchor as { order: number; stepOrder: number } }, runBudgetId: row.runBudgetId as string };
    return { run, attempt, probe };
  };
  return { ...f, start };
}
it("empty eligible indexed context finishes real Agent context without creating a query embedding operation", async () => {
  const f = await fixture(), { attempt, probe } = await f.start();
  expect(await f.call(context.indexedContextAvailability, probe)).toMatchObject({ empty: true, profileId: DEFAULT_EMBEDDING_PROFILE.profileId });
  await f.call(runtime.prepareContext, attempt);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ contextCanonical: "", contextState: "complete", state: "running" });
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it("authorized pending context survives the empty-index path with fresh source witnesses", async () => {
  const f = await fixture(), source = await f.source("The launch codename is Copper Lantern.", "pending-source");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  const { attempt } = await f.start(); await f.call(runtime.prepareContext, attempt);
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
  await expect(f.call(runtime.prepareContext, attempt)).rejects.toThrow("ORIGINAL_GOVERNED_RETRIEVAL_REACHED");
  expect(resolve).toHaveBeenCalledTimes(1); expect(f.db.table("runtimeAgentExecutions")[0].contextState).toBe("started");
});
it("cutoff/history exclusions and future queued inputs cannot become indexed context", async () => {
  const f = await fixture(), { probe, run } = await f.start();
  await f.run("future", run.conversationId);
  const source = await f.source("After cutoff", "future-source"); await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
  expect(await f.call(context.indexedContextAvailability, probe)).toMatchObject({ empty: true });
  expect(await f.call(context.indexedContextAvailability, { ...probe, cutoff: 3 })).toMatchObject({ empty: false });
});
it("metadata overflow conservatively retains ordinary retrieval", async () => {
  const f = await fixture(), { probe } = await f.start();
  for (let index = 2; index <= 1026; index++) f.db.seed("runtimeIngestionEvents", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    ownerPrincipalId: f.reference.principalId, sequence: index, eligibility: "superseded", lineage: { sourceId: `overflow:${index}`, sourceEventId: `overflow:${index}`, sourceRevision: 1 } });
  f.db.table("runtimeIngestionScopes")[0].sequence = 1026;
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
