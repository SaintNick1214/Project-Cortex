import { checkArtifactContextWitnesses } from "./runtimeArtifactContext";
/** Metadata-only native transcript snapshots. No second executable history is persisted. */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { publicTextParts } from "../src/domain/transcript";
import type { MessagePin } from "../src/domain/transcript";
import { bindDataActor, dataAuthorityReference, managedConversationAccess, requireDataAuthority } from "./runtimeDataAuth";
import { agentComponent, bridgeFor, checkConversation, conversationById, readTranscriptPage, requireConversation, singleTranscript, transcriptDenied, verifyMessage } from "./runtimeTranscript";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";

async function snapshotById(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, snapshotId: string) {
  return singleTranscript(await ctx.db.query("runtimeConversationSnapshots").withIndex("by_scoped_id", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("snapshotId", snapshotId)).take(2));
}
function metadata(row: Doc<"runtimeConversationSnapshots">) { return { _id: row._id, snapshotId: row.snapshotId, conversationId: row.conversationId, createdAt: row.createdAt, messageCount: row.pins.length, historyRevision: row.historyRevision, messages: [] as { id: string; role: "user" | "agent"; content: string; timestamp: number }[],
  memorySpaceId: row.memorySpaceId, tenantId: row.tenantId, createdBy: row.ownerPrincipalId, conversationType: "user-agent" as const, participants: {}, includedContent: { messages: true, facts: false, memories: false }, redaction: { piiRedacted: row.redactPII, messagesRedactedBefore: row.redactBefore }, status: "active" as const, snapshotOf: row.createdAt }; }
function redact(text: string) { return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]").replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]"); }
async function hydrate(ctx: Pick<QueryCtx, "db" | "runQuery">, reference: RuntimeAuthorityReference, row: Doc<"runtimeConversationSnapshots">) {
  if (row.tombstonedAt !== undefined) transcriptDenied();
  const conversation = await conversationById(ctx, reference, row.conversationId); if (!conversation) transcriptDenied();
  await managedConversationAccess(ctx, reference, conversation, "read", "canExport");
  if (conversation.epoch !== row.conversationEpoch) transcriptDenied("STALE_TRANSCRIPT");
  const messages = [];
  for (let offset = 0; offset < row.pins.length; offset += 100) {
    const pins = row.pins.slice(offset, offset + 100);
    const natives = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: pins.map(p => p.nativeMessageId) });
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i]; const bridge = await bridgeFor(ctx, conversation, pin.nativeMessageId);
      if (!bridge || !bridge.approved || bridge.revision !== pin.sourceRevision || bridge.sourceEventId !== pin.sourceEventId
        || bridge.contentHash !== pin.contentHash || bridge.order !== pin.order || bridge.stepOrder !== pin.stepOrder) transcriptDenied("STALE_TRANSCRIPT");
      await verifyMessage(ctx, conversation, bridge, natives[i]);
      await checkContextSourceWitnesses(ctx, reference, bridge.contextSourceWitnesses ?? []);
      await checkArtifactContextWitnesses(ctx, reference, bridge.artifactContextWitnesses ?? []);
      if (row.redactBefore !== undefined && bridge.createdAt < row.redactBefore) continue;
      const parts = publicTextParts(natives[i]!.message!.content);
      const visible = parts.map(p => ({ type: "text" as const, text: row.redactPII ? redact(p.text) : p.text }));
      messages.push({ id: bridge.nativeMessageId, role: bridge.role === "assistant" ? "agent" as const : "user" as const, content: visible.map(p => p.text).join("\n"), timestamp: bridge.createdAt, order: bridge.order, stepOrder: bridge.stepOrder,
        parts: visible, status: natives[i]!.status, revision: bridge.revision });
    }
  }
  return { ...metadata(row), messages };
}

