/** Durable external graph intent, trusted worker leases and current-authorized reads. */
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { EmbeddingProfile } from "../src/domain/profile";
import type { GraphProjectionLeaseV1, GraphProjectionPayloadV1, GraphProjectionWorkV1, GraphExpansionWorkV1 } from "../src/domain/graph-projection";
import { GRAPH_PROJECTION_LIMITS } from "../src/domain/graph-projection";
import { DEFAULT_EMBEDDING_PROFILE, SUPPORTED_EMBEDDING_PROFILES, assertSupportedEmbeddingProfile, semanticHash } from "../src/domain/profile";
import { canonicalModelJson } from "../src/domain/model-policy";
import { contiguousWatermark } from "../src/domain/memory-context";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { graphLease, graphReceipt } from "./runtimeGraphSchema";
import { embeddingProfile } from "./runtimeMemorySchema";
import { createAuthorityReader, recheckAuthority } from "./runtimeAuth";
import { dataAuthorityReference, dataDenied, requireDataAuthority, managedSourceIsCurrent, getScopedFact } from "./runtimeDataAuth";
type ReadCtx = Pick<QueryCtx, "db" | "runQuery">;
type ProjectionCtx = Pick<MutationCtx, "db"> & Partial<Pick<MutationCtx, "scheduler" | "runQuery">>;
type Scope = { tenantId: string; memorySpaceId: string };
type Source = Doc<"runtimeGraphSources">;
type Job = Doc<"runtimeGraphOutbox">;
type RetirementWalk = { visited: Set<string>; remaining: number };
const selectors = { tenantId: v.string(), memorySpaceId: v.string() };
// Structural callers can carry source/job/validator fields. Persisted and
// registered scope DTOs deliberately contain only these two selectors.
function exactScope(value: Scope): Scope { return { tenantId: value.tenantId, memorySpaceId: value.memorySpaceId }; }
function retirementKey(s: Scope, sourceId: string) { return canonicalModelJson([s.tenantId, s.memorySpaceId, sourceId]); }
const refreshRef = makeFunctionReference<"mutation", { reference: RuntimeAuthorityReference }>("runtimeMemoryContext:refreshWatermarks");
async function selectedProfile(ctx: Pick<QueryCtx, "runQuery">, reference: RuntimeAuthorityReference, operationKey: "embedding.memory" | "embedding.query" = "embedding.memory"): Promise<EmbeddingProfile> {
  return ctx.runQuery(makeFunctionReference<"query", { reference: RuntimeAuthorityReference; operationKey: "embedding.memory" | "embedding.query" }, EmbeddingProfile>("runtimeModelPolicy:embeddingProfile"), { reference, operationKey });
}
async function currentSource(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, sourceId: string, capability: "read" | "write") {
  const s = scope(reference); const source = await sourceRow(ctx, s, sourceId);
  await recheckAuthority(ctx, reference, { ...s, capability, ...(source ? { resource: { ...s, resourceType: "source" as const, resourceId: sourceId, ownerPrincipalId: source.ownerPrincipalId } } : {}) });
  if (!source || !await managedSourceIsCurrent(ctx, reference, source, capability, "canViewFacts")) dataDenied("STALE_SOURCE");
  return source;
}
function knownCurrentnessDenial(error: unknown) {
  if (!(error instanceof ConvexError)) return false;
  const data = error.data;
  return data !== null && typeof data === "object" && "code" in data && ["FORBIDDEN", "STALE_SOURCE", "PROFILE_NOT_READY", "POLICY_DENIED"].includes(String(data.code));
}
function positive(value: number) { if (!Number.isSafeInteger(value) || value < 1) dataDenied("INVALID_INPUT"); }
function scope(reference: RuntimeAuthorityReference): Scope {
  if (!reference.memorySpaceId || !reference.memorySpaceEpoch) dataDenied();
  return { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId };
}
async function sourceRow(ctx: Pick<QueryCtx, "db">, s: Scope, sourceId: string) {
  return ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", s.tenantId)
    .eq("memorySpaceId", s.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
}
async function intent(ctx: Pick<QueryCtx, "db">, s: Scope, sourceId: string) {
  return ctx.db.query("runtimeGraphSources").withIndex("by_source", q => q.eq("tenantId", s.tenantId)
    .eq("memorySpaceId", s.memorySpaceId).eq("sourceId", sourceId)).unique();
}
async function connector(ctx: Pick<QueryCtx, "db">, s: Scope, connectorId: string) {
  const row = await ctx.db.query("runtimeGraphConnectors").withIndex("by_connector", q => q.eq("tenantId", s.tenantId)
    .eq("memorySpaceId", s.memorySpaceId).eq("connectorId", connectorId)).unique();
  if (!row?.enabled) dataDenied("GRAPH_UNAVAILABLE", "Graph connector is unavailable"); return row;
}
async function worker(ctx: Pick<QueryCtx, "db" | "auth">, s: Scope, connectorId: string) {
  const configured = await connector(ctx, s, connectorId);
  const actor = await requireDataAuthority(ctx, { tenantId: configured.workerTenantId, memorySpaceId: configured.workerMemorySpaceId }, "admin");
  if (actor.actorKind !== "service" || actor.resourceAccess === "own" || actor.principalId !== configured.workerPrincipalId) dataDenied();
  return configured;
}
async function payloadFor(ctx: Pick<QueryCtx, "db">, s: Scope, revision: number): Promise<GraphProjectionPayloadV1> {
  const row = await ctx.db.query("runtimeGraphPayloads").withIndex("by_revision", q => q.eq("tenantId", s.tenantId)
    .eq("memorySpaceId", s.memorySpaceId).eq("revision", revision)).unique();
  if (!row) dataDenied("GRAPH_STATE_INVALID"); return JSON.parse(row.payloadCanonical) as GraphProjectionPayloadV1;
}
async function updateEvent(ctx: ProjectionCtx, value: Source, state: "pending" | "complete" | "dead_letter") {
  const events = await ctx.db.query("runtimeIngestionEvents").withIndex("by_source", q => q.eq("tenantId", value.tenantId)
    .eq("memorySpaceId", value.memorySpaceId).eq("lineage.sourceId", value.sourceId).eq("lineage.sourceRevision", value.sourceRevision)).take(2);
  for (const event of events) if (event.lineage.sourceEventId === value.sourceEventId && event.contentHash === value.contentHash) {
    await ctx.db.patch("runtimeIngestionEvents", event._id, { graphState: state === "dead_letter" ? "failed" : state,
      graphProfilesComplete: state === "complete" ? [value.profile.profileId] : [] });
  }
  if (value.authorityReference && ctx.scheduler) await ctx.scheduler.runAfter(0, refreshRef, { reference: value.authorityReference });
}
async function enqueueJob(ctx: ProjectionCtx, value: Source, connectorId: string) {
  const jobId = `graph:${await semanticHash(canonicalModelJson([value.tenantId, value.memorySpaceId, connectorId, value.sourceId, value.revision, value.payloadHash]))}`;
  const existing = await ctx.db.query("runtimeGraphOutbox").withIndex("by_job", q => q.eq("tenantId", value.tenantId)
    .eq("memorySpaceId", value.memorySpaceId).eq("connectorId", connectorId).eq("jobId", jobId)).unique();
  if (existing) return;
  for (const state of ["pending", "running"] as const) {
    const old = await ctx.db.query("runtimeGraphOutbox").withIndex("by_queue", q => q.eq("tenantId", value.tenantId)
      .eq("memorySpaceId", value.memorySpaceId).eq("connectorId", connectorId).eq("state", state)).filter(q => q.eq(q.field("sourceId"), value.sourceId)).take(2);
    for (const row of old) await ctx.db.patch("runtimeGraphOutbox", row._id, { state: "superseded", updatedAt: Date.now() });
  }
  await ctx.db.insert("runtimeGraphOutbox", { tenantId: value.tenantId, memorySpaceId: value.memorySpaceId, connectorId, jobId,
    sourceId: value.sourceId, revision: value.revision, payloadHash: value.payloadHash, state: "pending", attempt: 0,
    leaseVersion: 0, retryAt: 0, createdAt: Date.now(), updatedAt: Date.now() });
}
/** Atomic caller supplies identities only; payload is built from current Core rows. */
export async function enqueueSourceProjection(ctx: ProjectionCtx, reference: RuntimeAuthorityReference, sourceId: string,
  selected?: EmbeddingProfile) {
  const s = scope(reference);
  const configured = await ctx.db.query("runtimeGraphConnectors").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).take(3);
  let profile = selected;
  if (!profile && configured.some(c => c.enabled)) {
    if (!ctx.runQuery) dataDenied("GRAPH_POLICY_UNAVAILABLE");
    profile = await selectedProfile({ runQuery: ctx.runQuery }, reference);
  }
  profile ??= DEFAULT_EMBEDDING_PROFILE; assertSupportedEmbeddingProfile(profile);
  const source = await sourceRow(ctx, s, sourceId);
  if (!source) dataDenied("STALE_SOURCE");
  await recheckAuthority(ctx, reference, { capability: "write", ...s, resource: { ...s, resourceType: "source", resourceId: sourceId, ownerPrincipalId: source.ownerPrincipalId } });
  if (!await managedSourceIsCurrent(ctx, reference, source, "write")) dataDenied("STALE_SOURCE");
  const rows = await ctx.db.query("facts").withIndex("by_runtime_source", q => q.eq("tenantId", s.tenantId)
    .eq("memorySpaceId", s.memorySpaceId).eq("lineage.sourceId", sourceId).eq("lineage.sourceRevision", source.lineage.sourceRevision))
    .filter(q => q.and(q.eq(q.field("tombstonedAt"), undefined), q.eq(q.field("supersededBy"), undefined),
      q.or(q.eq(q.field("validUntil"), undefined), q.gt(q.field("validUntil"), Date.now())))).take(GRAPH_PROJECTION_LIMITS.maximumFacts + 1);
  if (rows.length > GRAPH_PROJECTION_LIMITS.maximumFacts) dataDenied("GRAPH_SCOPE_TOO_BROAD");
  const reader = createAuthorityReader(ctx); const facts: GraphProjectionPayloadV1["facts"] = [];
  for (const fact of rows) {
    if (fact.tombstonedAt !== undefined || fact.supersededBy || fact.validUntil !== undefined && fact.validUntil <= Date.now()
      || fact.lineage?.sourceRevision !== source.lineage.sourceRevision || fact.lineage.sourceEventId !== source.lineage.sourceEventId
      || fact.ownerPrincipalId !== source.ownerPrincipalId || fact.lineage.role === "assistant") continue;
    if (await reader.hasTombstone({ ...s, resourceType: "fact", resourceId: fact.factId })) continue;
    facts.push({ factId: fact.factId, revision: fact.version, text: fact.fact,
      entities: (fact.entities ?? []).map(({ name, type }) => ({ name, type })), relations: fact.relations ?? [] });
  }
  facts.sort((a, b) => a.factId.localeCompare(b.factId));
  const old = await intent(ctx, s, sourceId);
  if (old && (old.sourceRevision !== source.lineage.sourceRevision || old.sourceEventId !== source.lineage.sourceEventId || old.contentHash !== source.contentHash)) {
    await walkDependents(ctx, s, sourceId, { visited: new Set([retirementKey(s, sourceId)]), remaining: 16 });
  }
  const value = await writeIntent(ctx, s, source, reference, profile, "replace", facts);
  await registerDependencies(ctx, s, source, value);
  return value;
}
async function registerDependencies(ctx: ProjectionCtx, s: Scope, source: Doc<"runtimeMemorySources">, value: Source) {
  const sourceId = source.lineage.sourceId;
  const witnesses = [...(source.contextSourceWitnesses ?? [])];
  if (source.transcriptOrigin) {
    const bridge = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", s.tenantId)
      .eq("memorySpaceId", s.memorySpaceId).eq("nativeMessageId", source.transcriptOrigin!.nativeMessageId)).unique();
    witnesses.push(...(bridge?.contextSourceWitnesses ?? []));
  }
  const prior = await ctx.db.query("runtimeGraphDependencies").withIndex("by_dependent", q => q.eq("tenantId", s.tenantId)
    .eq("memorySpaceId", s.memorySpaceId).eq("dependentSourceId", sourceId)).take(65);
  if (prior.length > 64 || witnesses.length > 64) dataDenied("CONTEXT_LIMIT_EXCEEDED");
  for (const edge of prior) await ctx.db.delete("runtimeGraphDependencies", edge._id);
  for (const upstream of new Set(witnesses.map(witness => witness.sourceId))) await ctx.db.insert("runtimeGraphDependencies", {
    ...s, sourceId: upstream, dependentSourceId: sourceId, dependentRevision: value.revision });
}
/** Optional projection failure preserves the canonical fact/text write. The
 * empty remote tombstone is cleanup, never a truncated successful snapshot. */
