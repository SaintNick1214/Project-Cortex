/** Legacy API names route to the one managed Agent transcript; no legacy executable message array is written. */
import { ConvexError, v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { ManagedConversation } from "./runtimeTranscript";
import type { Conversation, Message } from "../src/types";
import { bindDataActor, dataAuthorityReference, managedConversationAccess, requireDataAuthority } from "./runtimeDataAuth";
import { internalUnavailable } from "./runtimeUnavailableAuth";
import { approveRegisteredMessage, bridgeFor, checkConversation, conversationById, createManagedConversation, deleteManagedConversation,
  executionRevision, manualAppend, readTranscriptPage, requireConversation, reviseMessage, singleTranscript, transcriptDenied } from "./runtimeTranscript";
import { boundedIdentifier, utf8Bytes } from "../src/domain/transcript";
import { canonicalModelJson } from "../src/domain/model-policy";

type ReadCtx = Pick<QueryCtx, "db" | "runQuery">;
function metadataInput(value: unknown) {
  if (value === undefined) return undefined;
  const canonical = canonicalModelJson(value); if (utf8Bytes(canonical) > 4000) transcriptDenied("INVALID_INPUT");
  const detached = JSON.parse(canonical) as Record<string, unknown>;
  if (!detached || typeof detached !== "object" || Array.isArray(detached) || Object.keys(detached).some(key => !["title", "description", "tags"].includes(key))
    || ["title", "description"].some(key => detached[key] !== undefined && typeof detached[key] !== "string")
    || detached.tags !== undefined && (!Array.isArray(detached.tags) || detached.tags.length > 32 || detached.tags.some(tag => typeof tag !== "string"))) transcriptDenied("INVALID_INPUT");
  return canonical;
}
function view(row: ManagedConversation): Conversation & { manualWriteLocked: boolean; historyRevision: number } {
  return { _id: row._id, conversationId: row.conversationId, memorySpaceId: row.memorySpaceId, tenantId: row.tenantId, type: row.type,
    participants: { userId: row.ownerPrincipalId, userIds: row.participants, ...(row.legacyAgentLabel ? { agentId: row.legacyAgentLabel } : {}) },
    messages: [] as Message[], messageCount: row.messageCount,
    metadata: row.metadataCanonical ? JSON.parse(row.metadataCanonical) as Record<string, unknown> : undefined,
    visibility: row.visibility, collaborativeSettings: { requireApproval: row.requireApproval, approvedParticipants: row.participants },
    manualWriteLocked: row.manualWriteLocked, historyRevision: row.historyRevision, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
async function history(ctx: ReadCtx, conversation: ManagedConversation, reference: RuntimeAuthorityReference) {
  const messages: (Message & { revision: number })[] = []; let cursor: string | null = null;
  do { const page = await readTranscriptPage(ctx, conversation, reference, cursor, 100);
    for (const message of page.page) { const bridge = await bridgeFor(ctx, conversation, message.id); if (!bridge) transcriptDenied("STALE_TRANSCRIPT");
      messages.push({ id: bridge.legacyMessageId ?? message.id, role: message.role === "assistant" ? "agent" : "user", content: message.parts.flatMap(part => part.type === "text" ? [part.text] : []).join("\n"), timestamp: bridge.createdAt,
        approvalStatus: bridge.approved ? "approved" : "pending", revision: bridge.revision }); }
    if (messages.length > 1000 || utf8Bytes(canonicalModelJson(messages)) > 1_000_000) transcriptDenied("QUERY_TOO_BROAD"); cursor = page.continueCursor;
  } while (cursor !== null); return messages;
}
async function visible(ctx: Pick<QueryCtx, "auth" | "db">, args: { tenantId?: string; memorySpaceId?: string; userId?: string; type?: "user-agent" | "agent-agent" }) {
  const actor = await requireDataAuthority(ctx, args, "read"); bindDataActor(actor, args.userId); const reference = dataAuthorityReference(actor);
  const rows = await ctx.db.query("runtimeConversations").withIndex("by_scope", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId)).take(1001);
  if (rows.length > 1000) transcriptDenied("QUERY_TOO_BROAD"); const result: ManagedConversation[] = [];
  for (const row of rows) { if (args.type && row.type !== args.type) continue; try { await checkConversation(ctx, reference, row, "read"); }
    catch (error) { if (error instanceof ConvexError && error.data.code === "FORBIDDEN") continue; throw error; } result.push(row); }
  return { actor, reference, rows: result };
}
async function legacyBridge(ctx: Pick<QueryCtx, "db">, conversation: ManagedConversation, id: string) {
  return await bridgeFor(ctx, conversation, id) ?? singleTranscript(await ctx.db.query("runtimeTranscriptMessages").withIndex("by_legacy_id", q => q.eq("tenantId", conversation.tenantId)
    .eq("memorySpaceId", conversation.memorySpaceId).eq("conversationId", conversation.conversationId).eq("legacyMessageId", id)).take(2));
}

export const create = mutation({ args: {
    conversationId: v.string(),
    memorySpaceId: v.string(), // NEW: Required - which memory space owns this
    participantId: v.optional(v.string()), // NEW: Hive Mode participant tracking
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.object({
      userId: v.optional(v.string()), // The human user in the conversation
      agentId: v.optional(v.string()), // The agent/assistant in the conversation
      userIds: v.optional(v.array(v.string())), // Collaborative: multiple human users (Phase 4)
      participantId: v.optional(v.string()), // Hive Mode: who created this
      memorySpaceIds: v.optional(v.array(v.string())), // Collaboration Mode: cross-space
    }),
    metadata: v.optional(v.any()),
    // Visibility for shareable chats (Phase 1)
    visibility: v.optional(
      v.union(v.literal("private"), v.literal("space"), v.literal("public")),
    ),
    // Collaborative settings (Phase 4)
    collaborativeSettings: v.optional(
      v.object({
        requireApproval: v.boolean(),
        ownerUserId: v.optional(v.string()),
        approvedParticipants: v.optional(v.array(v.string())),
      }),
    ),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); bindDataActor(actor, args.participants.userId);
  bindDataActor(actor, args.collaborativeSettings?.ownerUserId);
  if (args.participantId !== undefined || args.participants.participantId !== undefined || args.participants.memorySpaceIds?.some(id => id !== actor.memorySpaceId)) transcriptDenied("INVALID_INPUT");
  if (args.visibility === "public") transcriptDenied("CAPABILITY_UNAVAILABLE");
  const reference = dataAuthorityReference(actor); const alias = boundedIdentifier(args.conversationId);
  const identity = canonicalModelJson(["conversation.compat.create.v1", actor.tenantId, actor.memorySpaceId, actor.principalId, alias]);
  const canonical = canonicalModelJson(args); const existing = await conversationById(ctx, reference, alias);
  if (existing) { await checkConversation(ctx, reference, existing, "write"); if (existing.creationCanonical !== canonical) transcriptDenied("IDEMPOTENCY_CONFLICT"); return view(existing); }
  const row = await createManagedConversation(ctx, actor, identity, canonical, { type: args.type, visibility: args.visibility,
    participants: [...args.participants.userIds ?? [], ...args.collaborativeSettings?.approvedParticipants ?? []], requireApproval: args.collaborativeSettings?.requireApproval });
  const metadataCanonical = metadataInput(args.metadata);
  await ctx.db.patch("runtimeConversations", row._id, { legacyConversationId: alias, ...(args.participants.agentId ? { legacyAgentLabel: args.participants.agentId } : {}), ...(metadataCanonical ? { metadataCanonical } : {}) });
  return view((await ctx.db.get("runtimeConversations", row._id))!);
} });

export const setVisibility = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    visibility: v.union(
      v.literal("private"),
      v.literal("space"),
      v.literal("public"),
    ),
    // For authorization - caller must provide their userId to verify ownership
    userId: v.optional(v.string()),
  }, handler: async (ctx, args) => {
  const { conversation, actor } = await requireConversation(ctx, args, args.conversationId, "admin"); bindDataActor(actor, args.userId);
  if (args.visibility === "public") transcriptDenied("CAPABILITY_UNAVAILABLE");
  await ctx.db.patch("runtimeConversations", conversation._id, { visibility: args.visibility, historyRevision: conversation.historyRevision + 1, executionRevision: executionRevision(conversation) + 1, updatedAt: Date.now() }); return view((await ctx.db.get("runtimeConversations", conversation._id))!);
} });

