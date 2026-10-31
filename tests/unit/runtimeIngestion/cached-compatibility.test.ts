/** Controlled native message/transaction ports; real finalization and delivery handlers, no paid dispatch. */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";

jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "controlled-workflow"; }
} }));
const { ingestionFixture, installIngestionMockRoot, invoke } = await import("./fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const shares = await import("../../../convex-dev/conversationShares");
const snapshots = await import("../../../convex-dev/conversationSnapshots");
const conversations = await import("../../../convex-dev/conversations");
const transcript = await import("../../../convex-dev/runtimeTranscript");
beforeEach(installIngestionMockRoot); afterEach(() => { jest.restoreAllMocks(); });

test("cached assistant compatibility reads and snapshots use each current reader's consumed-data permission", async () => {
  const f = await ingestionFixture(); const query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  const route = (name: string) => name === "runs:claimNext" ? runs.claimNext
    : name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : undefined;
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { /* Native component route. */ }
    const registration = route(name); return registration ? await invoke(registration, f.ctx, args) : await query(ref, args);
  }) as typeof f.ctx.runQuery;
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { /* Native component route. */ }
    const registration = route(name); return registration ? await invoke(registration, f.ctx, args) : await mutation(ref, args);
  }) as typeof f.ctx.runMutation;
  const origin = await f.run("private-source"); const source = f.db.table("runtimeMemorySources")[0];
  const lineage = source.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
  function reader(subject: string, capabilities: string[]) {
    const principal = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject, actorKind: "user", metadataUserId: subject, version: 1 });
    const membership = f.db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: f.reference.tenantId, version: 1 });
    const grant = f.db.seed("runtimeAuthGrants", { principalId: principal._id, membershipId: membership._id, tenantId: f.reference.tenantId,
      memorySpaceId: f.reference.memorySpaceId, tenantEpoch: 1, memorySpaceEpoch: 1, capabilities, resourceAccess: "space", version: 1 });
    const reference: RuntimeAuthorityReference = { ...f.reference, principalId: principal._id, membershipId: membership._id, grantId: grant._id };
    return { principal, reference };
  }
  const b = reader("reader-b", ["read", "write", "run", "admin"]), c = reader("reader-c", ["read"]);
  const view = { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: false };
  const sourceShare = (principalId: string, canViewFacts: boolean) => ({ conversationId: origin.conversationId, grantedBy: "user-a",
    grantType: "user" as const, grantedTo: principalId, permissions: { ...view, canViewFacts } });
  const bData = await f.call<{ shareId: string }>(shares.create, sourceShare(b.principal._id, true));
  await f.call(shares.create, sourceShare(b.principal._id, false));
  await f.call(shares.create, sourceShare(c.principal._id, true));
  f.identity({ issuer: "https://host.test", subject: "reader-b" });
  const run = await f.run("derived-output"); await f.call(runtime.start, { runId: run.runId });
  const row = f.db.table("runtimeRuns").find(item => item.runId === run.runId)!;
  const execution = f.db.table("runtimeAgentExecutions").find(item => item.runId === run.runId)!;
  const args = { reference: b.reference, runId: run.runId, attemptNumber: row.attemptNumber, leaseVersion: execution.leaseVersion };
  await f.call(runtime.saveContext, { ...args, context: "Authorized private facts", completeness: "complete", witnesses: [{
    sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: lineage.sourceRevision,
    contentHash: source.contentHash, permissions: ["canViewFacts"],
  }] });
  const inputId = (row.inputMessageIds as string[])[0], input = f.native.messages.get(inputId)!;
  const finalId = "controlled:cached-final", text = "CACHED_ASSISTANT_SENTINEL";
  f.native.messages.set(finalId, { ...input, _id: finalId, stepOrder: 1,
    agentName: `cortex:${run.runId}:${row.attemptNumber}:0`, message: { role: "assistant", content: text } });
  const op = await f.call<{ operationId: string }>(runtime.beginOperation, { ...args, kind: "model", ordinal: 0, requestCanonical: "{}" });
  await f.call(runtime.startOperation, { ...args, operationId: op.operationId });
  await f.call(runtime.finishOperation, { ...args, operationId: op.operationId, resultCanonical: "{}", nativeMessageIds: [finalId] });
  await f.call(runtime.finalize, { ...args, finalMessageIds: [finalId] });
  const snapshot = await f.call<{ snapshotId: string }>(snapshots.create, { conversationId: run.conversationId, createdBy: "reader-b" });
  expect(JSON.stringify(await f.call(snapshots.get, { snapshotId: snapshot.snapshotId }))).toContain(text);
  await f.call(shares.create, { conversationId: run.conversationId, grantedBy: "reader-b", grantType: "user", grantedTo: c.principal._id,
    permissions: { ...view, canExport: true } });

  f.identity({ issuer: "https://host.test", subject: "user-a" }); await f.call(shares.revoke, { shareId: bData.shareId });
  f.identity({ issuer: "https://host.test", subject: "reader-b" });
  const selectors = { conversationId: run.conversationId };
  const deniedReads = [
    () => f.call(conversations.get, selectors),
    () => f.call(conversations.getMessage, { ...selectors, messageId: finalId }),
    () => f.call(conversations.getMessagesByIds, { ...selectors, messageIds: [finalId] }),
    () => f.call(conversations.getHistory, selectors),
    () => f.call(conversations.list, { memorySpaceId: f.reference.memorySpaceId, includeMessages: true }),
    () => f.call(conversations.search, { memorySpaceId: f.reference.memorySpaceId, query: text }),
    () => f.call(conversations.exportConversations, { conversationIds: [run.conversationId], format: "json" }),
    () => f.call(snapshots.get, { snapshotId: snapshot.snapshotId }),
    () => f.call(snapshots.create, { ...selectors, createdBy: "reader-b" }),
  ];
  const before = f.db.writes;
  for (const read of deniedReads) await expect(read()).rejects.toThrow();
  expect(f.db.writes).toBe(before);
  expect(await f.call(conversations.get, { ...selectors, includeMessages: false })).toMatchObject({ conversationId: run.conversationId });
  // The source's current owner and the original output actor are not substitutes for this new reader.
  f.identity({ issuer: "https://host.test", subject: "reader-c" });
  expect(JSON.stringify(await f.call(snapshots.get, { snapshotId: snapshot.snapshotId }))).toContain(text);
  expect(JSON.stringify(await f.call(conversations.getHistory, selectors))).toContain(text);
  expect(await f.call(transcript.get, selectors)).toMatchObject({ conversationId: run.conversationId });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1);
});