export async function enqueueFactProjection(ctx: ProjectionCtx, reference: RuntimeAuthorityReference, sourceId: string, selected?: EmbeddingProfile) {
  try { return await enqueueSourceProjection(ctx, reference, sourceId, selected); }
  catch (error) {
    const code = error instanceof ConvexError && error.data !== null && typeof error.data === "object" && "code" in error.data ? String(error.data.code) : "";
    if (code !== "GRAPH_SCOPE_TOO_BROAD" && code !== "GRAPH_PAYLOAD_TOO_LARGE") throw error;
    const s = scope(reference); const source = await sourceRow(ctx, s, sourceId); if (!source) throw error;
    const configured = await ctx.db.query("runtimeGraphConnectors").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).take(3);
    const profile = selected ?? (configured.some(c => c.enabled) && ctx.runQuery ? await selectedProfile({ runQuery: ctx.runQuery }, reference) : DEFAULT_EMBEDDING_PROFILE);
    assertSupportedEmbeddingProfile(profile);
    const value = await writeIntent(ctx, s, source, reference, profile, "tombstone", [], code);
    await registerDependencies(ctx, s, source, value); return value;
  }
}
type IntentSource = { lineage: Pick<GraphProjectionPayloadV1["source"], "sourceId" | "sourceEventId" | "sourceRevision">;
  contentHash: string; ownerPrincipalId: string; transcriptOrigin?: { conversationId: string } };
