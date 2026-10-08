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
  const query = jest.fn(async (ref: Parameters<RuntimeClientPort["query"]>[0], args: Record<string, unknown>) => {
    const name = getFunctionName(ref); calls.push({ name, args });
    if (name === "runtimeClient:session") return current;
    if (name === "runtimeAgent:observe") return observe;
    if (name === "runtimeMemory:defaultProfile") return { version: 1, profile: { profileId: "profile", dimensions: 1536 } };
    return value;
  });
  const action = jest.fn(async (ref: Parameters<RuntimeClientPort["action"]>[0], args: Record<string, unknown>) => { calls.push({ name: getFunctionName(ref), args }); return { items: [], context: "", profileId: "profile" }; });
  const port = { setAuth: (fetcher: AuthTokenFetcher, callback: (value: boolean) => void) => { tokenFetcher = fetcher; authCallback = callback; if (autoAuth) callback(true); },
    query, mutation: jest.fn(async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>) => { calls.push({ name: getFunctionName(ref), args }); return value; }),
    action,
    onUpdate: (ref: Parameters<RuntimeClientPort["onUpdate"]>[0], args: Record<string, unknown>, update: (value: unknown) => void, error: (error: Error) => void) => {
      const row = { name: getFunctionName(ref), args, update, error, closed: false }; subscriptions.push(row); return () => { row.closed = true; };
    }, close: jest.fn(async () => {}) } as unknown as RuntimeClientPort;
  const fetchToken = jest.fn(async () => "opaque-host-jwt");
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", scope: { tenantId: "tenant", memorySpaceId: "space" }, fetchToken, client: port });
  return { client, port, query, action, calls, subscriptions, fetchToken, authenticate: (status: boolean) => authCallback(status), token: (forceRefreshToken: boolean) => tokenFetcher({ forceRefreshToken }),
    automaticAuth: (enabled: boolean) => { autoAuth = enabled; },
    session: (next: RuntimeSession) => { current = next; }, observation: (next: RuntimeObservation) => { observe = next; } };
}
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
describe("browser remote runtime client", () => {
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
  it("rejects failed refresh and closes all active observations before late data", async () => {
    const f = fixture(), updates = jest.fn(), error = jest.fn(); f.client.watchRun(handle, updates, error);
    f.subscriptions[0].update(verified); await tick(); expect(f.subscriptions).toHaveLength(2);
    f.automaticAuth(false);
    const pending = f.client.refreshAuth(); f.authenticate(false);
    await expect(pending).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    f.subscriptions[1].update(value); await tick(); expect(updates).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "UNAUTHENTICATED" }));
    expect(f.subscriptions.every(row => row.closed)).toBe(true);
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
  it("drains cursor pages once, reacts to approvals, and resets replacement attempt", async () => {
    const f = fixture(), updates = jest.fn<(value: RuntimeObservation) => void>(); const close = f.client.watchObservation(handle, updates);
    f.subscriptions[0].update(verified); await tick();
    const batch: RuntimeObservation = { run: value, state: "running", parts: Array.from({ length: 100 }, (_, i) => ({ sequence: i + 1, part: { type: "text-delta", text: "a" } })), cursor: 100, approvals: [] };
    f.subscriptions[1].update(batch); await tick();
    expect(updates.mock.calls[0][0].parts).toHaveLength(100); expect(f.subscriptions[1].closed).toBe(true);
    f.subscriptions[2].update(verified); await tick(); expect(f.subscriptions[3].args.afterSequence).toBe(100);
    f.subscriptions[3].update({ run: { ...value, attemptNumber: 2 }, state: "running", parts: [], cursor: 100, approvals: [] }); await tick();
    f.subscriptions[4].update(verified); await tick(); expect(f.subscriptions[5].args.afterSequence).toBe(0);
    f.subscriptions[5].update({ run: { ...value, attemptNumber: 2 }, state: "waiting_approval", parts: [{ sequence: 1, part: { type: "artifact", kind: "memory-receipt", artifactId: "receipt" } }], cursor: 1, approvals: [{ operationId: "op", toolName: "memory_remember", requestHash: "hash" }] }); await tick();
    expect(updates.mock.calls.at(-1)?.[0]).toMatchObject({ cursor: 1, approvals: [{ requestHash: "hash" }] }); close(); expect(f.subscriptions.every(row => row.closed)).toBe(true);
    expect(f.calls.some(call => call.name === "runtimeAgent:cancel")).toBe(false);
  });
  it("closes a session-switched reactive query without delivering cached result", async () => {
    const f = fixture(), update = jest.fn(), error = jest.fn(); f.client.watchRun(handle, update, error);
    f.subscriptions[0].update({ ...verified, principalId: "other" }); await tick();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "SESSION_CHANGED" })); expect(update).not.toHaveBeenCalled();
  });
  it("withholds typed backend error details and never exposes provider diagnostics", async () => {
    const f = fixture(); jest.mocked(f.port.query).mockRejectedValueOnce({ data: { version: 1, code: "FORBIDDEN", message: "secret-token", outcome: "not_dispatched" } });
    await expect(f.client.session()).rejects.toEqual(new CortexRuntimeError("FORBIDDEN"));
    jest.mocked(f.port.query).mockRejectedValueOnce(new Error("private provider credentials"));
    await expect(f.client.session()).rejects.toMatchObject({ message: "Cortex runtime: TRANSPORT_ERROR", outcome: "uncertain" });
  });
  it.each(["get", "attach", "messages", "listConversations", "getDefinition", "getDefaultProfile", "recall"] as const)("withholds async %s delivery when auth changes principal while response is in flight", async method => {
    const f = fixture(); let release = (_value: unknown) => {}, started = () => {};
    const ready = new Promise<void>(resolve => { started = resolve; }); const response = new Promise<unknown>(resolve => { release = resolve; });
    const target = { get: "runs:get", attach: "runs:get", messages: "runtimeTranscript:messages", listConversations: "runtimeTranscript:list",
      getDefinition: "agentDefinitions:get", getDefaultProfile: "runtimeMemory:defaultProfile", recall: "runtimeMemory:recall" }[method];
    f.query.mockImplementation(async (ref, _args) => { if (getFunctionName(ref) === "runtimeClient:session") return verified;
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
});
