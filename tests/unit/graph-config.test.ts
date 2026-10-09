import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { resolveGraphConnection } from "../../src/graph/config";
import type { GraphAdapter } from "../../src/graph/types";

const connect = jest.fn<(config: typeof connection) => Promise<void>>().mockResolvedValue(undefined);
const disconnect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const clientClose = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const constructor = jest.fn(() => ({ close: clientClose }));
const workerStart = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const workerStop = jest.fn();
const adapterConstructor = jest.fn(() => ({ connect, disconnect }));
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(), ConvexClient: constructor }));
jest.unstable_mockModule("../../src/graph/adapters/CypherGraphAdapter", () => ({ CypherGraphAdapter: adapterConstructor }));
jest.unstable_mockModule("../../src/graph/worker/GraphSyncWorker", () => ({
  GraphSyncWorker: jest.fn(() => ({ start: workerStart, stop: workerStop })),
}));
const { Cortex } = await import("../../src/index");
const connection = { uri: "bolt://127.0.0.1:45387", username: "owned-user", password: "private-password" };
const config = { convexUrl: "http://127.0.0.1:43210", graphEnabled: true, graphConnection: connection, resilience: { enabled: false } };
const saved = { ...process.env };
beforeEach(() => {
  for (const key of ["CORTEX_GRAPH_SYNC", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "MEMGRAPH_URI", "MEMGRAPH_USERNAME", "MEMGRAPH_PASSWORD"]) delete process.env[key];
  jest.clearAllMocks();
  workerStart.mockResolvedValue(undefined); connect.mockResolvedValue(undefined); disconnect.mockResolvedValue(undefined); clientClose.mockResolvedValue(undefined);
  constructor.mockImplementation(() => ({ close: clientClose }));
});
afterEach(() => { process.env = { ...saved }; });

describe("graph connection tuple selection", () => {
  it.each(["neo4j", "memgraph"] as const)("selects a complete %s tuple", (type) => {
    const prefix = type.toUpperCase();
    expect(resolveGraphConnection({}, { CORTEX_GRAPH_SYNC: "true", [`${prefix}_URI`]: connection.uri, [`${prefix}_USERNAME`]: connection.username, [`${prefix}_PASSWORD`]: connection.password })).toEqual(connection);
  });
  it("requires opt-in and explicit false overrides enabled env", () => {
    expect(resolveGraphConnection({}, { NEO4J_URI: connection.uri })).toBeUndefined();
    expect(resolveGraphConnection({ enabled: false }, { CORTEX_GRAPH_SYNC: "true" })).toBeUndefined();
  });
  it("rejects ambiguity but an explicit provider selects its own tuple", () => {
    const env = { NEO4J_URI: "bolt://127.0.0.1:45387", NEO4J_USERNAME: "neo", NEO4J_PASSWORD: "neo-secret", MEMGRAPH_URI: connection.uri, MEMGRAPH_USERNAME: connection.username, MEMGRAPH_PASSWORD: connection.password };
    expect(() => resolveGraphConnection({ enabled: true }, env)).toThrow(/ambiguous/);
    expect(resolveGraphConnection({ enabled: true, connection: { type: "memgraph" } }, env)).toEqual(connection);
  });
  it("never borrows another provider's credentials", () => {
    expect(() => resolveGraphConnection({ enabled: true }, { MEMGRAPH_URI: connection.uri, NEO4J_USERNAME: "neo", NEO4J_PASSWORD: "neo-secret" })).toThrow(/incomplete/);
  });
  it("an explicit untyped URI requires a complete explicit tuple", () => {
    expect(() => resolveGraphConnection({ enabled: true, connection: { uri: connection.uri } }, { NEO4J_USERNAME: "neo", NEO4J_PASSWORD: "neo-secret" })).toThrow(/incomplete/);
    expect(resolveGraphConnection({ enabled: true, connection }, {})).toEqual(connection);
  });
  it("missing enabled configuration reports actionable credential-free errors", () => {
    expect(() => resolveGraphConnection({ enabled: true }, {})).toThrow(/no URI/);
    expect(() => resolveGraphConnection({ enabled: true, connection: { uri: "bolt://secret-user:private-password@localhost", username: "secret-user" } }, {})).toThrow(/incomplete/);
  });
});

