import { describe, expect, it } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { recall, remember } from "../../../convex-dev/runtimeMemory";
import { memoryFixture, registeredHandler } from "./fixture";

const unavailable = { version: 1, code: "CAPABILITY_UNAVAILABLE", message: "Memory capability unavailable.",
  retryable: false, outcome: "not_dispatched" };
const args = { tenantId: "tenant-a", memorySpaceId: "space-a", text: "private input", requestId: "request-closure" };
const operations = ["remember", "recall"] as const;
function instrument() {
  const f = memoryFixture();
  // The fixture lazily creates table arrays on reads; materialize the trusted control table before snapshots.
  f.db.table("runtimeAuthTombstones");
  const calls: string[] = [];
  const businessReads: string[] = [];
  let late: (() => void) | undefined;
  const query = f.db.query.bind(f.db);
  f.db.query = (table) => { if (!table.startsWith("runtimeAuth")) businessReads.push(`query:${table}`); return query(table); };
  const get = f.db.get.bind(f.db);
  f.db.get = async (table, id) => { if (!table.startsWith("runtimeAuth")) businessReads.push(`get:${table}`); return await get(table, id); };
  const runQuery = f.actionCtx.runQuery.bind(f.actionCtx);
  f.actionCtx.runQuery = async (ref, input) => {
    const name = getFunctionName(ref); calls.push(name);
    if (name === "runtimeMemory:checkAuthority") late?.();
    return await runQuery(ref, input);
  };
  const runMutation = f.actionCtx.runMutation.bind(f.actionCtx);
  f.actionCtx.runMutation = async (ref, input) => { calls.push(getFunctionName(ref)); return await runMutation(ref, input); };
  return { ...f, calls, businessReads, setLate: (callback: () => void) => { late = callback; } };
}
async function invoke(f: ReturnType<typeof instrument>, operation: typeof operations[number], input = args): Promise<unknown> {
  try {
    await registeredHandler<typeof args, unknown>(operation === "remember" ? remember : recall)(
      f.actionCtx as unknown as Parameters<ReturnType<typeof registeredHandler>>[0], input);
    throw new Error("Expected foreground rejection");
  } catch (error) {
    if (!error || typeof error !== "object" || !("data" in error)) throw error;
    return error.data;
  }
}
function noBusinessEffects(f: ReturnType<typeof instrument>): void {
  expect(f.businessReads).toEqual([]);
  expect(f.db.writes).toBe(0);
  expect(f.searches).toEqual([]);
  expect(f.calls.every((name) => name === "runtimeAuth:authorize" || name === "runtimeMemory:checkAuthority")).toBe(true);
}

