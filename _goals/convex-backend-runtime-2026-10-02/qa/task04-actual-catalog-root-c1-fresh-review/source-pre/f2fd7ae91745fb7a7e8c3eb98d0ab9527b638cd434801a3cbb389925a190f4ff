import { describe, expect, it, jest } from "@jest/globals";
import * as memories from "../../../convex-dev/memories";
import { harness, identity, memoryStoreArgs, forbidden, withFinalWriteHash, withSourceHashBoundary } from "./sharedfixtures";
import type { Doc } from "../../../convex-dev/_generated/dataModel";
import * as facts from "../../../convex-dev/facts";
import { assertDataLinks, requireDataAuthority } from "../../../convex-dev/runtimeDataAuth";
import { semanticHash } from "../../../src/domain/profile";

const scope = { memorySpaceId: "space-a", memoryId: "same-id" };
const cases = [
  ["store", memoryStoreArgs, "row"],
  ["storePartialMemory", { ...memoryStoreArgs, conversationId: "conversation-a", userId: "metadata-alice", isPartial: true, metadata: {} }, "partial"],
  ["updatePartialMemory", { memoryId: "same-id", content: "Updated assertion", metadata: {} }, "success"],
  ["finalizePartialMemory", { memoryId: "same-id", content: "Final assertion", metadata: {} }, "success"],
  ["deleteMemory", scope, "deleted"], ["get", scope, "row"],
  ["search", { memorySpaceId: "space-a", query: "private" }, "array"],
  ["list", { memorySpaceId: "space-a" }, "array"], ["count", { memorySpaceId: "space-a" }, "count"],
  ["update", { ...scope, content: "Updated assertion" }, "row"], ["getVersion", { ...scope, version: 1 }, "version"],
  ["getHistory", scope, "array"], ["deleteMany", { memorySpaceId: "space-a" }, "bulk"],
  ["deleteByIds", { memoryIds: ["same-id"] }, "bulk"],
  ["exportMemories", { memorySpaceId: "space-a", format: "json" }, "export"],
  ["updateMany", { memorySpaceId: "space-a", importance: 90 }, "updated"], ["archive", scope, "archive"],
  ["restoreFromArchive", scope, "restore"], ["getAtTimestamp", { ...scope, timestamp: Date.now() + 10000 }, "version"],
] as const;

