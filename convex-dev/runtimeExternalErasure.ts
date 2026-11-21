/** Trusted policy cleanup. The first mutation closes all delivery before bounded physical erasure. */
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, TableNames } from "./_generated/dataModel";
import { identifier } from "../src/client-runtime/validation";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { dataDenied } from "./runtimeDataAuth";
import { externalHead, releaseExternalAssetReferences } from "./runtimeExternalSources";
import { invalidateChangeStreams } from "./runtimeChangesStore";
import { retireScopedSourceEvents } from "./runtimeIngestion";
import { eraseModelPayloads, eraseSourceConsumer } from "./runtimeSourceConsumerErasure";

type Scope = { tenantId: string; memorySpaceId: string; sourceId: string };
type Authority = { principalId?: string; tenantId?: string; memorySpaceId?: string };
const scopeArgs = { tenantId: v.string(), memorySpaceId: v.string(), sourceId: v.string() };
const authorityArgs = { principalId: v.optional(v.string()), tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
const BATCH = 8;
const phases = ["observations", "versions", "chunks", "vectors", "generations", "receipts", "ingestion", "model_payloads", "events", "owner_cursors", "scope_cursors", "source", "complete"] as const;
function normalized(scope: Scope) { try { for (const value of Object.values(scope)) identifier(value, 512); } catch { dataDenied("INVALID_INPUT"); } return scope; }
async function eraseJob(ctx: MutationCtx, scope: Scope) { return ctx.db.query("runtimeExternalErasureJobs").withIndex("by_source", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("sourceId", scope.sourceId)).unique(); }
// Issued Workflow/storage work and bounded native cleanup may need an owning
// callback before advancing. Avoid an unbounded zero-delay polling loop.
async function scheduleSource(ctx: MutationCtx, scope: Scope) { await ctx.scheduler.runAfter(1000, makeFunctionReference<"mutation">("runtimeExternalErasure:continueSource"), scope); }

export async function eraseExternalSource(ctx: MutationCtx, args: Scope) {
  const scope = normalized(args), prior = await eraseJob(ctx, scope);
  if (prior) { if (!prior.complete) await scheduleSource(ctx, scope); return { found: true, complete: prior.complete }; }
  const head = await externalHead(ctx, scope, scope.sourceId); if (!head) return { found: false, complete: true };
  const now = Date.now();
  const fence = await ctx.db.query("runtimeExternalErasureFences").withIndex("by_source", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("sourceId", scope.sourceId)).unique();
  if (!fence) await ctx.db.insert("runtimeExternalErasureFences", { ...scope, ownerPrincipalId: head.ownerPrincipalId, erasedAt: now });
  await ctx.db.patch("runtimeExternalSources", head._id, { erasedAt: now });
  const tombstone = await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("resourceType", "source").eq("resourceId", scope.sourceId)).first();
  if (!tombstone) await ctx.db.insert("runtimeAuthTombstones", { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, resourceType: "source", resourceId: scope.sourceId, deletedAt: now });
  await invalidateChangeStreams(ctx, scope, head.ownerPrincipalId);
  await retireScopedSourceEvents(ctx, scope, scope.sourceId, "tombstoned");
  await releaseExternalAssetReferences(ctx, scope);
  await ctx.db.insert("runtimeExternalErasureJobs", { ...scope, ownerPrincipalId: head.ownerPrincipalId, phase: phases[0], complete: false, createdAt: now, updatedAt: now });
  await scheduleSource(ctx, scope);
  return { found: true, complete: false };
}
export const eraseSource = internalMutation({ args: scopeArgs, handler: eraseExternalSource });

