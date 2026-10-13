/** Actual source/cutoff/Agent handlers; native DB/component and embedding transport ports are controlled. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ApiFromModules, FunctionArgs, FunctionReturnType } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { SourceContent, MemoryModel, DerivedFact } from "../../../src/domain/contracts";
import { contextSourceKey } from "../../../src/domain/memory-context";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { assertNativeArgs } from "./native-arguments";
const embed = jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile,
  vectors: request.texts.map(() => Array.from({ length: request.profile.dimensions }, (_, i) => i === 0 ? 1 : 0)) }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; } async start() { return "workflow:source-context"; }
} }));
const { ingestionFixture, ingestion, installIngestionMockRoot, invoke } = await import("../runtimeIngestion/fixture");
const { clone } = await import("../runtimeTranscript/fixture");
const { ConvexMemoryRepository, memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const nativeMemoryModel = await import("../../../convex-dev/runtimeMemoryGateway");
// Keep the actual profile/authority/budget reader. Only the paid embedding
// transport/result is controlled; no native model billing is claimed here.
jest.unstable_mockModule("../../../convex-dev/runtimeMemoryGateway", () => ({ ...nativeMemoryModel,
  createGatewayMemoryModel: (...args: Parameters<typeof nativeMemoryModel.createGatewayMemoryModel>) => ({ ...nativeMemoryModel.createGatewayMemoryModel(...args), embed }) }));
const runtime = await import("../../../convex-dev/runtimeAgent");
const memory = await import("../../../convex-dev/runtimeMemory");
const context = await import("../../../convex-dev/runtimeMemoryContext");
const runs = await import("../../../convex-dev/runs");
type AgentApi = ApiFromModules<{ runtimeAgent: typeof runtime }>;
type SourceArgs = FunctionArgs<AgentApi["runtimeAgent"]["contextSource"]>;
beforeEach(() => { installIngestionMockRoot(); embed.mockClear(); });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await ingestionFixture(), query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  const calls: { name: string; args: unknown }[] = [];
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    calls.push({ name, args });
    const registration = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime]
      : name.startsWith("runtimeMemory:") ? memory[name.split(":")[1] as keyof typeof memory]
      : name === "runtimeMemoryContext:indexedSourceAtCutoff" ? context.indexedSourceAtCutoff : undefined;
    if (registration) { assertNativeArgs(registration, args); return invoke(registration, f.ctx, args); }
    return query(ref, args);
  }) as MutationCtx["runQuery"];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
    calls.push({ name, args });
    const registration = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime]
      : name === "runs:claimNext" ? runs.claimNext : undefined;
    if (registration) { assertNativeArgs(registration, args); return f.transaction(() => invoke(registration, f.ctx, args)); }
    return mutation(ref, args);
  }) as MutationCtx["runMutation"];
  (f.ctx as unknown as ActionCtx).vectorSearch = (async () => f.db.table("runtimeMemoryVectors").map(row => ({ _id: row._id, _score: 0.9 }))) as unknown as ActionCtx["vectorSearch"];
  async function indexed(id = "prior-source") {
    const source = await f.source(`Authorized evidence from ${id}`, id);
    await ingestion.enqueueSourceEvent(f.ctx, f.reference, source);
    const scope = memoryScope(f.reference), prepared = await prepareSourceContent(scope, source.lineage, source.content, { now: () => source.createdAt });
    const identity = { ...source.lineage, stage: "facts" as const, semanticPolicyVersion: "controlled-source-policy" };
    const receiptId = await processingIdentityKey(identity);
    const fact: DerivedFact = { _id: "", factId: `fact:${id}`, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
      ownerPrincipalId: scope.principalId, lineage: source.lineage, extractionPolicyVersion: "controlled-source-policy",
      fact: `User prefers ${id}`, factType: "preference", confidence: 91, sourceType: "manual", tags: [], version: 1, createdAt: source.createdAt, updatedAt: source.createdAt };
    await f.transaction(() => new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db).commitDerived({
      source: source.lineage, identity, chunks: prepared.chunks,
      vectors: [{ ...source.lineage, vectorId: `vector:${id}`, chunkId: prepared.chunks[0]!.chunkId,
        tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, profile: DEFAULT_EMBEDDING_PROFILE,
        embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0), processingReceiptId: receiptId }],
      facts: [fact], expectedFactVersions: { [fact.factId]: 0 },
    }));
    const event = f.db.table("runtimeIngestionEvents").find(e => (e.lineage as SourceContent["lineage"]).sourceId === id)!;
    event.factsState = event.vectorsState = "complete";
    return { source, event };
  }
  async function start() {
    const run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() });
    await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0];
    const attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    await f.call(runtime.startContext, attempt);
    const current = await f.call<FunctionReturnType<AgentApi["runtimeAgent"]["contextInputs"]>>(runtime.contextInputs, attempt);
    return { attempt, current };
  }
  return { ...f, get grant() { return f.grant; }, indexed, start, calls };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function sourceFixture() {
  const f = await fixture(), source = await f.source("Original current source", "pair-source");
  await ingestion.enqueueSourceEvent(f.ctx, f.reference, source); const event = f.db.table("runtimeIngestionEvents")[0];
  const args: SourceArgs = { reference: f.reference, sourceId: source.lineage.sourceId,
    expected: { sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash },
    excludedSourceKeys: [], cutoff: event.sequence as number,
    boundary: { conversationId: "boundary-conversation", runId: "run:current", queueSequence: 2, anchor: { order: 3, stepOrder: 1 } } };
  return { ...f, get grant() { return f.grant; }, source, event, args };
}
async function composed(f: Pick<Fixture, "call">, args: SourceArgs) {
  assertNativeArgs(runtime.contextSource, args);
  return f.call<SourceContent | null>(runtime.contextSource, args);
}
async function outcome(fn: () => Promise<unknown>) {
  try { return { result: await fn() }; } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}
function state(f: Pick<Fixture, "db" | "native" | "scheduled" | "effects">) { return clone({ rows: f.db.rows, writes: f.db.writes, native: f.native, scheduled: f.scheduled, effects: f.effects }); }
describe("actual original source and indexed-cutoff handler composition", () => {
  it("returns the same current source as the original two handlers, retains both authority/source reads, and never writes", async () => {
    const f = await sourceFixture(), before = state(f), getter = jest.spyOn(ConvexMemoryRepository.prototype, "getSource");
    const original = await f.call<SourceContent>(memory.readSource, { reference: f.reference, capability: "read", sourceId: f.args.sourceId });
    expect(await f.call(context.indexedSourceAtCutoff, { reference: f.reference, sourceId: f.args.sourceId, sourceRevision: f.source.lineage.sourceRevision, cutoff: f.args.cutoff, boundary: f.args.boundary })).toBe(true);
    getter.mockClear(); expect(await composed(f, f.args)).toEqual(original); expect(getter.mock.calls).toEqual([[f.args.sourceId], [f.args.sourceId]]);
    expect(state(f)).toEqual(before); expect(runtime.contextSource.isInternal).toBe(true); expect(runtime.contextSource.isQuery).toBe(true);
  });
  it.each(["excluded", "after_cutoff", "ineligible", "event_hash", "event_lineage", "missing_event"])("retains original %s exclusion without source selection or effects", async kind => {
    const f = await sourceFixture(), getter = jest.spyOn(ConvexMemoryRepository.prototype, "getSource");
    if (kind === "excluded") { f.args.excludedSourceKeys = [contextSourceKey(memoryScope(f.reference), f.source.lineage)]; f.args.cutoff = -1; }
    if (kind === "after_cutoff") f.args.cutoff = 0;
    if (kind === "ineligible") f.event.eligibility = "awaiting_approval";
    if (kind === "event_hash") f.event.contentHash = "0".repeat(64);
    if (kind === "event_lineage") f.event.lineage = { ...f.source.lineage, sourceEventId: "another-event" };
    if (kind === "missing_event") f.db.rows.set("runtimeIngestionEvents", []);
    const before = state(f); expect(await composed(f, f.args)).toBeNull(); expect(state(f)).toEqual(before);
    expect(getter).toHaveBeenCalledTimes(kind === "excluded" ? 1 : 2);
  });
  it.each(["event", "revision", "hash", "missing"])("rejects stale %s before exclusions and invalid cutoff", async kind => {
    const f = await sourceFixture(); f.args.excludedSourceKeys = [contextSourceKey(memoryScope(f.reference), f.source.lineage)]; f.args.cutoff = -1;
    if (kind === "event") f.args.expected.sourceEventId = "wrong-event";
    if (kind === "revision") f.args.expected.sourceRevision++;
    if (kind === "hash") f.args.expected.contentHash = "0".repeat(64);
    if (kind === "missing") f.db.rows.set("runtimeMemorySources", []);
    const before = state(f); await expect(composed(f, f.args)).rejects.toThrow("STALE_CONTEXT"); expect(state(f)).toEqual(before);
  });
  it.each(["revoked", "grant_version", "expired", "principal", "membership", "epoch", "owner", "tombstone", "source_tombstone", "duplicate"])("preserves original getter %s failure before stale/excluded filtering", async kind => {
    const f = await sourceFixture(); f.args.expected.sourceRevision++; f.args.excludedSourceKeys = [contextSourceKey(memoryScope(f.reference), f.source.lineage)];
    if (kind === "revoked") f.grant.revokedAt = Date.now();
    if (kind === "grant_version") f.grant.version = 2;
    if (kind === "expired") f.grant.expiresAt = Date.now();
    if (kind === "principal") f.principal.version = 2;
    if (kind === "membership") f.membership.revokedAt = Date.now();
    if (kind === "epoch") f.db.table("runtimeAuthScopes").find(r => r.memorySpaceId === "space-a")!.epoch = 2;
    if (kind === "owner") f.db.table("runtimeMemorySources")[0].ownerPrincipalId = "foreign-principal";
    if (kind === "source_tombstone") f.db.table("runtimeMemorySources")[0].tombstonedAt = Date.now();
    if (kind === "tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, resourceType: "source", resourceId: f.args.sourceId, deletedAt: Date.now() });
    if (kind === "duplicate") f.db.seed("runtimeMemorySources", { ...f.db.table("runtimeMemorySources")[0], _id: "duplicate-source" });
    const before = state(f), original = await outcome(() => f.call(memory.readSource, { reference: f.reference, capability: "read", sourceId: f.args.sourceId }));
    expect(original).toHaveProperty("error"); expect(await outcome(() => composed(f, f.args))).toEqual(original); expect(state(f)).toEqual(before);
  });
  it.each(["queue", "run_incomplete", "run_deleted", "run_missing", "position", "step_position", "unapproved", "bridge_deleted", "bridge_missing"])("preserves original same-conversation %s boundary exclusion", async kind => {
    const f = await sourceFixture(); Object.assign(f.event, { conversationId: f.args.boundary.conversationId, runId: "run:prior", nativeMessageId: "native:prior" });
    const run = f.db.seed("runtimeRuns", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, runId: "run:prior", queueSequence: 1, responseStatus: "complete" });
    const bridge = f.db.seed("runtimeTranscriptMessages", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, nativeMessageId: "native:prior", approved: true, order: 2, stepOrder: 0 });
    if (kind === "queue") run.queueSequence = 3;
    if (kind === "run_incomplete") run.responseStatus = "running";
    if (kind === "run_deleted") run.tombstonedAt = Date.now();
    if (kind === "run_missing") f.db.rows.set("runtimeRuns", []);
    if (kind === "position") bridge.order = 4;
    if (kind === "step_position") { bridge.order = 3; bridge.stepOrder = 2; }
    if (kind === "unapproved") bridge.approved = false;
    if (kind === "bridge_deleted") bridge.tombstonedAt = Date.now();
    if (kind === "bridge_missing") f.db.rows.set("runtimeTranscriptMessages", []);
    expect(await f.call(context.indexedSourceAtCutoff, { reference: f.reference, sourceId: f.args.sourceId, sourceRevision: 1, cutoff: f.args.cutoff, boundary: f.args.boundary })).toBe(false);
    const before = state(f); expect(await composed(f, f.args)).toBeNull(); expect(state(f)).toEqual(before);
  });
  it("preserves bounded cutoff validation after the source checks", async () => {
    const f = await sourceFixture(); for (const cutoff of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) await expect(composed(f, { ...f.args, cutoff })).rejects.toThrow("INVALID_INPUT");
    expect(embed).not.toHaveBeenCalled();
  });
  it("does not reuse authority across invocations", async () => {
    const f = await sourceFixture(); expect(await composed(f, f.args)).toEqual(f.source);
    f.grant.revokedAt = Date.now(); await expect(composed(f, f.args)).rejects.toThrow("FORBIDDEN");
  });
  it("retains the cutoff helper's second original getter rather than trusting the first source result", async () => {
    const f = await sourceFixture(), original = ConvexMemoryRepository.prototype.getSource; let count = 0;
    jest.spyOn(ConvexMemoryRepository.prototype, "getSource").mockImplementation(async function (this: InstanceType<typeof ConvexMemoryRepository>, ...args) {
      if (++count === 2) f.grant.revokedAt = Date.now(); return original.apply(this, args);
    });
    await expect(composed(f, f.args)).rejects.toThrow("FORBIDDEN"); expect(count).toBe(2);
  });
});
describe("actual Agent recall wiring and fresh completion fences", () => {
  it("selects the same ordered vector/fact evidence with one query per source/cutoff pair and unchanged final-delivery bindings", async () => {
    const f = await fixture(), first = await f.indexed("first-prior"), second = await f.indexed("second-prior"); const { attempt, current } = await f.start(); f.calls.length = 0;
    await invoke(runtime.prepareContext, f.ctx, attempt);
    const pairs = f.calls.filter(c => c.name === "runtimeAgent:contextSource"); expect(pairs).toHaveLength(4);
    const inputs = pairs.map(c => c.args as SourceArgs);
    expect(inputs.map(a => a.sourceId)).toEqual([first.source.lineage.sourceId, second.source.lineage.sourceId, first.source.lineage.sourceId, second.source.lineage.sourceId]);
    for (const input of inputs) {
      expect(input).toMatchObject({ reference: f.reference, cutoff: current.current.snapshot.ingestionCutoff.sequence, boundary: current.boundary,
        excludedSourceKeys: [...current.represented, ...current.pending.sourceKeys] });
      expect(Object.keys(input.expected).sort()).toEqual(input.expected.contentHash ? ["contentHash", "sourceEventId", "sourceRevision"] : ["sourceEventId", "sourceRevision"]);
    }
    expect(f.calls.some(c => c.name === "runtimeMemoryContext:indexedSourceAtCutoff")).toBe(false);
    // The two original listFacts delivery-binding reads remain. remember's four
    // redundant Action source wrappers are replaced, not these fresh bindings.
    expect(f.calls.filter(c => c.name === "runtimeMemory:readSource")).toHaveLength(2);
    const owned = f.db.table("runtimeAgentExecutions")[0]; expect(owned).toMatchObject({ contextState: "complete", contextCompleteness: "complete" });
    expect(owned.contextCanonical).toContain(first.source.content); expect(owned.contextCanonical).toContain(second.source.content);
    expect(owned.sourceWitnesses).toEqual([first.source, second.source].map(source => ({ sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId,
      sourceRevision: 1, contentHash: source.contentHash, permissions: ["canViewFacts", "canViewMemories"] })));
    const delivery = f.calls.find(c => c.name === "runtimeMemory:finalDelivery")!.args as { bindings: { sources: unknown[]; facts: unknown[]; vectors: unknown[] } };
    expect(delivery.bindings.sources).toHaveLength(4); expect(delivery.bindings.facts).toHaveLength(2); expect(delivery.bindings.vectors).toHaveLength(2);
    expect(f.calls.findIndex(c => c.name === "runtimeMemory:finalDelivery")).toBeLessThan(f.calls.findIndex(c => c.name === "runtimeAgent:saveContext"));
    expect(embed).toHaveBeenCalledTimes(1); expect(embed.mock.calls[0]![0]).toMatchObject({ purpose: "embedding.query", attempt: 1, profile: DEFAULT_EMBEDDING_PROFILE });
  });
  it.each(["revision", "hash", "revocation", "owner", "tombstone", "profile"])("fresh finalDelivery rejects post-composition %s before context is saved", async kind => {
    const f = await fixture(), { source } = await f.indexed(), { attempt } = await f.start(); const mutation = f.ctx.runMutation.bind(f.ctx); let reached = false;
    f.ctx.runMutation = (async (ref, args) => {
      let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
      if (name === "runtimeMemory:finalDelivery") {
        reached = f.calls.some(c => c.name === "runtimeAgent:contextSource");
        const row = f.db.table("runtimeMemorySources").find(r => (r.lineage as SourceContent["lineage"]).sourceId === source.lineage.sourceId)!;
        if (kind === "revision") row.lineage = { ...source.lineage, sourceRevision: 2 };
        if (kind === "hash") row.contentHash = "0".repeat(64);
        if (kind === "revocation") f.grant.revokedAt = Date.now();
        if (kind === "owner") row.ownerPrincipalId = "foreign";
        if (kind === "tombstone") row.tombstonedAt = Date.now();
        if (kind === "profile") f.db.table("runtimeModelControls")[0].revokedAt = Date.now();
      }
      return mutation(ref, args);
    }) as MutationCtx["runMutation"];
    await expect(invoke(runtime.prepareContext, f.ctx, attempt)).rejects.toThrow(); expect(reached).toBe(true);
    expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined(); expect(embed).toHaveBeenCalledTimes(1);
  });
  it.each(["lease", "cancel", "transcript", "witness_hash", "winning_save"])("original saveContext rejects post-delivery %s without overwriting context", async kind => {
    const f = await fixture(), { source } = await f.indexed(), { attempt } = await f.start(); const mutation = f.ctx.runMutation.bind(f.ctx); let reached = false;
    f.ctx.runMutation = (async (ref, args) => {
      let name = ""; try { name = getFunctionName(ref); } catch { return mutation(ref, args); }
      if (name === "runtimeAgent:saveContext") {
        reached = f.calls.some(c => c.name === "runtimeMemory:finalDelivery");
        if (kind === "lease") f.db.table("runtimeRunOutbox")[0].leaseVersion = attempt.leaseVersion + 1;
        if (kind === "cancel") f.db.table("runtimeRuns")[0].cancellationRequestedAt = Date.now();
        if (kind === "transcript") f.native.messages.values().next().value!.message = { role: "user", content: "changed after recall" };
        if (kind === "witness_hash") f.db.table("runtimeMemorySources").find(r => (r.lineage as SourceContent["lineage"]).sourceId === source.lineage.sourceId)!.contentHash = "0".repeat(64);
        if (kind === "winning_save") await f.call(runtime.saveContext, { ...attempt, context: "winning context", witnesses: [], completeness: "complete" });
      }
      return mutation(ref, args);
    }) as MutationCtx["runMutation"];
    await expect(invoke(runtime.prepareContext, f.ctx, attempt)).rejects.toThrow(); expect(reached).toBe(true);
    expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBe(kind === "winning_save" ? "winning context" : undefined);
  });
  it("preserves source query fault propagation with no saved context or second embedding attempt", async () => {
    const f = await fixture(); await f.indexed(); const { attempt } = await f.start(), query = f.db.query.bind(f.db); let afterInputs = false;
    const rpc = f.ctx.runQuery.bind(f.ctx); f.ctx.runQuery = (async (ref, args) => {
      let name = ""; try { name = getFunctionName(ref); } catch { return rpc(ref, args); }
      if (name === "runtimeAgent:contextSource") afterInputs = true; return rpc(ref, args);
    }) as MutationCtx["runQuery"];
    jest.spyOn(f.db, "query").mockImplementation(table => { if (afterInputs && table === "runtimeIngestionEvents") throw new Error("SOURCE_CUTOFF_PORT_FAILED"); return query(table); });
    await expect(invoke(runtime.prepareContext, f.ctx, attempt)).rejects.toThrow("SOURCE_CUTOFF_PORT_FAILED");
    expect(afterInputs).toBe(true); expect(f.db.table("runtimeAgentExecutions")[0].contextCanonical).toBeUndefined(); expect(embed).toHaveBeenCalledTimes(1);
  });
});
