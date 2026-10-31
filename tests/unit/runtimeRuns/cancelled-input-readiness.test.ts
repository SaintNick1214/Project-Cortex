/** Real registered handlers with controlled DB/model ports; no hosted inference claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { MemoryModel } from "../../../src/domain/contracts";
import type { CutoffV1 } from "../../../src/domain/transcript";
import { evaluateMemoryBarrier } from "../../../src/domain/memory-context";
import { ingestionFixture, ingestion, installIngestionMockRoot } from "../runtimeIngestion/fixture";
import { definitions, runs, transcript } from "../runtimeTranscript/fixture";
const context = await import("../../../convex-dev/runtimeMemoryContext");
type Fixture = Awaited<ReturnType<typeof ingestionFixture>>;
beforeEach(installIngestionMockRoot);
afterEach(() => { jest.restoreAllMocks(); });

async function waiting(f: Fixture, key = "cancel-input") {
  const conversation = await f.call<{ conversationId: string }>(transcript.create,
    { memorySpaceId: "space-a", clientRequestId: key, requireApproval: true });
  return await f.run(key, conversation.conversationId);
}
function event(f: Fixture, runId: string) {
  return f.db.table("runtimeIngestionEvents").find(row => row.runId === runId && row.eligibility !== "superseded")!;
}
function body(f: Fixture) { return f.canonical([...f.db.rows].filter(([, rows]) => rows.length)); }
function noDerivedEffects(f: Fixture) {
  for (const table of ["runtimeMemorySources", "runtimeMemoryChunks", "runtimeMemoryVectors", "runtimeModelOperations", "runtimeModelAttempts", "runtimeAgentOperations"]) {
    expect(f.db.table(table)).toEqual([]);
  }
}
async function complete(f: Fixture, eventId: string) {
  // Existing controlled extraction fixture supplies its native ledger parent;
  // it does not claim a paid dispatch or materialize the cancelled source.
  await f.extraction(eventId, []);
  const model: MemoryModel = { extract: jest.fn(async () => ({ facts: [] })),
    resolve: jest.fn(async () => { throw new Error("Unexpected controlled resolver"); }),
    embed: jest.fn<MemoryModel["embed"]>(async request => ({ profile: request.profile, vectors: request.texts.map(() => Array<number>(request.profile.dimensions).fill(0.25)) })) };
  for (const stage of ["facts", "vectors"] as const) {
    await ingestion.processStageHandler(f.ctx as unknown as ActionCtx, { reference: f.reference, eventId, stage }, () => model);
  }
  expect(f.db.table("runtimeIngestionEvents").find(row => row.eventId === eventId)).toMatchObject({ factsState: "complete", vectorsState: "complete" });
}

describe("cancelled unapproved input disposition", () => {
  it.each([false, true])("later approved strict cutoff crosses withdrawn input (different conversation=%s)", async differentConversation => {
    const f = await ingestionFixture(), cancelled = await waiting(f);
    const original = structuredClone(event(f, cancelled.runId));
    const bridge = structuredClone(f.db.table("runtimeTranscriptMessages")[0]);
    const stages = structuredClone(f.db.table("runtimeIngestionStages"));
    await f.call(runs.cancel, { runId: cancelled.runId });
    expect(event(f, cancelled.runId)).toMatchObject({ ...original, eligibility: "ineligible" });
    expect(f.db.table("runtimeTranscriptMessages")[0]).toEqual(bridge);
    expect(bridge.approved).toBe(false);
    expect(f.db.table("runtimeIngestionStages")).toEqual(stages);
    expect(f.native.messages.size).toBe(1); noDerivedEffects(f);
    expect(await context.refreshScopeWatermarks(f.ctx, f.reference)).toMatchObject({ sequence: 1, factsThrough: 1, vectorsThrough: 1 });
    await expect(f.call(runs.approve, { runId: cancelled.runId, expectedDefinitionHash: f.published.definitionHash })).rejects.toThrow("INVALID_STATE");

    const strict = await f.call<{ agentId: string; version: number; definitionHash: string }>(definitions.publishVersion, {
      memorySpaceId: "space-a", clientMutationId: "strict-after-cancel", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, memoryMode: "strict", requiredStages: ["facts", "vectors"], barrier: { deadlineMs: 100, onFailure: "fail" } } },
    });
    const conversationId = differentConversation ? (await f.call<{ conversationId: string }>(transcript.create,
      { memorySpaceId: "space-a", clientRequestId: "later-conversation", requireApproval: true })).conversationId : cancelled.conversationId;
    const later = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit,
      { request: { ...f.request("later-approved", conversationId), agentId: strict.agentId, agentVersion: strict.version } });
    await f.call(runs.approve, { runId: later.runId, expectedDefinitionHash: strict.definitionHash });
    await complete(f, event(f, later.runId).eventId as string);
    const claimed = await f.call<{ snapshot: CutoffV1 }>(runs.claimNext, { reference: f.reference, conversationId });
    expect(claimed.snapshot.ingestionCutoff).toMatchObject({ sequence: 3, requiredStages: ["facts", "vectors"] });
    expect(claimed.snapshot.messages.map(message => message.nativeMessageId)).toEqual(later.inputMessageIds);
    await context.refreshScopeWatermarks(f.ctx, f.reference);
    const progress = await context.readStageProgress(f.ctx, f.reference, claimed.snapshot.ingestionCutoff.sequence);
    expect(progress).toMatchObject({ facts: { indexedThrough: 3, complete: true, hole: null }, vectors: { indexedThrough: 3, complete: true, hole: null } });
    expect(evaluateMemoryBarrier({ cutoff: 3, requiredStages: ["facts", "vectors"], progress, startedAt: Date.now(), now: Date.now(), deadlineMs: 100, onFailure: "fail" })).toEqual({ state: "ready", remainingMs: 100 });
    expect(event(f, cancelled.runId)).toMatchObject({ eligibility: "ineligible", factsState: "pending", vectorsState: "pending" });
    expect(f.db.table("runtimeMemorySources").map(row => (row.lineage as { sourceId: string }).sourceId)).not.toContain(bridge.sourceId);
  });

  it("double cancellation and a late ingestion delivery preserve the original disposition with zero effects", async () => {
    const f = await ingestionFixture(), run = await waiting(f);
    await f.call(runs.cancel, { runId: run.runId }); const before = body(f), scheduled = f.scheduled.length;
    await f.call(runs.cancel, { runId: run.runId });
    const factory = jest.fn(() => { throw new Error("Retired input must not construct a model"); });
    await ingestion.processStageHandler(f.ctx as unknown as ActionCtx,
      { reference: f.reference, eventId: event(f, run.runId).eventId as string, stage: "extract" }, factory);
    expect(factory).not.toHaveBeenCalled(); expect(body(f)).toBe(before); expect(f.scheduled).toHaveLength(scheduled);
    expect(f.db.table("runtimeIngestionJobs")).toEqual([]); noDerivedEffects(f);
  });

  it.each([false, true])("tracked edit retains canonical history without reopening cancelled unapproved work (cancel first=%s)", async cancelFirst => {
    const f = await ingestionFixture(), run = await waiting(f);
    if (cancelFirst) await f.call(runs.cancel, { runId: run.runId });
    const conversation = f.db.table("runtimeConversations")[0];
    await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, manualWriteLocked: false });
    await f.call(transcript.edit, { conversationId: run.conversationId, expectedRevision: f.db.table("runtimeConversations")[0].historyRevision,
      messageId: run.inputMessageIds[0], expectedMessageRevision: 1, parts: [{ type: "text", text: "Tracked but never approved" }] });
    if (!cancelFirst) await f.call(runs.cancel, { runId: run.runId });
    const events = f.db.table("runtimeIngestionEvents");
    expect(events.map(row => row.eligibility)).toEqual([cancelFirst ? "ineligible" : "superseded", "ineligible"]);
    expect(events.map(row => (row.lineage as { sourceRevision: number }).sourceRevision)).toEqual([1, 2]);
    expect(f.db.table("runtimeTranscriptMessages")[0]).toMatchObject({ nativeMessageId: run.inputMessageIds[0], approved: false, revision: 2 });
    expect(f.native.messages.size).toBe(1); expect(f.effects.edits).toBe(1);
    expect(f.db.table("runtimeTranscriptOutbox").map(row => row.state)).toEqual(["tombstoned", "pending"]);
    expect(await context.refreshScopeWatermarks(f.ctx, f.reference)).toMatchObject({ sequence: 2, factsThrough: 2, vectorsThrough: 2 });
    for (const input of events) {
      const factory = jest.fn(() => { throw new Error("Cancelled revisions cannot dispatch"); });
      await ingestion.processStageHandler(f.ctx as unknown as ActionCtx,
        { reference: f.reference, eventId: input.eventId as string, stage: "extract" }, factory);
      expect(factory).not.toHaveBeenCalled();
    }
    await expect(f.call(runs.approve, { runId: run.runId, expectedDefinitionHash: f.published.definitionHash })).rejects.toThrow("INVALID_STATE");
    expect(f.db.table("runtimeIngestionStages").every(stage => stage.state === "pending" && stage.attempt === 0 && stage.receiptId === undefined)).toBe(true);
    expect(f.db.table("runtimeIngestionJobs")).toEqual([]); noDerivedEffects(f);
  });

  it("tracked edit of an approved cancelled run keeps the existing eligible source lifecycle", async () => {
    const f = await ingestionFixture(), run = await waiting(f);
    await f.call(runs.approve, { runId: run.runId, expectedDefinitionHash: f.published.definitionHash });
    await f.call(runs.claimNext, { reference: f.reference, conversationId: run.conversationId });
    await f.call(runs.cancel, { runId: run.runId });
    await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: f.db.table("runtimeConversations")[0].historyRevision, manualWriteLocked: false });
    await f.call(transcript.edit, { conversationId: run.conversationId, expectedRevision: f.db.table("runtimeConversations")[0].historyRevision,
      messageId: run.inputMessageIds[0], expectedMessageRevision: 2, parts: [{ type: "text", text: "Explicit edit of previously approved input" }] });
    expect(event(f, run.runId)).toMatchObject({ eligibility: "eligible", lineage: { sourceRevision: 3 } });
    expect(f.db.table("runtimeTranscriptMessages")[0]).toMatchObject({ approved: true, revision: 3 });
    expect(f.db.table("runtimeMemorySources")).toHaveLength(1);
    expect(f.db.table("runtimeMemorySources")[0]).toMatchObject({ content: "Explicit edit of previously approved input", lineage: { sourceRevision: 3 } });
    expect(f.scheduled.filter(value => value.name === "runtimeIngestion:processStage").at(-1)?.args).toMatchObject({ eventId: event(f, run.runId).eventId, stage: "extract" });
  });

  it.each(["foreign-owner", "foreign-space", "revoked"])("%s cannot cancel or skip another input", async fault => {
    const f = await ingestionFixture(), run = await waiting(f);
    if (fault === "foreign-owner") {
      const principal = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-b", metadataUserId: "user-b", actorKind: "user", version: 1 });
      const membership = f.db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1 });
      f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:other", principalId: principal._id, membershipId: membership._id });
      f.identity({ issuer: "https://host.test", subject: "user-b" });
    }
    if (fault === "revoked") f.grant.revokedAt = Date.now();
    const before = body(f), scheduled = f.scheduled.length;
    await expect(f.call(runs.cancel, { runId: run.runId, ...(fault === "foreign-space" ? { memorySpaceId: "other-space" } : {}) })).rejects.toThrow();
    expect(body(f)).toBe(before); expect(f.scheduled).toHaveLength(scheduled);
    expect(event(f, run.runId).eligibility).toBe("awaiting_approval"); noDerivedEffects(f);
  });

  it.each([false, true])("approval winning before cancellation leaves eligible ingestion unchanged (running=%s)", async running => {
    const f = await ingestionFixture(), run = await waiting(f);
    await f.call(runs.approve, { runId: run.runId, expectedDefinitionHash: f.published.definitionHash });
    const approved = event(f, run.runId);
    await f.claim(approved.eventId as string);
    if (running) await f.call(runs.claimNext, { reference: f.reference, conversationId: run.conversationId });
    const preserved = f.canonical([f.db.table("runtimeIngestionEvents"), f.db.table("runtimeIngestionStages"), f.db.table("runtimeIngestionJobs")]);
    const job = f.db.table("runtimeIngestionJobs")[0], account = structuredClone(f.db.table("runtimeBudgetAccounts").find(row => row._id === job.runAccountId));
    await f.call(runs.cancel, { runId: run.runId });
    expect(f.canonical([f.db.table("runtimeIngestionEvents"), f.db.table("runtimeIngestionStages"), f.db.table("runtimeIngestionJobs")])).toBe(preserved);
    expect(f.db.table("runtimeBudgetAccounts").find(row => row._id === job.runAccountId)).toEqual(account);
    expect(event(f, run.runId).eligibility).toBe("eligible");
  });

  it.each(["revision", "owner", "job", "stage"])("inconsistent %s rolls back cancellation instead of hiding admitted work", async fault => {
    const f = await ingestionFixture(), run = await waiting(f), input = event(f, run.runId);
    if (fault === "revision") (input.lineage as { sourceRevision: number }).sourceRevision++;
    if (fault === "owner") input.ownerPrincipalId = "other-owner";
    if (fault === "job") f.db.seed("runtimeIngestionJobs", { tenantId: input.tenantId, memorySpaceId: input.memorySpaceId, eventId: input.eventId });
    if (fault === "stage") f.db.table("runtimeIngestionStages")[0].state = "running";
    const before = body(f), scheduled = f.scheduled.length;
    await expect(f.call(runs.cancel, { runId: run.runId })).rejects.toThrow("INGESTION_CONFLICT");
    expect(body(f)).toBe(before); expect(f.scheduled).toHaveLength(scheduled);
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("waiting_approval");
  });

  it("existing explicit message retirement remains fenced and cancellation never resurrects it", async () => {
    const f = await ingestionFixture(), run = await waiting(f), input = event(f, run.runId);
    const conversation = f.db.table("runtimeConversations")[0];
    await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, manualWriteLocked: false });
    await f.call(transcript.removeMessage, { conversationId: run.conversationId, expectedRevision: f.db.table("runtimeConversations")[0].historyRevision,
      messageId: run.inputMessageIds[0], expectedMessageRevision: 1 });
    const retired = structuredClone(f.db.table("runtimeIngestionEvents"));
    await f.call(runs.cancel, { runId: run.runId });
    expect(f.db.table("runtimeIngestionEvents")).toEqual(retired);
    expect(f.db.table("runtimeTranscriptMessages")[0].tombstonedAt).toBeDefined();
    expect(f.db.table("runtimeIngestionEvents").find(row => row.eventId === input.eventId)!.eligibility).toBe("superseded");
    expect(f.native.messages.size).toBe(0); noDerivedEffects(f);
  });
});