describe("factory graph ownership", () => {
  it("explicit off performs no adapter work", async () => {
    process.env.CORTEX_GRAPH_SYNC = "true";
    const cortex = await Cortex.create({ ...config, graphEnabled: false });
    expect(adapterConstructor).not.toHaveBeenCalled(); await cortex.shutdown();
  });
  it("manual adapter wins over env/off and remains usable after disposal", async () => {
    const manual = { disconnect: jest.fn(), isConnected: jest.fn<() => Promise<boolean>>().mockResolvedValue(true) };
    const cortex = await Cortex.create({ ...config, graphEnabled: false, graph: { adapter: manual as unknown as GraphAdapter } });
    await cortex.shutdown(); cortex.close();
    expect(adapterConstructor).not.toHaveBeenCalled(); expect(manual.disconnect).not.toHaveBeenCalled();
    expect(await manual.isConnected()).toBe(true);
  });
  it.each(["close-first", "shutdown-first"])("repeated/concurrent disposal releases owned resources exactly once (%s)", async (order) => {
    const cortex = await Cortex.create(config);
    if (order === "close-first") cortex.close();
    await Promise.all([cortex.shutdown(), cortex.shutdown()]); cortex.close();
    expect(connect).toHaveBeenCalledWith(connection); expect(disconnect).toHaveBeenCalledTimes(1); expect(clientClose).toHaveBeenCalledTimes(1);
  });
  it("async shutdown awaits graph cleanup initiated by close", async () => {
    let release!: () => void;
    disconnect.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const cortex = await Cortex.create(config); cortex.close();
    let finished = false; const pending = cortex.shutdown().then(() => { finished = true; });
    await new Promise((resolve) => setTimeout(resolve, 0)); expect(finished).toBe(false);
    release(); await pending; expect(finished).toBe(true);
  });
  it("failed construction after connection releases its owned adapter", async () => {
    constructor.mockImplementation(() => { throw new Error("construction sentinel"); });
    await expect(Cortex.create(config)).rejects.toThrow("construction sentinel");
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it("failed worker initialization after graph connection cleans all owned resources", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    workerStart.mockRejectedValue(new Error("private-password worker failure"));
    await expect(Cortex.create(config)).rejects.toThrow("Graph sync initialization failed.");
    expect(disconnect).toHaveBeenCalledTimes(1); expect(clientClose).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-password"); log.mockRestore();
  });
  it("factory waits for worker initialization and then disposes its owned adapter", async () => {
    let release!: () => void;
    workerStart.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    let finished = false; const pending = Cortex.create(config).then((instance) => { finished = true; return instance; });
    await new Promise((resolve) => setTimeout(resolve, 0)); expect(finished).toBe(false);
    release(); const cortex = await pending; await cortex.shutdown();
    expect(workerStop).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it("connection rejection remains an honest failure", async () => {
    connect.mockRejectedValue(new Error("connection failed"));
    await expect(Cortex.create(config)).rejects.toThrow("connection failed"); expect(constructor).not.toHaveBeenCalled();
  });
  it("cleanup rejection is handled by close and awaited/redacted by shutdown", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    disconnect.mockRejectedValue(new Error("private-password bolt://secret-user:secret@localhost"));
    const cortex = await Cortex.create(config); cortex.close();
    await expect(cortex.shutdown()).rejects.toThrow(/^Cortex resource cleanup failed\.$/);
    expect(clientClose).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-password"); warn.mockRestore();
  });
  it("preceding shutdown rejection still releases graph and Convex", async () => {
    const cortex = await Cortex.create(config);
    jest.spyOn(cortex.getResilience(), "shutdown").mockRejectedValue(new Error("failed drain"));
    await expect(cortex.shutdown()).rejects.toThrow("Cortex resource cleanup failed.");
    expect(disconnect).toHaveBeenCalledTimes(1); expect(clientClose).toHaveBeenCalledTimes(1);
  });
});
