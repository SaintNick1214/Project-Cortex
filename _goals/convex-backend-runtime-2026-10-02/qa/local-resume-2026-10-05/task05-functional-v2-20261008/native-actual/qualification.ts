/** Disposable-only native fixtures. No model dispatch or production fault flags. */
import { saveMessages } from "@convex-dev/agent";
import type { MessageDoc } from "@convex-dev/agent";
import type { PaginationResult } from "convex/server";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { recheckAuthority } from "./runtimeAuth";
import { submitHandler } from "./runs";
import { agentComponent, conversationById, checkConversation, registerMessages } from "./runtimeTranscript";
import { executableRegistryHash } from "./agentDefinitions";
import { ConvexMemoryRepository, memoryScope } from "./runtimeMemoryRepository";
import { prepareSourceContent, processingIdentityKey } from "../src/domain/sources";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../src/domain/profile";

const markerRef = makeFunctionReference<"mutation", { tenantId: string; memorySpaceId: string; marker: string }, null>("qualification:rollbackMarker") as unknown as FunctionReference<"mutation", "internal", { tenantId: string; memorySpaceId: string; marker: string }, null>;
export const rollbackMarker = internalMutation({ args: { tenantId: v.string(), memorySpaceId: v.string(), marker: v.string() }, handler: async (ctx, args) => {
  await ctx.db.insert("runtimeRunOutbox", { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, conversationId: "rollback-marker",
    runId: args.marker, sequence: 0, state: "pending", leaseVersion: 0, createdAt: Date.now(), updatedAt: Date.now() });
  return null;
} });
export const submitThenRollback = mutation({ args: { request: v.any(), marker: v.string(), tenantId: v.string(), memorySpaceId: v.string() }, handler: async (ctx, args) => {
  await submitHandler(ctx, { request: args.request });
  await ctx.scheduler.runAfter(0, markerRef, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, marker: args.marker });
  throw new Error("INTENTIONAL_PARENT_ROLLBACK_AFTER_AGENT_BUDGET_QUEUE_SCHEDULER");
} });
export const registryHash = internalQuery({ args: {}, handler: async () => await executableRegistryHash() });
export const state = internalQuery({ args: { reference: runtimeAuthorityReference }, handler: async (ctx, { reference }) => {
  await recheckAuthority(ctx, reference, { capability: "admin", tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId });
  const scopeRows = async <T extends { tenantId?: string; memorySpaceId?: string }>(rows: Promise<T[]>) => (await rows).filter(row => row.tenantId === reference.tenantId && (row.memorySpaceId === undefined || row.memorySpaceId === reference.memorySpaceId));
  const conversations = await scopeRows(ctx.db.query("runtimeConversations").collect());
  const runs = await scopeRows(ctx.db.query("runtimeRuns").collect());
  const outbox = await scopeRows(ctx.db.query("runtimeRunOutbox").collect());
  const accounts = await scopeRows(ctx.db.query("runtimeBudgetAccounts").collect());
  const bridges = await scopeRows(ctx.db.query("runtimeTranscriptMessages").collect());
  const sources = await scopeRows(ctx.db.query("runtimeMemorySources").collect());
  const projection = await scopeRows(ctx.db.query("runtimeTranscriptOutbox").collect());
  const nativeThreads = await ctx.runQuery(agentComponent.threads.listThreadsByUserId, { userId: reference.principalId,
    paginationOpts: { cursor: null, numItems: 100 }, order: "asc" });
  const nativeMessages: { threadId: string; count: number; positions: { id: string; order: number; stepOrder: number }[] }[] = [];
  for (const thread of nativeThreads.page) {
    let cursor: string | null = null; const positions: { id: string; order: number; stepOrder: number }[] = [];
    do {
      const page: PaginationResult<MessageDoc> = await ctx.runQuery(agentComponent.messages.listMessagesByThreadId, { threadId: thread._id, order: "asc", paginationOpts: { cursor, numItems: 100 } });
      positions.push(...page.page.map(m => ({ id: m._id, order: m.order, stepOrder: m.stepOrder })));
      if (page.isDone) break;
      if (!page.continueCursor || page.continueCursor === cursor) throw new Error("NONADVANCING_NATIVE_CURSOR");
      cursor = page.continueCursor;
    } while (true);
    nativeMessages.push({ threadId: thread._id, count: positions.length, positions });
  }
  return { counts: { conversations: conversations.length, runs: runs.length, outbox: outbox.length, accounts: accounts.length,
    bridges: bridges.length, sources: sources.length, projection: projection.length, nativeThreads: nativeThreads.page.length,
    nativeMessages: nativeMessages.reduce((n, thread) => n + thread.count, 0) },
    conversations: conversations.map(c => ({ conversationId: c.conversationId, threadId: c.threadId, historyRevision: c.historyRevision,
      messageCount: c.messageCount, manualWriteLocked: c.manualWriteLocked, tombstonedAt: c.tombstonedAt ?? null })),
    runs: runs.map(r => ({ runId: r.runId, conversationId: r.conversationId, queueSequence: r.queueSequence, responseStatus: r.responseStatus,
      inputMessageIds: r.inputMessageIds, runBudgetId: r.runBudgetId, attemptNumber: r.attemptNumber, snapshot: r.snapshotCanonical ? JSON.parse(r.snapshotCanonical) : null })),
    outbox: outbox.map(o => ({ runId: o.runId, sequence: o.sequence, state: o.state, leaseVersion: o.leaseVersion })),
    bridges: bridges.map(b => ({ nativeMessageId: b.nativeMessageId, sourceId: b.sourceId, revision: b.revision, tombstonedAt: b.tombstonedAt ?? null })),
    accounts: accounts.map(a => ({ runBudgetId: a.runBudgetId ?? null, kind: a.kind, reservedUnits: a.reservedUnits,
      settledUnits: a.settledUnits, uncertainUnits: a.uncertainUnits, activeConcurrency: a.activeConcurrency })), nativeMessages };
} });
export const seedTranscript = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string(), count: v.number() }, handler: async (ctx, args) => {
  if (!Number.isSafeInteger(args.count) || args.count < 1 || args.count > 150) throw new Error("INVALID_FIXTURE_COUNT");
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) throw new Error("MISSING_CONVERSATION");
  await checkConversation(ctx, args.reference, conversation, "admin");
  if (conversation.manualWriteLocked) throw new Error("TRANSCRIPT_LOCKED");
  const messages = Array.from({ length: args.count }, (_, i) => ({ role: "user" as const, content: [{ type: "text" as const, text: `history ${i}` }] }));
  const saved = await saveMessages(ctx, agentComponent, { threadId: conversation.threadId, userId: args.reference.principalId,
    order: "next", messages, metadata: messages.map(() => ({ reasoning: "HIDDEN_FIXTURE_METADATA" })), failPendingSteps: false });
  return await registerMessages(ctx, conversation, args.reference, saved.messages);
} });
export const appendNativeSameOrder = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string(), promptMessageId: v.string() }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) throw new Error("MISSING_CONVERSATION");
  await checkConversation(ctx, args.reference, conversation, "admin");
  const saved = await saveMessages(ctx, agentComponent, { threadId: conversation.threadId, promptMessageId: args.promptMessageId,
    messages: [{ role: "assistant", content: [{ type: "text", text: "late private unregistered same-order output" }] }], failPendingSteps: false });
  return saved.messages.map(m => ({ id: m._id, order: m.order, stepOrder: m.stepOrder }));
} });
export const removeNativeAnchor = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string(), messageId: v.string() }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) throw new Error("MISSING_CONVERSATION");
  await checkConversation(ctx, args.reference, conversation, "admin");
  return await ctx.runMutation(agentComponent.messages.deleteByIds, { messageIds: [args.messageId] });
} });
export const clearProjection = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string() }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) throw new Error("MISSING_CONVERSATION");
  await checkConversation(ctx, args.reference, conversation, "admin");
  const rows = await ctx.db.query("runtimeTranscriptOutbox").withIndex("by_conversation", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("conversationId", args.conversationId)).collect();
  for (const row of rows) await ctx.db.delete("runtimeTranscriptOutbox", row._id);
  await ctx.db.patch("runtimeConversations", conversation._id, { messageCount: 0 });
  return { removed: rows.length };
} });
export const seedDerived = internalMutation({ args: { reference: runtimeAuthorityReference, sourceId: v.string() }, handler: async (ctx, args) => {
  const repository = new ConvexMemoryRepository(ctx, args.reference, "write", ctx.db);
  const source = await repository.getSource(args.sourceId); if (!source) throw new Error("MISSING_SOURCE");
  const prepared = await prepareSourceContent(memoryScope(args.reference), source.lineage, source.content, { now: () => source.createdAt });
  const identity = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision,
    stage: "facts" as const, semanticPolicyVersion: "task05-controlled-derived-v1" };
  const receiptId = await processingIdentityKey(identity); const now = Date.now(); const factId = `fixture:${await semanticHash(args.sourceId)}`;
  const embedding = Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0);
  const facts = [{ _id: factId, factId, tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId!, ownerPrincipalId: source.ownerPrincipalId,
    lineage: source.lineage, extractionPolicyVersion: "task05-controlled-derived-v1", fact: "Controlled native derived fact", factType: "knowledge" as const,
    confidence: 100, sourceType: "conversation" as const, tags: [], version: 1, createdAt: now, updatedAt: now }];
  const vectors = prepared.chunks.map(chunk => ({ sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: identity.sourceRevision, vectorId: `fixture:${chunk.chunkId}`, chunkId: chunk.chunkId,
    tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId!, profile: DEFAULT_EMBEDDING_PROFILE, embedding, processingReceiptId: receiptId }));
  const committed = await repository.commitDerived({ source: { sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: identity.sourceRevision }, identity, chunks: prepared.chunks, vectors, facts, expectedFactVersions: { [factId]: 0 } });
  return { ...committed, factId, vectors: vectors.length };
} });
export const visibleDerived = internalQuery({ args: { reference: runtimeAuthorityReference }, handler: async (ctx, { reference }) => {
  const repository = new ConvexMemoryRepository(ctx, reference, "read");
  const rows = await ctx.db.query("runtimeMemoryVectors").collect();
  const selected = rows.filter(row => row.tenantId === reference.tenantId && row.memorySpaceId === reference.memorySpaceId);
  return { facts: (await repository.listFacts({ limit: 100 })).map(fact => ({ factId: fact.factId, sourceRevision: fact.lineage.sourceRevision })),
    vectors: (await repository.hydrateVectors(selected.map(row => ({ id: row._id, score: 1 })))).map(hit => ({ vectorId: hit.vector.vectorId, sourceRevision: hit.source.lineage.sourceRevision })) };
} });

