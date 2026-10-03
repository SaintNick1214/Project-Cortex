import { describe, expect, it } from "@jest/globals";
import { ConvexError, type Value } from "convex/values";
import * as mutable from "../../../convex-dev/mutable";
import * as sessions from "../../../convex-dev/sessions";
import { requireAuthority } from "../../../convex-dev/runtimeAuth";
import { fixture } from "./fixture";

type F = ReturnType<typeof fixture>;
type Row = ReturnType<F["seedMutable"]>;
type Capability = "read" | "write";
type Layout = "spaces" | "tenants";
type Defect = "scope" | "tombstone";
const capabilities: Capability[] = ["read", "write"];
const layouts: Layout[] = ["spaces", "tenants"];
const defects: Defect[] = ["scope", "tombstone"];
const ambiguous = { version: 1, code: "AUTHORITY_LOOKUP_AMBIGUOUS", message: "Authority lookup is ambiguous",
  retryable: false, outcome: "not_dispatched" };
const forbidden = { version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" };
const privateValue = "private-b-value";
const privateId = "mutable:private-b";
const nativeModulePath = "../../../node_modules/convex/dist/esm/server/impl/" + "query_impl.js";
const { QueryImpl } = await import(nativeModulePath) as { QueryImpl: { prototype: {
  unique(this: { take(limit: number): Promise<Row[]>; tableNameForErrorMessages: string }): Promise<Row | null>;
} } };

function setup(layout: Layout, capability: Capability, healthyFirst = false) {
  const f = fixture({ capabilities: [capability], ...(layout === "spaces" ? { space: "space-a", access: "space" } : { access: "tenant" }) });
  const a = { tenantId: "tenant-a", memorySpaceId: layout === "spaces" ? "space-a" : undefined };
  const b = { tenantId: layout === "spaces" ? "tenant-a" : "tenant-b", memorySpaceId: layout === "spaces" ? "space-b" : undefined };
  const membership = layout === "spaces" ? f.membership : f.db.seed("runtimeAuthMemberships", { ...f.membership,
    _id: "runtimeAuthMemberships:tenant-b", tenantId: "tenant-b" });
  f.db.seed("runtimeAuthScopes", { ...b, epoch: 1, createdAt: 1000 });
  f.db.seed("runtimeAuthGrants", { ...f.grant, ...b, _id: "runtimeAuthGrants:scope-b", membershipId: membership._id });
  f.seedMutable({ ...b, _id: privateId, value: privateValue });
  if (healthyFirst) f.db.table(layout === "spaces" ? "runtimeAuthGrants" : "runtimeAuthMemberships").reverse();
  return { f, a, b, layout };
}
type Setup = ReturnType<typeof setup>;
function corrupt(s: Setup, defect: Defect, scope = s.a) {
  const table = defect === "scope" ? "runtimeAuthScopes" : "runtimeAuthTombstones";
  let first: Row;
  if (defect === "scope") first = s.f.db.table(table).find((row) => row.tenantId === scope.tenantId && row.memorySpaceId === scope.memorySpaceId)!;
  else first = s.f.db.seed(table, { ...scope, _id: "private-control-one", resourceType: s.layout === "spaces" ? "memorySpace" : "tenant",
    resourceId: scope.memorySpaceId ?? scope.tenantId, deletedAt: 1000 });
  s.f.db.seed(table, { ...first, _id: "private-control-two", privateDiagnostic: "private-control-value" });
  return { table, ids: [first._id, "private-control-two"] };
}
function protocol(f: F, beforeTake?: (table: string, keys: [string, unknown][]) => void) {
  const original = f.db.query.bind(f.db);
  const traces: Array<{ table: string; index?: string; keys: [string, unknown][]; limit: number; ids: string[] }> = [];
  let uniqueCalls = 0;
  f.db.query = (table) => {
    const q = original(table); const index = q.withIndex.bind(q); const take = q.take.bind(q);
    const keys: [string, unknown][] = []; let indexName: string | undefined;
    q.withIndex = (name, callback) => {
      indexName = name;
      return index(name, (selector) => {
        const observed = { eq: (key: string, value: unknown) => { keys.push([key, value]); selector.eq(key, value); return observed; } };
        return callback(observed);
      });
    };
    q.take = async (limit) => {
      beforeTake?.(table, keys);
      const rows = await take(limit); traces.push({ table, index: indexName, keys: [...keys], limit, ids: rows.map((row) => row._id) });
      return rows;
    };
    // Keep the installed native diagnostic if a regression reintroduces unique().
    // The fixture's inferred non-null signature does not change native null at runtime.
    q.unique = async () => { uniqueCalls++; return (await QueryImpl.prototype.unique.call({ take: q.take, tableNameForErrorMessages: table }))!; };
    return q;
  };
  return { traces, uniqueCalls: () => uniqueCalls };
}
async function failure(operation: Promise<unknown>): Promise<unknown> {
  try { await operation; } catch (error) { return error; }
  throw new Error("Expected failure without a result or safe receipt");
}
function errorShape(error: unknown, expected: typeof ambiguous | typeof forbidden, ids: string[] = []) {
  expect(error).toBeInstanceOf(ConvexError); expect(error).toHaveProperty("data", expected);
  const visible = error instanceof Error ? error.message + error.stack + JSON.stringify((error as ConvexError<Value>).data) : String(error);
  for (const field of [...ids, privateId, privateValue, "private-control-value"]) expect(visible).not.toContain(field);
}
function unchanged(f: F, before: Map<string, Row[]>, attempts = 0) {
  expect(f.db.attemptedWrites).toBe(attempts); expect(f.db.writes).toBe(0); expect(f.db.rows).toEqual(before);
}
function invoke(s: Setup, capability: Capability, selectors: Record<string, unknown> = {}) {
  return s.f.run(capability === "read" ? mutable.get : mutable.set, { namespace: "counter", key: "one", ...selectors,
    ...(capability === "write" ? { value: "replacement" } : {}) });
}
function success(s: Setup, capability: Capability, result: unknown) {
  if (capability === "read") expect(result).toMatchObject({ _id: privateId, ...s.b, value: privateValue });
  else {
    expect(result).toEqual({ updated: true, namespace: "counter", key: "one" });
    expect(s.f.db.table("mutable")[0]).toMatchObject({ _id: privateId, ...s.b, value: "replacement" });
  }
  expect(s.f.db.attemptedWrites).toBe(capability === "write" ? 1 : 0); expect(s.f.db.writes).toBe(capability === "write" ? 1 : 0);
}
const corruptions = layouts.flatMap((layout) => defects.flatMap((defect) => capabilities.map((capability) => ({ layout, defect, capability }))));

describe("control ambiguity aborts multi-grant admission instead of pruning to another scope", () => {
  it.each(corruptions.flatMap((item) => [false, true].map((healthyFirst) => ({ ...item, healthyFirst }))))("$layout/$defect $capability omitted selectors reject; healthy candidate first=$healthyFirst", async ({ layout, defect, capability, healthyFirst }) => {
    const s = setup(layout, capability, healthyFirst); const corruption = corrupt(s, defect); const native = protocol(s.f);
    const before = structuredClone(s.f.db.rows);
    errorShape(await failure(invoke(s, capability)), ambiguous, corruption.ids);
    expect(native.traces.some((trace) => trace.table === corruption.table && trace.limit === 2
      && trace.ids.join() === corruption.ids.join())).toBe(true);
    expect(native.traces.some((trace) => trace.table === "mutable")).toBe(false);
    expect(native.uniqueCalls()).toBe(0); unchanged(s.f, before);
  });
  it.each(corruptions)("$layout/$defect $capability explicitly corrupted scope rejects without an alternative result", async ({ layout, defect, capability }) => {
    const s = setup(layout, capability); const corruption = corrupt(s, defect); const native = protocol(s.f);
    const before = structuredClone(s.f.db.rows);
    errorShape(await failure(invoke(s, capability, s.a)), ambiguous, corruption.ids);
    expect(native.traces.some((trace) => trace.table === corruption.table && trace.limit === 2 && trace.ids.join() === corruption.ids.join())).toBe(true);
    expect(native.uniqueCalls()).toBe(0); unchanged(s.f, before);
  });
  it.each(corruptions)("$layout/$defect $capability explicit healthy scope remains available despite unselected corrupt controls", async ({ layout, defect, capability }) => {
    const s = setup(layout, capability); const corruption = corrupt(s, defect); const native = protocol(s.f);
    success(s, capability, await invoke(s, capability, s.b));
    expect(native.traces.some((trace) => trace.ids.includes("private-control-two"))).toBe(false);
    expect(native.traces.filter((trace) => trace.table === "mutable")).toEqual([expect.objectContaining({ limit: 2, ids: [privateId] })]);
    expect(s.f.db.table(corruption.table).some((row) => row._id === "private-control-two")).toBe(true);
    expect(native.uniqueCalls()).toBe(0);
  });
  it.each(layouts.flatMap((layout) => capabilities.map((capability) => ({ layout, capability }))))("$layout $capability healthy two-scope omission retains ordinary FORBIDDEN ambiguity", async ({ layout, capability }) => {
    const s = setup(layout, capability); const native = protocol(s.f); const before = structuredClone(s.f.db.rows);
    errorShape(await failure(invoke(s, capability)), forbidden);
    expect(native.traces.filter((trace) => trace.table === "runtimeAuthScopes").length).toBeGreaterThanOrEqual(2);
    expect(native.traces.every((trace) => trace.ids.length < 2)).toBe(true); expect(native.uniqueCalls()).toBe(0); unchanged(s.f, before);
  });
  it.each(layouts.flatMap((layout) => capabilities.flatMap((capability) => ["one", "revoked", "expired", "single-tombstone", "deleted-scope", "missing-scope"].map((pruning) => ({ layout, capability, pruning })))))("$layout $capability ordinary $pruning eligibility still selects the one permitted scope", async ({ layout, capability, pruning }) => {
    const s = setup(layout, capability);
    if (pruning === "one") s.f.db.rows.set("runtimeAuthGrants", s.f.db.table("runtimeAuthGrants").filter((row) => row._id !== s.f.grant._id));
    else if (pruning === "revoked") s.f.grant.revokedAt = 1000;
    else if (pruning === "expired") s.f.grant.expiresAt = 1;
    else if (pruning === "single-tombstone") s.f.db.seed("runtimeAuthTombstones", { ...s.a,
      resourceType: layout === "spaces" ? "memorySpace" : "tenant", resourceId: s.a.memorySpaceId ?? s.a.tenantId, deletedAt: 1000 });
    else {
      const a = s.f.db.table("runtimeAuthScopes").find((row) => row.tenantId === s.a.tenantId && row.memorySpaceId === s.a.memorySpaceId)!;
      if (pruning === "deleted-scope") a.deletedAt = 1000;
      else s.f.db.rows.set("runtimeAuthScopes", s.f.db.table("runtimeAuthScopes").filter((row) => row._id !== a._id));
    }
    const native = protocol(s.f); success(s, capability, await invoke(s, capability));
    expect(native.traces.every((trace) => trace.ids.length < 2)).toBe(true); expect(native.uniqueCalls()).toBe(0);
  });
  it.each(layouts.flatMap((layout) => capabilities.flatMap((capability) => [false, true].map((healthyFirst) => ({ layout, capability, healthyFirst })))))("$layout $capability infrastructure failure remains identical; healthy candidate first=$healthyFirst", async ({ layout, capability, healthyFirst }) => {
    const s = setup(layout, capability, healthyFirst); const infrastructure = new Error("scope infrastructure unavailable"); let reached = 0;
    const native = protocol(s.f, (table, keys) => { if (table === "runtimeAuthScopes"
      && keys.some(([key, value]) => key === "tenantId" && value === s.a.tenantId)
      && keys.some(([key, value]) => key === "memorySpaceId" && value === s.a.memorySpaceId)) { reached++; throw infrastructure; } });
    const before = structuredClone(s.f.db.rows);
    const error = await failure(invoke(s, capability)); expect(error).toBe(infrastructure); expect(error).not.toBeInstanceOf(ConvexError);
    expect(reached).toBe(1); expect(native.uniqueCalls()).toBe(0); unchanged(s.f, before);
  });
});

describe("pinned and final control ambiguity never switches scope or returns a WRITE-only receipt", () => {
  it.each(layouts.flatMap((layout) => defects.flatMap((defect) => ["public-final", "pinned-before", "pinned-final"].map((phase) => ({ layout, defect, phase })))))("$layout/$defect $phase aborts with exact nonpermission error and rollback", async ({ layout, defect, phase }) => {
    const s = setup(layout, "write");
    const auth = await requireAuthority(s.f.ctx, { capability: "write", ...s.b });
    const { actorKind: _actorKind, userId: _userId, capabilities: _capabilities, resourceAccess: _resourceAccess, ...reference } = auth;
    if (phase !== "public-final") s.f.seedSession({ ...s.b, authorityReference: reference, metadata: { secret: privateValue } });
    let corruption: ReturnType<typeof corrupt> | undefined;
    if (phase === "pinned-before") corruption = corrupt(s, defect, s.b);
    else s.f.db.afterWrite = () => { corruption = corrupt(s, defect, s.b); };
    const native = protocol(s.f); const before = structuredClone(s.f.db.rows);
    const operation = phase === "public-final" ? invoke(s, "write", s.b)
      : s.f.run(sessions.incrementMessageCount, { sessionId: "one", reference });
    const error = await failure(operation); expect(corruption).toBeDefined(); errorShape(error, ambiguous, corruption!.ids);
    expect(native.traces.some((trace) => trace.table === corruption!.table && trace.limit === 2 && trace.ids.join() === corruption!.ids.join())).toBe(true);
    expect(native.uniqueCalls()).toBe(0); unchanged(s.f, before, phase === "pinned-before" ? 0 : 1);
  });
});
