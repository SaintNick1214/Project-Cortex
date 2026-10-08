import { describe, expect, it, jest } from "@jest/globals";
import * as graph from "../../../convex-dev/graphSync";
import { fixture, invoke, queueArgs, seedFact } from "./fixture";
const workerPaths = ["queueForSync", "markSynced", "markFailed", "deleteSyncItem", "getUnsyncedItems", "getHighPriorityItems", "getSyncStats", "getFailedItems", "clearSyncedItems"];
const registration = (key: string) => (graph as unknown as Record<string, unknown>)[key];
async function prepared() {
  const f = fixture(); const source = await seedFact(f);
  const id = await invoke<string>(graph.queueForSync, f.anonymous, queueArgs(f));
  return { ...f, ...source, id };
}
function argsFor(key: string, f: Awaited<ReturnType<typeof prepared>>) {
  if (key === "queueForSync") return queueArgs(f);
  if (["markSynced", "markFailed", "deleteSyncItem"].includes(key)) return { authority: f.reference, id: f.id, error: "sanitized" };
  return { authority: f.reference, limit: 1, olderThanMs: 0 };
}
describe("nine scoped internal worker registrations", () => {
  it.each(workerPaths)("%s performs its actual authorized outcome without an active JWT", async (key) => {
    const f = await prepared(); const item = f.db.table("graphSyncQueue")[0]!;
    if (key === "getFailedItems") item.failedAttempts = 1;
    if (key === "clearSyncedItems") { item.createdAt = Date.now() - 2000; item.synced = true; item.syncedAt = Date.now() - 1000; }
    const result = await invoke(registration(key), f.anonymous, argsFor(key, f));
    if (key === "queueForSync") { expect(result).toBe(f.id); expect(f.db.table("graphSyncQueue")).toHaveLength(1); }
    else if (key === "markSynced") expect(item).toMatchObject({ synced: true });
    else if (key === "markFailed") expect(item).toMatchObject({ synced: false, failedAttempts: 1, lastError: "GRAPH_SYNC_FAILED" });
    else if (key === "deleteSyncItem" || key === "clearSyncedItems") expect(f.db.table("graphSyncQueue")).toHaveLength(0);
    else if (key === "getSyncStats") expect(result).toMatchObject({ total: 1, unsynced: 1, synced: 0, byTable: { facts: 1 } });
    else expect(result).toEqual([item]);
  });
  it.each(workerPaths)("%s rejects a revoked pinned grant before read/delivery/mark", async (key) => {
    const f = await prepared(); f.grant.revokedAt = Date.now();
    const before = f.db.writes;
    await expect(f.db.transaction(async () => await invoke(registration(key), f.anonymous, argsFor(key, f)))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(before); expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(false);
  });
  it.each(workerPaths)("%s rejects a wrong tenant authority before private candidates", async (key) => {
    const f = await prepared(); f.reference.tenantId = "tenant-b";
    const before = f.db.writes;
    await expect(invoke(registration(key), f.ctx, argsFor(key, f))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(before);
  });
  it("derives payload from canonical fresh fact, excludes caller metadata and selects tenant before first foreign ID", async () => {
    const f = fixture();
    const foreign = f.db.seed("facts", { tenantId: "tenant-b", memorySpaceId: "space-a", factId: "fact-a", ownerPrincipalId: "foreign", fact: "private foreign" });
    await seedFact(f, { metadata: { secret: "private key" } });
    const id = await invoke(graph.queueForSync, f.ctx, { ...queueArgs(f), entity: { fact: "forged" } });
    expect(f.db.table("graphSyncQueue")[0]).toMatchObject({ _id: id, tenantId: "tenant-a", ownerPrincipalId: f.principal._id, entity: { fact: "User prefers tea" } });
    expect((f.db.table("graphSyncQueue")[0]?.entity as Record<string, unknown>).metadata).toBeUndefined();
    expect(f.db.traces.filter((trace) => trace.table === "facts").every((trace) => !trace.returned.includes(foreign._id))).toBe(true);
  });
  it.each(["tool", "read"])("%s alone cannot admit sensitive graph payload", async (capability) => {
    const f = fixture([capability]); await seedFact(f);
    await expect(invoke(graph.queueForSync, f.ctx, queueArgs(f))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("graphSyncQueue")).toHaveLength(0);
  });
  it.each(["memories", "contexts", "conversations", "runtimeAuthGrants", "_storage"])("unsupported %s cannot masquerade as a canonical fresh entity", async (table) => {
    const f = fixture(); await seedFact(f);
    await expect(invoke(graph.queueForSync, f.ctx, { ...queueArgs(f), table })).rejects.toMatchObject({ data: { code: "UNSUPPORTED_OPERATION" } });
    expect(f.db.table("graphSyncQueue")).toHaveLength(0);
  });
  it.each(["sourceRevision", "sourceEventId", "sourceId"])("queue source CAS rejects a mismatched %s", async (field) => {
    const f = fixture(); await seedFact(f); const args = queueArgs(f);
    const source = { ...args.source, [field]: field === "sourceRevision" ? 2 : "forged" };
    await expect(invoke(graph.queueForSync, f.ctx, { ...args, source })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("graphSyncQueue")).toHaveLength(0);
  });
  it.each(["hash", "normalization", "lineage", "owner", "version", "expiry", "tombstone", "missing-owner"])("canonical %s failure cannot deliver or mark/recreate a queued source", async (mode) => {
    const f = await prepared();
    if (mode === "hash") f.source.contentHash = "forged";
    if (mode === "normalization") f.source.content = "  User prefers tea ";
    if (mode === "lineage") f.source.lineage = { ...(f.source.lineage as object), role: "tool", trust: "verified_tool_evidence", operationId: "forged" };
    if (mode === "owner") f.source.ownerPrincipalId = "foreign";
    if (mode === "version") f.fact.version = 2;
    if (mode === "expiry") f.fact.validUntil = Date.now() - 1;
    if (mode === "tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "source-a", deletedAt: Date.now() });
    if (mode === "missing-owner") f.fact.ownerPrincipalId = undefined;
    await expect(invoke(graph.getUnsyncedItems, f.ctx, { authority: f.reference, limit: 10 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(invoke(graph.markSynced, f.ctx, { authority: f.reference, id: f.id })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(invoke(graph.queueForSync, f.ctx, queueArgs(f))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("graphSyncQueue")).toHaveLength(1); expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(false);
  });
  it.each(["expired-grant", "deleted-principal", "deleted-membership", "deleted-space", "deleted-tenant", "deleted-source", "bad-source-time", "bad-fact-time", "fact-tombstone"])("%s fences later reads/marks/recreation", async (mode) => {
    const f = await prepared();
    if (mode === "expired-grant") f.grant.expiresAt = Date.now() - 1;
    if (mode === "deleted-principal") f.principal.deletedAt = Date.now();
    if (mode === "deleted-membership") f.membership.deletedAt = Date.now();
    if (mode === "deleted-space") f.db.table("runtimeAuthScopes").find((row) => row.memorySpaceId === "space-a")!.deletedAt = Date.now();
    if (mode === "deleted-tenant") f.db.table("runtimeAuthScopes").find((row) => row.memorySpaceId === undefined)!.deletedAt = Date.now();
    if (mode === "deleted-source") f.db.rows.set("runtimeMemorySources", []);
    if (mode === "bad-source-time") f.source.createdAt = NaN;
    if (mode === "bad-fact-time") f.fact.updatedAt = Infinity;
    if (mode === "fact-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "fact", resourceId: "fact-a", deletedAt: Date.now() });
    for (const [registration, args] of [[graph.getUnsyncedItems, { authority: f.reference, limit: 1 }], [graph.markSynced, { authority: f.reference, id: f.id }], [graph.queueForSync, queueArgs(f)]]) {
      await expect(invoke(registration, f.anonymous, args)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    }
    expect(f.db.table("graphSyncQueue")).toHaveLength(1); expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(false);
  });
  it("a deleted queue ID cannot be marked or recreated by state mutation", async () => {
    const f = await prepared();
    await invoke(graph.deleteSyncItem, f.ctx, { authority: f.reference, id: f.id });
    await expect(invoke(graph.markSynced, f.ctx, { authority: f.reference, id: f.id })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("graphSyncQueue")).toHaveLength(0);
  });
  it("foreign queue ID cannot be updated or deleted with this worker's reference", async () => {
    const f = await prepared(); const original = f.db.table("graphSyncQueue")[0]!;
    const foreign = f.db.seed("graphSyncQueue", { ...original, _id: "graphSyncQueue:foreign", tenantId: "tenant-b", authority: { ...f.reference, tenantId: "tenant-b" } });
    for (const key of ["markSynced", "markFailed", "deleteSyncItem"]) await expect(invoke(registration(key), f.ctx,
      { authority: f.reference, id: foreign._id, error: "fail" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(foreign.synced).toBe(false); expect(f.db.table("graphSyncQueue")).toHaveLength(2);
  });
  it("scope/priority/failed/cutoff selection happens before processing and limits", async () => {
    const f = await prepared(); const own = f.db.table("graphSyncQueue")[0]!;
    const foreign = f.db.seed("graphSyncQueue", { ...own, _id: "graphSyncQueue:foreign", tenantId: "tenant-b", priority: "high", failedAttempts: 9 });
    expect(await invoke(graph.getHighPriorityItems, f.ctx, { authority: f.reference, limit: 1 })).toEqual([own]);
    expect(await invoke(graph.getFailedItems, f.ctx, { authority: f.reference, limit: 1 })).toEqual([]);
    expect(await invoke(graph.getSyncStats, f.ctx, { authority: f.reference })).toMatchObject({ total: 1, failed: 0 });
    expect(await invoke(graph.clearSyncedItems, f.ctx, { authority: f.reference, olderThanMs: 0 })).toEqual({ deleted: 0 });
    expect(f.db.traces.filter((trace) => trace.table === "graphSyncQueue").every((trace) => !trace.returned.includes(foreign._id))).toBe(true);
  });
  it("wrong stored authority versions cannot read even under a current worker scope", async () => {
    const f = await prepared(); f.db.table("graphSyncQueue")[0]!.authority = { ...f.reference, grantVersion: 2 };
    await expect(invoke(graph.getUnsyncedItems, f.ctx, { authority: f.reference, limit: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
  it("final recheck denies revocation between source read and mark commit with rollback", async () => {
    const f = await prepared(); let reads = 0;
    f.db.beforeRead = (table) => { if (table === "runtimeMemorySources" && ++reads === 2) f.grant.revokedAt = Date.now(); };
    const before = f.db.writes;
    await expect(f.db.transaction(async () => await invoke(graph.markSynced, f.ctx, { authority: f.reference, id: f.id }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(false); expect(f.db.writes).toBe(before);
  });
  it("exhausted failures remain failed, and a synced item cannot be reopened", async () => {
    const f = await prepared();
    for (let n = 0; n < 4; n++) await invoke(graph.markFailed, f.ctx, { authority: f.reference, id: f.id, error: "contains private content" });
    expect(f.db.table("graphSyncQueue")[0]).toMatchObject({ synced: false, failedAttempts: 4, lastError: "GRAPH_SYNC_FAILED" });
    await invoke(graph.markSynced, f.ctx, { authority: f.reference, id: f.id });
    await expect(invoke(graph.markFailed, f.ctx, { authority: f.reference, id: f.id, error: "retry" })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(await invoke(graph.queueForSync, f.ctx, queueArgs(f))).toBe(f.id);
    expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(true);
  });
});

describe("open-review essential worker regressions", () => {
  it.each([NaN, -1, -Infinity, Infinity, 8.64e15 + 1])("invalid optional validity time %s denies admission and existing private delivery", async (value) => {
    for (const field of ["validFrom", "validUntil"]) {
      const fresh = fixture(); await seedFact(fresh, { [field]: value });
      await expect(invoke(graph.queueForSync, fresh.anonymous, queueArgs(fresh))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      expect(fresh.db.table("graphSyncQueue")).toHaveLength(0);
      const f = await prepared(); f.fact[field] = value;
      await expect(invoke(graph.getUnsyncedItems, f.anonymous, { authority: f.reference, limit: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      await expect(invoke(graph.markSynced, f.anonymous, { authority: f.reference, id: f.id })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(false);
    }
  });
  it.each([undefined, 0, 1000])("canonical validFrom=%s and optional active expiry still admit/mark", async (validFrom) => {
    const f = fixture(); await seedFact(f, { validFrom, validUntil: Date.now() + 60000 });
    const id = await invoke<string>(graph.queueForSync, f.anonymous, queueArgs(f));
    expect(await invoke(graph.getUnsyncedItems, f.anonymous, { authority: f.reference, limit: 1 })).toHaveLength(1);
    await invoke(graph.markSynced, f.anonymous, { authority: f.reference, id });
    expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(true);
  });
  it.each(["createdAt", "syncedAt"])("all queue %s lifecycle timestamps are canonical before delivery/count/commit", async (field) => {
    for (const value of [NaN, -1, Infinity, 8.64e15 + 1]) {
      const f = await prepared(); f.db.table("graphSyncQueue")[0]![field] = value;
      await expect(invoke(graph.getUnsyncedItems, f.anonymous, { authority: f.reference, limit: 1 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      await expect(invoke(graph.getSyncStats, f.anonymous, { authority: f.reference })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      await expect(invoke(graph.markSynced, f.anonymous, { authority: f.reference, id: f.id })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(false);
    }
  });
  it.each(["getUnsyncedItems", "getHighPriorityItems", "getFailedItems", "getSyncStats", "clearSyncedItems"])("%s filters actual own owner before limit/processing/count/cleanup", async (key) => {
    const f = await prepared(); const own = f.db.table("graphSyncQueue")[0]!;
    if (key === "getFailedItems") own.failedAttempts = 1;
    if (key === "clearSyncedItems") { own.createdAt = Date.now() - 2000; own.synced = true; own.syncedAt = Date.now() - 1000; }
    const foreign = f.db.seed("graphSyncQueue", { ...own, _id: "graphSyncQueue:foreign-owner", ownerPrincipalId: "foreign-owner" });
    const result = await invoke(registration(key), f.anonymous, { authority: f.reference, limit: 1, olderThanMs: 0 });
    if (key === "getSyncStats") expect(result).toMatchObject({ total: 1 });
    else if (key === "clearSyncedItems") { expect(result).toEqual({ deleted: 1 }); expect(f.db.table("graphSyncQueue")).toEqual([foreign]); }
    else expect(result).toEqual([own]);
    expect(f.db.traces.filter((trace) => trace.table === "graphSyncQueue").every((trace) => !trace.returned.includes(foreign._id))).toBe(true);
  });
  it.each(["markSynced", "markFailed", "deleteSyncItem"])("%s excludes a foreign actual owner before single-ID hydration", async (key) => {
    const f = await prepared(); const foreign = f.db.seed("graphSyncQueue", { ...f.db.table("graphSyncQueue")[0]!, _id: "graphSyncQueue:foreign-owner", ownerPrincipalId: "foreign-owner" });
    await expect(invoke(registration(key), f.anonymous, { authority: f.reference, id: foreign._id, error: "error" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.traces.filter((trace) => trace.table === "graphSyncQueue").every((trace) => !trace.returned.includes(foreign._id))).toBe(true);
    expect(foreign.synced).toBe(false);
  });
  it("idempotent admission filters foreign actual owner before its existing-job lookup", async () => {
    const f = fixture(); await seedFact(f);
    const foreign = f.db.seed("graphSyncQueue", { tenantId: "tenant-a", memorySpaceId: "space-a", authority: f.reference,
      ownerPrincipalId: "foreign-owner", table: "facts", entityId: "fact-a", synced: false });
    const id = await invoke<string>(graph.queueForSync, f.anonymous, queueArgs(f));
    expect(id).not.toBe(foreign._id); expect(f.db.table("graphSyncQueue")).toHaveLength(2);
    expect(f.db.traces.filter((trace) => trace.table === "graphSyncQueue").every((trace) => !trace.returned.includes(foreign._id))).toBe(true);
  });
  it.each(["space", "tenant"])("explicit %s access permits canonical other-owner jobs inside the selected scope", async (access) => {
    const f = fixture(["read", "tool"], access === "tenant");
    if (access === "tenant") { f.reference.memorySpaceId = "space-a"; f.reference.memorySpaceEpoch = 1; }
    else f.grant.resourceAccess = "space";
    const { source } = await seedFact(f, { ownerPrincipalId: "another-owner" }); source.ownerPrincipalId = "another-owner";
    const id = await invoke<string>(graph.queueForSync, f.anonymous, queueArgs(f));
    expect(await invoke(graph.getHighPriorityItems, f.anonymous, { authority: f.reference, limit: 1 })).toEqual([f.db.table("graphSyncQueue")[0]]);
    await invoke(graph.markSynced, f.anonymous, { authority: f.reference, id });
    expect(f.db.table("graphSyncQueue")[0]).toMatchObject({ ownerPrincipalId: "another-owner", synced: true });
  });
  it("late source lifecycle invalidation during the post-read checkpoint denies mark with rollback", async () => {
    const f = await prepared(); let reads = 0; let afterSource = 0;
    f.db.beforeRead = (table) => {
      if (table === "runtimeMemorySources") { reads++; afterSource = 0; }
      if (reads === 2 && table === "runtimeAuthGrants" && ++afterSource === 2) f.source.tombstonedAt = Date.now();
    };
    const before = f.db.writes;
    await expect(f.db.transaction(async () => await invoke(graph.markSynced, f.anonymous, { authority: f.reference, id: f.id }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(false); expect(f.db.writes).toBe(before);
  });
  it.each(["queueForSync", "markSynced", "getUnsyncedItems", "clearSyncedItems"])("%s rechecks source/fact/current READ independently after final digest", async (key) => {
    for (const mode of ["source-deleted", "source-tombstone", "source-control-tombstone", "source-content", "source-lineage", "source-time", "fact-deleted", "fact-control-tombstone", "fact-expired", "principal-deleted", "membership-deleted", "scope-deleted", "grant-deleted", "grant-revoked", "grant-expired", "read-removed"]) {
      const f = await prepared();
      if (key === "clearSyncedItems") {
        const item = f.db.table("graphSyncQueue")[0]!; item.createdAt = Date.now() - 2000; item.synced = true; item.syncedAt = Date.now() - 1000;
      }
      let digests = 0;
      // Mutate after the last source digest for the operation, before its final authority/row checks.
      const lastDigest = key === "queueForSync" || key === "markSynced" ? 2 : key === "clearSyncedItems" ? 3 : 1;
      const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
      const spy = jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
        const digest = await originalDigest(algorithm, data);
        if (++digests === lastDigest) {
          if (mode === "source-deleted") f.db.rows.set("runtimeMemorySources", []);
          if (mode === "source-tombstone") f.source.tombstonedAt = Date.now();
          if (mode === "source-control-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "source-a", deletedAt: Date.now() });
          if (mode === "source-content") f.source.content = "new canonical bytes";
          if (mode === "source-lineage") f.source.lineage = { ...(f.source.lineage as object), sourceRevision: 2 };
          if (mode === "source-time") f.source.createdAt = NaN;
          if (mode === "fact-control-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "fact", resourceId: "fact-a", deletedAt: Date.now() });
          if (mode === "principal-deleted") f.principal.deletedAt = Date.now();
          if (mode === "membership-deleted") f.membership.deletedAt = Date.now();
          if (mode === "scope-deleted") f.db.table("runtimeAuthScopes").find((row) => row.memorySpaceId === "space-a")!.deletedAt = Date.now();
          if (mode === "grant-deleted") f.db.rows.set("runtimeAuthGrants", []);
          if (mode === "fact-deleted") f.db.rows.set("facts", []);
          if (mode === "fact-expired") f.fact.validUntil = Date.now() - 1;
          if (mode === "grant-revoked") f.grant.revokedAt = Date.now();
          if (mode === "grant-expired") f.grant.expiresAt = Date.now() - 1;
          if (mode === "read-removed") f.grant.capabilities = ["tool"];
        }
        return digest;
      });
      const args = key === "queueForSync" ? { ...queueArgs(f), priority: "high" } : { authority: f.reference, id: f.id, limit: 1, olderThanMs: 0 };
      // Existing-job admission has two checks and remains idempotent; no new source is created.
      try {
        const before = f.db.writes;
        await expect(f.db.transaction(async () => await invoke(registration(key), f.anonymous, args))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
        expect(digests).toBe(lastDigest); expect(f.db.writes).toBe(before);
        expect(f.db.table("graphSyncQueue")).toHaveLength(1);
        expect(f.db.table("graphSyncQueue")[0]?.synced).toBe(key === "clearSyncedItems");
      } finally { spy.mockRestore(); }
    }
  });
});

describe("fresh queue commit after final digest", () => {
  it("late source/fact/READ invalidation cannot insert a new queue row, while current controls can", async () => {
    for (const mode of ["source-tombstone", "source-deleted", "fact-deleted", "read-removed", "grant-revoked"]) {
      const f = fixture(); const { source } = await seedFact(f);
      let digests = 0;
      const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
      const spy = jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
        const digest = await originalDigest(algorithm, data);
        if (++digests === 2) {
          if (mode === "source-tombstone") source.tombstonedAt = Date.now();
          if (mode === "source-deleted") f.db.rows.set("runtimeMemorySources", []);
          if (mode === "fact-deleted") f.db.rows.set("facts", []);
          if (mode === "read-removed") f.grant.capabilities = ["tool"];
          if (mode === "grant-revoked") f.grant.revokedAt = Date.now();
        }
        return digest;
      });
      try {
        await expect(f.db.transaction(async () => await invoke(graph.queueForSync, f.anonymous, queueArgs(f)))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
        expect(digests).toBe(2); expect(f.db.table("graphSyncQueue")).toHaveLength(0); expect(f.db.writes).toBe(0);
      } finally { spy.mockRestore(); }
    }
    const good = fixture(); await seedFact(good);
    const id = await invoke<string>(graph.queueForSync, good.anonymous, queueArgs(good));
    expect(good.db.table("graphSyncQueue")[0]).toMatchObject({ _id: id, synced: false, tenantId: "tenant-a" });
    expect(good.db.writes).toBe(1);
  });
});
