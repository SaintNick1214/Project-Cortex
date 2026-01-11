/**
 * Integration Tests: Streaming Flow
 *
 * Tests streaming with memory integration through the provider
 */

import { CortexMemoryProvider } from "../../src/provider";
import {
  createTestConfig,
  createMockLLM,
  createMockStream,
  createMockStreamV5,
  createMockStreamText,
  consumeStream,
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
    rememberStream: jest.fn().mockResolvedValue({
      fullResponse: "Test response",
      conversation: { conversationId: "conv-1", messageIds: ["msg-1"] },
      memories: [],
      facts: [],
      streamMetrics: { totalChunks: 1, streamDurationMs: 100 },
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

describe("Streaming Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Basic Streaming Flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("doStream flow", () => {
    it("should stream, collect chunks, and store memory", async () => {
      const config = createTestConfig({
        enableMemorySearch: false,
        enableMemoryStorage: true,
      });
      const mockLLM = createMockLLM();
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStream(["Hello ", "World", "!"]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      });

      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hi there" }] },
        ],
        mode: { type: "regular" },
      });

      // Consume stream to trigger flush
      const chunks = (await consumeStream(result.stream)) as StreamChunk[];

      expect(chunks.length).toBe(3);
      expect(chunks.map((c) => c.textDelta).join("")).toBe("Hello World!");

      // Wait for async storage
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify rememberStream was called with collected text
      expect(mockCortex.memory.rememberStream).toHaveBeenCalled();
    });

    it("should handle text-delta format (v3/v4)", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const mockLLM = createMockLLM();
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStream(["Part 1 ", "Part 2"]),
        rawCall: {},
      });

      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      const chunks = await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCortex.memory.rememberStream).toHaveBeenCalled();
    });

    it("should handle delta format (v5)", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const mockLLM = createMockLLM();
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStreamV5(["V5 ", "Format"]),
        rawCall: {},
      });

      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      const chunks = (await consumeStream(result.stream)) as StreamChunk[];
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(chunks[0].delta).toBe("V5 ");
      expect(mockCortex.memory.rememberStream).toHaveBeenCalled();
    });

    it("should handle text format", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const mockLLM = createMockLLM();
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStreamText(["Text ", "Format"]),
        rawCall: {},
      });

      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      const chunks = (await consumeStream(result.stream)) as StreamChunk[];
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(chunks[0].text).toBe("Text ");
      expect(mockCortex.memory.rememberStream).toHaveBeenCalled();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Search with Streaming
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("memory search with streaming", () => {
    it("should recall context before streaming", async () => {
      mockCortex.memory.recall.mockResolvedValueOnce({
        context: "User prefers detailed answers",
        totalResults: 1,
        queryTimeMs: 20,
        sources: {
          vector: { count: 1, items: [] },
          facts: { count: 0, items: [] },
          graph: { count: 0, items: [] },
        },
      });

      const config = createTestConfig({
        enableMemorySearch: true,
        enableMemoryStorage: true,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doStream({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Explain this" }] },
        ],
        mode: { type: "regular" },
      });

      // Recall should be called before streaming
      expect(mockCortex.memory.recall).toHaveBeenCalled();

      // LLM should receive augmented prompt
      const llmCall = mockLLM.doStream.mock.calls[0][0];
      expect(llmCall.prompt[0].content).toContain("User prefers detailed");
    });

    it("should inject context using configured strategy", async () => {
      mockCortex.memory.recall.mockResolvedValueOnce({
        context: "Context from memory",
        totalResults: 1,
        queryTimeMs: 10,
        sources: {
          vector: { count: 1, items: [] },
          facts: { count: 0, items: [] },
          graph: { count: 0, items: [] },
        },
      });

      const config = createTestConfig({
        enableMemorySearch: true,
        contextInjectionStrategy: "system",
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        mode: { type: "regular" },
      });

      const llmCall = mockLLM.doStream.mock.calls[0][0];
      expect(llmCall.prompt[0].role).toBe("system");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Storage Disabled
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("storage disabled", () => {
    it("should not call rememberStream when storage disabled", async () => {
      const config = createTestConfig({ enableMemoryStorage: false });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCortex.memory.rememberStream).not.toHaveBeenCalled();
    });

    it("should return original stream when no user message", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const mockLLM = createMockLLM();
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStream(["Response"]),
        rawCall: {},
      });

      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "system", content: "System prompt only" }],
        mode: { type: "regular" },
      });

      const chunks = await consumeStream(result.stream);
      expect(chunks.length).toBe(1);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Error Handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("error handling", () => {
    it("should handle rememberStream failure gracefully", async () => {
      mockCortex.memory.rememberStream.mockRejectedValueOnce(
        new Error("Storage failed"),
      );

      const config = createTestConfig({ enableMemoryStorage: true });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      // Stream should still complete
      const chunks = await consumeStream(result.stream);
      expect(chunks.length).toBe(2);
    });

    it("should handle recall failure and continue streaming", async () => {
      mockCortex.memory.recall.mockRejectedValueOnce(
        new Error("Recall failed"),
      );

      const config = createTestConfig({
        enableMemorySearch: true,
        enableMemoryStorage: true,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      const chunks = await consumeStream(result.stream);
      expect(chunks.length).toBe(2);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Options
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("streaming options", () => {
    it("should pass streaming options to rememberStream", async () => {
      const config = createTestConfig({
        enableMemoryStorage: true,
        streamingOptions: {
          storePartialResponse: true,
          progressiveFactExtraction: true,
        },
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const rememberStreamOptions =
        mockCortex.memory.rememberStream.mock.calls[0][1];
      expect(rememberStreamOptions.storePartialResponse).toBe(true);
      expect(rememberStreamOptions.progressiveFactExtraction).toBe(true);
    });

    it("should pass streaming hooks", async () => {
      const onChunk = jest.fn();
      const onProgress = jest.fn();
      const onComplete = jest.fn();

      const config = createTestConfig({
        enableMemoryStorage: true,
        streamingHooks: {
          onChunk,
          onProgress,
          onComplete,
        },
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const rememberStreamOptions =
        mockCortex.memory.rememberStream.mock.calls[0][1];
      expect(rememberStreamOptions.hooks).toBeDefined();
    });

    it("should pass graph sync option", async () => {
      const config = createTestConfig({
        enableMemoryStorage: true,
        enableGraphMemory: true,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const rememberStreamOptions =
        mockCortex.memory.rememberStream.mock.calls[0][1];
      // Note: syncToGraph removed in v0.29.0+ - graph sync is automatic when graphAdapter is configured
      // The option should not be present in the call
      expect(rememberStreamOptions.syncToGraph).toBeUndefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer Observer with Streaming
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("layer observer with streaming", () => {
    it("should pass layer observer to rememberStream", async () => {
      const layerObserver = {
        onOrchestrationStart: jest.fn(),
        onLayerUpdate: jest.fn(),
        onOrchestrationComplete: jest.fn(),
      };

      const config = createTestConfig({
        enableMemoryStorage: true,
        layerObserver,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const rememberStreamParams =
        mockCortex.memory.rememberStream.mock.calls[0][0];
      expect(rememberStreamParams.observer).toBe(layerObserver);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Empty Stream Handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("empty stream handling", () => {
    it("should handle empty stream without storing", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const mockLLM = createMockLLM();
      mockLLM.doStream.mockResolvedValueOnce({
        stream: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        rawCall: {},
      });

      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not call rememberStream for empty response
      expect(mockCortex.memory.rememberStream).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only stream without storing", async () => {
      const config = createTestConfig({ enableMemoryStorage: true });
      const mockLLM = createMockLLM();
      mockLLM.doStream.mockResolvedValueOnce({
        stream: createMockStream(["   ", "  \n  ", "\t"]),
        rawCall: {},
      });

      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not call rememberStream for whitespace-only response
      expect(mockCortex.memory.rememberStream).not.toHaveBeenCalled();
    });
  });
});