describe("actual memories endpoint closure", () => {
  it.each(cases)("%s reads/writes only the canonical trusted tenant row when a foreign same-ID row was inserted first", async (name, args, outcome) => {
    const h = harness(); const foreign = await h.provisionScope({ tenantId: "tenant-b", subject: "bob" });
    const foreignId = await h.seedData("memories", foreign, "same-id"); const owner = await h.provisionScope();
    const id = await h.seedData("memories", owner, "same-id", name === "restoreFromArchive" ? { tags: ["archived"] } : {});
    await h.db.insert("conversations", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.principalId,
      conversationId: "conversation-a", messages: [] });
    h.db.reads = []; h.db.attemptedWrites = [];
    const result = await h.invoke(memories[name], { ...args });
    if (outcome === "row") expect(result).toMatchObject({ tenantId: "tenant-a", ownerPrincipalId: owner.principalId });
    else if (outcome === "partial") expect(result).toMatchObject({ memoryId: expect.stringMatching(/^mem-partial-/) });
    else if (outcome === "success") expect(result).toEqual({ success: true });
    else if (outcome === "deleted") expect(result).toEqual({ deleted: true, memoryId: "same-id" });
    else if (outcome === "count") expect(result).toBe(1);
    else if (outcome === "array") expect(result).toHaveLength(1);
    else if (outcome === "version") expect(result).toMatchObject({ memoryId: "same-id", version: 1 });
    else if (outcome === "bulk") expect(result).toMatchObject({ deleted: 1, memoryIds: ["same-id"] });
    else if (outcome === "export") expect(result).toMatchObject({ count: 1, data: expect.stringContaining("tenant-a private same-id") });
    else if (outcome === "updated") expect(result).toMatchObject({ updated: 1, memoryIds: ["same-id"] });
    else if (outcome === "archive") expect(result).toMatchObject({ archived: true, memoryId: "same-id" });
    else expect(result).toMatchObject({ restored: true, memoryId: "same-id" });
    expect(JSON.stringify(result)).not.toContain("tenant-b");
    expect(h.db.reads.filter(read => read.table === "memories").flatMap(read => read.ids)).not.toContain(foreignId);
    expect(h.db.attemptedWrites.some(write => write.endsWith(foreignId))).toBe(false);
    expect((await h.db.get(id))?.tenantId).toBe("tenant-a");
  });

  it.each(cases.map(([name, args]) => [name, args] as const))("%s rejects missing verified identity before private selection or writes", async (name, args) => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "same-id");
    h.setIdentity(null); h.db.reads = []; h.db.attemptedWrites = [];
    await expect(h.invoke(memories[name], { ...args })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    expect(h.db.reads.filter(read => read.table === "memories")).toEqual([]); expect(h.db.attemptedWrites).toEqual([]);
  });

  it("derives omitted tenant, denies omitted-scope ambiguity in partial updates and duplicate active generations", async () => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "same-id");
    expect(await h.invoke(memories.count, { memorySpaceId: "space-a" })).toBe(1);
    await h.provisionScope({ memorySpaceId: "space-b" });
    await expect(h.invoke(memories.updatePartialMemory, { memoryId: "same-id", content: "forged", metadata: {} })).rejects.toMatchObject(forbidden);
    await h.provisionScope({ tenantId: "tenant-b" });
    await expect(h.invoke(memories.count, { memorySpaceId: "space-a" })).rejects.toMatchObject(forbidden);
    const grant = h.db.rows.get("runtimeAuthGrants")!.find(row => row._id === owner.grantId)!;
    await h.db.insert("runtimeAuthGrants", { ...grant, _id: undefined, capabilities: ["admin"] });
    await expect(h.invoke(memories.get, { ...scope, tenantId: "tenant-a" })).rejects.toMatchObject(forbidden);
  });

  it("excludes same-tenant foreign owners and old missing-owner/provenance rows before hydration", async () => {
    const h = harness(); const bob = await h.provisionScope({ subject: "bob" }); const foreignId = await h.seedData("memories", bob, "same-id");
    const alice = await h.provisionScope(); await h.seedData("memories", alice, "same-id");
    await h.db.insert("memories", { memoryId: "orphan", tenantId: "tenant-a", memorySpaceId: "space-a", content: "orphan" });
    h.db.reads = [];
    expect(await h.invoke(memories.count, { memorySpaceId: "space-a" })).toBe(1);
    expect(h.db.reads.filter(read => read.table === "memories").flatMap(read => read.ids)).not.toContain(foreignId);
    await expect(h.invoke(memories.deleteByIds, { memoryIds: ["same-id", "orphan"] })).rejects.toMatchObject(forbidden);
    expect(await h.invoke(memories.count, { memorySpaceId: "space-a" })).toBe(1);
  });

  it.each(["userId", "participantId", "sourceUserId", "agentId"])("rejects forged %s actor before creating a memory or source", async label => {
    const h = harness(); await h.provisionScope(); h.db.attemptedWrites = [];
    await expect(h.invoke(memories.store, { ...memoryStoreArgs, [label]: "metadata-bob" })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it("writes user assertion provenance even for caller tool/system role labels and keeps source revisions current", async () => {
    const h = harness(); const owner = await h.provisionScope();
    const row = await h.invoke<Doc<"memories">>(memories.store, { ...memoryStoreArgs, messageRole: "system" });
    expect(row).toMatchObject({ ownerPrincipalId: owner.principalId, messageRole: "user", lineage: { role: "user", trust: "user_assertion", sourceRevision: 1 } });
    await h.invoke(memories.updatePartialMemory, { memoryId: row.memoryId, content: "Updated", metadata: {} });
    await h.invoke(memories.finalizePartialMemory, { memoryId: row.memoryId, content: "Final", metadata: {} });
    const final = await h.invoke<Doc<"memories">>(memories.get, { memorySpaceId: "space-a", memoryId: row.memoryId });
    expect(final.lineage?.sourceRevision).toBe(3); expect(final.isPartial).toBe(false);
    expect(h.db.rows.get("runtimeMemorySources")![0].lineage).toEqual(final.lineage);
  });

  it("preflights every bulk ID and denies linked cross-space conversations/facts before writes", async () => {
    const h = harness(); const owner = await h.provisionScope(); const ownId = await h.seedData("memories", owner, "own");
    const other = await h.provisionScope({ memorySpaceId: "space-b", subject: "bob" }); await h.seedData("memories", other, "foreign");
    await h.db.insert("conversations", { tenantId: "tenant-a", memorySpaceId: "space-b", ownerPrincipalId: owner.principalId, conversationId: "foreign-conversation", messages: [] });
    await h.seedData("facts", other, "foreign-fact");
    h.db.attemptedWrites = [];
    await expect(h.invoke(memories.deleteByIds, { memoryIds: ["own", "foreign"] })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]); expect((await h.db.get(ownId))?.tombstonedAt).toBeUndefined();
    await expect(h.invoke(memories.store, { ...memoryStoreArgs, conversationRef: { conversationId: "foreign-conversation", messageIds: [] } })).rejects.toMatchObject(forbidden);
    await expect(h.invoke(memories.store, { ...memoryStoreArgs, factsRef: { factId: "foreign-fact" } })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it("internal candidate hydration rechecks stored read references and blocks foreign IDs, revocation, tombstones and stale lineage", async () => {
    const h = harness(); const owner = await h.provisionScope(); const ownId = await h.seedData("memories", owner, "own");
    const other = await h.provisionScope({ tenantId: "tenant-b", subject: "bob" }); const foreignId = await h.seedData("memories", other, "foreign");
    h.db.reads = [];
    await expect(h.invoke(memories.fetchMemoriesByIds, { ids: [foreignId], reference: owner })).rejects.toMatchObject(forbidden);
    expect(h.db.reads.filter(read => read.table === "memories").flatMap(read => read.ids)).not.toContain(foreignId);
    await expect(h.invoke(memories.keywordSearchMemories, { query: "private", memorySpaceId: "space-b", limit: 20, reference: owner })).rejects.toMatchObject(forbidden);
    await h.invoke(memories.deleteMemory, { memorySpaceId: "space-a", memoryId: "own" });
    await expect(h.invoke(memories.fetchMemoriesByIds, { ids: [ownId], reference: owner })).rejects.toMatchObject(forbidden);
    await h.db.patch(owner.grantId, { revokedAt: Date.now() });
    await expect(h.invoke(memories.keywordSearchMemories, { query: "private", memorySpaceId: "space-a", limit: 20, reference: owner })).rejects.toMatchObject(forbidden);
  });

  it("requires independent read/write capabilities and refuses admin-only data access", async () => {
    const h = harness(); await h.provisionScope({ capabilities: ["admin"] });
    await expect(h.invoke(memories.list, { memorySpaceId: "space-a" })).rejects.toMatchObject(forbidden);
    await expect(h.invoke(memories.store, memoryStoreArgs)).rejects.toMatchObject(forbidden);
  });

  it("semantic requests fail PROFILE_NOT_READY after inherited verified auth and before any vector dispatch", async () => {
    const h = harness(); await h.provisionScope(); h.setIdentity({ ...identity, roles: ["admin"], tenantId: "tenant-b" });
    await expect(h.invoke(memories.search, { memorySpaceId: "space-a", query: "private", embedding: Array(1536).fill(0) })).rejects.toMatchObject({ data: { code: "PROFILE_NOT_READY" } });
    expect(h.vectorCalls()).toBe(0); expect(h.authReads()).toBeGreaterThan(0);
    h.setIdentity(null); await expect(h.invoke(memories.search, { memorySpaceId: "space-a", query: "private", embedding: [] })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });

  it("revocation/deletion after action admission or candidate hydration prevents later delivery and query reevaluations", async () => {
    for (const checkpoint of ["admission", "hydration"] as const) {
      const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "own");
      h.setInternalHook(async (name, stage) => {
        if (stage === "after" && name === (checkpoint === "admission" ? "runtimeAuth:authorize" : "memories:keywordSearchMemories")) {
          await h.db.patch(owner.grantId, { revokedAt: Date.now() });
        }
      });
      await expect(h.invoke(memories.search, { memorySpaceId: "space-a", query: "private" })).rejects.toMatchObject(forbidden);
    }
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "own");
    expect(await h.invoke(memories.count, { memorySpaceId: "space-a" })).toBe(1);
    await h.db.patch(owner.membershipId, { revokedAt: Date.now() });
    await expect(h.invoke(memories.count, { memorySpaceId: "space-a" })).rejects.toMatchObject(forbidden);
    await expect(h.invoke(memories.finalizePartialMemory, { memoryId: "own", content: "Late result", metadata: {} })).rejects.toMatchObject(forbidden);
  });

  it("source/resource deletion after keyword candidates is fenced before final action hydration", async () => {
    for (const kind of ["source", "memory"] as const) {
      const h = harness(); const owner = await h.provisionScope(); const id = await h.seedData("memories", owner, "own");
      h.setInternalHook(async (name, stage) => {
        if (name === "memories:keywordSearchMemories" && stage === "after") {
          if (kind === "source") await h.db.patch(h.db.rows.get("runtimeMemorySources")![0]._id, { tombstonedAt: Date.now() });
          else await h.db.insert("runtimeAuthTombstones", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId,
            resourceType: "memory", resourceId: "own", deletedAt: Date.now() });
        }
      });
      await expect(h.invoke(memories.search, { memorySpaceId: "space-a", query: "private" })).rejects.toMatchObject({ data: { code: kind === "source" ? "STALE_SOURCE" : "FORBIDDEN" } });
      expect((await h.db.get(id))?.content).toContain("private");
    }
  });

  it("independent read-only grants cannot write and write-only grants cannot hydrate read helpers", async () => {
    const readOnly = harness(); await readOnly.provisionScope({ capabilities: ["read"] });
    await expect(readOnly.invoke(memories.store, memoryStoreArgs)).rejects.toMatchObject(forbidden);
    const writeOnly = harness(); const owner = await writeOnly.provisionScope({ capabilities: ["write"] });
    const id = await writeOnly.seedData("memories", owner, "own");
    await expect(writeOnly.invoke(memories.fetchMemoriesByIds, { ids: [id], reference: owner })).rejects.toMatchObject(forbidden);
  });

  it("explicit assistant text and partial assistant output retain assistant claims across finalization", async () => {
    const h = harness(); const owner = await h.provisionScope();
    const row = await h.invoke<Doc<"memories">>(memories.store, { ...memoryStoreArgs, messageRole: "agent" });
    expect(row.lineage).toMatchObject({ role: "assistant", trust: "assistant_claim" });
    await h.db.insert("conversations", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.principalId,
      conversationId: "conversation-a", messages: [] });
    const partial = await h.invoke<{ memoryId: string }>(memories.storePartialMemory, { ...memoryStoreArgs, conversationId: "conversation-a",
      userId: owner.userId, isPartial: true, metadata: {} });
    await h.invoke(memories.finalizePartialMemory, { memoryId: partial.memoryId, content: "Assistant's finalized claim", metadata: {} });
    const finalized = await h.invoke<Doc<"memories">>(memories.get, { memorySpaceId: "space-a", memoryId: partial.memoryId });
    expect(finalized.lineage).toMatchObject({ role: "assistant", trust: "assistant_claim", sourceRevision: 2 });
    expect(finalized.runtimeEditor?.principalId).toBe(owner.principalId);
  });

  it("partial edits of an unbound assistant source retain assistant claims when establishing a dedicated binding", async () => {
    const h = harness(); const owner = await h.provisionScope(); const id = await h.seedData("memories", owner, "assistant-memory");
    const source = h.db.rows.get("runtimeMemorySources")![0];
    const lineage = { sourceId: "assistant-transcript", sourceEventId: "assistant-event", sourceRevision: 1, role: "assistant", trust: "assistant_claim" };
    await h.db.patch(source._id, { lineage }); await h.db.patch(id, { lineage, manualSourceBinding: undefined, messageRole: "agent" });
    const original = structuredClone(source);
    await h.invoke(memories.updatePartialMemory, { memoryId: "assistant-memory", content: "Updated assistant claim", metadata: {} });
    await h.invoke(memories.finalizePartialMemory, { memoryId: "assistant-memory", content: "Final assistant claim", metadata: {} });
    const finalized = await h.invoke<Doc<"memories">>(memories.get, { memorySpaceId: "space-a", memoryId: "assistant-memory" });
    expect(finalized.lineage).toMatchObject({ role: "assistant", trust: "assistant_claim", sourceRevision: 2 });
    expect(finalized.manualSourceBinding).toEqual({ resourceType: "memory", resourceId: "assistant-memory" });
    expect(h.db.rows.get("runtimeMemorySources")![0]).toEqual(original);
  });

  it("conversation links cannot smuggle a foreign participant space through an owned canonical conversation", async () => {
    const h = harness(); const owner = await h.provisionScope();
    await h.db.insert("conversations", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.principalId,
      conversationId: "conversation-a", participants: { memorySpaceIds: ["space-a", "space-b"] }, messages: [] });
    h.db.attemptedWrites = [];
    await expect(h.invoke(memories.store, { ...memoryStoreArgs, conversationRef: { conversationId: "conversation-a", messageIds: [] } })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it.each(["own", "space"] as const)("%s write-only mutations succeed with safe receipts and never expose private rows or filter-selected IDs", async access => {
    for (const operation of ["update", "restoreFromArchive", "updateMany", "deleteMany"] as const) {
      const h = harness();
      const owner = access === "space" ? await h.provisionScope({ subject: "bob" }) : await h.provisionScope({ capabilities: ["write"] });
      const id = await h.seedData("memories", owner, "private-unsupplied-id", { tags: ["archived"], metadata: { secret: "private-attribute" } });
      if (access === "space") await h.provisionScope({ capabilities: ["write"], resourceAccess: "space" });
      const result = await h.invoke<Record<string, unknown>>(memories[operation], { memorySpaceId: "space-a",
        ...(["update", "restoreFromArchive"].includes(operation) ? { memoryId: "private-unsupplied-id" } : {}), tags: ["edited"], importance: 60 });
      expect(result.mutationReceipt).toBe(true);
      expect(result.content).toBeUndefined(); expect(result.memory).toBeUndefined(); expect(result.metadata).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain("private-attribute"); expect(JSON.stringify(result)).not.toContain("private private-unsupplied-id");
      if (operation === "updateMany" || operation === "deleteMany") {
        expect(result.memoryIds).toBeUndefined(); expect(JSON.stringify(result)).not.toContain("private-unsupplied-id");
        expect(result).toEqual({ [operation === "updateMany" ? "updated" : "deleted"]: 1, mutationReceipt: true });
      }
      expect((await h.db.get(id))?.[operation === "deleteMany" ? "tombstonedAt" : "runtimeEditor"]).toBeDefined();
      await expect(h.invoke(memories.get, { memorySpaceId: "space-a", memoryId: "private-unsupplied-id" })).rejects.toMatchObject(forbidden);
    }
    const h = harness(); await h.provisionScope({ capabilities: ["write"] });
    const result = await h.invoke(memories.store, { ...memoryStoreArgs, metadata: { secret: "private-attribute" } });
    expect(result).toEqual({ mutationReceipt: true, operation: "store", memoryId: expect.any(String) });
  });

  it.each(["hash", "normalization"] as const)("denies %s corruption on current/history reads and all source revisions without repairing or writing", async corruption => {
    for (const operation of ["get", "getHistory", "getVersion", "getAtTimestamp", "update", "updatePartialMemory", "finalizePartialMemory"] as const) {
      const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "own");
      const source = h.db.rows.get("runtimeMemorySources")![0];
      const malformed = " unnormalized\r\nsource ";
      await h.db.patch(source._id, corruption === "hash" ? { contentHash: "forged" } : { content: malformed, contentHash: await semanticHash(malformed) });
      const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
      await expect(h.invoke(memories[operation], { memorySpaceId: "space-a", memoryId: "own", content: "Fresh edit", metadata: {},
        version: 1, timestamp: Date.now() + 10000 })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
      expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(before);
    }
  });

  it.each(["", " \r\n\t "])("empty normalized manual text %j cannot insert or revise a source", async text => {
    for (const operation of ["store", "storePartialMemory", "update", "updatePartialMemory", "finalizePartialMemory"] as const) {
      const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "own");
      await h.db.insert("conversations", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: owner.principalId, conversationId: "conversation-a", messages: [] });
      const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
      await expect(h.invoke(memories[operation], { ...memoryStoreArgs, memoryId: "own", content: text, metadata: {}, conversationId: "conversation-a",
        userId: owner.userId, isPartial: true })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
      expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(before);
    }
  });

  it.each(["grant", "expiry", "principal", "membership", "scope", "resource", "source-deletion", "source-integrity"] as const)("receipt read downgrade cannot hide late %s invalidation after write preparation", async invalidation => {
    for (const operation of ["update", "updateMany"] as const) {
      const h = harness(); const owner = await h.provisionScope({ capabilities: ["write"] });
      await h.seedData("memories", owner, "own"); await h.seedData("memories", owner, "second");
      const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let injected = false;
      h.setAuthHook(async () => {
        if (injected || !h.db.attemptedWrites.some(write => write.startsWith("patch:memories/"))) return;
        injected = true;
        if (invalidation === "grant") await h.db.patch(owner.grantId, { revokedAt: Date.now() });
        if (invalidation === "expiry") await h.db.patch(owner.grantId, { expiresAt: Date.now() - 1 });
        if (invalidation === "principal") await h.db.patch(owner.principalId, { revokedAt: Date.now() });
        if (invalidation === "membership") await h.db.patch(owner.membershipId, { revokedAt: Date.now() });
        if (invalidation === "scope") {
          const scope = h.db.rows.get("runtimeAuthScopes")!.find(row => row.memorySpaceId === "space-a")!;
          await h.db.patch(scope._id, { deletedAt: Date.now() });
        }
        if (invalidation === "resource") await h.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memory", resourceId: "own", deletedAt: Date.now() });
        if (invalidation.startsWith("source")) {
          const source = h.db.rows.get("runtimeMemorySources")![operation === "updateMany" ? 1 : 0];
          await h.db.patch(source._id, invalidation === "source-deletion" ? { tombstonedAt: Date.now() } : { contentHash: "forged" });
        }
      });
      await expect(h.invoke(memories[operation], { memorySpaceId: "space-a", memoryId: "own", tags: ["prepared-edit"] })).rejects.toMatchObject({ data: { code: invalidation.startsWith("source") ? "STALE_SOURCE" : "FORBIDDEN" } });
      expect(injected).toBe(true); expect(h.db.attemptedWrites.some(write => write.startsWith("patch:memories/"))).toBe(true);
      expect(h.db.rows).toEqual(before);
    }
  });

  it("a read-capable writer's failed independent read check cannot become receipt success", async () => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "own");
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
    h.setAuthHook(async () => {
      if (h.db.attemptedWrites.some(write => write.startsWith("patch:memories/"))) h.setIdentity({ ...identity, subject: "unknown-reader" });
    });
    await expect(h.invoke(memories.update, { memorySpaceId: "space-a", memoryId: "own", tags: ["prepared"] })).rejects.toMatchObject(forbidden);
    expect(h.db.rows).toEqual(before);
  });

  it.each(["store", "update"] as const)("%s rechecks expiry after async hashing and before source/row writes", async operation => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "own");
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let injected = false;
    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    const digest = jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
      if (!injected && new TextDecoder().decode(data) === "New hash boundary content") {
        injected = true; await h.db.patch(owner.grantId, { expiresAt: Date.now() - 1 });
      }
      return await originalDigest(algorithm, data);
    });
    try {
      await expect(h.invoke(memories[operation], { ...memoryStoreArgs, memoryId: "own", content: "New hash boundary content" })).rejects.toMatchObject(forbidden);
      expect(injected).toBe(true); expect(h.db.rows).toEqual(before);
      expect(h.db.attemptedWrites.filter(write => !write.endsWith(owner.grantId))).toEqual([]);
    } finally { digest.mockRestore(); }
  });

  it.each(["none", "read-revoked", "read-expired", "write-revoked", "write-expired"] as const)("distinct tenant READ and space WRITE grants fence restored private delivery: %s", async invalidation => {
    const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("memories", writer, "private", { tags: ["archived"] });
    const reader = await h.provisionTenantRead(Date.now() + 1000000);
    expect(reader.grantId).not.toBe(writer.grantId); expect(reader.memorySpaceId).toBeUndefined();
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let boundary = false;
    await withFinalWriteHash(h, "memories", async () => {
      boundary = true;
      if (invalidation !== "none") await h.db.patch(invalidation.startsWith("read") ? reader.grantId : writer.grantId,
        invalidation.endsWith("revoked") ? { revokedAt: Date.now() } : { expiresAt: Date.now() - 1 });
    }, async () => {
      const response = h.invoke(memories.restoreFromArchive, { memorySpaceId: "space-a", memoryId: "private" });
      if (invalidation === "none") expect(await response).toMatchObject({ restored: true, memory: { content: "tenant-a private private" } });
      else { await expect(response).rejects.toMatchObject(forbidden); expect(h.db.rows).toEqual(before); }
    });
    expect(boundary).toBe(true);
  });

  it.each(["read", "write"] as const)("the final awaited source reload cannot leave the opposite %s lifetime stale", async capability => {
    const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("memories", writer, "private", { tags: ["archived"] });
    const base = Date.now(); const reader = await h.provisionTenantRead(base + (capability === "read" ? 1000000 : 2000000));
    await h.db.patch(writer.grantId, { expiresAt: base + (capability === "write" ? 1000000 : 2000000) });
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let finalHash = false; let grantReads = 0; let finalGrantsFetched = false; let lifetimeBoundary = false; let now = base;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now); const get = h.db.get.bind(h.db);
    h.db.get = async (...args: Parameters<typeof get>) => {
      const result = await get(...args);
      if (finalHash && (args[1] ?? args[0]) === reader.grantId && ++grantReads === 3) finalGrantsFetched = true;
      return result;
    };
    // Source authorizations add a second pinned READ lookup; the third is the final raw grant fetch.
    // Advance time during the later source reload, after all grant checks have already awaited.
    const query = h.db.query.bind(h.db);
    h.db.query = table => {
      const selection = query(table); const unique = selection.unique;
      selection.unique = async () => {
        const row = await unique();
        if (table === "runtimeMemorySources" && finalGrantsFetched) { now = base + 1000001; lifetimeBoundary = true; }
        return row;
      };
      return selection;
    };
    try {
      await withFinalWriteHash(h, "memories", async () => { finalHash = true; }, async () => {
        await expect(h.invoke(memories.restoreFromArchive, { memorySpaceId: "space-a", memoryId: "private" })).rejects.toMatchObject(forbidden);
        expect(grantReads).toBe(3); expect(lifetimeBoundary).toBe(true); expect(h.db.rows).toEqual(before);
      });
    } finally { clock.mockRestore(); }
  });

  it.each(["deleteMany", "updateMany"] as const)("%s handles distinct grant delivery and late invalidation without exposing unsupplied IDs", async operation => {
    for (const invalidation of ["none", "read-revoked", "read-expired", "write-revoked", "write-expired"] as const) {
      const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("memories", writer, "unsupplied-private-id");
      const reader = await h.provisionTenantRead(Date.now() + 1000000); const before = structuredClone(h.db.rows);
      h.db.attemptedWrites = []; let injected = false; const patch = h.db.patch.bind(h.db);
      h.db.patch = async (...args: Parameters<typeof patch>) => {
        await patch(...args); const id = typeof args[1] === "string" ? args[1] : args[0];
        if (!injected && id.startsWith("memories/") && invalidation !== "none") {
          injected = true; await patch(invalidation.startsWith("read") ? reader.grantId : writer.grantId,
            invalidation.endsWith("revoked") ? { revokedAt: Date.now() } : { expiresAt: Date.now() - 1 });
        }
      };
      const response = h.invoke(memories[operation], { memorySpaceId: "space-a", tags: ["updated"] });
      if (invalidation === "none") expect(await response).toMatchObject({ memoryIds: ["unsupplied-private-id"] });
      else { await expect(response).rejects.toMatchObject(forbidden); expect(h.db.rows).toEqual(before); }
      if (invalidation !== "none") expect(injected).toBe(true);
    }
  });

  it.each(["cycle", "wrong-edge-version"] as const)("denies %s in the active linked path before reads or edits can complete", async variant => {
    const h = harness(); const owner = await h.provisionScope();
    const a = await h.seedData("memories", owner, "memory-a"); const b = await h.seedData("memories", owner, "memory-b");
    const f = await h.seedData("facts", owner, "fact-f");
    await h.db.patch(a, { factsRef: { factId: "fact-f", version: 1 } });
    await h.db.patch(f, { sourceRef: { memoryId: variant === "cycle" ? "memory-a" : "memory-b" } });
    if (variant === "wrong-edge-version") await h.db.patch(b, { factsRef: { factId: "fact-f", version: 99 } });
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
    for (const operation of ["get", "updatePartialMemory"] as const) await expect(h.invoke(memories[operation],
      { memorySpaceId: "space-a", memoryId: "memory-a", content: "Edit", metadata: {} })).rejects.toMatchObject({ data: { code: variant === "cycle" ? "INVALID_INPUT" : "FORBIDDEN" } });
    expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(before);
  });

  it("allows repeated valid DAG nodes after path cleanup and checks every repeated edge version", async () => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "shared-memory");
    await h.seedData("facts", owner, "linked-fact", { sourceRef: { memoryId: "shared-memory" } });
    const authority = await requireDataAuthority(h.ctx, { memorySpaceId: "space-a" }, "read");
    await expect(assertDataLinks(h.ctx, authority, "read", { factsRef: { factId: "linked-fact", version: 1 }, sourceRef: { memoryId: "shared-memory" } })).resolves.toBeUndefined();
    const result = await h.invoke<Doc<"memories">>(memories.store, { ...memoryStoreArgs, factsRef: { factId: "linked-fact", version: 1 } });
    expect(result.factsRef).toEqual({ factId: "linked-fact", version: 1 });
    expect(await h.invoke(facts.get, { memorySpaceId: "space-a", factId: "linked-fact" })).toMatchObject({ factId: "linked-fact" });
    h.db.attemptedWrites = [];
    await expect(h.invoke(memories.store, { ...memoryStoreArgs, factsRef: { factId: "linked-fact", version: 99 } })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it.each(["empty-anchor", "foreign-anchor"] as const)("partial creation denies malformed %s references before creating source or memory", async variant => {
    const h = harness(); const owner = await h.provisionScope();
    await h.db.insert("conversations", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: owner.principalId,
      conversationId: "conversation-a", messages: [{ id: "owned-message", content: "Owned" }] });
    await h.db.insert("conversations", { tenantId: "tenant-a", memorySpaceId: "space-b", ownerPrincipalId: owner.principalId,
      conversationId: "foreign-conversation", messages: [] });
    h.db.attemptedWrites = [];
    await expect(h.invoke(memories.storePartialMemory, { ...memoryStoreArgs, conversationId: variant === "empty-anchor" ? "" : "foreign-conversation",
      userId: owner.userId, isPartial: true, metadata: {} })).rejects.toMatchObject({ data: { code: variant === "empty-anchor" ? "INVALID_INPUT" : "FORBIDDEN" } });
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it.each(["immutable", "mutable"] as const)("valid %s links remain usable while foreign ownership, missing ownership, tombstones and wrong versions fail before writes", async kind => {
    for (const variant of ["valid", "foreign", "missing-owner", "tombstone", ...(kind === "immutable" ? ["wrong-version"] : [])]) {
      const h = harness(); const owner = await h.provisionScope();
      await h.db.insert(kind, { ...(kind === "immutable" ? { type: "profile", id: "ref", version: 1 } : { namespace: "profile", key: "ref" }),
        tenantId: variant === "foreign" ? "tenant-b" : "tenant-a", memorySpaceId: "space-a",
        ...(variant === "missing-owner" ? {} : { ownerPrincipalId: owner.principalId }), ...(variant === "tombstone" ? { tombstonedAt: Date.now() } : {}) });
      const reference = kind === "immutable" ? { immutableRef: { type: "profile", id: "ref", version: variant === "wrong-version" ? 99 : 1 } }
        : { mutableRef: { namespace: "profile", key: "ref", snapshotValue: "caller", snapshotAt: Date.now() } };
      h.db.attemptedWrites = [];
      if (variant === "valid") expect(await h.invoke(memories.store, { ...memoryStoreArgs, ...reference })).toMatchObject({ memoryId: expect.any(String) });
      else {
        await expect(h.invoke(memories.store, { ...memoryStoreArgs, ...reference })).rejects.toMatchObject(forbidden);
        expect(h.db.attemptedWrites).toEqual([]);
      }
    }
  });

  it("keeps 19 modern public registrations and internalizes deployment-wide purge while retaining internal helpers", () => {
    expect(cases).toHaveLength(19);
    for (const [name] of cases) expect((memories[name] as unknown as { isPublic: boolean }).isPublic).toBe(true);
    for (const registration of [memories.purgeAll, memories.fetchMemoriesByIds, memories.keywordSearchMemories]) expect(registration.isInternal).toBe(true);
  });

  it.each(["tombstone", "revision", "event", "source-id", "owner", "scope", "content", "hash", "created-at", "creation-time", "role-trust", "tool-operation"] as const)("memory private delivery rejects a full canonical source witness change during its final WRITE hash: %s", async change => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "private", { tags: ["archived"] });
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let injected = false;
    await withFinalWriteHash(h, "memories", async () => {
      injected = true; const source = h.db.rows.get("runtimeMemorySources")![0]; const lineage = source.lineage as Record<string, unknown>;
      const fields = change === "tombstone" ? { tombstonedAt: Date.now() }
        : change === "revision" ? { lineage: { ...lineage, sourceRevision: Number(lineage.sourceRevision) + 1 } }
        : change === "event" ? { lineage: { ...lineage, sourceEventId: "new-event" } }
        : change === "source-id" ? { lineage: { ...lineage, sourceId: "different-source" } }
        : change === "owner" ? { ownerPrincipalId: "other-principal" }
        : change === "scope" ? { memorySpaceId: "space-other" }
        : change === "content" ? { content: "Changed valid source", contentHash: await semanticHash("Changed valid source") }
        : change === "hash" ? { contentHash: "corrupt-hash" }
        : change === "created-at" ? { createdAt: Number(source.createdAt) + 1 }
        : change === "creation-time" ? { _creationTime: source._creationTime + 1 }
        : change === "role-trust" ? { lineage: { ...lineage, role: "assistant", trust: "assistant_claim" } }
        : { lineage: { ...lineage, operationId: "forged-tool-operation" } };
      await h.db.patch(source._id, fields);
    }, async () => {
      await expect(h.invoke(memories.restoreFromArchive, { memorySpaceId: "space-a", memoryId: "private" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
      expect(h.db.rows).toEqual(before);
    });
    expect(injected).toBe(true); expect(h.db.attemptedWrites).toContainEqual(expect.stringMatching(/^patch:memories\//));
  });

  it.each(["list", "search", "internal-hydration"] as const)("%s reloads earlier memory sources after later candidate hashes", async operation => {
    const h = harness(); const owner = await h.provisionScope(); const first = await h.seedData("memories", owner, "first"); const second = await h.seedData("memories", owner, "second");
    const before = structuredClone(h.db.rows); const source = h.db.rows.get("runtimeMemorySources")![0];
    await withSourceHashBoundary(async () => { await h.db.patch(source._id, { tombstonedAt: Date.now() }); }, async () => {
      const response = operation === "internal-hydration" ? h.invoke(memories.fetchMemoriesByIds, { ids: [first, second], reference: owner })
        : h.invoke(memories[operation], { memorySpaceId: "space-a", query: "private" });
      await expect(response).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } }); expect(h.db.rows).toEqual(before);
    }, content => content.includes("private second"));
  });

  it.each(["tenant-resource", "source-row", "source-control", "source-event", "proof-payload", "late-write"] as const)("bulk deletion exempts only its exact scoped proof and retains independent %s fences", async change => {
    for (const readable of [false, true]) {
      const h = harness(); const owner = await h.provisionScope({ capabilities: readable ? ["read", "write"] : ["write"] }); await h.seedData("memories", owner, "private");
      const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; const patch = h.db.patch.bind(h.db); let injected = false;
      h.db.patch = async (...args: Parameters<typeof patch>) => {
        await patch(...args); const id = typeof args[1] === "string" ? args[1] : args[0];
        if (injected || !id.startsWith("memories/")) return; injected = true;
        const source = h.db.rows.get("runtimeMemorySources")![0]; const lineage = source.lineage as Record<string, unknown>;
        if (change === "tenant-resource") await h.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", resourceType: "memory", resourceId: "private", deletedAt: Date.now() });
        if (change === "source-row") await patch(source._id, { tombstonedAt: Date.now() });
        if (change === "source-control") await h.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", resourceType: "source", resourceId: lineage.sourceId, deletedAt: Date.now() });
        if (change === "source-event") await patch(source._id, { lineage: { ...lineage, sourceEventId: "replaced-event" } });
        if (change === "proof-payload") await patch(h.db.rows.get("runtimeAuthTombstones")![0]._id, { _creationTime: -1 });
        if (change === "late-write") await patch(owner.grantId, { revokedAt: Date.now() });
      };
      await expect(h.invoke(memories.deleteMany, { memorySpaceId: "space-a" })).rejects.toMatchObject({ data: { code: change === "source-row" || change === "source-event" ? "STALE_SOURCE" : "FORBIDDEN" } });
      expect(injected).toBe(true); expect(h.db.rows).toEqual(before);
    }
  });

  it.each([false, true])("current bulk delete receipts succeed with exact operation proofs (independent READ=%s)", async readable => {
    const h = harness(); const owner = await h.provisionScope({ capabilities: readable ? ["read", "write"] : ["write"] }); await h.seedData("memories", owner, "private");
    const response = await h.invoke(memories.deleteMany, { memorySpaceId: "space-a" });
    expect(response).toEqual(readable ? { deleted: 1, memoryIds: ["private"] } : { deleted: 1, mutationReceipt: true });
    expect(h.db.rows.get("runtimeAuthTombstones")).toHaveLength(1); expect(h.db.rows.get("memories")![0].tombstonedAt).toEqual(expect.any(Number));
  });

  it("source revision CAS cannot overwrite a concurrently replaced valid canonical payload", async () => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "private"); const before = structuredClone(h.db.rows);
    const source = h.db.rows.get("runtimeMemorySources")![0]; const replacementHash = await semanticHash("Independent replacement");
    await withSourceHashBoundary(async () => { await h.db.patch(source._id, { content: "Independent replacement", contentHash: replacementHash }); }, async () => {
      await expect(h.invoke(memories.update, { memorySpaceId: "space-a", memoryId: "private", content: "Edited assertion" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
      expect(h.db.rows).toEqual(before);
    }, content => content === "Edited assertion");
  });


  it.each(["get"] as const)("%s checks READ expiry after its canonical source reload awaits", async operation => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("memories", owner, "private");
    const base = Date.now(); await h.db.patch(owner.grantId, { expiresAt: base + 1000000 }); const before = structuredClone(h.db.rows);
    let now = base; let hashed = false; let grantReads = 0; let injected = false;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now); const get = h.db.get.bind(h.db); const query = h.db.query.bind(h.db);
    h.db.get = async (...args: Parameters<typeof get>) => {
      const row = await get(...args); if (hashed && (args[1] ?? args[0]) === owner.grantId) grantReads++; return row;
    };
    h.db.query = table => {
      const selection = query(table); const unique = selection.unique;
      selection.unique = async () => {
        const row = await unique();
        if (table === "runtimeMemorySources" && grantReads === 3) { injected = true; now = base + 1000001; }
        return row;
      };
      return selection;
    };
    try {
      await withSourceHashBoundary(async () => { hashed = true; }, async () => {
        await expect(h.invoke(memories[operation], { memorySpaceId: "space-a", memoryId: "private" })).rejects.toMatchObject(forbidden);
        expect(injected).toBe(true); expect(h.db.rows).toEqual(before);
      });
    } finally { clock.mockRestore(); }
  });

  it.each(["list", "search", "internal-hydration"] as const)("%s retains earlier resource controls while later source candidates are hashed", async operation => {
    const h = harness(); const owner = await h.provisionScope(); const first = await h.seedData("memories", owner, "first"); const second = await h.seedData("memories", owner, "second"); const before = structuredClone(h.db.rows);
    await withSourceHashBoundary(async () => { await h.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", resourceType: "memory", resourceId: "first", deletedAt: Date.now() }); }, async () => {
      const response = operation === "internal-hydration" ? h.invoke(memories.fetchMemoriesByIds, { ids: [first, second], reference: owner })
        : h.invoke(memories[operation], { memorySpaceId: "space-a", query: "private" });
      await expect(response).rejects.toMatchObject(forbidden); expect(h.db.rows).toEqual(before);
    }, content => content.includes("private second"));
  });

});
