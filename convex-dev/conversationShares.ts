/** Authenticated managed shares. A share never supplies JWT authority or widens scope. */
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { mutation, query, internalMutation } from "./_generated/server";
import { internalUnavailable } from "./runtimeUnavailableAuth";
import { bindDataActor, dataAuthorityReference, managedConversationAccess, requireDataAuthority } from "./runtimeDataAuth";
import { checkConversation, conversationById, requireConversation, singleTranscript, transcriptDenied } from "./runtimeTranscript";
import { boundedIdentifier } from "../src/domain/transcript";
const reconcileGraph = makeFunctionReference<"mutation", { tenantId: string; memorySpaceId: string }>("runtimeGraph:reconcileScoped");
const expireGraph = makeFunctionReference<"mutation", { tenantId: string; memorySpaceId: string; shareId: string; expiresAt: number }>("conversationShares:expireGraphShare");

async function shareById(ctx: Pick<import("./_generated/server").QueryCtx, "db">, reference: import("../src/auth/verified").RuntimeAuthorityReference, shareId: string) {
  return singleTranscript(await ctx.db.query("runtimeConversationShares").withIndex("by_scoped_id", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("shareId", shareId)).take(2));
}
function view(row: import("./_generated/dataModel").Doc<"runtimeConversationShares">) {
  return { _id: row._id, grantedBy: row.ownerPrincipalId, sourceMemorySpaceId: row.memorySpaceId, redactSensitive: false, revokedAt: row.revokedAt, tenantId: row.tenantId, shareId: row.shareId, conversationId: row.conversationId, grantType: row.grantType, grantedTo: row.grantedTo,
    permissions: row.permissions, status: row.revokedAt !== undefined ? "revoked" : row.expiresAt !== undefined && Date.now() >= row.expiresAt ? "expired" : "active",
    expiresAt: row.expiresAt, maxViews: row.maxViews, viewCount: row.viewCount, createdAt: row.createdAt };
}

export const create = mutation({ args: {
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    grantedBy: v.string(), // userId who is sharing
    sourceMemorySpaceId: v.optional(v.string()), // Deprecated: now derived from conversation
    grantType: v.union(
      v.literal("user"),
      v.literal("space"),
      v.literal("link"),
      v.literal("domain"),
    ),
    grantedTo: v.optional(v.string()),
    permissions: v.object({
      canView: v.boolean(),
      canViewFacts: v.boolean(),
      canViewMemories: v.boolean(),
      canContinue: v.boolean(),
      canFork: v.boolean(),
      canExport: v.boolean(),
    }),
    expiresAt: v.optional(v.number()),
    maxViews: v.optional(v.number()),
    redactBefore: v.optional(v.number()),
    redactSensitive: v.optional(v.boolean()),
    tenantId: v.optional(v.string()),
  }, handler: async (ctx, args) => {
  const { actor, reference, conversation } = await requireConversation(ctx, args, args.conversationId, "admin");
  bindDataActor(actor, args.grantedBy);
  if (args.sourceMemorySpaceId !== undefined && args.sourceMemorySpaceId !== conversation.memorySpaceId) transcriptDenied();
  if (args.grantType !== "user" && args.grantType !== "space") transcriptDenied("CAPABILITY_UNAVAILABLE");
  if (args.redactBefore !== undefined || args.redactSensitive) transcriptDenied("CAPABILITY_UNAVAILABLE");
  // Query delivery cannot atomically consume a view. Do not accept an unenforced limit.
  if (args.maxViews !== undefined) transcriptDenied("CAPABILITY_UNAVAILABLE");
  if (args.expiresAt !== undefined && (!Number.isSafeInteger(args.expiresAt) || args.expiresAt <= Date.now())
    || args.maxViews !== undefined && (!Number.isSafeInteger(args.maxViews) || args.maxViews < 1)) transcriptDenied("INVALID_INPUT");
  if (!args.grantedTo) transcriptDenied("INVALID_INPUT"); boundedIdentifier(args.grantedTo); let grantedTo = args.grantedTo;
  if (args.grantType === "space") { if (args.grantedTo !== conversation.memorySpaceId) transcriptDenied(); }
  else {
    const principalId = ctx.db.normalizeId("runtimeAuthPrincipals", args.grantedTo);
    const creatorId = ctx.db.normalizeId("runtimeAuthPrincipals", actor.principalId);
    const creator = creatorId ? await ctx.db.get("runtimeAuthPrincipals", creatorId) : null;
    const exact = principalId ? await ctx.db.get("runtimeAuthPrincipals", principalId) : null;
    const target = exact ? [exact] : creator ? await ctx.db.query("runtimeAuthPrincipals").withIndex("by_issuer_subject", q => q.eq("issuer", creator.issuer).eq("subject", args.grantedTo!)).take(2) : [];
    if (target.length !== 1 || target[0].deletedAt !== undefined) transcriptDenied(); grantedTo = target[0]._id;
    const memberships = await ctx.db.query("runtimeAuthMemberships").withIndex("by_principal_tenant", q => q.eq("principalId", target[0]._id).eq("tenantId", actor.tenantId)).take(2);
    if (memberships.length !== 1 || memberships[0].revokedAt !== undefined || memberships[0].deletedAt !== undefined) transcriptDenied();
  }
  const active = await ctx.db.query("runtimeConversationShares").withIndex("by_conversation_state", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("conversationId", conversation.conversationId).eq("state", "active")).take(65);
  if (active.length >= 64) transcriptDenied("QUERY_TOO_BROAD");
  const shareId = `share:${crypto.randomUUID()}`;
  const id = await ctx.db.insert("runtimeConversationShares", { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, ownerPrincipalId: actor.principalId,
    shareId, conversationId: conversation.conversationId, grantType: args.grantType, grantedTo, permissions: args.permissions,
    state: "active", actorReference: reference, ...(args.expiresAt === undefined ? {} : { expiresAt: args.expiresAt }),
    ...(args.maxViews === undefined ? {} : { maxViews: args.maxViews }), viewCount: 0, createdAt: Date.now() });
  if (args.expiresAt !== undefined) await ctx.scheduler.runAfter(Math.min(86_400_000, args.expiresAt - Date.now()), expireGraph,
    { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, shareId, expiresAt: args.expiresAt });
  return view((await ctx.db.get("runtimeConversationShares", id))!);
} });