export const setMetadata = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    metadata: v.any(),
    // Required for authorization - must verify ownership before modifying metadata
    userId: v.string(),
  }, handler: async (ctx, args) => {
  const { conversation, actor } = await requireConversation(ctx, args, args.conversationId, "admin"); bindDataActor(actor, args.userId);
  const metadataCanonical = metadataInput(args.metadata); await ctx.db.patch("runtimeConversations", conversation._id, { metadataCanonical, updatedAt: Date.now() }); return view((await ctx.db.get("runtimeConversations", conversation._id))!);
} });

export const checkAccess = mutation({ args: {
    tenantId: v.optional(v.string()),
    conversationId: v.string(),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
  }, handler: async (ctx, args) => {
  const { conversation, actor, reference } = await requireConversation(ctx, args, args.conversationId, "read"); bindDataActor(actor, args.userId);
  let canEdit = false; try { await checkConversation(ctx, reference, conversation, "write"); canEdit = !conversation.manualWriteLocked; } catch (error) { if (!(error instanceof ConvexError) || error.data.code !== "FORBIDDEN") throw error; }
  return { canView: true, canEdit, visibility: conversation.visibility, reason: "CURRENT_AUTHORITY" };
} });

export const addMessage = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    message: v.object({
      id: v.string(),
      role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
      content: v.string(),
      participantId: v.optional(v.string()), // Hive Mode/Collaborative: which participant sent this
      metadata: v.optional(v.any()),
    }),
  }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "write");
  if (conversation.manualWriteLocked) transcriptDenied("TRANSCRIPT_LOCKED");
  if (args.message.role === "system" || args.message.participantId !== undefined || args.message.metadata !== undefined) transcriptDenied("INVALID_INPUT"); boundedIdentifier(args.message.id);
  const role = args.message.role === "agent" ? "assistant" as const : "user" as const;
  const parts = [{ type: "text" as const, text: args.message.content }]; const canonical = canonicalModelJson({ role, parts });
  const existing = await legacyBridge(ctx, conversation, args.message.id);
  if (existing) { if (existing.tombstonedAt !== undefined || existing.legacyRequestCanonical !== canonical || existing.actorReference.principalId !== reference.principalId) transcriptDenied("IDEMPOTENCY_CONFLICT"); return view(conversation); }
  const pins = await manualAppend(ctx, { ...args, conversationId: conversation.conversationId, role, parts, expectedRevision: conversation.historyRevision });
  const bridge = await bridgeFor(ctx, conversation, pins[0].nativeMessageId); if (!bridge) transcriptDenied("TRANSCRIPT_CONFLICT");
  await ctx.db.patch("runtimeTranscriptMessages", bridge._id, { legacyMessageId: args.message.id, legacyRequestCanonical: canonical }); return view((await ctx.db.get("runtimeConversations", conversation._id))!);
} });

