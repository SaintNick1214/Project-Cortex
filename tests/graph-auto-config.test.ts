import { ConvexHttpClient } from "convex/browser";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { GraphAdapter } from "../src/graph/types";
const connect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const disconnect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const constructor = jest.fn(() => ({ close }));
const adapterConstructor = jest.fn(() => ({ connect, disconnect }));
const workerStart = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
jest.unstable_mockModule("convex/browser", () => ({ ConvexClient: constructor, ConvexHttpClient }));
jest.unstable_mockModule("../src/graph/adapters/CypherGraphAdapter", () => ({ CypherGraphAdapter: adapterConstructor }));
jest.unstable_mockModule("../src/graph/worker/GraphSyncWorker", () => ({ GraphSyncWorker: jest.fn(() => ({ start: workerStart, stop: jest.fn() })) }));
const { Cortex } = await import("../src/index");
const saved = { ...process.env };
const config = { convexUrl: "http://127.0.0.1:45510", resilience: { enabled: false } };
beforeEach(() => {
  for (const key of ["CORTEX_GRAPH_SYNC", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "MEMGRAPH_URI", "MEMGRAPH_USERNAME", "MEMGRAPH_PASSWORD"]) delete process.env[key];
  jest.clearAllMocks(); connect.mockResolvedValue(undefined); disconnect.mockResolvedValue(undefined); workerStart.mockResolvedValue(undefined);
});
afterEach(() => { process.env = { ...saved }; });
describe("accepted graph auto-configuration through actual Cortex factory", () => {
  it.each([undefined, "false", ""])("requires explicit opt-in (%s)", async (value) => {
    if (value !== undefined) process.env.CORTEX_GRAPH_SYNC = value;
    process.env.NEO4J_URI = "bolt://127.0.0.1:45587";
    const cortex = await Cortex.create(config); expect(adapterConstructor).not.toHaveBeenCalled(); expect(cortex.getGraphSyncWorker()).toBeUndefined(); await cortex.shutdown();
  });
  it("rejects enabled missing tuples before native construction", async () => {
    await expect(Cortex.create({ ...config, graphEnabled: true })).rejects.toThrow(/no URI/); expect(constructor).not.toHaveBeenCalled();
  });
  it("rejects enabled ambiguous tuples without priority fallback", async () => {
    Object.assign(process.env, { CORTEX_GRAPH_SYNC: "true", NEO4J_URI: "bolt://127.0.0.1:45587", NEO4J_USERNAME: "neo", NEO4J_PASSWORD: "neo", MEMGRAPH_URI: "bolt://127.0.0.1:45588", MEMGRAPH_USERNAME: "mem", MEMGRAPH_PASSWORD: "mem" });
    await expect(Cortex.create(config)).rejects.toThrow(/ambiguous/); expect(constructor).not.toHaveBeenCalled(); expect(adapterConstructor).not.toHaveBeenCalled();
  });
  it.each(["neo4j", "memgraph"] as const)("uses selected complete %s tuple and authenticated transport before worker", async (type) => {
    const prefix = type.toUpperCase(); Object.assign(process.env, { CORTEX_GRAPH_SYNC: "true", [`${prefix}_URI`]: "bolt://127.0.0.1:45587", [`${prefix}_USERNAME`]: "owned", [`${prefix}_PASSWORD`]: "owned" });
    const init = jest.fn(() => undefined); const cortex = await Cortex.create(config, { initializeTransport: init });
    expect(connect).toHaveBeenCalledTimes(1); expect(init).toHaveBeenCalledTimes(1); expect(init.mock.invocationCallOrder[0]).toBeLessThan(workerStart.mock.invocationCallOrder[0]);
    await cortex.shutdown(); expect(disconnect).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
  });
  it("propagates enabled connection failure before native construction", async () => {
    connect.mockRejectedValue(new Error("Graph database authentication failed."));
    await expect(Cortex.create({ ...config, graphEnabled: true, graphConnection: { uri: "bolt://127.0.0.1:45587", username: "owned", password: "owned" } })).rejects.toThrow("Graph database authentication failed.");
    expect(constructor).not.toHaveBeenCalled();
  });
  it("explicit off avoids automatic graph work despite enabled env", async () => {
    process.env.CORTEX_GRAPH_SYNC = "true"; const cortex = await Cortex.create({ ...config, graphEnabled: false });
    expect(adapterConstructor).not.toHaveBeenCalled(); await cortex.shutdown();
  });
  it("manual adapter takes priority and remains caller-owned after repeated shutdown", async () => {
    const adapter = { disconnect: jest.fn(), isConnected: jest.fn<() => Promise<boolean>>().mockResolvedValue(true) };
    const cortex = await Cortex.create({ ...config, graphEnabled: false, graph: { adapter: adapter as unknown as GraphAdapter } });
    cortex.close(); await Promise.all([cortex.shutdown(), cortex.shutdown()]); expect(adapterConstructor).not.toHaveBeenCalled(); expect(adapter.disconnect).not.toHaveBeenCalled(); expect(await adapter.isConnected()).toBe(true);
  });
});
