/**
 * Unit tests for cortex.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { create, client } = vi.hoisted(() => ({
  create: vi.fn(),
  client: { memory: {}, close: vi.fn(), shutdown: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@cortexmemory/sdk", () => ({ Cortex: { create } }));

// Mock the display module before importing cortex
vi.mock("../display.js", () => ({
  printLayerUpdate: vi.fn(),
  // Phase-aware print functions (v0.35.1+)
  printRecallStart: vi.fn(),
  printRecallComplete: vi.fn(),
  printRememberStart: vi.fn(),
  printRememberComplete: vi.fn(),
  // Legacy (deprecated)
  printOrchestrationStart: vi.fn(),
}));

describe("cortex", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    create.mockReset().mockResolvedValue(client);
    client.shutdown.mockReset().mockResolvedValue(undefined);
    client.close.mockClear();
    process.env = { ...originalEnv, CORTEX_APP_DEPLOYMENT_ADMIN_KEY: "basic-unit-key" };
    delete process.env.CONVEX_DEPLOY_KEY;
    delete process.env.USER_ID;
    delete process.env.CORTEX_APP_TENANT_ID;
    delete process.env.OPENAI_API_KEY;
    delete process.env.CORTEX_FACT_EXTRACTION_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("CONFIG", () => {
    it("uses default values when environment variables are not set", async () => {
      delete process.env.MEMORY_SPACE_ID;
      delete process.env.USER_ID;
      delete process.env.USER_NAME;
      delete process.env.AGENT_ID;
      delete process.env.AGENT_NAME;
      delete process.env.CORTEX_FACT_EXTRACTION;
      delete process.env.CORTEX_GRAPH_SYNC;
      delete process.env.DEBUG;

      const { CONFIG } = await import("../cortex.js");

      expect(CONFIG.memorySpaceId).toBe("basic-demo");
      expect(CONFIG.userId).toBe("demo-user");
      expect(CONFIG.userName).toBe("Demo User");
      expect(CONFIG.agentId).toBe("basic-assistant");
      expect(CONFIG.agentName).toBe("Cortex CLI Assistant");
      expect(CONFIG.enableFactExtraction).toBe(true);
      expect(CONFIG.enableGraphMemory).toBe(false);
      expect(CONFIG.debug).toBe(false);
    });

    it("uses environment variables when set", async () => {
      process.env.MEMORY_SPACE_ID = "custom-space";
      process.env.USER_ID = "custom-user";
      process.env.USER_NAME = "Custom User";
      process.env.AGENT_ID = "custom-agent";
      process.env.AGENT_NAME = "Custom Agent";
      process.env.CORTEX_FACT_EXTRACTION = "false";
      process.env.CORTEX_GRAPH_SYNC = "true";
      process.env.DEBUG = "true";

      const { CONFIG } = await import("../cortex.js");

      expect(CONFIG.memorySpaceId).toBe("custom-space");
      expect(CONFIG.userId).toBe("custom-user");
      expect(CONFIG.userName).toBe("Custom User");
      expect(CONFIG.agentId).toBe("custom-agent");
      expect(CONFIG.agentName).toBe("Custom Agent");
      expect(CONFIG.enableFactExtraction).toBe(false);
      expect(CONFIG.enableGraphMemory).toBe(true);
      expect(CONFIG.debug).toBe(true);
    });
  });

  describe("async client lifecycle", () => {
    it("refuses cold getCortex and missing initialization URL", async () => {
      delete process.env.CONVEX_URL;
      const { getCortex, initCortex } = await import("../cortex.js");
      expect(() => getCortex()).toThrow("not initialized");
      await expect(initCortex()).rejects.toThrow("CONVEX_URL environment variable is required");
      expect(create).not.toHaveBeenCalled();
    });
    it("requires one selected private key before SDK construction", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";
      delete process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY;
      const { initCortex } = await import("../cortex.js");
      await expect(initCortex()).rejects.toThrow("CORTEX_APP_DEPLOYMENT_ADMIN_KEY is required");
      process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY = "first-unit-key";
      process.env.CONVEX_DEPLOY_KEY = "different-unit-key";
      await expect(initCortex()).rejects.toThrow("Conflicting private deployment credentials");
      expect(create).not.toHaveBeenCalled();
    });
    it("forwards CLI private transport once without storing the key in public config", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";
      delete process.env.CORTEX_APP_DEPLOYMENT_ADMIN_KEY;
      process.env.CONVEX_DEPLOY_KEY = "cli-unit-key";
      const { initCortex } = await import("../cortex.js");
      await initCortex();
      const [config, runtime] = create.mock.calls[0];
      expect(runtime.deploymentOperator).toBe(true);
      expect(JSON.stringify(config)).not.toContain("cli-unit-key");
      const setAdminAuth = vi.fn();
      expect(runtime.initializeTransport({ setAdminAuth })).toBeUndefined();
      expect(setAdminAuth).toHaveBeenCalledExactlyOnceWith("cli-unit-key");
      expect(() => runtime.initializeTransport({})).toThrow("private deployment transport");
    });
    it("initializes once for concurrent calls and returns the initialized singleton", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";
      const { getCortex, initCortex } = await import("../cortex.js");
      const [one, two] = await Promise.all([initCortex(), initCortex()]);
      expect(one).toBe(client);
      expect(two).toBe(one);
      expect(getCortex()).toBe(one);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({ convexUrl: "https://test.convex.cloud", auth: { userId: "demo-user", tenantId: "basic-demo" } }, expect.objectContaining({ deploymentOperator: true, initializeTransport: expect.any(Function) }));
    });
    it("allows a genuine retry after failed creation", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";
      create.mockRejectedValueOnce(new Error("offline fixture refused"));
      const { initCortex, getCortex } = await import("../cortex.js");
      await expect(initCortex()).rejects.toThrow("offline fixture refused");
      expect(() => getCortex()).toThrow("not initialized");
      expect(await initCortex()).toBe(client);
      expect(create).toHaveBeenCalledTimes(2);
    });
    it("joins shutdown, closes once, and permits a fresh initialization", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";
      const { initCortex, getCortex, closeCortex } = await import("../cortex.js");
      await initCortex();
      let finish!: () => void;
      client.shutdown.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
      let done = false;
      const closing = closeCortex().then(() => { done = true; });
      const again = closeCortex();
      await Promise.resolve();
      expect(done).toBe(false);
      expect(client.shutdown).toHaveBeenCalledTimes(1);
      expect(client.close).not.toHaveBeenCalled();
      expect(() => getCortex()).toThrow("not initialized");
      finish();
      await Promise.all([closing, again]);
      expect(done).toBe(true);
      expect(await initCortex()).toBe(client);
      expect(create).toHaveBeenCalledTimes(2);
    });
    it("joins pending startup before shutdown and propagates cleanup failure", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";
      let finish!: (value: typeof client) => void;
      create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      const { initCortex, closeCortex } = await import("../cortex.js");
      const starting = initCortex();
      const closing = closeCortex();
      expect(client.shutdown).not.toHaveBeenCalled();
      finish(client);
      await starting;
      await closing;
      expect(client.shutdown).toHaveBeenCalledTimes(1);
      await initCortex();
      client.shutdown.mockRejectedValueOnce(new Error("cleanup failed"));
      await expect(closeCortex()).rejects.toThrow("cleanup failed");
    });
    it("does nothing when there is no owned client", async () => {
      const { closeCortex } = await import("../cortex.js");
      await closeCortex();
      expect(client.shutdown).not.toHaveBeenCalled();
    });
    it("configures fact extraction through the SDK factory instead of unsupported RememberParams fields", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";
      process.env.OPENAI_API_KEY = "synthetic-unit-key";
      process.env.CORTEX_FACT_EXTRACTION = "true";
      const { initCortex } = await import("../cortex.js");
      await initCortex();
      expect(create).toHaveBeenCalledWith({ convexUrl: "https://test.convex.cloud", auth: { userId: "demo-user", tenantId: "basic-demo" }, llm: { provider: "openai", apiKey: "synthetic-unit-key", model: "gpt-4o-mini" } }, expect.objectContaining({ deploymentOperator: true }));
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase-Aware Observers (v0.35.1+)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createRecallObserver", () => {
    it("returns an observer with recall phase methods", async () => {
      const { createRecallObserver } = await import("../cortex.js");

      const observer = createRecallObserver();

      expect(observer).toHaveProperty("onRecallStart");
      expect(observer).toHaveProperty("onLayerUpdate");
      expect(observer).toHaveProperty("onRecallComplete");
      expect(typeof observer.onRecallStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onRecallComplete).toBe("function");
    });

    it("calls printRecallStart on recall start", async () => {
      const { printRecallStart } = await import("../display.js");
      const { createRecallObserver } = await import("../cortex.js");

      const observer = createRecallObserver();
      observer.onRecallStart?.("test-id");

      expect(printRecallStart).toHaveBeenCalledWith("test-id");
    });

    it("calls printLayerUpdate on layer update", async () => {
      const { printLayerUpdate } = await import("../display.js");
      const { createRecallObserver } = await import("../cortex.js");

      const observer = createRecallObserver();
      const event = {
        layer: "vector" as const,
        status: "complete" as const,
        timestamp: Date.now(),
        latencyMs: 100,
        phase: "recall" as const,
      };
      observer.onLayerUpdate?.(event);

      expect(printLayerUpdate).toHaveBeenCalledWith(event);
    });
  });

  describe("createRememberObserver", () => {
    it("returns an observer with remember phase methods", async () => {
      const { createRememberObserver } = await import("../cortex.js");

      const observer = createRememberObserver();

      expect(observer).toHaveProperty("onRememberStart");
      expect(observer).toHaveProperty("onLayerUpdate");
      expect(observer).toHaveProperty("onRememberComplete");
      expect(typeof observer.onRememberStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onRememberComplete).toBe("function");
    });

    it("calls printRememberStart on remember start", async () => {
      const { printRememberStart } = await import("../display.js");
      const { createRememberObserver } = await import("../cortex.js");

      const observer = createRememberObserver();
      observer.onRememberStart?.("test-id");

      expect(printRememberStart).toHaveBeenCalledWith("test-id");
    });

    it("calls printLayerUpdate on layer update", async () => {
      const { printLayerUpdate } = await import("../display.js");
      const { createRememberObserver } = await import("../cortex.js");

      const observer = createRememberObserver();
      const event = {
        layer: "facts" as const,
        status: "complete" as const,
        timestamp: Date.now(),
        latencyMs: 100,
        phase: "remember" as const,
      };
      observer.onLayerUpdate?.(event);

      expect(printLayerUpdate).toHaveBeenCalledWith(event);
    });
  });

  describe("createLayerObserver (legacy)", () => {
    it("returns an observer with remember phase methods for backward compatibility", async () => {
      const { createLayerObserver } = await import("../cortex.js");

      const observer = createLayerObserver();

      expect(observer).toHaveProperty("onRememberStart");
      expect(observer).toHaveProperty("onLayerUpdate");
      expect(observer).toHaveProperty("onRememberComplete");
      expect(typeof observer.onRememberStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onRememberComplete).toBe("function");
    });
  });

  describe("getEmbeddingProvider", () => {
    it("returns undefined when OPENAI_API_KEY is not set", async () => {
      delete process.env.OPENAI_API_KEY;

      const { getEmbeddingProvider } = await import("../cortex.js");
      const provider = await getEmbeddingProvider();

      expect(provider).toBeUndefined();
    });

    it("returns embedding function when OPENAI_API_KEY is set", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";

      // Mock OpenAI
      vi.doMock("openai", () => ({
        default: vi.fn().mockImplementation(function () { return ({
          embeddings: {
            create: vi.fn().mockResolvedValue({
              data: [{ embedding: new Array(1536).fill(0.1) }],
            }),
          },
        }); }),
      }));

      const { getEmbeddingProvider } = await import("../cortex.js");
      const provider = await getEmbeddingProvider();

      expect(provider).toBeDefined();
      expect(typeof provider).toBe("function");
    });
  });

  describe("buildRememberParams", () => {
    it("builds params with CONFIG values", async () => {
      delete process.env.OPENAI_API_KEY;

      const { buildRememberParams, CONFIG } = await import("../cortex.js");

      const params = await buildRememberParams({
        userMessage: "Hello",
        agentResponse: "Hi there",
        conversationId: "conv-123",
      });

      expect(params.memorySpaceId).toBe(CONFIG.memorySpaceId);
      expect(params.userId).toBe(CONFIG.userId);
      expect(params.userName).toBe(CONFIG.userName);
      expect(params.agentId).toBe(CONFIG.agentId);
      expect(params.userMessage).toBe("Hello");
      expect(params.agentResponse).toBe("Hi there");
      expect(params.conversationId).toBe("conv-123");
    });

    it("keeps client-level fact extraction out of RememberParams", async () => {
      delete process.env.OPENAI_API_KEY;
      const { buildRememberParams } = await import("../cortex.js");
      const params = await buildRememberParams({ userMessage: "Hello", agentResponse: "Hi", conversationId: "conv-123" });
      expect(params.userMessage).toBe("Hello");
      expect(params).not.toHaveProperty("extractFacts");
      expect(params).not.toHaveProperty("beliefRevision");
    });
  });
});
