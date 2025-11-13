/**
 * Provider Unit Tests
 */

import { CortexMemoryProvider } from "../src/provider";
import type { LanguageModelV1 } from "ai";
import type { CortexMemoryConfig } from "../src/types";

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

  const mockUnderlyingModel: LanguageModelV1 = {
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

  it("should search memories before generation", async () => {
    const provider = new CortexMemoryProvider(mockUnderlyingModel, {
      ...mockConfig,
      enableMemorySearch: true,
    });

    await provider.doGenerate({
      prompt: [{ role: "user", content: "What is my name?" }],
      mode: { type: "regular" },
    } as any);

    // Memory search should have been called
    const Cortex = require("@cortexmemory/sdk").Cortex;
    const cortexInstance =
      Cortex.mock.results[Cortex.mock.results.length - 1].value;
    expect(cortexInstance.memory.search).toHaveBeenCalled();
  });
});