async function writeIntent(ctx: ProjectionCtx, scopeInput: Scope, source: IntentSource, reference: RuntimeAuthorityReference | undefined,
  profile: EmbeddingProfile, operation: "replace" | "tombstone", facts: GraphProjectionPayloadV1["facts"], failureCode?: string) {
  const s = exactScope(scopeInput);
  const tenant = await createAuthorityReader(ctx).getScope(s.tenantId); const space = await createAuthorityReader(ctx).getScope(s.tenantId, s.memorySpaceId);
  if (!tenant || !space) dataDenied("GRAPH_STATE_INVALID");
  const old = await intent(ctx, s, source.lineage.sourceId);
  const body = { version: 1 as const, scope: { ...s, tenantEpoch: tenant.epoch, memorySpaceEpoch: space.epoch },
    source: { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision,
      contentHash: source.contentHash, ownerPrincipalId: source.ownerPrincipalId }, operation, profile, facts };
  if (old && old.failureCode === failureCode && canonicalModelJson(old.authorityReference ?? null) === canonicalModelJson(reference ?? null)
    && canonicalModelJson({ ...await payloadFor(ctx, s, old.revision), revision: 0 }) === canonicalModelJson({ ...body, revision: 0 })) return old;
  const counter = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).unique();
  const revision = (counter?.sequence ?? 0) + 1; positive(revision);
  const payloadCanonical = canonicalModelJson({ ...body, revision });
  if (new TextEncoder().encode(payloadCanonical).length > GRAPH_PROJECTION_LIMITS.maximumPayloadBytes) dataDenied("GRAPH_PAYLOAD_TOO_LARGE");
  if (counter) await ctx.db.patch("runtimeGraphScopes", counter._id, { sequence: revision, profileThrough: {}, updatedAt: Date.now() });
  else await ctx.db.insert("runtimeGraphScopes", { ...s, sequence: revision, updatedAt: Date.now() });
  await ctx.db.insert("runtimeGraphPayloads", { ...s, revision, payloadCanonical }); const payloadHash = await semanticHash(payloadCanonical);
  if (old) {
    const previous = await ctx.db.query("runtimeGraphRevisions").withIndex("by_scope_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("revision", old.revision)).unique();
    if (previous) await ctx.db.patch("runtimeGraphRevisions", previous._id, { state: "skipped" });
  }
  await ctx.db.insert("runtimeGraphRevisions", { ...s, revision, sourceId: source.lineage.sourceId, profileId: profile.profileId, state: failureCode ? "failed" : "pending" });
  const ingestionScope = await ctx.db.query("runtimeIngestionScopes").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).unique();
  if (ingestionScope) await ctx.db.patch("runtimeIngestionScopes", ingestionScope._id, { graphThrough: 0, graphProfileThrough: {} });
  const value = { ...s, ...body.source, ...(source.transcriptOrigin ? { conversationId: source.transcriptOrigin.conversationId } : {}),
    revision, payloadHash, profile, operation, ...(reference ? { authorityReference: reference } : {}), ...(failureCode ? { failureCode } : {}),
    state: failureCode ? "dead_letter" as const : "pending" as const, updatedAt: Date.now() };
  const id = old ? old._id : await ctx.db.insert("runtimeGraphSources", value);
  if (old) await ctx.db.replace("runtimeGraphSources", old._id, value);
  const row = (await ctx.db.get("runtimeGraphSources", id))!;
  const configured = await ctx.db.query("runtimeGraphConnectors").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).take(3);
  if (configured.length > 2) dataDenied("GRAPH_CONNECTOR_LIMIT");
  for (const c of configured) if (c.enabled) await enqueueJob(ctx, row, c.connectorId);
  await updateEvent(ctx, row, row.state); return row;
}
/** Trusted retirement does not depend on a revoked work grant. */
export async function retireGraphSource(ctx: ProjectionCtx, scopeInput: Scope, sourceId: string,
  walk: RetirementWalk = { visited: new Set(), remaining: 16 }): Promise<Source | null> {
  const s = exactScope(scopeInput); const key = retirementKey(s, sourceId);
  if (walk.visited.has(key)) return null;
  walk.visited.add(key); walk.remaining--;
  const old = await intent(ctx, s, sourceId);
  // The retained immutable intent has all identity fields needed for a
  // tombstone; cleanup does not reload a potentially large source body.
  const value = old ? await writeIntent(ctx, s, { lineage: { sourceId: old.sourceId, sourceEventId: old.sourceEventId,
    sourceRevision: old.sourceRevision },
    contentHash: old.contentHash, ownerPrincipalId: old.ownerPrincipalId,
    ...(old.conversationId ? { transcriptOrigin: { conversationId: old.conversationId } } : {}) }, undefined, old.profile, "tombstone", []) : null;
  await walkDependents(ctx, s, sourceId, walk);
  return value;
}
async function scheduleRetirement(ctx: ProjectionCtx, scopeInput: Scope, name: "retireQueuedSource" | "retireDependents" | "reconcileScoped", args: Record<string, unknown>) {
  const s = exactScope(scopeInput);
  if (!ctx.scheduler) dataDenied("GRAPH_STATE_INVALID");
  const counter = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).unique();
  if (!counter) dataDenied("GRAPH_STATE_INVALID");
  await ctx.db.patch("runtimeGraphScopes", counter._id, { pendingRetirements: (counter.pendingRetirements ?? 0) + 1, profileThrough: {} });
  await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">(`runtimeGraph:${name}`), { ...s, ...args });
}
async function walkDependents(ctx: ProjectionCtx, s: Scope, sourceId: string, walk: RetirementWalk, after?: string) {
  // Imported retirement can recurse in one parent transaction. Convex permits
  // only one paginate call, so these indexed scans use immutable identity keys.
  const rows = await ctx.db.query("runtimeGraphDependencies").withIndex("by_upstream", q => {
    const prefix = q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", sourceId);
    return after === undefined ? prefix : prefix.gt("dependentSourceId", after);
  }).take(33);
  const page = rows.slice(0, 32);
  for (const edge of page) {
    if (walk.visited.has(retirementKey(s, edge.dependentSourceId))) continue;
    const current = await intent(ctx, s, edge.dependentSourceId);
    if (!current || current.operation === "replace" && current.revision !== edge.dependentRevision) continue;
    if (walk.remaining > 0) {
      // A replacement may already have repaired its witnesses, or retain a
      // different valid grant. Cleanup must recheck that exact generation.
      if (await dependencyIsCurrent(ctx, current)) { walk.remaining--; continue; }
      await retireGraphSource(ctx, s, edge.dependentSourceId, walk);
    } else await scheduleRetirement(ctx, s, "retireQueuedSource", { sourceId: edge.dependentSourceId, expectedRevision: current.revision, force: false });
  }
  if (rows.length > page.length) await scheduleRetirement(ctx, s, "retireDependents", { sourceId, after: page[page.length - 1].dependentSourceId });
}
async function dependencyIsCurrent(ctx: ProjectionCtx, value: Source) {
  if (value.operation !== "replace" || !value.authorityReference) return false;
  try {
    const source = await currentSource(ctx, value.authorityReference, value.sourceId, "write");
    return source.lineage.sourceEventId === value.sourceEventId && source.lineage.sourceRevision === value.sourceRevision && source.contentHash === value.contentHash;
  } catch (error) { if (!knownCurrentnessDenial(error)) throw error; return false; }
}
async function finishRetirement(ctx: MutationCtx, s: Scope) {
  const counter = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).unique();
  if (!counter || (counter.pendingRetirements ?? 0) < 1) dataDenied("GRAPH_STATE_INVALID");
  await ctx.db.patch("runtimeGraphScopes", counter._id, { pendingRetirements: counter.pendingRetirements! - 1 });
}
export const retireQueuedSource = internalMutation({ args: { ...selectors, sourceId: v.string(), expectedRevision: v.number(), force: v.boolean() }, handler: async (ctx, args) => {
  const current = await intent(ctx, args, args.sourceId);
  if (current?.revision === args.expectedRevision && (args.force || !await dependencyIsCurrent(ctx, current))) await retireGraphSource(ctx, args, args.sourceId);
  await finishRetirement(ctx, args); return null;
} });
export const retireDependents = internalMutation({ args: { ...selectors, sourceId: v.string(), after: v.string() }, handler: async (ctx, args) => {
  await walkDependents(ctx, args, args.sourceId, { visited: new Set([retirementKey(args, args.sourceId)]), remaining: 16 }, args.after);
  await finishRetirement(ctx, args); return null;
} });
/** Trusted share/expiry parent: reconcile captured evidence permissions without
 * granting the caller access to another producer's source or remote data. */
