import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { CLIConfig } from "../../types.js";
const auth = jest.fn((value: unknown) => value);
const reader = jest.fn(async (_directory: string) => ({ provider: "neo4j", uri: "bolt://127.0.0.1:1", credentials: { username: "graph-user", password: "private-graph-password" } }));
let importedReader = 0;
jest.unstable_mockModule("../graph/service.js", () => { importedReader++; return { readSelectedGraphConfiguration: reader }; });
const instances: Array<{ config: unknown; shutdown: ReturnType<typeof jest.fn>; close: ReturnType<typeof jest.fn>; list: ReturnType<typeof jest.fn> }> = [];
const adapters: Array<{ adapter: unknown; connect: ReturnType<typeof jest.fn>; disconnect: ReturnType<typeof jest.fn> }> = [];
const order: string[] = [];
let constructorFailure = false, connectFailure = false, schemaFailure = false, disconnectFailure = false, shutdownFailure = false;
const compatibility = jest.fn(async () => { order.push("schema"); if (schemaFailure) throw new Error("private-graph-password schema failure"); });
const resolveGraph = jest.fn((options: { connection: unknown }, _env: unknown) => options.connection);
const disposal = { close: jest.fn() };
const createDisposal = jest.fn((_target: unknown) => disposal);
const automationObserved: Array<string | undefined> = [];
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(() => ({ setAdminAuth: jest.fn(), function: jest.fn(), query: jest.fn(), mutation: jest.fn(), action: jest.fn() })) }));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({
  createAuthContext: auth,
  resolveGraphConnection: resolveGraph,
  assertManagedGraphCompatibility: compatibility,
  createGraphErasureTransport: createDisposal,
  CypherGraphAdapter: jest.fn(() => {
    const adapter = {
      connect: jest.fn(async () => { order.push("connect"); if (connectFailure) throw new Error("private-graph-password connect failure"); }),
      disconnect: jest.fn(async () => { order.push("disconnect"); if (disconnectFailure) throw new Error("private-graph-password disconnect failure"); }),
    };
    adapters.push({ adapter, connect: adapter.connect, disconnect: adapter.disconnect }); return adapter;
  }),
  Cortex: jest.fn((config: unknown, runtime: { initializeTransport: (value: never) => undefined }) => {
    automationObserved.push(process.env.CORTEX_FACT_EXTRACTION, process.env.CORTEX_EMBEDDING);
    if (constructorFailure) throw new Error("constructor failed");
    const close = jest.fn(async () => { order.push("close"); });
    const transport = { close, query: jest.fn(), mutation: jest.fn(), action: jest.fn() };
    runtime.initializeTransport(transport as never);
    const list = jest.fn(async () => ({ spaces: [] }));
    const shutdown = jest.fn(async () => { order.push("shutdown"); await transport.close(); if (shutdownFailure) throw new Error("private-graph-password SDK cleanup failed"); });
    instances.push({ config, close, shutdown, list });
    return { shutdown, close: () => transport.close(), memorySpaces: { list }, getClient: () => transport };
  }),
}));
const { createClient, disposeClient, closeClient, withClient, getErasureGraphParticipant, testConnection } = await import("../client.js");
let root: string;
const originalFlags = [process.env.CORTEX_FACT_EXTRACTION, process.env.CORTEX_EMBEDDING];
let config: CLIConfig;
beforeEach(async () => {
  await closeClient();
  root = realpathSync(mkdtempSync(join(tmpdir(), "cortex-client-owned-")));
  config = { deployments: { one: { url: "http://127.0.0.1:1", projectPath: root }, two: { url: "http://127.0.0.1:2" } }, default: "one", format: "json", confirmDangerous: true };
  instances.length = 0; adapters.length = 0; order.length = 0; automationObserved.length = 0;
  constructorFailure = false; connectFailure = false; schemaFailure = false; disconnectFailure = false; shutdownFailure = false;
  jest.clearAllMocks();
});
afterEach(async () => {
  await closeClient(); rmSync(root, { recursive: true, force: true });
  ["CORTEX_FACT_EXTRACTION", "CORTEX_EMBEDDING"].forEach((name, index) => { if (originalFlags[index] === undefined) delete process.env[name]; else process.env[name] = originalFlags[index]; });
});
function configured(): void { mkdirSync(join(root, ".cortex", "graph"), { recursive: true }); }
it("ordinary explicit scope is caller data, independent of selected target and deployment authority", async () => {
  const client = await createClient(config, { deployment: "two", scopeUser: "caller", tenant: " tenant-A ", graphSync: "off" });
  expect(auth).toHaveBeenCalledWith({ userId: "caller", tenantId: " tenant-A " });
  expect(instances[0].config).toMatchObject({ convexUrl: "http://127.0.0.1:2", auth: { userId: "caller", tenantId: " tenant-A " }, graphEnabled: false });
  await disposeClient(client); expect(instances[0].shutdown).toHaveBeenCalledTimes(1);
});
it.each([{ tenant: "A" }, { scopeUser: " " }, { tenant: " ", maintenance: true }, { graphSync: "bad" as "auto" }])("invalid ordinary scope or graph option %j refuses before config/adapter/client", async options => {
  configured(); await expect(createClient(config, options)).rejects.toThrow();
  expect(reader).not.toHaveBeenCalled(); expect(adapters).toHaveLength(0); expect(instances).toHaveLength(0);
});
it("maintenance exact tenant without caller never fabricates an AuthContext", async () => {
  const client = await createClient(config, { maintenance: true, tenant: "A", graphSync: "off" });
  expect(auth).not.toHaveBeenCalled(); expect(instances[0].config).not.toHaveProperty("auth"); await disposeClient(client);
});
it("graph off ignores selected marker and never imports reader, constructs adapter or consumes ambient tuples", async () => {
  configured(); const before = importedReader;
  await withClient(config, { graphSync: "off" }, async () => "off");
  expect(reader).not.toHaveBeenCalled(); expect(importedReader).toBe(before); expect(resolveGraph).not.toHaveBeenCalled(); expect(adapters).toHaveLength(0);
});
it("auto without explicit selected configuration is off, while required refuses without client", async () => {
  await withClient(config, { deployment: "two" }, async () => "off");
  const count = instances.length;
  await expect(createClient(config, { deployment: "two", graphSync: "required" })).rejects.toThrow("no explicit project");
  await expect(createClient(config, { graphSync: "required" })).rejects.toThrow("configure the selected");
  expect(instances).toHaveLength(count); expect(reader).not.toHaveBeenCalled();
});
it("configured graph resolves a complete explicit tuple/empty env and readonly schema before callback", async () => {
  configured();
  expect(await withClient(config, {}, async () => { order.push("operation"); return "result"; })).toBe("result");
  expect(reader).toHaveBeenCalledWith(root); expect(resolveGraph).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, connection: { type: "neo4j", uri: "bolt://127.0.0.1:1", username: "graph-user", password: "private-graph-password" } }), {});
  expect(instances[0].config).toMatchObject({ graph: { adapter: adapters[0].adapter, autoSync: false }, graphEnabled: false });
  expect(order).toEqual(["connect", "schema", "operation", "shutdown", "close", "disconnect"]);
  expect(adapters[0].disconnect).toHaveBeenCalledTimes(1);
});
it.each(["connect", "schema"])("graph %s failure is sanitized and precedes SDK/primary effects", async kind => {
  configured(); connectFailure = kind === "connect"; schemaFailure = kind === "schema";
  const callback = jest.fn(async () => "mutation");
  await expect(withClient(config, {}, callback)).rejects.toThrow("No command operation was started");
  expect(callback).not.toHaveBeenCalled(); expect(instances).toHaveLength(0); expect(adapters[0].disconnect).toHaveBeenCalledTimes(1);
});
it("concurrent idempotent disposal awaits the same SDK drain then exactly one adapter disconnect", async () => {
  configured(); const client = await createClient(config, {});
  let finish!: () => void; const wait = new Promise<void>(resolve => { finish = resolve; });
  instances[0].shutdown.mockImplementation(async () => { order.push("shutdown"); await wait; });
  const first = disposeClient(client), second = disposeClient(client);
  expect(first).toBe(second); expect(adapters[0].disconnect).not.toHaveBeenCalled();
  finish(); await Promise.all([first, second]); await disposeClient(client);
  expect(instances[0].shutdown).toHaveBeenCalledTimes(1); expect(adapters[0].disconnect).toHaveBeenCalledTimes(1);
});
it("operation error wins over cleanup error; cleanup errors never expose password and successful operation cannot hide them", async () => {
  configured(); disconnectFailure = true;
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(withClient(config, {}, async () => { throw new Error("primary failed"); })).rejects.toThrow("primary failed");
    expect(error.mock.calls.flat().join(" ")).not.toContain("private-graph-password");
    await expect(withClient(config, {}, async () => "success")).rejects.toThrow("cleanup failed");
  } finally { error.mockRestore(); }
  expect(adapters[0].disconnect).toHaveBeenCalledTimes(1); expect(adapters[1].disconnect).toHaveBeenCalledTimes(1);
});
it("SDK cleanup failure still attempts owned graph disconnect", async () => {
  configured(); shutdownFailure = true;
  await expect(withClient(config, {}, async () => "success")).rejects.toThrow("cleanup failed");
  expect(adapters[0].disconnect).toHaveBeenCalledTimes(1); expect(instances[0].close).toHaveBeenCalledTimes(1);
});
it("same-process concurrent commands own distinct targets/scopes and cannot close another active operation", async () => {
  let finish!: () => void, started!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; }), active = new Promise<void>(resolve => { started = resolve; });
  const first = withClient(config, { scopeUser: "caller-A", tenant: "A", graphSync: "off" }, async () => { started(); await wait; return "A"; });
  await active;
  expect(await withClient(config, { deployment: "two", scopeUser: "caller-B", tenant: "B", graphSync: "off" }, async () => "B")).toBe("B");
  expect(instances[0].shutdown).not.toHaveBeenCalled(); expect(instances[1].shutdown).toHaveBeenCalledTimes(1);
  finish(); expect(await first).toBe("A"); expect(instances[0].shutdown).toHaveBeenCalledTimes(1);
  expect(instances.map(instance => instance.config)).toEqual([expect.objectContaining({ auth: { userId: "caller-A", tenantId: "A" } }), expect.objectContaining({ auth: { userId: "caller-B", tenantId: "B" } })]);
});
it("maintenance graph participant is the owned selected adapter plus one fixed target transport closed before shutdown", async () => {
  configured(); const client = await createClient(config, { maintenance: true });
  const target = { url: "http://127.0.0.1:1", deploymentKey: "explicit-admin-key" };
  const first = await getErasureGraphParticipant(client, target), again = await getErasureGraphParticipant(client, target);
  expect(first).toBe(again); expect(first).toEqual({ adapter: adapters[0].adapter, disposalTransport: disposal }); expect(createDisposal).toHaveBeenCalledTimes(1); expect(createDisposal).toHaveBeenCalledWith(target);
  await disposeClient(client); expect(disposal.close).toHaveBeenCalledTimes(1); expect(instances[0].shutdown).toHaveBeenCalledTimes(1);
});
it.each([false, true])("synchronous construction masks both paid automation gates and restores exact presence/bytes (present=%s)", async present => {
  if (present) { process.env.CORTEX_FACT_EXTRACTION = "true"; process.env.CORTEX_EMBEDDING = "custom-original"; }
  else { delete process.env.CORTEX_FACT_EXTRACTION; delete process.env.CORTEX_EMBEDDING; }
  const client = await createClient(config, { graphSync: "off" });
  expect(automationObserved).toEqual(["false", "false"]); expect(instances[0].config).not.toHaveProperty("llm"); expect(instances[0].config).not.toHaveProperty("embedding");
  expect(process.env.CORTEX_FACT_EXTRACTION).toBe(present ? "true" : undefined); expect(process.env.CORTEX_EMBEDDING).toBe(present ? "custom-original" : undefined);
  await disposeClient(client);
});
it("throwing synchronous constructor restores both ambient gates and disposes already-connected owned graph", async () => {
  configured(); process.env.CORTEX_FACT_EXTRACTION = "true"; delete process.env.CORTEX_EMBEDDING; constructorFailure = true;
  await expect(createClient(config, {})).rejects.toThrow("constructor failed");
  expect(automationObserved).toEqual(["false", "false"]); expect(process.env.CORTEX_FACT_EXTRACTION).toBe("true"); expect(process.env.CORTEX_EMBEDDING).toBeUndefined(); expect(adapters[0].disconnect).toHaveBeenCalledTimes(1);
});

