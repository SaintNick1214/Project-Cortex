/** Cached action reads are deliberately retained; the real final mutation must fence delivery. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import type { MemoryModel } from "../../../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { createActionMemoryRepository, memoryScope } from "../../../convex-dev/runtimeMemoryRepository";
import { explicitSourceLineage, recallMemory, rememberMemory } from "../../../convex-dev/runtimeMemoryServices";
import { finalDelivery } from "../../../convex-dev/runtimeMemory";
import { memoryFixture } from "../runtimeMemory/fixture";

beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(1000); });
afterEach(() => { jest.restoreAllMocks(); });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
async function fixture(shared = false) {
  const f = memoryFixture();
  const model: MemoryModel = {
    extract: async () => ({ facts: [{ fact: "User prefers green tea", factType: "preference", subject: "user", predicate: "prefers", object: "green tea", confidence: 0.9, tags: [], entities: [], relations: [] }] }),
    resolve: async () => { throw new Error("Unexpected conflict call"); },
    embed: async request => ({ profile: DEFAULT_EMBEDDING_PROFILE,
      vectors: request.texts.map(() => Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0)) }),
  };
  await rememberMemory({ repository: createActionMemoryRepository(f.actionCtx, f.reference, "write"), model, clock: { now: () => 1000 } },
    { text: "I prefer green tea", lineage: explicitSourceLineage(memoryScope(f.reference), "source-1") });
  let readingReference = f.reference;
  let dataShare: ReturnType<typeof f.db.seed> | undefined;
  if (shared) {
    const peer = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "peer", actorKind: "user", version: 1 });
    const membership = f.db.seed("runtimeAuthMemberships", { principalId: peer._id, tenantId: "tenant-a", version: 1 });
    const grant = f.db.seed("runtimeAuthGrants", { principalId: peer._id, membershipId: membership._id,
      tenantId: "tenant-a", memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1,
      capabilities: ["read"], resourceAccess: "space", version: 1 });
    readingReference = { ...f.reference, principalId: peer._id, membershipId: membership._id, grantId: grant._id };
    const row = f.db.table("runtimeMemorySources")[0]!;
    const lineage = row.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
    row.transcriptOrigin = { conversationId: "shared-conversation", conversationEpoch: 1, nativeMessageId: "shared-message" };
    f.db.seed("runtimeConversations", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "shared-conversation",
      ownerPrincipalId: f.principal._id, participants: [], visibility: "private", epoch: 1 });
    f.db.seed("runtimeTranscriptMessages", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "shared-conversation",
      ownerPrincipalId: f.principal._id, nativeMessageId: "shared-message", approved: true, ...lineage,
      revision: lineage.sourceRevision, role: "user", sourceContentHash: row.contentHash });
    const permissions = { canView: true, canViewFacts: false, canViewMemories: true, canContinue: false, canFork: false, canExport: false };
    f.db.seed("runtimeConversationShares", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "shared-conversation",
      grantType: "user", grantedTo: peer._id, state: "active", viewCount: 0, permissions });
    dataShare = f.db.seed("runtimeConversationShares", { tenantId: "tenant-a", memorySpaceId: "space-a", conversationId: "shared-conversation",
      grantType: "user", grantedTo: peer._id, state: "active", viewCount: 0, permissions: { ...permissions, canViewFacts: true }, expiresAt: 1001 });
  }
  const reads = new Map<string, unknown>(); let factsReads = 0, readAuthorityChecks = 0;
  let beforeDelivery: () => void = () => {};
  let afterDelivery: () => void = () => {};
  const delivered: string[] = [];
  const ctx: Pick<ActionCtx, "runQuery" | "runMutation" | "vectorSearch"> = {
    runQuery: async (ref, args) => {
      const name = getFunctionName(ref); const key = JSON.stringify([name, args]);
      if (!reads.has(key)) reads.set(key, clone(await f.actionCtx.runQuery(ref, args)));
      if (name === "runtimeMemory:readFacts") factsReads++;
      if (name === "runtimeMemory:checkAuthority" && (args as { capability: string }).capability === "read") readAuthorityChecks++;
      return clone(reads.get(key));
    },
    runMutation: async (ref, args) => {
      const name = getFunctionName(ref); delivered.push(name);
      if (name === "runtimeMemory:finalDelivery") { expect(factsReads).toBe(1); expect(readAuthorityChecks).toBeGreaterThanOrEqual(2); beforeDelivery(); }
      const result = await f.actionCtx.runMutation(ref, args);
      if (name === "runtimeMemory:finalDelivery") afterDelivery();
      return result;
    },
    vectorSearch: f.actionCtx.vectorSearch.bind(f.actionCtx),
  };
  const recall = async () => await recallMemory({ repository: createActionMemoryRepository(ctx, readingReference, "read"),
    model, clock: { now: () => Date.now() } }, { text: "drink", requestId: "recall-1", limit: 10 });
  return { ...f, recall, delivered, dataShare, beforeDelivery: (fn: () => void) => { beforeDelivery = fn; }, afterDelivery: (fn: () => void) => { afterDelivery = fn; } };
}
it("final delivery is internal-only and unchanged consumed facts/vectors return without a write or new budget", async () => {
  expect(finalDelivery.isMutation).toBe(true); expect(finalDelivery.isInternal).toBe(true);
  const f = await fixture(), writes = f.db.writes, before = JSON.stringify([...f.db.rows]);
  expect(await f.recall()).toMatchObject({ profileId: DEFAULT_EMBEDDING_PROFILE.profileId, context: expect.stringContaining("green tea") });
  expect(f.delivered).toEqual(["runtimeMemory:finalDelivery"]); expect(f.db.writes).toBe(writes);
  expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.policyRequests).toHaveLength(0);
});
it.each(["grant-expiry", "principal-revoke", "membership-revoke", "grant-revoke", "source-revision", "source-delete", "fact-revision", "fact-superseded", "vector-change"] as const)(
  "cached recall payload is withheld for %s immediately before final delivery", async kind => {
    const f = await fixture(); let expectedWrites = f.db.writes;
    f.beforeDelivery(() => {
      if (kind === "grant-expiry") { f.grant.expiresAt = 1001; jest.spyOn(Date, "now").mockReturnValue(1002); }
      else if (kind === "principal-revoke") f.principal.revokedAt = 1001;
      else if (kind === "membership-revoke") f.membership.revokedAt = 1001;
      else if (kind === "grant-revoke") f.grant.revokedAt = 1001;
      else if (kind === "source-revision") { const row = f.db.table("runtimeMemorySources")[0]!; row.lineage = { ...row.lineage as object, sourceRevision: 2 }; }
      else if (kind === "source-delete") f.db.table("runtimeMemorySources")[0]!.tombstonedAt = 1001;
      else if (kind === "fact-revision") f.db.table("facts")[0]!.version = 2;
      else if (kind === "fact-superseded") f.db.table("facts")[0]!.supersededBy = "new-current-fact";
      else f.db.table("runtimeMemoryVectors")[0]!.embedding = Array.from({ length: 1536 }, () => 0.5);
      expectedWrites = f.db.writes;
    });
    await expect(f.recall()).rejects.toMatchObject({ data: { code: expect.stringMatching(/FORBIDDEN|STALE_SOURCE/) } });
    expect(f.delivered).toEqual(["runtimeMemory:finalDelivery"]); expect(f.db.writes).toBe(expectedWrites);
    expect(f.policyRequests).toHaveLength(0);
  });
it("final delivery refuses over-bound consumed lists before a source lookup or data effect", async () => {
  const f = memoryFixture(), writes = f.db.writes;
  const ctx = f.ctx;
  await expect((finalDelivery as unknown as { _handler: (ctx: typeof f.ctx, args: unknown) => Promise<unknown> })._handler(ctx,
    { reference: f.reference, bindings: { sources: [], vectors: [], facts: Array.from({ length: 102 }, () => ({ factId: "x", payloadHash: "x" })) } }))
    .rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  expect(f.db.writes).toBe(writes);
});

it.each(["expiry", "revoke"] as const)("final recall delivery rechecks consumed fact-share %s despite a permanent generic-view share", async kind => {
  const f = await fixture(true); const writes = f.db.writes;
  f.beforeDelivery(() => { if (kind === "expiry") jest.spyOn(Date, "now").mockReturnValue(1002); else f.dataShare!.revokedAt = 1001; });
  await expect(f.recall()).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.db.writes).toBe(writes); expect(f.delivered).toEqual(["runtimeMemory:finalDelivery"]);
});

it("the final mutation returns the consumed share deadline to the action without changing canonical data", async () => {
  const f = await fixture(true), writes = f.db.writes;
  expect(await f.recall()).toMatchObject({ context: expect.stringContaining("green tea"), deliveryExpiresAt: 1001 });
  expect(f.delivered).toEqual(["runtimeMemory:finalDelivery"]); expect(f.db.writes).toBe(writes);
});

it("action delivery withholds recall when the returned consumed-share deadline elapses after the fresh RPC", async () => {
  const f = await fixture(true), writes = f.db.writes;
  // Convex freezes mutation time. Only action time advances after that RPC returns.
  f.afterDelivery(() => { jest.spyOn(Date, "now").mockReturnValue(1002); });
  await expect(f.recall()).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(f.delivered).toEqual(["runtimeMemory:finalDelivery"]); expect(f.db.writes).toBe(writes);
  expect(f.policyRequests).toHaveLength(0);
});
