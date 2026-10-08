/** Registered handler/resource-grant checks; controlled component, no paid inference. */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ingestionFixture, installIngestionMockRoot, ingestion } from "./fixture";
const { dataAuthorityReference, requireDataAuthority } = await import("../../../convex-dev/runtimeDataAuth");
const transcript = await import("../../../convex-dev/runtimeTranscript");
const shares = await import("../../../convex-dev/conversationShares");

async function shared(resourceAccess: "own" | "space") {
  const f = await ingestionFixture(); const run = await f.run();
  let conversation = f.db.table("runtimeConversations")[0];
  await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, manualWriteLocked: false });
  conversation = f.db.table("runtimeConversations")[0];
  const peer = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "editor", metadataUserId: "editor", actorKind: "user", version: 1 });
  const membership = f.db.seed("runtimeAuthMemberships", { principalId: peer._id, tenantId: "tenant-a", version: 1 });
  f.db.seed("runtimeAuthGrants", { principalId: peer._id, membershipId: membership._id, tenantId: "tenant-a", memorySpaceId: "space-a",
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write"], resourceAccess, version: 1 });
  await f.call(shares.create, { conversationId: run.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: peer._id,
    permissions: { canView: true, canViewFacts: true, canViewMemories: true, canContinue: true, canFork: false, canExport: false } });
  f.identity({ issuer: "https://host.test", subject: "editor" });
  const args = { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, messageId: run.inputMessageIds[0],
    expectedMessageRevision: 1, parts: [{ type: "text" as const, text: "Corrected shared source" }] };
  return { f, run, peer, args };
}
describe("current shared editor ingestion", () => {
  beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
  test("space editor repairs the same source under its current grant while owner and native parent remain exact", async () => {
    const { f, peer, args } = await shared("space");
    await f.call(transcript.edit, args);
    const bridge = f.db.table("runtimeTranscriptMessages")[0];
    const source = f.db.table("runtimeMemorySources")[0];
    const event = f.db.table("runtimeIngestionEvents").find(row => (row.lineage as { sourceRevision: number }).sourceRevision === 2)!;
    const reference = dataAuthorityReference(await requireDataAuthority(f.ctx, { memorySpaceId: "space-a" }, "write"));
    expect(source.ownerPrincipalId).toBe(f.principal._id);
    expect(bridge.actorReference).toEqual(reference);
    expect(event).toMatchObject({ ownerPrincipalId: f.principal._id, authorityReference: reference, eligibility: "eligible" });
    expect(f.db.table("runtimeIngestionEvents")[0].eligibility).toBe("superseded");
    f.grant.revokedAt = Date.now(); // The original actor cannot authorize the editor's new repair job.
    await f.extraction(event.eventId as string, [], reference);
    const claimed = await f.call<{ parentOperationId: string }>(ingestion.claim, { reference, eventId: event.eventId, stage: "facts" });
    const parent = f.db.table("runtimeModelOperations").find(row => row._id === claimed.parentOperationId)!;
    expect(parent.principalId).toBe(peer._id);
    expect(f.db.table("runtimeIngestionJobs")[0].runAccountId).toBe(parent.runAccountId);
    expect(f.effects.edits).toBe(1);
  });
  test("a shared conversation permission cannot broaden an own-only grant or create repair work", async () => {
    const { f, args } = await shared("own");
    const before = [f.effects.edits, f.db.table("runtimeIngestionEvents").length, f.db.table("runtimeIngestionJobs").length];
    await expect(f.call(transcript.edit, args)).rejects.toThrow("FORBIDDEN");
    expect([f.effects.edits, f.db.table("runtimeIngestionEvents").length, f.db.table("runtimeIngestionJobs").length]).toEqual(before);
    expect(f.db.table("runtimeMemorySources")[0].lineage).toMatchObject({ sourceRevision: 1 });
  });
});
