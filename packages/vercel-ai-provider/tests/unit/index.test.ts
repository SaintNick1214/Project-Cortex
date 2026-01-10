/**
 * Unit Tests: Factory Functions and Manual Methods
 *
 * Tests createCortexMemory, createCortexMemoryAsync, and manual control methods
 */

import { createCortexMemory, createCortexMemoryAsync } from "../../src/index";
import type { CortexMemoryConfig } from "../../src/types";
import { createTestConfig, createMockLLM } from "../helpers/test-utils";

// Mock storage for dynamic mock values
const mockStorage = {
  searchResult: [] as any[],
  listResult: [] as any[],
  deleteResult: { deleted: 0 },
};

// Create mock Cortex SDK
jest.mock("@cortexmemory/sdk", () => {
  const mockMemory = {
    search: jest.fn().mockImplementation(() => mockStorage.searchResult),
    remember: jest.fn().mockResolvedValue({
      conversation: { messageIds: ["msg-1"], conversationId: "conv-1" },
      memories: [],
      facts: [],
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
    list: jest.fn().mockImplementation(() => mockStorage.listResult),
    deleteMany: jest.fn().mockImplementation(() => mockStorage.deleteResult),
    rememberStream: jest.fn().mockResolvedValue({
      fullResponse: "Test",
      conversation: { messageIds: ["msg-1"], conversationId: "conv-1" },
      memories: [],
      facts: [],
    }),
  };

  const mockInstance = {
    memory: mockMemory,
    close: jest.fn(),
  };

  const MockCortex = jest.fn().mockImplementation(() => mockInstance);
  (MockCortex as any).create = jest.fn().mockResolvedValue(mockInstance);

  return {
    Cortex: MockCortex,
    CypherGraphAdapter: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    })),
    // Re-export mocks for test access
    __mockMemory: mockMemory,
    __mockInstance: mockInstance,
  };
});

// Get access to mocks
const { __mockMemory: mockMemory, __mockInstance: mockCortex } =
  jest.requireMock("@cortexmemory/sdk");

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.searchResult = [];
  mockStorage.listResult = [];
  mockStorage.deleteResult = { deleted: 0 };
});

describe("Factory Functions", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createCortexMemory
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createCortexMemory", () => {
    it("should create model factory", () => {
      const config = createTestConfig();
      const factory = createCortexMemory(config);

      expect(typeof factory).toBe("function");
    });

    it("should throw on missing convexUrl", () => {
      const config = createTestConfig();
      (config as any).convexUrl = "";

      expect(() => createCortexMemory(config)).toThrow("convexUrl is required");
    });

    it("should throw on missing memorySpaceId", () => {
      const config = createTestConfig();
      (config as any).memorySpaceId = "";

      expect(() => createCortexMemory(config)).toThrow(
        "memorySpaceId is required",
      );
    });

    it("should throw on missing userId", () => {
      const config = createTestConfig();
      (config as any).userId = "";

      expect(() => createCortexMemory(config)).toThrow("userId is required");
    });

    it("should throw on missing agentId", () => {
      const config = createTestConfig();
      (config as any).agentId = "";

      expect(() => createCortexMemory(config)).toThrow("agentId is required");
    });

    it("should wrap underlying model", () => {
      const config = createTestConfig();
      const factory = createCortexMemory(config);
      const mockLLM = createMockLLM();

      const wrappedModel = factory(mockLLM);

      expect(wrappedModel.modelId).toBe("gpt-4o-mini");
      expect(wrappedModel.provider).toBe("openai");
    });

    it("should expose manual control methods", () => {
      const config = createTestConfig();
      const factory = createCortexMemory(config);

      expect(typeof factory.search).toBe("function");
      expect(typeof factory.remember).toBe("function");
      expect(typeof factory.getMemories).toBe("function");
      expect(typeof factory.clearMemories).toBe("function");
      expect(typeof factory.getConfig).toBe("function");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createCortexMemoryAsync
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createCortexMemoryAsync", () => {
    it("should create model factory asynchronously", async () => {
      const config = createTestConfig();
      const factory = await createCortexMemoryAsync(config);

      expect(typeof factory).toBe("function");
    });

    it("should validate config", async () => {
      const config = createTestConfig();
      (config as any).convexUrl = "";

      await expect(createCortexMemoryAsync(config)).rejects.toThrow(
        "convexUrl is required",
      );
    });

    it("should wrap underlying model", async () => {
      const config = createTestConfig();
      const factory = await createCortexMemoryAsync(config);
      const mockLLM = createMockLLM();

      const wrappedModel = factory(mockLLM);

      expect(wrappedModel.modelId).toBe("gpt-4o-mini");
    });

    it("should expose manual control methods", async () => {
      const config = createTestConfig();
      const factory = await createCortexMemoryAsync(config);

      expect(typeof factory.search).toBe("function");
      expect(typeof factory.remember).toBe("function");
      expect(typeof factory.getMemories).toBe("function");
      expect(typeof factory.clearMemories).toBe("function");
      expect(typeof factory.getConfig).toBe("function");
    });
  });
});