export const approveMessage = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    messageId: v.string(),
    approverId: v.string(), // userId of the approver
  }, handler: async (ctx, args) => {
  const { conversation, actor, reference } = await requireConversation(ctx, args, args.conversationId, "admin"); bindDataActor(actor, args.approverId);
  const bridge = await legacyBridge(ctx, conversation, args.messageId); if (!bridge || bridge.runId) transcriptDenied("INVALID_STATE");
  await approveRegisteredMessage(ctx, conversation, bridge, reference); return view((await ctx.db.get("runtimeConversations", conversation._id))!);
} });

export const rejectMessage = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    messageId: v.string(),
    rejecterId: v.string(), // userId of the rejecter
  }, handler: async (ctx, args) => {
  const { conversation, actor } = await requireConversation(ctx, args, args.conversationId, "write"); bindDataActor(actor, args.rejecterId);
  const bridge = await legacyBridge(ctx, conversation, args.messageId); if (!bridge) transcriptDenied();
  await reviseMessage(ctx, { ...args, messageId: bridge.nativeMessageId, expectedRevision: conversation.historyRevision, expectedMessageRevision: bridge.revision }, true); return view((await ctx.db.get("runtimeConversations", conversation._id))!);
} });

export const deleteConversation = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
  }, handler: async (ctx, args) => {
  return await deleteManagedConversation(ctx, args);
} });

