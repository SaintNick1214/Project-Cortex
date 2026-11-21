/** Private bounded qualification module, never shipped. Identity probes use public
 * registrations only in the disposable backend: native impersonation cannot call internals. */
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation } from "../../../convex-dev/_generated/server";
import { ingestExternalSourceHandler } from "../../../convex-dev/runtimeExternalSources";
import { saveMessages } from "@convex-dev/agent";
import { agentComponent, conversationById, createManagedConversation, registerMessages } from "../../../convex-dev/runtimeTranscript";
import { dataAuthorityReference, requireDataAuthority } from "../../../convex-dev/runtimeDataAuth";

function owned(tenantId: string, memorySpaceId: string): void {
  if (!/^external-native-[0-9a-f-]{36}$/.test(tenantId) || !memorySpaceId.startsWith(tenantId + "/")) {
    throw new ConvexError("FIXTURE_OWNERSHIP_REQUIRED");
  }
}

/** A genuine Convex mutation rolls back the production handler's entire write set. */
export const ingestThenRollback = mutation({
  args: { tenantId: v.string(), memorySpaceId: v.string(), requestId: v.string(), input: v.any() },
  handler: async (ctx, args) => {
    owned(args.tenantId, args.memorySpaceId);
    await ingestExternalSourceHandler(ctx, args);
    throw new ConvexError({ version: 1, code: "FIXTURE_ROLLBACK", outcome: "not_dispatched", retryable: false });
  },
});

/** Native deterministic Date.now gives two genuine source events the same timestamp. */
export const ingestPair = mutation({
  args: { tenantId: v.string(), memorySpaceId: v.string(), requestId: v.string(), inputs: v.array(v.any()) },
  handler: async (ctx, args) => {
    owned(args.tenantId, args.memorySpaceId);
    if (args.inputs.length !== 2) throw new ConvexError("FIXTURE_PAIR_REQUIRED");
    const first = await ingestExternalSourceHandler(ctx, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, requestId: args.requestId + ":0", input: args.inputs[0] });
    const second = await ingestExternalSourceHandler(ctx, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, requestId: args.requestId + ":1", input: args.inputs[1] });
    return [first, second];
  },
});

/** Bounded private readback distinguishes actual persisted rows from public projections. */
export const inspect = internalQuery({
  args: { tenantId: v.string(), memorySpaceId: v.string() },
  handler: async (ctx, args) => {
    owned(args.tenantId, args.memorySpaceId);
    const tables = ["runtimeExternalSources", "runtimeExternalVersions", "runtimeExternalObservations", "runtimeMemorySources",
      "runtimeMemoryChunks", "runtimeMemoryVectors", "runtimeMemoryReceipts", "runtimeIngestionEvents", "runtimeIngestionStages",
      "facts", "runtimeTranscriptMessages", "runtimeConversations", "runtimeSourceDependencies", "runtimeChangeEvents"] as const;
    const values = await Promise.all(tables.map(async table => [table, await ctx.db.query(table).filter(q => q.and(
      q.eq(q.field("tenantId"), args.tenantId), q.eq(q.field("memorySpaceId"), args.memorySpaceId))).take(128)] as const));
    if (values.some(([, rows]) => rows.length === 128)) throw new ConvexError("FIXTURE_INSPECTION_BOUND");
    const operations = await ctx.db.query("runtimeModelOperations").withIndex("by_identity", q =>
      q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).take(32);
    if (operations.length === 32) throw new ConvexError("FIXTURE_INSPECTION_BOUND");
    const attempts = await Promise.all(operations.map(operation => ctx.db.query("runtimeModelAttempts")
      .withIndex("by_operation", q => q.eq("operationDocumentId", operation._id)).take(16)));
    if (attempts.some(rows => rows.length === 16)) throw new ConvexError("FIXTURE_INSPECTION_BOUND");
    return { ...Object.fromEntries(values), runtimeModelOperations: operations, runtimeModelAttempts: attempts.flat() };
  },
});

/** Real component writes are nested in the same native parent transaction. */
export const createConversation = mutation({
  args: { tenantId: v.string(), memorySpaceId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    owned(args.tenantId, args.memorySpaceId);
    const actor = await requireDataAuthority(ctx, args, "write");
    const conversation = await createManagedConversation(ctx, actor, args.id, args.id);
    return { conversationId: conversation.conversationId };
  },
});
export const componentMessages = mutation({
  args: { tenantId: v.string(), memorySpaceId: v.string(), conversationId: v.string() },
  handler: async (ctx, args) => {
    owned(args.tenantId, args.memorySpaceId);
    const actor = await requireDataAuthority(ctx, args, "read");
    const conversation = await conversationById(ctx, dataAuthorityReference(actor), args.conversationId);
    if (!conversation || conversation.ownerPrincipalId !== actor.principalId) throw new ConvexError("FIXTURE_OWNERSHIP_REQUIRED");
    return ctx.runQuery(agentComponent.messages.listMessagesByThreadId, { threadId: conversation.threadId, order: "asc", paginationOpts: { cursor: null, numItems: 16 } });
  },
});
export const ingestComponentThenRollback = mutation({
  args: { tenantId: v.string(), memorySpaceId: v.string(), conversationId: v.string(), requestId: v.string(), input: v.any() },
  handler: async (ctx, args) => {
    owned(args.tenantId, args.memorySpaceId);
    const actor = await requireDataAuthority(ctx, args, "write"), reference = dataAuthorityReference(actor);
    const conversation = await conversationById(ctx, reference, args.conversationId);
    if (!conversation || conversation.ownerPrincipalId !== actor.principalId) throw new ConvexError("FIXTURE_OWNERSHIP_REQUIRED");
    await ingestExternalSourceHandler(ctx, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, requestId: args.requestId, input: args.input });
    const saved = await saveMessages(ctx, agentComponent, { threadId: conversation.threadId, messages: [{ role: "assistant", content: "PRIVATE-COMPONENT-ROLLBACK" }] });
    await registerMessages(ctx, conversation, reference, saved.messages);
    throw new ConvexError({ version: 1, code: "FIXTURE_ROLLBACK", outcome: "not_dispatched", retryable: false });
  },
});
/** Controlled derived copy using real registration/cleanup; no inference is represented. */
export const appendDerived = mutation({
  args: { tenantId: v.string(), memorySpaceId: v.string(), conversationId: v.string(), sourceId: v.string() },
  handler: async (ctx, args) => {
    owned(args.tenantId, args.memorySpaceId);
    const actor = await requireDataAuthority(ctx, args, "write"), reference = dataAuthorityReference(actor);
    const conversation = await conversationById(ctx, reference, args.conversationId);
    if (!conversation || conversation.ownerPrincipalId !== actor.principalId) throw new ConvexError("FIXTURE_OWNERSHIP_REQUIRED");
    const source = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("lineage.sourceId", args.sourceId)).unique();
    if (!source || source.ownerPrincipalId !== actor.principalId || source.lineage.role !== "external") throw new ConvexError("FIXTURE_SOURCE_REQUIRED");
    const saved = await saveMessages(ctx, agentComponent, { threadId: conversation.threadId, messages: [
      { role: "user", content: "Authored fixture message survives source erasure." },
      { role: "assistant", content: source.content },
    ] });
    await registerMessages(ctx, conversation, reference, saved.messages, { contextSourceWitnesses: [{ sourceId: source.lineage.sourceId,
      sourceRevision: source.lineage.sourceRevision, sourceEventId: source.lineage.sourceEventId, contentHash: source.contentHash }] });
    return { messageCount: saved.messages.length };
  },
});
