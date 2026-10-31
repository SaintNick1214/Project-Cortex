/** Actual catalog/native fences; no model calls or forged provider qualification. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import type { MessageDoc } from "@convex-dev/agent";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import { mediaFixture, media, installMediaMockRoot } from "./fixture";
import { artifacts } from "../runtimeAssets/fixture";
import { clock, invoke, runs, transcript } from "../runtimeTranscript/fixture";
const runtime = await import("../../../convex-dev/runtimeAgent");
const { guardAgentRunBudget } = await import("../../../convex-dev/runtimeAgentFence");
const { artifactMetadataWitness, checkArtifactContextWitnesses } = await import("../../../convex-dev/runtimeArtifactContext");
const { ConvexMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
const { executeServerTool } = await import("../../../convex-dev/runtimeAgentTools");
const shares = await import("../../../convex-dev/conversationShares");
beforeEach(() => { installMediaMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
async function setup() {
  const f = await mediaFixture(); await f.call(artifacts.create, { artifactId: "consumed-artifact", content: "draft", title: "Private metadata" });
  const metadata = await f.call<Awaited<ReturnType<typeof import("../../../convex-dev/runtimeArtifactContext").readArtifactContext>>>(media.readArtifactTrusted, { reference: f.reference, artifactId: "consumed-artifact" });
  const witness = await artifactMetadataWitness(metadata);
  const artifact = f.db.table("artifacts")[0];
  return { ...f, metadata, witness, artifact };
}
it("server artifact.read returns a durable exact metadata witness before any private message save", async () => {
  const f = await setup(); f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
  const query = f.action.runQuery.bind(f.action);
  const action = { ...f.action, runQuery: (async (reference, args) => getFunctionName(reference) === "runtimeAgent:checkToolAuthority"
    ? f.call(runtime.checkToolAuthority, args) : query(reference, args)) as ActionCtx["runQuery"] };
  const writeSource = jest.fn(async () => { throw new Error("Unexpected source write"); });
  const commitDerived = jest.fn(async () => { throw new Error("Unexpected derived write"); });
  const result = await executeServerTool(action, { reference: f.reference, runBudgetId: "owned-run", operationId: "owned-tool",
    checkCurrent: async () => {}, writeSource, commitDerived }, "artifact.read", { artifactId: "consumed-artifact" });
  expect(result.result).toEqual(f.metadata);
  expect(result).toMatchObject({ witnesses: [], artifactWitnesses: [f.witness] });
  expect(f.effects.saves).toBe(0); expect(writeSource).not.toHaveBeenCalled(); expect(commitDerived).not.toHaveBeenCalled();
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["delete", "revision"])("artifact_read native history rejects a consumed artifact %s", async change => {
  const f = await setup(); const run = await f.run();
  const native = { ...f.native.messages.get(run.inputMessageIds[0])!, _id: "artifact-tool", stepOrder: 1,
    message: { role: "tool", content: [{ type: "tool-result", toolCallId: "call", toolName: "artifact_read", output: { type: "json", value: f.metadata } }] } } as unknown as MessageDoc;
  expect(await transcript.checkNativeMediaReferences(f.ctx, f.reference, native)).toEqual([]);
  await f.db.patch("artifacts", f.artifact._id as string, change === "delete" ? { isDeleted: true } : { versionPointer: 2, title: "Changed metadata" });
  await expect(transcript.checkNativeMediaReferences(f.ctx, f.reference, native)).rejects.toThrow();
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("same-run hydration, native paid guard and exhausted observers recheck consumed artifact metadata", async () => {
  const f = await setup(); const run = await f.run();
  const claim = await f.call<{ attemptNumber: number; leaseVersion: number }>(runs.claimNext, { reference: f.reference, conversationId: run.conversationId, leaseMs: 300_000 });
  const row = f.db.table("runtimeRuns")[0]; await f.db.patch("runtimeRuns", row._id as string, { executionRequested: true });
  f.db.seed("runtimeAgentExecutions", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, runId: run.runId,
    attemptNumber: claim.attemptNumber, leaseVersion: claim.leaseVersion, reference: f.reference, state: "running", streaming: true,
    nextOutputSequence: 1, nextModelStep: 0, toolCount: 1, sourceWitnesses: [], savedMessageIds: [], savedMessagePins: [], mediaJobReferences: [], artifactContextWitnesses: [f.witness] });
  const args = { reference: f.reference, runId: run.runId, attemptNumber: claim.attemptNumber, leaseVersion: claim.leaseVersion };
  await f.call(runtime.hydrateExecution, args); await guardAgentRunBudget(f.ctx, f.reference, row.runAccountId as never);
  for (const afterSequence of [0, 1]) expect(await f.call(runtime.observe, { runId: run.runId, afterSequence })).toMatchObject({ state: "running", parts: [] });
  await f.db.patch("artifacts", f.artifact._id as string, { isDeleted: true }); const writes = f.db.writes;
  await expect(f.call(runtime.hydrateExecution, args)).rejects.toThrow();
  await expect(guardAgentRunBudget(f.ctx, f.reference, row.runAccountId as never)).rejects.toThrow();
  for (const afterSequence of [0, 1]) await expect(f.call(runtime.observe, { runId: run.runId, afterSequence })).rejects.toThrow();
  expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("canonical final text and fork retain consumed artifact authority, including derived memory eligibility", async () => {
  const f = await setup(); const run = await f.run(); const conversation = f.db.table("runtimeConversations")[0];
  const native = { ...f.native.messages.get(run.inputMessageIds[0])!, _id: "artifact-derived-text", stepOrder: 1,
    message: { role: "assistant", content: "Text derived from private artifact metadata" } } as unknown as MessageDoc;
  f.native.messages.set(native._id, native);
  await transcript.registerMessages(f.ctx, conversation as never, f.reference, [native], { artifactContextWitnesses: [f.witness] });
  const source = f.db.table("runtimeMemorySources").find(row => (row.lineage as { sourceId: string }).sourceId.includes(native._id))!;
  const repository = new ConvexMemoryRepository(f.ctx, f.reference, "read");
  expect(await repository.getSource((source.lineage as { sourceId: string }).sourceId)).not.toBeNull();
  const fork = await f.call<{ conversationId: string }>(transcript.fork, { conversationId: run.conversationId, clientRequestId: "artifact-fork", expectedRevision: f.db.table("runtimeConversations")[0].historyRevision });
  const copied = f.db.table("runtimeTranscriptMessages").find(row => row.conversationId === fork.conversationId && row.role === "assistant")!;
  expect(copied.artifactContextWitnesses).toEqual([f.witness]);
  await f.db.patch("artifacts", f.artifact._id as string, { isDeleted: true });
  for (const conversationId of [run.conversationId, fork.conversationId]) await expect(f.call(transcript.messages, { conversationId })).rejects.toThrow();
  await expect(repository.getSource((source.lineage as { sourceId: string }).sourceId)).rejects.toThrow();
});
it("immutable asset replacement and foreign artifact authority cannot validate a consumed witness", async () => {
  const f = await setup(); await checkArtifactContextWitnesses(f.ctx, f.reference, [f.witness]);
  const asset = await f.upload("new bytes", "artifact-bytes"); await f.call(artifacts.attachAsset, { artifactId: "consumed-artifact", assetId: asset.asset.assetId, version: 1 });
  await expect(checkArtifactContextWitnesses(f.ctx, f.reference, [f.witness])).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  const fresh = await f.call<Awaited<ReturnType<typeof import("../../../convex-dev/runtimeArtifactContext").readArtifactContext>>>(media.readArtifactTrusted, { reference: f.reference, artifactId: "consumed-artifact" });
  const current = await artifactMetadataWitness(fresh); await checkArtifactContextWitnesses(f.ctx, f.reference, [current]);
  await f.db.patch("artifacts", f.artifact._id as string, { ownerPrincipalId: "another-principal" }); f.grant.resourceAccess = "own";
  await expect(checkArtifactContextWitnesses(f.ctx, f.reference, [current])).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("public media metadata has a final grant deadline gate after the artifact lookup", async () => {
  const f = await mediaFixture(); const job = await f.submit(); f.grant.expiresAt = clock + 5;
  expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "pending" });
  const query = f.db.query.bind(f.db); const now = jest.spyOn(Date, "now").mockReturnValue(clock); let crossed = false;
  const db: typeof f.db = Object.create(f.db);
  Object.defineProperty(db, "query", { value: (table: string) => {
    const result = query(table);
    if (table === "artifacts") { const unique = result.unique; result.unique = async () => { const row = await unique(); crossed = true; now.mockReturnValue(clock + 6); return row; }; }
    return result;
  } });
  await expect(invoke(media.get, { ...f.ctx, db: db as unknown as MutationCtx["db"] }, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(crossed).toBe(true); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("artifact metadata preserves linked conversation canExport permission, even with current canView", async () => {
  const f = await mediaFixture(); const run = await f.run();
  await f.call(artifacts.create, { artifactId: "linked-artifact", content: "owned content", title: "private linked metadata", conversationRef: { conversationId: run.conversationId } });
  const peer = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "peer", actorKind: "user", version: 1 });
  const membership = f.db.seed("runtimeAuthMemberships", { principalId: peer._id, tenantId: "tenant-a", version: 1 });
  const grant = f.db.seed("runtimeAuthGrants", { principalId: peer._id, membershipId: membership._id, tenantId: "tenant-a", memorySpaceId: "space-a",
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read"], resourceAccess: "space", version: 1 });
  const reference = { ...f.reference, principalId: peer._id, membershipId: membership._id, grantId: grant._id };
  const created = await f.call<{ shareId: string }>(shares.create, { conversationId: run.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: peer._id,
    permissions: { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: true } });
  f.identity({ issuer: "https://host.test", subject: "peer" });
  expect(await f.call(artifacts.get, { artifactId: "linked-artifact" })).toBeDefined();
  expect(await f.call(media.readArtifactTrusted, { reference, artifactId: "linked-artifact" })).toMatchObject({ title: "private linked metadata" });
  const share = f.db.table("runtimeConversationShares").find(row => row.shareId === created.shareId)!;
  await f.db.patch("runtimeConversationShares", share._id as string, { permissions: { ...(share.permissions as object), canExport: false } }); const writes = f.db.writes;
  await expect(f.call(artifacts.get, { artifactId: "linked-artifact" })).rejects.toThrow();
  await expect(f.call(media.readArtifactTrusted, { reference, artifactId: "linked-artifact" })).rejects.toThrow();
  expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("artifact.read preserves the canonical linked-message anchor and its consumed source fences", async () => {
  const f = await mediaFixture(), run = await f.run();
  await f.call(artifacts.create, { artifactId: "anchored-artifact", content: "draft", title: "anchored metadata",
    conversationRef: { conversationId: run.conversationId, messageId: run.inputMessageIds[0] } });
  const input = { reference: f.reference, artifactId: "anchored-artifact" };
  expect(await f.call(artifacts.get, { artifactId: "anchored-artifact" })).toBeDefined();
  expect(await f.call(media.readArtifactTrusted, input)).toMatchObject({ title: "anchored metadata" });
  const bridge = f.db.table("runtimeTranscriptMessages").find(row => row.nativeMessageId === run.inputMessageIds[0])!;
  await f.db.patch("runtimeTranscriptMessages", bridge._id as string, { tombstonedAt: clock }); const writes = f.db.writes;
  await expect(f.call(artifacts.get, { artifactId: "anchored-artifact" })).rejects.toThrow();
  await expect(f.call(media.readArtifactTrusted, input)).rejects.toThrow();
  expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