export const deleteMany = mutation({ args: {
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Filter by memory space
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    dryRun: v.optional(v.boolean()), // Preview what would be deleted
    confirmationThreshold: v.optional(v.number()), // Auto-confirm threshold (default: 10)
  }, handler: async (ctx, args) => {
  const { actor, rows } = await visible(ctx, args); bindDataActor(actor, args.userId); if (rows.length > 100) transcriptDenied("QUERY_TOO_BROAD");
  if (args.dryRun) return { totalMessagesDeleted: 0, deleted: 0, wouldDelete: rows.length, conversationIds: rows.map(row => row.conversationId), dryRun: true };
  const threshold = args.confirmationThreshold ?? 10; if (!Number.isSafeInteger(threshold) || threshold < 0 || rows.length > threshold) transcriptDenied("CONFIRMATION_REQUIRED");
  for (const row of rows) await deleteManagedConversation(ctx, { ...args, conversationId: row.conversationId }); return { totalMessagesDeleted: 0, deleted: rows.length, wouldDelete: rows.length, conversationIds: rows.map(row => row.conversationId), dryRun: false };
} });

export const deleteByIds = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationIds: v.array(v.string()),
  }, handler: async (ctx, args) => {
  if (!args.conversationIds.length || args.conversationIds.length > 100 || new Set(args.conversationIds).size !== args.conversationIds.length) transcriptDenied("INVALID_INPUT");
  const results = []; for (const conversationId of args.conversationIds) results.push(await deleteManagedConversation(ctx, { ...args, conversationId })); return { deleted: results.length, totalMessagesDeleted: 0, conversationIds: results.map(r => r.conversationId), results };
} });

export const purgeAll = internalMutation({ args: {}, handler: async (_ctx, _args) => {
  return await internalUnavailable();
} });

export const getMessage = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    messageId: v.string(),
  }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "read"); const bridge = await legacyBridge(ctx, conversation, args.messageId); if (!bridge) return null;
  return (await history(ctx, conversation, reference)).find(m => m.id === (bridge.legacyMessageId ?? bridge.nativeMessageId)) ?? null;
} });

export const getMessagesByIds = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    messageIds: v.array(v.string()),
  }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "read"); if (args.messageIds.length > 100) transcriptDenied("INVALID_INPUT");
  const messages = await history(ctx, conversation, reference); return args.messageIds.map(id => messages.find(m => m.id === id) ?? null);
} });

export const getOrCreate = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(), // NEW: Required
    participantId: v.optional(v.string()), // NEW: Hive Mode
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    participants: v.object({
      userId: v.optional(v.string()), // The human user in the conversation
      agentId: v.optional(v.string()), // v0.17.0: Required for user-agent conversations
      userIds: v.optional(v.array(v.string())), // Collaborative: multiple human users (Phase 4)
      participantId: v.optional(v.string()), // Hive Mode: who created this
      memorySpaceIds: v.optional(v.array(v.string())), // Collaboration Mode: cross-space
    }),
    metadata: v.optional(v.any()),
    // Visibility for shareable chats (Phase 1)
    visibility: v.optional(
      v.union(v.literal("private"), v.literal("space"), v.literal("public")),
    ),
    // Collaborative settings (Phase 4)
    collaborativeSettings: v.optional(
      v.object({
        requireApproval: v.boolean(),
        ownerUserId: v.optional(v.string()),
        approvedParticipants: v.optional(v.array(v.string())),
      }),
    ),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); bindDataActor(actor, args.participants.userId);
  bindDataActor(actor, args.collaborativeSettings?.ownerUserId);
  if (args.participantId !== undefined || args.participants.participantId !== undefined || args.participants.memorySpaceIds?.some(id => id !== actor.memorySpaceId)) transcriptDenied("INVALID_INPUT");
  if (args.visibility === "public") transcriptDenied("CAPABILITY_UNAVAILABLE");
  const reference = dataAuthorityReference(actor); const alias = `compat:${canonicalModelJson([args.type, args.participants])}`;
  const identity = canonicalModelJson(["conversation.compat.create.v1", actor.tenantId, actor.memorySpaceId, actor.principalId, alias]);
  const canonical = canonicalModelJson(args); const existing = await conversationById(ctx, reference, alias);
  if (existing) { await checkConversation(ctx, reference, existing, "write"); if (existing.creationCanonical !== canonical) transcriptDenied("IDEMPOTENCY_CONFLICT"); return view(existing); }
  const row = await createManagedConversation(ctx, actor, identity, canonical, { type: args.type, visibility: args.visibility,
    participants: [...args.participants.userIds ?? [], ...args.collaborativeSettings?.approvedParticipants ?? []], requireApproval: args.collaborativeSettings?.requireApproval });
  const metadataCanonical = metadataInput(args.metadata);
  await ctx.db.patch("runtimeConversations", row._id, { legacyConversationId: alias, ...(args.participants.agentId ? { legacyAgentLabel: args.participants.agentId } : {}), ...(metadataCanonical ? { metadataCanonical } : {}) });
  return view((await ctx.db.get("runtimeConversations", row._id))!);
} });

