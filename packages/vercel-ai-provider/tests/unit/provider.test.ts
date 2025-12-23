/**
 * Unit Tests: CortexMemoryProvider Class
 *
 * Tests the provider with mocked dependencies
 */

import { CortexMemoryProvider } from "../../src/provider";
import type { CortexMemoryConfig } from "../../src/types";
import {
  createTestConfig,
  createMockLLM,
  createMockStream,
  createMockStreamV5,
  createMockStreamText,
  consumeStream,
  type MockLanguageModel,
} from "../helpers/test-utils";

// Helper type for stream chunks
type StreamChunk = {
  type?: string;
  textDelta?: string;
  delta?: string;
  text?: string;
};

// Mock Cortex SDK
const mockCortex = {
  memory: {
    search: jest.fn().mockResolvedValue([]),
    remember: jest.fn().mockResolvedValue({
      conversation: { messageIds: ["msg-1", "msg-2"], conversationId: "conv-1" },
      memories: [],
      facts: [],
    }),
    rememberStream: jest.fn().mockResolvedValue({
      fullResponse: "Test response",
      conversation: { messageIds: ["msg-1"], conversationId: "conv-1" },
      memories: [],
      facts: [],
      streamMetrics: { totalChunks: 1, streamDurationMs: 100 },
    }),
    recall: jest.fn().mockResolvedValue({
      context: "",
      totalResults: 0,
      queryTimeMs: 10,
      sources: {
        vector: { count: 0, items: [] },
        facts: { count: 0, items: [] },
        graph: { count: 0, items: [] },
      },
    }),
  },
  close: jest.fn(),
};

