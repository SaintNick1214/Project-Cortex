import { describe, expect, it, jest } from "@jest/globals";
import * as facts from "../../../convex-dev/facts";
import * as memories from "../../../convex-dev/memories";
import { semanticHash } from "../../../src/domain/profile";
import { factStoreArgs, forbidden, harness, memoryStoreArgs, withFinalWriteHash, withSourceHashBoundary } from "./sharedfixtures";
import type { Doc } from "../../../convex-dev/_generated/dataModel";
import type { DerivedFact } from "../../../src/domain/contracts";

const scope = { memorySpaceId: "space-a", factId: "same-id" };
const cases = [
  ["store", factStoreArgs, "row"], ["update", { ...scope, fact: "Updated assertion" }, "row"], ["deleteFact", scope, "deleted"],
  ["supersede", { memorySpaceId: "space-a", oldFactId: "same-id", newFactId: "peer" }, "superseded"],
  ["updateInPlace", { ...scope, fact: "Updated assertion" }, "row"], ["deleteMany", { memorySpaceId: "space-a" }, "bulk"],
  ["get", scope, "row"], ["list", { memorySpaceId: "space-a" }, "array"], ["count", { memorySpaceId: "space-a" }, "count"],
  ["search", { memorySpaceId: "space-a", query: "private" }, "array"],
  ["semanticSearch", { memorySpaceId: "space-a", embedding: Array(1536).fill(0) }, "profile"],
  ["getHistory", scope, "array"], ["queryBySubject", { memorySpaceId: "space-a", subject: "alice" }, "array"],
  ["queryByRelationship", { memorySpaceId: "space-a", subject: "alice", predicate: "prefers" }, "array"],
  ["exportFacts", { memorySpaceId: "space-a", format: "json" }, "export"],
  ["consolidate", { memorySpaceId: "space-a", factIds: ["same-id", "peer"], keepFactId: "same-id" }, "consolidated"],
  ["findByStructure", { memorySpaceId: "space-a", subject: "alice", predicate: "prefers", object: "dark" }, "array"],
  ["deleteByIds", { factIds: ["same-id"] }, "bulk"],
] as const;

