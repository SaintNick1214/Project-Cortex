import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import { installMockRoot, transcriptFixture, runs, transcript } from "../runtimeTranscript/fixture";
import { saveMessages } from "@convex-dev/agent";
beforeEach(installMockRoot); afterEach(() => { jest.restoreAllMocks(); });
const claim = async (f: Awaited<ReturnType<typeof transcriptFixture>>, conversationId: string) =>
  await f.call<{ runId: string; attemptNumber: number; leaseVersion: number; snapshot: { messages: { nativeMessageId: string }[] } } | null>(runs.claimNext, { reference: f.reference, conversationId });
async function saveResponse(f: Awaited<ReturnType<typeof transcriptFixture>>, conversationId: string, promptMessageId: string) {
  const conversation = f.db.table("runtimeConversations").find(row => row.conversationId === conversationId)!;
  return await saveMessages(f.ctx, transcript.agentComponent, { threadId: conversation.threadId as string,
    userId: f.principal._id, promptMessageId, messages: [{ role: "assistant", content: "first response" }], failPendingSteps: false });
}
describe("durable scoped admissions and serialized recovery (controlled handlers)", () => {
  it("same exact request returns one run/event/budget/outbox; changed request cannot reuse identity", async () => {
    const f = await transcriptFixture(); const first = await f.run(); const writes = f.db.writes;
    expect(await f.run()).toEqual(first); expect(f.db.writes).toBe(writes); expect(f.effects.saves).toBe(1);
    expect(f.db.table("runtimeRunOutbox")).toHaveLength(1); expect(f.db.table("runtimeRuns")).toHaveLength(1);
    const changed = { ...f.request(), parts: [{ type: "text", text: "changed" }] };
    await expect(f.call(runs.submit, { request: changed })).rejects.toThrow(); expect(f.effects.saves).toBe(1);
    expect(f.native.threads.size).toBe(1); expect(f.db.table("runtimeTranscriptMessages")).toHaveLength(1);
  });
  it("a parent fault rolls back component, ledger, projection, queue and scheduled work in the controlled transaction", async () => {
    const f = await transcriptFixture(); const before = [...f.db.rows.entries()].map(([table, rows]) => [table, rows.length]);
    await expect(f.transaction(async () => { await runs.submitHandler(f.ctx, { request: f.request() }); throw new Error("post-write rollback"); })).rejects.toThrow("post-write rollback");
    expect([...f.db.rows.entries()].map(([table, rows]) => [table, rows.length]).filter(([, n]) => n)).toEqual(before.filter(([, n]) => n));
    expect(f.native.messages.size).toBe(0); expect(f.native.threads.size).toBe(0); expect(f.scheduled).toHaveLength(0);
    expect((await f.run()).queueSequence).toBe(1);
  });
  it("different request keys on one conversation have ordered immutable inputs and one active head", async () => {
    const f = await transcriptFixture(); const first = await f.run(); const second = await f.run("input-2", first.conversationId);
    expect([first.queueSequence, second.queueSequence]).toEqual([1, 2]); expect(f.effects.saves).toBe(2);
    const active = await claim(f, first.conversationId); expect(active?.runId).toBe(first.runId);
    expect(await claim(f, first.conversationId)).toBeNull();
    expect(await f.call(runs.recoverQueue, { reference: f.reference, conversationId: first.conversationId })).toEqual({ readyRunId: null });
  });
  it.each([false, true])("later queued input/approval preserves the running exact prefix (approval=%s)", async approval => {
    const f = await transcriptFixture();
    const created = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "prefix", requireApproval: approval });
    const first = await f.run("first", created.conversationId);
    if (approval) await f.call(runs.approve, { runId: first.runId, expectedDefinitionHash: f.published.definitionHash });
    const attempt = (await claim(f, created.conversationId))!;
    const attemptArgs = { reference: f.reference, runId: attempt.runId, attemptNumber: attempt.attemptNumber, leaseVersion: attempt.leaseVersion };
    const before = await f.call<{ messages: { role: string; parts: { text: string }[] }[] }>(runs.hydrate, attemptArgs);
    const second = await f.run("second", created.conversationId);
    if (approval) await f.call(runs.approve, { runId: second.runId, expectedDefinitionHash: f.published.definitionHash });
    expect(await f.call(runs.hydrate, attemptArgs)).toMatchObject({ messages: before.messages });
    expect(attempt.snapshot.messages.map(m => m.nativeMessageId)).toEqual(first.inputMessageIds);
    const saved = await saveResponse(f, created.conversationId, first.inputMessageIds[0]);
    const args = { ...attemptArgs, outputMessageIds: saved.messages.map(m => m._id) };
    expect(await f.call(runs.complete, args)).toMatchObject({ responseStatus: "complete" });
    await expect(f.call(runs.complete, args)).rejects.toThrow();
    expect(f.db.table("runtimeTranscriptMessages").filter(row => row.nativeMessageId === saved.messages[0]._id)).toHaveLength(1);
    const next = (await claim(f, created.conversationId))!; expect(next.runId).toBe(second.runId);
    expect(next.snapshot.messages.map(m => m.nativeMessageId)).toEqual([first.inputMessageIds[0], saved.messages[0]._id, second.inputMessageIds[0]]);
    const hydrated = await f.call<{ messages: { role: string }[] }>(runs.hydrate, { reference: f.reference, runId: next.runId, attemptNumber: next.attemptNumber, leaseVersion: next.leaseVersion });
    expect(hydrated.messages.map(m => m.role)).toEqual(["user", "assistant", "user"]);
  });
  it.each(["selected-edit", "policy-change", "selected-revision"])("running prefix still denies %s", async kind => {
    const f = await transcriptFixture(); const first = await f.run();
    await f.call(transcript.setPolicy, { conversationId: first.conversationId, expectedRevision: 1, manualWriteLocked: false });
    const attempt = (await claim(f, first.conversationId))!;
    const conversation = f.db.table("runtimeConversations")[0];
    if (kind === "selected-edit") await f.call(transcript.edit, { conversationId: first.conversationId, expectedRevision: conversation.historyRevision,
      messageId: first.inputMessageIds[0], expectedMessageRevision: 1, parts: [{ type: "text", text: "changed selected input" }] });
    if (kind === "policy-change") await f.call(transcript.setPolicy, { conversationId: first.conversationId, expectedRevision: conversation.historyRevision, requireApproval: true });
    if (kind === "selected-revision") f.db.table("runtimeTranscriptMessages")[0].revision = 2;
    await expect(f.call(runs.hydrate, { reference: f.reference, ...attempt })).rejects.toThrow();
    const saved = await saveResponse(f, first.conversationId, first.inputMessageIds[0]);
    await expect(f.call(runs.complete, { reference: f.reference, ...attempt, outputMessageIds: saved.messages.map(m => m._id) })).rejects.toThrow();
    expect(f.db.table("runtimeTranscriptMessages")).toHaveLength(1); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("running");
  });
  it.each(["queued", "running"])("cancel %s retires queue/attempt and obsolete attempt cannot attach output", async phase => {
    const f = await transcriptFixture(); const first = await f.run(); const second = await f.run("input-2", first.conversationId);
    const attempt = phase === "running" ? await claim(f, first.conversationId) : null;
    await f.call(runs.cancel, { runId: first.runId });
    expect(f.db.table("runtimeRunOutbox").find(row => row.runId === first.runId)?.state).toBe("complete");
    if (attempt) {
      expect(f.db.table("runtimeRunAttempts")[0].status).toBe("cancelled");
      const before = f.effects.saves; await expect(f.call(runs.complete, { reference: f.reference, ...attempt, outputMessageIds: ["unknown"] })).rejects.toThrow();
      expect(f.effects.saves).toBe(before); await expect(f.call(runs.fail, { reference: f.reference, ...attempt, failureCode: "MODEL_FAILED" })).rejects.toThrow();
    }
    expect(await f.call(runs.recoverQueue, { reference: f.reference, conversationId: first.conversationId })).toEqual({ readyRunId: second.runId });
    expect((await claim(f, first.conversationId))?.runId).toBe(second.runId);
  });
  it("expired claimed work is terminal reconciliation-required, cannot retry/output, and releases the queue head", async () => {
    const f = await transcriptFixture(); const first = await f.run(); const second = await f.run("input-2", first.conversationId);
    const attempt = await claim(f, first.conversationId); expect(attempt).not.toBeNull();
    const box = f.db.table("runtimeRunOutbox").find(row => row.runId === first.runId)!; box.leaseExpiresAt = Date.now() - 1;
    expect(await f.call(runs.recoverQueue, { reference: f.reference, conversationId: first.conversationId })).toEqual({ readyRunId: second.runId });
    expect(f.db.table("runtimeRuns").find(row => row.runId === first.runId)).toMatchObject({ responseStatus: "failed", failureCode: "LEASE_EXPIRED_REQUIRES_RECONCILIATION", attemptNumber: 1 });
    await expect(f.call(runs.complete, { reference: f.reference, ...attempt, outputMessageIds: ["unknown"] })).rejects.toThrow();
    expect((await claim(f, first.conversationId))?.runId).toBe(second.runId);
  });
  it("removal retires active outbox/attempt while lock protects the same canonical record", async () => {
    const f = await transcriptFixture(); const first = await f.run(); await claim(f, first.conversationId);
    await expect(f.call(runs.remove, { runId: first.runId })).rejects.toThrow();
    await f.call(transcript.setPolicy, { conversationId: first.conversationId, expectedRevision: 1, manualWriteLocked: false });
    await f.call(runs.remove, { runId: first.runId });
    expect(f.db.table("runtimeRuns")[0].tombstonedAt).toBeDefined(); expect(f.db.table("runtimeRunOutbox")[0].state).toBe("complete");
    expect(f.db.table("runtimeRunAttempts")[0].status).toBe("cancelled"); await expect(f.call(runs.get, { runId: first.runId })).rejects.toThrow();
  });
  it("approval materializes exact current source before a waiting input becomes claimable", async () => {
    const f = await transcriptFixture(); const created = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "approval", requireApproval: true });
    const run = await f.run("approved-1", created.conversationId); expect(run.responseStatus).toBe("waiting_approval"); expect(f.db.table("runtimeMemorySources")).toHaveLength(0);
    expect(await claim(f, created.conversationId)).toBeNull();
    await f.call(runs.approve, { runId: run.runId, expectedDefinitionHash: f.published.definitionHash });
    const bridge = f.db.table("runtimeTranscriptMessages")[0]; const source = f.db.table("runtimeMemorySources")[0];
    expect(bridge).toMatchObject({ approved: true, revision: 2 }); expect(source).toMatchObject({ lineage: { sourceId: bridge.sourceId, sourceEventId: bridge.sourceEventId, sourceRevision: 2, role: "user" }, transcriptOrigin: { conversationId: created.conversationId, nativeMessageId: run.inputMessageIds[0], conversationEpoch: 1 } });
    expect((await claim(f, created.conversationId))?.runId).toBe(run.runId);
  });
  it("retained completed history does not increase queue-head reads", async () => {
    const f = await transcriptFixture(); const first = await f.run(); const seed = f.db.table("runtimeRuns")[0];
    for (let i = 0; i < 2000; i++) f.db.seed("runtimeRuns", { ...seed, _id: `runtimeRuns:completed-${i}`, runId: `past-${i}`, responseStatus: "complete", queueSequence: -i });
    const query = f.db.query.bind(f.db); const probes: { index: string; limit: number }[] = [];
    jest.spyOn(f.db, "query").mockImplementation(table => {
      const builder = query(table); let index = ""; const withIndex = builder.withIndex;
      builder.withIndex = (name, cb) => { index = name; return withIndex(name, cb); };
      const take = builder.take; builder.take = async n => { if (table === "runtimeRuns") probes.push({ index, limit: n }); return await take(n); };
      if (table === "runtimeRuns") builder.collect = async () => { throw new Error("unbounded retained-history read"); };
      return builder;
    });
    expect((await claim(f, first.conversationId))?.runId).toBe(first.runId);
    expect(probes.filter(p => p.index === "by_conversation_status")).toEqual([{ index: "by_conversation_status", limit: 1 }, { index: "by_conversation_status", limit: 1 }, { index: "by_conversation_status", limit: 1 }]);
  });
  it("context-bound overflow is observable failure, not forever queued work", async () => {
    const f = await transcriptFixture(); const definition = f.db.table("runtimeAgentDefinitions")[0]; const input = JSON.parse(definition.definitionCanonical as string); input.context.maxContextTokens = 20;
    definition.definitionCanonical = f.canonical(input); definition.definitionHash = await f.hash(definition.definitionCanonical as string);
    const run = await f.run(); const result = await f.call(runs.claimNext, { reference: f.reference, conversationId: run.conversationId });
    expect(result).toMatchObject({ failureCode: "CONTEXT_LIMIT_EXCEEDED" }); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("failed"); expect(f.db.table("runtimeRunOutbox")[0].state).toBe("complete");
    expect(f.db.table("runtimeRunAttempts")).toHaveLength(0);
  });
  it.each(["no-jwt", "read-only", "foreign-space", "revoked", "definition-revoked"])("denies admission %s before native/budget/queue writes", async mode => {
    const f = await transcriptFixture(); const before = f.db.writes;
    if (mode === "no-jwt") f.identity(null); if (mode === "read-only") f.grant.capabilities = ["read"];
    if (mode === "revoked") f.grant.revokedAt = Date.now(); if (mode === "definition-revoked") f.db.table("runtimeAgentDefinitions")[0].revokedAt = Date.now();
    const request = mode === "foreign-space" ? { ...f.request(), conversationId: "foreign" } : f.request();
    await expect(f.call(runs.submit, { request })).rejects.toThrow(); expect(f.db.writes).toBe(before); expect(f.effects.saves).toBe(0); expect(f.native.threads.size).toBe(0);
  });
});
