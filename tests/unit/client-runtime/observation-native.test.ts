/** Original registered handlers on the controlled transactional/component fixture.
 * This exercises product guards, not actual Convex OCC, services or cloud timings. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { RuntimeObservation, RuntimeRunHandle, RuntimeSession } from "../../../src/client-runtime/types";
import { assertNativeArgs } from "../runtimeAgent/native-arguments";

jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:offline"; }
} }));
const { installMockRoot, transcriptFixture, runs, invoke, clone } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const client = await import("../../../convex-dev/runtimeClient");
type Envelope = { version: 1; session: RuntimeSession; observation: RuntimeObservation };
beforeEach(() => { installMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = await transcriptFixture(), original = f.ctx.runMutation.bind(f.ctx);
  f.ctx.runMutation = async (ref, ...args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { /* Keep the original native component port. */ }
    return name === "runs:claimNext" ? await invoke(runs.claimNext, f.ctx, args[0]) as never : await original(ref, ...args);
  };
  const value = await f.run();
  await f.call(runtime.start, { runId: value.runId });
  const owned = f.db.table("runtimeAgentExecutions")[0];
  await f.call(runtime.saveContext, { reference: f.reference, runId: value.runId, attemptNumber: 1,
    leaseVersion: owned.leaseVersion, context: "PRIVATE_CONTEXT", witnesses: [], completeness: "complete" });
  await f.call(runtime.recordOutput, { reference: f.reference, runId: value.runId, attemptNumber: 1,
    leaseVersion: owned.leaseVersion, parts: [{ type: "text-delta", text: "PRIVATE_CURRENT_TEXT", id: "text" }] });
  const handle: RuntimeRunHandle = { version: 1, tenantId: value.scope.tenantId, memorySpaceId: value.scope.memorySpaceId,
    principalId: f.principal._id, runId: value.runId, conversationId: value.conversationId, agentId: value.agentId,
    agentVersion: value.agentVersion, definitionHash: value.definitionHash };
  const observe = async (options: { tenantId?: string; memorySpaceId?: string; afterSequence?: number; limit?: number; finalOnly?: boolean;
    handle?: RuntimeRunHandle } = {}) => {
    const args = { handle, ...options }; assertNativeArgs(client.observeEnvelope, args);
    return await f.call<Envelope>(client.observeEnvelope, args);
  };
  const snapshot = () => clone({ rows: f.db.rows, writes: f.db.writes, native: f.native, effects: f.effects, scheduled: f.scheduled });
  return { ...f, handle, observe, snapshot };
}
describe("private observation transaction composition", () => {
  it.each([{}, { tenantId: "tenant-a", memorySpaceId: "space-a" }, { memorySpaceId: "space-a" }])(
    "returns the exact original session and observation projections with selectors %#", async selectors => {
      const f = await fixture(), before = f.snapshot();
      const current = await f.call<RuntimeSession>(client.session, selectors);
      const observed = await f.call<RuntimeObservation>(runtime.observe, { ...selectors, runId: f.handle.runId, afterSequence: 0, limit: 100, finalOnly: false });
      expect(await f.observe({ ...selectors, afterSequence: 0, limit: 100, finalOnly: false })).toEqual({ version: 1, session: current, observation: observed });
      expect(observed.parts).toEqual([{ sequence: 1, part: { type: "text-delta", text: "PRIVATE_CURRENT_TEXT", id: "text" } }]);
      expect(JSON.stringify(observed)).not.toContain("PRIVATE_CONTEXT"); expect(f.snapshot()).toEqual(before);
    });
  it.each([{ afterSequence: 1 }, { finalOnly: true }, { afterSequence: 0, limit: 1 }])(
    "preserves the original cursor, limit and final-only behavior %#", async options => {
      const f = await fixture(), before = f.snapshot();
      const expected = await f.call(runtime.observe, { runId: f.handle.runId, ...options });
      expect((await f.observe(options)).observation).toEqual(expected); expect(f.snapshot()).toEqual(before);
    });
  it("does not fill omitted ambiguous client scope from the supplied handle", async () => {
    const f = await fixture();
    f.db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-b", epoch: 1 });
    f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:second", memorySpaceId: "space-b" });
    const before = f.snapshot();
    await expect(f.call(client.session, {})).rejects.toThrow("FORBIDDEN");
    await expect(f.observe()).rejects.toThrow("FORBIDDEN"); expect(f.snapshot()).toEqual(before);
    expect((await f.observe({ tenantId: "tenant-a", memorySpaceId: "space-a" })).observation.parts).toHaveLength(1);
  });
  it.each(["principalId", "tenantId", "memorySpaceId"] as const)("a changed expected actor %s grants no private access", async field => {
    const f = await fixture(), before = f.snapshot();
    await expect(f.observe({ handle: { ...f.handle, [field]: "foreign" } })).rejects.toThrow("SESSION_CHANGED");
    expect(f.snapshot()).toEqual(before);
  });
  it.each(["conversationId", "agentId", "agentVersion", "definitionHash"] as const)("the immutable %s handle cannot be substituted", async field => {
    const f = await fixture(), before = f.snapshot();
    await expect(f.observe({ handle: { ...f.handle, [field]: field === "agentVersion" ? 2 : "foreign" } })).rejects.toThrow("RUN_IDENTITY_CHANGED");
    expect(f.snapshot()).toEqual(before);
  });
  it.each(["revoked", "expired", "unauthenticated", "wrong_scope", "missing_read", "run_tombstone", "conversation_tombstone"])(
    "%s retains the original authority/resource denial and complete prior state", async kind => {
      const f = await fixture();
      if (kind === "revoked") f.grant.revokedAt = Date.now();
      if (kind === "expired") f.grant.expiresAt = Date.now();
      if (kind === "unauthenticated") f.identity(null);
      if (kind === "missing_read") f.grant.capabilities = (f.grant.capabilities as string[]).filter(cap => cap !== "read");
      if (kind === "run_tombstone") f.db.table("runtimeRuns")[0].tombstonedAt = Date.now();
      if (kind === "conversation_tombstone") f.db.table("runtimeConversations")[0].tombstonedAt = Date.now();
      const before = f.snapshot();
      await expect(f.observe(kind === "wrong_scope" ? { tenantId: "foreign", memorySpaceId: "space-a" } : {})).rejects.toThrow();
      expect(f.snapshot()).toEqual(before);
    });
  it.each(["revoke", "expire"])("the original observe rechecks a grant after pre-session %s", async kind => {
    const f = await fixture(), original = f.ctx.auth.getUserIdentity.bind(f.ctx.auth), before = f.snapshot(); let reads = 0;
    f.ctx.auth.getUserIdentity = async () => {
      const identity = await original();
      if (++reads === 2) {
        if (kind === "revoke") f.grant.revokedAt = Date.now(); else f.grant.expiresAt = Date.now();
      }
      return identity;
    };
    await expect(f.observe()).rejects.toThrow("FORBIDDEN"); expect(reads).toBe(2); expect(f.snapshot()).toEqual(before);
  });
  it("a late grant revocation while projecting private rows is denied by the original delivery recheck and rolls back the fixture", async () => {
    const f = await fixture(), original = f.db.query.bind(f.db), before = f.snapshot(); let reached = false;
    f.db.query = table => {
      if (table === "runtimeAgentOutput") { reached = true; f.grant.revokedAt = Date.now(); }
      return original(table);
    };
    await expect(f.observe()).rejects.toThrow("FORBIDDEN"); expect(reached).toBe(true); expect(f.snapshot()).toEqual(before);
  });
  it("propagates a failed original read without leaving injected partial transaction state", async () => {
    const f = await fixture(), original = f.db.query.bind(f.db), before = f.snapshot(); let reached = false;
    f.db.query = table => {
      if (table === "runtimeAgentOutput") {
        reached = true; f.db.seed("runtimeAgentOutput", { runId: "FAULT_WRITER_SENTINEL" }); throw new Error("INJECTED_READ_FAILURE");
      }
      return original(table);
    };
    await expect(f.observe()).rejects.toThrow("INJECTED_READ_FAILURE"); expect(reached).toBe(true); expect(f.snapshot()).toEqual(before);
  });
  it.each([{ model: "override" }, { context: "override" }, { principalId: "override" }, { handle: { version: 1 } }])(
    "the actual native argument graph rejects unsupported authority/behavior branches %#", async extras => {
      const f = await fixture(); expect(() => assertNativeArgs(client.observeEnvelope, { handle: f.handle, ...extras })).toThrow();
    });
  it("the original private observation endpoint remains callable and the reactive signal remains payload-free", async () => {
    const f = await fixture();
    const original = await f.call<RuntimeObservation>(runtime.observe, { runId: f.handle.runId }); expect(original.parts).toHaveLength(1);
    const signal = await f.call<Record<string, unknown>>(client.signal, { runId: f.handle.runId });
    expect(Object.keys(signal).sort()).toEqual(["marker", "version"]); expect(signal.marker).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(signal)).not.toMatch(/PRIVATE|runId|parts|approvals/);
  });
  it("execution bookkeeping without a visible change keeps the same opaque invalidation value", async () => {
    const f = await fixture(), first = await f.call(client.signal, { runId: f.handle.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0];
    if (typeof owned.updatedAt !== "number") throw Error("Expected native fixture timestamp");
    owned.updatedAt += 1;
    expect(await f.call(client.signal, { runId: f.handle.runId })).toEqual(first);
    expect((await f.observe()).observation.parts).toEqual([{ sequence: 1, part: { type: "text-delta", text: "PRIVATE_CURRENT_TEXT", id: "text" } }]);
  });
  it("new durable output changes the marker even with fixed timestamps and an unchanged first-page cursor", async () => {
    const f = await fixture(), first = await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId });
    const owned = f.db.table("runtimeAgentExecutions")[0], time = owned.updatedAt;
    if (typeof time !== "number") throw Error("Expected native fixture timestamp");
    jest.spyOn(Date, "now").mockReturnValue(time);
    await f.call(runtime.recordOutput, { reference: f.reference, runId: f.handle.runId, attemptNumber: 1,
      leaseVersion: owned.leaseVersion, parts: [{ type: "text-delta", text: "PRIVATE_NEXT_TEXT", id: "text" }] });
    expect((await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId })).marker).not.toBe(first.marker);
    expect((await f.observe()).observation.parts.map(value => value.sequence)).toEqual([1, 2]);
  });
  it.each(["state", "memory"])("visible %s changes still invalidate with an unchanged update timestamp", async kind => {
    const f = await fixture(), first = await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId });
    if (kind === "state") f.db.table("runtimeAgentExecutions")[0].state = "waiting_approval";
    else f.db.table("runtimeRuns")[0].memoryStatus = "complete";
    expect((await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId })).marker).not.toBe(first.marker);
  });
  it("shortened authority expiry is projected even when the opaque marker is unchanged; revocation still denies", async () => {
    const f = await fixture(), first = await f.call<{ marker: string; deliveryExpiresAt?: number }>(client.signal, { runId: f.handle.runId });
    const expiresAt = Date.now() + 60000; f.grant.expiresAt = expiresAt;
    const next = await f.call<{ marker: string; deliveryExpiresAt?: number }>(client.signal, { runId: f.handle.runId });
    expect(next.marker).toBe(first.marker); expect(next.deliveryExpiresAt).toBe(expiresAt);
    f.grant.revokedAt = Date.now();
    await expect(f.call(client.signal, { runId: f.handle.runId })).rejects.toThrow("FORBIDDEN");
  });
});