export const create = mutation({ args: {
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    createdBy: v.string(),
    
    // Redaction options
    redactPII: v.optional(v.boolean()),
    redactBefore: v.optional(v.number()),
    customRedactions: v.optional(v.array(v.object({
      pattern: v.string(),
      replacement: v.string(),
    }))),
    
    // Include options
    includeFacts: v.optional(v.boolean()),
    includeMemories: v.optional(v.boolean()),
    
    // Multi-tenancy
    tenantId: v.optional(v.string()),
  }, handler: async (ctx, args) => {
  const { actor, reference, conversation } = await requireConversation(ctx, args, args.conversationId, "write"); bindDataActor(actor, args.createdBy);
  await managedConversationAccess(ctx, reference, conversation, "read", "canExport");
  if (args.includeFacts || args.includeMemories || args.customRedactions?.length) transcriptDenied("CAPABILITY_UNAVAILABLE");
  if (args.redactBefore !== undefined && !Number.isSafeInteger(args.redactBefore)) transcriptDenied("INVALID_INPUT");
  const pins: MessagePin[] = []; let cursor: string | null = null;
  do { const page = await readTranscriptPage(ctx, conversation, reference, cursor, 100); for (const message of page.page) {
      if (message.status !== "success") continue; const bridge = await bridgeFor(ctx, conversation, message.id); if (!bridge) transcriptDenied("STALE_TRANSCRIPT");
      pins.push({ nativeMessageId: message.id, order: message.order, stepOrder: message.stepOrder, sourceEventId: bridge.sourceEventId, sourceRevision: bridge.revision, contentHash: bridge.contentHash });
    } if (pins.length > 1000) transcriptDenied("QUERY_TOO_BROAD"); cursor = page.continueCursor;
  } while (cursor !== null);
  const snapshotId = `snapshot:${crypto.randomUUID()}`; const id = await ctx.db.insert("runtimeConversationSnapshots", { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId,
    ownerPrincipalId: actor.principalId, snapshotId, conversationId: conversation.conversationId, conversationEpoch: conversation.epoch, historyRevision: conversation.historyRevision,
    pins, redactPII: args.redactPII ?? false, ...(args.redactBefore === undefined ? {} : { redactBefore: args.redactBefore }), actorReference: reference, createdAt: Date.now() });
  return metadata((await ctx.db.get("runtimeConversationSnapshots", id))!);
} });

export const deleteSnapshot = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    snapshotId: v.string(),
    userId: v.optional(v.string()),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); bindDataActor(actor, args.userId); const reference = dataAuthorityReference(actor);
  const row = await snapshotById(ctx, reference, args.snapshotId); if (!row || row.ownerPrincipalId !== actor.principalId) transcriptDenied();
  const conversation = await conversationById(ctx, reference, row.conversationId); if (!conversation) transcriptDenied(); await checkConversation(ctx, reference, conversation, "write");
  if (row.tombstonedAt === undefined) await ctx.db.patch("runtimeConversationSnapshots", row._id, { tombstonedAt: Date.now() }); return { deleted: true as const };
} });

export const get = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    snapshotId: v.string(),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor);
  const row = await snapshotById(ctx, reference, args.snapshotId); if (!row) return null; return await hydrate(ctx, reference, row);
} });

export const listByConversation = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    includeArchived: v.optional(v.boolean()),
  }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "read");
  return (await ctx.db.query("runtimeConversationSnapshots").withIndex("by_conversation", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("conversationId", conversation.conversationId)).take(100)).filter(row => row.tombstonedAt === undefined).map(metadata);
} });

export const listByUser = mutation({ args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    userId: v.string(),
    includeArchived: v.optional(v.boolean()),
  }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); bindDataActor(actor, args.userId); const reference = dataAuthorityReference(actor);
  const rows = await ctx.db.query("runtimeConversationSnapshots").withIndex("by_owner", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("ownerPrincipalId", actor.principalId)).take(100);
  const result = []; for (const row of rows) { if (row.tombstonedAt !== undefined) continue; const conversation = await conversationById(ctx, reference, row.conversationId); if (!conversation || conversation.tombstonedAt !== undefined) continue; await checkConversation(ctx, reference, conversation, "read"); result.push(metadata(row)); } return result;
} });
