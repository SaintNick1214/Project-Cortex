import { jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { AuthTokenFetcher } from "convex/browser";
import { CortexRuntimeClient, CortexRuntimeError } from "../../../src/client-runtime/index";
import type { RuntimeClientPort, RuntimeObservation, RuntimeRun, RuntimeRunHandle, RuntimeSession } from "../../../src/client-runtime/index";

const verified: RuntimeSession = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", userId: "user" };
const value: RuntimeRun = { version: 1, runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1,
  scope: { tenantId: "tenant", memorySpaceId: "space" }, definitionHash: "definition", queueSequence: 1, responseStatus: "running",
  memoryStatus: "pending", graphStatus: "not_requested", attemptNumber: 1, cancellationRequested: false,
  inputMessageIds: ["input"], outputMessageIds: [], failureCode: null, contextCompleteness: "complete", contextFailureCode: null, createdAt: 1, updatedAt: 2 };
const handle: RuntimeRunHandle = { version: 1, tenantId: "tenant", memorySpaceId: "space", principalId: "owner", runId: "run", conversationId: "conversation", agentId: "agent", agentVersion: 1, definitionHash: "definition" };
const request = { version: 1 as const, agentId: "agent", agentVersion: 1, clientRequestId: "request", parts: [{ type: "text" as const, text: "hello" }] };
function fixture(autoAuth = true) {
  let current: RuntimeSession = verified, authCallback = (_value: boolean) => {}, tokenFetcher: AuthTokenFetcher = async () => null;
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const subscriptions: { name: string; args: Record<string, unknown>; update: (value: unknown) => void; error: (error: Error) => void; closed: boolean }[] = [];
  let observe: RuntimeObservation = { run: value, state: "running", parts: [], cursor: 0, approvals: [] };
  const mutation = jest.fn(async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => {
    const name = getFunctionName(ref); calls.push({ name, args });
    if (name === "runtimeClient:session") return current;
    if (name === "runtimeAgent:observe") return observe;
    if (name === "runtimeMemory:defaultProfile") return { version: 1, profile: { profileId: "profile", dimensions: 1536 } };
    return value;
  });
  const action = jest.fn(async (ref: Parameters<RuntimeClientPort["action"]>[0], args: Record<string, unknown>) => { calls.push({ name: getFunctionName(ref), args }); return { items: [], context: "", profileId: "profile" }; });
  const port = { setAuth: (fetcher: AuthTokenFetcher, callback: (value: boolean) => void) => { tokenFetcher = fetcher; authCallback = callback; if (autoAuth) callback(true); },
    query: jest.fn(async () => { throw new Error("PRIVATE_QUERY_PROHIBITED"); }), mutation,
    action,
    onUpdate: (ref: Parameters<RuntimeClientPort["onUpdate"]>[0], args: Record<string, unknown>, update: (value: unknown) => void, error: (error: Error) => void) => {
      const row = { name: getFunctionName(ref), args, update, error, closed: false }; subscriptions.push(row); return () => { row.closed = true; };
    }, close: jest.fn(async () => {}) } as unknown as RuntimeClientPort;
  const fetchToken = jest.fn(async () => "opaque-host-jwt");
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", scope: { tenantId: "tenant", memorySpaceId: "space" }, fetchToken, client: port });
  return { client, port, mutation, action, calls, subscriptions, fetchToken, authenticate: (status: boolean) => authCallback(status), token: (forceRefreshToken: boolean) => tokenFetcher({ forceRefreshToken }),
    automaticAuth: (enabled: boolean) => { autoAuth = enabled; },
    session: (next: RuntimeSession) => { current = next; }, observation: (next: RuntimeObservation) => { observe = next; } };
}
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
describe("browser remote runtime client", () => {
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
    const f = fixture(); await expect(f.client.submit(input as never)).rejects.toMatchObject({ code: "INVALID_INPUT" }); expect(f.calls).toEqual([]);
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
    expect(f.calls.filter(call => call.name === "runtimeAgent:observe").map(call => call.args.afterSequence)).toEqual([50, 0]);
  });
  it("drains fresh cursor pages once, reacts to approvals, and resets replacement attempt", async () => {
    const f = fixture(), updates = jest.fn<(value: RuntimeObservation) => void>();
    f.observation({ run: value, state: "running", parts: Array.from({ length: 100 }, (_, i) => ({ sequence: i + 1, part: { type: "text-delta", text: "a" } })), cursor: 100, approvals: [] });
    // The server page advances only after the first 100-part read. No cached payload is consulted.
    let pages = 0; const fresh = f.mutation.getMockImplementation()!;
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) === "runtimeAgent:observe" && pages++ > 0) return { run: value, state: "running", parts: [], cursor: 100, approvals: [] } as never;
      return await fresh(ref, args);
    });
    const close = f.client.watchObservation(handle, updates); await tick();
    expect(updates.mock.calls[0][0].parts).toHaveLength(100); expect(f.subscriptions[0].closed).toBe(true);
    expect(f.calls.filter(call => call.name === "runtimeAgent:observe").map(call => call.args.afterSequence)).toEqual([0]);
    // Replacement sends an exhausted old cursor first, then drains from zero.
    f.mutation.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) !== "runtimeAgent:observe") return await fresh(ref, args);
      f.calls.push({ name: getFunctionName(ref), args });
      return args.afterSequence === 0 ? { run: { ...value, attemptNumber: 2 }, state: "waiting_approval", parts: [{ sequence: 1, part: { type: "artifact", kind: "memory-receipt", artifactId: "receipt" } }], cursor: 1, approvals: [{ operationId: "op", toolName: "memory_remember", requestHash: "hash" }] } as never
        : { run: { ...value, attemptNumber: 2 }, state: "running", parts: [], cursor: 100, approvals: [] } as never;
    });
    f.subscriptions.at(-1)!.update({ version: 1, marker: "b".repeat(64) }); await tick();
    expect(f.calls.filter(call => call.name === "runtimeAgent:observe").map(call => call.args.afterSequence)).toEqual([0, 100, 0]);
    expect(updates.mock.calls.at(-1)?.[0]).toMatchObject({ cursor: 1, approvals: [{ requestHash: "hash" }] });
    close(); expect(f.subscriptions.every(row => row.closed)).toBe(true);
    expect(f.calls.some(call => call.name === "runtimeAgent:cancel")).toBe(false); expect(f.port.query).not.toHaveBeenCalled(); await f.client.close();
  });
  it("fences a changed verified principal before fresh reactive payload delivery", async () => {
    const f = fixture(), update = jest.fn(), error = jest.fn(); f.session({ ...verified, principalId: "other" });
    f.client.watchRun(handle, update, error); await tick();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "SESSION_CHANGED" })); expect(update).not.toHaveBeenCalled();
    expect(f.calls.some(call => call.name === "runtimeAgent:observe")).toBe(false); expect(f.port.query).not.toHaveBeenCalled(); await f.client.close();
  });
  it("withholds typed backend error details and never exposes provider diagnostics", async () => {
    const f = fixture(); jest.mocked(f.port.mutation).mockRejectedValueOnce({ data: { version: 1, code: "FORBIDDEN", message: "secret-token", outcome: "not_dispatched" } });
    await expect(f.client.session()).rejects.toEqual(new CortexRuntimeError("FORBIDDEN"));
    jest.mocked(f.port.mutation).mockRejectedValueOnce(new Error("private provider credentials"));
    await expect(f.client.session()).rejects.toMatchObject({ message: "Cortex runtime: TRANSPORT_ERROR", outcome: "uncertain" });
  });
  it.each(["get", "attach", "messages", "listConversations", "getDefinition", "getDefaultProfile", "recall"] as const)("withholds async %s delivery when auth changes principal while response is in flight", async method => {
    const f = fixture(); let release = (_value: unknown) => {}, started = () => {};
    const ready = new Promise<void>(resolve => { started = resolve; }); const response = new Promise<unknown>(resolve => { release = resolve; });
    const target = { get: "runs:get", attach: "runs:get", messages: "runtimeTranscript:messages", listConversations: "runtimeTranscript:list",
      getDefinition: "agentDefinitions:get", getDefaultProfile: "runtimeMemory:defaultProfile", recall: "runtimeMemory:recall" }[method];
    f.mutation.mockImplementation(async (ref, _args) => { if (getFunctionName(ref) === "runtimeClient:session") return verified;
      if (getFunctionName(ref) === target) { started(); return await response as RuntimeRun; } return value; });
    if (method === "recall") f.action.mockImplementation(async () => { started(); await response; return { items: [], context: "", profileId: "profile" }; });
    const calls = { get: () => f.client.get(handle), attach: () => f.client.attach("run"), messages: () => f.client.messages("conversation"), listConversations: () => f.client.listConversations(),
      getDefinition: () => f.client.getDefinition("agent", 1), getDefaultProfile: () => f.client.getDefaultProfile(), recall: () => f.client.recall({ text: "private", requestId: "r" }) };
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
      if (getFunctionName(ref) === "runtimeAgent:observe") { reads++; return await new Promise<unknown>(resolve => { release = resolve; }) as never; }
      return await fresh(ref, args);
    });
    const close = f.client.watchObservation(handle, update); await tick();
    for (let i = 0; i < 20; i++) f.subscriptions[0].update({ version: 1, marker: "a".repeat(64) });
    await tick(); expect(reads).toBe(1); close(); release({ run: value, state: "running", parts: [], cursor: 0, approvals: [] }); await tick();
    expect(update).not.toHaveBeenCalled(); expect(reads).toBe(1); expect(f.calls.some(call => call.name === "runtimeAgent:cancel")).toBe(false); await f.client.close();
  });

  it("bounds a stalled fresh mutation, retains its late outcome and never redispatches", async () => {
    jest.useFakeTimers();
    try {
      const f = fixture(); let release = (_value: unknown) => {}, issued = 0;
      const fresh = f.mutation.getMockImplementation()!;
      f.mutation.mockImplementation(async (ref, args) => {
        if (getFunctionName(ref) === "runs:submit") { issued++; return await new Promise<unknown>(resolve => { release = resolve; }) as never; }
        return await fresh(ref, args);
      });
      const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", fetchToken: f.fetchToken, client: f.port, requestTimeoutMs: 30 });
      const pending = client.submit(request), assertion = expect(pending).rejects.toMatchObject({ code: "RPC_DEADLINE_EXCEEDED", outcome: "uncertain" });
      await tick(); await jest.advanceTimersByTimeAsync(30); await assertion; expect(issued).toBe(1);
      release(value); await tick(); expect(issued).toBe(1); expect(f.calls.some(call => call.name === "runtimeAgent:start" || call.name === "runtimeAgent:cancel")).toBe(false);
      await client.close(); await f.client.close();
    } finally { jest.useRealTimers(); }
  });

});