it("never-resolving SDK shutdown has a finite failed observation, attempts graph cleanup, and clears its timer", async () => {
  configured(); jest.useFakeTimers();
  try {
    const client = await createClient(config, {});
    instances[0].shutdown.mockImplementation(() => new Promise<void>(() => {}));
    const drain = disposeClient(client); const rejected = expect(drain).rejects.toThrow("cleanup failed");
    await jest.advanceTimersByTimeAsync(5001); await rejected;
    expect(adapters[0].disconnect).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
it.each([true, false])("connection diagnostics retain structured failed observations when required cleanup never resolves (connected=%s)", async connected => {
  jest.useFakeTimers();
  try {
    const sdk = (await import("@cortexmemory/sdk")).Cortex as unknown as ReturnType<typeof jest.fn>;
    const original = sdk.getMockImplementation()!;
    sdk.mockImplementationOnce((...args: unknown[]) => { const client = original(...args); instances.at(-1)!.shutdown.mockImplementation(() => new Promise<void>(() => {})); if (!connected) instances.at(-1)!.list.mockRejectedValue(new Error("denied")); return client; });
    const result = testConnection(config, { graphSync: "off" });
    await jest.advanceTimersByTimeAsync(5001);
    expect(await result).toEqual({ connected: false, url: config.deployments.one.url, error: expect.stringContaining("cleanup remains unconfirmed") });
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
