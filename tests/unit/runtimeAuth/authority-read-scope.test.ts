/** Actual native guard/ledger handlers on controlled ports; live OCC/latency remains a separate gate. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { createAuthorityReadScope, createAuthorityReader, recheckAuthority, resolveAuthorityReference, AUTHORITY_READ_SCOPE_MAX_ENTRIES } from "../../../convex-dev/runtimeAuth";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import type { GatewayResolution } from "../../../convex-dev/runtimeGateway";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; } async start() { return "workflow:authority-scope"; }
} }));
const { transcriptFixture, installMockRoot, ledger, runs, invoke, clone, clock } = await import("../runtimeTranscript/fixture");
// Preserve real factory/guards while comparing the unchanged parent body with
// its original context; production activation is separately asserted below.
const actualAuth = await import("../../../convex-dev/runtimeAuth");
let parentScope = true;
jest.unstable_mockModule("../../../convex-dev/runtimeAuth", () => ({ ...actualAuth,
  createAuthorityReadScope: <Ctx extends Parameters<typeof createAuthorityReadScope>[0]>(ctx: Ctx) => parentScope ? createAuthorityReadScope(ctx) : ctx,
}));
const runtime = await import("../../../convex-dev/runtimeAgent");
beforeEach(() => { installMockRoot(); parentScope = true; }); afterEach(() => { jest.restoreAllMocks(); });
const requirement = { capability: "read" as const, tenantId: "tenant-a", memorySpaceId: "space-a" };
const forbidden = { data: { code: "FORBIDDEN" } };
const grantId = (f: Awaited<ReturnType<typeof transcriptFixture>>) => f.reference.grantId as Id<"runtimeAuthGrants">;
async function error(call: () => Promise<unknown>) {
  try { await call(); throw Error("Expected denial"); } catch (value) {
    if (!(value instanceof Error) || value.message === "Expected denial") throw value;
    return { name: value.name, message: value.message, data: "data" in value ? value.data : undefined };
  }
}
describe("explicit native raw-authority read scope", () => {
  it("only branded factory contexts share raw reads, retaining the original uncached default", async () => {
    const f = await transcriptFixture(), get = jest.spyOn(f.db, "get");
    const scoped = createAuthorityReadScope(f.ctx);
    expect(scoped).not.toBe(f.ctx); expect(Object.getOwnPropertySymbols(f.ctx)).toHaveLength(0);
    expect(createAuthorityReader(scoped)).toBe(createAuthorityReader(scoped));
    const reader = createAuthorityReader(scoped);
    await reader.getGrant(f.reference.grantId); await reader.getGrant(f.reference.grantId); expect(get).toHaveBeenCalledTimes(1);
    await createAuthorityReader(f.ctx).getGrant(f.reference.grantId); await createAuthorityReader(f.ctx).getGrant(f.reference.grantId);
    expect(get).toHaveBeenCalledTimes(3);
    f.grant.revokedAt = clock;
    await expect(recheckAuthority(createAuthorityReadScope(f.ctx), f.reference, requirement)).rejects.toMatchObject(forbidden);
  });
  it("preserves DB field getter receiver and component query receiver without caching component queries", async () => {
    const f = await transcriptFixture();
    Object.defineProperty(f.db,"receiverProbe",{get(){return this===f.db?"native":"changed";}});
    let calls=0;
    const ctx={...f.ctx,marker:"native-query",runQuery:function(this:{marker:string}){expect(this.marker).toBe("native-query");return ++calls;}};
    const scoped=createAuthorityReadScope(ctx);
    expect((scoped.db as unknown as {receiverProbe:string}).receiverProbe).toBe("native");
    expect(scoped.runQuery()).toBe(1);expect(scoped.runQuery()).toBe(2);
  });
  it("returns detached raw rows/lists, preserving optional undefined, BigInt and binary values", async () => {
    const f = await transcriptFixture(); f.principal.optional = undefined; f.principal.futureBigInt = 3n; f.principal.futureBytes = new Uint8Array([1,2]).buffer;
    // TranscriptDb's JSON-like clone does not model native ArrayBuffer values.
    const get = f.db.get.bind(f.db);
    jest.spyOn(f.db, "get").mockImplementation(async (table, id) => table === "runtimeAuthPrincipals" && id === f.reference.principalId ? f.principal : await get(table,id));
    const reader = createAuthorityReader(createAuthorityReadScope(f.ctx));
    const first = await reader.getPrincipal(f.reference.principalId), second = await reader.getPrincipal(f.reference.principalId);
    expect(first).toEqual(second); expect(first).not.toBe(second);
    expect(Object.hasOwn(second!, "optional")).toBe(true); expect((second as unknown as typeof f.principal).futureBigInt).toBe(3n);
    new Uint8Array((first as unknown as typeof f.principal).futureBytes as ArrayBuffer)[0] = 9;
    expect(new Uint8Array((second as unknown as typeof f.principal).futureBytes as ArrayBuffer)[0]).toBe(1);
    const grants = await reader.listGrants(f.reference.membershipId); grants[0].capabilities.length = 0; grants.length = 0;
    expect((await reader.listGrants(f.reference.membershipId))[0].capabilities).toContain("read"); expect(f.grant.capabilities).toContain("read");
  });
  it("reexecutes capability, ownership, requirement validation and expiry on a cached raw grant", async () => {
    const f = await transcriptFixture(); f.grant.expiresAt = clock + 10;
    const scoped = createAuthorityReadScope(f.ctx), reader = createAuthorityReader(scoped);
    expect(await recheckAuthority(scoped, f.reference, requirement)).toMatchObject({ grantId: f.reference.grantId });
    await expect(recheckAuthority(scoped, f.reference, { ...requirement, capability: "storage:write" })).rejects.toMatchObject(forbidden);
    await expect(recheckAuthority(scoped, f.reference, { ...requirement, resource: { resourceType: "source", resourceId: "private", tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: "foreign" } })).rejects.toMatchObject(forbidden);
    await expect(recheckAuthority(scoped, f.reference, { ...requirement, tenantId: "" })).rejects.toMatchObject(forbidden);
    await expect(resolveAuthorityReference(reader, f.reference, requirement, clock + 10)).rejects.toMatchObject(forbidden);
  });
  it.each(["principal-revoked", "principal-deleted", "membership-revoked", "grant-version", "grant-deleted", "duplicate-grant", "tenant-deleted", "space-epoch", "tenant-tombstone", "space-tombstone", "missing-principal"])("a fresh invocation observes %s and preserves exact original error precedence", async fault => {
    const f = await transcriptFixture(); await recheckAuthority(createAuthorityReadScope(f.ctx), f.reference, requirement);
    if (fault === "principal-revoked") f.principal.revokedAt = clock;
    if (fault === "principal-deleted") f.principal.deletedAt = clock;
    if (fault === "membership-revoked") f.membership.revokedAt = clock;
    if (fault === "grant-version") f.grant.version = 2;
    if (fault === "grant-deleted") f.grant.deletedAt = clock;
    if (fault === "duplicate-grant") f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:duplicate", version: 2, capabilities: ["write"] });
    if (fault === "tenant-deleted") f.db.table("runtimeAuthScopes").find(row => !row.memorySpaceId)!.deletedAt = clock;
    if (fault === "space-epoch") f.db.table("runtimeAuthScopes").find(row => row.memorySpaceId)!.epoch = 2;
    if (fault === "tenant-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", resourceType: "tenant", resourceId: "tenant-a", deletedAt: clock });
    if (fault === "space-tombstone") f.db.seed("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memorySpace", resourceId: "space-a", deletedAt: clock });
    if (fault === "missing-principal") await f.db.delete("runtimeAuthPrincipals", f.reference.principalId);
    expect(await error(() => recheckAuthority(createAuthorityReadScope(f.ctx), f.reference, requirement)))
      .toEqual(await error(() => recheckAuthority(f.ctx, f.reference, requirement)));
  });
  it("same-snapshot authority patches and negative tombstone/query results invalidate before later guards", async () => {
    const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx), reader = createAuthorityReader(scoped);
    await recheckAuthority(scoped, f.reference, requirement);
    await scoped.db.patch("runtimeAuthGrants", grantId(f), { capabilities: ["read"] });
    await expect(recheckAuthority(scoped, f.reference, { ...requirement, capability: "write" })).rejects.toMatchObject(forbidden);
    expect(await reader.hasTombstone({ tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memorySpace", resourceId: "space-a" })).toBe(false);
    await scoped.db.insert("runtimeAuthTombstones", { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memorySpace", resourceId: "space-a", deletedAt: clock });
    expect(await reader.hasTombstone({ tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memorySpace", resourceId: "space-a" })).toBe(true);
    await expect(recheckAuthority(scoped, f.reference, requirement)).rejects.toMatchObject(forbidden);
  });
  it("null lookups and undefined/empty scope keys stay distinct and inserts cannot retain a negative result", async () => {
    const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx), reader = createAuthorityReader(scoped);
    expect(await reader.getScope("new-tenant")).toBeNull(); expect(await reader.getScope("new-tenant", "")).toBeNull();
    await scoped.db.insert("runtimeAuthScopes", { tenantId: "new-tenant", epoch: 1, createdAt: clock });
    expect(await reader.getScope("new-tenant")).toMatchObject({ epoch: 1 }); expect(await reader.getScope("new-tenant", "")).toBeNull();
    expect(await reader.getPrincipal("runtimeAuthPrincipals:missing")).toBeNull();
    expect(await createAuthorityReader(createAuthorityReadScope(f.ctx)).getPrincipal("runtimeAuthPrincipals:missing")).toBeNull();
  });
  it("same-invocation generation replacement and duplicate-grant insertion rerun the original generation predicate", async () => {
    const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx);
    await recheckAuthority(scoped,f.reference,requirement);
    await scoped.db.patch("runtimeAuthGrants",grantId(f),{revokedAt:clock});
    const replacement = await scoped.db.insert("runtimeAuthGrants",{principalId:f.reference.principalId as Id<"runtimeAuthPrincipals">,
      membershipId:f.reference.membershipId as Id<"runtimeAuthMemberships">,tenantId:"tenant-a",memorySpaceId:"space-a",tenantEpoch:1,memorySpaceEpoch:1,
      capabilities:["read"],resourceAccess:"own",version:2,createdAt:clock});
    await expect(recheckAuthority(scoped,f.reference,requirement)).rejects.toMatchObject(forbidden);
    const reference = {...f.reference,grantId:replacement,grantVersion:2};
    expect(await recheckAuthority(scoped,reference,requirement)).toMatchObject({grantId:replacement,grantVersion:2});
    await scoped.db.insert("runtimeAuthGrants",{principalId:f.reference.principalId as Id<"runtimeAuthPrincipals">,
      membershipId:f.reference.membershipId as Id<"runtimeAuthMemberships">,tenantId:"tenant-a",memorySpaceId:"space-a",tenantEpoch:1,memorySpaceEpoch:1,
      capabilities:["write"],resourceAccess:"space",version:3,createdAt:clock});
    expect(await error(()=>recheckAuthority(scoped,reference,requirement))).toEqual(await error(()=>recheckAuthority(f.ctx,reference,requirement)));
  });
  it("ambiguous query failures are not cached and deleting a duplicate restores the original raw lookup", async () => {
    const f = await transcriptFixture(), scoped = createAuthorityReadScope(f.ctx), reader=createAuthorityReader(scoped);
    await reader.getScope("tenant-a","space-a");
    const duplicate=await scoped.db.insert("runtimeAuthScopes",{tenantId:"tenant-a",memorySpaceId:"space-a",epoch:1,createdAt:clock});
    const query=jest.spyOn(f.db,"query");
    await expect(reader.getScope("tenant-a","space-a")).rejects.toMatchObject({data:{code:"AUTHORITY_LOOKUP_AMBIGUOUS"}});
    await expect(reader.getScope("tenant-a","space-a")).rejects.toMatchObject({data:{code:"AUTHORITY_LOOKUP_AMBIGUOUS"}});expect(query).toHaveBeenCalledTimes(2);
    await scoped.db.delete("runtimeAuthScopes",duplicate);expect(await reader.getScope("tenant-a","space-a")).toMatchObject({epoch:1});
  });
  it.each(["insert", "patch", "replace", "delete"] as const)("%s invalidates unrelated raw authority entries and preserves DB method receiver", async method => {
    const f = await transcriptFixture(), get = jest.spyOn(f.db, "get"), scoped = createAuthorityReadScope(f.ctx), reader = createAuthorityReader(scoped);
    const id = f.principal._id as Id<"runtimeAuthPrincipals">;
    await reader.getGrant(f.reference.grantId); const before = get.mock.calls.length;
    if (method === "insert") await scoped.db.insert("runtimeAuthPrincipals", { issuer: "other", subject: "other", actorKind: "user", version: 1, createdAt: clock });
    if (method === "patch") await scoped.db.patch("runtimeAuthPrincipals", id, { metadataUserId: "changed" });
    if (method === "replace") await scoped.db.replace("runtimeAuthPrincipals", id, { issuer: "changed", subject: "changed", actorKind: "user", version: 1, createdAt: clock });
    if (method === "delete") await scoped.db.delete("runtimeAuthPrincipals", id);
    await reader.getGrant(f.reference.grantId); expect(get.mock.calls.length).toBeGreaterThan(before);
  });
  it("failed raw reads are never cached, retaining original exception identity", async () => {
    const f = await transcriptFixture(), failure = new Error("CONTROLLED_LOOKUP_FAILURE"), get = f.db.get.bind(f.db);
    const spy = jest.spyOn(f.db, "get").mockRejectedValueOnce(failure).mockImplementation(get), reader = createAuthorityReader(createAuthorityReadScope(f.ctx));
    await expect(reader.getGrant(f.reference.grantId)).rejects.toBe(failure);
    expect(await reader.getGrant(f.reference.grantId)).toMatchObject({ _id: f.reference.grantId }); expect(spy).toHaveBeenCalledTimes(2);
  });
  it("failed writer invalidation and in-flight writes prevent a stale hit or late read from repopulating a later epoch", async () => {
    const f = await transcriptFixture(); let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    const failure = new Error("CONTROLLED_WRITER_FAILURE");
    jest.spyOn(f.db, "patch").mockImplementation(async () => { entered(); await gate; f.grant.revokedAt = clock; throw failure; });
    const scoped = createAuthorityReadScope(f.ctx), reader = createAuthorityReader(scoped); await reader.getGrant(f.reference.grantId);
    const writing = scoped.db.patch("runtimeAuthGrants", grantId(f), {}); void writing.catch(() => {}); await started;
    expect((await reader.getGrant(f.reference.grantId))!.revokedAt).toBeUndefined(); release(); await expect(writing).rejects.toBe(failure);
    await expect(recheckAuthority(scoped, f.reference, requirement)).rejects.toMatchObject(forbidden);
  });
  it("late pre-write reads cannot populate the cache after a concurrent writer completes", async () => {
    const f = await transcriptFixture(), get = f.db.get.bind(f.db); let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    let first = true;
    jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { const value = await get(table, id); if (first && table === "runtimeAuthGrants") { first = false; entered(); await gate; } return value; });
    const scoped = createAuthorityReadScope(f.ctx), reader = createAuthorityReader(scoped), reading = reader.getGrant(f.reference.grantId); await started;
    await scoped.db.patch("runtimeAuthGrants", grantId(f), { revokedAt: clock }); release(); await reading;
    await expect(recheckAuthority(scoped, f.reference, requirement)).rejects.toMatchObject(forbidden);
  });
  it.each([false, true])("component mutation invalidates before/after even on failure=%s and preserves its native receiver", async failing => {
    const f = await transcriptFixture(), failure = new Error("COMPONENT_FAILURE");
    const ctx = { ...f.ctx, marker: "receiver", runMutation: async function(this: { marker: string }) { expect(this.marker).toBe("receiver"); f.grant.revokedAt = clock; if (failing) throw failure; return null; } };
    const scoped = createAuthorityReadScope(ctx); await recheckAuthority(scoped, f.reference, requirement);
    const calling = scoped.runMutation(); if (failing) await expect(calling).rejects.toBe(failure); else await calling;
    await expect(recheckAuthority(scoped, f.reference, requirement)).rejects.toMatchObject(forbidden);
  });
  it("entry limit falls through to uncached raw reads without adding an authorization failure", async () => {
    const f = await transcriptFixture(), query = jest.spyOn(f.db, "query"), reader = createAuthorityReader(createAuthorityReadScope(f.ctx));
    for (let index = 0; index < AUTHORITY_READ_SCOPE_MAX_ENTRIES; index++) expect(await reader.getScope(`bounded-${index}`)).toBeNull();
    const before = query.mock.calls.length;
    await reader.getScope("overflow"); await reader.getScope("overflow"); expect(query.mock.calls.length - before).toBe(2);
    await reader.getScope("bounded-0"); expect(query.mock.calls.length - before).toBe(2);
  });
});

describe("actual Agent admission/checkpoint with scoped raw reads", () => {
  it.each([0,4])("preserves the exact permit/ledger/account state with %i witnesses and proves real read reduction", async sourceCount => {
    const f = await transcriptFixture({ maxContextTokens: 16384 }), mutation = f.ctx.runMutation.bind(f.ctx);
    f.ctx.runMutation = (async (reference, args) => {
      let name = ""; try { name = getFunctionName(reference); } catch { /* Component. */ }
      const reg = name === "runs:claimNext" ? runs.claimNext : name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : undefined;
      return reg ? await invoke(reg, f.ctx, args) : await mutation(reference, args);
    }) as typeof f.ctx.runMutation;
    const run = await f.run(); await f.call(runtime.start, { runId: run.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], attempt = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    const witnesses = [];
    for (let index = 0; index < sourceCount; index++) {
      const content = `authorized witness ${index}`, contentHash = await f.hash(content), sourceId = `scoped-source-${index}`, sourceEventId = `scoped-event-${index}`;
      f.db.seed("runtimeMemorySources", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId,
        lineage: { sourceId, sourceEventId, sourceRevision: 1, role: "user", trust: "user_assertion" }, content, contentHash, createdAt: clock });
      witnesses.push({ sourceId, sourceEventId, sourceRevision: 1, contentHash });
    }
    await f.call(runtime.saveContext, { ...attempt, context: "authorized evidence", witnesses, completeness: "complete" });
    const prepared = await f.call<{ op: { semanticId: string; operationId: string }; current: { run: { runBudgetId: string } } }>(runtime.prepareModelOperation, { ...attempt, ordinal: 0 });
    const resolution = await f.call<GatewayResolution>(ledger.resolve, { reference: f.reference, operationKey: "agent.respond", runBudgetId: prepared.current.run.runBudgetId }), pins = resolution.snapshot.pins;
    const request: ModelCallRequest = { semanticId: prepared.op.semanticId, childCallId: "normalized-child", texts: ["Hello world!"], messages: [{ role: "user", parts: [{ type: "text", text: "Hello world!" }] }],
      inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1000, reservationUnits: resolution.snapshot.costBound.maximumCostUnits,
      promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion, extractionVersion: pins.extractionVersion, toolRegistryVersion: pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
    request.inputTokens = ledger.deriveQualifiedInputBound(resolution.dispatchEvidence, request);
    const args = { ...attempt, operationId: prepared.op.operationId, ordinal: 0, requestCanonical: canonicalModelJson(request), snapshotCanonical: canonicalModelJson(resolution.snapshot) };
    let reads = 0; const get = f.db.get.bind(f.db), query = f.db.query.bind(f.db);
    jest.spyOn(f.db, "get").mockImplementation(async (table, id) => { if (table.startsWith("runtimeAuth")) reads++; return await get(table,id); });
    jest.spyOn(f.db, "query").mockImplementation(table => { if (table.startsWith("runtimeAuth")) reads++; return query(table); });
    const state = () => clone({ rows: f.db.rows, writes: f.db.writes, sequence: f.db.sequence, native: f.native, effects: f.effects, scheduled: f.scheduled });
    parentScope = false;
    const before = state(), original = await f.call(runtime.admitModelOperation, args), originalState = state(), originalReads = reads;
    f.db.rows = clone(before.rows); f.db.writes = before.writes; f.db.sequence = before.sequence; Object.assign(f.native, clone(before.native)); Object.assign(f.effects, before.effects); f.scheduled.splice(0,f.scheduled.length,...before.scheduled); reads = 0;
    const scoped = createAuthorityReadScope(f.ctx), result = await f.transaction(async () => await invoke(runtime.admitModelOperation, scoped, args));
    expect(result).toEqual(original); expect(state()).toEqual(originalState);
    expect(originalReads).toBe(sourceCount ? 1046 : 326); expect(reads).toBe(sourceCount ? 66 : 42);
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ state: "dispatch_pending", reservationUnits: 100, slotReleased: false });
    expect(f.db.table("runtimeAgentOutput")).toEqual([]);
    // A new real registered parent invocation owns another fresh scope. Replay
    // keeps exactly one retained attempt and cannot issue a second permit.
    parentScope = true;
    expect(await f.call(runtime.admitModelOperation,args)).toMatchObject({admission:{status:"uncertain",replayAllowed:false}});
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
});
