/** Current verified runtime contract. Historical pre-authority catalog and coverage
 * mapping: _DEPRECATED/tests/legacy-registry/README.md. Public endpoints stay public. */
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createNamedTestRunContext } from "./helpers/isolation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

describe("Sessions: verified application lifecycle", () => {
  const run = createNamedTestRunContext("canonical-sessions");
  let f: Awaited<ReturnType<typeof createRuntimeFixture>>;
  beforeEach(async () => { const id = crypto.randomUUID(); f = await createRuntimeFixture(run.runId + id, run.memorySpaceId(id), run.userId(id)); });
  afterEach(async () => { await f?.close(); });
  const create = () => f.cortex.sessions.create({ userId: f.userId, memorySpaceId: f.memorySpaceId, metadata: { device: "CI" } });
  it("creates unique sessions, gets/touches them, and redacts maintenance references", async () => {
    const a = await create(), b = await create(); expect(a.sessionId).not.toBe(b.sessionId);
    expect(a).toMatchObject({ userId: f.userId, tenantId: f.tenantId, memorySpaceId: f.memorySpaceId, status: "active", messageCount: 0, memoryCount: 0 });
    expect(a).not.toHaveProperty("authorityReference");
    await f.cortex.sessions.touch(a.sessionId);
    const got = await f.cortex.sessions.get(a.sessionId); expect(got?.lastActiveAt).toBeGreaterThanOrEqual(a.lastActiveAt);
    expect(got).not.toHaveProperty("authorityReference");
    expect([a.sessionId, b.sessionId]).toContain((await f.cortex.sessions.getOrCreate(f.userId)).sessionId);
  });
  it("lists/counts/gets active, ends one and all remaining sessions", async () => {
    const a = await create(), b = await create();
    expect(await f.cortex.sessions.list({ memorySpaceId: f.memorySpaceId, limit: 1 })).toHaveLength(1);
    expect(await f.cortex.sessions.count({ status: "active" })).toBe(2);
    expect(await f.cortex.sessions.getActive(f.userId)).toHaveLength(2);
    await f.cortex.sessions.end(a.sessionId);
    expect(await f.cortex.sessions.get(a.sessionId)).toMatchObject({ status: "ended" });
    expect(await f.cortex.sessions.endAll(f.userId)).toMatchObject({ ended: 1, sessionIds: [b.sessionId] });
    expect(await f.cortex.sessions.getActive(f.userId)).toEqual([]);
    // Application session end does not revoke persisted runtime authority.
    expect(await f.cortex.users.update(f.userId, { displayName: "Still admitted" })).toMatchObject({ id: f.userId });
  });
  it("refuses expired lifetimes, forged actors and unavailable public idle maintenance before effects", async () => {
    const before = await f.ownedRows("sessions");
    await expect(f.cortex.sessions.create({ userId: f.userId, expiresAt: Date.now() - 1, memorySpaceId: f.memorySpaceId })).rejects.toThrow();
    await expect(f.cortex.sessions.create({ userId: f.userId + "-forged", memorySpaceId: f.memorySpaceId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.cortex.sessions.expireIdle()).rejects.toMatchObject({ code: "BACKEND_MAINTENANCE_ONLY" });
    expect(await f.ownedRows("sessions")).toEqual(before);
  });
  it("conceals foreign sessions, rejects ordinary public clients and protects ended sessions from touch", async () => {
    const a = await create();
    const other = await createRuntimeFixture(f.tenantId + "-other", f.memorySpaceId + "-other", f.userId + "-other");
    try {
      expect(await other.cortex.sessions.get(a.sessionId)).toBeNull();
      const ordinary = new ConvexHttpClient(process.env.CONVEX_URL!, { logger: false });
      await expect(ordinary.query(makeFunctionReference<"query">("sessions:get"), { sessionId: a.sessionId })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
      await f.cortex.sessions.end(a.sessionId); const before = await f.ownedRows("sessions");
      await expect(f.cortex.sessions.touch(a.sessionId)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      expect(await f.ownedRows("sessions")).toEqual(before);
    } finally { await other.close(); }
  });
});
