import { jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { AuthTokenFetcher } from "convex/browser";
import { CortexRuntimeClient, CortexRuntimeError, runtimeMemoryEffortTrace } from "../../../src/client-runtime/index";
import { emptyMemoryEffortTrace, resolveMemoryEffortPolicy } from "../../../src/domain/memory-effort";
import type { RuntimeClientPort, RuntimeLatencyEvent, RuntimeObservation, RuntimeRecallResult, RuntimeRecallItem, RuntimeRun, RuntimeRunHandle, RuntimeSession } from "../../../src/client-runtime/index";

const verified: RuntimeSession = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "user" };
const value: RuntimeRun = { version: 1, runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1,
  scope: { tenantId: "tenant", memorySpaceId: "space" }, definitionHash: "definition", queueSequence: 1, responseStatus: "running",
  memoryStatus: "pending", graphStatus: "not_requested", attemptNumber: 1, cancellationRequested: false,
  inputMessageIds: ["input"], outputMessageIds: [], failureCode: null, contextCompleteness: "complete", contextFailureCode: null, createdAt: 1, updatedAt: 2 };
const handle: RuntimeRunHandle = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, definitionHash: "definition" };
const request = { version: 1 as const, agentId: "agent", agentVersion: 1, clientRequestId: "request", parts: [{ type: "text" as const, text: "hello" }] };
const envelope = (observation: RuntimeObservation, current: RuntimeSession = verified) => ({ version: 1, session: current, observation });
function fixture(autoAuth = true, onLatencyEvent?: (event: RuntimeLatencyEvent) => void,
  scope: { tenantId?: string; memorySpaceId?: string } = { tenantId: "tenant", memorySpaceId: "space" }) {
  let current: RuntimeSession = verified, privateReads = 0, authCallback = (_value: boolean) => {}, tokenFetcher: AuthTokenFetcher = async () => null;
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const subscriptions: { name: string; args: Record<string, unknown>; update: (value: unknown) => void; error: (error: Error) => void; closed: boolean }[] = [];
  let observe: RuntimeObservation = { run: value, state: "running", parts: [], cursor: 0, approvals: [] };
  const mutation = jest.fn(async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
    const name = getFunctionName(ref); calls.push({ name, args });
    if (name === "runtimeClient:session") return current;
    if (name === "runtimeClient:observeEnvelope") {
      const expected = args.handle as RuntimeRunHandle;
      if (expected.principalId !== current.principalId || expected.tenantId !== current.tenantId || expected.memorySpaceId !== current.memorySpaceId) throw new CortexRuntimeError("SESSION_CHANGED");
      privateReads++; return envelope(observe, current);
    }
    if (name === "runtimeClient:submitAndStartEnvelope") return { version: 1, session: current, admission: { version: 1, run: value, start: { runId: value.runId, attemptNumber: value.attemptNumber, state: "ready" } } };
    if (name === "runtimeMemory:defaultProfile") return { version: 1, profile: { profileId: "profile", dimensions: 1536 } };
    return value;
  });
  const action = jest.fn(async (ref: Parameters<RuntimeClientPort["action"]>[0], args: Record<string, unknown>): Promise<RuntimeRecallResult> => { calls.push({ name: getFunctionName(ref), args }); return { items: [], context: "", profileId: "profile" }; });
  const port = { setAuth: (fetcher: AuthTokenFetcher, callback: (value: boolean) => void) => { tokenFetcher = fetcher; authCallback = callback; if (autoAuth) callback(true); },
    query: jest.fn(async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); }), mutation,
    action,
    onUpdate: (ref: Parameters<RuntimeClientPort["onUpdate"]>[0], args: Record<string, unknown>, update: (value: unknown) => void, error: (error: Error) => void) => {
      const row = { name: getFunctionName(ref), args, update, error, closed: false }; subscriptions.push(row); return () => { row.closed = true; };
    }, close: jest.fn(async () => {}) } as unknown as RuntimeClientPort;
  const fetchToken = jest.fn(async () => "opaque-host-jwt");
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", scope, fetchToken, client: port,
    ...(onLatencyEvent ? { onLatencyEvent } : {}) });
  return { client, port, mutation, action, calls, subscriptions, fetchToken, authenticate: (status: boolean) => authCallback(status), token: (forceRefreshToken: boolean) => tokenFetcher({ forceRefreshToken }),
    automaticAuth: (enabled: boolean) => { autoAuth = enabled; },
    session: (next: RuntimeSession) => { current = next; }, observation: (next: RuntimeObservation) => { observe = next; }, privateReads: () => privateReads };
}
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
describe("browser remote runtime client", () => {
  it("opt-in latency events expose only fixed scalars and pair unique native RPC IDs without extra calls or changed receiver ownership", async () => {
    const events: RuntimeLatencyEvent[] = [], f = fixture(true, event => { events.push(event); });
    try {
      expect(await f.token(true)).toBe("opaque-host-jwt");
      await f.client.submitAndStart({ ...request, parts: [{ type: "text", text: "PRIVATE_PROMPT_TRACE_SENTINEL" }] });
      expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:submitAndStartEnvelope", "runtimeClient:session"]);
      expect(events.slice(0, 2).map(event => event.phase)).toEqual(["auth.begin", "auth.ready"]);
      const begins = events.filter(event => event.phase === "rpc.begin"), ends = events.filter(event => event.phase === "rpc.end");
      expect(begins.map(event => event.rpcId)).toEqual([1, 2]); expect(ends.map(event => event.rpcId)).toEqual([1, 2]);
      expect(begins.map(event => event.method)).toEqual(f.calls.map(call => call.name));
      for (const event of events) {
        expect(Object.isFrozen(event)).toBe(true);
        expect(Object.keys(event).every(key => ["version", "phase", "atMs", "rpcId", "method", "durationMs"].includes(key))).toBe(true);
        expect(Object.values(event).every(value => typeof value === "string" || typeof value === "number")).toBe(true);
        expect(Number.isFinite(event.atMs)).toBe(true);
      }
      expect(events.every((event, index) => index === 0 || event.atMs >= events[index - 1].atMs)).toBe(true);
      expect(ends.every((event, index) => event.durationMs === event.atMs - begins[index].atMs && event.durationMs >= 0)).toBe(true);
      const serialized = JSON.stringify(events);
      for (const value of ["PRIVATE_PROMPT_TRACE_SENTINEL", "opaque-host-jwt", "tenant", "space", "owner", "definition"]) expect(serialized).not.toContain(value);
      expect(f.mutation.mock.contexts.every(receiver => receiver === f.port)).toBe(true);
    } finally { await f.client.close(); }
    expect(f.port.close).not.toHaveBeenCalled();
  });
  it("opt-in failed RPC/auth and watcher-wake events never copy signal, output or diagnostics", async () => {
    const events: RuntimeLatencyEvent[] = [], f = fixture(true, event => { events.push(event); });
    f.observation({ run: value, state: "running", parts: [{ sequence: 1, part: { type: "text-delta", text: "PRIVATE_OUTPUT_TRACE_SENTINEL" } }], cursor: 1, approvals: [] });
    const close = f.client.watchObservation(handle, () => {}); await tick();
    f.subscriptions[0].update({ version: 1, marker: "a".repeat(64) }); await tick(); close();
    f.mutation.mockRejectedValueOnce(new Error("PRIVATE_ERROR_TRACE_SENTINEL"));
    await expect(f.client.session()).rejects.toMatchObject({ code: "TRANSPORT_ERROR", outcome: "uncertain" });
    f.authenticate(false);
    expect(events.filter(event => event.phase === "watcher.wake")).toMatchObject([{ method: "runtimeClient:observeEnvelope" }, { method: "runtimeClient:observeEnvelope" }]);
    expect(events.filter(event => event.phase === "rpc.failed")).toMatchObject([{ method: "runtimeClient:session", rpcId: 5, durationMs: expect.any(Number) }]);
    expect(events.at(-1)?.phase).toBe("auth.denied");
    const serialized = JSON.stringify(events);
    for (const value of ["PRIVATE_OUTPUT_TRACE_SENTINEL", "PRIVATE_ERROR_TRACE_SENTINEL", "a".repeat(64), "TRANSPORT_ERROR", "UNAUTHENTICATED"]) expect(serialized).not.toContain(value);
    const count = events.length; f.subscriptions[0].update({ version: 1, marker: "b".repeat(64) }); await tick(); expect(events).toHaveLength(count);
    await f.client.close();
  });
  it("governed action tracing preserves fresh session fences and the official receiver without recall payloads", async () => {
    const events: RuntimeLatencyEvent[] = [], f = fixture(true, event => { events.push(event); });
    f.action.mockResolvedValueOnce({ items: [], context: "PRIVATE_RECALL_RESULT_TRACE_SENTINEL", profileId: "profile" });
    expect(await f.client.recall({ text: "PRIVATE_RECALL_INPUT_TRACE_SENTINEL", requestId: "request" })).toMatchObject({ context: "PRIVATE_RECALL_RESULT_TRACE_SENTINEL" });
    expect(events.filter(event => event.phase === "rpc.begin").map(event => event.method)).toEqual(["runtimeClient:session", "runtimeMemory:recall", "runtimeClient:session"]);
    expect(f.action).toHaveBeenCalledTimes(1); expect(f.mutation).toHaveBeenCalledTimes(2);
    expect(f.action.mock.contexts).toEqual([f.port]); expect(JSON.stringify(events)).not.toMatch(/PRIVATE_RECALL/);
    await f.client.close(); expect(f.port.close).not.toHaveBeenCalled();
  });
  it.each(["sync", "async"])("a failing %s diagnostic callback cannot alter guarded admission or shared-client closure", async mode => {
    const callback = mode === "sync" ? () => { throw new Error("diagnostic failure"); } : async () => { throw new Error("diagnostic failure"); };
    // Exercise a host accidentally violating the synchronous callback type.
    const f = fixture(true, callback as (event: RuntimeLatencyEvent) => void); expect((await f.client.submitAndStart(request)).handle).toEqual(handle); await tick();
    expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:submitAndStartEnvelope", "runtimeClient:session"]);
    await f.client.close(); expect(f.port.close).not.toHaveBeenCalled();
  });
  it("diagnostic clock failure uses a finite monotonic fallback without changing admission", async () => {
    const clock = jest.spyOn(performance, "now").mockImplementation(() => { throw new Error("clock unavailable"); });
    const wall = jest.spyOn(Date, "now").mockReturnValueOnce(100).mockReturnValueOnce(90).mockReturnValue(80);
    const events: RuntimeLatencyEvent[] = [];
    try {
      const f = fixture(true, event => { events.push(event); }); expect((await f.client.submitAndStart(request)).handle).toEqual(handle);
      expect(events.every(event => Number.isFinite(event.atMs) && event.atMs >= 100)).toBe(true);
      expect(events.filter(event => event.phase === "rpc.end").every(event => event.durationMs === 0)).toBe(true);
      await f.client.close();
    } finally { clock.mockRestore(); wall.mockRestore(); }
  });
  it("uses native pre-session admission and fresh post-session RPCs before attaching the durable watcher", async () => {
    const f = fixture();
    const result = await f.client.submitAndStart(request, { streaming: false });
    expect(result).toEqual({ handle, run: value, start: { runId: "run", attemptNumber: 1, state: "ready" } });
    expect(Object.isFrozen(result.handle)).toBe(true);
    expect(f.calls).toEqual([
      { name: "runtimeClient:submitAndStartEnvelope", args: { tenantId: "tenant", memorySpaceId: "space", request, streaming: false } },
      { name: "runtimeClient:session", args: { tenantId: "tenant", memorySpaceId: "space" } },
    ]);
    expect(f.subscriptions).toHaveLength(0);
    const close = f.client.watchObservation(result.handle, () => {}); await tick();
    expect(f.subscriptions[0].name).toBe("runtimeClient:signal");
    expect(f.calls.filter(call => call.name === "runtimeClient:observeEnvelope")).toHaveLength(1);
    expect(f.calls.some(call => ["runs:submit", "runs:get", "runtimeAgent:start"].includes(call.name))).toBe(false);
    close(); await f.client.close();
  });
  it.each([
    { version: 1, run: { ...value, agentId: "foreign" }, start: { runId: "run", attemptNumber: 1, state: "ready" } },
    { version: 1, run: value, start: { runId: "foreign", attemptNumber: 1, state: "ready" } },
    { version: 1, run: value, start: { runId: "run", attemptNumber: 2, state: "ready" } },
    { version: 1, run: { ...value, scope: { tenantId: "foreign", memorySpaceId: "space" } }, start: { runId: "run", attemptNumber: 1, state: "ready" } },
    { version: 1, run: value, start: { runId: "run", attemptNumber: 1, state: "invented" } },
    { version: 1, run: value, start: { runId: "run", attemptNumber: 1, state: "ready", model: "override" } },
    { version: 1, run: { ...value, privateOutput: "must not deliver" }, start: { runId: "run", attemptNumber: 1, state: "ready" } },
  ])("withholds changed or unknown combined output identity %#", async response => {
    const f = fixture(), fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => getFunctionName(ref) === "runtimeClient:submitAndStartEnvelope" ? { version: 1, session: verified, admission: response } as never : await fresh(ref, args));
    const pending = f.client.submitAndStart(request);
    await expect(pending).rejects.toBeInstanceOf(CortexRuntimeError);
    await expect(pending).rejects.toMatchObject({ outcome: "uncertain" });
    expect(f.calls.filter(call => call.name === "runtimeClient:session")).toHaveLength(1);
    expect(f.subscriptions).toEqual([]); await f.client.close();
  });
  it.each([{ streaming: "false" }, { model: "unsafe" }, { context: "injected" }])("refuses combined execution override before RPC %#", async options => {
    const f = fixture(); await expect(f.client.submitAndStart(request, options as never)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(f.calls).toEqual([]); await f.client.close();
  });
  it.each([
    { version: 2, session: verified, admission: {} },
    { version: 1, session: verified, admission: {}, privateOutput: "must not deliver" },
    { version: 1, session: { ...verified, authority: "caller claim" }, admission: {} },
  ])("withholds malformed native admission envelope %# without installing an observer", async raw => {
    const f = fixture(), fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => getFunctionName(ref) === "runtimeClient:submitAndStartEnvelope" ? raw as never : await fresh(ref, args));
    await expect(f.client.submitAndStart(request)).rejects.toMatchObject({ code: "INVALID_RESPONSE", outcome: "uncertain" });
    expect(f.subscriptions).toEqual([]); await f.client.close();
  });
  it("preserves omitted selectors for native ambiguity checks rather than deriving them from a returned handle", async () => {
    const f = fixture(true, undefined, {});
    expect((await f.client.submitAndStart(request)).handle).toEqual(handle);
    expect(f.calls).toEqual([
      { name: "runtimeClient:submitAndStartEnvelope", args: { request, streaming: true } },
      { name: "runtimeClient:session", args: {} },
    ]);
    await f.client.close();
  });
  it("withholds a valid admission paired with a different claimed native actor at its independent post-I/O fence", async () => {
    const f = fixture(), fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => {
      const result = await fresh(ref, args);
      return getFunctionName(ref) === "runtimeClient:submitAndStartEnvelope"
        ? { ...(result as object), session: { ...verified, principalId: "foreign" } } as never : result;
    });
    await expect(f.client.submitAndStart(request)).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" });
    expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:submitAndStartEnvelope", "runtimeClient:session"]);
    expect(f.subscriptions).toEqual([]); await f.client.close();
  });
  it.each([
    { ...verified, principalId: "foreign" }, { ...verified, memorySpaceId: "foreign" }, { ...verified, tenantId: "foreign" },
  ])("retains the fresh post-I/O combined session fence %#", async changed => {
    const f = fixture(), fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => { const result = await fresh(ref, args);
      if (getFunctionName(ref) === "runtimeClient:submitAndStartEnvelope") f.session(changed); return result; });
    await expect(f.client.submitAndStart(request)).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" });
    expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:submitAndStartEnvelope", "runtimeClient:session"]);
    await f.client.close();
  });
  it("withholds admission after time-only grant expiry during its post-I/O session read", async () => {
    const f = fixture(), fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => { const result = await fresh(ref, args);
      if (getFunctionName(ref) === "runtimeClient:submitAndStartEnvelope") f.session({ ...verified, deliveryExpiresAt: Date.now() - 1 }); return result; });
    await expect(f.client.submitAndStart(request)).rejects.toMatchObject({ code: "AUTHORITY_EXPIRED", outcome: "uncertain" });
    expect(f.subscriptions).toEqual([]); await f.client.close();
  });
  it("withholds a recalled result whose source authority expired during action delivery", async () => {
    const f = fixture(); f.action.mockResolvedValueOnce({ items: [], context: "private source", profileId: "profile", deliveryExpiresAt: Date.now() - 1 } as never);
    await expect(f.client.recall({ text: "facts", requestId: "source-expired" })).rejects.toMatchObject({ code: "AUTHORITY_EXPIRED" });
    expect(f.action).toHaveBeenCalledTimes(1); await f.client.close();
  });
  it("sends exact v1 text and verified outer selectors; pins the server run", async () => {
    const f = fixture(); expect(await f.client.submit(request)).toEqual(handle);
    expect(f.calls.find(call => call.name === "runs:submit")).toEqual({ name: "runs:submit", args: { request, tenantId: "tenant", memorySpaceId: "space" } });
    expect(Object.isFrozen(await f.client.attach("run"))).toBe(true);
    await f.client.start(handle); expect(f.calls.find(call => call.name === "runtimeAgent:start")).toEqual({ name: "runtimeAgent:start", args: { tenantId: "tenant", memorySpaceId: "space", runId: "run", streaming: true } });
    await f.client.close(); expect(f.port.close).not.toHaveBeenCalled();
  });
  it.each([
    { ...request, authority: {} }, { ...request, parts: [{ type: "file", url: "secret" }] }, { ...request, parts: [{ type: "text", text: "hello", model: "unsafe" }] },
    { ...request, agentVersion: 0 }, { ...request, clientRequestId: "x".repeat(129) }, { ...request, parts: [{ type: "text", text: "\ud800" }] },
    { ...request, parts: [{ type: "text", text: "x".repeat(120001) }] }, { ...request, parts: new Array(1) },
  ])("denies invalid public graph before session or mutation %#", async input => {
    const f = fixture(); await expect(f.client.submit(input as never)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(f.client.submitAndStart(input as never)).rejects.toMatchObject({ code: "INVALID_INPUT" }); expect(f.calls).toEqual([]);
  });
  it("does not invoke input getters", async () => {
    const f = fixture(), getter = jest.fn(() => "secret"); const input = { ...request };
    Object.defineProperty(input, "agentId", { enumerable: true, get: getter });
    await expect(f.client.submit(input)).rejects.toMatchObject({ code: "INVALID_INPUT" }); expect(getter).not.toHaveBeenCalled();
  });
  it("accepts ordered unicode text parts without normalization or history resend", async () => {
    const f = fixture(); const input = { ...request, parts: [{ type: "text" as const, text: "e\u0301" }, { type: "text" as const, text: "😀\r\n" }] };
    await f.client.submit(input); expect(f.calls.find(call => call.name === "runs:submit")?.args.request).toEqual(input);
  });
  it("awaits official initial auth and refresh acceptance, propagates force refresh unchanged", async () => {
    const f = fixture(false); const settled = jest.fn(); const pending = f.client.session().then(settled);
    await tick(); expect(f.calls).toHaveLength(0); expect(await f.token(true)).toBe("opaque-host-jwt"); expect(f.fetchToken).toHaveBeenCalledWith({ forceRefreshToken: true });
    f.authenticate(true); await pending; expect(settled).toHaveBeenCalledWith(verified);
    const refreshed = f.client.refreshAuth(); const query = f.client.session(); const prior = f.calls.length; await tick(); expect(f.calls).toHaveLength(prior);
    f.authenticate(true); await refreshed; await query;
  });
  it("rejects failed refresh and closes all active observations before late signals", async () => {
    const f = fixture(), updates = jest.fn(), error = jest.fn(); f.client.watchRun(handle, updates, error); await tick(); updates.mockClear();
    expect(f.subscriptions).toHaveLength(1); expect(f.subscriptions[0].name).toBe("runtimeClient:signal");
    f.automaticAuth(false); const pending = f.client.refreshAuth(); f.authenticate(false);
    await expect(pending).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    f.subscriptions[0].update({ version: 1, marker: "a".repeat(64) }); await tick();
    expect(updates).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "UNAUTHENTICATED" }));
    expect(f.subscriptions.every(row => row.closed)).toBe(true); await f.client.close();
  });
  it.each([{ ...verified, principalId: "other" }, { ...verified, tenantId: "foreign" }, { ...verified, memorySpaceId: "foreign" }])("denies pinned handle on changed verified session %#", async next => {
    const f = fixture(); f.session(next); await expect(f.client.cancel(handle)).rejects.toMatchObject({ code: "SESSION_CHANGED" }); expect(f.calls.some(call => call.name === "runtimeAgent:cancel")).toBe(false);
  });
  it("passes current pinned definition and exact approval hash; no caller tool payload", async () => {
    const f = fixture(); await f.client.approveInput(handle); await f.client.approveTool(handle, { operationId: "op", requestHash: "hash", toolName: "memory_remember" });
    expect(f.calls.filter(call => call.name === "runs:approve" || call.name === "runtimeAgent:approveTool")).toEqual([
      { name: "runs:approve", args: { tenantId: "tenant", memorySpaceId: "space", runId: "run", expectedDefinitionHash: "definition" } },
      { name: "runtimeAgent:approveTool", args: { tenantId: "tenant", memorySpaceId: "space", runId: "run", operationId: "op", expectedRequestHash: "hash" } },
    ]);
  });
  it("routes default metadata and recall through governed registered action only", async () => {
    const f = fixture(); await f.client.getDefaultProfile(); expect(await f.client.recall({ text: "facts", requestId: "recall-key", limit: 5 })).toEqual({ items: [], context: "", profileId: "profile" });
    expect(f.calls.find(call => call.name === "runtimeMemory:recall")).toEqual({ name: "runtimeMemory:recall", args: { tenantId: "tenant", memorySpaceId: "space", text: "facts", requestId: "recall-key", limit: 5 } });
  });
  it("resets one-shot old-attempt cursor before reading replacement output", async () => {
    const f = fixture(); f.observation({ run: { ...value, attemptNumber: 2 }, state: "running", parts: [], cursor: 50, approvals: [] });
    await f.client.observe(handle, { cursor: { attemptNumber: 1, sequence: 50 } });
    expect(f.calls.filter(call => call.name === "runtimeClient:observeEnvelope").map(call => call.args.afterSequence)).toEqual([50, 0]);
    expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:observeEnvelope", "runtimeClient:session", "runtimeClient:observeEnvelope", "runtimeClient:session"]);
  });
  it("one-shot private observation sends the original configured selectors and has a separate fresh post-session", async () => {
    const f = fixture();
    try {
      expect(await f.client.observe(handle, { finalOnly: true, limit: 17 })).toMatchObject({ run: value, parts: [] });
      expect(f.calls).toEqual([
        { name: "runtimeClient:observeEnvelope", args: { tenantId: "tenant", memorySpaceId: "space", handle, afterSequence: 0, finalOnly: true, limit: 17 } },
        { name: "runtimeClient:session", args: { tenantId: "tenant", memorySpaceId: "space" } },
      ]);
      expect(f.port.query).not.toHaveBeenCalled(); expect(f.action).not.toHaveBeenCalled();
    } finally { await f.client.close(); }
  });
  it("an omitted client scope stays omitted in both envelope and independent post-session", async () => {
    const f = fixture(true, undefined, {});
    try {
      await f.client.observe(handle);
      expect(f.calls.map(call => call.args)).toEqual([{ handle, afterSequence: 0, limit: 100, finalOnly: false }, {}]);
    } finally { await f.client.close(); }
  });
  it.each([
    { version: 2, session: verified, observation: { run: value, state: "running", parts: [], cursor: 0, approvals: [] } },
    { version: 1, session: verified, observation: { run: value, state: "running", parts: [], cursor: 0, approvals: [] }, extra: "PRIVATE" },
    { version: 1, session: { ...verified, privateGrant: "PRIVATE" }, observation: { run: value, state: "running", parts: [], cursor: 0, approvals: [] } },
    { version: 1, session: verified, observation: { run: value, state: "running", parts: [], cursor: 0, approvals: [], privateContext: "PRIVATE" } },
  ])("rejects an unknown private envelope contract before any callback %#", async response => {
    const f = fixture(), update = jest.fn(), error = jest.fn(), fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => getFunctionName(ref) === "runtimeClient:observeEnvelope" ? response as never : await fresh(ref, args));
    try {
      f.client.watchObservation(handle, update, error); await tick();
      expect(update).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_RESPONSE", outcome: "uncertain" }));
      expect(f.subscriptions.every(row => row.closed)).toBe(true);
    } finally { await f.client.close(); }
  });
  it.each(["principal", "tenant", "space", "revoked"])("withholds private output after fresh post-session %s change", async kind => {
    const f = fixture(), updates = jest.fn(), error = jest.fn(), fresh = f.mutation.getMockImplementation()!;
    f.observation({ run: value, state: "running", parts: [{ sequence: 1, part: { type: "text", text: "PRIVATE" } }], cursor: 1, approvals: [] });
    let issued = false;
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) === "runtimeClient:session" && issued && kind === "revoked") throw { data: { code: "FORBIDDEN", outcome: "not_dispatched" } };
      const result = await fresh(ref, args);
      if (getFunctionName(ref) === "runtimeClient:observeEnvelope") {
        issued = true;
        if (kind !== "revoked") f.session({ ...verified, ...(kind === "principal" ? { principalId: "other" } : kind === "tenant" ? { tenantId: "other" } : { memorySpaceId: "other" }) });
      }
      return result;
    });
    try {
      f.client.watchObservation(handle, updates, error); await tick();
      expect(updates).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: kind === "revoked" ? "FORBIDDEN" : "SESSION_CHANGED", outcome: "uncertain" }));
      expect(f.calls.filter(call => call.name === "runtimeClient:observeEnvelope")).toHaveLength(1);
      expect(f.subscriptions.every(row => row.closed)).toBe(true);
    } finally { await f.client.close(); }
  });
  it("suppresses an observer disposed while the separate post-session is still in flight", async () => {
    const f = fixture(), update = jest.fn(), fresh = f.mutation.getMockImplementation()!; let release = (_value: unknown) => {};
    f.mutation.mockImplementation(async (ref, args) => getFunctionName(ref) === "runtimeClient:session"
      ? await new Promise<unknown>(resolve => { release = resolve; }) as never : await fresh(ref, args));
    const stop = f.client.watchObservation(handle, update); await tick();
    expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:observeEnvelope"]);
    stop(); release(verified); await tick();
    expect(update).not.toHaveBeenCalled(); expect(f.subscriptions.every(row => row.closed)).toBe(true); await f.client.close();
  });
  it("reauthentication abandons an old envelope, reacquires current output, and ignores the old late response", async () => {
    const f = fixture(), updates = jest.fn(), fresh = f.mutation.getMockImplementation()!; let release = (_value: unknown) => {}, reads = 0;
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) === "runtimeClient:observeEnvelope" && ++reads === 1) return await new Promise<unknown>(resolve => { release = resolve; }) as never;
      return await fresh(ref, args);
    });
    const stop = f.client.watchObservation(handle, updates); await tick();
    await f.client.refreshAuth(); await tick();
    expect(reads).toBe(2); expect(updates).toHaveBeenCalledTimes(1);
    release(envelope({ run: value, state: "running", parts: [{ sequence: 1, part: { type: "text", text: "OLD_PRIVATE" } }], cursor: 1, approvals: [] })); await tick();
    expect(updates).toHaveBeenCalledTimes(1); expect(JSON.stringify(updates.mock.calls)).not.toContain("OLD_PRIVATE");
    stop(); await f.client.close();
  });
  it("drains fresh cursor pages once, reacts to approvals, and resets replacement attempt", async () => {
    const f = fixture(), updates = jest.fn<(value: RuntimeObservation) => void>();
    f.observation({ run: value, state: "running", parts: Array.from({ length: 100 }, (_, i) => ({ sequence: i + 1, part: { type: "text-delta", text: "a" } })), cursor: 100, approvals: [] });
    // The server page advances only after the first 100-part read. No cached payload is consulted.
    let pages = 0; const fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) === "runtimeClient:observeEnvelope" && pages++ > 0) return envelope({ run: value, state: "running", parts: [], cursor: 100, approvals: [] }) as never;
      return await fresh(ref, args);
    });
    const close = f.client.watchObservation(handle, updates); await tick();
    expect(updates.mock.calls[0][0].parts).toHaveLength(100); expect(f.subscriptions[0].closed).toBe(true);
    expect(f.calls.filter(call => call.name === "runtimeClient:observeEnvelope").map(call => call.args.afterSequence)).toEqual([0]);
    // Replacement sends an exhausted old cursor first, then drains from zero.
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) !== "runtimeClient:observeEnvelope") return await fresh(ref, args);
      f.calls.push({ name: getFunctionName(ref), args });
      return envelope(args.afterSequence === 0 ? { run: { ...value, attemptNumber: 2 }, state: "waiting_approval", parts: [{ sequence: 1, part: { type: "artifact", kind: "memory-receipt", artifactId: "receipt" } }], cursor: 1, approvals: [{ operationId: "op", toolName: "memory_remember", requestHash: "hash" }] }
        : { run: { ...value, attemptNumber: 2 }, state: "running", parts: [], cursor: 100, approvals: [] }) as never;
    });
    f.subscriptions.at(-1)!.update({ version: 1, marker: "b".repeat(64) }); await tick();
    expect(f.calls.filter(call => call.name === "runtimeClient:observeEnvelope").map(call => call.args.afterSequence)).toEqual([0, 100, 0]);
    expect(updates.mock.calls.at(-1)?.[0]).toMatchObject({ cursor: 1, approvals: [{ requestHash: "hash" }] });
    close(); expect(f.subscriptions.every(row => row.closed)).toBe(true);
    expect(f.calls.some(call => call.name === "runtimeAgent:cancel")).toBe(false); expect(f.port.query).not.toHaveBeenCalled(); await f.client.close();
  });
  it("reads the current cursor after a short page and drains over 100 terminal parts without filtered-duplicate early completion", async () => {
    const f = fixture(), updates: RuntimeObservation[] = [], reads: number[] = [], fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) !== "runtimeClient:observeEnvelope") return await fresh(ref, args);
      f.calls.push({ name: getFunctionName(ref), args });
      reads.push(args.afterSequence as number);
      const start = args.afterSequence as number;
      const events = start === 0 ? [{ sequence: 1, part: { type: "text-delta", text: "a" } }, { sequence: 2, part: { type: "text-delta", text: "a" } }]
        : start === 2 ? Array.from({ length: 100 }, (_, i) => ({ sequence: i + 3, part: { type: "text-delta", text: "a" } }))
        : [{ sequence: 103, part: { type: "text", text: "a".repeat(102) } }, { sequence: 104, part: { type: "status", state: "complete" } }];
      return envelope({ run: { ...value, responseStatus: start === 0 ? "running" : "complete" }, state: start === 0 ? "running" : "complete", parts: events,
        cursor: events.at(-1)!.sequence, approvals: [] } as RuntimeObservation) as never;
    });
    let stop = () => {};
    stop = f.client.watchObservation(handle, observed => {
      updates.push(observed);
      if (observed.run.responseStatus === "complete" && observed.parts.length < 100) stop();
    }, undefined, { cursor: { attemptNumber: 1, sequence: 0 } });
    await tick(); expect(reads).toEqual([0]);
    f.subscriptions.at(-1)!.update({ version: 1, marker: "a".repeat(64) }); await tick(); await tick();
    expect(reads).toEqual([0, 2, 102]);
    expect(updates.map(observed => observed.parts.length)).toEqual([2, 100, 2]);
    const events = updates.flatMap(observed => observed.parts);
    expect(events.map(event => event.sequence)).toEqual(Array.from({ length: 104 }, (_, i) => i + 1));
    expect(events.filter(event => event.part.type === "text-delta")).toHaveLength(102);
    expect(f.subscriptions.every(subscription => subscription.closed)).toBe(true);
    expect(f.calls.filter(call => call.name === "runtimeClient:session")).toHaveLength(3);
    expect(f.calls.filter(call => call.name === "runtimeClient:observeEnvelope")).toHaveLength(3); await f.client.close();
  });
  it("fences a changed verified principal before fresh reactive payload delivery", async () => {
    const f = fixture(), update = jest.fn(), error = jest.fn(); f.session({ ...verified, principalId: "other" });
    f.client.watchRun(handle, update, error); await tick();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "SESSION_CHANGED" })); expect(update).not.toHaveBeenCalled();
    expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:observeEnvelope"]); expect(f.privateReads()).toBe(0);
    expect(f.port.query).not.toHaveBeenCalled(); await f.client.close();
  });
  it("withholds typed backend error details and never exposes provider diagnostics", async () => {
    const f = fixture(); jest.mocked(f.port.mutation).mockRejectedValueOnce({ data: { version: 1, code: "FORBIDDEN", message: "secret-token", outcome: "not_dispatched" } });
    await expect(f.client.session()).rejects.toEqual(new CortexRuntimeError("FORBIDDEN"));
    jest.mocked(f.port.mutation).mockRejectedValueOnce(new Error("private provider credentials"));
    await expect(f.client.session()).rejects.toMatchObject({ message: "Cortex runtime: TRANSPORT_ERROR", outcome: "uncertain" });
  });
  it.each(["get", "attach", "messages", "listConversations", "getDefinition", "getDefaultProfile", "recall", "submitAndStart"] as const)("withholds async %s delivery when auth changes principal while response is in flight", async method => {
    const f = fixture(); let release = (_value: unknown) => {}, started = () => {};
    const ready = new Promise<void>(resolve => { started = resolve; }); const response = new Promise<unknown>(resolve => { release = resolve; });
    const target = { get: "runs:get", attach: "runs:get", messages: "runtimeTranscript:messages", listConversations: "runtimeTranscript:list",
      getDefinition: "agentDefinitions:get", getDefaultProfile: "runtimeMemory:defaultProfile", recall: "runtimeMemory:recall", submitAndStart: "runtimeClient:submitAndStartEnvelope" }[method];
    f.mutation.mockImplementation(async (ref, _args) => { if (getFunctionName(ref) === "runtimeClient:session") return verified;
      if (getFunctionName(ref) === target) { started(); return await response as RuntimeRun; } return value; });
    if (method === "recall") f.action.mockImplementation(async () => { started(); await response; return { items: [], context: "", profileId: "profile" }; });
    const calls = { get: () => f.client.get(handle), attach: () => f.client.attach("run"), messages: () => f.client.messages("conversation"), listConversations: () => f.client.listConversations(),
      getDefinition: () => f.client.getDefinition("agent", 1), getDefaultProfile: () => f.client.getDefaultProfile(), recall: () => f.client.recall({ text: "private", requestId: "r" }), submitAndStart: () => f.client.submitAndStart(request) };
    const pending = calls[method](); await ready; f.session({ ...verified, principalId: "other" }); await f.client.refreshAuth(); release(value);
    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" });
  });
  it("forwards verified tenant selector to definition query", async () => {
    const f = fixture(); await f.client.getDefinition("agent", 1);
    expect(f.calls.find(call => call.name === "agentDefinitions:get")?.args).toEqual({ tenantId: "tenant", memorySpaceId: "space", agentId: "agent", version: 1 });
  });
  it("bounds a silent official expired-auth rejection and fences a late acceptance", async () => {
    jest.useFakeTimers();
    try {
      const f = fixture(false), changed = jest.fn();
      const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", fetchToken: f.fetchToken, client: f.port, authTimeoutMs: 25, onAuthChange: changed });
      const pending = client.refreshAuth(); const assertion = expect(pending).rejects.toMatchObject({ code: "AUTHENTICATION_TIMEOUT", outcome: "not_dispatched" });
      await jest.advanceTimersByTimeAsync(25); await assertion;
      f.authenticate(true); await expect(client.session()).rejects.toMatchObject({ code: "AUTHENTICATION_TIMEOUT" });
      expect(changed).toHaveBeenLastCalledWith(false); expect(f.calls).toHaveLength(0); await client.close(); await f.client.close();
    } finally { jest.useRealTimers(); }
  });
  it("clears a live observation on the server's time-only delivery deadline", async () => {
    jest.useFakeTimers();
    try {
      const f = fixture(), update = jest.fn(), error = jest.fn();
      f.observation({ run: value, state: "running", parts: [], cursor: 0, approvals: [], deliveryExpiresAt: Date.now() + 40 });
      f.client.watchObservation(handle, update, error); await tick(); expect(update).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(40);
      expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTHORITY_EXPIRED" })); expect(f.subscriptions.every(row => row.closed)).toBe(true);
      f.subscriptions[0].update({ version: 1, marker: "a".repeat(64) }); await tick(); expect(update).toHaveBeenCalledTimes(1); await f.client.close();
    } finally { jest.useRealTimers(); }
  });
  it("rejects a payload-bearing signal and never treats its cached text as output", async () => {
    const f = fixture(), update = jest.fn(), error = jest.fn(); f.client.watchObservation(handle, update, error); await tick(); update.mockClear();
    f.subscriptions[0].update({ version: 1, marker: "a".repeat(64), text: "CACHED_PRIVATE_PAYLOAD" }); await tick();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_RESPONSE" })); expect(update).not.toHaveBeenCalled();
    expect(f.port.query).not.toHaveBeenCalled(); await f.client.close();
  });
  it("coalesces signal bursts and suppresses an in-flight payload after observer disposal", async () => {
    const f = fixture(), update = jest.fn(); let release = (_value: unknown) => {}, reads = 0;
    const fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) === "runtimeClient:observeEnvelope") { reads++; return await new Promise<unknown>(resolve => { release = resolve; }) as never; }
      return await fresh(ref, args);
    });
    const close = f.client.watchObservation(handle, update); await tick();
    for (let i = 0; i < 20; i++) f.subscriptions[0].update({ version: 1, marker: "a".repeat(64) });
    await tick(); expect(reads).toBe(1); close(); release(envelope({ run: value, state: "running", parts: [], cursor: 0, approvals: [] })); await tick();
    expect(update).not.toHaveBeenCalled(); expect(reads).toBe(1); expect(f.calls.some(call => call.name === "runtimeAgent:cancel")).toBe(false); await f.client.close();
  });

  it("bounds a stalled private envelope and never delivers or redispatches its late payload", async () => {
    jest.useFakeTimers();
    try {
      const f = fixture(), fresh = f.mutation.getMockImplementation()!; let release = (_value: unknown) => {}, issued = 0;
      f.mutation.mockImplementation(async (ref, args) => {
        if (getFunctionName(ref) === "runtimeClient:observeEnvelope") { issued++; return await new Promise<unknown>(resolve => { release = resolve; }) as never; }
        return await fresh(ref, args);
      });
      const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", fetchToken: f.fetchToken, client: f.port, requestTimeoutMs: 30 });
      const pending = client.observe(handle), delivered = jest.fn(); void pending.then(delivered, () => {});
      const assertion = expect(pending).rejects.toMatchObject({ code: "RPC_DEADLINE_EXCEEDED", outcome: "uncertain" });
      await tick(); await jest.advanceTimersByTimeAsync(30); await assertion; expect(issued).toBe(1);
      release(envelope({ run: value, state: "running", parts: [{ sequence: 1, part: { type: "text", text: "LATE_PRIVATE" } }], cursor: 1, approvals: [] })); await tick();
      expect(delivered).not.toHaveBeenCalled(); expect(issued).toBe(1); expect(f.calls).toEqual([]); expect(f.subscriptions).toEqual([]);
      await client.close(); await f.client.close();
    } finally { jest.useRealTimers(); }
  });

  it.each(["submit", "submitAndStart"] as const)("bounds stalled %s, retains its late outcome and never redispatches", async method => {
    jest.useFakeTimers();
    try {
      const f = fixture(); let release = (_value: unknown) => {}, issued = 0;
      const fresh = f.mutation.getMockImplementation()!;
      f.mutation.mockImplementation(async (ref, args) => {
        if (getFunctionName(ref) === (method === "submit" ? "runs:submit" : "runtimeClient:submitAndStartEnvelope")) { issued++; return await new Promise<unknown>(resolve => { release = resolve; }) as never; }
        return await fresh(ref, args);
      });
      const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", fetchToken: f.fetchToken, client: f.port, requestTimeoutMs: 30 });
      const pending = client[method](request), assertion = expect(pending).rejects.toMatchObject({ code: "RPC_DEADLINE_EXCEEDED", outcome: "uncertain" });
      await tick(); await jest.advanceTimersByTimeAsync(30); await assertion; expect(issued).toBe(1);
      release(value); await tick(); expect(issued).toBe(1); expect(f.calls.some(call => call.name === "runtimeAgent:start" || call.name === "runtimeAgent:cancel")).toBe(false);
      await client.close(); await f.client.close();
    } finally { jest.useRealTimers(); }
  });

  describe("guarded opaque revision acknowledgements", () => {
    const marker = "a".repeat(64), nextMarker = "b".repeat(64);
    const withMarker = (observation: RuntimeObservation, revision = marker) => ({ ...envelope(observation), marker: revision });
    const empty: RuntimeObservation = { run: value, state: "running", parts: [], cursor: 0, approvals: [] };
    it.each(["during delivery", "after delivery"])("coalesces the matching initial signal %s without removing fresh post-session", async timing => {
      const f = fixture(), update = jest.fn(), error = jest.fn(), fresh = f.mutation.getMockImplementation()!;
      let release = (_value: unknown) => {}, reads = 0;
      f.mutation.mockImplementation(async (ref, args) => {
        if (getFunctionName(ref) === "runtimeClient:observeEnvelope") { reads++; return await new Promise<unknown>(resolve => { release = resolve; }) as never; }
        return await fresh(ref, args);
      });
      const close = f.client.watchObservation(handle, update, error); await tick();
      if (timing === "during delivery") f.subscriptions[0].update({ version: 1, marker });
      release(withMarker(empty)); await tick();
      if (timing === "after delivery") f.subscriptions[0].update({ version: 1, marker });
      for (let i = 0; i < 20; i++) f.subscriptions[0].update({ version: 1, marker });
      await tick(); expect(reads).toBe(1); expect(update).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled();
      expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:session"]);
      expect(f.port.query).not.toHaveBeenCalled(); close(); await f.client.close();
    });
    it("a changed revision arriving during the post-session causes a new guarded delivery", async () => {
      const f = fixture(), update = jest.fn(), fresh = f.mutation.getMockImplementation()!;
      let release = (_value: unknown) => {}, reads = 0, sessions = 0;
      f.mutation.mockImplementation(async (ref, args) => {
        if (getFunctionName(ref) === "runtimeClient:observeEnvelope") return withMarker({ ...empty, parts: [{ sequence: ++reads, part: { type: "text-delta", text: String(reads) } }], cursor: reads }, reads === 1 ? marker : nextMarker) as never;
        if (getFunctionName(ref) === "runtimeClient:session" && ++sessions === 1) return await new Promise<unknown>(resolve => { release = resolve; }) as never;
        return await fresh(ref, args);
      });
      const close = f.client.watchObservation(handle, update); await tick();
      f.subscriptions[0].update({ version: 1, marker: nextMarker }); release(verified); await tick();
      expect(reads).toBe(2); expect(sessions).toBe(2); expect(update.mock.calls.map(([row]) => (row as RuntimeObservation).cursor)).toEqual([1, 2]);
      f.subscriptions[0].update({ version: 1, marker: nextMarker }); await tick(); expect(reads).toBe(2);
      close(); await f.client.close();
    });
    it("authentication refresh forces a fresh read even when the revision is acknowledged", async () => {
      const f = fixture(), fresh = f.mutation.getMockImplementation()!, update = jest.fn(); let reads = 0;
      f.mutation.mockImplementation(async (ref, args) => getFunctionName(ref) === "runtimeClient:observeEnvelope" ? (++reads, withMarker(empty)) as never : await fresh(ref, args));
      const close = f.client.watchObservation(handle, update); await tick();
      f.subscriptions[0].update({ version: 1, marker }); await tick(); expect(reads).toBe(1);
      await f.client.refreshAuth(); await tick(); expect(reads).toBe(2); expect(update).toHaveBeenCalledTimes(2);
      expect(f.calls.filter(row => row.name === "runtimeClient:session")).toHaveLength(2); close(); await f.client.close();
    });
    it("a changed expiry with the same marker reacquires and retains time-only expiry cleanup", async () => {
      jest.useFakeTimers();
      try {
        const f = fixture(), fresh = f.mutation.getMockImplementation()!, update = jest.fn(), error = jest.fn(); let reads = 0;
        const expiresAt = Date.now() + 40;
        f.mutation.mockImplementation(async (ref, args) => getFunctionName(ref) === "runtimeClient:observeEnvelope"
          ? (++reads, withMarker(reads === 1 ? empty : { ...empty, deliveryExpiresAt: expiresAt })) as never : await fresh(ref, args));
        f.client.watchObservation(handle, update, error); await tick();
        f.subscriptions[0].update({ version: 1, marker, deliveryExpiresAt: expiresAt }); await tick();
        expect(reads).toBe(2); expect(update).toHaveBeenCalledTimes(2);
        await jest.advanceTimersByTimeAsync(40);
        expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTHORITY_EXPIRED" })); expect(f.subscriptions[0].closed).toBe(true);
        await f.client.close();
      } finally { jest.useRealTimers(); }
    });
    it("legacy envelopes conservatively reacquire a signal received during their initial read", async () => {
      const f = fixture(), fresh = f.mutation.getMockImplementation()!, update = jest.fn(); let release = (_value: unknown) => {}, reads = 0;
      f.mutation.mockImplementation(async (ref, args) => {
        if (getFunctionName(ref) === "runtimeClient:observeEnvelope" && ++reads === 1) return await new Promise<unknown>(resolve => { release = resolve; }) as never;
        return await fresh(ref, args);
      });
      const close = f.client.watchObservation(handle, update); await tick();
      f.subscriptions[0].update({ version: 1, marker }); release(envelope(empty)); await tick();
      expect(reads).toBe(2); expect(update).toHaveBeenCalledTimes(2); expect(f.calls.filter(row => row.name === "runtimeClient:session")).toHaveLength(2);
      close(); await f.client.close();
    });
    it.each([undefined, "bad", 1, { private: "payload" }])("rejects malformed acknowledgement %# before protected delivery", async marker => {
      const f = fixture(), fresh = f.mutation.getMockImplementation()!, update = jest.fn(), error = jest.fn();
      f.mutation.mockImplementation(async (ref, args) => getFunctionName(ref) === "runtimeClient:observeEnvelope" ? { ...envelope(empty), marker } as never : await fresh(ref, args));
      f.client.watchObservation(handle, update, error); await tick();
      expect(update).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_RESPONSE", outcome: "uncertain" }));
      expect(f.subscriptions[0].closed).toBe(true); await f.client.close();
    });
  });

});


