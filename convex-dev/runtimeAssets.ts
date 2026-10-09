import { deliveryExpiresAt } from "./runtimeDelivery";
/** Durable private asset jobs and immutable catalog commits. */
import { v } from "convex/values";
import type { AgentComponent } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { makeFunctionReference } from "convex/server";
import { mutation, internalMutation, internalAction } from "./_generated/server";
import type { MutationCtx, ActionCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { RuntimeAssetLineage, RuntimeAssetVersion } from "../src/domain/assets";
import { ASSET_MAX_BYTES, ASSET_UPLOAD_LEASE_MS, assetMediaKind, assertAssetSize, assetContentHash } from "../src/domain/assets";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { assetLineage } from "./runtimeAssetsSchema";
import { requireDataAuthority, dataAuthorityReference } from "./runtimeDataAuth";
import { createAuthorityReader, recheckAuthority } from "./runtimeAuth";
import { assetDenied, authorizeAsset, publicAsset, assetVersion, versionById, addAssetReference, releaseAssetReferences, reconcileAssetOwnerReferences } from "./runtimeAssetCatalog";
const scopeArgs = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
const metadataArgs = { requestId: v.string(), contentHash: v.string(), sizeBytes: v.number(), mimeType: v.string(), filename: v.optional(v.string()) };
type Job = Doc<"runtimeAssetJobs">;
export type AssetDeliveryWitness = { deliveryExpiresAt?: number };
/** Action time can advance after the final mutation's fixed-time snapshot. */
export function assertAssetActionDelivery(witness: AssetDeliveryWitness): void {
  if (!witness || typeof witness !== "object") assetDenied();
  const deadline = witness.deliveryExpiresAt;
  if (deadline !== undefined && (!Number.isFinite(deadline) || deadline > Number.MAX_SAFE_INTEGER || Date.now() >= deadline)) assetDenied();
}
async function assetDelivery(ctx: Pick<MutationCtx, "db">, reference: RuntimeAuthorityReference,
  value: Doc<"runtimeAssetVersions">, capability: "storage:read" | "storage:write"): Promise<AssetDeliveryWitness> {
  const deadlines: number[] = [];
  await authorizeAsset(ctx, reference, value, capability, new Set(), deadlines);
  const deadline = await deliveryExpiresAt(ctx, reference, deadlines, capability);
  return deadline === undefined ? {} : { deliveryExpiresAt: deadline };
}
function scope(reference: RuntimeAuthorityReference) { if (!reference.memorySpaceId) assetDenied(); return { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId }; }
function metadata(args: { sizeBytes: number; contentHash: string; mimeType: string; filename?: string }) {
  try { assertAssetSize(args.sizeBytes); assetMediaKind(args.mimeType); } catch (error) { assetDenied(error instanceof Error && error.message === "ASSET_TOO_LARGE" ? "ASSET_TOO_LARGE" : "INVALID_ASSET_METADATA"); }
  if (!/^[a-f0-9]{64}$/.test(args.contentHash) || args.filename !== undefined && (args.filename.length > 256 || /[\r\n\x00]/.test(args.filename))) assetDenied("INVALID_ASSET_METADATA");
}
async function jobRow(ctx: Pick<MutationCtx, "db">, jobId: string) { const row = await ctx.db.query("runtimeAssetJobs").withIndex("by_job", q => q.eq("jobId", jobId)).unique(); if (!row) assetDenied("ASSET_NOT_READY"); return row; }
async function currentGeneratedInputs(ctx: Pick<MutationCtx, "db">, reference: RuntimeAuthorityReference, lineage: RuntimeAssetLineage) {
  if (lineage.kind !== "generated") return;
  if (!lineage.operationId || lineage.operationId.length > 256 || !lineage.modelId || lineage.modelId.length > 256 || (lineage.sourceVersionIds?.length ?? 0) > 16) assetDenied("INVALID_ASSET_METADATA");
  for (const id of lineage.sourceVersionIds ?? []) {
    if (!id || id.length > 256) assetDenied("INVALID_ASSET_METADATA");
    const source = await versionById(ctx, scope(reference), id); if (!source) assetDenied();
    await authorizeAsset(ctx, reference, source);
  }
}
async function jobCurrent(ctx: Pick<MutationCtx, "db">, job: Job) {
  if (job.state !== "uploading" || Date.now() >= job.leaseExpiresAt) assetDenied("ASSET_UPLOAD_EXPIRED");
  await recheckAuthority(ctx, job.reference, { capability: "storage:write", ...scope(job.reference), resource: { ...scope(job.reference), resourceType: "storage", resourceId: job.assetId, ownerPrincipalId: job.ownerPrincipalId } });
  await currentGeneratedInputs(ctx, job.reference, job.lineage);
  const head = await ctx.db.query("runtimeAssets").withIndex("by_asset", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("assetId", job.assetId)).unique();
  if (!head || head.deletedAt !== undefined || head.latestVersion + 1 !== job.assetVersion) assetDenied("ASSET_UPLOAD_EXPIRED");
}
export async function beginAssetJob(ctx: MutationCtx, reference: RuntimeAuthorityReference, args: { requestId: string; contentHash: string; sizeBytes: number; mimeType: string; filename?: string; lineage: RuntimeAssetLineage; assetId?: string }) {
  metadata(args); if (!args.requestId || args.requestId.length > 256) assetDenied("INVALID_ASSET_METADATA");
  if (args.lineage.kind === "generated" && (!args.lineage.operationId || !args.lineage.modelId || (args.lineage.sourceVersionIds?.length ?? 0) > 16)) assetDenied("INVALID_ASSET_METADATA");
  const s = scope(reference); await recheckAuthority(ctx, reference, { capability: "storage:write", ...s });
  await currentGeneratedInputs(ctx, reference, args.lineage);
  const existing = await ctx.db.query("runtimeAssetJobs").withIndex("by_request", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("ownerPrincipalId", reference.principalId).eq("requestId", args.requestId)).unique();
  if (existing) {
    if (existing.contentHash !== args.contentHash || existing.sizeBytes !== args.sizeBytes || existing.mimeType !== args.mimeType || existing.filename !== args.filename || canonicalModelJson(existing.lineage) !== canonicalModelJson(args.lineage) || args.assetId !== undefined && args.assetId !== existing.assetId) assetDenied("ASSET_IDEMPOTENCY_CONFLICT");
    if (existing.state === "ready") { const value = await versionById(ctx, s, existing.versionId); if (!value) assetDenied(); await authorizeAsset(ctx, reference, value, "storage:write"); return { ready: publicAsset(value), jobId: existing.jobId, marker: existing.marker }; }
    assetDenied(existing.state === "uploading" ? "ASSET_UPLOAD_IN_PROGRESS" : "ASSET_UPLOAD_EXPIRED");
  }
  const jobId = `asset:${await semanticHash(canonicalModelJson([s, reference.principalId, args.requestId]))}`;
  const assetId = args.assetId ?? jobId;
  const head = await ctx.db.query("runtimeAssets").withIndex("by_asset", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("assetId", assetId)).unique();
  if (head && (head.deletedAt !== undefined || head.ownerPrincipalId !== reference.principalId)) assetDenied();
  if (await createAuthorityReader(ctx).hasTombstone({ ...s, resourceType: "storage", resourceId: assetId })) assetDenied();
  const assetVersion = (head?.latestVersion ?? 0) + 1; const versionId = `${assetId}:version:${assetVersion}`; const now = Date.now();
  if (!head) await ctx.db.insert("runtimeAssets", { ...s, assetId, ownerPrincipalId: reference.principalId, latestVersion: 0, createdAt: now });
  const marker = `application/vnd.cortex.asset-${crypto.randomUUID()}`;
  await ctx.db.insert("runtimeAssetJobs", { ...s, requestId: args.requestId, contentHash: args.contentHash, sizeBytes: args.sizeBytes, mimeType: args.mimeType, ...(args.filename !== undefined ? { filename: args.filename } : {}), lineage: args.lineage, jobId, assetId, assetVersion, versionId, ownerPrincipalId: reference.principalId, reference, marker, state: "uploading", createdAt: now, leaseExpiresAt: now + ASSET_UPLOAD_LEASE_MS });
  await ctx.scheduler.runAfter(ASSET_UPLOAD_LEASE_MS, makeFunctionReference<"mutation">("runtimeAssets:cleanupJob"), { jobId }); return { jobId, marker };
}
export const uploadAuthorization = internalMutation({ args: scopeArgs, handler: async (ctx, args) => dataAuthorityReference(await requireDataAuthority(ctx, args, "storage:write")) });
export const uploadCheckpoint = internalMutation({ args: { reference: runtimeAuthorityReference }, handler: async (ctx, args) => { await recheckAuthority(ctx, args.reference, { ...scope(args.reference), capability: "storage:write" }); return null; } });
export const beginUpload = internalMutation({ args: { ...scopeArgs, ...metadataArgs, assetId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "storage:write"); return beginAssetJob(ctx, dataAuthorityReference(actor), { requestId: args.requestId, contentHash: args.contentHash, sizeBytes: args.sizeBytes, mimeType: args.mimeType, ...(args.filename !== undefined ? { filename: args.filename } : {}), ...(args.assetId !== undefined ? { assetId: args.assetId } : {}), lineage: { kind: "upload", requestId: args.requestId } });
} });
export const beginGenerated = internalMutation({ args: { reference: runtimeAuthorityReference, ...metadataArgs, lineage: assetLineage }, handler: async (ctx, args) => { if (args.lineage.kind !== "generated") assetDenied("INVALID_ASSET_METADATA"); const { reference, ...input } = args; return beginAssetJob(ctx, reference, input); } });
export const stageStorage = internalMutation({ args: { jobId: v.string(), storageId: v.id("_storage") }, handler: async (ctx, args) => {
  const job = await jobRow(ctx, args.jobId); await jobCurrent(ctx, job); if (job.storageId && job.storageId !== args.storageId) assetDenied("ASSET_IDEMPOTENCY_CONFLICT");
  const stored = await ctx.storage.getMetadata(args.storageId); if (!stored || stored.contentType !== job.marker || stored.size !== job.sizeBytes || stored.sha256 !== job.contentHash) assetDenied("ASSET_INTEGRITY_FAILED");
  metadata(job); await ctx.db.patch("runtimeAssetJobs", job._id, { storageId: args.storageId }); return null;
} });
export const finalize = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await jobRow(ctx, args.jobId);
  if (job.state === "ready") { const value = await versionById(ctx, job, job.versionId); if (!value) assetDenied(); await authorizeAsset(ctx, job.reference, value, "storage:write"); return publicAsset(value); }
  await jobCurrent(ctx, job); if (!job.storageId) assetDenied("ASSET_NOT_READY");
  const stored = await ctx.storage.getMetadata(job.storageId); if (!stored || stored.size !== job.sizeBytes || stored.sha256 !== job.contentHash || stored.contentType !== job.marker) assetDenied("ASSET_INTEGRITY_FAILED"); metadata(job);
  const id = await ctx.db.insert("runtimeAssetVersions", { tenantId: job.tenantId, memorySpaceId: job.memorySpaceId, assetId: job.assetId, versionId: job.versionId, assetVersion: job.assetVersion, ownerPrincipalId: job.ownerPrincipalId, storageId: job.storageId, contentHash: job.contentHash, sizeBytes: job.sizeBytes, mimeType: job.mimeType, mediaKind: assetMediaKind(job.mimeType), ...(job.filename !== undefined ? { filename: job.filename } : {}), lineage: job.lineage, state: "ready", cleanupAttempt: 0, createdAt: Date.now() });
  const value = (await ctx.db.get("runtimeAssetVersions", id))!;
  const head = await ctx.db.query("runtimeAssets").withIndex("by_asset", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("assetId", job.assetId)).unique(); if (!head) assetDenied(); await ctx.db.patch("runtimeAssets", head._id, { latestVersion: job.assetVersion });
  await addAssetReference(ctx, value, { kind: "upload", ownerId: job.assetId, ownerVersion: String(job.assetVersion), ownerPrincipalId: job.ownerPrincipalId }); await ctx.db.patch("runtimeAssetJobs", job._id, { state: "ready" }); return publicAsset(value);
} });
export const get = mutation({ args: { ...scopeArgs, assetId: v.string(), version: v.number() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "storage:read"), reference = dataAuthorityReference(actor), deadlines: number[] = [];
  const value = await assetVersion(ctx, scope(actor), args.assetId, args.version); if (!value) assetDenied();
  await authorizeAsset(ctx, reference, value, "storage:read", new Set(), deadlines);
  const expiresAt = await deliveryExpiresAt(ctx, reference, deadlines, "storage:read");
  return { ...publicAsset(value), ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
} });
export const downloadAuthorization = internalMutation({ args: { ...scopeArgs, assetId: v.string(), version: v.number() }, handler: async (ctx, args) => { const actor = await requireDataAuthority(ctx, args, "storage:read"); const reference = dataAuthorityReference(actor); const value = await assetVersion(ctx, scope(actor), args.assetId, args.version); if (!value) assetDenied(); await authorizeAsset(ctx, reference, value); return { metadata: publicAsset(value), storageId: value.storageId, reference }; } });
export const downloadCheckpoint = internalMutation({ args: { reference: runtimeAuthorityReference, assetId: v.string(), version: v.number(), contentHash: v.string(), capability: v.optional(v.union(v.literal("storage:read"), v.literal("storage:write"))) }, handler: async (ctx, args) => {
  const value = await assetVersion(ctx, scope(args.reference), args.assetId, args.version);
  if (!value || value.contentHash !== args.contentHash) assetDenied();
  return assetDelivery(ctx, args.reference, value, args.capability ?? "storage:read");
} });
/** Fresh delivery of an already committed version; never alters ready ownership. */
export const storedDeliveryCheckpoint = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await jobRow(ctx, args.jobId);
  if (job.state !== "ready") assetDenied("ASSET_NOT_READY");
  const value = await versionById(ctx, scope(job.reference), job.versionId);
  if (!value || value.assetId !== job.assetId || value.assetVersion !== job.assetVersion
    || value.contentHash !== job.contentHash || value.sizeBytes !== job.sizeBytes || value.mimeType !== job.mimeType) assetDenied();
  return assetDelivery(ctx, job.reference, value, "storage:write");
} });
export const remove = mutation({ args: { ...scopeArgs, assetId: v.string() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "storage:write"); const s = scope(actor); const head = await ctx.db.query("runtimeAssets").withIndex("by_asset", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("assetId", args.assetId)).unique(); if (!head) assetDenied();
  await recheckAuthority(ctx, dataAuthorityReference(actor), { ...s, capability: "storage:write", resource: { ...s, resourceType: "storage", resourceId: head.assetId, ownerPrincipalId: head.ownerPrincipalId } });
  await ctx.db.patch("runtimeAssets", head._id, { deletedAt: head.deletedAt ?? Date.now() }); await releaseAssetReferences(ctx, s, "upload", head.assetId); return { removed: true };
} });
export const cancel = mutation({ args: { ...scopeArgs, requestId: v.string() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "storage:write"); const job = await ctx.db.query("runtimeAssetJobs").withIndex("by_request", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId!).eq("ownerPrincipalId", actor.principalId).eq("requestId", args.requestId)).unique(); if (!job) assetDenied(); if (job.state === "ready") assetDenied("ASSET_ALREADY_READY");
  await ctx.db.patch("runtimeAssetJobs", job._id, { state: "cancelled" }); await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:cleanupJob"), { jobId: job.jobId }); return { cancelled: true };
} });
export const cleanupVersion = internalMutation({ args: { tenantId: v.string(), memorySpaceId: v.string(), versionId: v.string() }, handler: async (ctx, args) => {
  const value = await versionById(ctx, args, args.versionId); if (!value || value.state === "deleted") return null;
  const edges = await ctx.db.query("runtimeAssetReferences").withIndex("by_version", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("versionId", args.versionId).eq("active", true)).take(101);
  if (edges.length > 100) assetDenied("ASSET_REFERENCE_LIMIT");
  // Native vacuum may retire an Agent owner, but cannot retire an artifact or
  // attachment owner. Reconcile the actual canonical message before last-owner deletion.
  const agent = (components as unknown as { agent: AgentComponent }).agent;
  for (const edge of edges) if (edge.kind === "agent") {
    const native = await ctx.runQuery(agent.messages.getMessagesByIds, { messageIds: [edge.ownerId] });
    if (!native[0]) await ctx.db.patch("runtimeAssetReferences", edge._id, { active: false });
  }
  if (await ctx.db.query("runtimeAssetReferences").withIndex("by_version", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("versionId", args.versionId).eq("active", true)).first()) return null;
  try { await ctx.storage.delete(value.storageId); await ctx.db.patch("runtimeAssetVersions", value._id, { state: "deleted", deletedAt: Date.now() }); }
  catch { const attempt = value.cleanupAttempt + 1; await ctx.db.patch("runtimeAssetVersions", value._id, { state: "cleanup_pending", cleanupAttempt: attempt }); if (attempt < 3) await ctx.scheduler.runAfter(1000 * attempt, makeFunctionReference<"mutation">("runtimeAssets:cleanupVersion"), args); } return null;
} });
export const reconcileOwnerReferences = internalMutation({ args: { tenantId: v.string(), memorySpaceId: v.string(), kind: v.union(v.literal("upload"), v.literal("artifact"), v.literal("attachment"), v.literal("agent")), ownerId: v.string(), afterOwnerVersion: v.optional(v.string()) }, handler: async (ctx, args) => reconcileAssetOwnerReferences(ctx, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId }, args.kind, args.ownerId, args.afterOwnerVersion) });
export const cleanupJob = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await jobRow(ctx, args.jobId); if (job.state === "ready" || job.state === "uploading" && Date.now() < job.leaseExpiresAt) return null;
  const rows = job.storageId ? [await ctx.db.system.get("_storage", job.storageId)] : await ctx.db.system.query("_storage").withIndex("by_creation_time", q => q.gte("_creationTime", job.createdAt)).filter(q => q.eq(q.field("contentType"), job.marker)).take(2);
  try {
    for (const row of rows) if (row && row.contentType === job.marker && row.size === job.sizeBytes) { const checked = await ctx.storage.getMetadata(row._id); if (checked?.sha256 === job.contentHash) await ctx.storage.delete(row._id); }
    await ctx.db.patch("runtimeAssetJobs", job._id, { state: job.state === "cancelled" ? "cancelled" : "failed", failureCode: undefined });
  } catch { const cleanupAttempt = (job.cleanupAttempt ?? 0) + 1; await ctx.db.patch("runtimeAssetJobs", job._id, { cleanupAttempt, failureCode: "ASSET_CLEANUP_PENDING" }); if (cleanupAttempt < 3) await ctx.scheduler.runAfter(cleanupAttempt * 1000, makeFunctionReference<"mutation">("runtimeAssets:cleanupJob"), args); } return null;
} });
/** Lost ready acknowledgements cannot delete committed referenced bytes. */
export const abandonJob = internalMutation({ args: { jobId: v.string(), storageId: v.optional(v.id("_storage")) }, handler: async (ctx, args) => {
  const job = await jobRow(ctx, args.jobId); if (job.state === "ready") return null;
  if (args.storageId) { const stored = await ctx.storage.getMetadata(args.storageId); if (stored && stored.contentType !== job.marker || job.storageId && job.storageId !== args.storageId) assetDenied("ASSET_REFERENCE_CONFLICT"); }
  await ctx.db.patch("runtimeAssetJobs", job._id, { state: job.state === "cancelled" ? "cancelled" : "failed", ...(args.storageId ? { storageId: args.storageId } : {}) }); await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:cleanupJob"), { jobId: job.jobId }); return null;
} });
export async function storeJobBytes(ctx: ActionCtx, job: { jobId: string; marker: string }, bytes: ArrayBuffer): Promise<RuntimeAssetVersion> {
  try { assertAssetSize(bytes.byteLength); } catch { assetDenied("ASSET_TOO_LARGE"); }
  let storageId: Id<"_storage"> | undefined;
  try {
    storageId = await ctx.storage.store(new Blob([bytes], { type: job.marker }));
    await ctx.runMutation(makeFunctionReference<"mutation">("runtimeAssets:stageStorage"), { jobId: job.jobId, storageId });
    const value = await ctx.runMutation(makeFunctionReference<"mutation", { jobId: string }, RuntimeAssetVersion>("runtimeAssets:finalize"), { jobId: job.jobId });
    const witness = await ctx.runMutation(makeFunctionReference<"mutation", { jobId: string }, AssetDeliveryWitness>("runtimeAssets:storedDeliveryCheckpoint"), { jobId: job.jobId });
    assertAssetActionDelivery(witness); return value;
  }
  catch (error) { try { await ctx.runMutation(makeFunctionReference<"mutation">("runtimeAssets:abandonJob"), { jobId: job.jobId, ...(storageId ? { storageId } : {}) }); } catch { /* Durable lease cleanup owns unresolved storage. */ } throw error; }
}
export async function storeGeneratedAsset(ctx: ActionCtx, reference: RuntimeAuthorityReference, input: { requestId: string; mimeType: string; lineage: Extract<RuntimeAssetLineage, { kind: "generated" }>; filename?: string }, blob: Blob): Promise<RuntimeAssetVersion> {
  try { assertAssetSize(blob.size); } catch { assetDenied("ASSET_TOO_LARGE"); }
  const bytes = await blob.arrayBuffer(); const contentHash = await assetContentHash(bytes);
  const job = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, { jobId: string; marker: string; ready?: RuntimeAssetVersion }>("runtimeAssets:beginGenerated"), { reference, ...input, contentHash, sizeBytes: bytes.byteLength });
  if (!job.ready) return storeJobBytes(ctx, job, bytes);
  const witness = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, AssetDeliveryWitness>("runtimeAssets:downloadCheckpoint"),
    { reference, assetId: job.ready.assetId, version: job.ready.assetVersion, contentHash: job.ready.contentHash, capability: "storage:write" });
  assertAssetActionDelivery(witness); return job.ready;
}
/** Private byte access and full encoded protocol cap are independent of app delivery. */
export async function readPrivateProviderAsset(ctx: ActionCtx, reference: RuntimeAuthorityReference, args: { assetId: string; version: number; protocol: "image-inline-v1" | "video-inline-v1" }) {
  const held = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, { metadata: RuntimeAssetVersion; storageId: Id<"_storage"> }>("runtimeAssets:providerAuthorization"), { reference, assetId: args.assetId, version: args.version });
  const mime = held.metadata.mimeType; if (!(args.protocol === "image-inline-v1" ? mime.startsWith("image/") : mime.startsWith("video/"))) assetDenied("PROVIDER_INPUT_UNSUPPORTED");
  const blob = await ctx.storage.get(held.storageId); if (!blob || blob.size !== held.metadata.sizeBytes || blob.size > ASSET_MAX_BYTES) assetDenied("ASSET_INTEGRITY_FAILED"); if (4 * Math.ceil(blob.size / 3) + 1024 > 16 * 1024 * 1024) assetDenied("PROVIDER_INPUT_TOO_LARGE");
  const bytes = new Uint8Array(await blob.arrayBuffer()); if (await assetContentHash(bytes.buffer) !== held.metadata.contentHash) assetDenied("ASSET_INTEGRITY_FAILED");
  let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const data = `data:${mime};base64,${btoa(binary)}`; const envelope = args.protocol === "image-inline-v1" ? { version: 1, protocol: args.protocol, image: data } : { version: 1, protocol: args.protocol, video: data };
  const protocolBytes = new TextEncoder().encode(canonicalModelJson(envelope)).byteLength; if (protocolBytes > 16 * 1024 * 1024) assetDenied("PROVIDER_INPUT_TOO_LARGE");
  const witness = await ctx.runMutation(makeFunctionReference<"mutation", Record<string, unknown>, AssetDeliveryWitness>("runtimeAssets:downloadCheckpoint"), { reference, assetId: args.assetId, version: args.version, contentHash: held.metadata.contentHash });
  assertAssetActionDelivery(witness); return { metadata: held.metadata, protocol: args.protocol, protocolBytes, envelope };
}
export const providerAuthorization = internalMutation({ args: { reference: runtimeAuthorityReference, assetId: v.string(), version: v.number() }, handler: async (ctx, args) => { const value = await assetVersion(ctx, scope(args.reference), args.assetId, args.version); if (!value) assetDenied(); await authorizeAsset(ctx, args.reference, value); return { metadata: publicAsset(value), storageId: value.storageId }; } });
export const readProviderInput = internalAction({ args: { reference: runtimeAuthorityReference, assetId: v.string(), version: v.number(), protocol: v.union(v.literal("image-inline-v1"), v.literal("video-inline-v1")) }, handler: async (ctx, args) => readPrivateProviderAsset(ctx, args.reference, args) });
/** Trusted cleanup after user/scope tombstones. No obsolete grant is borrowed. */
export const retireAuthority = internalMutation({ args: { principalId: v.optional(v.string()), tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), cursor: v.optional(v.union(v.string(), v.null())) }, handler: async (ctx, args) => {
  if (!args.principalId && !args.tenantId || args.memorySpaceId && !args.tenantId) assetDenied("INVALID_ASSET_METADATA");
  const selected = args.principalId ? ctx.db.query("runtimeAssetReferences").withIndex("by_principal", q => q.eq("ownerPrincipalId", args.principalId!)) : ctx.db.query("runtimeAssetReferences").withIndex("by_scope", q => args.memorySpaceId ? q.eq("tenantId", args.tenantId!).eq("memorySpaceId", args.memorySpaceId) : q.eq("tenantId", args.tenantId!));
  const page = await selected.paginate({ cursor: args.cursor ?? null, numItems: 100 });
  for (const edge of page.page) if (edge.active) { await ctx.db.patch("runtimeAssetReferences", edge._id, { active: false }); const value = await versionById(ctx, edge, edge.versionId); if (value) { await ctx.db.patch("runtimeAssetVersions", value._id, { cleanupAttempt: value.cleanupAttempt }); await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:cleanupVersion"), { tenantId: edge.tenantId, memorySpaceId: edge.memorySpaceId, versionId: edge.versionId }); } }
  if (!page.isDone) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:retireAuthority"), { ...args, cursor: page.continueCursor }); return null;
} });
export const status = mutation({ args: { ...scopeArgs, requestId: v.string() }, handler: async (ctx, args) => { const actor = await requireDataAuthority(ctx, args, "storage:write"); const job = await ctx.db.query("runtimeAssetJobs").withIndex("by_request", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId!).eq("ownerPrincipalId", actor.principalId).eq("requestId", args.requestId)).unique(); if (!job) assetDenied(); return { version: 1, state: job.state, ...(job.failureCode ? { failureCode: job.failureCode } : {}), cleanupPending: job.failureCode === "ASSET_CLEANUP_PENDING" }; } });
export const retryCleanup = mutation({ args: { ...scopeArgs, assetId: v.string(), version: v.number() }, handler: async (ctx, args) => { const actor = await requireDataAuthority(ctx, args, "storage:write"); const value = await assetVersion(ctx, scope(actor), args.assetId, args.version); if (!value) assetDenied(); await recheckAuthority(ctx, dataAuthorityReference(actor), { ...scope(actor), capability: "storage:write", resource: { ...scope(actor), resourceType: "storage", resourceId: value.assetId, ownerPrincipalId: value.ownerPrincipalId } }); await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:cleanupVersion"), { ...scope(actor), versionId: value.versionId }); return { scheduled: true }; } });