export const revoke = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    shareId: v.string(),
    // Optional: caller's userId for authorization
    userId: v.optional(v.string()),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "admin"); bindDataActor(actor, args.userId); const reference = dataAuthorityReference(actor);
  const row = await shareById(ctx, reference, args.shareId); if (!row) transcriptDenied();
  const conversation = await conversationById(ctx, reference, row.conversationId); if (!conversation) transcriptDenied();
  await checkConversation(ctx, reference, conversation, "admin");
  if (row.revokedAt === undefined) {
    await ctx.db.patch("runtimeConversationShares", row._id, { state: "revoked", revokedAt: Date.now(), revocationActor: reference });
    await ctx.runMutation(reconcileGraph, { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId });
  }
  return view((await ctx.db.get("runtimeConversationShares", row._id))!);
} });

/** Owned expiration scheduling rechecks exact immutable share identity; it
 * only reconciles graph cleanup, without extending a share or using its grant. */
export const expireGraphShare = internalMutation({ args: { tenantId: v.string(), memorySpaceId: v.string(), shareId: v.string(), expiresAt: v.number() }, handler: async (ctx, args) => {
  const row = await ctx.db.query("runtimeConversationShares").withIndex("by_scoped_id", q => q.eq("tenantId", args.tenantId)
    .eq("memorySpaceId", args.memorySpaceId).eq("shareId", args.shareId)).unique();
  if (!row || row.revokedAt !== undefined || row.expiresAt !== args.expiresAt) return null;
  if (args.expiresAt > Date.now()) await ctx.scheduler.runAfter(Math.min(86_400_000, args.expiresAt - Date.now()), expireGraph, args);
  else await ctx.runMutation(reconcileGraph, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId });
  return null;
} });

export const incrementViewCount = internalMutation({ args: {
    shareId: v.string(),
  }, handler: async (_ctx, _args) => {
  return await internalUnavailable();
} });

export const get = query({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    shareId: v.string(),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor);
  const row = await shareById(ctx, reference, args.shareId); if (!row) return null;
  const conversation = await conversationById(ctx, reference, row.conversationId); if (!conversation) transcriptDenied();
  await checkConversation(ctx, reference, conversation, "read"); return view(row);
} });

export const listByConversation = query({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    status: v.optional(
      v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    ),
  }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "admin");
  return (await ctx.db.query("runtimeConversationShares").withIndex("by_conversation", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("conversationId", conversation.conversationId)).take(100))
    .map(view).filter(row => !args.status || row.status === args.status);
} });

export const listByGranter = query({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    grantedBy: v.string(),
    status: v.optional(
      v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    ),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "admin"); bindDataActor(actor, args.grantedBy); const reference = dataAuthorityReference(actor);
  const rows = await ctx.db.query("runtimeConversationShares").withIndex("by_owner", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("ownerPrincipalId", actor.principalId)).take(100);
  const result = []; for (const row of rows) { const conversation = await conversationById(ctx, reference, row.conversationId); if (!conversation || conversation.tombstonedAt !== undefined) continue; await checkConversation(ctx, reference, conversation, "admin"); const item = view(row); if (!args.status || item.status === args.status) result.push(item); }
  return result;
} });

export const checkAccess = query({ args: {
    tenantId: v.optional(v.string()),
    conversationId: v.string(),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    emailDomain: v.optional(v.string()),
  }, handler: async (ctx, args) => {
  const { actor, reference, conversation } = await requireConversation(ctx, args, args.conversationId, "read"); bindDataActor(actor, args.userId);
  if (args.emailDomain !== undefined) transcriptDenied("INVALID_INPUT");
  const permissions = { canView: true, canViewFacts: false, canViewMemories: false, canExport: false, canFork: false, canContinue: false };
  for (const permission of ["canViewFacts", "canViewMemories", "canExport", "canFork", "canContinue"] as const) {
    if ((permission === "canFork" || permission === "canContinue") && !actor.capabilities.includes("write")) continue;
    try { await managedConversationAccess(ctx, reference, conversation, permission === "canContinue" ? "write" : "read", permission);
      permissions[permission] = permission !== "canContinue" || !conversation.manualWriteLocked; }
    catch (error) { if (!(error instanceof ConvexError) || error.data.code !== "FORBIDDEN") throw error; }
  }
  return { hasAccess: true as const, permissions, share: null, reason: "CURRENT_AUTHORITY" };
} });
