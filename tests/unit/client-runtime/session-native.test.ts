/** Registered session RPC on controlled trusted rows; no service/timing claim. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { RuntimeSession } from "../../../src/client-runtime/types";
import { fixture, registeredHandler } from "../runtimeMetadataAuth/fixture";

jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
} }));
const client = await import("../../../convex-dev/runtimeClient");
beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(1000); });
afterEach(() => { jest.restoreAllMocks(); });
describe("fresh native session raw read reuse", () => {
  it.each([{}, { tenantId: "tenant-a", memorySpaceId: "space-a" }])("preserves exact actor/deadline with fewer duplicate raw reads for selectors %#", async selectors => {
    const f = fixture({ space: "space-a" }); f.grant.expiresAt = 1100; f.db.table("runtimeAuthTombstones");
    const get = jest.spyOn(f.db, "get"), query = jest.spyOn(f.db, "query"), before = structuredClone(f.db.rows);
    const expected = await client.sessionHandler(f.ctx, selectors);
    const originalGets = get.mock.calls.map(args => JSON.stringify(args)), originalQueries = query.mock.calls.map(args => JSON.stringify(args));
    get.mockClear(); query.mockClear();
    const result = await registeredHandler<typeof selectors, RuntimeSession>(client.session)(f.ctx, selectors);
    const currentGets = get.mock.calls.map(args => JSON.stringify(args)), currentQueries = query.mock.calls.map(args => JSON.stringify(args));
    expect(result).toEqual(expected);
    expect(result).toEqual({ version: 1, tenantId: "tenant-a", memorySpaceId: "space-a", principalId: f.principal._id, userId: "alice", deliveryExpiresAt: 1100 });
    expect(new Set(currentGets)).toEqual(new Set(originalGets)); expect(new Set(currentQueries)).toEqual(new Set(originalQueries));
    expect(currentGets.length + currentQueries.length).toBeLessThan(originalGets.length + originalQueries.length);
    expect(f.db.rows).toEqual(before); expect(f.db.writes).toBe(0);
    // Returned DTO mutation cannot change a later fresh actor/deadline.
    Reflect.set(result, "userId", "local-only"); expect(await f.run(client.session, selectors)).toEqual(expected);
    console.info(JSON.stringify({ controlledSessionReads: { original: originalGets.length + originalQueries.length,
      current: currentGets.length + currentQueries.length }, nativeLatency: "NOT_RUN" }));
  });
  it.each(["revoked", "expired", "unauthenticated", "changed-principal", "ambiguous-scope"] as const)("a later RPC independently refuses %s", async kind => {
    const f = fixture({ space: "space-a" }); f.db.table("runtimeAuthTombstones");
    expect(await f.run(client.session)).toMatchObject({ principalId: f.principal._id, memorySpaceId: "space-a" });
    if (kind === "revoked") f.grant.revokedAt = 1000;
    if (kind === "expired") f.grant.expiresAt = 1000;
    if (kind === "unauthenticated") f.ctx.auth.getUserIdentity = async () => null;
    if (kind === "changed-principal") f.ctx.auth.getUserIdentity = async () => ({ issuer: "https://host.test", subject: "different" }) as never;
    if (kind === "ambiguous-scope") {
      f.db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-b", epoch: 1, createdAt: 1000 });
      f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:second", memorySpaceId: "space-b" });
    }
    await expect(f.run(client.session)).rejects.toMatchObject({ data: { code: kind === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN" } });
    expect(f.db.writes).toBe(0);
  });
  it("a grant clock expiry remains visible on the next RPC with unchanged raw records", async () => {
    const f = fixture({ space: "space-a" }); f.grant.expiresAt = 1010; f.db.table("runtimeAuthTombstones");
    expect(await f.run(client.session)).toMatchObject({ deliveryExpiresAt: 1010 });
    jest.spyOn(Date, "now").mockReturnValue(1010);
    await expect(f.run(client.session)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});
