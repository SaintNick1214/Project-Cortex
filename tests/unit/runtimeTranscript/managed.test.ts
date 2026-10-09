import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
const { installMockRoot, installIngestionMockRoot, transcriptFixture, transcript, invoke, clock } = await import("./fixture");
const { ConvexMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
const { managedSourceIsCurrent, requireDataAuthority, recheckSourceWitnesses } = await import("../../../convex-dev/runtimeDataAuth");
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import type { Doc } from "../../../convex-dev/_generated/dataModel";
const conversations = await import("../../../convex-dev/conversations");
const shares = await import("../../../convex-dev/conversationShares");
const snapshots = await import("../../../convex-dev/conversationSnapshots");
beforeEach(installMockRoot); afterEach(() => { jest.restoreAllMocks(); });
async function unlock(f: Awaited<ReturnType<typeof transcriptFixture>>, conversationId: string) {
  const row = f.db.table("runtimeConversations").find(row => row.conversationId === conversationId)!;
  await f.call(transcript.setPolicy, { conversationId, expectedRevision: row.historyRevision, manualWriteLocked: false });
  return f.db.table("runtimeConversations").find(row => row.conversationId === conversationId)!;
}
async function append(f: Awaited<ReturnType<typeof transcriptFixture>>, conversationId: string, text: string) {
  const row = f.db.table("runtimeConversations").find(row => row.conversationId === conversationId)!;
  return await f.call(transcript.append, { conversationId, expectedRevision: row.historyRevision, role: "user", parts: [{ type: "text", text }] });
}
describe("canonical transcript lifetime/compatibility/privacy", () => {
  it("lock denies every manual legacy/current write while authorized read remains available", async () => {
    const f = await transcriptFixture(); const run = await f.run();
    await expect(append(f, run.conversationId, "blocked")).rejects.toThrow();
    await expect(f.call(conversations.addMessage, { conversationId: run.conversationId, message: { id: "legacy-1", role: "user", content: "blocked" } })).rejects.toThrow();
    await expect(f.call(conversations.rejectMessage, { conversationId: run.conversationId, messageId: run.inputMessageIds[0], rejecterId: "user-a" })).rejects.toThrow();
    await expect(f.call(conversations.deleteConversation, { conversationId: run.conversationId })).rejects.toThrow();
    expect(await f.call(transcript.get, { conversationId: run.conversationId })).toMatchObject({ messageCount: 1, manualWriteLocked: true });
    expect(f.effects).toMatchObject({ saves: 1, edits: 0, deletes: 0 }); expect(f.db.table("conversations")).toHaveLength(0);
  });
  it("legacy aliases/read/count/export append the same native store once and reject changed ID reuse", async () => {
    const f = await transcriptFixture(); const created = await f.call<{ conversationId: string }>(conversations.create, { conversationId: "legacy-conversation", memorySpaceId: "space-a", type: "user-agent", participants: { userId: "user-a", agentId: "discovery-label" } });
    await unlock(f, created.conversationId);
    const args = { conversationId: "legacy-conversation", message: { id: "legacy-message", role: "user", content: "one canonical text" } };
    await f.call(conversations.addMessage, args); await f.call(conversations.addMessage, args);
    await expect(f.call(conversations.addMessage, { ...args, message: { ...args.message, content: "changed" } })).rejects.toThrow();
    expect(f.effects.saves).toBe(1); expect(f.db.table("conversations")).toHaveLength(0);
    expect(await f.call(conversations.count, { memorySpaceId: "space-a" })).toBe(1);
    const view = await f.call<{ messages: { content: string }[] }>(conversations.get, { conversationId: "legacy-conversation" }); expect(view.messages.map(m => m.content)).toEqual(["one canonical text"]);
    const exported = await f.call<{ data: string }>(conversations.exportConversations, { conversationIds: [created.conversationId], format: "json" });
    expect(exported.data).toContain("one canonical text"); expect(exported.data).not.toMatch(/HIDDEN|PROVIDER_SECRET|threadId|authorityReference/);
  });
  it("unlocked edit preserves native ID, records actor/revision, and immediately invalidates facts/vectors/witnesses", async () => {
    installIngestionMockRoot();
    const f = await transcriptFixture({ maxContextTokens: 16384 }); const run = await f.run(); await unlock(f, run.conversationId);
    const bridge = f.db.table("runtimeTranscriptMessages")[0]; const source = f.db.table("runtimeMemorySources")[0];
    const old = { ...source, lineage: { ...(source.lineage as object) } } as unknown as Doc<"runtimeMemorySources">;
    const lineage = old.lineage;
    f.db.seed("facts", { factId: "fact-1", tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id, lineage,
      extractionPolicyVersion: "extract-1", fact: "test", factType: "knowledge", sourceType: "conversation", tags: [], version: 1, createdAt: clock, updatedAt: clock, confidence: 1 });
    const identity = { sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: 1, stage: "vectors", semanticPolicyVersion: "vectors-1" };
    f.db.seed("runtimeMemoryReceipts", { tenantId: "tenant-a", memorySpaceId: "space-a", receiptId: "receipt-1", identity });
    f.db.seed("runtimeMemoryChunks", { ...identity, tenantId: "tenant-a", memorySpaceId: "space-a", chunkId: "chunk-1",
      normalization: DEFAULT_EMBEDDING_PROFILE.normalization, chunking: DEFAULT_EMBEDDING_PROFILE.chunking,
      ordinal: 0, start: 0, end: old.content.length, text: old.content, textHash: old.contentHash });
    const vector = f.db.seed("runtimeMemoryVectors", { ...identity, tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id, vectorId: "vector-1", chunkId: "chunk-1", profileId: DEFAULT_EMBEDDING_PROFILE.profileId, profile: DEFAULT_EMBEDDING_PROFILE, embedding: Array(1536).fill(0), processingReceiptId: "receipt-1" });
    const repo = new ConvexMemoryRepository(f.ctx, f.reference, "read"); expect(await repo.listFacts({ limit: 100 })).toHaveLength(1);
    expect(await repo.hydrateVectors([{ id: vector._id as never, score: 0.5 }])).toHaveLength(1);
    const conversation = f.db.table("runtimeConversations")[0];
    await f.call(transcript.edit, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, messageId: run.inputMessageIds[0], expectedMessageRevision: 1, parts: [{ type: "text", text: "edited" }] });
    expect(f.native.messages.has(run.inputMessageIds[0])).toBe(true); expect(f.effects.edits).toBe(1); expect(f.effects.saves).toBe(1);
    expect(f.db.table("runtimeTranscriptMessages")[0]).toMatchObject({ revision: 2, actorReference: f.reference }); expect(bridge.nativeMessageId).toBe(run.inputMessageIds[0]);
    expect(await repo.listFacts({ limit: 100 })).toEqual([]); expect(await repo.hydrateVectors([{ id: vector._id as never, score: 0.5 }])).toEqual([]);
    const authority = await requireDataAuthority(f.ctx, {}, "read"); await expect(recheckSourceWitnesses(f.ctx, authority, "read", [old])).rejects.toThrow();
  });
  it.each(["conversation-delete", "retention", "bridge-delete", "bridge-revision", "run-delete"])("origin fence immediately excludes %s without waiting cleanup", async kind => {
    const f = await transcriptFixture(); await f.run(); const source = f.db.table("runtimeMemorySources")[0] as unknown as Doc<"runtimeMemorySources">;
    expect(await managedSourceIsCurrent(f.ctx, f.reference, source, "read")).toBe(true);
    if (kind === "conversation-delete") f.db.table("runtimeConversations")[0].tombstonedAt = Date.now();
    if (kind === "retention") f.db.table("runtimeConversations")[0].retentionUntil = Date.now();
    if (kind === "bridge-delete") f.db.table("runtimeTranscriptMessages")[0].tombstonedAt = Date.now();
    if (kind === "bridge-revision") f.db.table("runtimeTranscriptMessages")[0].revision = 2;
    if (kind === "run-delete") f.db.table("runtimeRuns")[0].tombstonedAt = Date.now();
    expect(await managedSourceIsCurrent(f.ctx, f.reference, source, "read")).toBe(false);
    await expect(new ConvexMemoryRepository(f.ctx, f.reference, "read").getSource(source.lineage.sourceId)).rejects.toThrow();
  });
  it("105 canonical messages cross every page; rebuild repairs outbox holes and explicit fork gets a distinct store", async () => {
    const f = await transcriptFixture(); const run = await f.run(); await unlock(f, run.conversationId);
    for (let i = 0; i < 104; i++) await append(f, run.conversationId, `history ${i}`);
    const page1 = await f.call<{ page: unknown[]; continueCursor: string }>(transcript.messages, { conversationId: run.conversationId, limit: 37 });
    const pages = [...page1.page]; let cursor: string | null = page1.continueCursor;
    while (cursor) { const page: { page: unknown[]; continueCursor: string | null } = await f.call<{ page: unknown[]; continueCursor: string | null }>(transcript.messages, { conversationId: run.conversationId, limit: 37, cursor }); pages.push(...page.page); cursor = page.continueCursor; }
    expect(pages).toHaveLength(105);
    f.db.rows.set("runtimeTranscriptOutbox", []); f.db.table("runtimeConversations")[0].messageCount = 0;
    expect(await f.call(transcript.rebuild, { reference: f.reference, conversationId: run.conversationId })).toEqual({ registeredMessages: 105 }); expect(f.db.table("runtimeTranscriptOutbox")).toHaveLength(105);
    const original = f.db.table("runtimeConversations")[0]; const forked = await f.call<{ conversationId: string }>(transcript.fork, { conversationId: run.conversationId, expectedRevision: original.historyRevision, clientRequestId: "explicit-fork" });
    expect(forked.conversationId).not.toBe(run.conversationId); expect(f.native.threads.size).toBe(2); expect(f.native.messages.size).toBe(210);
    expect(await f.call(transcript.fork, { conversationId: run.conversationId, expectedRevision: original.historyRevision, clientRequestId: "explicit-fork" })).toMatchObject({ conversationId: forked.conversationId }); expect(f.native.messages.size).toBe(210);
  });
  it("stored cutoff excludes later same-order native steps and missing exact input anchor never broadens", async () => {
    const f = await transcriptFixture(); const run = await f.run(); const conversation = f.db.table("runtimeConversations")[0]; const input = f.native.messages.get(run.inputMessageIds[0])!;
    f.native.messages.set("late-native", { ...input, _id: "late-native", stepOrder: 1, message: { role: "assistant", content: "future output" } });
    const snapshot = await transcript.captureCutoff(f.ctx, conversation as never, f.db.table("runtimeRuns")[0] as never, [], 160_000);
    expect(snapshot.messages.map(p => p.nativeMessageId)).toEqual(run.inputMessageIds);
    f.native.messages.delete(run.inputMessageIds[0]); await expect(transcript.captureCutoff(f.ctx, conversation as never, f.db.table("runtimeRuns")[0] as never, [], 160_000)).rejects.toThrow();
  });
  it("only allowlisted text/status/parts escape native hidden reasoning/provider metadata", async () => {
    const f = await transcriptFixture(); const run = await f.run(); const native = f.native.messages.get(run.inputMessageIds[0])!;
    native.providerMetadata = { token: "CREDENTIAL_SENTINEL" }; native.reasoning = "RAW_REASONING_SENTINEL"; native.usage = { extra: "HIDDEN_CONTEXT_SENTINEL" };
    const view = await f.call(transcript.messages, { conversationId: run.conversationId }); expect(JSON.stringify(view)).not.toMatch(/CREDENTIAL|REASONING|HIDDEN|providerMetadata|authorityReference/);
  });
  it("metadata-only snapshots pin full history and become stale on tracked edit rather than serving old text", async () => {
    const f = await transcriptFixture(); const run = await f.run(); await unlock(f, run.conversationId);
    const snapshot = await f.call<{ snapshotId: string }>(snapshots.create, { conversationId: run.conversationId, createdBy: "user-a" });
    const row = f.db.table("runtimeConversationSnapshots")[0]; expect(row.pins).toHaveLength(1); expect(row).not.toHaveProperty("messages"); expect(JSON.stringify(row)).not.toContain("Hello");
    expect(await f.call(snapshots.get, { snapshotId: snapshot.snapshotId })).toMatchObject({ messages: [{ content: "Hello \nworld!" }] });
    const conversation = f.db.table("runtimeConversations")[0]; await f.call(transcript.edit, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, messageId: run.inputMessageIds[0], expectedMessageRevision: 1, parts: [{ type: "text", text: "new" }] });
    await expect(f.call(snapshots.get, { snapshotId: snapshot.snapshotId })).rejects.toThrow();
  });
  it("deleted conversation has immediate source denial and paged metadata cleanup survives original grant revocation", async () => {
    const f = await transcriptFixture(); const run = await f.run(); await unlock(f, run.conversationId);
    const source = f.db.table("runtimeMemorySources")[0]; await f.call(transcript.remove, { conversationId: run.conversationId });
    expect(source.tombstonedAt).toBeUndefined(); await expect(new ConvexMemoryRepository(f.ctx, f.reference, "read").getSource((source.lineage as { sourceId: string }).sourceId)).rejects.toThrow();
    f.grant.revokedAt = Date.now();
    for (let i = 0; i < f.scheduled.length; i++) { const work = f.scheduled[i]; if (work.name === "runtimeTranscript:cleanupDeleted") await invoke(transcript.cleanupDeleted, f.ctx, work.args); }
    expect(source.tombstonedAt).toBeDefined(); expect(f.db.table("runtimeRunOutbox")[0].state).toBe("complete"); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("cancelled");
  });
  it("shares require existing JWT/scope, honor revoked permission, and cannot unlock managed writes", async () => {
    const f = await transcriptFixture(); const run = await f.run();
    const snapshot = await f.call<{ snapshotId: string }>(snapshots.create, { conversationId: run.conversationId, createdBy: "user-a" });
    expect(await f.call(snapshots.get, { snapshotId: snapshot.snapshotId })).toMatchObject({ messages: [{ content: "Hello \nworld!" }] });
    const second = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-b", actorKind: "user", version: 1 });
    const member = f.db.seed("runtimeAuthMemberships", { principalId: second._id, tenantId: "tenant-a", version: 1 });
    f.db.seed("runtimeAuthGrants", { principalId: second._id, membershipId: member._id, tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write"], resourceAccess: "scope", version: 1 });
    const created = await f.call<{ shareId: string }>(shares.create, { conversationId: run.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: second._id,
      permissions: { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: false } });
    f.identity({ issuer: "https://host.test", subject: "user-b" }); expect(await f.call(transcript.get, { conversationId: run.conversationId })).toMatchObject({ conversationId: run.conversationId });
    await expect(f.call(transcript.exportPage, { conversationId: run.conversationId })).rejects.toThrow(); await expect(append(f, run.conversationId, "no")).rejects.toThrow();
    await expect(f.call(snapshots.get, { snapshotId: snapshot.snapshotId })).rejects.toThrow();
    f.identity(null); await expect(f.call(transcript.get, { conversationId: run.conversationId })).rejects.toThrow();
    f.identity({ issuer: "https://host.test", subject: "user-a" }); await f.call(shares.revoke, { shareId: created.shareId });
    f.identity({ issuer: "https://host.test", subject: "user-b" }); await expect(f.call(transcript.get, { conversationId: run.conversationId })).rejects.toThrow();
  });
  it("unsupported view limits deny before a share is persisted", async () => {
    const f = await transcriptFixture(); const run = await f.run(); const writes = f.db.writes;
    await expect(f.call(shares.create, { conversationId: run.conversationId, grantedBy: "user-a", grantType: "space", grantedTo: "space-a", maxViews: 1,
      permissions: { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: false } })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeConversationShares")).toHaveLength(0);
  });
});
