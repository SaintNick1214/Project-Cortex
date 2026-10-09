/** Public transport configuration through the actual Cortex constructor and factory. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ConvexClientOptions } from "convex/browser";
import type { Cortex as CortexInstance, CortexConfig } from "../../src/index";
import { ConversationsAPI } from "../../src/conversations";
import { MemoryAPI } from "../../src/memory";
import { MemorySpacesAPI } from "../../src/memorySpaces";

type MockClient = { close: ReturnType<typeof jest.fn<() => Promise<void>>> };
type TransportLogger = Exclude<ConvexClientOptions["logger"], boolean | undefined>;
const makeClient = (): MockClient => ({
  close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
});
const convexConstructor = jest.fn<
  (url: string, options?: ConvexClientOptions) => MockClient
>();

jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(), ConvexClient: convexConstructor }));
const { Cortex } = await import("../../src/index");

const config: CortexConfig = {
  convexUrl: "http://127.0.0.1:43210",
  resilience: { enabled: false },
};
const instances: CortexInstance[] = [];
function construct(convexLogger?: CortexConfig["convexLogger"]): CortexInstance {
  const instance = new Cortex({ ...config, convexLogger });
  instances.push(instance);
  return instance;
}
function makeLogger() {
  return {
    log: jest.fn<(...args: unknown[]) => void>(),
    warn: jest.fn<(...args: unknown[]) => void>(),
    error: jest.fn<(...args: unknown[]) => void>(),
    logVerbose: jest.fn<(...args: unknown[]) => void>(),
  } satisfies TransportLogger;
}

beforeEach(() => {
  convexConstructor.mockReset();
  convexConstructor.mockImplementation(makeClient);
});
afterEach(() => {
  for (const instance of instances.splice(0)) instance.close();
});

describe("Cortex Convex transport logger", () => {
  it("preserves the one-argument constructor when the option is absent", () => {
    const instance = new Cortex(config);
    instances.push(instance);
    expect(convexConstructor).toHaveBeenCalledWith(config.convexUrl);
    expect(convexConstructor.mock.calls[0]).toHaveLength(1);
  });

  it("also preserves defaults for an explicitly undefined option", () => {
    construct(undefined);
    expect(convexConstructor.mock.calls[0]).toEqual([config.convexUrl]);
  });

  it.each([false, true])("forwards the explicit boolean logger %s", (logger) => {
    construct(logger);
    expect(convexConstructor).toHaveBeenCalledWith(config.convexUrl, { logger });
  });

  it("forwards a structured logger without wrapping or changing its methods", () => {
    const logger = makeLogger();
    construct(logger);
    const options = convexConstructor.mock.calls[0][1];
    expect(options).toEqual({ logger });
    expect(options?.logger).toBe(logger);
    expect(Object.keys(logger).sort()).toEqual(["error", "log", "logVerbose", "warn"]);
  });

  it.each(["log", "warn", "error", "logVerbose"] as const)(
    "lets Convex invoke the supplied %s method", (method) => {
      const logger = makeLogger();
      convexConstructor.mockImplementation((_url, options) => {
        const transportLogger = options?.logger;
        if (!transportLogger || typeof transportLogger === "boolean") {
          throw new Error("Expected the supplied structured logger");
        }
        transportLogger[method]("transport sentinel", { operation: "query" });
        return makeClient();
      });
      construct(logger);
      expect(logger[method]).toHaveBeenCalledWith("transport sentinel", { operation: "query" });
      expect(logger[method]).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, makeLogger()])("forwards explicit logging through Cortex.create", async (logger) => {
    const instance = await Cortex.create({ ...config, convexLogger: logger });
    instances.push(instance);
    expect(convexConstructor).toHaveBeenCalledWith(config.convexUrl, { logger });
    expect(convexConstructor.mock.calls[0][1]?.logger).toBe(logger);
  });

  it("retains omitted logging through Cortex.create", async () => {
    instances.push(await Cortex.create(config));
    expect(convexConstructor.mock.calls[0]).toEqual([config.convexUrl]);
  });

  it("keeps custom and default logging isolated across instances", () => {
    const logger = makeLogger();
    const custom = construct(logger);
    const normal = new Cortex(config);
    instances.push(normal);
    const silent = construct(false);
    expect(convexConstructor.mock.calls).toEqual([
      [config.convexUrl, { logger }], [config.convexUrl], [config.convexUrl, { logger: false }],
    ]);
    expect(custom.getClient()).not.toBe(normal.getClient());
    expect(silent.getClient()).not.toBe(custom.getClient());
    expect(config).not.toHaveProperty("convexLogger");
  });

  it("initializes the existing domain APIs around the selected client", () => {
    const instance = construct(false);
    expect(instance.getClient()).toBe(convexConstructor.mock.results[0].value);
    expect(instance.conversations).toBeInstanceOf(ConversationsAPI);
    expect(instance.memory).toBeInstanceOf(MemoryAPI);
    expect(instance.memorySpaces).toBeInstanceOf(MemorySpacesAPI);
    for (const namespace of [
      "immutable", "mutable", "vector", "facts", "contexts", "users", "agents",
      "governance", "a2a", "sessions", "artifacts", "attachments",
    ] as const) {
      const expectedName = namespace === "a2a" ? "A2AAPI" : `${namespace[0].toUpperCase()}${namespace.slice(1)}API`;
      expect(instance[namespace].constructor.name).toBe(expectedName);
    }
  });

  it("propagates an underlying client constructor error", () => {
    const failure = new Error("transport constructor failure");
    convexConstructor.mockImplementation(() => { throw failure; });
    expect(() => new Cortex({ ...config, convexLogger: false })).toThrow(failure);
  });

  it("propagates an underlying constructor error through the factory", async () => {
    const failure = new Error("transport constructor failure");
    convexConstructor.mockImplementation(() => { throw failure; });
    await expect(Cortex.create({ ...config, convexLogger: false })).rejects.toBe(failure);
  });

  it.each(["constructor", "factory"])("propagates an application logger error from the %s", async (entry) => {
    const failure = new Error("application logger failure");
    const logger = makeLogger();
    logger.error.mockImplementation(() => { throw failure; });
    convexConstructor.mockImplementation((_url, options) => {
      if (!options?.logger || typeof options.logger === "boolean") {
        throw new Error("Expected application logger");
      }
      options.logger.error("transport failure");
      return makeClient();
    });
    if (entry === "factory") {
      await expect(Cortex.create({ ...config, convexLogger: logger })).rejects.toBe(failure);
    } else {
      expect(() => new Cortex({ ...config, convexLogger: logger })).toThrow(failure);
    }
    expect(logger.error).toHaveBeenCalledWith("transport failure");
  });
});
