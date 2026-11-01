import { beforeEach, describe, expect, it, jest } from "@jest/globals";
const run = jest.fn<(query: string) => Promise<unknown>>();
const sessionClose = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const driverClose = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const verifyConnectivity = jest.fn<() => Promise<void>>();
const driver = { session: jest.fn(() => ({ run, close: sessionClose })), close: driverClose, verifyConnectivity };
jest.unstable_mockModule("neo4j-driver", () => ({ Integer: class {}, Driver: class {}, Session: class {}, default: { driver: jest.fn(() => driver), auth: { basic: jest.fn() } } }));
const { CypherGraphAdapter } = await import("../../src/graph/adapters/CypherGraphAdapter");
const config = { uri: "bolt://secret-user:private-password@localhost:45387", username: "secret-user", password: "private-password" };
beforeEach(() => { jest.clearAllMocks(); run.mockResolvedValue({}); verifyConnectivity.mockResolvedValue(undefined); driverClose.mockResolvedValue(undefined); });
describe("non-mutating connection capability probes", () => {
  it("uses read-only null capability detection and closes every session", async () => {
    const adapter = new CypherGraphAdapter(); await adapter.connect(config);
    expect(run.mock.calls.map(([query]) => query)).toEqual(["RETURN 1 as test", "RETURN elementId(null) AS id"]);
    expect(sessionClose).toHaveBeenCalledTimes(2); await adapter.disconnect();
  });
  it.each([
    { message: "Unknown function 'elementId'.", code: "Neo.ClientError.Statement.SyntaxError" },
    { message: "Function 'elementId' doesn't exist.", code: "Memgraph.ClientError.MemgraphError.MemgraphError" },
  ])("verifies id fallback for the observed unsupported-capability shape $code", async ({message,code}) => {
    run.mockImplementation(async (query) => {
      if (query.includes("elementId")) throw Object.assign(new Error(message), { code });
      return {};
    });
    const adapter = new CypherGraphAdapter(); await adapter.connect(config);
    expect(run.mock.calls.map(([query]) => query)).toEqual(["RETURN 1 as test", "RETURN elementId(null) AS id", "RETURN id(null) AS id"]);
    expect(sessionClose).toHaveBeenCalledTimes(2); await adapter.disconnect();
  });
  it.each(["authentication failed private-password", "network failed elementId private-password", "invalid syntax elementId", "unknown function other"])("propagates %s instead of false fallback and releases driver", async (message) => {
    run.mockImplementation(async (query) => { if (query.includes("elementId")) throw new Error(message); return {}; });
    const adapter = new CypherGraphAdapter();
    try { await adapter.connect(config); throw new Error("unexpected success"); } catch (error) {
      expect(String(error)).not.toContain("private-password"); expect(JSON.stringify(error)).not.toContain("secret-user");
    }
    expect(run.mock.calls.some(([query]) => query.includes("RETURN id("))).toBe(false);
    expect(driverClose).toHaveBeenCalledTimes(1); expect(sessionClose).toHaveBeenCalledTimes(2); expect(await adapter.isConnected()).toBe(false);
  });
  it("failed reachability closes the driver without creating sessions", async () => {
    verifyConnectivity.mockRejectedValue(new Error("private-password connection refused"));
    const adapter = new CypherGraphAdapter(); await expect(adapter.connect(config)).rejects.toThrow(/connection failed/);
    expect(driver.session).not.toHaveBeenCalled(); expect(driverClose).toHaveBeenCalledTimes(1);
  });
  it("fallback failure closes both driver and sessions", async () => {
    run.mockImplementation(async (query) => {
      if (query.includes("elementId")) throw new Error("Unknown function elementId");
      if (query.includes("id(null)")) throw new Error("authentication failed private-password"); return {};
    });
    const adapter = new CypherGraphAdapter(); await expect(adapter.connect(config)).rejects.toThrow(/authentication failed/);
    expect(driverClose).toHaveBeenCalledTimes(1); expect(sessionClose).toHaveBeenCalledTimes(2);
  });
});
