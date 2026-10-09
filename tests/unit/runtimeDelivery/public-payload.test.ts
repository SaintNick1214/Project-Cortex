import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { clock, installMockRoot, transcriptFixture, transcript, runs } from "../runtimeTranscript/fixture";
import { fixture as metadataFixture, registeredHandler } from "../runtimeMetadataAuth/fixture";
const immutable = await import("../../../convex-dev/immutable");
const mutable = await import("../../../convex-dev/mutable");
const sessions = await import("../../../convex-dev/sessions");
const shares = await import("../../../convex-dev/conversationShares");
const agent = await import("../../../convex-dev/runtimeAgent");

beforeEach(() => { installMockRoot(); jest.spyOn(Date, "now").mockReturnValue(clock); });
afterEach(() => { jest.restoreAllMocks(); });

it("every inventoried supported payload registration is a fresh mutation, rather than a subscription payload", async () => {
  const inventory = JSON.parse(await readFile(resolve("_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-final-query-expiry-functional-v2-20261008/author/read-inventory1.json"), "utf8")) as { converted: { module: string; name: string }[] };
  expect(inventory.converted).toHaveLength(95);
  for (const entry of inventory.converted) {
    const module = await import(`../../../convex-dev/${entry.module}`);
    expect(module[entry.name].isMutation).toBe(true);
    expect(module[entry.name].isQuery).toBeUndefined();
  }
});

it.each(["immutable", "mutable", "sessions"] as const)("same-argument %s metadata read denies time-only grant expiry without changing stored payload", async kind => {
  const f = metadataFixture(); f.grant.expiresAt = clock + 100;
  const options = kind === "immutable" ? { fn: immutable.get, args: { type: "note", id: "one" }, row: f.seedImmutable() }
    : kind === "mutable" ? { fn: mutable.get, args: { namespace: "counter", key: "one" }, row: f.seedMutable() }
      : { fn: sessions.get, args: { sessionId: "one" }, row: f.seedSession() };
  const handler = registeredHandler<unknown, unknown>(options.fn);
  expect(await handler(f.ctx, options.args)).toBeTruthy();
  const before = JSON.stringify([...f.db.rows]), writes = f.db.writes;
  jest.spyOn(Date, "now").mockReturnValue(clock + 101);
  await expect(handler(f.ctx, options.args)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.db.writes).toBe(writes);
});

it("canonical run/history reads and exhausted observer deny the unchanged grant at its actual delivery deadline", async () => {
  const f = await transcriptFixture(); const run = await f.run(); f.grant.expiresAt = clock + 100;
  const observed = await f.call<{ deliveryExpiresAt: number }>(agent.observe, { runId: run.runId, afterSequence: 100 });
  expect(observed.deliveryExpiresAt).toBe(clock + 100);
  expect(await f.call(runs.get, { runId: run.runId })).toBeTruthy();
  expect(await f.call(transcript.messages, { conversationId: run.conversationId })).toBeTruthy();
  const before = JSON.stringify([...f.db.rows]), effects = JSON.stringify(f.effects), writes = f.db.writes;
  jest.spyOn(Date, "now").mockReturnValue(clock + 101);
  for (const [fn, args] of [[agent.observe, { runId: run.runId, afterSequence: 100 }], [runs.get, { runId: run.runId }], [transcript.messages, { conversationId: run.conversationId }]] as const) {
    await expect(f.call(fn, args)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  }
  expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.db.writes).toBe(writes); expect(JSON.stringify(f.effects)).toBe(effects);
});

it("observer lifetime includes the consumed fact-share deadline even with a separate permanent view share", async () => {
  const f = await transcriptFixture(); const run = await f.run(); const source = f.db.table("runtimeMemorySources")[0];
  const lineage = source.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
  const peer = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "peer", actorKind: "user", version: 1 });
  const member = f.db.seed("runtimeAuthMemberships", { principalId: peer._id, tenantId: "tenant-a", version: 1 });
  f.db.seed("runtimeAuthGrants", { principalId: peer._id, membershipId: member._id, tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read"], resourceAccess: "space", version: 1, expiresAt: clock + 500 });
  const permissions = { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: false };
  await f.call(shares.create, { conversationId: run.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: peer._id, permissions });
  await f.call(shares.create, { conversationId: run.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: peer._id, permissions: { ...permissions, canViewFacts: true }, expiresAt: clock + 100 });
  const row = f.db.table("runtimeRuns")[0]; await f.db.patch("runtimeRuns", row._id as string, { attemptNumber: 1, responseStatus: "complete" });
  f.db.seed("runtimeAgentExecutions", { tenantId: "tenant-a", memorySpaceId: "space-a", runId: run.runId, attemptNumber: 1, state: "complete", streaming: true, mediaJobReferences: [], sourceWitnesses: [{ ...lineage, contentHash: source.contentHash, permissions: ["canViewFacts"] }] });
  f.identity({ issuer: "https://host.test", subject: "peer" });
  expect(await f.call(agent.observe, { runId: run.runId, afterSequence: 100 })).toMatchObject({ parts: [], deliveryExpiresAt: clock + 100 });
  const before = JSON.stringify([...f.db.rows]), writes = f.db.writes;
  jest.spyOn(Date, "now").mockReturnValue(clock + 101);
  expect(await f.call(transcript.get, { conversationId: run.conversationId })).toBeTruthy();
  await expect(f.call(agent.observe, { runId: run.runId, afterSequence: 100 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.db.writes).toBe(writes);
});

it("owner conversation retention bounds observation without emitting an undefined Convex field", async () => {
  const f = await transcriptFixture(); const run = await f.run();
  expect(await f.call(agent.observe, { runId: run.runId })).not.toHaveProperty("deliveryExpiresAt");
  const conversation = f.db.table("runtimeConversations")[0]; await f.db.patch("runtimeConversations", conversation._id as string, { retentionUntil: clock + 50 });
  expect(await f.call(agent.observe, { runId: run.runId })).toMatchObject({ deliveryExpiresAt: clock + 50 });
  jest.spyOn(Date, "now").mockReturnValue(clock + 51);
  await expect(f.call(agent.observe, { runId: run.runId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});
