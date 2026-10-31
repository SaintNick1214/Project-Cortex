/** Original registered handlers on the controlled transactional/component fixture.
 * This exercises product guards, not actual Convex OCC, services or cloud timings. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { CortexRuntimeClient } from "../../../src/client-runtime/client";
import type { RuntimeClientPort } from "../../../src/client-runtime/client";
import type { RuntimeObservation, RuntimeRunHandle, RuntimeSession } from "../../../src/client-runtime/types";
import { assertNativeArgs } from "../runtimeAgent/native-arguments";

jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "workflow:offline"; }
} }));
const { installMockRoot, transcriptFixture, runs, invoke, clone } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const client = await import("../../../convex-dev/runtimeClient");
type Envelope = { version: 1; session: RuntimeSession; observation: RuntimeObservation; marker?: string };
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
    handle?: RuntimeRunHandle; acknowledgeSignal?: boolean } = {}) => {
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
  it.each([undefined, false])("old SDK exact-three-field contract remains unchanged without acknowledgement opt-in (%s)", async acknowledgeSignal => {
    const f = await fixture();
    const result = await f.observe(acknowledgeSignal === undefined ? {} : { acknowledgeSignal });
    expect(Object.keys(result).sort()).toEqual(["observation", "session", "version"]);
    expect(result).toEqual({ version: 1, session: await f.call(client.session, {}), observation: await f.call(runtime.observe, { runId: f.handle.runId }) });
    const next = await f.observe({ acknowledgeSignal: true });
    expect(Object.keys(next).sort()).toEqual(["marker", "observation", "session", "version"]);
    expect(next.marker).toBe((await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId })).marker);
    const { marker: _marker, ...originalFields } = next; expect(originalFields).toEqual(result);
  });
  it.each([
    { afterSequence: 0, limit: 1, finalOnly: false }, { afterSequence: 1, limit: 100, finalOnly: false },
    { afterSequence: 0, limit: 100, finalOnly: true }, { afterSequence: 99, limit: 1, finalOnly: true },
  ])("acknowledges the same fixed signal revision for every protected page %#", async options => {
    const f = await fixture(), before = f.snapshot();
    const signal = await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId });
    expect((await f.observe({ ...options, acknowledgeSignal: true })).marker).toBe(signal.marker); expect(f.snapshot()).toEqual(before);
    const execution = f.db.table("runtimeAgentExecutions")[0]; execution.state = "complete";
    const completed = await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId });
    expect(completed.marker).not.toBe(signal.marker); expect((await f.observe({ ...options, acknowledgeSignal: true })).marker).toBe(completed.marker);
    // Both endpoints derive attempt identity from the current run, never a supplied cursor.
    f.db.table("runtimeRuns")[0].attemptNumber = 2;
    const next = await f.call<{ marker: string }>(client.signal, { runId: f.handle.runId });
    expect(next.marker).not.toBe(completed.marker); expect((await f.observe({ ...options, acknowledgeSignal: true })).marker).toBe(next.marker);
  });
  it("reuses raw authority reads within delivery while preserving non-authority order and the raw final fence", async () => {
    const f = await fixture(), originalQuery = f.db.query.bind(f.db), originalGet = f.db.get.bind(f.db);
    const reads: string[] = [];
    f.db.query = table => { reads.push(`query:${table}`); return originalQuery(table); };
    f.db.get = async (table, id) => { reads.push(`get:${table}:${id}`); return await originalGet(table, id); };
    const current = await client.sessionHandler(f.ctx, {}), observation = await runtime.observeHandler(f.ctx, { runId: f.handle.runId });
    const referenceReads = reads.splice(0), actual = await f.observe(), actualReads = reads.splice(0);
    expect(actual.session).toEqual(current); expect(actual.observation).toEqual(observation);
    const isAuthority = (read: string) => /^(query|get):runtimeAuth/.test(read);
    expect(actualReads.filter(read => !isAuthority(read))).toEqual(referenceReads.filter(read => !isAuthority(read)));
    expect(actualReads.filter(isAuthority).length).toBeLessThan(referenceReads.filter(isAuthority).length);
    // Original final delivery authority reads are outside the scoped reader.
    expect(actualReads.slice(-1)).toEqual(referenceReads.slice(-1));
    console.log(JSON.stringify({ controlledObservationReads: { original: referenceReads.length, scoped: actualReads.length,
      originalAuthority: referenceReads.filter(isAuthority).length, scopedAuthority: actualReads.filter(isAuthority).length } }));
  });
  it("K29 compares the accepted K28 envelope helper against the explicit registered snapshot without changing results or raw final denial", async () => {
    const f = await fixture(), query = f.db.query.bind(f.db), get = f.db.get.bind(f.db), reads: string[] = [];
    f.db.query = table => { reads.push(`query:${table}`); return query(table); };
    f.db.get = async (table, id) => { reads.push(`get:${table}:${id}`); return await get(table, id); };
    const expected = await client.observeEnvelopeHandler(f.ctx, { handle: f.handle, acknowledgeSignal: true }), control = reads.splice(0);
    const result = await f.observe({ acknowledgeSignal: true }), actual = reads.splice(0); expect(result).toEqual(expected);
    const isAuthority = (value: string) => /^(get|query):runtimeAuth/.test(value);
    expect(actual.filter(value => !isAuthority(value))).toEqual(control.filter(value => !isAuthority(value)));
    expect(new Set(actual)).toEqual(new Set(control)); expect(actual.length).toBeLessThan(control.length);
    console.log(JSON.stringify({ k29EnvelopeSnapshotReads: { acceptedK28: control.length, current: actual.length,
      acceptedAuthority: control.filter(isAuthority).length, currentAuthority: actual.filter(isAuthority).length } }));
    // This original native endpoint still starts a fresh scope on the next RPC.
    f.grant.revokedAt = Date.now(); await expect(f.observe({ acknowledgeSignal: true })).rejects.toThrow("FORBIDDEN");
  });
  it.each(["malformed_json", "missing_media"])("opaque signal retains original output validation for %s", async kind => {
    const f = await fixture(); f.db.table("runtimeAgentOutput")[0].partCanonical = kind === "malformed_json" ? "{" : JSON.stringify({ type: "media-job", kind: "image", jobId: "missing", artifactId: "missing" });
    const expected = await f.call(runtime.observe, { runId: f.handle.runId, limit: 1, finalOnly: false }).catch(error => error as Error);
    await expect(f.call(client.signal, { runId: f.handle.runId })).rejects.toThrow((expected as Error).message);
  });

  it.each([false, true])("actual SDK and registered endpoints coalesce only acknowledged initial signals (legacy=%s)", async legacy => {
    const f = await fixture(), updates = jest.fn(), errors = jest.fn();
    let notify = (_value: unknown) => {}, release = () => {}, reached = () => {}, completed = () => {}, reads = 0, sessions = 0, closed = false;
    const issued = new Promise<void>(resolve => { reached = resolve; }), delivered = new Promise<void>(resolve => { completed = resolve; });
    const port = {
      setAuth: (_fetch: unknown, changed: (authenticated: boolean) => void) => changed(true),
      mutation: async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
        if (getFunctionName(ref) === "runtimeClient:session") { sessions++; return await f.call(client.session, args); }
        if (getFunctionName(ref) !== "runtimeClient:observeEnvelope") throw Error("UNEXPECTED_NATIVE_CALL");
        const result = await f.observe(args as Parameters<typeof f.observe>[0]);
        if (++reads === 1) { reached(); await new Promise<void>(resolve => { release = resolve; }); }
        if (!legacy) return result;
        const { marker: _marker, ...oldEnvelope } = result; return oldEnvelope;
      },
      onUpdate: (_ref: unknown, _args: unknown, update: (value: unknown) => void) => { notify = update; return () => { closed = true; }; },
      query: async () => { throw Error("PROTECTED_QUERY_FORBIDDEN"); }, action: async () => { throw Error("ACTION_FORBIDDEN"); }, close: async () => {},
    } as unknown as RuntimeClientPort;
    const sdk = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", client: port, fetchToken: async () => "fixture" });
    try {
      const stop = sdk.watchObservation(f.handle, value => { updates(value); if (updates.mock.calls.length === (legacy ? 2 : 1)) completed(); }, errors);
      await issued; expect(reads).toBe(1);
      notify(await f.call(client.signal, { runId: f.handle.runId })); release(); await delivered;
      expect(reads).toBe(legacy ? 2 : 1); expect(sessions).toBe(reads); expect(updates).toHaveBeenCalledTimes(reads);
      expect(updates.mock.calls[0][0]).toMatchObject({ parts: [{ sequence: 1, part: { text: "PRIVATE_CURRENT_TEXT" } }] });
      expect(errors).not.toHaveBeenCalled(); stop(); expect(closed).toBe(true);
    } finally { await sdk.close(); }
  });

});