export const reconcileScoped = internalMutation({ args: { ...selectors, after: v.optional(v.string()), continuation: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const s = exactScope(args); const walk: RetirementWalk = { visited: new Set(), remaining: 16 };
  const rows = await ctx.db.query("runtimeGraphSources").withIndex("by_source", q => {
    const prefix = q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId);
    return args.after === undefined ? prefix : prefix.gt("sourceId", args.after);
  }).take(17);
  const page = rows.slice(0, 16);
  for (const value of page) {
    if (value.operation !== "replace" || walk.visited.has(retirementKey(s, value.sourceId))) continue;
    if (walk.remaining === 0) await scheduleRetirement(ctx, s, "retireQueuedSource", { sourceId: value.sourceId, expectedRevision: value.revision, force: false });
    else if (await dependencyIsCurrent(ctx, value)) walk.remaining--;
    else await retireGraphSource(ctx, s, value.sourceId, walk);
  }
  if (rows.length > page.length) await scheduleRetirement(ctx, s, "reconcileScoped", { after: page[page.length - 1].sourceId, continuation: true });
  if (args.continuation) await finishRetirement(ctx, s);
  return null;
} });
export const enqueue = internalMutation({ args: { reference: runtimeAuthorityReference, sourceIds: v.array(v.string()), profile: v.optional(embeddingProfile) }, handler: async (ctx, args) => {
  if (args.sourceIds.length > 100) dataDenied("INVALID_INPUT");
  for (const sourceId of new Set(args.sourceIds)) await enqueueSourceProjection(ctx, args.reference, sourceId, args.profile);
  return null;
} });
export async function projectChangedSources(ctx: MutationCtx, reference: RuntimeAuthorityReference, sourceIds: readonly string[]) {
  for (const sourceId of new Set(sourceIds)) {
    try { await enqueueFactProjection(ctx, reference, sourceId); }
    catch (error) { if (!knownCurrentnessDenial(error)) throw error; await retireGraphSource(ctx, scope(reference), sourceId); }
  }
}
export const retireSource = internalMutation({ args: { ...selectors, sourceId: v.string() }, handler: async (ctx, args) => { await retireGraphSource(ctx, args, args.sourceId); return null; } });
type RetirementCursor = Scope & { sourceId: string };
type AuthorityRetirement = Partial<Scope> & { grantId?: string; principalId?: string; membershipId?: string; sourceId?: string; conversationId?: string; after?: RetirementCursor };
/** Each authority index ends in the unique scope/source tuple. A continuation
 * reads its same-space tail, later spaces, then later tenants, without rescans
 * or an opaque paginated query in the caller's parent transaction. */