export const journal = internalQuery({ args: { reference: runtimeAuthorityReference, conversationId: v.string() }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) throw new Error("MISSING_CONVERSATION");
  await checkConversation(ctx, args.reference, conversation, "admin");
  const rows = await ctx.db.query("runtimeTranscriptOutbox").withIndex("by_conversation", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("conversationId", conversation.conversationId)).collect();
  const bridges = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_conversation_position", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", args.reference.memorySpaceId!).eq("conversationId", conversation.conversationId)).collect();
  return { rows: rows.map(row => ({ nativeMessageId: row.nativeMessageId, sourceRevision: row.sourceRevision, state: row.state })),
    bridges: bridges.map(row => ({ nativeMessageId: row.nativeMessageId, revision: row.revision, approved: row.approved, actorPrincipalId: row.actorReference.principalId })) };
} });
export const noInference = internalQuery({ args: { reference: runtimeAuthorityReference }, handler: async (ctx, { reference }) => {
  await recheckAuthority(ctx, reference, { capability: "admin", tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId });
  const operations = (await ctx.db.query("runtimeModelOperations").collect()).filter(row => row.tenantId === reference.tenantId && row.memorySpaceId === reference.memorySpaceId);
  const ids = new Set(operations.map(row => row._id));
  const attempts = (await ctx.db.query("runtimeModelAttempts").collect()).filter(row => ids.has(row.operationDocumentId));
  return { modelOperations: operations.length, modelAttempts: attempts.length, dispatchCheckpoints: attempts.filter(row => row.checkpointAt !== undefined).length,
    reservedUnits: operations.reduce((n, row) => n + row.reservedUnits, 0), settledUnits: operations.reduce((n, row) => n + row.settledUnits, 0), uncertainUnits: operations.reduce((n, row) => n + row.uncertainUnits, 0) };
} });
