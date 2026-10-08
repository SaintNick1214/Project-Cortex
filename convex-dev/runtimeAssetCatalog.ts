/** Authoritative immutable versions and reference edges; no URL-based authority. */
import { ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { RuntimeAssetVersion } from "../src/domain/assets";
import { ASSET_MAX_BYTES, assertAssetSize } from "../src/domain/assets";
import { recheckAuthority, createAuthorityReader } from "./runtimeAuth";
import { managedConversationAccess } from "./runtimeDataAuth";
type ReadCtx = Pick<QueryCtx, "db">;
export type AssetVersion = Doc<"runtimeAssetVersions">;
export type AssetReferenceEdge = Doc<"runtimeAssetReferences">;
export function assetDenied(code = "FORBIDDEN"): never { throw new ConvexError({ version: 1, code, message: "Asset operation denied.", retryable: false, outcome: "not_dispatched" }); }
export function publicAsset(value: AssetVersion): RuntimeAssetVersion {
  return { version: 1, assetId: value.assetId, versionId: value.versionId, assetVersion: value.assetVersion, contentHash: value.contentHash,
    sizeBytes: value.sizeBytes, mimeType: value.mimeType, mediaKind: value.mediaKind, ...(value.filename ? { filename: value.filename } : {}), lineage: value.lineage };
}
export async function assetVersion(ctx: ReadCtx, scope: { tenantId: string; memorySpaceId: string }, assetId: string, version: number) {
  if (!Number.isSafeInteger(version) || version < 1) assetDenied("INVALID_ASSET_METADATA");
  return ctx.db.query("runtimeAssetVersions").withIndex("by_version", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("assetId", assetId).eq("assetVersion", version)).unique();
}
export async function versionById(ctx: ReadCtx, scope: { tenantId: string; memorySpaceId: string }, versionId: string) {
  return ctx.db.query("runtimeAssetVersions").withIndex("by_version_id", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("versionId", versionId)).unique();
}
async function edgeIsLive(ctx: ReadCtx, reference: RuntimeAuthorityReference, edge: AssetReferenceEdge, capability: "storage:read" | "storage:write") {
  const target = { tenantId: edge.tenantId, memorySpaceId: edge.memorySpaceId, ownerPrincipalId: edge.ownerPrincipalId,
    resourceType: edge.kind === "upload" ? "storage" as const : edge.kind === "agent" ? "conversation" as const : edge.kind,
    resourceId: edge.kind === "agent" ? edge.conversationId! : edge.ownerId };
  await recheckAuthority(ctx, reference, { capability, tenantId: target.tenantId, memorySpaceId: target.memorySpaceId, resource: target });
  const owner = await createAuthorityReader(ctx).getPrincipal(edge.ownerPrincipalId);
  if (!owner || owner.deletedAt !== undefined) return false;
  if (edge.kind === "upload") {
    const head = await ctx.db.query("runtimeAssets").withIndex("by_asset", q => q.eq("tenantId", edge.tenantId).eq("memorySpaceId", edge.memorySpaceId).eq("assetId", edge.ownerId)).unique();
    return head !== null && head.deletedAt === undefined;
  }
  if (edge.kind === "artifact") {
    const row = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", edge.tenantId).eq("memorySpaceId", edge.memorySpaceId).eq("artifactId", edge.ownerId)).unique();
    if (!row || row.isDeleted || row.tombstonedAt !== undefined || row.ownerPrincipalId !== edge.ownerPrincipalId) return false;
    if (row.conversationRef) {
      const conversation = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", edge.tenantId).eq("memorySpaceId", edge.memorySpaceId).eq("conversationId", row.conversationRef!.conversationId)).unique();
      if (!conversation) return false;
      await managedConversationAccess(ctx, reference, conversation, capability, capability === "storage:write" ? "canContinue" : "canExport");
    }
    return edge.ownerVersion === "current" ? row.fileRef?.versionId === edge.versionId : row.versionHistory.some(v => String(v.version) === edge.ownerVersion && v.fileRef?.versionId === edge.versionId);
  }
  if (edge.kind === "attachment") {
    const row = await ctx.db.query("attachments").withIndex("by_runtime_key", q => q.eq("tenantId", edge.tenantId).eq("memorySpaceId", edge.memorySpaceId).eq("attachmentId", edge.ownerId)).unique();
    if (!row || row.tombstonedAt !== undefined || row.ownerPrincipalId !== edge.ownerPrincipalId || row.assetVersionId !== edge.versionId) return false;
    if (!row.conversationId) return true;
  }
  if (edge.conversationId) {
    const conversation = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", edge.tenantId).eq("memorySpaceId", edge.memorySpaceId).eq("conversationId", edge.conversationId!)).unique();
    if (!conversation) return false;
      await managedConversationAccess(ctx, reference, conversation, capability, capability === "storage:write" ? "canContinue" : "canExport");
    if (edge.kind === "agent") {
      const bridge = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", edge.tenantId).eq("memorySpaceId", edge.memorySpaceId).eq("nativeMessageId", edge.ownerId)).unique();
      return !!bridge && bridge.tombstonedAt === undefined && edge.ownerVersion === `${bridge.revision}:${edge.versionId}` && bridge.assetVersionIds?.includes(edge.versionId) === true;
    }
    return true;
  }
  return false;
}
export async function authorizeAsset(ctx: ReadCtx, reference: RuntimeAuthorityReference, value: AssetVersion, capability: "storage:read" | "storage:write" = "storage:read") {
  await recheckAuthority(ctx, reference, { capability, tenantId: value.tenantId, memorySpaceId: value.memorySpaceId });
  if (value.state !== "ready") assetDenied("ASSET_NOT_READY");
  try { assertAssetSize(value.sizeBytes); } catch { assetDenied("ASSET_TOO_LARGE"); }
  if (await createAuthorityReader(ctx).hasTombstone({ tenantId: value.tenantId, memorySpaceId: value.memorySpaceId, resourceType: "storage", resourceId: value.assetId })) assetDenied();
  const edges = await ctx.db.query("runtimeAssetReferences").withIndex("by_version", q => q.eq("tenantId", value.tenantId).eq("memorySpaceId", value.memorySpaceId).eq("versionId", value.versionId).eq("active", true)).take(101);
  if (edges.length > 100) assetDenied("ASSET_REFERENCE_LIMIT");
  for (const edge of edges) {
    try { if (await edgeIsLive(ctx, reference, edge, capability)) return; }
    catch (error) { if (!(error instanceof ConvexError) || typeof error.data !== "object" || error.data === null || !("code" in error.data) || error.data.code !== "FORBIDDEN") throw error; }
  }
  assetDenied();
}
export async function addAssetReference(ctx: MutationCtx, value: AssetVersion, args: { kind: AssetReferenceEdge["kind"]; ownerId: string; ownerVersion: string; ownerPrincipalId: string; conversationId?: string }) {
  if (value.state !== "ready") assetDenied("ASSET_NOT_READY");
  const prior = await ctx.db.query("runtimeAssetReferences").withIndex("by_owner", q => q.eq("tenantId", value.tenantId).eq("memorySpaceId", value.memorySpaceId).eq("kind", args.kind).eq("ownerId", args.ownerId).eq("ownerVersion", args.ownerVersion)).unique();
  if (prior?.active && prior.versionId !== value.versionId) assetDenied("ASSET_REFERENCE_CONFLICT");
  // Read the indexed active set before joining, so concurrent joins conflict
  // in the native transaction and cannot make an accepted version unreadable.
  if (!prior?.active) {
    const active = await ctx.db.query("runtimeAssetReferences").withIndex("by_version", q => q.eq("tenantId", value.tenantId).eq("memorySpaceId", value.memorySpaceId).eq("versionId", value.versionId).eq("active", true)).take(100);
    if (active.length >= 100) assetDenied("ASSET_REFERENCE_LIMIT");
  }
  if (prior) await ctx.db.patch("runtimeAssetReferences", prior._id, { ...args, versionId: value.versionId, active: true });
  else await ctx.db.insert("runtimeAssetReferences", { tenantId: value.tenantId, memorySpaceId: value.memorySpaceId, ...args, versionId: value.versionId, active: true, createdAt: Date.now() });
  // Joining or releasing a reference touches the version, closing the OCC race
  // against last-owner physical deletion in the same native transaction.
  await ctx.db.patch("runtimeAssetVersions", value._id, { cleanupAttempt: value.cleanupAttempt });
}
async function retireAssetEdge(ctx: MutationCtx, scope: { tenantId: string; memorySpaceId: string }, edge: AssetReferenceEdge) {
  await ctx.db.patch("runtimeAssetReferences", edge._id, { active: false });
  const value = await versionById(ctx, scope, edge.versionId); if (!value) assetDenied("ASSET_NOT_READY");
  await ctx.db.patch("runtimeAssetVersions", value._id, { cleanupAttempt: value.cleanupAttempt });
  await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:cleanupVersion"), { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, versionId: edge.versionId });
}
async function ownerEdges(ctx: ReadCtx, scope: { tenantId: string; memorySpaceId: string }, kind: AssetReferenceEdge["kind"], ownerId: string, afterOwnerVersion?: string) {
  return ctx.db.query("runtimeAssetReferences").withIndex("by_owner", q => {
    const owner = q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("kind", kind).eq("ownerId", ownerId);
    return afterOwnerVersion === undefined ? owner : owner.gt("ownerVersion", afterOwnerVersion);
  }).filter(q => q.eq(q.field("active"), true)).take(257);
}
async function continueOwnerRelease(ctx: MutationCtx, scope: { tenantId: string; memorySpaceId: string }, kind: AssetReferenceEdge["kind"], ownerId: string, edges: AssetReferenceEdge[]) {
  if (edges.length > 256) await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAssets:reconcileOwnerReferences"), { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, kind, ownerId, afterOwnerVersion: edges[255].ownerVersion });
}
export async function releaseAssetReferences(ctx: MutationCtx, scope: { tenantId: string; memorySpaceId: string }, kind: AssetReferenceEdge["kind"], ownerId: string, keep: readonly string[] = []) {
  const edges = await ownerEdges(ctx, scope, kind, ownerId);
  for (const edge of edges.slice(0, 256)) if (!keep.includes(edge.ownerVersion)) await retireAssetEdge(ctx, scope, edge);
  // Continuations derive CURRENT ownership; a captured keep list must never
  // remove a newly retained version after another native mutation has committed.
  await continueOwnerRelease(ctx, scope, kind, ownerId, edges);
}
export async function reconcileAssetOwnerReferences(ctx: MutationCtx, scope: { tenantId: string; memorySpaceId: string }, kind: AssetReferenceEdge["kind"], ownerId: string, afterOwnerVersion?: string) {
  const edges = await ownerEdges(ctx, scope, kind, ownerId, afterOwnerVersion);
  let retained: (edge: AssetReferenceEdge) => boolean;
  if (kind === "artifact") {
    const row = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("artifactId", ownerId)).unique();
    const versions = new Map<string, string>();
    if (row && !row.isDeleted && row.tombstonedAt === undefined) {
      for (const entry of row.versionHistory) if (entry.fileRef?.versionId) versions.set(String(entry.version), entry.fileRef.versionId);
      if (row.fileRef?.versionId) versions.set("current", row.fileRef.versionId);
    }
    retained = edge => !!row && row.ownerPrincipalId === edge.ownerPrincipalId && versions.get(edge.ownerVersion) === edge.versionId;
  } else if (kind === "attachment") {
    const row = await ctx.db.query("attachments").withIndex("by_runtime_key", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("attachmentId", ownerId)).unique();
    retained = edge => !!row && row.tombstonedAt === undefined && row.ownerPrincipalId === edge.ownerPrincipalId && edge.ownerVersion === "current" && row.assetVersionId === edge.versionId;
  } else if (kind === "agent") {
    const bridge = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("nativeMessageId", ownerId)).unique();
    retained = edge => !!bridge && bridge.tombstonedAt === undefined && bridge.ownerPrincipalId === edge.ownerPrincipalId && edge.ownerVersion === `${bridge.revision}:${edge.versionId}` && bridge.assetVersionIds?.includes(edge.versionId) === true;
  } else {
    const row = await ctx.db.query("runtimeAssets").withIndex("by_asset", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("assetId", ownerId)).unique();
    retained = edge => !!row && row.deletedAt === undefined && row.ownerPrincipalId === edge.ownerPrincipalId;
  }
  for (const edge of edges.slice(0, 256)) if (!retained(edge)) await retireAssetEdge(ctx, scope, edge);
  await continueOwnerRelease(ctx, scope, kind, ownerId, edges);
  return null;
}
export async function validateAssetFile(ctx: ReadCtx, reference: RuntimeAuthorityReference, file: NonNullable<Doc<"artifacts">["fileRef"]>) {
  const value = await versionById(ctx, { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId! }, file.versionId ?? "");
  if (!value || value.assetId !== file.assetId || value.assetVersion !== file.assetVersion || value.storageId !== file.storageId || value.contentHash !== file.checksum || value.mimeType !== file.mimeType || value.sizeBytes !== file.size) assetDenied("ASSET_REFERENCE_CONFLICT");
  await authorizeAsset(ctx, reference, value); return value;
}
export async function syncArtifactAssets(ctx: MutationCtx, reference: RuntimeAuthorityReference, artifact: Doc<"artifacts">) {
  const s = { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId! };
  const files = artifact.isDeleted ? [] : [...artifact.versionHistory.filter(v => v.fileRef).map(v => ({ ownerVersion: String(v.version), file: v.fileRef! })), ...(artifact.fileRef ? [{ ownerVersion: "current", file: artifact.fileRef }] : [])];
  // Validate all new immutable references before changing any owner edges.
  const admitted = [];
  for (const item of files) admitted.push({ ...item, value: await validateAssetFile(ctx, reference, item.file) });
  await releaseAssetReferences(ctx, s, "artifact", artifact.artifactId, files.map(f => f.ownerVersion));
  for (const item of admitted) {
    const old = await ctx.db.query("runtimeAssetReferences").withIndex("by_owner", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("kind", "artifact").eq("ownerId", artifact.artifactId).eq("ownerVersion", item.ownerVersion)).unique();
    if (old?.active && old.versionId !== item.value.versionId) await retireAssetEdge(ctx, s, old);
    await addAssetReference(ctx, item.value, { kind: "artifact", ownerId: artifact.artifactId, ownerVersion: item.ownerVersion, ownerPrincipalId: artifact.ownerPrincipalId!, ...(artifact.conversationRef ? { conversationId: artifact.conversationRef.conversationId } : {}) });
  }
}
export const ASSET_BYTE_CAP = ASSET_MAX_BYTES;
/** Native file parts refer to immutable IDs, never storage URLs or bearer links. */
export async function bindNativeAssetReferences(ctx: MutationCtx, reference: RuntimeAuthorityReference, bridge: Doc<"runtimeTranscriptMessages">, native: { message?: unknown }) {
  const message = native.message as { content?: unknown } | undefined;
  const parts = Array.isArray(message?.content) ? message.content : [];
  const ids = [...new Set(parts.flatMap(part => {
    if (!part || typeof part !== "object") return [];
    const typed = part as { type?: string; data?: unknown; image?: unknown };
    const data = typed.type === "file" ? typed.data : typed.type === "image" ? typed.image : undefined;
    return typeof data === "string" && data.startsWith("cortex-asset:") ? [data.slice("cortex-asset:".length)] : [];
  }))];
  if (ids.length > 16) assetDenied("ASSET_REFERENCE_LIMIT");
  for (const id of ids) {
    const value = await versionById(ctx, { tenantId: bridge.tenantId, memorySpaceId: bridge.memorySpaceId }, id); if (!value) assetDenied();
    await authorizeAsset(ctx, reference, value);
    await addAssetReference(ctx, value, { kind: "agent", ownerId: bridge.nativeMessageId, ownerVersion: `${bridge.revision}:${value.versionId}`, ownerPrincipalId: bridge.ownerPrincipalId, conversationId: bridge.conversationId });
  }
  if (ids.length) await ctx.db.patch("runtimeTranscriptMessages", bridge._id, { assetVersionIds: ids });
  return ids;
}
export async function publicMessageAssets(ctx: ReadCtx, reference: RuntimeAuthorityReference, bridge: Doc<"runtimeTranscriptMessages">) {
  const result: RuntimeAssetVersion[] = [];
  for (const id of bridge.assetVersionIds ?? []) {
    const value = await versionById(ctx, { tenantId: bridge.tenantId, memorySpaceId: bridge.memorySpaceId }, id); if (!value) assetDenied();
    await authorizeAsset(ctx, reference, value); result.push(publicAsset(value));
  }
  return result;
}