jest.mock("@cortexmemory/sdk", () => ({
  Cortex: jest.fn().mockImplementation(() => mockCortex),
  CypherGraphAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("CortexMemoryProvider", () => {
  let mockConfig: CortexMemoryConfig;
  let mockLLM: MockLanguageModel;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = createTestConfig();
    mockLLM = createMockLLM();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Constructor
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);

      expect(provider.specificationVersion).toBe("v1");
      expect(provider.provider).toBe("openai");
      expect(provider.modelId).toBe("gpt-4o-mini");
    });

    it("should delegate defaultObjectGenerationMode from underlying model", () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);
      expect(provider.defaultObjectGenerationMode).toBe("json");
    });

    it("should handle model without defaultObjectGenerationMode", () => {
      const llmWithoutMode = createMockLLM();
      delete (llmWithoutMode as any).defaultObjectGenerationMode;

      const provider = new CortexMemoryProvider(llmWithoutMode, mockConfig);
      expect(provider.defaultObjectGenerationMode).toBeUndefined();
    });

    it("should accept pre-initialized Cortex instance", () => {
      const customCortex = { ...mockCortex };
      const provider = new CortexMemoryProvider(mockLLM, mockConfig, customCortex as any);

      // Should use the provided instance (no new Cortex created)
      expect(provider).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Static create() - Async Factory
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("static create()", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should create provider without graph when not enabled", async () => {
      const config = createTestConfig({ enableGraphMemory: false });
      const provider = await CortexMemoryProvider.create(mockLLM, config);

      expect(provider).toBeInstanceOf(CortexMemoryProvider);
      expect(provider.modelId).toBe("gpt-4o-mini");
    });

    it("should create provider with graph when enabled and URI available", async () => {
      process.env.NEO4J_URI = "bolt://localhost:7687";
      process.env.NEO4J_USERNAME = "neo4j";
      process.env.NEO4J_PASSWORD = "password";

      const config = createTestConfig({ enableGraphMemory: true });
      const provider = await CortexMemoryProvider.create(mockLLM, config);

      expect(provider).toBeInstanceOf(CortexMemoryProvider);
    });

    it("should use graphConfig over env vars when both provided", async () => {
      process.env.NEO4J_URI = "bolt://env-host:7687";

      const config = createTestConfig({
        enableGraphMemory: true,
        graphConfig: {
          uri: "bolt://config-host:7687",
          username: "config-user",
          password: "config-pass",
        },
      });

      const provider = await CortexMemoryProvider.create(mockLLM, config);
      expect(provider).toBeInstanceOf(CortexMemoryProvider);
    });

    it("should warn when graph enabled but no URI configured", async () => {
      delete process.env.NEO4J_URI;
      delete process.env.MEMGRAPH_URI;

      const config = createTestConfig({ enableGraphMemory: true });
      const provider = await CortexMemoryProvider.create(mockLLM, config);

      // Should still create provider (graph adapter will be undefined)
      expect(provider).toBeInstanceOf(CortexMemoryProvider);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // doGenerate
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("doGenerate", () => {
    it("should call underlying model doGenerate", async () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);

      const result = await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      expect(result.text).toBe("Test response");
      expect(mockLLM.doGenerate).toHaveBeenCalled();
    });

    it("should search memories when enabled", async () => {
      mockCortex.memory.recall.mockResolvedValueOnce({
        context: "User likes coffee",
        totalResults: 1,
        queryTimeMs: 50,
        sources: {
          vector: { count: 1, items: [] },
          facts: { count: 0, items: [] },
          graph: { count: 0, items: [] },
        },
      });

      const config = createTestConfig({ enableMemorySearch: true });
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      expect(mockCortex.memory.recall).toHaveBeenCalled();
    });

    it("should skip memory search when disabled", async () => {
      const config = createTestConfig({ enableMemorySearch: false });
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      expect(mockCortex.memory.recall).not.toHaveBeenCalled();
    });

    it("should store memory after generation when enabled", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      // Storage is async, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCortex.memory.remember).toHaveBeenCalled();
    });

    it("should skip memory storage when disabled", async () => {
      const config = createTestConfig({ enableMemoryStorage: false });
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCortex.memory.remember).not.toHaveBeenCalled();
    });

    it("should inject recall context into prompt when available", async () => {
      mockCortex.memory.recall.mockResolvedValueOnce({
        context: "Previous context: User prefers dark mode",
        totalResults: 1,
        queryTimeMs: 50,
        sources: {
          vector: { count: 1, items: [] },
          facts: { count: 0, items: [] },
          graph: { count: 0, items: [] },
        },
      });

      const config = createTestConfig({ enableMemorySearch: true });
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      // Check that doGenerate was called with augmented prompt
      const callArgs = mockLLM.doGenerate.mock.calls[0][0];
      expect(callArgs.prompt[0].role).toBe("system");
      expect(callArgs.prompt[0].content).toContain("Previous context");
    });

    it("should handle recall failure gracefully", async () => {
      mockCortex.memory.recall.mockRejectedValueOnce(new Error("Recall failed"));

      const config = createTestConfig({ enableMemorySearch: true });
      const provider = new CortexMemoryProvider(mockLLM, config);

      // Should not throw
      const result = await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      expect(result.text).toBe("Test response");
    });

    it("should pass layerObserver to remember when configured", async () => {
      const layerObserver = {
        onOrchestrationStart: jest.fn(),
        onLayerUpdate: jest.fn(),
        onOrchestrationComplete: jest.fn(),
      };

      const config = createTestConfig({
        enableMemoryStorage: true,
        layerObserver,
      });
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const rememberCall = mockCortex.memory.remember.mock.calls[0][0];
      expect(rememberCall.observer).toBe(layerObserver);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // doStream
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("doStream", () => {
    it("should call underlying model doStream", async () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      expect(result.stream).toBeDefined();
      expect(mockLLM.doStream).toHaveBeenCalled();
    });

    it("should wrap stream and forward all chunks", async () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      const chunks = await consumeStream(result.stream) as StreamChunk[];
      expect(chunks.length).toBe(2);
      expect(chunks[0].type).toBe("text-delta");
    });

    it("should handle text-delta chunks (v3/v4 format)", async () => {
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStream(["Hello ", "World"]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      });

      const provider = new CortexMemoryProvider(mockLLM, mockConfig);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        mode: { type: "regular" },
      });

      const chunks = await consumeStream(result.stream) as StreamChunk[];
      expect(chunks[0].textDelta).toBe("Hello ");
      expect(chunks[1].textDelta).toBe("World");
    });

    it("should handle delta chunks (v5 format)", async () => {
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStreamV5(["Hello ", "World"]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      });

      const provider = new CortexMemoryProvider(mockLLM, mockConfig);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        mode: { type: "regular" },
      });

      const chunks = await consumeStream(result.stream) as StreamChunk[];
      expect(chunks[0].delta).toBe("Hello ");
    });

    it("should handle text chunks (alternative format)", async () => {
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStreamText(["Hello ", "World"]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      });

      const provider = new CortexMemoryProvider(mockLLM, mockConfig);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
        mode: { type: "regular" },
      });

      const chunks = await consumeStream(result.stream) as StreamChunk[];
      expect(chunks[0].text).toBe("Hello ");
    });

    it("should call rememberStream when storage enabled", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      // Consume stream to trigger flush
      await consumeStream(result.stream);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCortex.memory.rememberStream).toHaveBeenCalled();
    });

    it("should skip storage when disabled", async () => {
      const config = createTestConfig({ enableMemoryStorage: false });
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCortex.memory.rememberStream).not.toHaveBeenCalled();
    });

    it("should handle rememberStream failure gracefully", async () => {
      mockCortex.memory.rememberStream.mockRejectedValueOnce(
        new Error("Storage failed"),
      );

      const config = createTestConfig({ enableMemoryStorage: true });
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      // Should complete without throwing
      const chunks = await consumeStream(result.stream);
      expect(chunks.length).toBe(2);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getConfig
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getConfig", () => {
    it("should return frozen copy of config", () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);
      const config = provider.getConfig();

      expect(config.memorySpaceId).toBe(mockConfig.memorySpaceId);
      expect(Object.isFrozen(config)).toBe(true);
    });

    it("should not allow modification of returned config", () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);
      const config = provider.getConfig();

      expect(() => {
        (config as any).memorySpaceId = "modified";
      }).toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Capability Delegation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("capability delegation", () => {
    it("should delegate supportsStructuredOutputs", () => {
      const llm = createMockLLM({ supportsStructuredOutputs: true });
      const provider = new CortexMemoryProvider(llm, mockConfig);
      expect(provider.supportsStructuredOutputs).toBe(true);
    });

    it("should default supportsStructuredOutputs to false", () => {
      const llm = createMockLLM();
      delete (llm as any).supportsStructuredOutputs;
      const provider = new CortexMemoryProvider(llm, mockConfig);
      expect(provider.supportsStructuredOutputs).toBe(false);
    });

    it("should delegate supportsImageUrls", () => {
      const llm = createMockLLM({ supportsImageUrls: true });
      const provider = new CortexMemoryProvider(llm, mockConfig);
      expect(provider.supportsImageUrls).toBe(true);
    });

    it("should default supportsImageUrls to false", () => {
      const llm = createMockLLM();
      delete (llm as any).supportsImageUrls;
      const provider = new CortexMemoryProvider(llm, mockConfig);
      expect(provider.supportsImageUrls).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // close
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("close", () => {
    it("should close Cortex connection", async () => {
      const provider = new CortexMemoryProvider(mockLLM, mockConfig);
      await provider.close();

      expect(mockCortex.close).toHaveBeenCalled();
    });

    it("should disconnect graph adapter when present", async () => {
      const mockGraphAdapter = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
      };

      const provider = new CortexMemoryProvider(
        mockLLM,
        mockConfig,
        mockCortex as any,
        mockGraphAdapter as any,
      );

      await provider.close();

      expect(mockGraphAdapter.disconnect).toHaveBeenCalled();
      expect(mockCortex.close).toHaveBeenCalled();
    });

    it("should handle graph adapter disconnect failure gracefully", async () => {
      const mockGraphAdapter = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockRejectedValue(new Error("Disconnect failed")),
      };

      const provider = new CortexMemoryProvider(
        mockLLM,
        mockConfig,
        mockCortex as any,
        mockGraphAdapter as any,
      );

      // Should not throw
      await provider.close();
      expect(mockCortex.close).toHaveBeenCalled();
    });
  });
});