describe.each(operations)("registered public %s foundation closure", (operation) => {
  it("returns the exact readiness envelope after concrete authority and persisted recheck", async () => {
    const f = instrument();
    expect(await invoke(f, operation)).toEqual(unavailable);
    expect(f.calls).toEqual(["runtimeAuth:authorize", "runtimeMemory:checkAuthority"]);
    noBusinessEffects(f);
    expect(f.db.table("runtimeMemorySources")).toEqual([]);
  });
  it("ignores semantic text/request/limit validation while unavailable", async () => {
    const f = instrument();
    expect(await invoke(f, operation, { ...args, text: "\r\n  ", requestId: "" })).toEqual(unavailable);
    if (operation === "recall") {
      const input = { ...args, limit: -999 };
      expect(await invoke(f, operation, input)).toEqual(unavailable);
    }
    noBusinessEffects(f);
  });
  it("does not access semantic getters before returning unavailable", async () => {
    const f = instrument(); const input = { ...args };
    Object.defineProperty(input, "text", { get: () => { throw new Error("Semantic text read"); } });
    Object.defineProperty(input, "requestId", { get: () => { throw new Error("Semantic request read"); } });
    expect(await invoke(f, operation, input)).toEqual(unavailable);
    noBusinessEffects(f);
  });
  it("denies an administrator lacking the required data capability", async () => {
    const f = instrument(); f.grant.capabilities = ["admin"];
    expect(await invoke(f, operation)).toMatchObject({ code: "FORBIDDEN", outcome: "not_dispatched" });
    expect(f.calls).toEqual(["runtimeAuth:authorize"]); noBusinessEffects(f);
  });
  it("denies missing verified identity", async () => {
    const f = instrument(); f.ctx.auth.getUserIdentity = async () => null;
    expect(await invoke(f, operation)).toMatchObject({ code: "UNAUTHENTICATED", outcome: "not_dispatched" });
    noBusinessEffects(f);
  });
  it("denies a forged verified subject mapping", async () => {
    const f = instrument(); f.ctx.auth.getUserIdentity = async () => ({ issuer: "https://host.test", subject: "forged" }) as Awaited<ReturnType<typeof f.ctx.auth.getUserIdentity>>;
    expect(await invoke(f, operation)).toMatchObject({ code: "FORBIDDEN" }); noBusinessEffects(f);
  });
  it("denies a grant whose trusted scope changes after admission", async () => {
    const f = instrument(); f.setLate(() => { f.grant.memorySpaceId = "foreign"; });
    expect(await invoke(f, operation)).toMatchObject({ code: "FORBIDDEN" }); noBusinessEffects(f);
  });
  it("denies a scope epoch changed after admission", async () => {
    const f = instrument(); f.setLate(() => { f.db.table("runtimeAuthScopes").find((row) => row.memorySpaceId === "space-a")!.epoch = 2; });
    expect(await invoke(f, operation)).toMatchObject({ code: "FORBIDDEN" }); noBusinessEffects(f);
  });
  it.each(["tenantId", "memorySpaceId"] as const)("denies wrong %s", async (selector) => {
    const f = instrument();
    expect(await invoke(f, operation, { ...args, [selector]: "foreign" })).toMatchObject({ code: "FORBIDDEN" });
    noBusinessEffects(f);
  });
  it("denies an authorized tenant-wide grant lacking concrete memory scope", async () => {
    const f = instrument(); delete f.grant.memorySpaceId; delete f.grant.memorySpaceEpoch;
    const input = { ...args, memorySpaceId: undefined } as unknown as typeof args;
    expect(await invoke(f, operation, input)).toMatchObject({ code: "FORBIDDEN" });
    expect(f.calls).toEqual(["runtimeAuth:authorize"]); noBusinessEffects(f);
  });
  it("denies omitted selectors when trusted eligible scopes are ambiguous", async () => {
    const f = instrument();
    f.db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-b", epoch: 1, createdAt: 1000 });
    f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:other", memorySpaceId: "space-b" });
    const input = { ...args, tenantId: undefined, memorySpaceId: undefined } as unknown as typeof args;
    expect(await invoke(f, operation, input)).toMatchObject({ code: "FORBIDDEN" }); noBusinessEffects(f);
  });
  it("accepts omitted selectors only when they resolve one concrete trusted scope", async () => {
    const f = instrument();
    const input = { ...args, tenantId: undefined, memorySpaceId: undefined } as unknown as typeof args;
    expect(await invoke(f, operation, input)).toEqual(unavailable); noBusinessEffects(f);
  });
  for (const record of ["principal", "membership", "grant"] as const) {
    for (const field of ["revokedAt", "deletedAt"] as const) {
      it.each(["initial", "late"] as const)(`denies ${record}.${field} at %s control boundary`, async (timing) => {
        const f = instrument(); const invalidate = () => { f[record][field] = 1000; };
        if (timing === "late") f.setLate(invalidate); else invalidate();
        expect(await invoke(f, operation)).toMatchObject({ code: "FORBIDDEN", outcome: "not_dispatched" });
        expect(f.calls).toEqual(timing === "late" ? ["runtimeAuth:authorize", "runtimeMemory:checkAuthority"] : ["runtimeAuth:authorize"]);
        noBusinessEffects(f);
      });
    }
  }
  it.each(["initial", "late"] as const)("denies expired grant at %s boundary", async (timing) => {
    const f = instrument(); const invalidate = () => { f.grant.expiresAt = 1; };
    if (timing === "late") f.setLate(invalidate); else invalidate();
    expect(await invoke(f, operation)).toMatchObject({ code: "FORBIDDEN" }); noBusinessEffects(f);
  });
  it.each(["tenant", "space"] as const)("denies late deleted %s scope", async (scope) => {
    const f = instrument();
    f.setLate(() => { const row = f.db.table("runtimeAuthScopes").find((value) => scope === "tenant" ? value.memorySpaceId === undefined : value.memorySpaceId === "space-a"); row!.deletedAt = 1; });
    expect(await invoke(f, operation)).toMatchObject({ code: "FORBIDDEN" }); noBusinessEffects(f);
  });
  it.each(["absent", "owned", "foreign", "tombstoned"] as const)("same private IDs are unobservable when %s", async (state) => {
    const f = instrument();
    if (state !== "absent") {
      for (const table of ["runtimeMemorySources", "runtimeMemoryChunks", "runtimeMemoryVectors", "runtimeMemoryReceipts", "facts"]) {
        f.db.seed(table, { sourceId: "same-id", factId: "same-id", tenantId: state === "foreign" ? "foreign" : "tenant-a",
          memorySpaceId: "space-a", ownerPrincipalId: state === "foreign" ? "foreign" : f.principal._id,
          content: "PRIVATE_SENTINEL", tombstonedAt: state === "tombstoned" ? 1 : undefined });
      }
    }
    const before = structuredClone(f.db.rows);
    expect(await invoke(f, operation)).toEqual(unavailable);
    noBusinessEffects(f); expect(f.db.rows).toEqual(before);
  });
});

it("write-only authority receives unavailable for remember and cannot invoke recall", async () => {
  const f = instrument(); f.grant.capabilities = ["write"];
  expect(await invoke(f, "remember")).toEqual(unavailable);
  expect(await invoke(f, "recall")).toMatchObject({ code: "FORBIDDEN" });
  noBusinessEffects(f);
});