describe("Manual Control Methods", () => {
  let factory: ReturnType<typeof createCortexMemory>;
  let config: CortexMemoryConfig;

  beforeEach(() => {
    config = createTestConfig();
    factory = createCortexMemory(config);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // search
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("search", () => {
    it("should call cortex.memory.search", async () => {
      mockStorage.searchResult = [
        {
          memoryId: "mem-1",
          content: "Test memory",
          importance: 80,
        },
      ];

      const results = await factory.search("test query");

      expect(mockMemory.search).toHaveBeenCalledWith(
        config.memorySpaceId,
        "test query",
        expect.any(Object),
      );
      expect(results.length).toBe(1);
      expect(results[0].content).toBe("Test memory");
    });

    it("should pass search options", async () => {
      await factory.search("query", {
        limit: 5,
        minScore: 0.8,
        tags: ["important"],
      });

      expect(mockMemory.search).toHaveBeenCalledWith(
        config.memorySpaceId,
        "query",
        expect.objectContaining({
          limit: 5,
          minScore: 0.8,
          tags: ["important"],
        }),
      );
    });

    it("should use embedding when provided", async () => {
      const embedding = [0.1, 0.2, 0.3];
      await factory.search("query", { embedding });

      expect(mockMemory.search).toHaveBeenCalledWith(
        config.memorySpaceId,
        "query",
        expect.objectContaining({ embedding }),
      );
    });

    it("should generate embedding when provider configured", async () => {
      const generateMock = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
      const configWithEmbed = createTestConfig({
        embeddingProvider: { generate: generateMock },
      });
      const factoryWithEmbed = createCortexMemory(configWithEmbed);

      await factoryWithEmbed.search("test query");

      expect(generateMock).toHaveBeenCalledWith("test query");
      expect(mockMemory.search).toHaveBeenCalledWith(
        configWithEmbed.memorySpaceId,
        "test query",
        expect.objectContaining({ embedding: [0.1, 0.2, 0.3] }),
      );
    });

    it("should use config defaults for limit and minScore", async () => {
      const configWithDefaults = createTestConfig({
        memorySearchLimit: 15,
        minMemoryRelevance: 0.9,
      });
      const factoryWithDefaults = createCortexMemory(configWithDefaults);

      await factoryWithDefaults.search("query");

      expect(mockMemory.search).toHaveBeenCalledWith(
        configWithDefaults.memorySpaceId,
        "query",
        expect.objectContaining({
          limit: 15,
          minScore: 0.9,
        }),
      );
    });

    it("should throw on search error", async () => {
      mockMemory.search.mockRejectedValueOnce(new Error("Search failed"));

      await expect(factory.search("query")).rejects.toThrow("Search failed");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // remember
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("remember", () => {
    it("should call cortex.memory.remember", async () => {
      await factory.remember("User message", "Agent response");

      expect(mockMemory.remember).toHaveBeenCalledWith(
        expect.objectContaining({
          memorySpaceId: config.memorySpaceId,
          userMessage: "User message",
          agentResponse: "Agent response",
        }),
        expect.any(Object),
      );
    });

    it("should resolve userId from config", async () => {
      await factory.remember("Hello", "Hi");

      const call = mockMemory.remember.mock.calls[0][0];
      expect(call.userId).toBeDefined();
    });

    it("should use provided conversationId", async () => {
      await factory.remember("Hello", "Hi", { conversationId: "custom-conv" });

      expect(mockMemory.remember).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "custom-conv" }),
        expect.any(Object),
      );
    });

    it("should pass options without deprecated syncToGraph (v0.29.0+)", async () => {
      // syncToGraph option is deprecated in v0.29.0+ - graph sync is now automatic
      // when graphAdapter is configured. The option is ignored if passed.
      await factory.remember("Hello", "Hi", { syncToGraph: true });

      // Options object should be passed but syncToGraph should not be forwarded
      expect(mockMemory.remember).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object), // Options are passed but syncToGraph is not included
      );
    });

    it("should use config defaults for importance", async () => {
      const configWithDefaults = createTestConfig({ defaultImportance: 75 });
      const factoryWithDefaults = createCortexMemory(configWithDefaults);

      await factoryWithDefaults.remember("Hello", "Hi");

      expect(mockMemory.remember).toHaveBeenCalledWith(
        expect.objectContaining({ importance: 75 }),
        expect.any(Object),
      );
    });

    it("should use config defaults for tags", async () => {
      const configWithDefaults = createTestConfig({
        defaultTags: ["test", "auto"],
      });
      const factoryWithDefaults = createCortexMemory(configWithDefaults);

      await factoryWithDefaults.remember("Hello", "Hi");

      expect(mockMemory.remember).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["test", "auto"] }),
        expect.any(Object),
      );
    });

    it("should throw on remember error", async () => {
      mockMemory.remember.mockRejectedValueOnce(new Error("Storage failed"));

      await expect(factory.remember("Hello", "Hi")).rejects.toThrow(
        "Storage failed",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getMemories
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getMemories", () => {
    it("should call cortex.memory.list", async () => {
      mockStorage.listResult = [
        { memoryId: "mem-1", content: "Memory 1" },
        { memoryId: "mem-2", content: "Memory 2" },
      ];

      const memories = await factory.getMemories();

      expect(mockMemory.list).toHaveBeenCalledWith({
        memorySpaceId: config.memorySpaceId,
        limit: 100,
      });
      expect(memories.length).toBe(2);
    });

    it("should use provided limit", async () => {
      await factory.getMemories({ limit: 50 });

      expect(mockMemory.list).toHaveBeenCalledWith({
        memorySpaceId: config.memorySpaceId,
        limit: 50,
      });
    });

    it("should default limit to 100", async () => {
      await factory.getMemories();

      expect(mockMemory.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });

    it("should throw on list error", async () => {
      mockMemory.list.mockRejectedValueOnce(new Error("List failed"));

      await expect(factory.getMemories()).rejects.toThrow("List failed");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // clearMemories
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("clearMemories", () => {
    it("should require confirm: true", async () => {
      await expect(factory.clearMemories()).rejects.toThrow(
        "requires { confirm: true }",
      );
    });

    it("should require confirm to be explicitly true", async () => {
      await expect(factory.clearMemories({ confirm: false })).rejects.toThrow(
        "requires { confirm: true }",
      );
    });

    it("should call cortex.memory.deleteMany with confirm", async () => {
      mockStorage.deleteResult = { deleted: 5 };

      const deleted = await factory.clearMemories({ confirm: true });

      expect(mockMemory.deleteMany).toHaveBeenCalledWith({
        memorySpaceId: config.memorySpaceId,
        userId: undefined,
        sourceType: undefined,
      });
      expect(deleted).toBe(5);
    });

    it("should pass userId filter", async () => {
      await factory.clearMemories({ confirm: true, userId: "user-123" });

      expect(mockMemory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-123" }),
      );
    });

    it("should pass sourceType filter", async () => {
      await factory.clearMemories({
        confirm: true,
        sourceType: "conversation",
      });

      expect(mockMemory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: "conversation" }),
      );
    });

    it("should throw on delete error", async () => {
      mockMemory.deleteMany.mockRejectedValueOnce(new Error("Delete failed"));

      await expect(factory.clearMemories({ confirm: true })).rejects.toThrow(
        "Delete failed",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getConfig
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getConfig", () => {
    it("should return frozen copy of config", () => {
      const returnedConfig = factory.getConfig();

      expect(returnedConfig.memorySpaceId).toBe(config.memorySpaceId);
      expect(returnedConfig.userId).toBe(config.userId);
      expect(Object.isFrozen(returnedConfig)).toBe(true);
    });

    it("should not allow modification", () => {
      const returnedConfig = factory.getConfig();

      expect(() => {
        (returnedConfig as any).memorySpaceId = "modified";
      }).toThrow();
    });
  });
});