describe("memory effort public runtime contract",()=>{
  it.each(["fast","normal","high","max"] as const)("forwards %s requests without client-side policy clamping or hidden result limits",async effort=>{
    const f=fixture();try{
      await f.client.submitAndStart({...request,memory:{effort,maxEntries:0,maxContextTokens:100}});
      expect(f.calls.find(call=>call.name==="runtimeClient:submitAndStartEnvelope")?.args.request).toEqual({...request,memory:{effort,maxEntries:0,maxContextTokens:100}});
      await f.client.recall({requestId:"effort-recall",text:"facts",memory:{effort}});
      expect(f.calls.find(call=>call.name==="runtimeMemory:recall")?.args).toEqual({tenantId:"tenant",memorySpaceId:"space",requestId:"effort-recall",text:"facts",memory:{effort}});
      expect(f.port.query).not.toHaveBeenCalled();
    }finally{await f.client.close();}
  });
  it("preserves old omitted bindings and explicit caller limits while normalizing an explicit empty control",async()=>{
    const f=fixture();try{
      await f.client.submit(request);
      expect(f.calls.find(call=>call.name==="runs:submit")?.args.request).toEqual(request);
      await f.client.recall({requestId:"limited",text:"facts",limit:3,memory:{}});
      expect(f.calls.find(call=>call.name==="runtimeMemory:recall")?.args).toMatchObject({limit:3,memory:{effort:"normal"}});
    }finally{await f.client.close();}
  });
  it.each([null,[],"fast",{effort:"instant"},{maxEntries:-1},{maxContextTokens:0},{maxDepth:99},{effort:"normal",model:"foreign"}])("rejects invalid control %j before any RPC",async memory=>{
    const f=fixture();try{
      await expect(f.client.submitAndStart({...request,memory} as Parameters<typeof f.client.submitAndStart>[0])).rejects.toMatchObject({code:"INVALID_INPUT"});
      await expect(f.client.recall({text:"facts",requestId:"invalid",memory} as Parameters<typeof f.client.recall>[0])).rejects.toMatchObject({code:"INVALID_INPUT"});
      expect(f.calls).toHaveLength(0);expect(f.action).not.toHaveBeenCalled();
    }finally{await f.client.close();}
  });
  it("refuses memory getters and symbols without invoking user code",async()=>{
    const f=fixture(),get=jest.fn(()=>"max");try{
      for(const memory of [Object.defineProperty({},"effort",{get,enumerable:true}),{effort:"normal",[Symbol("private")]:true},Object.create({effort:"max"})]) {
        await expect(f.client.submit({...request,memory})).rejects.toMatchObject({code:"INVALID_INPUT"});
      }
      expect(get).not.toHaveBeenCalled();expect(f.calls).toHaveLength(0);
    }finally{await f.client.close();}
  });
  it("retains attributed public recall metadata and validates the new evidence path",async()=>{
    const f=fixture(),item:RuntimeRecallItem={type:"memory",id:"chunk",content:"useful evidence",score:0.8,source:"vector",tenantId:"tenant",userId:"owner",memory:{memoryId:"chunk",tags:["tag"]},graphContext:{connectedEntities:["entity"]},retrieval:{depth:1,path:["source:key"]}};
    f.action.mockImplementation(async()=>({items:[item],context:"useful evidence",profileId:"profile"}));
    try{const result=await f.client.recall({text:"facts",requestId:"attribution",memory:{effort:"max"}});expect(result.items).toEqual([item]);expect(result.items[0]?.retrieval?.path).not.toBe(item.retrieval!.path);}
    finally{await f.client.close();}
  });
  it.each([undefined,"direct-facts-v1","semantic-v1"] as const)("projects server trace through admission and recall without private metadata (route=%s)",async retrievalRoute=>{
    const f=fixture(),trace={...emptyMemoryEffortTrace(resolveMemoryEffortPolicy({effort:"max"})),reachedDepth:10,visited:12,selected:10,stopReasons:["work" as const],unavailableStages:["external_graph"],...(retrievalRoute===undefined?{}:{retrievalRoute})};
    const original=f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async(ref,args)=>getFunctionName(ref)==="runtimeClient:submitAndStartEnvelope"?{version:1,session:verified,admission:{version:1,run:{...value,memoryEffort:trace},start:{runId:value.runId,attemptNumber:value.attemptNumber,state:"ready"}}}:original(ref,args));
    f.action.mockImplementation(async()=>Object.assign({items:[],context:"",profileId:"profile"},{memoryEffort:trace}));
    try {
      const admission=await f.client.submitAndStart({...request,memory:{effort:"max"}}),recall=await f.client.recall({text:"facts",requestId:"trace"});
      expect(admission.run.memoryEffort).toEqual(trace);expect(recall.memoryEffort).toEqual(trace);
      expect(Object.prototype.hasOwnProperty.call(recall.memoryEffort,"retrievalRoute")).toBe(retrievalRoute!==undefined);
      expect(admission.run.memoryEffort).not.toBe(trace);expect(admission.run.memoryEffort?.stopReasons).not.toBe(trace.stopReasons);
      expect(()=>runtimeMemoryEffortTrace({...trace,evidenceText:"PRIVATE_TEXT"})).toThrow("INVALID_RESPONSE");
      expect(()=>runtimeMemoryEffortTrace({...trace,unavailableStages:Array(17).fill("stage")})).toThrow("INVALID_RESPONSE");
      expect(()=>runtimeMemoryEffortTrace({...trace,stopReasons:["complete"]})).toThrow("INVALID_RESPONSE");
    }finally{await f.client.close();}
  });
  it("refuses unknown, explicitly undefined and accessor retrieval routes without invoking user code",()=>{
    const trace=emptyMemoryEffortTrace(resolveMemoryEffortPolicy()),getter=jest.fn(()=>"direct-facts-v1");
    for(const retrievalRoute of ["direct-facts",undefined,null])expect(()=>runtimeMemoryEffortTrace({...trace,retrievalRoute})).toThrow("INVALID_RESPONSE");
    expect(()=>runtimeMemoryEffortTrace(Object.defineProperty({...trace},"retrievalRoute",{enumerable:true,get:getter}))).toThrow("INVALID_RESPONSE");
    expect(getter).not.toHaveBeenCalled();
  });
});


