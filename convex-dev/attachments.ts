/** Attachments retain immutable catalog versions; they never own a bearer URL. */
import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireDataAuthority, dataAuthorityReference, managedConversationAccess } from "./runtimeDataAuth";
import { recheckAuthority } from "./runtimeAuth";
import { canonicalModelJson } from "../src/domain/model-policy";
import { assetVersion, authorizeAsset, publicAsset, versionById, addAssetReference, releaseAssetReferences, assetDenied } from "./runtimeAssetCatalog";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
const scopeArgs = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
const attachmentTypeValidator = v.union(v.literal("image"), v.literal("audio"), v.literal("video"), v.literal("file"), v.literal("pdf"));
type ScopeArgs = { tenantId?: string; memorySpaceId?: string };
async function current(ctx: MutationCtx, args: ScopeArgs, id: string, write = false) {
  const actor = await requireDataAuthority(ctx, args, write ? "storage:write" : "storage:read"); const reference = dataAuthorityReference(actor);
  const row = await ctx.db.query("attachments").withIndex("by_runtime_key", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId!).eq("attachmentId", id)).unique();
  if (!row || row.tombstonedAt !== undefined || !row.ownerPrincipalId || !row.assetVersionId) assetDenied();
  await recheckAuthority(ctx, reference, { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, capability: write ? "storage:write" : "storage:read", resource: { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, resourceType: "attachment", resourceId: id, ownerPrincipalId: row.ownerPrincipalId } });
  await conversation(ctx, reference, row.conversationId, write); const value = await versionById(ctx, { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId! }, row.assetVersionId); if (!value) assetDenied();
  await authorizeAsset(ctx, reference, value, write ? "storage:write" : "storage:read"); return { row, reference, value };
}
async function conversation(ctx: MutationCtx, reference: RuntimeAuthorityReference, id?: string, write = false) {
  if (!id) return;
  const row = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("conversationId", id)).unique();
  if (!row) assetDenied();
  await managedConversationAccess(ctx, reference, row, write ? "storage:write" : "storage:read", write ? "canContinue" : "canExport");
}
type AttachmentMetadata = { filename?: string; dimensions?: { width: number; height: number }; duration?: number; metadata?: unknown };
function checkedMetadata(input: AttachmentMetadata, kind: Doc<"attachments">["type"]) {
  if (input.filename !== undefined && (!input.filename || input.filename.length > 256 || /[\r\n\x00]/.test(input.filename))) assetDenied("INVALID_ASSET_METADATA");
  if (input.dimensions && (!["image", "video"].includes(kind) || !Number.isSafeInteger(input.dimensions.width) || input.dimensions.width < 1 || !Number.isSafeInteger(input.dimensions.height) || input.dimensions.height < 1)) assetDenied("INVALID_ASSET_METADATA");
  if (input.duration !== undefined && (!["audio", "video"].includes(kind) || !Number.isFinite(input.duration) || input.duration < 0)) assetDenied("INVALID_ASSET_METADATA");
  if (input.metadata !== undefined) {
    if (typeof input.metadata !== "object" || input.metadata === null || Array.isArray(input.metadata)) assetDenied("INVALID_ASSET_METADATA");
    try { if (new TextEncoder().encode(canonicalModelJson(input.metadata)).byteLength > 16384) assetDenied("INVALID_ASSET_METADATA"); } catch { assetDenied("INVALID_ASSET_METADATA"); }
  }
  return { ...(input.filename !== undefined ? { filename: input.filename } : {}), ...(input.dimensions ? { dimensions: input.dimensions } : {}), ...(input.duration !== undefined ? { duration: input.duration } : {}), ...(input.metadata !== undefined ? { metadata: input.metadata } : {}) };
}
function attachmentKind(value: { mediaKind: string; mimeType: string }): Doc<"attachments">["type"] { return value.mediaKind === "document" ? value.mimeType === "application/pdf" ? "pdf" : "file" : value.mediaKind === "binary" ? "file" : value.mediaKind as "image" | "audio" | "video"; }
function output(row: Doc<"attachments">, asset: ReturnType<typeof publicAsset>) { return { _id: String(row._id), storageId: String(row.storageId), updatedAt: row.updatedAt, attachmentId: row.attachmentId, tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, userId: row.userId, type: row.type, filename: row.filename, mimeType: asset.mimeType, size: asset.sizeBytes, asset, createdAt: row.createdAt, ...(row.conversationId ? { conversationId: row.conversationId } : {}), ...(row.messageId ? { messageId: row.messageId } : {}), ...(row.dimensions ? { dimensions: row.dimensions } : {}), ...(row.duration !== undefined ? { duration: row.duration } : {}), ...(row.metadata !== undefined ? { metadata: row.metadata } : {}) }; }
async function link(ctx: MutationCtx, args: ScopeArgs & { assetId: string; version: number; attachmentId?: string; conversationId?: string; messageId?: string } & AttachmentMetadata) {
  const actor = await requireDataAuthority(ctx, args, "storage:write"); const reference = dataAuthorityReference(actor); const value = await assetVersion(ctx, { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId! }, args.assetId, args.version); if (!value) assetDenied();
  await authorizeAsset(ctx, reference, value); await conversation(ctx, reference, args.conversationId, true);
  const info = checkedMetadata(args, attachmentKind(value));
  const id = args.attachmentId ?? `attachment:${crypto.randomUUID()}`;
  const old = await ctx.db.query("attachments").withIndex("by_runtime_key", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId!).eq("attachmentId", id)).unique();
  if (old) { if (old.tombstonedAt !== undefined || old.ownerPrincipalId !== actor.principalId || old.assetVersionId !== value.versionId || old.conversationId !== args.conversationId || old.messageId !== args.messageId || old.filename !== (info.filename ?? value.filename ?? "asset") || canonicalModelJson(old.dimensions ?? null) !== canonicalModelJson(info.dimensions ?? null) || old.duration !== info.duration || canonicalModelJson(old.metadata ?? null) !== canonicalModelJson(info.metadata ?? null)) assetDenied("ASSET_IDEMPOTENCY_CONFLICT"); return output(old, publicAsset(value)); }
  const now = Date.now(); const rowId = await ctx.db.insert("attachments", { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId!, attachmentId: id, ownerPrincipalId: actor.principalId, assetVersionId: value.versionId, userId: actor.userId, storageId: value.storageId, type: attachmentKind(value), mimeType: value.mimeType, filename: info.filename ?? value.filename ?? "asset", size: value.sizeBytes, ...info, ...(args.conversationId ? { conversationId: args.conversationId } : {}), ...(args.messageId ? { messageId: args.messageId } : {}), createdAt: now, updatedAt: now });
  await addAssetReference(ctx, value, { kind: "attachment", ownerId: id, ownerVersion: "current", ownerPrincipalId: actor.principalId, ...(args.conversationId ? { conversationId: args.conversationId } : {}) });
  return output((await ctx.db.get("attachments", rowId))!, publicAsset(value));
}
export const create = mutation({ args: { ...scopeArgs, assetId: v.string(), version: v.number(), attachmentId: v.optional(v.string()), conversationId: v.optional(v.string()), messageId: v.optional(v.string()) }, handler: link });
/** Legacy storage selectors can only name a ready catalog version with exact metadata. */
export const attach = mutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.string(), storageId: v.id("_storage"), userId: v.string(), type: attachmentTypeValidator, mimeType: v.string(), filename: v.string(), size: v.number(), conversationId: v.optional(v.string()), messageId: v.optional(v.string()), memoryId: v.optional(v.string()), artifactId: v.optional(v.string()), dimensions: v.optional(v.object({ width: v.number(), height: v.number() })), duration: v.optional(v.number()), metadata: v.optional(v.any()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "storage:write"); if (actor.userId !== args.userId || args.memoryId || args.artifactId) assetDenied();
  const value = await ctx.db.query("runtimeAssetVersions").withIndex("by_storage", q => q.eq("storageId", args.storageId)).unique();
  if (!value || value.tenantId !== actor.tenantId || value.memorySpaceId !== actor.memorySpaceId || value.mimeType !== args.mimeType || value.sizeBytes !== args.size || attachmentKind(value) !== args.type) assetDenied("ASSET_REFERENCE_CONFLICT");
  return link(ctx, { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, assetId: value.assetId, version: value.assetVersion, ...checkedMetadata(args, args.type), ...(args.conversationId ? { conversationId: args.conversationId } : {}), ...(args.messageId ? { messageId: args.messageId } : {}) });
} });
export const get = mutation({ args: { ...scopeArgs, attachmentId: v.string() }, handler: async (ctx, args) => { const held = await current(ctx, args, args.attachmentId); return output(held.row, publicAsset(held.value)); } });
async function removeOne(ctx: MutationCtx, args: ScopeArgs, id: string) { const held = await current(ctx, args, id, true); await ctx.db.patch("attachments", held.row._id, { tombstonedAt: Date.now(), updatedAt: Date.now() }); await releaseAssetReferences(ctx, { tenantId: held.row.tenantId!, memorySpaceId: held.row.memorySpaceId }, "attachment", id); return { deleted: true, attachmentId: id }; }
export const remove = mutation({ args: { ...scopeArgs, attachmentId: v.string() }, handler: async (ctx, args) => await removeOne(ctx, args, args.attachmentId) });
export const removeMany = mutation({ args: { ...scopeArgs, attachmentIds: v.array(v.string()) }, handler: async (ctx, args) => { if (args.attachmentIds.length > 100) assetDenied("ASSET_REFERENCE_LIMIT"); for (const id of args.attachmentIds) await removeOne(ctx, args, id); return { deleted: args.attachmentIds.length }; } });
const filters = { ...scopeArgs, conversationId: v.optional(v.string()), messageId: v.optional(v.string()), userId: v.optional(v.string()), type: v.optional(attachmentTypeValidator), limit: v.optional(v.number()), cursor: v.optional(v.string()), memoryId: v.optional(v.string()), artifactId: v.optional(v.string()), sortBy: v.optional(v.string()), sortOrder: v.optional(v.string()) };
async function listRows(ctx: MutationCtx, args: ScopeArgs & { conversationId?: string; messageId?: string; userId?: string; type?: Doc<"attachments">["type"]; limit?: number; cursor?: string; memoryId?: string; artifactId?: string; sortBy?: string; sortOrder?: string }) {
  const actor = await requireDataAuthority(ctx, args, "storage:read"); if (args.userId && args.userId !== actor.userId || args.cursor || args.memoryId || args.artifactId || args.sortBy && !["createdAt", "updatedAt", "size", "filename"].includes(args.sortBy) || args.sortOrder && !["asc", "desc"].includes(args.sortOrder)) assetDenied("INVALID_ASSET_METADATA");
  const rows = await ctx.db.query("attachments").withIndex("by_memorySpace", q => q.eq("memorySpaceId", actor.memorySpaceId!)).filter(q => q.and(q.eq(q.field("tenantId"), actor.tenantId), q.eq(q.field("tombstonedAt"), undefined), actor.resourceAccess === "own" ? q.eq(q.field("ownerPrincipalId"), actor.principalId) : q.eq(1, 1))).take(101);
  if (rows.length > 100) assetDenied("ASSET_REFERENCE_LIMIT"); const result = [];
  for (const row of rows) if ((!args.conversationId || row.conversationId === args.conversationId) && (!args.messageId || row.messageId === args.messageId) && (!args.type || row.type === args.type)) {
    const held = await current(ctx, args, row.attachmentId); result.push(output(held.row, publicAsset(held.value)));
  }
  const sortBy = args.sortBy ?? "createdAt"; const direction = args.sortOrder === "desc" ? -1 : 1;
  result.sort((a, b) => { const x = a[sortBy as "createdAt" | "updatedAt" | "size" | "filename"]; const y = b[sortBy as "createdAt" | "updatedAt" | "size" | "filename"]; return direction * (x < y ? -1 : x > y ? 1 : a.attachmentId.localeCompare(b.attachmentId)); });
  const limit = args.limit ?? 100; if (!Number.isInteger(limit) || limit < 1 || limit > 100) assetDenied("INVALID_ASSET_METADATA"); return result.slice(0, limit);
}
export const list = mutation({ args: filters, handler: async (ctx, args) => { const rows = await listRows(ctx, args); return { attachments: rows, total: rows.length, hasMore: false }; } });
export const count = mutation({ args: filters, handler: async (ctx, args) => (await listRows(ctx, args)).length });
export const getByConversation = mutation({ args: { ...filters, conversationId: v.string() }, handler: listRows });
export const getByMessage = mutation({ args: { ...filters, messageId: v.string() }, handler: listRows });
export const getByIds = mutation({ args: { ...scopeArgs, attachmentIds: v.array(v.string()) }, handler: async (ctx, args) => { if (args.attachmentIds.length > 100) assetDenied("ASSET_REFERENCE_LIMIT"); const result = []; for (const id of args.attachmentIds) { const held = await current(ctx, args, id); result.push(output(held.row, publicAsset(held.value))); } return result; } });
export const generateUploadUrl = internalMutation({ args: { tenantId: v.optional(v.string()) }, handler: () => assetDenied("PRIVATE_ASSET_HTTP_REQUIRED") });
export const getUrl = internalQuery({ args: { ...scopeArgs, attachmentId: v.string() }, handler: () => assetDenied("PRIVATE_ASSET_HTTP_REQUIRED") });
export const purgeAll = internalMutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) }, handler: () => assetDenied("PRIVATE_ASSET_HTTP_REQUIRED") });