export const findConversation = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.string(), // NEW: Required
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),
    userId: v.optional(v.string()),
    memorySpaceIds: v.optional(v.array(v.string())),
  }, handler: async (ctx, args) => {
  if (args.memorySpaceIds?.some(id => id !== args.memorySpaceId)) transcriptDenied(); const { rows } = await visible(ctx, args); return rows[0] ? view(rows[0]) : null;
} });

export const get = mutation({ args: {
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy: filter by tenant
    includeMessages: v.optional(v.boolean()), // Default: true
    messageLimit: v.optional(v.number()), // Limit messages returned
  }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "read");
  const result = view(conversation); if (args.includeMessages !== false) { const limit = args.messageLimit ?? 1000; if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) transcriptDenied("INVALID_INPUT"); result.messages = (await history(ctx, conversation, reference)).slice(-limit); } return result;
} });

export const list = mutation({ args: {
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Filter by memory space
    tenantId: v.optional(v.string()), // Multi-tenancy: filter by tenant
    participantId: v.optional(v.string()), // Hive Mode tracking
    createdBefore: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    lastMessageBefore: v.optional(v.number()),
    lastMessageAfter: v.optional(v.number()),
    messageCountMin: v.optional(v.number()),
    messageCountMax: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("createdAt"),
        v.literal("updatedAt"),
        v.literal("lastMessageAt"),
        v.literal("messageCount"),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    includeMessages: v.optional(v.boolean()),
  }, handler: async (ctx, args) => {
  if (args.participantId !== undefined) transcriptDenied("INVALID_INPUT"); const { rows, reference } = await visible(ctx, args); const limit = args.limit ?? 100; const offset = args.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) transcriptDenied("INVALID_INPUT");
  const selected = rows.filter(row => (args.createdBefore === undefined || row.createdAt < args.createdBefore) && (args.createdAfter === undefined || row.createdAt > args.createdAfter)
    && (args.updatedBefore === undefined || row.updatedAt < args.updatedBefore) && (args.updatedAfter === undefined || row.updatedAt > args.updatedAfter)
    && (args.lastMessageBefore === undefined || row.updatedAt < args.lastMessageBefore) && (args.lastMessageAfter === undefined || row.updatedAt > args.lastMessageAfter)
    && (args.messageCountMin === undefined || row.messageCount >= args.messageCountMin) && (args.messageCountMax === undefined || row.messageCount <= args.messageCountMax));
  const sort = args.sortBy === "lastMessageAt" ? "updatedAt" : args.sortBy ?? "createdAt"; selected.sort((a,b) => (a[sort] - b[sort]) * (args.sortOrder === "asc" ? 1 : -1));
  const result = []; for (const row of selected.slice(offset, offset + limit)) { const item = view(row); if (args.includeMessages) item.messages = await history(ctx, row, reference); result.push(item); }
  return { conversations: result, total: selected.length, hasMore: offset + limit < selected.length, offset, limit };
} });