describe("Max recall transport deadline",()=>{
 it("allows a real delayed Max action past the old12s default without retrying",async()=>{
  jest.useFakeTimers();const f=fixture();f.action.mockImplementation(async()=>{await new Promise(resolve=>setTimeout(resolve,13000));return {items:[],context:"useful bounded Max result",profileId:"profile"};});
  try{const pending=f.client.recall({text:"facts",requestId:"max-delay",memory:{effort:"max"}});await tick();await jest.advanceTimersByTimeAsync(13001);await expect(pending).resolves.toMatchObject({context:"useful bounded Max result"});expect(f.action).toHaveBeenCalledTimes(1);}
  finally{await f.client.close();jest.useRealTimers();}
 });
 it("retains the ordinary12s guard and respects explicit shorter Max caller deadlines",async()=>{
  jest.useFakeTimers();const f=fixture();f.action.mockImplementation(async()=>{await new Promise(resolve=>setTimeout(resolve,13000));return {items:[],context:"late",profileId:"profile"};});
  const bounded=new CortexRuntimeClient({deploymentUrl:"https://unit.invalid",fetchToken:async()=>"opaque",client:f.port,requestTimeoutMs:25});
  try{
   const ordinary=expect(f.client.recall({text:"facts",requestId:"normal-delay",memory:{effort:"normal"}})).rejects.toMatchObject({code:"RPC_DEADLINE_EXCEEDED",outcome:"uncertain"});
   await tick();await jest.advanceTimersByTimeAsync(12001);await ordinary;
   const lower=expect(bounded.recall({text:"facts",requestId:"bounded-max",memory:{effort:"max"}})).rejects.toMatchObject({code:"RPC_DEADLINE_EXCEEDED",outcome:"uncertain"});
   await tick();await jest.advanceTimersByTimeAsync(26);await lower;await jest.advanceTimersByTimeAsync(13000);expect(f.action).toHaveBeenCalledTimes(2);
  }finally{await bounded.close();await f.client.close();jest.useRealTimers();}
 });
});
