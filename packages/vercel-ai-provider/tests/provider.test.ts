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
    modelId: "gpt-4",
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
    expect(provider.modelId).toBe("gpt-4");
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
});
