import { ConvexHttpClient } from "convex/browser";
/** Actual SDK constructor/factory with externally controlled transport releases. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { CortexConfig, CortexRuntimeOptions } from "../../src/index";
import type { GraphAdapter } from "../../src/graph/types";
import { ConversationsAPI } from "../../src/conversations";
import { MemoryAPI } from "../../src/memory";

const events: string[] = [];
let authenticated = false;
let closeImpl: () => Promise<void> = async () => {};
let disconnectImpl: () => Promise<void> = async () => {};
const transport = {
  closed: false,
  listeners: ["owned-listener"],
  close: jest.fn(() => { events.push("client-close-start"); transport.closed = true; transport.listeners = []; return closeImpl(); }),
  query: jest.fn(async () => { events.push("query"); expect(authenticated).toBe(true); return []; }),
  mutation: jest.fn(async () => { events.push("mutation"); expect(authenticated).toBe(true); return {}; }),
  action: jest.fn(async () => { events.push("action"); expect(authenticated).toBe(true); return {}; }),
  onUpdate: jest.fn(() => { events.push("onUpdate"); expect(authenticated).toBe(true); return () => {}; }),
};
const transportConstructor = jest.fn(() => { events.push("transport"); return transport; });
const disconnect = jest.fn(() => { events.push("graph-disconnect-start"); return disconnectImpl(); });
const connect = jest.fn(async () => { events.push("graph-connect"); });
const adapterConstructor = jest.fn(() => ({ connect, disconnect }));
const workerConstructor = jest.fn(() => { events.push("worker"); expect(authenticated).toBe(true); return { start: workerStart, stop: jest.fn() }; });
const workerStart = jest.fn(async () => { events.push("worker-start"); transport.onUpdate(); });
// Wrap real dependency constructors to observe the boundary without copying their behavior.
for (const [path, name] of [
  ["conversations", "ConversationsAPI"], ["immutable", "ImmutableAPI"], ["mutable", "MutableAPI"],
  ["vector", "VectorAPI"], ["facts", "FactsAPI"], ["contexts", "ContextsAPI"],
  ["memorySpaces", "MemorySpacesAPI"], ["users", "UsersAPI"], ["agents", "AgentsAPI"],
  ["governance", "GovernanceAPI"], ["a2a", "A2AAPI"], ["sessions", "SessionsAPI"],
  ["artifacts", "ArtifactsAPI"], ["attachments", "AttachmentsAPI"], ["memory", "MemoryAPI"],
  ["resilience", "ResilienceLayer"],
]) {
  const actual = await import(`../../src/${path}/index.ts`);
  jest.unstable_mockModule(`../../src/${path}`, () => ({ ...actual, [name]: jest.fn((...args: unknown[]) => {
    events.push(name);
    return Reflect.construct(actual[name], args);
  }) }));
}
jest.unstable_mockModule("convex/browser", () => ({ ConvexClient: transportConstructor, ConvexHttpClient }));
jest.unstable_mockModule("../../src/graph", () => ({ CypherGraphAdapter: adapterConstructor }));
jest.unstable_mockModule("../../src/graph/worker/GraphSyncWorker", () => ({ GraphSyncWorker: workerConstructor }));
const { Cortex } = await import("../../src/index");
const config: CortexConfig = { convexUrl: "http://127.0.0.1:45510", resilience: { enabled: false }, graphEnabled: false };
const graphConfig: CortexConfig = { ...config, graphEnabled: true, graphConnection: { uri: "bolt://127.0.0.1:45587", username: "controlled", password: "controlled" } };
const validRuntime: CortexRuntimeOptions = { initializeTransport() { events.push("initialize"); authenticated = true; return undefined; } };
const secret = "task28-controlled-secret-error";
const failureRuntime: CortexRuntimeOptions = { initializeTransport() { throw new Error(secret); } };
const instances: InstanceType<typeof Cortex>[] = [];
function deferred() {
  let resolve!: () => void; let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function safeFailure(error: unknown) {
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).not.toContain(secret);
  expect(JSON.stringify(error)).not.toContain(secret);
  expect(error).not.toHaveProperty("cause");
  expect((error as Error).stack).not.toContain(secret);
  expect(events.some(event => event.endsWith("API") || event === "ResilienceLayer" || event === "worker")).toBe(false);
}
beforeEach(() => {
  events.length = 0; authenticated = false; transport.closed = false; transport.listeners = ["owned-listener"];
  jest.clearAllMocks(); closeImpl = async () => { events.push("client-close-complete"); }; disconnectImpl = async () => { events.push("graph-disconnect-complete"); };
  workerStart.mockImplementation(async () => { events.push("worker-start"); transport.onUpdate(); });
});
afterEach(async () => { for (const instance of instances.splice(0)) await instance.shutdown(); jest.useRealTimers(); });

describe("early production transport initialization", () => {
  it("initializes before all real APIs, worker and every first transport operation", async () => {
    const cortex = await Cortex.create(graphConfig, validRuntime); instances.push(cortex);
    expect(cortex.conversations).toBeInstanceOf(ConversationsAPI); expect(cortex.memory).toBeInstanceOf(MemoryAPI);
    for (const key of ["immutable", "mutable", "vector", "facts", "contexts", "memorySpaces", "users", "agents", "governance", "a2a", "sessions", "artifacts", "attachments"] as const) {
      expect(cortex[key]).toBeDefined();
      expect((cortex[key] as unknown as { client: unknown }).client).toBe(transport);
    }
    // Real API construction has completed only after the initializer, before worker start.
    expect(events.slice(0, 3)).toEqual(["graph-connect", "transport", "initialize"]);
    expect(events.slice(3, 19)).toEqual(["ResilienceLayer", "ConversationsAPI", "ImmutableAPI", "MutableAPI", "VectorAPI", "FactsAPI", "ContextsAPI", "MemorySpacesAPI", "UsersAPI", "AgentsAPI", "GovernanceAPI", "A2AAPI", "SessionsAPI", "ArtifactsAPI", "AttachmentsAPI", "MemoryAPI"]);
    expect(events.slice(19, 22)).toEqual(["worker", "worker-start", "onUpdate"]);
    await transport.query(); await transport.mutation(); await transport.action(); transport.onUpdate();
    for (const event of ["worker", "worker-start", "query", "mutation", "action", "onUpdate"]) expect(events.indexOf(event)).toBeGreaterThan(events.indexOf("initialize"));
    expect(cortex.auth).toBeUndefined(); expect(config).not.toHaveProperty("initializeTransport");
  });
  it("preserves omitted construction/factory and original transport argument count", async () => {
    instances.push(new Cortex(config), await Cortex.create(config));
    expect(transportConstructor.mock.calls).toEqual([[config.convexUrl], [config.convexUrl]]); expect(workerConstructor).not.toHaveBeenCalled();
    expect(instances[0].conversations).toBeInstanceOf(ConversationsAPI);
  });
  it("rejects AsyncFunction before its body and observes no namespace or worker escape", () => {
    let calls = 0;
    const runtime = { initializeTransport: async () => { calls++; throw new Error(secret); } } as unknown as CortexRuntimeOptions;
    let failure: unknown; try { new Cortex(graphConfig, runtime); } catch (error) { failure = error; }
    safeFailure(failure); expect(calls).toBe(0); expect(transport.close).toHaveBeenCalledTimes(1); expect(workerConstructor).not.toHaveBeenCalled();
  });
  it.each([null, false, 1, "not-a-function"])("refuses non-function initializer %s", (initializeTransport) => {
    expect(() => new Cortex(config, { initializeTransport } as unknown as CortexRuntimeOptions)).toThrow("Cortex transport initialization failed.");
    expect(transport.close).toHaveBeenCalledTimes(1); expect(workerConstructor).not.toHaveBeenCalled();
  });
  it.each([null, false, 0, "nonundefined", {}])("refuses return %s", (value) => {
    expect(() => new Cortex(config, { initializeTransport: () => value } as unknown as CortexRuntimeOptions)).toThrow("Cortex transport initialization failed.");
    expect(transport.close).toHaveBeenCalledTimes(1); expect(workerConstructor).not.toHaveBeenCalled();
  });
  it("refuses a never-settling returned Promise without waiting on caller work", async () => {
    const value = new Promise<never>(() => {});
    const error = await Cortex.create(config, { initializeTransport: () => value } as unknown as CortexRuntimeOptions).catch(error => error);
    safeFailure(error); expect(String(error)).toContain("client: complete; owned graph: not-owned");
    expect(transport.close).toHaveBeenCalledTimes(1);
  });
  it("observes a returned rejecting Promise and hostile thenable without leaking causes", async () => {
    const unhandled = jest.fn(); process.on("unhandledRejection", unhandled);
    try {
      for (const value of [Promise.reject(new Error(secret)), { get then() { throw new Error(secret); } }]) {
        expect(() => new Cortex(config, { initializeTransport: () => value } as unknown as CortexRuntimeOptions)).toThrow("Cortex transport initialization failed.");
      }
      await flush(); expect(unhandled).not.toHaveBeenCalled(); expect(transport.close).toHaveBeenCalledTimes(2);
    } finally { process.off("unhandledRejection", unhandled); }
  });
});

describe("honest failed initialization resource observation", () => {
  it.each(["connecting", "ready"])("throws synchronously with %s socket release initiated before socket completion", async () => {
    const socket = deferred(); closeImpl = () => socket.promise.then(() => { events.push("socket-closed"); });
    let failure: unknown; try { new Cortex(graphConfig, failureRuntime); } catch (error) { failure = error; }
    safeFailure(failure); expect(transport.closed).toBe(true); expect(transport.listeners).toEqual([]);
    expect(events).toEqual(["transport", "client-close-start"]); expect(workerConstructor).not.toHaveBeenCalled();
    socket.resolve(); await flush(); expect(events).toContain("socket-closed"); expect(transport.close).toHaveBeenCalledTimes(1);
  });
  it("starts owned disconnect before waiting and waits for both actual completions", async () => {
    const socket = deferred(), graph = deferred(); closeImpl = () => socket.promise; disconnectImpl = () => graph.promise;
    let settled = false; const outcome = Cortex.create(graphConfig, failureRuntime).catch(error => { settled = true; return error; });
    await flush(); expect(events).toEqual(["graph-connect", "transport", "client-close-start", "graph-disconnect-start"]);
    expect(settled).toBe(false); graph.resolve(); await flush(); expect(settled).toBe(false); socket.resolve();
    const error = await outcome; safeFailure(error); expect(String(error)).toContain("client: complete; owned graph: complete");
    expect(disconnect).toHaveBeenCalledTimes(1); expect(transport.close).toHaveBeenCalledTimes(1);
  });
  it.each(["complete", "failed"] as const)("bounds pending socket at exactly 30000ms with owned graph %s and observes late fulfillment", async (graphStatus) => {
    jest.useFakeTimers(); const socket = deferred(); closeImpl = () => socket.promise.then(() => { events.push("late-socket-complete"); });
    if (graphStatus === "failed") disconnectImpl = async () => { throw new Error(secret); };
    let settled = false; const outcome = Cortex.create(graphConfig, failureRuntime).catch(error => { settled = true; return error; });
    await flush(); expect(disconnect).toHaveBeenCalledTimes(1); expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(29999); expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1); const error = await outcome; safeFailure(error);
    expect(String(error)).toContain(`Cleanup incomplete (client: pending; owned graph: ${graphStatus})`);
    socket.resolve(); await flush(); expect(events).toContain("late-socket-complete");
    expect(String(error)).toContain("client: pending"); expect(jest.getTimerCount()).toBe(0);
  });
  it("keeps observers attached to late socket rejection after timeout", async () => {
    jest.useFakeTimers(); const socket = deferred(); closeImpl = () => socket.promise;
    const unhandled = jest.fn(); process.on("unhandledRejection", unhandled);
    try {
      const outcome = Cortex.create(graphConfig, failureRuntime).catch(error => error); await flush();
      await jest.advanceTimersByTimeAsync(30000); const error = await outcome; expect(String(error)).toContain("client: pending");
      socket.reject(new Error(secret)); await flush(); expect(unhandled).not.toHaveBeenCalled(); expect(String(error)).toContain("client: pending");
    } finally { process.off("unhandledRejection", unhandled); }
  });
  it.each(["client-reject", "client-throw", "graph-reject", "graph-throw", "both-reject"])("reports failed resource honestly (%s) and releases the other independently", async (mode) => {
    if (mode.startsWith("client") || mode === "both-reject") closeImpl = () => { if (mode === "client-throw") throw new Error(secret); return Promise.reject(new Error(secret)); };
    if (mode.startsWith("graph") || mode === "both-reject") disconnectImpl = () => { if (mode === "graph-throw") throw new Error(secret); return Promise.reject(new Error(secret)); };
    const error = await Cortex.create(graphConfig, failureRuntime).catch(error => error); safeFailure(error);
    expect(String(error)).toContain(`client: ${mode.startsWith("client") || mode === "both-reject" ? "failed" : "complete"}`);
    expect(String(error)).toContain(`owned graph: ${mode.startsWith("graph") || mode === "both-reject" ? "failed" : "complete"}`);
    expect(disconnect).toHaveBeenCalledTimes(1); expect(transport.close).toHaveBeenCalledTimes(1); expect(workerConstructor).not.toHaveBeenCalled();
  });
  it("does not release borrowed graph even when initialization fails", async () => {
    const manual = { disconnect: jest.fn() } as unknown as GraphAdapter;
    const error = await Cortex.create({ ...config, graph: { adapter: manual, autoSync: true } }, failureRuntime).catch(error => error);
    expect(String(error)).toContain("owned graph: not-owned"); expect(manual.disconnect).not.toHaveBeenCalled(); expect(workerConstructor).not.toHaveBeenCalled();
  });
  it("clears the deadline after completed releases", async () => {
    jest.useFakeTimers(); const error = await Cortex.create(graphConfig, failureRuntime).catch(error => error);
    safeFailure(error); expect(jest.getTimerCount()).toBe(0);
  });
});