async function authorityRetirementPage(ctx: MutationCtx, args: AuthorityRetirement): Promise<Source[]> {
  const after = args.after;
  const specific = args.tenantId && (args.sourceId || args.memorySpaceId);
  const ranges: ("initial" | "source" | "space" | "tenant")[] = !after ? ["initial"]
    : specific ? args.sourceId ? ["space"] : ["source"]
    : args.tenantId && !args.grantId && !args.principalId && !args.membershipId ? ["source", "space"] : ["source", "space", "tenant"];
  const rows: Source[] = [];
  for (const range of ranges) {
    const selected = args.tenantId && args.sourceId ? ctx.db.query("runtimeGraphSources").withIndex("by_tenant_source", q => {
      const prefix = q.eq("tenantId", args.tenantId!).eq("sourceId", args.sourceId!);
      return range === "initial" ? prefix : prefix.gt("memorySpaceId", after!.memorySpaceId);
    }) : args.tenantId && args.memorySpaceId && args.conversationId ? ctx.db.query("runtimeGraphSources").withIndex("by_conversation", q => {
      const prefix = q.eq("tenantId", args.tenantId!).eq("memorySpaceId", args.memorySpaceId!).eq("conversationId", args.conversationId!);
      return range === "initial" ? prefix : prefix.gt("sourceId", after!.sourceId);
    }) : args.tenantId && args.memorySpaceId ? ctx.db.query("runtimeGraphSources").withIndex("by_source", q => {
      const prefix = q.eq("tenantId", args.tenantId!).eq("memorySpaceId", args.memorySpaceId!);
      return range === "initial" ? prefix : prefix.gt("sourceId", after!.sourceId);
    }) : args.grantId ? ctx.db.query("runtimeGraphSources").withIndex("by_grant", q => {
      const prefix = q.eq("authorityReference.grantId", args.grantId!);
      if (range === "initial") return prefix;
      if (range === "source") return prefix.eq("tenantId", after!.tenantId).eq("memorySpaceId", after!.memorySpaceId).gt("sourceId", after!.sourceId);
      if (range === "space") return prefix.eq("tenantId", after!.tenantId).gt("memorySpaceId", after!.memorySpaceId);
      return prefix.gt("tenantId", after!.tenantId);
    }) : args.principalId ? ctx.db.query("runtimeGraphSources").withIndex("by_principal", q => {
      const prefix = q.eq("authorityReference.principalId", args.principalId!);
      if (range === "initial") return prefix;
      if (range === "source") return prefix.eq("tenantId", after!.tenantId).eq("memorySpaceId", after!.memorySpaceId).gt("sourceId", after!.sourceId);
      if (range === "space") return prefix.eq("tenantId", after!.tenantId).gt("memorySpaceId", after!.memorySpaceId);
      return prefix.gt("tenantId", after!.tenantId);
    }) : args.membershipId ? ctx.db.query("runtimeGraphSources").withIndex("by_membership", q => {
      const prefix = q.eq("authorityReference.membershipId", args.membershipId!);
      if (range === "initial") return prefix;
      if (range === "source") return prefix.eq("tenantId", after!.tenantId).eq("memorySpaceId", after!.memorySpaceId).gt("sourceId", after!.sourceId);
      if (range === "space") return prefix.eq("tenantId", after!.tenantId).gt("memorySpaceId", after!.memorySpaceId);
      return prefix.gt("tenantId", after!.tenantId);
    }) : ctx.db.query("runtimeGraphSources").withIndex("by_source", q => {
      const prefix = q.eq("tenantId", args.tenantId!);
      if (range === "initial") return prefix;
      if (range === "source") return prefix.eq("memorySpaceId", after!.memorySpaceId).gt("sourceId", after!.sourceId);
      return prefix.gt("memorySpaceId", after!.memorySpaceId);
    });
    rows.push(...await selected.filter(q => q.and(...(args.grantId ? [q.eq(q.field("authorityReference.grantId"), args.grantId)] : []),
      ...(args.principalId ? [q.eq(q.field("authorityReference.principalId"), args.principalId)] : []),
      ...(args.membershipId ? [q.eq(q.field("authorityReference.membershipId"), args.membershipId)] : []),
      ...(args.tenantId ? [q.eq(q.field("tenantId"), args.tenantId)] : []), ...(args.memorySpaceId ? [q.eq(q.field("memorySpaceId"), args.memorySpaceId)] : []),
      ...(args.sourceId ? [q.eq(q.field("sourceId"), args.sourceId)] : []), ...(args.conversationId ? [q.eq(q.field("conversationId"), args.conversationId)] : []))).take(65 - rows.length));
    if (rows.length === 65) break;
  }
  return rows;
}
export const retireAuthority = internalMutation({ args: { grantId: v.optional(v.string()), principalId: v.optional(v.string()), membershipId: v.optional(v.string()),
  tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), sourceId: v.optional(v.string()), conversationId: v.optional(v.string()), after: v.optional(v.object({ ...selectors, sourceId: v.string() })) }, handler: async (ctx, args) => {
  if (!args.grantId && !args.principalId && !args.membershipId && !args.tenantId || args.memorySpaceId && !args.tenantId
    || (args.sourceId || args.conversationId) && !args.tenantId) dataDenied("INVALID_INPUT");
  const rows = await authorityRetirementPage(ctx, args); const page = rows.slice(0, 64);
  const walk: RetirementWalk = { visited: new Set(), remaining: 16 };
  for (const row of page) {
    if (walk.remaining > 0) await retireGraphSource(ctx, row, row.sourceId, walk);
    else if (!walk.visited.has(retirementKey(row, row.sourceId))) await scheduleRetirement(ctx, row, "retireQueuedSource", { sourceId: row.sourceId, expectedRevision: row.revision, force: true });
  }
  if (rows.length > page.length) {
    const last = page[page.length - 1];
    await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeGraph:retireAuthority"), { ...args, after: { ...exactScope(last), sourceId: last.sourceId } });
  }
  return null;
} });
export const configureConnector = internalMutation({ args: { ...selectors, connectorId: v.string(), workerPrincipalId: v.string(),
  workerTenantId: v.string(), workerMemorySpaceId: v.string(), enabled: v.boolean() }, handler: async (ctx, args) => {
  if (!args.connectorId.trim() || !args.workerPrincipalId.trim()) dataDenied("INVALID_INPUT");
  const old = await ctx.db.query("runtimeGraphConnectors").withIndex("by_connector", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("connectorId", args.connectorId)).unique();
  if (old) await ctx.db.patch("runtimeGraphConnectors", old._id, { workerPrincipalId: args.workerPrincipalId,
    workerTenantId: args.workerTenantId, workerMemorySpaceId: args.workerMemorySpaceId, enabled: args.enabled });
  else await ctx.db.insert("runtimeGraphConnectors", { ...args, createdAt: Date.now() });
  const sources = await ctx.db.query("runtimeGraphSources").withIndex("by_source", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).take(101);
  if (sources.length > 100) dataDenied("GRAPH_SCOPE_TOO_BROAD");
  for (const value of sources) if (args.enabled) { await enqueueJob(ctx, value, args.connectorId); await ctx.db.patch("runtimeGraphSources", value._id, { state: "pending" }); await updateEvent(ctx, value, "pending"); }
  for (const value of sources) await aggregate(ctx, value);
  const counter = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).unique();
  if (counter) await ctx.db.patch("runtimeGraphScopes", counter._id, { profileThrough: {} });
  return null;
} });
async function requireJob(ctx: ReadCtx, lease: GraphProjectionLeaseV1, allowComplete = false) {
  positive(lease.leaseVersion);
  const row = await ctx.db.query("runtimeGraphOutbox").withIndex("by_job", q => q.eq("tenantId", lease.tenantId)
    .eq("memorySpaceId", lease.memorySpaceId).eq("connectorId", lease.connectorId).eq("jobId", lease.jobId)).unique();
  if (!row || row.workerId !== lease.workerId || row.leaseVersion !== lease.leaseVersion
    || !allowComplete && (row.state !== "running" || (row.leaseExpiresAt ?? 0) <= Date.now())) dataDenied("GRAPH_LEASE_EXPIRED");
  const value = await intent(ctx, row, row.sourceId);
  if (!value || value.revision !== row.revision || value.payloadHash !== row.payloadHash) dataDenied("STALE_GRAPH_WORK");
  const payload = await payloadFor(ctx, row, row.revision);
  if (value.operation === "replace") {
    if (!value.authorityReference) dataDenied("GRAPH_STATE_INVALID");
    const source = await currentSource(ctx, value.authorityReference, value.sourceId, "write");
    if (!source || source.lineage.sourceEventId !== value.sourceEventId || source.lineage.sourceRevision !== value.sourceRevision
      || source.contentHash !== value.contentHash) dataDenied("STALE_SOURCE");
    const currentProfile = await selectedProfile(ctx, value.authorityReference);
    if (canonicalModelJson(currentProfile) !== canonicalModelJson(value.profile)) dataDenied("PROFILE_NOT_READY");
  }
  const tenant = await createAuthorityReader(ctx).getScope(row.tenantId); const space = await createAuthorityReader(ctx).getScope(row.tenantId, row.memorySpaceId);
  if (!tenant || !space || tenant.epoch !== payload.scope.tenantEpoch || space.epoch !== payload.scope.memorySpaceEpoch) dataDenied("STALE_GRAPH_WORK");
  return { row, value, payload };
}
function work(row: Job, payload: GraphProjectionPayloadV1): GraphProjectionWorkV1 {
  return { version: 1, tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, connectorId: row.connectorId, jobId: row.jobId,
    workerId: row.workerId!, leaseVersion: row.leaseVersion, leaseExpiresAt: row.leaseExpiresAt!, payload, payloadHash: row.payloadHash };
}
export const claim = mutation({ args: { ...selectors, connectorId: v.string(), workerId: v.string(), leaseMs: v.optional(v.number()) }, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId); const duration = args.leaseMs ?? GRAPH_PROJECTION_LIMITS.leaseMs;
  if (!args.workerId.trim() || !Number.isSafeInteger(duration) || duration < 100 || duration > GRAPH_PROJECTION_LIMITS.leaseMs) dataDenied("INVALID_INPUT");
  // Earliest expired and pending heads: completed history never grows claim cost.
  const running = await ctx.db.query("runtimeGraphOutbox").withIndex("by_queue", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("connectorId", args.connectorId).eq("state", "running")).first();
  if (running && (running.leaseExpiresAt ?? 0) <= Date.now()) {
    await ctx.db.patch("runtimeGraphOutbox", running._id, { state: running.attempt >= GRAPH_PROJECTION_LIMITS.maximumAttempts ? "dead_letter" : "pending", failureCode: "GRAPH_WRITE_UNKNOWN", retryAt: Date.now(), updatedAt: Date.now() });
    const value = await intent(ctx, running, running.sourceId); if (value?.revision === running.revision) await aggregate(ctx, value);
  }
  const row = await ctx.db.query("runtimeGraphOutbox").withIndex("by_queue", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("connectorId", args.connectorId).eq("state", "pending")).first();
  if (!row || row.retryAt > Date.now()) return null;
  const owned = { ...row, state: "running" as const, workerId: args.workerId, attempt: row.attempt + 1, leaseVersion: row.leaseVersion + 1, leaseExpiresAt: Date.now() + duration };
  await ctx.db.patch("runtimeGraphOutbox", row._id, { state: owned.state, workerId: owned.workerId, attempt: owned.attempt, leaseVersion: owned.leaseVersion, leaseExpiresAt: owned.leaseExpiresAt, updatedAt: Date.now() });
  try { return work(owned, (await requireJob(ctx, owned)).payload); }
  catch (error) {
    if (!knownCurrentnessDenial(error)) throw error;
    await retireGraphSource(ctx, row, row.sourceId); return null;
  }
} });
// Convex query results can outlive time-only lease/grant/share expiry. Each
// pre-effect RPC requires a fresh transaction while retaining read-only logic.
export const current = mutation({ args: graphLease, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId); const held = await requireJob(ctx, args); return work(held.row, held.payload);
} });
async function aggregate(ctx: MutationCtx, value: Source) {
  const connectors = await ctx.db.query("runtimeGraphConnectors").withIndex("by_scope", q => q.eq("tenantId", value.tenantId).eq("memorySpaceId", value.memorySpaceId)).take(3);
  const states = await Promise.all(connectors.filter(c => c.enabled).map(async c => {
    const job = await ctx.db.query("runtimeGraphOutbox").withIndex("by_source", q => q.eq("tenantId", value.tenantId)
      .eq("memorySpaceId", value.memorySpaceId).eq("sourceId", value.sourceId).eq("connectorId", c.connectorId)).order("desc").first();
    return job?.revision === value.revision ? job.state : "pending";
  }));
  const state = value.failureCode ? "dead_letter" as const : states.length && states.every(s => s === "complete") ? "complete" as const : states.includes("dead_letter") ? "dead_letter" as const : "pending" as const;
  await ctx.db.patch("runtimeGraphSources", value._id, { state, updatedAt: Date.now() }); await updateEvent(ctx, value, state);
  const revision = await ctx.db.query("runtimeGraphRevisions").withIndex("by_scope_revision", q => q.eq("tenantId", value.tenantId).eq("memorySpaceId", value.memorySpaceId).eq("revision", value.revision)).unique();
  if (revision) await ctx.db.patch("runtimeGraphRevisions", revision._id, { state: state === "dead_letter" ? "failed" : state });
}
export const complete = mutation({ args: { ...graphLease, receipt: graphReceipt }, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId); const existing = await ctx.db.query("runtimeGraphReceipts").withIndex("by_job", q => q.eq("tenantId", args.tenantId)
    .eq("memorySpaceId", args.memorySpaceId).eq("connectorId", args.connectorId).eq("jobId", args.jobId)).unique();
  const canonical = canonicalModelJson(args.receipt); const held = await requireJob(ctx, args, Boolean(existing));
  if (existing) { if (existing.receiptCanonical !== canonical) dataDenied("IDEMPOTENCY_CONFLICT"); return { version: 1, state: "complete" as const, duplicate: true }; }
  const expected = { version: 1, connectorId: args.connectorId, jobId: args.jobId, payloadHash: held.row.payloadHash,
    tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, sourceId: held.row.sourceId,
    tenantEpoch: held.payload.scope.tenantEpoch, memorySpaceEpoch: held.payload.scope.memorySpaceEpoch, revision: held.row.revision };
  const { state, currentRevision, ...identity } = args.receipt;
  if (canonicalModelJson(identity) !== canonicalModelJson(expected) || state === "stale" || currentRevision !== held.row.revision) dataDenied("INVALID_GRAPH_RECEIPT");
  await ctx.db.insert("runtimeGraphReceipts", { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, connectorId: args.connectorId,
    jobId: args.jobId, receiptCanonical: canonical, payloadHash: held.row.payloadHash, revision: held.row.revision, createdAt: Date.now() });
  await ctx.db.patch("runtimeGraphOutbox", held.row._id, { state: "complete", updatedAt: Date.now() }); await aggregate(ctx, held.value);
  await refreshGraphScope(ctx, held.row);
  return { version: 1, state: "complete" as const, duplicate: false };
} });
export const fail = mutation({ args: { ...graphLease, outcome: v.union(v.literal("failed"), v.literal("unknown")) }, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId); const held = await requireJob(ctx, args);
  const exhausted = held.row.attempt >= GRAPH_PROJECTION_LIMITS.maximumAttempts;
  await ctx.db.patch("runtimeGraphOutbox", held.row._id, { state: exhausted ? "dead_letter" : "pending",
    failureCode: args.outcome === "unknown" ? "GRAPH_WRITE_UNKNOWN" : "GRAPH_WRITE_FAILED", retryAt: Date.now() + Math.min(5000, 100 * 2 ** held.row.attempt), updatedAt: Date.now() });
  await aggregate(ctx, held.value); return { version: 1, state: exhausted ? "dead_letter" : "pending" };
} });
export async function readGraphProgress(ctx: ReadCtx, reference: RuntimeAuthorityReference, cutoff: number, through = 0, profile?: EmbeddingProfile) {
  const s = scope(reference); await recheckAuthority(ctx, reference, { ...s, capability: "read" });
  return graphProgress(ctx, s, cutoff, through, profile);
}
async function graphProgress(ctx: Pick<QueryCtx, "db">, s: Scope, cutoff: number, through = 0, profile?: EmbeddingProfile) {
  const connectors = await ctx.db.query("runtimeGraphConnectors").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).take(3);
  if (!connectors.some(c => c.enabled)) return { available: false as const };
  const counter = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).unique();
  if ((counter?.pendingRetirements ?? 0) > 0) return { available: true as const, cutoff, indexedThrough: through,
    complete: false, hole: { sequence: Math.min(through + 1, cutoff), state: "pending" as const } };
  const revisions = await ctx.db.query("runtimeGraphRevisions").withIndex("by_scope_revision", q => q.eq("tenantId", s.tenantId)
    .eq("memorySpaceId", s.memorySpaceId).gt("revision", through).lte("revision", cutoff)).take(256);
  const result = contiguousWatermark(revisions.map(row => ({ sequence: row.revision,
    state: row.state === "skipped" ? "skipped" as const : profile && row.profileId !== profile.profileId ? "pending" as const : row.state })), cutoff, through);
  return { available: true as const, ...result };
}
async function refreshGraphScope(ctx: MutationCtx, scopeInput: Scope) {
  const s = exactScope(scopeInput);
  const row = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId)).unique();
  if (!row) return null;
  const results = await Promise.all(SUPPORTED_EMBEDDING_PROFILES.map(async profile => ({ profile, result: await graphProgress(ctx, s, row.sequence, row.profileThrough?.[profile.profileId] ?? 0, profile) })));
  const profileThrough = Object.fromEntries(results.map(({ profile, result }) => [profile.profileId, result.available ? result.indexedThrough : 0]));
  await ctx.db.patch("runtimeGraphScopes", row._id, { profileThrough, updatedAt: Date.now() });
  if (results.some(({ profile, result }) => result.available && result.hole?.state === "missing" && result.indexedThrough > (row.profileThrough?.[profile.profileId] ?? 0))) {
    await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeGraph:refreshScoped"), s);
  }
  return null;
}
export async function refreshGraphWatermarks(ctx: MutationCtx, reference: RuntimeAuthorityReference) {
  await recheckAuthority(ctx, reference, { ...scope(reference), capability: "read" });
  return refreshGraphScope(ctx, scope(reference));
}
export const refreshScoped = internalMutation({ args: selectors, handler: async (ctx, args) => refreshGraphScope(ctx, args) });
export const status = mutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), sourceId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor);
  if (args.sourceId) {
    await currentSource(ctx, reference, args.sourceId, "read"); const row = await intent(ctx, scope(reference), args.sourceId);
    const selected = await selectedProfile(ctx, reference, "embedding.query");
    const profileReady = Boolean(row && canonicalModelJson(row.profile) === canonicalModelJson(selected));
    return { version: 1, state: profileReady ? row!.state : "pending", revision: row?.revision ?? 0,
      profileId: row?.profile.profileId ?? null, selectedProfileId: selected.profileId,
      ...(!profileReady ? { failureCode: "PROFILE_NOT_READY" } : row?.failureCode ? { failureCode: row.failureCode } : {}) };
  }
  if (actor.resourceAccess === "own") dataDenied();
  const graph = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId)).unique();
  const selected = await selectedProfile(ctx, reference, "embedding.query");
  return { version: 1, cutoff: graph?.sequence ?? 0, progress: await readGraphProgress(ctx, reference, graph?.sequence ?? 0, graph?.profileThrough?.[selected.profileId] ?? 0, selected) };
} });
async function currentRead(ctx: ReadCtx, row: Doc<"runtimeGraphReads">) {
  const source = await currentSource(ctx, row.authorityReference, row.sourceId, "read");
  const value = await intent(ctx, row, row.sourceId);
  const profile = await selectedProfile(ctx, row.authorityReference, "embedding.query");
  if (source.lineage.sourceRevision !== row.sourceRevision || source.contentHash !== row.contentHash || !value
    || value.state !== "complete" || value.operation !== "replace" || value.revision !== row.graphRevision
    || canonicalModelJson(profile) !== canonicalModelJson(row.profile) || canonicalModelJson(value.profile) !== canonicalModelJson(profile)) dataDenied("GRAPH_NOT_READY");
  return { value, payload: await payloadFor(ctx, row, value.revision) };
}
export const requestExpansion = mutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()),
  sourceId: v.string(), connectorId: v.string(), requestId: v.string(), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor); const s = scope(reference);
  await connector(ctx, s, args.connectorId); const source = await currentSource(ctx, reference, args.sourceId, "read");
  const profile = await selectedProfile(ctx, reference, "embedding.query"); const value = await intent(ctx, s, args.sourceId);
  const limit = args.limit ?? 10;
  if (!args.requestId.trim() || args.requestId.length > 128 || !Number.isSafeInteger(limit) || limit < 1 || limit > GRAPH_PROJECTION_LIMITS.maximumExpansion) dataDenied("INVALID_INPUT");
  if (!value || value.operation !== "replace" || value.state !== "complete" || canonicalModelJson(value.profile) !== canonicalModelJson(profile)) dataDenied("GRAPH_NOT_READY");
  const existing = await ctx.db.query("runtimeGraphReads").withIndex("by_request", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("requestId", args.requestId)).unique();
  if (existing) {
    if (existing.authorityReference.principalId !== actor.principalId || existing.sourceId !== args.sourceId || existing.limit !== limit
      || existing.connectorId !== args.connectorId || existing.graphRevision !== value.revision || canonicalModelJson(existing.profile) !== canonicalModelJson(profile)) dataDenied("IDEMPOTENCY_CONFLICT");
    return { version: 1, requestId: existing.requestId, state: existing.state };
  }
  await ctx.db.insert("runtimeGraphReads", { ...s, requestId: args.requestId, sourceId: args.sourceId, profile,
    sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash, graphRevision: value.revision,
    connectorId: args.connectorId, authorityReference: reference, limit, state: "pending", leaseVersion: 0, createdAt: Date.now() });
  return { version: 1, requestId: args.requestId, state: "pending" as const };
} });
export const claimExpansion = mutation({ args: { ...selectors, connectorId: v.string(), workerId: v.string() }, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId);
  const expired = await ctx.db.query("runtimeGraphReads").withIndex("by_queue", q => q.eq("tenantId", args.tenantId)
    .eq("memorySpaceId", args.memorySpaceId).eq("connectorId", args.connectorId).eq("state", "running")).first();
  if (expired && (expired.leaseExpiresAt ?? 0) <= Date.now()) await ctx.db.patch("runtimeGraphReads", expired._id, { state: "failed" });
  const row = await ctx.db.query("runtimeGraphReads").withIndex("by_queue", q => q.eq("tenantId", args.tenantId)
    .eq("memorySpaceId", args.memorySpaceId).eq("connectorId", args.connectorId).eq("state", "pending")).first();
  if (!row) return null;
  try {
    const held = await currentRead(ctx, row); const leaseVersion = row.leaseVersion + 1; const leaseExpiresAt = Date.now() + GRAPH_PROJECTION_LIMITS.leaseMs;
    await ctx.db.patch("runtimeGraphReads", row._id, { state: "running", workerId: args.workerId, leaseVersion, leaseExpiresAt });
    const result: GraphExpansionWorkV1 = { version: 1, tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, connectorId: row.connectorId,
      jobId: row.requestId, workerId: args.workerId, leaseVersion, leaseExpiresAt, scope: held.payload.scope,
      sourceId: row.sourceId, profileId: row.profile.profileId, revision: row.graphRevision, limit: row.limit };
    return result;
  } catch (error) { if (!knownCurrentnessDenial(error) && !(error instanceof ConvexError && typeof error.data === "object" && error.data?.code === "GRAPH_NOT_READY")) throw error;
    await ctx.db.patch("runtimeGraphReads", row._id, { state: "failed" }); return null; }
} });
async function expansionLease(ctx: ReadCtx, args: GraphProjectionLeaseV1) {
  const row = await ctx.db.query("runtimeGraphReads").withIndex("by_request", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("requestId", args.jobId)).unique();
  if (!row || row.connectorId !== args.connectorId || row.workerId !== args.workerId || row.leaseVersion !== args.leaseVersion
    || row.state !== "running" || (row.leaseExpiresAt ?? 0) <= Date.now()) dataDenied("GRAPH_LEASE_EXPIRED");
  await currentRead(ctx, row); return row;
}
export const currentExpansion = mutation({ args: graphLease, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId); await expansionLease(ctx, args); return { version: 1, current: true };
} });
export const completeExpansion = mutation({ args: { ...graphLease, result: v.object({ version: v.literal(1), scope: v.object({ ...selectors,
  tenantEpoch: v.number(), memorySpaceEpoch: v.number() }), sourceId: v.string(), profileId: v.string(), revision: v.number(), factIds: v.array(v.string()) }) }, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId); const row = await expansionLease(ctx, args); const held = await currentRead(ctx, row);
  const { factIds, ...identity } = args.result;
  if (canonicalModelJson(identity) !== canonicalModelJson({ version: 1, scope: held.payload.scope, sourceId: row.sourceId,
    profileId: row.profile.profileId, revision: row.graphRevision }) || factIds.length > row.limit || new Set(factIds).size !== factIds.length) dataDenied("INVALID_GRAPH_RECEIPT");
  await ctx.db.patch("runtimeGraphReads", row._id, { state: "complete", factIds }); return { version: 1, complete: true };
} });
export const failExpansion = mutation({ args: graphLease, handler: async (ctx, args) => {
  await worker(ctx, args, args.connectorId); const row = await expansionLease(ctx, args); await ctx.db.patch("runtimeGraphReads", row._id, { state: "failed" }); return null;
} });
export const expansion = mutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), requestId: v.string() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor);
  const row = await ctx.db.query("runtimeGraphReads").withIndex("by_request", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("requestId", args.requestId)).unique();
  if (!row || row.authorityReference.principalId !== actor.principalId) dataDenied();
  await currentSource(ctx, reference, row.sourceId, "read"); await currentRead(ctx, row);
  const facts = [];
  for (const id of row.factIds ?? []) {
    try {
      const fact = await getScopedFact(ctx, actor, id, "read");
      if (!fact?.lineage || fact.supersededBy || fact.tombstonedAt !== undefined || fact.validUntil !== undefined && fact.validUntil <= Date.now()) continue;
      const represented = await intent(ctx, scope(reference), fact.lineage.sourceId);
      if (!represented || represented.state !== "complete" || represented.operation !== "replace" || represented.sourceRevision !== fact.lineage.sourceRevision
        || represented.sourceEventId !== fact.lineage.sourceEventId || canonicalModelJson(represented.profile) !== canonicalModelJson(row.profile)) continue;
      facts.push({ factId: fact.factId, revision: fact.version, text: fact.fact });
    } catch (error) {
      if (!knownCurrentnessDenial(error)) throw error;
      await recheckAuthority(ctx, reference, { ...scope(reference), capability: "read" });
    }
  }
  return { version: 1, state: row.state, profileId: row.profile.profileId, facts };
} });