describe("actual facts endpoint closure", () => {
  it.each(cases)("%s constrains actual canonical selection and mutation with a foreign same-ID row inserted first", async (name, args, outcome) => {
    const h = harness(); const foreign = await h.provisionScope({ tenantId: "tenant-b", subject: "bob" });
    const foreignId = await h.seedData("facts", foreign, "same-id"); const owner = await h.provisionScope();
    await h.seedData("facts", owner, "same-id");
    if (name === "supersede" || name === "consolidate") await h.seedData("facts", owner, "peer", { confidence: 60 });
    h.db.reads = []; h.db.attemptedWrites = [];
    if (outcome === "profile") {
      await expect(h.invoke(facts[name], { ...args })).rejects.toMatchObject({ data: { code: "PROFILE_NOT_READY" } });
      expect(h.vectorCalls()).toBe(0);
    } else {
      const result = await h.invoke(facts[name], { ...args });
      if (outcome === "row") expect(result).toMatchObject({ tenantId: "tenant-a", ownerPrincipalId: owner.principalId });
      else if (outcome === "deleted") expect(result).toEqual({ deleted: true, factId: "same-id" });
      else if (outcome === "array") expect(result).toHaveLength(1);
      else if (outcome === "count") expect(result).toBe(1);
      else if (outcome === "bulk") expect(result).toMatchObject({ deleted: 1 });
      else if (outcome === "superseded") expect(result).toMatchObject({ superseded: true, oldFactId: "same-id", newFactId: "peer" });
      else if (outcome === "consolidated") {
        expect(result).toEqual({ consolidated: true, keptFactId: "same-id", mergedCount: 1 });
        expect((await h.invoke<Doc<"facts">>(facts.get, scope)).confidence).toBe(70);
      } else expect(result).toMatchObject({ count: 1, data: expect.stringContaining("tenant-a private same-id") });
      expect(JSON.stringify(result)).not.toContain("tenant-b");
    }
    expect(h.db.reads.filter(read => read.table === "facts").flatMap(read => read.ids)).not.toContain(foreignId);
    expect(h.db.attemptedWrites.some(write => write.endsWith(foreignId))).toBe(false);
  });

  it.each(cases.map(([name, args]) => [name, args] as const))("%s denies missing identity before data hydration and writes", async (name, args) => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("facts", owner, "same-id");
    h.setIdentity(null); h.db.reads = []; h.db.attemptedWrites = [];
    await expect(h.invoke(facts[name], { ...args })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    expect(h.db.reads.filter(read => read.table === "facts")).toEqual([]); expect(h.db.attemptedWrites).toEqual([]);
  });

  it("derives missing tenant and denies same-tenant foreign owners, missing ownership, mismatched tenant and ambiguous scopes", async () => {
    const h = harness(); const bob = await h.provisionScope({ subject: "bob" }); const bobId = await h.seedData("facts", bob, "same-id");
    const owner = await h.provisionScope(); await h.seedData("facts", owner, "same-id");
    await h.db.insert("facts", { factId: "orphan", tenantId: "tenant-a", memorySpaceId: "space-a", fact: "Missing ownership" });
    h.db.reads = [];
    expect(await h.invoke(facts.count, { memorySpaceId: "space-a" })).toBe(1);
    expect(h.db.reads.filter(read => read.table === "facts").flatMap(read => read.ids)).not.toContain(bobId);
    await expect(h.invoke(facts.get, { ...scope, tenantId: "tenant-b" })).rejects.toMatchObject(forbidden);
    await h.provisionScope({ memorySpaceId: "space-b" });
    await expect(h.invoke(facts.deleteByIds, { factIds: ["same-id"] })).rejects.toMatchObject(forbidden);
    await h.provisionScope({ tenantId: "tenant-b" });
    await expect(h.invoke(facts.list, { memorySpaceId: "space-a" })).rejects.toMatchObject(forbidden);
  });

  it("trusted space access permits explicit cross-principal reads but still excludes missing owner rows", async () => {
    const h = harness(); const bob = await h.provisionScope({ subject: "bob" }); await h.seedData("facts", bob, "bob-fact");
    await h.provisionScope({ resourceAccess: "space" });
    expect(await h.invoke(facts.count, { memorySpaceId: "space-a" })).toBe(1);
    expect(await h.invoke(facts.get, { memorySpaceId: "space-a", factId: "bob-fact" })).toMatchObject({ ownerPrincipalId: bob.principalId });
    await h.db.insert("facts", { factId: "orphan", tenantId: "tenant-a", memorySpaceId: "space-a", fact: "Missing ownership" });
    expect(await h.invoke(facts.count, { memorySpaceId: "space-a" })).toBe(1);
  });

  it.each(["userId", "participantId"])("rejects forged %s on explicit fact creation before source admission", async label => {
    const h = harness(); await h.provisionScope(); h.db.attemptedWrites = [];
    await expect(h.invoke(facts.store, { ...factStoreArgs, [label]: "metadata-bob" })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it("manual facts cannot retain caller tool trust, and editing extracted tool facts creates a dedicated assertion source", async () => {
    const h = harness(); const owner = await h.provisionScope();
    const explicit = await h.invoke<Doc<"facts">>(facts.store, factStoreArgs);
    expect(explicit).toMatchObject({ sourceType: "manual", lineage: { role: "user", trust: "user_assertion" }, extractionPolicyVersion: "manual-assertion-v1" });
    const id = await h.seedData("facts", owner, "tool-fact"); const toolRow = (await h.db.get(id))!;
    const toolLineage = { sourceId: "canonical-tool", sourceEventId: "tool-event", sourceRevision: 1, role: "tool", trust: "verified_tool_evidence", operationId: "operation-a" };
    const toolSource = h.db.rows.get("runtimeMemorySources")!.find(row => (row.lineage as { sourceId: string }).sourceId === (toolRow.lineage as { sourceId: string }).sourceId)!;
    await h.db.patch(toolSource._id, { lineage: toolLineage, content: "Tool evidence", contentHash: await semanticHash("Tool evidence") });
    await h.db.patch(id, { lineage: toolLineage, manualSourceBinding: undefined, sourceType: "tool", extractionPolicyVersion: "extract-v1" });
    const edited = await h.invoke<Doc<"facts">>(facts.updateInPlace, { memorySpaceId: "space-a", factId: toolRow.factId, fact: "User corrected the tool" });
    expect(edited.lineage).toMatchObject({ role: "user", trust: "user_assertion" }); expect(edited.lineage?.sourceId).not.toBe("canonical-tool");
    expect(h.db.rows.get("runtimeMemorySources")!.find(row => (row.lineage as { sourceId: string }).sourceId === "canonical-tool")!.lineage).toEqual(toolLineage);
  });

  it("preflights every supersession/consolidation peer and current version before any mutation", async () => {
    const h = harness(); const owner = await h.provisionScope(); const ownId = await h.seedData("facts", owner, "own");
    const other = await h.provisionScope({ memorySpaceId: "space-b", subject: "bob" }); await h.seedData("facts", other, "foreign");
    h.db.attemptedWrites = [];
    await expect(h.invoke(facts.supersede, { memorySpaceId: "space-a", oldFactId: "own", newFactId: "foreign" })).rejects.toMatchObject({ data: "NEW_FACT_NOT_FOUND" });
    await expect(h.invoke(facts.consolidate, { memorySpaceId: "space-a", factIds: ["own", "foreign"], keepFactId: "own" })).rejects.toMatchObject(forbidden);
    await expect(h.invoke(facts.deleteByIds, { factIds: ["own", "foreign"] })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]); expect((await h.db.get(ownId))?.supersededBy).toBeUndefined();
    await h.db.patch(ownId, { supersededBy: "later" }); h.db.attemptedWrites = [];
    await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "own", fact: "stale edit" })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it("actual mutation fixture rolls back all rows and tombstones on a later write failure", async () => {
    const h = harness(); const owner = await h.provisionScope(); const first = await h.seedData("facts", owner, "first"); const second = await h.seedData("facts", owner, "second");
    const patch = h.db.patch.bind(h.db); let patchCalls = 0;
    h.db.patch = async (...args: Parameters<typeof patch>) => { if (++patchCalls === 2) throw new Error("Injected later-stage failure"); await patch(...args); };
    await expect(h.invoke(facts.deleteByIds, { factIds: ["first", "second"] })).rejects.toThrow("Injected later-stage failure");
    expect((await h.db.get(first))?.tombstonedAt).toBeUndefined(); expect((await h.db.get(second))?.tombstonedAt).toBeUndefined();
    expect(h.db.rows.get("runtimeAuthTombstones") ?? []).toEqual([]);
  });

  it("checks linked source memories/conversations and denies foreign history chain targets", async () => {
    const h = harness(); const owner = await h.provisionScope(); const ownId = await h.seedData("facts", owner, "own");
    const other = await h.provisionScope({ tenantId: "tenant-b", subject: "bob" }); const foreign = await h.seedData("facts", other, "foreign"); await h.seedData("memories", other, "foreign-memory");
    h.db.attemptedWrites = [];
    await expect(h.invoke(facts.store, { ...factStoreArgs, sourceRef: { memoryId: "foreign-memory" } })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
    await h.db.patch(ownId, { supersededBy: "foreign" }); h.db.reads = [];
    await expect(h.invoke(facts.getHistory, { memorySpaceId: "space-a", factId: "own" })).rejects.toMatchObject(forbidden);
    expect(h.db.reads.filter(read => read.table === "facts").flatMap(read => read.ids)).not.toContain(foreign);
  });

  it("internal hydration requires a stored read grant and denies foreign IDs, revoked grants and deleted source/resource fences", async () => {
    const h = harness(); const owner = await h.provisionScope(); const id = await h.seedData("facts", owner, "own");
    const other = await h.provisionScope({ tenantId: "tenant-b", subject: "bob" }); const foreign = await h.seedData("facts", other, "foreign");
    await expect(h.invoke(facts.fetchFactsByIds, { ids: [foreign], reference: owner })).rejects.toMatchObject(forbidden);
    expect(await h.invoke(facts.fetchFactsByIds, { ids: [id], reference: owner })).toHaveLength(1);
    await h.invoke(facts.deleteFact, { memorySpaceId: "space-a", factId: "own" });
    await expect(h.invoke(facts.fetchFactsByIds, { ids: [id], reference: owner })).rejects.toMatchObject(forbidden);
    await h.db.patch(owner.grantId, { revokedAt: Date.now() });
    await expect(h.invoke(facts.fetchFactsByIds, { ids: [], reference: owner })).rejects.toMatchObject(forbidden);
  });

  it("excluding stale source revisions and source tombstones prevents current list/count/keyword reads", async () => {
    const h = harness(); const owner = await h.provisionScope(); const id = await h.seedData("facts", owner, "own");
    const row = (await h.db.get(id))!; const source = h.db.rows.get("runtimeMemorySources")![0];
    await h.db.patch(source._id, { lineage: { ...(source.lineage as Record<string, unknown>), sourceRevision: 2 } });
    expect(await h.invoke(facts.count, { memorySpaceId: "space-a" })).toBe(0);
    expect(await h.invoke(facts.search, { memorySpaceId: "space-a", query: "private" })).toEqual([]);
    await expect(h.invoke(facts.get, { memorySpaceId: "space-a", factId: row.factId })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    await h.db.patch(source._id, { lineage: row.lineage, tombstonedAt: Date.now() });
    expect(await h.invoke(facts.list, { memorySpaceId: "space-a" })).toEqual([]);
  });

  it("explicit audited history returns both versions after an update while normal current reads exclude the stale old version", async () => {
    const h = harness(); const owner = await h.provisionScope();
    const original = await h.invoke<Doc<"facts">>(facts.store, factStoreArgs);
    const updated = await h.invoke<Doc<"facts">>(facts.update, { memorySpaceId: "space-a", factId: original.factId, fact: "Updated belief" });
    const history = await h.invoke<Array<Doc<"facts"> & { historical: boolean; stale: boolean; currentSourceRevision: number }>>(facts.getHistory,
      { memorySpaceId: "space-a", factId: updated.factId });
    expect(history.map(row => [row.version, row.historical, row.stale, row.currentSourceRevision])).toEqual([[1, true, true, 2], [2, true, false, 2]]);
    expect(history[0].runtimeEditor).toEqual(original.runtimeEditor);
    expect(updated.runtimeEditor?.principalId).toBe(owner.principalId);
    await expect(h.invoke(facts.get, { memorySpaceId: "space-a", factId: original.factId })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: original.factId, fact: "Resurrect stale belief" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    const current = await h.invoke<Doc<"facts">[]>(facts.list, { memorySpaceId: "space-a", includeSuperseded: true });
    expect(current.map(row => row.factId)).toEqual([updated.factId]);
  });

  it.each(["event", "trust", "future", "source-tombstone", "fact-tombstone"] as const)("audited history still denies %s provenance/lifecycle corruption", async kind => {
    const h = harness(); const owner = await h.provisionScope(); const id = await h.seedData("facts", owner, "own");
    const row = (await h.db.get(id))!; const lineage = row.lineage as Record<string, unknown>;
    if (kind === "event") await h.db.patch(id, { lineage: { ...lineage, sourceEventId: "forged-event" } });
    if (kind === "trust") await h.db.patch(id, { lineage: { ...lineage, role: "tool", trust: "verified_tool_evidence", operationId: "forged-op" } });
    if (kind === "future") await h.db.patch(id, { lineage: { ...lineage, sourceRevision: 99 } });
    if (kind.endsWith("tombstone")) await h.db.insert("runtimeAuthTombstones", { tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId,
      resourceType: kind === "source-tombstone" ? "source" : "fact", resourceId: kind === "source-tombstone" ? lineage.sourceId : "own", deletedAt: Date.now() });
    await expect(h.invoke(facts.getHistory, { memorySpaceId: "space-a", factId: "own" })).rejects.toMatchObject({ data: { code: kind.endsWith("tombstone") ? "FORBIDDEN" : "STALE_SOURCE" } });
  });

  it("cross-principal edits retain canonical ownership and bind editor audit from verified authority, ignoring caller metadata editor labels", async () => {
    const h = harness(); const bob = await h.provisionScope({ subject: "bob" }); const id = await h.seedData("facts", bob, "bob-fact");
    const original = (await h.db.get(id))!; const alice = await h.provisionScope({ resourceAccess: "space" });
    const updated = await h.invoke<Doc<"facts">>(facts.update, { memorySpaceId: "space-a", factId: "bob-fact", fact: "Editor Alice's correction",
      metadata: { runtimeEditor: { principalId: "forged-admin" }, custom: "preserved" } });
    expect(updated.ownerPrincipalId).toBe(bob.principalId);
    expect(updated.runtimeEditor).toMatchObject({ principalId: alice.principalId, userId: alice.userId });
    expect(updated.metadata).toEqual({ runtimeEditor: { principalId: "forged-admin" }, custom: "preserved" });
    const history = await h.invoke<Doc<"facts">[]>(facts.getHistory, { memorySpaceId: "space-a", factId: updated.factId });
    expect(history[0].runtimeEditor).toEqual(original.runtimeEditor);
    expect(history[1].runtimeEditor?.principalId).toBe(alice.principalId);
    const source = h.db.rows.get("runtimeMemorySources")![0]; expect(source.ownerPrincipalId).toBe(bob.principalId);
  });

  it("assistant-derived claims remain excluded from current fact reads even when source ownership and revision match", async () => {
    const h = harness(); const owner = await h.provisionScope(); const id = await h.seedData("facts", owner, "assistant-claim");
    const row = (await h.db.get(id))!; const lineage = { ...(row.lineage as Record<string, unknown>), role: "assistant", trust: "assistant_claim" };
    await h.db.patch(id, { lineage }); await h.db.patch(h.db.rows.get("runtimeMemorySources")![0]._id, { lineage });
    expect(await h.invoke(facts.count, { memorySpaceId: "space-a" })).toBe(0);
    expect(await h.invoke(facts.search, { memorySpaceId: "space-a", query: "private" })).toEqual([]);
    await expect(h.invoke(facts.get, { memorySpaceId: "space-a", factId: "assistant-claim" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
  });

  it.each(["own", "space"] as const)("%s write-only edits return safe receipts while read+write preserves hydrated responses", async access => {
    for (const operation of ["update", "updateInPlace"] as const) {
      const h = harness(); const owner = access === "space" ? await h.provisionScope({ subject: "bob" }) : await h.provisionScope({ capabilities: ["write"] });
      await h.seedData("facts", owner, "private-fact", { metadata: { secret: "private-attribute" } });
      if (access === "space") await h.provisionScope({ capabilities: ["write"], resourceAccess: "space" });
      const result = await h.invoke<Record<string, unknown>>(facts[operation], { memorySpaceId: "space-a", factId: "private-fact", confidence: 91 });
      expect(result).toEqual({ mutationReceipt: true, operation, factId: expect.any(String) });
      expect(JSON.stringify(result)).not.toContain("private-attribute"); expect(result.fact).toBeUndefined();
      const stored = h.db.rows.get("facts")!.find(row => row.factId === result.factId)!; expect(stored.confidence).toBe(91);
      await expect(h.invoke(facts.get, { memorySpaceId: "space-a", factId: result.factId })).rejects.toMatchObject(forbidden);
    }
    const h = harness(); await h.provisionScope({ capabilities: ["write"] });
    expect(await h.invoke(facts.store, { ...factStoreArgs, metadata: { secret: "private-attribute" } })).toEqual({ mutationReceipt: true, operation: "store", factId: expect.any(String) });
    const readable = harness(); const owner = await readable.provisionScope(); await readable.seedData("facts", owner, "readable", { metadata: { secret: "allowed-attribute" } });
    expect(await readable.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "readable", confidence: 92 })).toMatchObject({ fact: "tenant-a private readable", metadata: { secret: "allowed-attribute" }, confidence: 92 });
  });

  it.each(["hash", "normalization"] as const)("current and audited historical reads reject canonical %s corruption and edits cannot repair it", async corruption => {
    for (const operation of ["get", "getHistory", "update", "updateInPlace"] as const) {
      const h = harness(); await h.provisionScope();
      const first = await h.invoke<Doc<"facts">>(facts.store, factStoreArgs);
      const next = await h.invoke<Doc<"facts">>(facts.update, { memorySpaceId: "space-a", factId: first.factId, fact: "Updated fact" });
      const malformed = " unnormalized\r\nsource "; const source = h.db.rows.get("runtimeMemorySources")![0];
      await h.db.patch(source._id, corruption === "hash" ? { contentHash: "forged" } : { content: malformed, contentHash: await semanticHash(malformed) });
      const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
      await expect(h.invoke(facts[operation], { memorySpaceId: "space-a", factId: next.factId, fact: "Attempted repair" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
      expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(before);
      expect(await h.invoke(facts.list, { memorySpaceId: "space-a" })).toEqual([]);
    }
  });

  it.each(["", " \r\n\t "])("empty normalized fact text %j cannot insert or revise a canonical source", async text => {
    for (const operation of ["store", "update", "updateInPlace"] as const) {
      const h = harness(); const owner = await h.provisionScope(); await h.seedData("facts", owner, "own");
      const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
      await expect(h.invoke(facts[operation], { ...factStoreArgs, factId: "own", fact: text })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
      expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(before);
    }
  });

  it.each(["grant", "expiry", "resource", "source-deletion", "source-integrity"] as const)("fact receipt downgrade cannot conceal late %s invalidation", async invalidation => {
    for (const operation of ["update", "updateInPlace"] as const) {
      const h = harness(); const owner = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("facts", owner, "own");
      const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let injected = false;
      h.setAuthHook(async () => {
        if (injected || !h.db.attemptedWrites.some(write => write.startsWith("patch:facts/"))) return;
        injected = true;
        if (invalidation === "grant") await h.db.patch(owner.grantId, { revokedAt: Date.now() });
        if (invalidation === "expiry") await h.db.patch(owner.grantId, { expiresAt: Date.now() - 1 });
        if (invalidation === "resource") {
          const current = h.db.rows.get("facts")!.find(row => row.supersededBy === undefined)!;
          await h.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "fact", resourceId: current.factId, deletedAt: Date.now() });
        }
        if (invalidation.startsWith("source")) await h.db.patch(h.db.rows.get("runtimeMemorySources")![0]._id,
          invalidation === "source-deletion" ? { tombstonedAt: Date.now() } : { contentHash: "forged" });
      });
      await expect(h.invoke(facts[operation], { memorySpaceId: "space-a", factId: "own", confidence: 90 })).rejects.toMatchObject({ data: { code: invalidation.startsWith("source") ? "STALE_SOURCE" : "FORBIDDEN" } });
      expect(injected).toBe(true); expect(h.db.attemptedWrites.some(write => write.startsWith("patch:facts/"))).toBe(true); expect(h.db.rows).toEqual(before);
    }
  });

  it.each(["none", "read-revoked", "read-expired", "write-revoked", "write-expired"] as const)("distinct tenant READ and space WRITE grants fence private fact delivery: %s", async invalidation => {
    const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("facts", writer, "private");
    const reader = await h.provisionTenantRead(Date.now() + 1000000);
    expect(reader.grantId).not.toBe(writer.grantId); expect(reader.memorySpaceId).toBeUndefined();
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let boundary = false;
    await withFinalWriteHash(h, "facts", async () => {
      boundary = true;
      if (invalidation !== "none") await h.db.patch(invalidation.startsWith("read") ? reader.grantId : writer.grantId,
        invalidation.endsWith("revoked") ? { revokedAt: Date.now() } : { expiresAt: Date.now() - 1 });
    }, async () => {
      const response = h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "private", confidence: 90 });
      if (invalidation === "none") expect(await response).toMatchObject({ fact: "tenant-a private private", confidence: 90 });
      else { await expect(response).rejects.toMatchObject(forbidden); expect(h.db.rows).toEqual(before); }
    });
    expect(boundary).toBe(true);
  });

  it.each(["read", "write"] as const)("fact delivery checks the %s lifetime after final grants have been fetched and the canonical source reload has awaited", async capability => {
    const h = harness(); const writer = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("facts", writer, "private");
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
      await withFinalWriteHash(h, "facts", async () => { finalHash = true; }, async () => {
        await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "private", confidence: 90 })).rejects.toMatchObject(forbidden);
        expect(grantReads).toBe(3); expect(lifetimeBoundary).toBe(true); expect(h.db.rows).toEqual(before);
      });
    } finally { clock.mockRestore(); }
  });

  it.each([false, true])("editing an extracted fact (explicit sourceRef=%s) creates a dedicated assertion without changing the originating memory or siblings", async withRef => {
    for (const operation of ["update", "updateInPlace"] as const) {
      const h = harness(); const owner = await h.provisionScope();
      const memory = await h.invoke<Doc<"memories">>(memories.store, memoryStoreArgs);
      const derived: DerivedFact = { _id: "extraction-projection-input", factId: "extracted-fact", fact: "Extracted claim", factType: "preference", confidence: 80,
        memorySpaceId: owner.memorySpaceId!, ownerPrincipalId: owner.principalId, tenantId: owner.tenantId, lineage: memory.lineage!,
        extractionPolicyVersion: "extract-v1", sourceType: "conversation", tags: [], version: 1, createdAt: Date.now(), updatedAt: Date.now(),
        ...(withRef ? { sourceRef: { memoryId: memory.memoryId } } : {}) };
      const id = await h.db.insert("facts", { ...derived });
      const siblingId = await h.db.insert("facts", { ...derived, factId: "sibling-fact", fact: "Sibling claim" });
      const beforeMemory = structuredClone(memory); const beforeSource = structuredClone(h.db.rows.get("runtimeMemorySources")![0]);
      const beforeSibling = structuredClone(await h.db.get(siblingId));
      const edited = await h.invoke<Doc<"facts">>(facts[operation], { memorySpaceId: "space-a", factId: "extracted-fact", fact: "User corrected the claim",
        metadata: { manualSourceBinding: { resourceType: "memory", resourceId: memory.memoryId }, runtimeEditor: { principalId: "forged" } } });
      expect(edited).toMatchObject({ fact: "User corrected the claim", sourceType: "manual", extractionPolicyVersion: "manual-assertion-v1",
        lineage: { role: "user", trust: "user_assertion", sourceRevision: 1 }, manualSourceBinding: { resourceType: "fact", resourceId: edited.factId } });
      expect(edited.lineage?.sourceId).not.toBe(memory.lineage?.sourceId);
      expect(edited.runtimeEditor?.principalId).toBe(owner.principalId);
      expect(h.db.rows.get("runtimeMemorySources")![0]).toEqual(beforeSource);
      expect(await h.invoke(memories.get, { memorySpaceId: "space-a", memoryId: memory.memoryId })).toEqual(beforeMemory);
      expect(await h.db.get(siblingId)).toEqual(beforeSibling);
      expect(await h.invoke(facts.get, { memorySpaceId: "space-a", factId: "sibling-fact" })).toMatchObject({ fact: "Sibling claim", lineage: memory.lineage });
      if (operation === "updateInPlace") expect((await h.db.get(id))?.manualSourceBinding).toEqual(edited.manualSourceBinding);
      const revised = await h.invoke<Doc<"facts">>(facts.update, { memorySpaceId: "space-a", factId: edited.factId, fact: "Second correction" });
      expect(revised.manualSourceBinding).toEqual(edited.manualSourceBinding); expect(revised.lineage?.sourceRevision).toBe(2);
      expect(h.db.rows.get("runtimeMemorySources")![0]).toEqual(beforeSource);
    }
  });

  it("source bindings are server-only and mismatches or canonical source collisions cannot be repaired by edits", async () => {
    const h = harness(); const owner = await h.provisionScope(); const id = await h.seedData("facts", owner, "own");
    await h.db.patch(id, { manualSourceBinding: { resourceType: "fact", resourceId: "forged" } });
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
    await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "own", fact: "Edit" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(before);
    await h.db.patch(id, { manualSourceBinding: undefined, extractionPolicyVersion: "extract-v1" });
    const collided = structuredClone(h.db.rows); h.db.attemptedWrites = [];
    await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "own", fact: "Edit" })).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(collided);
  });

  it.each(["messages-only", "empty-source", "empty-conversation", "empty-memory", "empty-message", "foreign-message", "foreign-memory", "conflicting-anchors"] as const)("validates all %s source selectors before creating any fact/source", async variant => {
    const h = harness(); const owner = await h.provisionScope();
    for (const conversationId of ["conversation-a", "conversation-b"]) await h.db.insert("conversations", { tenantId: "tenant-a", memorySpaceId: "space-a",
      ownerPrincipalId: owner.principalId, conversationId, messages: [{ id: `${conversationId}-message`, content: "Owned" }] });
    const memory = await h.invoke<Doc<"memories">>(memories.store, { ...memoryStoreArgs, conversationRef: { conversationId: "conversation-b", messageIds: [] } });
    const sourceRef = variant === "messages-only" ? { messageIds: ["foreign-message"] } : variant === "empty-source" ? {}
      : variant === "empty-conversation" ? { conversationId: "" } : variant === "empty-memory" ? { memoryId: "" }
      : variant === "empty-message" ? { conversationId: "conversation-a", messageIds: [""] }
      : variant === "foreign-message" ? { conversationId: "conversation-a", messageIds: ["foreign-message"] }
      : variant === "foreign-memory" ? { conversationId: "conversation-a", memoryId: "foreign-memory" }
      : { conversationId: "conversation-a", memoryId: memory.memoryId };
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = [];
    await expect(h.invoke(facts.store, { ...factStoreArgs, sourceRef })).rejects.toMatchObject({ data: { code: variant.startsWith("empty") || variant === "messages-only" ? "INVALID_INPUT" : "FORBIDDEN" } });
    expect(h.db.attemptedWrites).toEqual([]); expect(h.db.rows).toEqual(before);
  });

  it("accepts matching conversation, message and memory selectors together and fences later malformed references", async () => {
    const h = harness(); const owner = await h.provisionScope();
    await h.db.insert("conversations", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: owner.principalId,
      conversationId: "conversation-a", messages: [{ id: "owned-message", content: "Owned" }] });
    const memory = await h.invoke<Doc<"memories">>(memories.store, { ...memoryStoreArgs, conversationRef: { conversationId: "conversation-a", messageIds: ["owned-message"] } });
    const sourceRef = { conversationId: "conversation-a", messageIds: ["owned-message"], memoryId: memory.memoryId };
    const fact = await h.invoke<Doc<"facts">>(facts.store, { ...factStoreArgs, sourceRef }); expect(fact.sourceRef).toEqual(sourceRef);
    await h.db.patch(fact._id, { sourceRef: { ...sourceRef, messageIds: ["foreign-message"] } }); h.db.attemptedWrites = [];
    await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: fact.factId, confidence: 90 })).rejects.toMatchObject(forbidden);
    expect(h.db.attemptedWrites).toEqual([]);
  });

  it.each(["tombstone", "revision", "content", "created-at"] as const)("fact private delivery reloads the entire canonical source after its final WRITE hash: %s", async change => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("facts", owner, "private"); const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; let injected = false;
    await withFinalWriteHash(h, "facts", async () => {
      injected = true; const source = h.db.rows.get("runtimeMemorySources")![0]; const lineage = source.lineage as Record<string, unknown>;
      await h.db.patch(source._id, change === "tombstone" ? { tombstonedAt: Date.now() }
        : change === "revision" ? { lineage: { ...lineage, sourceRevision: Number(lineage.sourceRevision) + 1 } }
        : change === "content" ? { content: "Changed valid source", contentHash: await semanticHash("Changed valid source") }
        : { createdAt: Number(source.createdAt) + 1 });
    }, async () => {
      await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "private", confidence: 90 })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
      expect(h.db.rows).toEqual(before);
    }); expect(injected).toBe(true);
  });

  it.each(["tombstone", "event", "content", "role-trust", "tool-operation"] as const)("historical fact delivery reloads CURRENT canonical source after hashing: %s", async change => {
    const h = harness(); await h.provisionScope(); const first = await h.invoke<Doc<"facts">>(facts.store, factStoreArgs);
    const updated = await h.invoke<Doc<"facts">>(facts.update, { memorySpaceId: "space-a", factId: first.factId, fact: "Updated fact" });
    const before = structuredClone(h.db.rows); const source = h.db.rows.get("runtimeMemorySources")![0]; const lineage = source.lineage as Record<string, unknown>;
    await withSourceHashBoundary(async () => { await h.db.patch(source._id, change === "tombstone" ? { tombstonedAt: Date.now() }
      : change === "event" ? { lineage: { ...lineage, sourceEventId: "different-event" } }
      : change === "content" ? { content: "Valid replacement", contentHash: await semanticHash("Valid replacement") }
      : change === "role-trust" ? { lineage: { ...lineage, role: "assistant", trust: "assistant_claim" } }
      : { lineage: { ...lineage, operationId: "forged-tool-operation" } }); }, async () => {
      await expect(h.invoke(facts.getHistory, { memorySpaceId: "space-a", factId: updated.factId })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } }); expect(h.db.rows).toEqual(before);
    });
  });

  it("current historical source witnesses preserve real audited stale revisions without adopting them for current reads", async () => {
    const h = harness(); await h.provisionScope(); const first = await h.invoke<Doc<"facts">>(facts.store, factStoreArgs);
    const updated = await h.invoke<Doc<"facts">>(facts.update, { memorySpaceId: "space-a", factId: first.factId, fact: "Updated fact" });
    expect(await h.invoke(facts.getHistory, { memorySpaceId: "space-a", factId: updated.factId })).toMatchObject([
      { factId: first.factId, historical: true, stale: true, currentSourceRevision: 2 }, { factId: updated.factId, historical: true, stale: false, currentSourceRevision: 2 },
    ]);
    await expect(h.invoke(facts.get, { memorySpaceId: "space-a", factId: first.factId })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
    expect(await h.invoke(facts.get, { memorySpaceId: "space-a", factId: updated.factId })).toMatchObject({ fact: "Updated fact" });
  });

  it.each(["list", "search", "internal-hydration"] as const)("%s retains earlier fact source witnesses through later candidate hashing", async operation => {
    const h = harness(); const owner = await h.provisionScope(); const first = await h.seedData("facts", owner, "first"); const second = await h.seedData("facts", owner, "second");
    const before = structuredClone(h.db.rows); const source = h.db.rows.get("runtimeMemorySources")![0];
    await withSourceHashBoundary(async () => { await h.db.patch(source._id, { tombstonedAt: Date.now() }); }, async () => {
      const response = operation === "internal-hydration" ? h.invoke(facts.fetchFactsByIds, { ids: [first, second], reference: owner })
        : h.invoke(facts[operation], { memorySpaceId: "space-a", query: "private" });
      await expect(response).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } }); expect(h.db.rows).toEqual(before);
    }, content => content.includes("private second"));
  });

  it.each(["tenant-resource", "source-row", "source-event"] as const)("write-only fact deletion keeps independent %s controls after creating its own scope tombstone", async change => {
    for (const operation of ["deleteFact", "deleteMany", "deleteByIds"] as const) {
      const h = harness(); const owner = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("facts", owner, "private"); const before = structuredClone(h.db.rows);
      const patch = h.db.patch.bind(h.db); let injected = false;
      h.db.patch = async (...args: Parameters<typeof patch>) => {
        await patch(...args); const id = typeof args[1] === "string" ? args[1] : args[0]; if (injected || !id.startsWith("facts/")) return; injected = true;
        const source = h.db.rows.get("runtimeMemorySources")![0]; const lineage = source.lineage as Record<string, unknown>;
        if (change === "tenant-resource") await h.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", resourceType: "fact", resourceId: "private", deletedAt: Date.now() });
        else await patch(source._id, change === "source-row" ? { tombstonedAt: Date.now() } : { lineage: { ...lineage, sourceEventId: "different-event" } });
      };
      await expect(h.invoke(facts[operation], { memorySpaceId: "space-a", factId: "private", factIds: ["private"] })).rejects.toMatchObject({ data: { code: change === "tenant-resource" ? "FORBIDDEN" : "STALE_SOURCE" } });
      expect(injected).toBe(true); expect(h.db.rows).toEqual(before);
    }
  });

  it("fact revision CAS retains the original complete source payload across the new content hash", async () => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("facts", owner, "private"); const before = structuredClone(h.db.rows); const source = h.db.rows.get("runtimeMemorySources")![0];
    const contentHash = await semanticHash("Independent replacement");
    await withSourceHashBoundary(async () => { await h.db.patch(source._id, { content: "Independent replacement", contentHash }); }, async () => {
      await expect(h.invoke(facts.updateInPlace, { memorySpaceId: "space-a", factId: "private", fact: "Edited assertion" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } }); expect(h.db.rows).toEqual(before);
    }, content => content === "Edited assertion");
  });

  it("preserves 18 modern public registrations and makes purge operator-internal", () => {
    expect(cases).toHaveLength(18);
    for (const [name] of cases) expect((facts[name] as unknown as { isPublic: boolean }).isPublic).toBe(true);
    for (const registration of [facts.purgeAll, facts.fetchFactsByIds]) expect(registration.isInternal).toBe(true);
  });
  it.each(["get", "getHistory"] as const)("%s checks READ expiry after its canonical source reload awaits", async operation => {
    const h = harness(); const owner = await h.provisionScope(); await h.seedData("facts", owner, "private");
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
        await expect(h.invoke(facts[operation], { memorySpaceId: "space-a", factId: "private" })).rejects.toMatchObject(forbidden);
        expect(injected).toBe(true); expect(h.db.rows).toEqual(before);
      });
    } finally { clock.mockRestore(); }
  });

  it.each(["update", "updateInPlace"] as const)("%s retains the original shared source witness while hashing an extracted fact's separate manual assertion", async operation => {
    const h = harness(); const owner = await h.provisionScope(); const memory = await h.invoke<Doc<"memories">>(memories.store, memoryStoreArgs);
    await h.db.insert("facts", { factId: "derived", fact: "Extracted claim", factType: "preference", confidence: 80,
      tenantId: owner.tenantId, memorySpaceId: owner.memorySpaceId, ownerPrincipalId: owner.principalId, lineage: memory.lineage,
      extractionPolicyVersion: "extract-v1", sourceType: "conversation", sourceRef: { memoryId: memory.memoryId }, tags: [], version: 1, createdAt: Date.now(), updatedAt: Date.now() });
    const before = structuredClone(h.db.rows); const source = h.db.rows.get("runtimeMemorySources")![0]; const contentHash = await semanticHash("Independent replacement");
    await withSourceHashBoundary(async () => { await h.db.patch(source._id, { content: "Independent replacement", contentHash }); }, async () => {
      await expect(h.invoke(facts[operation], { memorySpaceId: "space-a", factId: "derived", fact: "Separate assertion" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
      expect(h.db.rows).toEqual(before);
    }, content => content === "Separate assertion");
  });

  it.each(["supersede", "consolidate"] as const)("%s pins every peer source before effects while later peers are hashed", async operation => {
    const h = harness(); const owner = await h.provisionScope({ capabilities: ["write"] }); await h.seedData("facts", owner, "first"); await h.seedData("facts", owner, "second");
    const before = structuredClone(h.db.rows); h.db.attemptedWrites = []; const source = h.db.rows.get("runtimeMemorySources")![0]; const contentHash = await semanticHash("Independent replacement");
    await withSourceHashBoundary(async () => { await h.db.patch(source._id, { content: "Independent replacement", contentHash }); }, async () => {
      await expect(h.invoke(facts[operation], { memorySpaceId: "space-a", oldFactId: "first", newFactId: "second", factIds: ["first", "second"], keepFactId: "second" })).rejects.toMatchObject({ data: { code: "STALE_SOURCE" } });
      expect(h.db.rows).toEqual(before); expect(h.db.attemptedWrites.some(write => write.startsWith("patch:facts/"))).toBe(false);
    }, content => content.includes("private second"));
  });

  it.each(["list", "search", "internal-hydration"] as const)("%s retains earlier resource controls while later source candidates are hashed", async operation => {
    const h = harness(); const owner = await h.provisionScope(); const first = await h.seedData("facts", owner, "first"); const second = await h.seedData("facts", owner, "second"); const before = structuredClone(h.db.rows);
    await withSourceHashBoundary(async () => { await h.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", resourceType: "fact", resourceId: "first", deletedAt: Date.now() }); }, async () => {
      const response = operation === "internal-hydration" ? h.invoke(facts.fetchFactsByIds, { ids: [first, second], reference: owner })
        : h.invoke(facts[operation], { memorySpaceId: "space-a", query: "private" });
      await expect(response).rejects.toMatchObject(forbidden); expect(h.db.rows).toEqual(before);
    }, content => content.includes("private second"));
  });

});
