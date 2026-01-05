/**
 * Unit tests for cortex.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the display module before importing cortex
vi.mock("../display.js", () => ({
  printLayerUpdate: vi.fn(),
  printOrchestrationStart: vi.fn(),
}));

describe("cortex", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
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

  describe("getCortex", () => {
    it("throws error when CONVEX_URL is not set", async () => {
      delete process.env.CONVEX_URL;

      const { getCortex } = await import("../cortex.js");

      expect(() => getCortex()).toThrow("CONVEX_URL environment variable is required");
    });

    it("creates Cortex client when CONVEX_URL is set", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";

      // Mock Cortex SDK
      vi.doMock("@cortexmemory/sdk", () => ({
        Cortex: vi.fn().mockImplementation(() => ({
          memory: {},
          close: vi.fn(),
        })),
      }));

      const { getCortex } = await import("../cortex.js");
      const cortex = getCortex();

      expect(cortex).toBeDefined();
      expect(cortex.memory).toBeDefined();
    });

    it("returns same instance on subsequent calls (singleton)", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";

      vi.doMock("@cortexmemory/sdk", () => ({
        Cortex: vi.fn().mockImplementation(() => ({
          memory: {},
          close: vi.fn(),
        })),
      }));

      const { getCortex } = await import("../cortex.js");

      const instance1 = getCortex();
      const instance2 = getCortex();

      expect(instance1).toBe(instance2);
    });
  });

  describe("closeCortex", () => {
    it("closes the client and resets singleton", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";

      const closeMock = vi.fn();
      vi.doMock("@cortexmemory/sdk", () => ({
        Cortex: vi.fn().mockImplementation(() => ({
          memory: {},
          close: closeMock,
        })),
      }));

      const { getCortex, closeCortex } = await import("../cortex.js");

      getCortex(); // Create instance
      closeCortex();

      expect(closeMock).toHaveBeenCalled();
    });

    it("does nothing when no client exists", async () => {
      const { closeCortex } = await import("../cortex.js");

      // Should not throw
      expect(() => closeCortex()).not.toThrow();
    });
  });

  describe("createLayerObserver", () => {
    it("returns an observer with required methods", async () => {
      const { createLayerObserver } = await import("../cortex.js");

      const observer = createLayerObserver();

      expect(observer).toHaveProperty("onOrchestrationStart");
      expect(observer).toHaveProperty("onLayerUpdate");
      expect(observer).toHaveProperty("onOrchestrationComplete");
      expect(typeof observer.onOrchestrationStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onOrchestrationComplete).toBe("function");
    });

    it("calls printOrchestrationStart on orchestration start", async () => {
      const { printOrchestrationStart } = await import("../display.js");
      const { createLayerObserver } = await import("../cortex.js");

      const observer = createLayerObserver();
      observer.onOrchestrationStart("test-id");

      expect(printOrchestrationStart).toHaveBeenCalledWith("test-id");
    });

    it("calls printLayerUpdate on layer update", async () => {
      const { printLayerUpdate } = await import("../display.js");
      const { createLayerObserver } = await import("../cortex.js");

      const observer = createLayerObserver();
      const event = {
        layer: "facts",
        status: "complete" as const,
        timestamp: Date.now(),
        latencyMs: 100,
      };
      observer.onLayerUpdate(event);

      expect(printLayerUpdate).toHaveBeenCalledWith(event);
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
        default: vi.fn().mockImplementation(() => ({
          embeddings: {
            create: vi.fn().mockResolvedValue({
              data: [{ embedding: new Array(1536).fill(0.1) }],
            }),
          },
        })),
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

    it("includes belief revision when fact extraction is enabled", async () => {
      delete process.env.OPENAI_API_KEY;
      process.env.CORTEX_FACT_EXTRACTION = "true";

      const { buildRememberParams } = await import("../cortex.js");

      const params = await buildRememberParams({
        userMessage: "Hello",
        agentResponse: "Hi",
        conversationId: "conv-123",
      });

      expect(params.extractFacts).toBe(true);
      expect(params.beliefRevision).toEqual({
        enabled: true,
        slotMatching: true,
        llmResolution: false, // No OpenAI key
      });
    });
  });
});
