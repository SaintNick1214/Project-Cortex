/** Actual registered memory/policy/client bodies; controlled DB/component ports, no service/OCC/SLO proof. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { Value } from "convex/values";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { DerivedFact } from "../../../src/domain/contracts";
import type { MemoryDeliveryBindings } from "../../../convex-dev/runtimeMemoryRepository";
import { DEFAULT_EMBEDDING_PROFILE as profile, semanticHash } from "../../../src/domain/profile";
import { prepareSourceContent, processingIdentityKey } from "../../../src/domain/sources";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { assertNativeArgs } from "../runtimeAgent/native-arguments";
const actualAuth = await import("../../../convex-dev/runtimeAuth");
let enabled = true;
const scopes: unknown[] = [];
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...actualAuth,
  // K27 replaces only these memory read-entry factories. Keep the same
  // original uncached reference and all outcome/denial assertions.
  createMemorySourceReadScope: <Ctx extends Parameters<typeof actualAuth.createMemorySourceReadScope>[0]>(ctx: Ctx) => {
    const scoped = enabled ? actualAuth.createMemorySourceReadScope(ctx) : ctx; scopes.push(scoped); return scoped;
  },
  createAuthorityReadScope: <Ctx extends Parameters<typeof actualAuth.createAuthorityReadScope>[0]>(ctx: Ctx) => {
    const scoped = enabled ? actualAuth.createAuthorityReadScope(ctx) : ctx; scopes.push(scoped); return scoped;
  },
}));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start(ctx: MutationCtx, _ref: unknown, args: Record<string, Value>) { return ctx.scheduler.runAfter(0, makeFunctionReference<"mutation", { args: Record<string, Value> }>("test:workflow"), { args }); }
} }));
const { transcriptFixture, installIngestionMockRoot, invoke, ledger, runs, clone, clock } = await import("../runtimeTranscript/fixture");
const { ConvexMemoryRepository, memoryScope, canonicalMemoryValue } = await import("../../../convex-dev/runtimeMemoryRepository");
const { explicitSourceLineage } = await import("../../../convex-dev/runtimeMemoryServices");
const memory = await import("../../../convex-dev/runtimeMemory");
const client = await import("../../../convex-dev/runtimeClient");
const agent = await import("../../../convex-dev/runtimeAgent");
const authTables = new Set(["runtimeAuthPrincipals", "runtimeAuthMemberships", "runtimeAuthGrants", "runtimeAuthScopes", "runtimeAuthTombstones"]);
beforeEach(() => { enabled = true; scopes.length = 0; installIngestionMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
async function setup(count = 3) {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return original(ref, args); }
    if (name === "runs:claimNext") return invoke(runs.claimNext, f.ctx, args);
    return original(ref, args);
  }) as MutationCtx["runMutation"];
  const writer = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db), scope = memoryScope(f.reference);
  for (let index = 0; index < count; index++) {
    const prepared = await prepareSourceContent(scope, explicitSourceLineage(scope, `scope-${index}`), `Preference ${index}`, { now: () => clock });
    await writer.putSource(prepared.source);
    const source = { sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId, sourceRevision: 1 },
      identity = { ...source, stage: "facts" as const, semanticPolicyVersion: "scope-fixture" };
    const fact: DerivedFact = { _id: "", factId: `fact-${index}`, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
      ownerPrincipalId: scope.principalId, lineage: prepared.source.lineage, extractionPolicyVersion: "scope-fixture", fact: `Preference ${index}`,
      factType: "preference", confidence: 90, sourceType: "manual", tags: [], version: 1, createdAt: clock, updatedAt: clock };
    await writer.commitDerived({ source, identity, chunks: prepared.chunks, facts: [fact], expectedFactVersions: { [fact.factId]: 0 },
      vectors: [{ ...source, vectorId: `vector-${index}`, chunkId: prepared.chunks[0]!.chunkId, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId,
        profile, embedding: Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0), processingReceiptId: await processingIdentityKey(identity) }] });
  }
  const read = new ConvexMemoryRepository(f.ctx, f.reference, "read"), hits = f.db.table("runtimeMemoryVectors").map(row => ({ id: row._id as Id<"runtimeMemoryVectors">, score: 0 }));
  const matches = await read.hydrateVectors(hits), facts = await read.listFacts({ limit: 10 });
  const bindings: MemoryDeliveryBindings = { sources: f.db.table("runtimeMemorySources").map(row => ({ sourceId: (row.lineage as { sourceId: string }).sourceId,
    sourceEventId: (row.lineage as { sourceEventId: string }).sourceEventId, sourceRevision: (row.lineage as { sourceRevision: number }).sourceRevision,
    contentHash: row.contentHash as string, ownerPrincipalId: row.ownerPrincipalId as string, permission: "canViewMemories" })), facts: await Promise.all(facts.map(fact => ({ factId: fact.factId,
    payloadHash: semanticHash(canonicalMemoryValue(fact)) })).map(async item => ({ factId: item.factId, payloadHash: await item.payloadHash }))),
    vectors: await Promise.all(matches.map(async match => ({ vectorId: match.vector.vectorId, profile: match.vector.profile,
      payloadHash: await semanticHash(canonicalMemoryValue(match.vector)), chunkHash: await semanticHash(canonicalMemoryValue(match.chunk)) }))) };
  const budget = await f.call<{ runBudgetId: string }>(ledger.ensureBudget, { reference: f.reference, operationKey: "embedding.query", requestId: "scope-budget", requestCanonical: canonicalModelJson({ text: "scope" }) });
  return { ...f, get grant() { return f.grant; }, hits, bindings, budget };
}
type Fixture = Awaited<ReturnType<typeof setup>>;
function trace(f: Fixture) {
  const events: { operation: string; table: string; key?: string }[] = [], query = f.db.query.bind(f.db), get = f.db.get.bind(f.db);
  jest.spyOn(f.db, "query").mockImplementation(table => { events.push({ operation: "query", table }); return query(table); });
  jest.spyOn(f.db, "get").mockImplementation(async (table, key) => { events.push({ operation: "get", table, key }); return get(table, key); });
  for (const method of ["insert", "replace", "delete"] as const) {
    const original = f.db[method].bind(f.db);
    jest.spyOn(f.db, method).mockImplementation((async (...args: unknown[]) => { events.push({ operation: method, table: args[0] as string }); return Reflect.apply(original, f.db, args) as unknown; }) as never);
  }
  const patch = f.db.patch.bind(f.db);
  jest.spyOn(f.db, "patch").mockImplementation(async (tableOrId: string, idOrPatch: string | Record<string, unknown>, value?: Record<string, unknown>) => {
    events.push({ operation: "patch", table: typeof idOrPatch === "string" ? tableOrId : tableOrId.split(":")[0] });
    if (typeof idOrPatch === "string") await patch(tableOrId, idOrPatch, value!); else await patch(tableOrId, idOrPatch);
  });
  return { events, nonAuth: () => events.filter(e => !authTables.has(e.table)), authReads: () => events.filter(e => authTables.has(e.table) && ["get", "query"].includes(e.operation)) };
}
function stored(f: Fixture) { return clone({ rows: f.db.rows, writes: f.db.writes, effects: f.effects, native: f.native, scheduled: f.scheduled }); }
async function differential(f: Fixture, registration: unknown, args: unknown, requireReduction = true) {
  const observed = trace(f), rollback = new Error("REFERENCE_ROLLBACK"); let expected: unknown, after: unknown;
  enabled = false;
  await expect(f.transaction(async () => { expected = await invoke(registration, f.ctx, args); after = stored(f); throw rollback; })).rejects.toBe(rollback);
  const nonAuth = clone(observed.nonAuth()), auth = observed.authReads().length; observed.events.length = 0; enabled = true; scopes.length = 0;
  assertNativeArgs(registration, args); const actual = await f.call(registration, args);
  expect(actual).toEqual(expected); expect(stored(f)).toEqual(after); expect(observed.nonAuth()).toEqual(nonAuth);
  if (requireReduction) expect(observed.authReads().length).toBeLessThan(auth);
  return { unscopedAuthReads: auth, scopedAuthReads: observed.authReads().length, nonAuthReadWriteOrderEntries: nonAuth.length };
}
it.each(["facts", "vectors", "delivery", "profile"])("registered %s preserves exact result/order with its explicitly accepted scope activation", async kind => {
  const f = await setup(), common = { reference: f.reference, capability: "read" };
  const registration = kind === "facts" ? memory.readFacts : kind === "vectors" ? memory.readVectorMatches : kind === "delivery" ? memory.finalDelivery : memory.checkProfileReady;
  const args = kind === "facts" ? { ...common, query: { limit: 10 } } : kind === "vectors" ? { ...common, profile, hits: f.hits }
    : kind === "delivery" ? { reference: f.reference, bindings: f.bindings } : { ...common, profile };
  const counts = await differential(f, registration, args);
  console.info(JSON.stringify({ type: "authority-entry-fixture-count", entry: kind, acceptedEntryScope: true, ...counts }));
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
it.each(["embeddingProfile", "resolve"] as const)("standalone policy %s retains its original current profile/account/source predicates", async kind => {
  const f = await setup(), args = { reference: f.reference, operationKey: "embedding.query", runBudgetId: f.budget.runBudgetId };
  const counts = await differential(f, ledger[kind], args, false);
  // This minimal standalone account has one authority pass, not the repeated
  // Agent/source-parent guards measured in recall. Do not invent a reduction.
  expect(counts.scopedAuthReads).toBe(counts.unscopedAuthReads); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
});
async function reserve(f: Fixture) {
  const resolution = await f.call<{ snapshot: { pins: { promptVersion: string; schemaVersion: string; extractionVersion: string; toolRegistryVersion: string } } }>(ledger.resolve,
    { reference: f.reference, operationKey: "embedding.query", runBudgetId: f.budget.runBudgetId });
  const requestCanonical = canonicalModelJson({ semanticId: "entry-scope", childCallId: "untrusted", texts: ["query"], inputTokens: 1, outputTokens: 0,
    toolSteps: 0, timeoutMs: 1000, reservationUnits: 1, promptVersion: resolution.snapshot.pins.promptVersion, schemaVersion: resolution.snapshot.pins.schemaVersion,
    extractionVersion: resolution.snapshot.pins.extractionVersion, toolRegistryVersion: resolution.snapshot.pins.toolRegistryVersion, profile, batch: { ordinal: 0, start: 0, end: 1 }, tools: [], options: { maxRetries: 0 } });
  const args = { reference: f.reference, operationKey: "embedding.query", runBudgetId: f.budget.runBudgetId, semanticId: "entry-scope", ordinal: 0, requestCanonical };
  return { args, requestCanonical };
}
it("standalone admission retains writes, reservation, replay identity and write-epoch authority rechecks", async () => {
  const f = await setup(), { args } = await reserve(f); await differential(f, ledger.admit, args);
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "reserved", slotReleased: false });
  expect(f.db.table("runtimeBudgetAccounts").some(row => (row.activeConcurrency as number) > 0)).toBe(true);
  expect(await f.call(ledger.admit, args)).toMatchObject({ status: "inflight", attemptId: f.db.table("runtimeModelAttempts")[0]._id }); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});
it("standalone checkpoint preserves no-paid-retry transition and all non-auth operations", async () => {
  const f = await setup(), { args } = await reserve(f), admitted = await f.call<{ attemptId: string; requestCanonical: string }>(ledger.admit, args);
  await differential(f, ledger.checkpoint, { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", slotReleased: false });
  expect(await f.call(ledger.checkpoint, { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical })).toMatchObject({ dispatchPermit: false, state: "dispatch_pending", replayAllowed: false });
});
it("combined admission passes the scoped writer through original helpers and preserves exact non-auth effect ordering", async () => {
  const f = await setup(0); await differential(f, client.submitAndStart, { request: f.request(), streaming: false });
  expect(f.db.table("runtimeRunAttempts")).toHaveLength(1); expect(f.db.table("runtimeAgentExecutions")).toHaveLength(1);
  expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({ executionMode: "direct-v6", directState: "scheduled" });
  expect(f.scheduled.filter(item => item.name === "runtimeAgent:executeDirectV6")).toHaveLength(1);
  expect(f.scheduled.filter(item => item.name === "test:workflow")).toHaveLength(0);
});
async function observationFixture() {
  const f = await setup(0), value = await f.call<{ run: ReturnType<typeof runs.publicRun> }>(client.submitAndStart, { request: f.request() });
  const owned = f.db.table("runtimeAgentExecutions")[0], attempt = { reference: f.reference, runId: value.run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
  await f.call(agent.startContext, attempt); await f.call(agent.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete" });
  await f.call(agent.recordOutput, { ...attempt, parts: [{ type: "text-delta", text: "controlled", id: "text" }] });
  const handle = { version: 1 as const, tenantId: value.run.scope.tenantId, memorySpaceId: value.run.scope.memorySpaceId,
    principalId: f.reference.principalId, runId: value.run.runId, conversationId: value.run.conversationId, agentId: value.run.agentId,
    agentVersion: value.run.agentVersion, definitionHash: value.run.definitionHash };
  return { f, handle };
}
it("observation entry preserves private projections, handle checks and original fresh post-session endpoint", async () => {
  const { f, handle } = await observationFixture(), counts = await differential(f, client.observeEnvelope, { handle, limit: 10 }, false);
  // Accepted K29 retains raw authority rows within this native observation snapshot.
  // The differential above still checks identical observation/effects/non-auth reads;
  // the separate post-session and fresh revocation checks below remain independent.
  expect(counts.scopedAuthReads).toBeLessThan(counts.unscopedAuthReads); const beforeScopes = scopes.length;
  const priorScope=scopes.at(-1);
  await f.call(client.observeEnvelope, { handle, limit: 10 }); expect(scopes.length).toBe(beforeScopes+1);expect(scopes.at(-1)).not.toBe(priorScope);
  const beforeSession=scopes.length;await f.call(client.session,{});expect(scopes.length).toBe(beforeSession);
  f.grant.revokedAt = clock; await expect(f.call(client.session, {})).rejects.toThrow("FORBIDDEN"); await expect(f.call(client.observeEnvelope, { handle })).rejects.toThrow("FORBIDDEN");
});
it.each(["facts", "vectors", "delivery", "profile"])("new %s invocation freshly denies grant revocation rather than using a prior scope", async kind => {
  const f = await setup(), common = { reference: f.reference, capability: "read" }, registration = kind === "facts" ? memory.readFacts : kind === "vectors" ? memory.readVectorMatches : kind === "delivery" ? memory.finalDelivery : memory.checkProfileReady;
  const args = kind === "facts" ? { ...common, query: { limit: 10 } } : kind === "vectors" ? { ...common, profile, hits: f.hits } : kind === "delivery" ? { reference: f.reference, bindings: f.bindings } : { ...common, profile };
  await f.call(registration, args); f.grant.revokedAt = clock; await expect(f.call(registration, args)).rejects.toThrow("FORBIDDEN");
});
it.each(["source_hash", "source_tombstone", "fact_tombstone", "vector_payload", "grant_duplicate", "expired", "wrong_owner", "scope_epoch"])("current delivery %s fails with identical scoped/unscoped error and no writes", async fault => {
  const f = await setup();
  if (fault === "source_hash") { f.db.table("runtimeMemorySources")[0].content = "Changed semantic source"; f.db.table("runtimeMemorySources")[0].contentHash = await semanticHash("Changed semantic source"); }
  if (fault === "source_tombstone") f.db.table("runtimeMemorySources")[0].tombstonedAt = clock;
  if (fault === "fact_tombstone") f.db.table("facts")[0].tombstonedAt = clock;
  if (fault === "vector_payload") (f.db.table("runtimeMemoryVectors")[0].embedding as number[])[0] = 9;
  if (fault === "grant_duplicate") f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:duplicate" });
  if (fault === "expired") f.grant.expiresAt = clock;
  if (fault === "wrong_owner") f.db.table("runtimeMemorySources")[0].ownerPrincipalId = "foreign";
  if (fault === "scope_epoch") f.db.table("runtimeAuthScopes")[0].epoch = 2;
  const before = stored(f); const rejection = async () => { try { await f.call(memory.finalDelivery, { reference: f.reference, bindings: f.bindings }); throw new Error("EXPECTED_FAILURE"); }
    catch (error) { if (!(error instanceof Error) || error.message === "EXPECTED_FAILURE") throw error; return { name: error.name, message: error.message, data: "data" in error ? error.data : undefined }; } };
  enabled = false; const original = await rejection(); enabled = true; expect(await rejection()).toEqual(original); expect(stored(f)).toEqual(before);
});
it("source reads intentionally remain unscoped and a late getter authority revocation still denies", async () => {
  const f = await setup(), get = f.db.get.bind(f.db); let reads = 0;
  jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { const row = await get(table, id);
    if (table === "runtimeAuthGrants" && ++reads === 1) f.grant.revokedAt = clock; return row;
  });
  scopes.length = 0; await expect(f.call(memory.readSource, { reference: f.reference, capability: "read", sourceId: f.db.table("runtimeMemorySources")[0].lineage && (f.db.table("runtimeMemorySources")[0].lineage as { sourceId: string }).sourceId })).rejects.toThrow("FORBIDDEN");
  expect(scopes).toEqual([]);
});
it("registered admission clears the same raw-grant entry after an actual child writer before the next original guard", async () => {
  const f = await setup(0), child = f.ctx.runMutation.bind(f.ctx); let reached = false;
  f.ctx.runMutation = (async (ref, args) => { const result = await child(ref, args); let name = ""; try { name = getFunctionName(ref); } catch { return result; }
    if (name === "runs:claimNext") { reached = true; await f.db.patch("runtimeAuthGrants", f.grant._id, { revokedAt: clock }); } return result;
  }) as MutationCtx["runMutation"];
  const before = stored(f); await expect(f.call(client.submitAndStart, { request: f.request() })).rejects.toThrow("FORBIDDEN"); expect(reached).toBe(true); expect(stored(f)).toEqual(before);
});

it("different verified issuer/subject identities in one observer still use distinct raw keys and deny the other owner", async () => {
  const { f, handle } = await observationFixture();
  const principal = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-b", actorKind: "user", version: 1 }),
    membership = f.db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1 });
  f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:other", principalId: principal._id, membershipId: membership._id });
  let identities = 0; f.ctx.auth.getUserIdentity = (async () => ({ issuer: "https://host.test", subject: ++identities === 1 ? "user-a" : "user-b" })) as MutationCtx["auth"]["getUserIdentity"];
  const before = stored(f); await expect(f.call(client.observeEnvelope, { handle })).rejects.toThrow("FORBIDDEN");
  expect(identities).toBe(2); expect(stored(f)).toEqual(before);
});
it("clock-only grant expiry is replayed during observation even with reusable raw rows", async () => {
  const { f, handle } = await observationFixture(), identity = f.ctx.auth.getUserIdentity.bind(f.ctx.auth); f.grant.expiresAt = clock + 1;
  let identities = 0; f.ctx.auth.getUserIdentity = (async () => {
    if (++identities === 2) jest.mocked(Date.now).mockReturnValue(clock + 1); return identity();
  }) as MutationCtx["auth"]["getUserIdentity"];
  await expect(f.call(client.observeEnvelope, { handle })).rejects.toThrow("FORBIDDEN"); expect(identities).toBe(2);
});
it.each(["resolve", "embeddingProfile", "checkpoint"] as const)("a fresh standalone %s invocation cannot reuse a previous authorized grant", async entry => {
  const f = await setup(), { args } = await reserve(f), admission = await f.call<{ attemptId: string; requestCanonical: string }>(ledger.admit, args);
  const input = entry === "checkpoint" ? { reference: f.reference, attemptId: admission.attemptId, requestCanonical: admission.requestCanonical }
    : { reference: f.reference, operationKey: "embedding.query", runBudgetId: f.budget.runBudgetId };
  await f.call(ledger[entry], input); f.grant.revokedAt = clock;
  await expect(f.call(ledger[entry], input)).rejects.toThrow("FORBIDDEN"); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});

it("deferred finalDelivery retains its original uncached final revocation guard after the actual last vector/chunk hash", async () => {
  const f = await setup(), before = stored(f), digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
  const { _id: _id, _creationTime: _time, ...chunk } = f.db.table("runtimeMemoryChunks").at(-1)!;
  const finalChunkInput = canonicalMemoryValue(chunk); let revocations = 0;
  jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (...args) => {
    const result = await digest(...args); if (new TextDecoder().decode(args[1]) === finalChunkInput) { f.grant.revokedAt = clock; revocations++; } return result;
  });
  await expect(f.call(memory.finalDelivery, { reference: f.reference, bindings: f.bindings })).rejects.toThrow("FORBIDDEN");
  expect(revocations).toBe(1); expect(stored(f)).toEqual(before);
});
it.each(["pre_revoke", "pre_expiry_edit", "projection_revoke"])("deferred observer retains strict original %s raw-row revalidation", async fault => {
  const { f, handle } = await observationFixture(), identity = f.ctx.auth.getUserIdentity.bind(f.ctx.auth), query = f.db.query.bind(f.db), before = stored(f); let reached = false, identities = 0;
  if (fault !== "projection_revoke") f.ctx.auth.getUserIdentity = (async () => {
    const value = await identity(); if (++identities === 2) { reached = true; if (fault === "pre_revoke") f.grant.revokedAt = clock; else f.grant.expiresAt = clock; } return value;
  }) as MutationCtx["auth"]["getUserIdentity"];
  else jest.spyOn(f.db, "query").mockImplementation(table => { if (table === "runtimeAgentOutput") { reached = true; f.grant.revokedAt = clock; } return query(table); });
  await expect(f.call(client.observeEnvelope, { handle })).rejects.toThrow("FORBIDDEN"); expect(reached).toBe(true); expect(stored(f)).toEqual(before);
});
