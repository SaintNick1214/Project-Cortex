import { beforeEach, afterEach, describe, expect, test, jest } from "@jest/globals";
import { ingestionFixture, installIngestionMockRoot, ingestion } from "../runtimeIngestion/fixture";
import type { GraphProjectionWorkV1, GraphProjectionReceiptV1 } from "../../../src/domain/graph-projection";
import type { DerivedFact } from "../../../src/domain/contracts";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { evaluateMemoryBarrier } from "../../../src/domain/memory-context";
const graph = await import("../../../convex-dev/runtimeGraph");
const auth = await import("../../../convex-dev/runtimeAuth");
const facts = await import("../../../convex-dev/facts");
const context = await import("../../../convex-dev/runtimeMemoryContext");
const shares = await import("../../../convex-dev/conversationShares");
const { runtimeGraphTables } = await import("../../../convex-dev/runtimeGraphSchema");
const { ConvexMemoryRepository } = await import("../../../convex-dev/runtimeMemoryRepository");
const { serverToolSourceLineage } = await import("../../../convex-dev/runtimeAgentTools");
const { prepareSourceContent } = await import("../../../src/domain/sources");
const user = { issuer: "https://host.test", subject: "user-a" };
const service = { issuer: "https://worker.test", subject: "graph-worker" };
async function setup(connectors = ["neo4j"]) {
  const f = await ingestionFixture();
  const worker = await f.call<{ principalId: string }>(auth.provision, { ...service, actorKind: "service", tenantId: "control", memorySpaceId: "workers",
    capabilities: ["admin", "read"], resourceAccess: "space" });
  for (const connectorId of connectors) await f.call(graph.configureConnector, { tenantId: "tenant-a", memorySpaceId: "space-a", connectorId,
    workerPrincipalId: worker.principalId, workerTenantId: "control", workerMemorySpaceId: "workers", enabled: true });
  const source = await f.source("User prefers cobalt", "source-x");
  const fact: DerivedFact = { _id: "", tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, ownerPrincipalId: source.ownerPrincipalId,
    factId: "fact-x", lineage: source.lineage, extractionPolicyVersion: "fixture-manual-v1", sourceType: "manual", fact: source.content,
    factType: "preference", confidence: 100, tags: [], entities: [{ name: "User", type: "person" }],
    relations: [{ subject: "User", predicate: "prefers", object: "cobalt" }], version: 1, createdAt: Date.now(), updatedAt: Date.now() };
  const input = { source: { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision },
    identity: { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision,
      stage: "facts" as const, semanticPolicyVersion: "fixture-manual-v1" }, facts: [fact], expectedFactVersions: { "fact-x": 0 } };
  const repository = new ConvexMemoryRepository(f.ctx, f.reference, "write", f.ctx.db);
  const commit = async () => f.transaction(async () => repository.commitDerived(input));
  const claim = async (connectorId = connectors[0], workerId = "process-1", leaseMs = 60_000) => {
    f.identity(service); return f.call<GraphProjectionWorkV1 | null>(graph.claim, { tenantId: "tenant-a", memorySpaceId: "space-a", connectorId, workerId, leaseMs });
  };
  return { ...f, changeSource: f.source, source, fact, input, commit, claim, repository, worker };
}
function lease(work: GraphProjectionWorkV1) {
  const { tenantId, memorySpaceId, connectorId, jobId, workerId, leaseVersion } = work;
  return { tenantId, memorySpaceId, connectorId, jobId, workerId, leaseVersion };
}
function receipt(work: GraphProjectionWorkV1): GraphProjectionReceiptV1 {
  return { version: 1, connectorId: work.connectorId, jobId: work.jobId, payloadHash: work.payloadHash,
    tenantId: work.tenantId, memorySpaceId: work.memorySpaceId, sourceId: work.payload.source.sourceId,
    tenantEpoch: work.payload.scope.tenantEpoch, memorySpaceEpoch: work.payload.scope.memorySpaceEpoch,
    revision: work.payload.revision, currentRevision: work.payload.revision, state: "applied" };
}
function enforceParentPaginationLimit(f: Awaited<ReturnType<typeof setup>>) {
  const query = f.db.query.bind(f.db);
  // A caller can already have consumed Convex's one paginate allowance. The
  // imported graph helpers must compose without consuming another allowance.
  jest.spyOn(f.db, "query").mockImplementation(table => {
    const selected = query(table);
    selected.paginate = async () => { throw new Error("Convex permits only one paginated query per function"); };
    return selected;
  });
}
describe("scoped durable graph projection", () => {
  beforeEach(() => { installIngestionMockRoot(); }); afterEach(() => { jest.restoreAllMocks(); });
  test("real derived commit enqueues exact active snapshot; replay is one intent and receipt", async () => {
    const f = await setup(); await f.commit(); await f.commit();
    expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1); expect(f.db.table("runtimeGraphOutbox")).toHaveLength(1);
    const work = (await f.claim())!; expect(work.payload.facts).toEqual([{ factId: "fact-x", revision: 1, text: f.source.content,
      entities: [{ name: "User", type: "person" }], relations: [{ subject: "User", predicate: "prefers", object: "cobalt" }] }]);
    expect(await f.call(graph.complete, { ...lease(work), receipt: receipt(work) })).toMatchObject({ duplicate: false });
    expect(await f.call(graph.complete, { ...lease(work), receipt: receipt(work) })).toMatchObject({ duplicate: true });
    expect(f.db.table("runtimeGraphReceipts")).toHaveLength(1); expect(f.db.table("runtimeGraphSources")[0].state).toBe("complete");
  });
  test("parent failure rolls back fact, processing receipt, graph intent and scheduling", async () => {
    const f = await setup(); const before = canonicalModelJson([...f.db.rows]);
    await expect(f.transaction(async () => { await f.repository.commitDerived(f.input); throw new Error("parent-abort"); })).rejects.toThrow("parent-abort");
    expect(canonicalModelJson([...f.db.rows])).toBe(before); expect(f.db.table("runtimeGraphOutbox")).toHaveLength(0);
  });
  test.each(["noJWT", "user-admin", "foreign-service"])("%s cannot claim configured worker jobs", async kind => {
    const f = await setup(); await f.commit();
    f.identity(kind === "noJWT" ? null : kind === "user-admin" ? user : { ...service, subject: "other" });
    const before = f.db.writes;
    await expect(f.call(graph.claim, { tenantId: "tenant-a", memorySpaceId: "space-a", connectorId: "neo4j", workerId: "spoof" })).rejects.toBeDefined();
    expect(f.db.writes).toBe(before);
  });
  test("cross-tenant selector cannot borrow the configured service grant", async () => {
    const f = await setup(); await f.commit(); f.identity(service);
    await expect(f.call(graph.claim, { tenantId: "tenant-b", memorySpaceId: "space-a", connectorId: "neo4j", workerId: "other" })).rejects.toBeDefined();
    expect(f.db.table("runtimeGraphOutbox")[0].state).toBe("pending");
  });
  test("each enabled connector must acknowledge; a live lease is not reclaimed", async () => {
    const f = await setup(["neo4j", "memgraph"]); await f.commit(); const a = (await f.claim("neo4j"))!;
    expect(await f.claim("neo4j", "process-2")).toBeNull();
    await f.call(graph.complete, { ...lease(a), receipt: receipt(a) }); expect(f.db.table("runtimeGraphSources")[0].state).toBe("pending");
    const b = (await f.claim("memgraph"))!; await f.call(graph.complete, { ...lease(b), receipt: receipt(b) });
    expect(f.db.table("runtimeGraphSources")[0].state).toBe("complete");
  });
  test("fresh pre-effect mutation denies time-only source grant expiry within a live worker lease", async () => {
    const f = await setup(); await f.commit(); f.grant.expiresAt = Date.now() + 10;
    const work = (await f.claim())!; expect(graph.current.isMutation).toBe(true);
    expect(await f.call(graph.current, lease(work))).toMatchObject({ jobId: work.jobId });
    jest.mocked(Date.now).mockReturnValue(Date.now() + 11); expect(work.leaseExpiresAt).toBeGreaterThan(Date.now());
    const writes = f.db.writes;
    await expect(f.call(graph.current, lease(work))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeGraphReceipts")).toHaveLength(0);
  });
  test.each(["pre-effect", "delivery"])("fresh expansion %s mutation retains time-only authority expiry checks", async kind => {
    const f = await setup(); await f.commit(); const work = (await f.claim())!;
    await f.call(graph.complete, { ...lease(work), receipt: receipt(work) }); f.identity(user);
    await f.call(graph.requestExpansion, { sourceId: "source-x", connectorId: "neo4j", requestId: "expiring-read" });
    f.identity(service); const read = await f.call<import("../../../src/domain/graph-projection").GraphExpansionWorkV1>(graph.claimExpansion,
      { tenantId: "tenant-a", memorySpaceId: "space-a", connectorId: "neo4j", workerId: "reader" });
    const held = { tenantId: read.tenantId, memorySpaceId: read.memorySpaceId, connectorId: read.connectorId, jobId: read.jobId, workerId: read.workerId, leaseVersion: read.leaseVersion };
    expect(graph.currentExpansion.isMutation).toBe(true); expect(graph.expansion.isMutation).toBe(true);
    await f.call(graph.currentExpansion, held);
    if (kind === "delivery") {
      await f.call(graph.completeExpansion, { ...held, result: { version: 1, scope: read.scope, sourceId: read.sourceId, profileId: read.profileId, revision: read.revision, factIds: ["fact-x"] } });
      f.identity(user); expect(await f.call(graph.expansion, { requestId: "expiring-read" })).toMatchObject({ facts: [{ factId: "fact-x" }] });
    }
    f.grant.expiresAt = Date.now() + 10; jest.mocked(Date.now).mockReturnValue(Date.now() + 11);
    const writes = f.db.writes;
    if (kind === "delivery") await expect(f.call(graph.expansion, { requestId: "expiring-read" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    else await expect(f.call(graph.currentExpansion, held)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(writes);
  });
  test("expired final worker lease becomes explicit failed freshness without any synced receipt", async () => {
    const f = await setup(); await f.commit();
    for (let attempt = 1; attempt <= 3; attempt++) { const work = (await f.claim("neo4j", `process-${attempt}`, 100))!;
      expect(work.leaseVersion).toBe(attempt); jest.mocked(Date.now).mockReturnValue(Date.now() + 101); }
    expect(await f.claim()).toBeNull(); expect(f.db.table("runtimeGraphSources")[0].state).toBe("dead_letter");
    expect(f.db.table("runtimeGraphRevisions")[0].state).toBe("failed"); expect(f.db.table("runtimeGraphReceipts")).toHaveLength(0);
  });
  test("known failures have bounded backoff and end dead-letter rather than synced", async () => {
    const f = await setup(); await f.commit();
    for (let i = 0; i < 3; i++) { const work = (await f.claim())!; await f.call(graph.fail, { ...lease(work), outcome: "failed" });
      expect(await f.claim()).toBeNull(); jest.mocked(Date.now).mockReturnValue(Date.now() + 1000); }
    expect(f.db.table("runtimeGraphOutbox")[0].state).toBe("dead_letter"); expect(f.db.table("runtimeGraphReceipts")).toHaveLength(0);
  });
  test.each(["revision", "tombstone", "fact-tombstone", "grant", "scope"])("%s fences old already-issued work and enqueues a later authoritative fence", async kind => {
    const f = await setup(); await f.commit(); const old = (await f.claim())!;
    if (kind === "revision") { await f.changeSource("User now prefers teal", "source-x", 2); await graph.enqueueSourceProjection(f.ctx, f.reference, "source-x"); }
    if (kind === "tombstone") await f.call(auth.tombstoneResource, { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "source-x" });
    if (kind === "fact-tombstone") await f.call(auth.tombstoneResource, { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "fact", resourceId: "fact-x" });
    if (kind === "grant") await f.call(auth.revokeGrant, { grantId: f.reference.grantId });
    if (kind === "scope") await f.call(auth.deleteScope, { tenantId: "tenant-a", memorySpaceId: "space-a" });
    await expect(f.call(graph.complete, { ...lease(old), receipt: receipt(old) })).rejects.toBeDefined();
    const next = (await f.claim())!; expect(next.payload.revision).toBeGreaterThan(old.payload.revision);
    expect(next.payload.operation).toBe(kind === "revision" ? "replace" : "tombstone");
    if (kind === "scope") expect(next.payload.scope.memorySpaceEpoch).toBe(2);
  });
  test("graph-only strict barrier includes upstream eligible source before any outbox exists", async () => {
    const f = await setup(); const event = await ingestion.enqueueSourceEvent(f.ctx, f.reference, f.source);
    const progress = await context.readStageProgress(f.ctx, f.reference, event.sequence, undefined, 0);
    expect(evaluateMemoryBarrier({ cutoff: event.sequence, requiredStages: ["graph"], progress, startedAt: Date.now(), now: Date.now(), deadlineMs: 1000, onFailure: "fail" }).state).toBe("waiting");
  });
  test("direct-fact graph debt blocks a zero-ingestion strict graph cutoff until acknowledgement", async () => {
    const f = await setup(); await f.commit();
    const pending = await context.readStageProgress(f.ctx, f.reference, 0, undefined, 1);
    expect(evaluateMemoryBarrier({ cutoff: 0, requiredStages: ["graph"], progress: pending, startedAt: Date.now(), now: Date.now(), deadlineMs: 1000, onFailure: "fail" }).state).toBe("waiting");
    const work = (await f.claim())!; await f.call(graph.complete, { ...lease(work), receipt: receipt(work) });
    const complete = await context.readStageProgress(f.ctx, f.reference, 0, undefined, 1);
    expect(evaluateMemoryBarrier({ cutoff: 0, requiredStages: ["graph"], progress: complete, startedAt: Date.now(), now: Date.now(), deadlineMs: 1000, onFailure: "fail" }).state).toBe("ready");
  });
  test("public manual store/edit/delete write the canonical fact and graph snapshot together", async () => {
    const f = await setup(); const stored = await f.call<{ factId: string }>(facts.store, { memorySpaceId: "space-a", fact: "Public manual cobalt", factType: "knowledge", confidence: 99, sourceType: "manual", tags: [] });
    expect(f.db.table("runtimeGraphSources")).toHaveLength(1); const first = (await f.claim())!; expect(first.payload.facts[0].text).toBe("Public manual cobalt");
    f.identity(user); await f.call(facts.updateInPlace, { memorySpaceId: "space-a", factId: stored.factId, fact: "Public manual teal" });
    expect(f.db.table("runtimeGraphSources")[0].revision).toBeGreaterThan(first.payload.revision);
    await f.call(facts.deleteFact, { memorySpaceId: "space-a", factId: stored.factId });
    // A fact tombstone keeps its canonical source; the new authoritative empty
    // snapshot removes the deleted fact while preserving the remote fence.
    const final = (await f.claim())!; expect(final.payload.facts).toEqual([]); expect(final.payload.revision).toBeGreaterThan(first.payload.revision);
  });
  test("retained source history does not count against the current active snapshot", async () => {
    const f = await setup();
    for (let revision = 2; revision <= 103; revision++) await f.db.insert("facts", { ...f.fact, factId: `old-${revision}`,
      lineage: { ...f.fact.lineage, sourceRevision: revision }, version: revision });
    await f.commit(); const work = (await f.claim())!;
    expect(f.db.table("facts")).toHaveLength(103);
    expect(work.payload.facts.map(fact => fact.factId)).toEqual(["fact-x"]);
  });
  test.each([false, true])("optional graph payload failure preserves canonical text (configured=%s)", async configured => {
    const f = configured ? await setup() : await ingestionFixture(); const text = "x".repeat(40_000);
    const stored = await f.call<{ factId: string }>(facts.store, { memorySpaceId: "space-a", fact: text,
      factType: "knowledge", confidence: 99, sourceType: "manual", tags: [] });
    expect(f.db.table("facts").find(row => row.factId === stored.factId)?.fact).toBe(text);
    const value = f.db.table("runtimeGraphSources")[0];
    expect(value).toMatchObject({ state: "dead_letter", failureCode: "GRAPH_PAYLOAD_TOO_LARGE", operation: "tombstone" });
    expect(JSON.parse(String(f.db.table("runtimeGraphPayloads")[0].payloadCanonical)).facts).toEqual([]);
    if (configured) {
      const fixture = f as Awaited<ReturnType<typeof setup>>; const work = (await fixture.claim())!;
      expect(work.payload.operation).toBe("tombstone"); await fixture.call(graph.complete, { ...lease(work), receipt: receipt(work) });
      expect(f.db.table("runtimeGraphSources")[0].state).toBe("dead_letter");
      expect((await context.readStageProgress(f.ctx, f.reference, 0, undefined, Number(value.revision))).graph?.hole?.state).toBe("failed");
    } else expect(f.db.table("runtimeGraphOutbox")).toHaveLength(0);
  });
  test("canonical fact cardinality is preserved with an explicit failed graph intent", async () => {
    const f = await setup(); const many = Array.from({ length: 101 }, (_, i) => ({ ...f.fact, factId: `fact-${i}` }));
    await f.transaction(async () => f.repository.commitDerived({ ...f.input, facts: many,
      expectedFactVersions: Object.fromEntries(many.map(fact => [fact.factId, 0])) }));
    expect(f.db.table("facts")).toHaveLength(101); expect(f.db.table("runtimeMemoryReceipts")).toHaveLength(1);
    expect(f.db.table("runtimeGraphSources")[0]).toMatchObject({ state: "dead_letter", failureCode: "GRAPH_SCOPE_TOO_BROAD" });
  });
  test("upstream deletion retires transitive production tool witness projections", async () => {
    const f = await setup();
    let parent = f.source;
    const dependentIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const operationId = `remember-${i}`;
      const scope = { ...f.reference, principalId: parent.ownerPrincipalId };
      const lineage = serverToolSourceLineage(scope, operationId);
      const { source } = await prepareSourceContent(scope, lineage, `Derived level ${i}`, { now: () => Date.now() });
      source.contextSourceWitnesses = [{ sourceId: parent.lineage.sourceId, sourceEventId: parent.lineage.sourceEventId,
        sourceRevision: parent.lineage.sourceRevision, contentHash: parent.contentHash, permissions: ["canViewFacts"] }];
      f.db.seed("runtimeMemorySources", { ...source });
      f.db.seed("runtimeAgentOperations", { tenantId: "tenant-a", memorySpaceId: "space-a", operationId, toolName: "memory_remember", state: "complete" });
      f.db.seed("facts", { ...f.fact, lineage, factId: `derived-${i}`, fact: source.content });
      await graph.enqueueSourceProjection(f.ctx, f.reference, lineage.sourceId); const work = (await f.claim())!;
      await f.call(graph.complete, { ...lease(work), receipt: receipt(work) }); dependentIds.push(lineage.sourceId); parent = source;
    }
    enforceParentPaginationLimit(f);
    await f.call(auth.tombstoneResource, { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "source-x" });
    for (const id of dependentIds) expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === id)).toMatchObject({ operation: "tombstone", state: "pending" });
    expect(f.db.table("runtimeGraphOutbox").filter(row => row.state === "pending")).toHaveLength(2);
  });
  test("rich caller scopes are projected before native schema writes and scheduled refresh", async () => {
    const f = await setup();
    const insert = f.db.insert.bind(f.db); const replace = f.db.replace.bind(f.db);
    function check(table: string, value: Record<string, unknown>) {
      if (!(table in runtimeGraphTables)) return;
      const fields = runtimeGraphTables[table as keyof typeof runtimeGraphTables].validator.fields;
      expect(Object.keys(value).filter(key => !(key in fields))).toEqual([]);
      if (table === "runtimeGraphPayloads") expect(Object.keys(JSON.parse(String(value.payloadCanonical)).scope).sort())
        .toEqual(["memorySpaceEpoch", "memorySpaceId", "tenantEpoch", "tenantId"]);
    }
    jest.spyOn(f.db, "insert").mockImplementation(async (table, value) => { check(table, value); return insert(table, value); });
    jest.spyOn(f.db, "replace").mockImplementation(async (table, id, value) => { check(table, value); return replace(table, id, value); });
    await f.commit();
    // The production source-tombstone parent passes scoped source arguments,
    // while grant retirement passes complete persisted graph rows.
    await f.call(auth.tombstoneResource, { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "source-x" });
    await f.call(graph.retireAuthority, { grantId: f.reference.grantId });
    const counter = f.db.table("runtimeGraphScopes")[0];
    for (let revision = Number(counter.sequence) + 1; revision <= 270; revision++) f.db.seed("runtimeGraphRevisions", {
      tenantId: "tenant-a", memorySpaceId: "space-a", revision, sourceId: "retained", profileId: DEFAULT_EMBEDDING_PROFILE.profileId, state: "skipped" });
    counter.sequence = 270;
    const work = (await f.claim())!; await f.call(graph.complete, { ...lease(work), receipt: receipt(work) });
    const continuation = f.scheduled.filter(item => item.name === "runtimeGraph:refreshScoped");
    expect(continuation.length).toBeGreaterThan(0);
    for (const task of continuation) expect(task.args).toEqual({ tenantId: "tenant-a", memorySpaceId: "space-a" });
  });
  test("bounded transitive cleanup fences queued old generations and leaves unrelated current sources intact", async () => {
    const f = await setup(); const dependencies: string[] = [];
    for (let i = 0; i < 40; i++) {
      const source = await f.changeSource(`Dependent ${i}`, `dependent-${i}`);
      const row = f.db.table("runtimeMemorySources").find(value => (value.lineage as typeof source.lineage).sourceId === source.lineage.sourceId)!;
      row.contextSourceWitnesses = [{ sourceId: f.source.lineage.sourceId, sourceEventId: f.source.lineage.sourceEventId,
        sourceRevision: f.source.lineage.sourceRevision, contentHash: f.source.contentHash, permissions: ["canViewFacts"] }];
      await graph.enqueueSourceProjection(f.ctx, f.reference, source.lineage.sourceId); dependencies.push(source.lineage.sourceId);
    }
    await f.changeSource("Unrelated retained source", "unrelated"); await graph.enqueueSourceProjection(f.ctx, f.reference, "unrelated");
    enforceParentPaginationLimit(f);
    await f.call(auth.tombstoneResource, { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "source", resourceId: "source-x" });
    const pending = f.scheduled.filter(item => item.name === "runtimeGraph:retireQueuedSource"); expect(pending.length).toBeGreaterThan(0);
    const repairedId = (pending[0].args as { sourceId: string }).sourceId;
    await f.changeSource("Repaired independent source", repairedId, 2); await graph.enqueueSourceProjection(f.ctx, f.reference, repairedId);
    const repairedRevision = f.db.table("runtimeGraphSources").find(row => row.sourceId === repairedId)!.revision;
    expect(await graph.readGraphProgress(f.ctx, f.reference, 0)).toMatchObject({ available: true, complete: false });
    let cursor = 0;
    while (cursor < f.scheduled.length) {
      const task = f.scheduled[cursor++];
      if (task.name === "runtimeGraph:retireQueuedSource") await f.call(graph.retireQueuedSource, task.args);
      if (task.name === "runtimeGraph:retireDependents") await f.call(graph.retireDependents, task.args);
      expect(cursor).toBeLessThan(500);
    }
    expect(f.db.table("runtimeGraphScopes")[0].pendingRetirements).toBe(0);
    for (const id of dependencies.filter(id => id !== repairedId)) expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === id)?.operation).toBe("tombstone");
    expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === repairedId)).toMatchObject({ operation: "replace", revision: repairedRevision });
    expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === "unrelated")?.operation).toBe("replace");
  });
  test("authority keysets visit repeated source IDs across scopes and preserve unrelated grants", async () => {
    const f = await setup(); await f.commit();
    const template = f.db.table("runtimeGraphSources")[0];
    const expected: { memorySpaceId: string; sourceId: string }[] = [];
    // Repeated source IDs cross a 64-row boundary; sourceId alone would skip
    // another space. Retained tombstones leave index identities intact.
    for (let space = 0; space < 3; space++) {
      const memorySpaceId = `space-${space}`;
      f.db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId, epoch: 1 });
      f.db.seed("runtimeGraphScopes", { tenantId: "tenant-a", memorySpaceId, sequence: 1, updatedAt: Date.now() });
      for (let i = 0; i < 35; i++) {
        const sourceId = `source-${String(i).padStart(3, "0")}`;
        f.db.seed("runtimeGraphSources", { ...template, _id: undefined, memorySpaceId, sourceId });
        expected.push({ memorySpaceId, sourceId });
      }
    }
    f.db.seed("runtimeGraphSources", { ...template, _id: undefined, sourceId: "unrelated-grant",
      authorityReference: { ...f.reference, grantId: "other-grant" } });
    enforceParentPaginationLimit(f);
    await f.call(graph.retireAuthority, { grantId: f.reference.grantId });
    let cursor = 0;
    while (cursor < f.scheduled.length) {
      const task = f.scheduled[cursor++];
      if (task.name === "runtimeGraph:retireQueuedSource") await f.call(graph.retireQueuedSource, task.args);
      if (task.name === "runtimeGraph:retireAuthority") await f.call(graph.retireAuthority, task.args);
      expect(cursor).toBeLessThan(200);
    }
    for (const value of expected) expect(f.db.table("runtimeGraphSources").find(row => row.memorySpaceId === value.memorySpaceId && row.sourceId === value.sourceId)?.operation).toBe("tombstone");
    expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === "unrelated-grant")?.operation).toBe("replace");
    for (const counter of f.db.table("runtimeGraphScopes")) expect(counter.pendingRetirements ?? 0).toBe(0);
  });
  test.each(["revoke", "expiry"])("selective share %s retires consumed graph evidence but preserves unrelated owner projections", async kind => {
    const f = await setup(); await f.commit(); const origin = await f.run("private-origin");
    const upstream = f.db.table("runtimeMemorySources").find(row => (row.transcriptOrigin as { conversationId?: string } | undefined)?.conversationId === origin.conversationId)!;
    const ownerLineage = upstream.lineage as typeof f.source.lineage;
    const reader = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "reader", metadataUserId: "reader", actorKind: "user", version: 1 });
    const membership = f.db.seed("runtimeAuthMemberships", { principalId: reader._id, tenantId: "tenant-a", version: 1 });
    const grant = f.db.seed("runtimeAuthGrants", { principalId: reader._id, membershipId: membership._id, tenantId: "tenant-a", memorySpaceId: "space-a",
      tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write"], resourceAccess: "space", version: 1 });
    const reference = { ...f.reference, principalId: reader._id, membershipId: membership._id, grantId: grant._id };
    const base = { conversationId: origin.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: reader._id };
    const view = { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: false };
    const expiresAt = Date.now() + 10;
    const data = await f.call<{ shareId: string }>(shares.create, { ...base, permissions: { ...view, canViewFacts: true },
      ...(kind === "expiry" ? { expiresAt } : {}) });
    await f.call(shares.create, { ...base, permissions: view });
    const lineage = { sourceId: "shared-derivative", sourceEventId: "shared-derivative", sourceRevision: 1, role: "user" as const, trust: "user_assertion" as const };
    const { source } = await prepareSourceContent(reference, lineage, "Derived shared fact", { now: () => Date.now() });
    source.contextSourceWitnesses = [{ sourceId: ownerLineage.sourceId, sourceEventId: ownerLineage.sourceEventId,
      sourceRevision: ownerLineage.sourceRevision, contentHash: String(upstream.contentHash), permissions: ["canViewFacts"] }];
    f.db.seed("runtimeMemorySources", { ...source });
    f.db.seed("facts", { ...f.fact, ownerPrincipalId: reader._id, lineage, factId: "shared-derived-fact", fact: source.content });
    await graph.enqueueSourceProjection(f.ctx, reference, lineage.sourceId, DEFAULT_EMBEDDING_PROFILE);
    enforceParentPaginationLimit(f);
    await f.call(graph.reconcileScoped, { tenantId: "tenant-a", memorySpaceId: "space-a" });
    expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === lineage.sourceId)?.operation).toBe("replace");
    if (kind === "revoke") await f.call(shares.revoke, { shareId: data.shareId });
    else { jest.mocked(Date.now).mockReturnValue(expiresAt + 1); await f.call(shares.expireGraphShare, { tenantId: "tenant-a", memorySpaceId: "space-a", shareId: data.shareId, expiresAt }); }
    expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === lineage.sourceId)).toMatchObject({ operation: "tombstone", state: "pending" });
    expect(f.db.table("runtimeGraphSources").find(row => row.sourceId === "source-x")?.operation).toBe("replace");
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  test("invalid trusted receipt cannot advance freshness", async () => {
    const f = await setup(); await f.commit(); const work = (await f.claim())!;
    await expect(f.call(graph.complete, { ...lease(work), receipt: { ...receipt(work), payloadHash: "f".repeat(64) } })).rejects.toMatchObject({ data: { code: "INVALID_GRAPH_RECEIPT" } });
    expect(f.db.table("runtimeGraphReceipts")).toHaveLength(0); expect(f.db.table("runtimeGraphSources")[0].state).toBe("pending");
  });
  test("large-profile belief/manual snapshots do not silently revert to small", async () => {
    installIngestionMockRoot({ large: true }); const f = await setup(); await f.commit(); const work = (await f.claim())!;
    expect(work.payload.profile).toEqual(LARGE_EMBEDDING_PROFILE); expect(work.payload.profile).not.toEqual(DEFAULT_EMBEDDING_PROFILE);
  });
  test("expansion is reachable through service leases and freshly hydrates canonical authorized facts", async () => {
    const f = await setup(); await f.commit(); const work = (await f.claim())!;
    await f.call(graph.complete, { ...lease(work), receipt: receipt(work) }); f.identity(user);
    await f.call(graph.requestExpansion, { sourceId: "source-x", connectorId: "neo4j", requestId: "expand-1", limit: 3 });
    f.identity(service); const read = await f.call<import("../../../src/domain/graph-projection").GraphExpansionWorkV1>(graph.claimExpansion,
      { tenantId: "tenant-a", memorySpaceId: "space-a", connectorId: "neo4j", workerId: "reader" });
    const readLease = { tenantId: read.tenantId, memorySpaceId: read.memorySpaceId, connectorId: read.connectorId, jobId: read.jobId, workerId: read.workerId, leaseVersion: read.leaseVersion };
    await f.call(graph.currentExpansion, readLease);
    await f.call(graph.completeExpansion, { ...readLease, result: { version: 1, scope: read.scope, sourceId: read.sourceId, profileId: read.profileId, revision: read.revision, factIds: ["fact-x", "nonexistent-foreign-id"] } });
    f.identity(user); expect(await f.call(graph.expansion, { requestId: "expand-1" })).toMatchObject({ state: "complete", facts: [{ factId: "fact-x", revision: 1, text: f.source.content }] });
    f.grant.revokedAt = Date.now(); await expect(f.call(graph.expansion, { requestId: "expand-1" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
  test("no connector graph-only barrier remains explicitly unavailable", async () => {
    const f = await ingestionFixture(); const progress = await context.readStageProgress(f.ctx, f.reference, 0);
    expect(evaluateMemoryBarrier({ cutoff: 0, requiredStages: ["graph"], progress, startedAt: Date.now(), now: Date.now(), deadlineMs: 1000, onFailure: "fail" })).toMatchObject({ state: "failed", failureCode: "CAPABILITY_UNAVAILABLE" });
  });
});