export const count = mutation({ args: {
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // NEW
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
  }, handler: async (ctx, args) => {
  return (await visible(ctx, args)).rows.length;
} });

export const getHistory = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    since: v.optional(v.number()), // Messages after timestamp
    until: v.optional(v.number()), // Messages before timestamp
    roles: v.optional(
      v.array(
        v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
      ),
    ), // Filter by role
  }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "read"); const limit = args.limit ?? 100; const offset = args.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 || !Number.isSafeInteger(offset) || offset < 0) transcriptDenied("INVALID_INPUT");
  const messages = (await history(ctx, conversation, reference)).filter(m => (args.since === undefined || m.timestamp >= args.since) && (args.until === undefined || m.timestamp <= args.until) && (!args.roles || args.roles.includes(m.role)));
  if (args.sortOrder === "desc") messages.reverse(); return { messages: messages.slice(offset, offset + limit), total: messages.length, hasMore: offset + limit < messages.length, conversationId: conversation.conversationId };
} });

export const search = mutation({ args: {
    tenantId: v.optional(v.string()),
    query: v.string(),
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // Filter by memory space
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    limit: v.optional(v.number()),
    searchIn: v.optional(
      v.union(v.literal("content"), v.literal("metadata"), v.literal("both")),
    ), // Default: "content"
    matchMode: v.optional(
      v.union(v.literal("contains"), v.literal("exact"), v.literal("fuzzy")),
    ), // Default: "contains"
  }, handler: async (ctx, args) => {
  if (!args.query || utf8Bytes(args.query) > 1024 || args.searchIn === "metadata" || args.matchMode === "fuzzy") transcriptDenied("INVALID_INPUT");
  const { rows, reference } = await visible(ctx, args); const limit = args.limit ?? 100; if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) transcriptDenied("INVALID_INPUT"); const results = [];
  for (const row of rows) { if (args.dateStart !== undefined && row.createdAt < args.dateStart || args.dateEnd !== undefined && row.createdAt > args.dateEnd) continue;
    const matches = (await history(ctx, row, reference)).filter(m => args.matchMode === "exact" ? m.content === args.query : m.content.toLowerCase().includes(args.query.toLowerCase())); if (matches.length) results.push({ conversation: view(row), matchedMessages: matches, highlights: matches.map(m => m.content), score: matches.length }); if (results.length >= limit) break; } return results;
} });

export const exportConversations = mutation({ args: {
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()), // NEW: Filter by memory space
    conversationIds: v.optional(v.array(v.string())),
    type: v.optional(
      v.union(v.literal("user-agent"), v.literal("agent-agent")),
    ),
    dateStart: v.optional(v.number()),
    dateEnd: v.optional(v.number()),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeMetadata: v.optional(v.boolean()),
  }, handler: async (ctx, args) => {
  const { reference, rows } = await visible(ctx, args); if (args.conversationIds && (args.conversationIds.length > 100 || new Set(args.conversationIds).size !== args.conversationIds.length)) transcriptDenied("INVALID_INPUT");
  const selected = args.conversationIds ? await Promise.all(args.conversationIds.map(async id => { const row = await conversationById(ctx, reference, id); if (!row) transcriptDenied(); await checkConversation(ctx, reference, row, "read"); return row; })) : rows;
  const records = []; for (const row of selected) { if (args.dateStart !== undefined && row.createdAt < args.dateStart || args.dateEnd !== undefined && row.createdAt > args.dateEnd) continue;
    await managedConversationAccess(ctx, reference, row, "read", "canExport"); const item = view(row); item.messages = await history(ctx, row, reference); if (!args.includeMetadata) item.metadata = undefined; records.push(item); if (utf8Bytes(JSON.stringify(records)) > 1_000_000) transcriptDenied("QUERY_TOO_BROAD"); }
  const data = args.format === "json" ? JSON.stringify(records) : ["conversationId,messageId,role,text", ...records.flatMap(c => c.messages.map(m => [c.conversationId,m.id,m.role,m.content].map(value => `"${value.replaceAll('"','""')}"`).join(",")))].join("\n");
  return { format: args.format, data, count: records.length, exportedAt: Date.now() };
} });
