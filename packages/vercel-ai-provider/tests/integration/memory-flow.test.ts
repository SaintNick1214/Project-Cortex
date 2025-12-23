/**
 * Integration Tests: Memory Flow
 *
 * Tests the full memory retrieval and storage flow through the provider
 * Uses mocked SDK but tests real component interactions
 */

import { CortexMemoryProvider } from "../../src/provider";
import {
  createTestConfig,
  createMockLLM,
  createMockMemories,
} from "../helpers/test-utils";

// Mock Cortex SDK with stateful behavior for integration tests
let storedMemories: any[] = [];
let storedConversations: any[] = [];

const mockCortex = {
  memory: {
    search: jest.fn().mockImplementation(() => storedMemories),
    remember: jest.fn().mockImplementation(async (params: any) => {
      const conv = {
        conversationId: params.conversationId || `conv-${Date.now()}`,
        messageIds: [`msg-${Date.now()}-1`, `msg-${Date.now()}-2`],
      };
      storedConversations.push(conv);
      storedMemories.push({
        memoryId: `mem-${Date.now()}`,
        content: params.userMessage,
        importance: params.importance || 50,
      });
      return {
        conversation: conv,
        memories: storedMemories,
        facts: [],
      };
    }),
    rememberStream: jest.fn().mockImplementation(async (params: any) => {
      const conv = {
        conversationId: params.conversationId || `conv-${Date.now()}`,
        messageIds: [`msg-${Date.now()}-1`, `msg-${Date.now()}-2`],
      };
      storedConversations.push(conv);
      return {
        fullResponse: "Test response",
        conversation: conv,
        memories: [],
        facts: [],
        streamMetrics: { totalChunks: 1, streamDurationMs: 100 },
      };
    }),
    recall: jest.fn().mockImplementation(async () => ({
      context:
        storedMemories.length > 0
          ? storedMemories.map((m) => m.content).join("\n")
          : "",
      totalResults: storedMemories.length,
      queryTimeMs: 50,
      sources: {
        vector: { count: storedMemories.length, items: storedMemories },
        facts: { count: 0, items: [] },
        graph: { count: 0, items: [] },
      },
    })),
    list: jest.fn().mockImplementation(() => storedMemories),
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

describe("Memory Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storedMemories = [];
    storedConversations = [];
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Full Flow: Recall -> Inject -> Generate -> Store
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("doGenerate flow", () => {
    it("should recall, inject, generate, and store in sequence", async () => {
      // Pre-populate some memories
      storedMemories = createMockMemories(2);

      const config = createTestConfig({
        enableMemorySearch: true,
        enableMemoryStorage: true,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      // Execute doGenerate
      const result = await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "What do you know?" }] },
        ],
        mode: { type: "regular" },
      });

      // Verify recall was called
      expect(mockCortex.memory.recall).toHaveBeenCalled();

      // Verify LLM was called with augmented prompt
      expect(mockLLM.doGenerate).toHaveBeenCalled();
      const llmCall = mockLLM.doGenerate.mock.calls[0][0];
      
      // Context should be injected (system message created)
      expect(llmCall.prompt[0].role).toBe("system");
      expect(llmCall.prompt[0].content).toContain("Test memory 1");

      // Verify result
      expect(result.text).toBe("Test response");

      // Wait for async storage
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify storage was called
      expect(mockCortex.memory.remember).toHaveBeenCalled();
    });

    it("should skip recall when memory search disabled", async () => {
      const config = createTestConfig({
        enableMemorySearch: false,
        enableMemoryStorage: true,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      expect(mockCortex.memory.recall).not.toHaveBeenCalled();
    });

    it("should skip storage when memory storage disabled", async () => {
      const config = createTestConfig({
        enableMemorySearch: true,
        enableMemoryStorage: false,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockCortex.memory.remember).not.toHaveBeenCalled();
    });

    it("should handle recall failure and continue with generation", async () => {
      mockCortex.memory.recall.mockRejectedValueOnce(
        new Error("Recall service unavailable"),
      );

      const config = createTestConfig({
        enableMemorySearch: true,
        enableMemoryStorage: true,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      // Should not throw
      const result = await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      // LLM should still be called
      expect(mockLLM.doGenerate).toHaveBeenCalled();
      expect(result.text).toBe("Test response");
    });

    it("should handle storage failure gracefully", async () => {
      mockCortex.memory.remember.mockRejectedValueOnce(
        new Error("Storage unavailable"),
      );

      const config = createTestConfig({
        enableMemorySearch: false,
        enableMemoryStorage: true,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      // Should not throw
      const result = await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      expect(result.text).toBe("Test response");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Context Injection Strategies
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("context injection strategies", () => {
    it("should inject into existing system message with system strategy", async () => {
      storedMemories = [{ memoryId: "mem-1", content: "User likes coffee" }];
      mockCortex.memory.recall.mockResolvedValueOnce({
        context: "User likes coffee",
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

      await provider.doGenerate({
        prompt: [
          { role: "system", content: "Be helpful" },
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      const llmCall = mockLLM.doGenerate.mock.calls[0][0];
      expect(llmCall.prompt[0].content).toContain("Be helpful");
      expect(llmCall.prompt[0].content).toContain("User likes coffee");
    });

    it("should create new system message when none exists", async () => {
      mockCortex.memory.recall.mockResolvedValueOnce({
        context: "Previous context",
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

      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      const llmCall = mockLLM.doGenerate.mock.calls[0][0];
      expect(llmCall.prompt[0].role).toBe("system");
      expect(llmCall.prompt[0].content).toContain("Previous context");
      expect(llmCall.prompt[1].role).toBe("user");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Embedding Provider Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("embedding provider integration", () => {
    it("should generate embedding for recall query", async () => {
      const generateMock = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);

      const config = createTestConfig({
        enableMemorySearch: true,
        embeddingProvider: { generate: generateMock },
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Test query" }] },
        ],
        mode: { type: "regular" },
      });

      expect(generateMock).toHaveBeenCalledWith("Test query");
    });

    it("should continue without embedding if generation fails", async () => {
      const generateMock = jest
        .fn()
        .mockRejectedValue(new Error("Embedding failed"));

      const config = createTestConfig({
        enableMemorySearch: true,
        embeddingProvider: { generate: generateMock },
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      // Should not throw
      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Test" }] },
        ],
        mode: { type: "regular" },
      });

      expect(mockCortex.memory.recall).toHaveBeenCalled();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer Observer Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("layer observer integration", () => {
    it("should pass layer observer to remember", async () => {
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

      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const rememberCall = mockCortex.memory.remember.mock.calls[0][0];
      expect(rememberCall.observer).toBe(layerObserver);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Belief Revision Options
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("belief revision options", () => {
    it("should pass belief revision options to remember", async () => {
      const config = createTestConfig({
        enableMemoryStorage: true,
        beliefRevision: { enabled: true, slotMatching: true },
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const rememberOptions = mockCortex.memory.remember.mock.calls[0][1];
      expect(rememberOptions.beliefRevision).toBeDefined();
    });

    it("should disable belief revision when configured", async () => {
      const config = createTestConfig({
        enableMemoryStorage: true,
        beliefRevision: false,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      await provider.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "Hello" }] },
        ],
        mode: { type: "regular" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const rememberOptions = mockCortex.memory.remember.mock.calls[0][1];
      expect(rememberOptions.beliefRevision).toBeUndefined();
    });
  });
});
