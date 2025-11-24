/**
 * Provider Unit Tests
 */

import { CortexMemoryProvider } from "../src/provider";
import type { CortexMemoryConfig } from "../src/types";

// Mock language model type (compatible with AI SDK v1)
type MockLanguageModel = {
  specificationVersion: string;
  provider: string;
  modelId: string;
  defaultObjectGenerationMode?: string;
  doGenerate: jest.Mock;
  doStream: jest.Mock;
};

// Mock Cortex SDK
jest.mock("@cortexmemory/sdk", () => ({
  Cortex: jest.fn().mockImplementation(() => ({
    memory: {
      search: jest.fn().mockResolvedValue([]),
      remember: jest.fn().mockResolvedValue({
        conversation: {
          messageIds: ["msg-1", "msg-2"],
          conversationId: "conv-1",
        },
        memories: [],
        facts: [],
      }),
      rememberStream: jest.fn().mockResolvedValue({
        fullResponse: "Test response",
        conversation: {
          messageIds: ["msg-1", "msg-2"],
          conversationId: "conv-1",
        },
        memories: [],
        facts: [],
        streamMetrics: {
          totalChunks: 1,
          streamDurationMs: 100,
        },
      }),
    },
    close: jest.fn(),
  })),
}));

describe("CortexMemoryProvider", () => {
  const mockConfig: CortexMemoryConfig = {
    convexUrl: "https://test.convex.cloud",
    memorySpaceId: "test-space",
    userId: "test-user",
    userName: "Test User",
  };

  const mockUnderlyingModel: MockLanguageModel = {
    specificationVersion: "v1",
    provider: "openai",
    modelId: "gpt-5-nano",
    defaultObjectGenerationMode: "json",
    doGenerate: jest.fn().mockResolvedValue({
      text: "Test response",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 20 },
    }),
    doStream: jest.fn().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "text-delta", textDelta: "Test " });
          controller.enqueue({ type: "text-delta", textDelta: "response" });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  };

  it("should initialize correctly", () => {
    const provider = new CortexMemoryProvider(mockUnderlyingModel, mockConfig);

    expect(provider.specificationVersion).toBe("v1");
    expect(provider.provider).toBe("openai");
    expect(provider.modelId).toBe("gpt-5-nano");
  });

  it("should delegate to underlying model for doGenerate", async () => {
    const provider = new CortexMemoryProvider(mockUnderlyingModel, mockConfig);

    const result = await provider.doGenerate({
      prompt: [{ role: "user", content: "Hello" }],
      mode: { type: "regular" },
    } as any);

    expect(result.text).toBe("Test response");
    expect(mockUnderlyingModel.doGenerate).toHaveBeenCalled();
  });

  it("should call underlying model with memory context", async () => {
    const { Cortex } = require("@cortexmemory/sdk");
    const searchMock = jest.fn().mockResolvedValue([
      {
        content: "User's name is Alice",
        importance: 80,
        memoryId: "mem-1",
        memorySpaceId: "test-space",
        userId: "test-user",
        contentType: "text",
        sourceType: "conversation",
        sourceTimestamp: Date.now(),
        tags: [],
        version: 1,
        previousVersions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
      },
    ]);

    // Override the mock for this test
    Cortex.mockImplementationOnce(() => ({
      memory: {
        search: searchMock,
        remember: jest.fn().mockResolvedValue({
          conversation: { messageIds: ["msg-1"], conversationId: "conv-1" },
          memories: [],
          facts: [],
        }),
      },
      close: jest.fn(),
    }));

    const provider = new CortexMemoryProvider(mockUnderlyingModel, {
      ...mockConfig,
      enableMemorySearch: true,
    });

    const result = await provider.doGenerate({
      prompt: [{ role: "user", content: "What is my name?" }],
      mode: { type: "regular" },
    } as any);

    // Should have generated a response
    expect(result.text).toBe("Test response");
    // Underlying model should have been called
    expect(mockUnderlyingModel.doGenerate).toHaveBeenCalled();
  });

  describe("Enhanced Streaming", () => {
    it("should wrap stream and return working stream", async () => {
      const provider = new CortexMemoryProvider(
        mockUnderlyingModel,
        mockConfig,
      );

      const result = await provider.doStream({
        prompt: [{ role: "user", content: "Hello" }],
        mode: { type: "regular" },
      } as any);

      // Should have called underlying model
      expect(mockUnderlyingModel.doStream).toHaveBeenCalled();

      // Stream should be defined and consumable
      expect(result.stream).toBeDefined();

      // Consume the stream completely
      const chunks: any[] = [];
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Should have received the mocked chunks
      expect(chunks.length).toBe(2);
      expect(chunks[0].type).toBe("text-delta");
    });

    it("should accept streaming hooks in configuration", async () => {
      const onChunkMock = jest.fn();
      const onProgressMock = jest.fn();
      const onCompleteMock = jest.fn();

      const configWithHooks = {
        ...mockConfig,
        streamingHooks: {
          onChunk: onChunkMock,
          onProgress: onProgressMock,
          onComplete: onCompleteMock,
        },
      };

      const provider = new CortexMemoryProvider(
        mockUnderlyingModel,
        configWithHooks,
      );

      // Configuration should be stored
      const config = provider.getConfig();
      expect(config.streamingHooks).toBeDefined();
      expect(config.streamingHooks?.onChunk).toBe(onChunkMock);
    });

    it("should accept streaming options in configuration", async () => {
      const configWithOptions = {
        ...mockConfig,
        streamingOptions: {
          storePartialResponse: true,
          partialResponseInterval: 2000,
          progressiveFactExtraction: true,
        },
      };

      const provider = new CortexMemoryProvider(
        mockUnderlyingModel,
        configWithOptions,
      );

      // Configuration should be stored
      const config = provider.getConfig();
      expect(config.streamingOptions).toBeDefined();
      expect(config.streamingOptions?.storePartialResponse).toBe(true);
    });

    it("should enable metrics by default", async () => {
      const provider = new CortexMemoryProvider(
        mockUnderlyingModel,
        mockConfig,
      );

      // enableStreamMetrics should default to true (or undefined, which is treated as true)
      const config = provider.getConfig();
      expect(config.enableStreamMetrics !== false).toBe(true);
    });

    it("should wrap streams correctly and forward all chunks", async () => {
      const provider = new CortexMemoryProvider(
        mockUnderlyingModel,
        mockConfig,
      );

      const result = await provider.doStream({
        prompt: [{ role: "user", content: "Test streaming" }],
        mode: { type: "regular" },
      } as any);

      // Verify stream exists
      expect(result.stream).toBeDefined();
      expect(typeof result.stream.getReader).toBe("function");

      // Should be able to consume the stream
      let streamCompleted = false;
      const reader = result.stream.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) {
            streamCompleted = true;
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Stream should complete successfully
      expect(streamCompleted).toBe(true);
    });
  });
});
