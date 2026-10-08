import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import type { CLIConfig } from "../../types.js";
const instances: Array<{
  close: ReturnType<typeof jest.fn>;
  admin: ReturnType<typeof jest.fn>;
}> = [];
let capability = true;
let authFailure = false;
let ignoreInitialization = false;
const operation = jest.fn<(_options: { limit: number }) => Promise<unknown>>();
const constructor = jest.fn(
  (_options: {
    convexUrl: string;
    convexLogger: { log: (...args: unknown[]) => void };
  }, runtime?: { initializeTransport?: (transport: never) => undefined }) => {
    const close = jest.fn();
    const admin = jest.fn(() => {
      if (authFailure) throw new Error("secret-from-server");
    });
    instances.push({ close, admin });
    const transport = { close, query: (_ref: unknown, args: {limit: number}) => operation(args), mutation: jest.fn(), action: jest.fn(), setAdminAuth: admin };
    try { if (!ignoreInitialization) runtime?.initializeTransport?.(transport as never); } catch (error) { close(); throw error; }
    return {
      shutdown: async () => { await transport.close(); }, close: () => transport.close(),
      getClient: () => (capability ? { setAdminAuth: admin } : {}),
      memorySpaces: { list: (args: {limit: number}) => transport.query(undefined, args) },
    };
  },
);
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(() => ({
  ...(capability ? {setAdminAuth: instances.at(-1)!.admin} : {}),
  query: (_ref: unknown, args: {limit: number}) => operation(args),
  mutation: jest.fn(), action: jest.fn(),
})) }));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ createAuthContext: (value: unknown) => value, Cortex: constructor }));
const {
  createClient,
  disposeClient,
  closeClient,
  withClient,
  testConnection,
  getDeploymentInfo,
} = await import("../client.js");
const config: CLIConfig = {
  deployments: {
    cloud: { url: "https://example.convex.cloud", key: "first-key" },
  },
  default: "cloud",
  format: "table",
  confirmDangerous: true,
};
beforeEach(async () => {
  await closeClient();
  instances.length = 0;
  jest.clearAllMocks();
  capability = true;
  authFailure = false;
  ignoreInitialization = false;
  operation.mockResolvedValue({ spaces: [] });
});
afterEach(async () => {
  await closeClient();
  jest.useRealTimers();
});
describe("deployment-key adapter and owned lifetime", () => {
  it("sets admin auth but each exact URL+credential operation owns a fresh client", async () => {
    const first = await createClient(config, {});
    expect(await createClient(config, {})).not.toBe(first);
    expect(instances[0].admin).toHaveBeenCalledWith("first-key");
    expect(constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        convexUrl: config.deployments.cloud.url,
        convexLogger: expect.objectContaining({
          log: expect.any(Function),
          error: expect.any(Function),
        }),
      }),
      expect.objectContaining({initializeTransport: expect.any(Function)}),
    );
  });
  it("public logger hook sends redacted diagnostics to stderr", async () => {
    const stderr = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      await createClient(config, {});
      constructor.mock.calls[0][0].convexLogger.log(
        "network failure first-key",
      );
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining("network failure ***"),
      );
      expect(stderr.mock.calls.flat().join(" ")).not.toContain("first-key");
    } finally {
      stderr.mockRestore();
    }
  });
  it("changed or removed credentials own distinct clients without closing another active handle", async () => {
    const first = await createClient(config, {});
    const changed = await createClient(config, { key: "second-key" });
    expect(changed).not.toBe(first);
    expect(instances[0].close).not.toHaveBeenCalled();
    expect(instances[1].admin).toHaveBeenCalledWith("second-key");
    const anon = await createClient(
      {
        ...config,
        deployments: { cloud: { url: config.deployments.cloud.url } },
      },
      {},
    );
    expect(anon).not.toBe(changed);
    expect(instances[1].close).not.toHaveBeenCalled();
    expect(instances[2].admin).not.toHaveBeenCalled();
    await disposeClient(first);
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    expect(instances[1].close).not.toHaveBeenCalled();
    await disposeClient(changed);
    await disposeClient(anon);
  });
  it("unsupported runtime admin capability fails before query and closes", async () => {
    capability = false;
    await expect(createClient(config, {})).rejects.toThrow("does not support");
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    expect(operation).not.toHaveBeenCalled();
  });
  it("adapter failure is redacted, not reused and closed", async () => {
    authFailure = true;
    await expect(createClient(config, {})).rejects.toThrow(
      "Could not apply deployment credentials",
    );
    authFailure = false;
    await createClient(config, {});
    expect(constructor).toHaveBeenCalledTimes(2);
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it("refuses a constructor that ignores the keyed initializer before callback and cache", async () => {
    ignoreInitialization = true;
    const callback = jest.fn(async () => "anonymous-admission");
    await expect(withClient(config, {}, callback)).rejects.toThrow("does not support synchronous keyed transport initialization");
    expect(callback).not.toHaveBeenCalled(); expect(operation).not.toHaveBeenCalled();
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    ignoreInitialization = false;
    await createClient(config, {});
    expect(constructor).toHaveBeenCalledTimes(2);
  });
  it("operation rejection closes authenticated client", async () => {
    await expect(
      withClient(config, {}, async () => {
        throw new Error("rejected");
      }),
    ).rejects.toThrow("rejected");
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])("checks access and invokes the same operation-owned client once (key=%s)", async keyed => {
    const selected = keyed ? config : { ...config, deployments: { cloud: { url: config.deployments.cloud.url } } };
    const callback = jest.fn(async (value: unknown) => {
      expect(value).toMatchObject({ memorySpaces: { list: expect.any(Function) } });
      expect(operation).toHaveBeenCalledWith({ limit: 1 });
      expect(operation).toHaveBeenCalledTimes(1);
      return "command-result";
    });
    expect(await withClient(selected, {}, callback)).toBe("command-result");
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(instances[0].admin).toHaveBeenCalledTimes(keyed ? 1 : 0);
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it("refuses a rejected preflight without callback or credential/server echo", async () => {
    jest.useFakeTimers();
    operation.mockRejectedValue(new Error("401 first-key secret-from-server"));
    const callback = jest.fn(async () => "unauthorized");
    await expect(withClient(config, {}, callback)).rejects.toThrow(
      "Connection/access check failed; verify the selected deployment URL, deployment key and access. No command operation was started.",
    );
    expect(callback).not.toHaveBeenCalled();
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each(["resolve", "reject"])("timeout blocks a late %s from admitting the callback", async settlement => {
    jest.useFakeTimers();
    let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
    operation.mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    const callback = jest.fn(async () => "unauthorized");
    const pending = withClient(config, {}, callback);
    const refusal = expect(pending).rejects.toThrow("No command operation was started");
    await jest.advanceTimersByTimeAsync(2999);
    expect(callback).not.toHaveBeenCalled();
    expect(instances[0].close).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await refusal;
    if (settlement === "resolve") resolve({ spaces: [] });
    else reject(new Error("late first-key secret-from-server"));
    await Promise.resolve();
    expect(callback).not.toHaveBeenCalled();
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it("removes the preflight timer before an admitted long operation", async () => {
    jest.useFakeTimers();
    let finish!: (value: string) => void;
    const callback = jest.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const pending = withClient(config, {}, callback);
    await jest.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(60000);
    expect(instances[0].close).not.toHaveBeenCalled();
    finish("complete");
    await expect(pending).resolves.toBe("complete");
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it("connection success keeps its public schema and removes its timer", async () => {
    jest.useFakeTimers();
    expect(await testConnection(config, {})).toEqual({ connected: true, url: config.deployments.cloud.url, latency: 0 });
    expect(operation).toHaveBeenCalledWith({ limit: 1 });
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each([undefined, 17])("connection check retains its default/custom timeout (%s)", async timeout => {
    jest.useFakeTimers();
    operation.mockImplementation(() => new Promise(() => {}));
    const pending = testConnection(config, {}, timeout);
    await jest.advanceTimersByTimeAsync((timeout ?? 3000) - 1);
    expect(instances[0].close).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ connected: false, url: config.deployments.cloud.url });
    expect(instances[0].close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each([0, -1, 1.5, 60001, NaN, Infinity])("invalid connection timeout %s fails before client creation", async timeout => {
    await expect(testConnection(config, {}, timeout)).rejects.toThrow("Connection timeout must be an integer from 1 to 60000 ms");
    expect(constructor).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });
  it("connection auth rejection reports failure and releases client without key/server echo", async () => {
    operation.mockRejectedValue(new Error("401 first-key secret-from-server"));
    const result = await testConnection(config, {});
    expect(result.connected).toBe(false);
    expect(result.error).not.toContain("first-key");
    expect(result.error).not.toContain("secret-from-server");
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it("connection timeout closes a hanging client and reports failure", async () => {
    operation.mockImplementation(() => new Promise(() => {}));
    const result = await testConnection(config, {}, 5);
    expect(result.connected).toBe(false);
    expect(instances[0].close).toHaveBeenCalledTimes(1);
  });
  it.each([
    "http://localhost.attacker.invalid",
    "https://example.com/127.0.0.1",
  ])("does not misclassify %s as local", (url) => {
    if (new URL(url).pathname !== "/")
      expect(() => getDeploymentInfo(config, { url })).toThrow("Invalid URL");
    else expect(getDeploymentInfo(config, { url }).isLocal).toBe(false);
  });
  it("recognizes IPv6 loopback", () => {
    expect(
      getDeploymentInfo(config, { url: "http://[::1]:43210" }).isLocal,
    ).toBe(true);
  });
});