async function removeRows<T extends TableNames>(ctx: MutationCtx, table: T, rows: Doc<T>[]) {
  for (const row of rows.slice(0, BATCH)) await ctx.db.delete(table, row._id);
  return rows.length <= BATCH;
}
async function erasePhase(ctx: MutationCtx, job: Doc<"runtimeExternalErasureJobs">): Promise<boolean> {
  const s = { tenantId: job.tenantId, memorySpaceId: job.memorySpaceId, sourceId: job.sourceId };
  switch (job.phase) {
    case "observations": return removeRows(ctx, "runtimeExternalObservations", await ctx.db.query("runtimeExternalObservations").withIndex("by_source_sequence", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", s.sourceId)).take(BATCH + 1));
    case "versions": return removeRows(ctx, "runtimeExternalVersions", await ctx.db.query("runtimeExternalVersions").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", s.sourceId)).take(BATCH + 1));
    case "chunks": return removeRows(ctx, "runtimeMemoryChunks", await ctx.db.query("runtimeMemoryChunks").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", s.sourceId)).take(BATCH + 1));
    case "vectors": return removeRows(ctx, "runtimeMemoryVectors", await ctx.db.query("runtimeMemoryVectors").withIndex("by_scope_source_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", s.sourceId)).take(BATCH + 1));
    case "generations": return removeRows(ctx, "runtimeMemoryVectorGenerations", await ctx.db.query("runtimeMemoryVectorGenerations").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", s.sourceId)).take(BATCH + 1));
    case "receipts": return removeRows(ctx, "runtimeMemoryReceipts", await ctx.db.query("runtimeMemoryReceipts").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("identity.sourceId", s.sourceId)).take(BATCH + 1));
    case "ingestion": {
      const event = await ctx.db.query("runtimeIngestionEvents").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("lineage.sourceId", s.sourceId)).first();
      if (!event) return true;
      const stages = await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("eventId", event.eventId)).take(4);
      const jobs = await ctx.db.query("runtimeIngestionJobs").withIndex("by_event", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("eventId", event.eventId)).take(2);
      if (stages.length > 3 || jobs.length > 1) dataDenied("ERASURE_CONFLICT");
      for (const row of stages) await ctx.db.delete("runtimeIngestionStages", row._id);
      for (const row of jobs) await ctx.db.delete("runtimeIngestionJobs", row._id);
      await ctx.db.delete("runtimeIngestionEvents", event._id); return false;
    }
    case "model_payloads": {
      // Financial liability records survive. Raw request/proof/result payloads do not.
      const operation = await ctx.db.query("runtimeModelOperations").withIndex("by_source_erasure", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("source.sourceId", s.sourceId).eq("sourceErasedAt", undefined)).first();
      if (!operation) return true;
      await eraseModelPayloads(ctx, operation._id);
      return false;
    }
    case "events": return removeRows(ctx, "runtimeChangeEvents", await ctx.db.query("runtimeChangeEvents").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", s.sourceId)).take(BATCH + 1));
    case "owner_cursors": return removeRows(ctx, "runtimeExternalReadCursors", await ctx.db.query("runtimeExternalReadCursors").withIndex("by_scope", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("principalId", job.ownerPrincipalId)).take(BATCH + 1));
    case "scope_cursors": return removeRows(ctx, "runtimeExternalReadCursors", await ctx.db.query("runtimeExternalReadCursors").withIndex("by_visibility", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("visibility", "scope")).take(BATCH + 1));
    case "source": {
      const source = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("lineage.sourceId", s.sourceId)).unique();
      if (source) { if (source.lineage.role !== "external" || source.ownerPrincipalId !== job.ownerPrincipalId) dataDenied("ERASURE_CONFLICT"); await ctx.db.delete("runtimeMemorySources", source._id); }
      const head = await externalHead(ctx, s, s.sourceId);
      if (head) { if (head.ownerPrincipalId !== job.ownerPrincipalId || head.erasedAt === undefined) dataDenied("ERASURE_CONFLICT"); await ctx.db.delete("runtimeExternalSources", head._id); }
      return true;
    }
    default: dataDenied("ERASURE_CONFLICT");
  }
}
export async function continueExternalSourceErasure(ctx: MutationCtx, args: Scope) {
  const scope = normalized(args), job = await eraseJob(ctx, scope);
  if (!job) dataDenied("ERASURE_JOB_NOT_FOUND");
  const assetEdges = await ctx.db.query("runtimeAssetReferences").withIndex("by_owner", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("kind", "source").eq("ownerId", scope.sourceId)).take(BATCH);
  if (assetEdges.length) {
    for (const edge of assetEdges) {
      await ctx.db.delete("runtimeAssetReferences", edge._id);
      const version = await ctx.db.query("runtimeAssetVersions").withIndex("by_version_id", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("versionId", edge.versionId)).unique();
      if (version && version.state !== "deleted") {
        await ctx.db.patch("runtimeAssetVersions", version._id, { cleanupAttempt: version.cleanupAttempt });
        await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:cleanupVersion"), { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, versionId: edge.versionId });
      }
    }
    await scheduleSource(ctx, scope); return { found: true, complete: false };
  }
  // Every invocation drains one bounded consumer step before source custody.
  // This also covers resumptions of pre-upgrade jobs at any existing phase.
  const edge = await ctx.db.query("runtimeSourceDependencies").withIndex("by_upstream_erasure", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("upstreamSourceId", scope.sourceId).eq("erasedAt", undefined)).first();
  if (edge) {
    if (await eraseSourceConsumer(ctx, scope, { kind: edge.targetKind, id: edge.targetId, revision: edge.targetRevision })) await ctx.db.patch("runtimeSourceDependencies", edge._id, { erasedAt: Date.now() });
    await scheduleSource(ctx, scope); return { found: true, complete: false };
  }
  if (job.complete) return { found: true, complete: true };
  if (!phases.includes(job.phase as typeof phases[number])) dataDenied("ERASURE_CONFLICT");
  const advanced = await erasePhase(ctx, job), phase = advanced ? phases[phases.indexOf(job.phase as typeof phases[number]) + 1] : job.phase;
  if (!phase) dataDenied("ERASURE_CONFLICT");
  const complete = phase === "complete"; await ctx.db.patch("runtimeExternalErasureJobs", job._id, { phase, complete, updatedAt: Date.now() });
  if (!complete) await scheduleSource(ctx, scope);
  return { found: true, complete };
}
export const continueSource = internalMutation({ args: scopeArgs, handler: continueExternalSourceErasure });

function authority(input: Authority): Authority {
  if (input.principalId !== undefined ? input.tenantId !== undefined || input.memorySpaceId !== undefined : input.tenantId === undefined) dataDenied("INVALID_INPUT");
  try { for (const value of Object.values(input)) if (value !== undefined) identifier(value, 512); } catch { dataDenied("INVALID_INPUT"); }
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
async function retired(ctx: MutationCtx, selected: Authority) {
  if (selected.principalId) {
    const id = ctx.db.normalizeId("runtimeAuthPrincipals", selected.principalId);
    const principal = id ? await ctx.db.get("runtimeAuthPrincipals", id) : null;
    if (!principal || principal.deletedAt === undefined && principal.revokedAt === undefined) dataDenied("ERASURE_SCOPE_NOT_RETIRED");
  } else {
    const row = await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", q => q.eq("tenantId", selected.tenantId!).eq("memorySpaceId", selected.memorySpaceId)).unique();
    if (!row || row.deletedAt === undefined) dataDenied("ERASURE_SCOPE_NOT_RETIRED");
  }
}
async function authorityBatch(ctx: MutationCtx, selected: Authority) {
  return selected.principalId ? ctx.db.query("runtimeExternalSources").withIndex("by_principal_erasure", q => q.eq("ownerPrincipalId", selected.principalId!).eq("erasedAt", undefined)).take(BATCH + 1)
    : selected.memorySpaceId ? ctx.db.query("runtimeExternalSources").withIndex("by_scope_erasure", q => q.eq("tenantId", selected.tenantId!).eq("memorySpaceId", selected.memorySpaceId!).eq("erasedAt", undefined)).take(BATCH + 1)
    : ctx.db.query("runtimeExternalSources").withIndex("by_tenant_erasure", q => q.eq("tenantId", selected.tenantId!).eq("erasedAt", undefined)).take(BATCH + 1);
}
export async function retireExternalAuthority(ctx: MutationCtx, args: Authority) {
  const selected = authority(args); await retired(ctx, selected);
  const jobId = `external-authority-erasure:${await semanticHash(canonicalModelJson(selected))}`;
  let job = await ctx.db.query("runtimeExternalAuthorityErasureJobs").withIndex("by_job", q => q.eq("jobId", jobId)).unique();
  if (!job) { const id = await ctx.db.insert("runtimeExternalAuthorityErasureJobs", { jobId, ...selected, complete: false, createdAt: Date.now(), updatedAt: Date.now() }); job = (await ctx.db.get("runtimeExternalAuthorityErasureJobs", id))!; }
  if (!job.complete) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeExternalErasure:continueAuthority"), { jobId });
  return { jobId, fencedComplete: job.complete };
}
export const retireAuthority = internalMutation({ args: authorityArgs, handler: retireExternalAuthority });
export const continueAuthority = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  try { identifier(args.jobId, 512); } catch { dataDenied("INVALID_INPUT"); }
  const job = await ctx.db.query("runtimeExternalAuthorityErasureJobs").withIndex("by_job", q => q.eq("jobId", args.jobId)).unique();
  if (!job) dataDenied("ERASURE_JOB_NOT_FOUND"); if (job.complete) return { fencedComplete: true };
  const selected = authority({ principalId: job.principalId, tenantId: job.tenantId, memorySpaceId: job.memorySpaceId }); await retired(ctx, selected);
  const rows = await authorityBatch(ctx, selected);
  for (const head of rows.slice(0, BATCH)) await eraseExternalSource(ctx, { tenantId: head.tenantId, memorySpaceId: head.memorySpaceId, sourceId: head.sourceId });
  const complete = rows.length <= BATCH; await ctx.db.patch("runtimeExternalAuthorityErasureJobs", job._id, { complete, updatedAt: Date.now() });
  if (!complete) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeExternalErasure:continueAuthority"), { jobId: job.jobId });
  return { fencedComplete: complete };
} });
