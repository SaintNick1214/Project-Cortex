/**
 * Unit tests for chat.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Create mock functions we can control
const mockRecall = vi.fn();
const mockRemember = vi.fn();
const mockFactsList = vi.fn();
const mockConversationsGet = vi.fn();

const mockCortex = {
  memory: {
    recall: mockRecall,
    remember: mockRemember,
  },
  facts: {
    list: mockFactsList,
  },
  conversations: {
    get: mockConversationsGet,
  },
};

// Mock dependencies
vi.mock("../cortex.js", () => ({
  getCortex: vi.fn(() => mockCortex),
  CONFIG: {
    memorySpaceId: "test-space",
    userId: "test-user",
    userName: "Test User",
    agentId: "test-agent",
    agentName: "Test Agent",
    enableFactExtraction: true,
    enableGraphMemory: false,
    debug: false,
  },
  buildRememberParams: vi.fn().mockResolvedValue({
    memorySpaceId: "test-space",
    conversationId: "conv-123",
    userId: "test-user",
    agentId: "test-agent",
    userMessage: "Hello",
    agentResponse: "Hi there",
  }),
  createLayerObserver: vi.fn().mockReturnValue({
    onOrchestrationStart: vi.fn(),
    onLayerUpdate: vi.fn(),
    onOrchestrationComplete: vi.fn(),
  }),
}));

vi.mock("../display.js", () => ({
  printRecallResults: vi.fn(),
  printOrchestrationComplete: vi.fn(),
  printInfo: vi.fn(),
}));

vi.mock("../llm.js", () => ({
  generateResponse: vi.fn().mockResolvedValue("Test response"),
  isLLMAvailable: vi.fn().mockReturnValue(false),
}));

describe("chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    mockRecall.mockResolvedValue({ memories: [], facts: [] });
    mockRemember.mockResolvedValue({});
    mockFactsList.mockResolvedValue({ facts: [] });
    mockConversationsGet.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateConversationId", () => {
    it("generates unique IDs", async () => {
      const { generateConversationId } = await import("../chat.js");

      const id1 = generateConversationId();
      const id2 = generateConversationId();

      expect(id1).not.toBe(id2);
    });

    it("generates IDs with correct format", async () => {
      const { generateConversationId } = await import("../chat.js");

      const id = generateConversationId();

      expect(id).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });
  });

  describe("getConversationId", () => {
    it("creates a new conversation ID if none exists", async () => {
      vi.resetModules();
      const { getConversationId } = await import("../chat.js");

      const id = getConversationId();

      expect(id).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });

    it("returns the same ID on subsequent calls", async () => {
      vi.resetModules();
      const { getConversationId } = await import("../chat.js");

      const id1 = getConversationId();
      const id2 = getConversationId();

      expect(id1).toBe(id2);
    });
  });

  describe("newConversation", () => {
    it("creates a new conversation ID", async () => {
      vi.resetModules();
      const { newConversation, getConversationId } = await import("../chat.js");

      const oldId = getConversationId();
      const newId = newConversation();

      expect(newId).not.toBe(oldId);
    });

    it("prints info message", async () => {
      const { printInfo } = await import("../display.js");
      vi.resetModules();
      const { newConversation } = await import("../chat.js");

      newConversation();

      expect(printInfo).toHaveBeenCalledWith(
        expect.stringContaining("Started new conversation"),
      );
    });
  });

  describe("chat", () => {
    it("calls recall, generate, and remember in sequence", async () => {
      mockRecall.mockResolvedValue({ memories: [], facts: [] });
      mockRemember.mockResolvedValue({});

      const { generateResponse } = await import("../llm.js");
      vi.mocked(generateResponse).mockResolvedValue("Test response");

      vi.resetModules();
      const { chat } = await import("../chat.js");

      const result = await chat("Hello", "conv-123");

      expect(mockRecall).toHaveBeenCalled();
      expect(generateResponse).toHaveBeenCalledWith("Hello", [], []);
      expect(mockRemember).toHaveBeenCalled();
      expect(result.response).toBe("Test response");
    });

    it("returns conversation ID and recall counts", async () => {
      mockRecall.mockResolvedValue({
        memories: [{ content: "mem1" }],
        facts: [{ content: "fact1" }, { content: "fact2" }],
      });
      mockRemember.mockResolvedValue({});

      vi.resetModules();
      const { chat } = await import("../chat.js");

      const result = await chat("Hello", "conv-123");

      expect(result.conversationId).toBe("conv-123");
      expect(result.memoriesRecalled).toBe(1);
      expect(result.factsRecalled).toBe(2);
    });

    it("handles recall errors gracefully", async () => {
      // Reset the generateResponse mock to ensure it returns expected value
      const { generateResponse } = await import("../llm.js");
      vi.mocked(generateResponse).mockResolvedValue("Test response");

      // Import chat first before setting up error behavior
      const { chat, generateConversationId } = await import("../chat.js");

      // Now set up the error
      mockRecall.mockRejectedValueOnce(new Error("Recall failed"));
      mockRemember.mockResolvedValue({});

      // Should not throw
      const convId = generateConversationId();
      const result = await chat("Hello", convId);

      expect(result.response).toBe("Test response");
      expect(result.memoriesRecalled).toBe(0);
      expect(result.factsRecalled).toBe(0);
    });

    it("still returns response if remember fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Reset the generateResponse mock to ensure it returns expected value
      const { generateResponse } = await import("../llm.js");
      vi.mocked(generateResponse).mockResolvedValue("Test response");

      // Import chat first
      const { chat, generateConversationId } = await import("../chat.js");

      // Now set up the behaviors
      mockRecall.mockResolvedValueOnce({ memories: [], facts: [] });
      mockRemember.mockRejectedValueOnce(new Error("Remember failed"));

      const convId = generateConversationId();
      const result = await chat("Hello", convId);

      expect(result.response).toBe("Test response");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to store memory:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("uses current conversation ID if none provided", async () => {
      mockRecall.mockResolvedValue({ memories: [], facts: [] });
      mockRemember.mockResolvedValue({});

      vi.resetModules();
      const { chat, getConversationId } = await import("../chat.js");

      const currentId = getConversationId();
      const result = await chat("Hello");

      expect(result.conversationId).toBe(currentId);
    });
  });

  describe("recallMemories", () => {
    it("searches and prints results", async () => {
      mockRecall.mockResolvedValue({
        memories: [{ content: "test memory" }],
        facts: [{ content: "test fact" }],
      });

      const { printRecallResults } = await import("../display.js");

      vi.resetModules();
      const { recallMemories } = await import("../chat.js");

      await recallMemories("test query");

      expect(mockRecall).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "test query",
        }),
      );
      expect(printRecallResults).toHaveBeenCalled();
    });

    it("handles errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mockRecall.mockRejectedValue(new Error("Search failed"));

      vi.resetModules();
      const { recallMemories } = await import("../chat.js");

      await recallMemories("test query");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Recall failed:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("listFacts", () => {
    it("lists facts and prints results", async () => {
      mockFactsList.mockResolvedValue({
        facts: [{ content: "fact 1" }, { content: "fact 2" }],
      });

      const { printRecallResults } = await import("../display.js");

      vi.resetModules();
      const { listFacts } = await import("../chat.js");

      await listFacts();

      expect(mockFactsList).toHaveBeenCalled();
      expect(printRecallResults).toHaveBeenCalledWith(
        [],
        expect.arrayContaining([
          expect.objectContaining({ content: "fact 1" }),
        ]),
      );
    });
  });

  describe("getHistory", () => {
    it("prints info when no conversation is active", async () => {
      const { printInfo } = await import("../display.js");

      vi.resetModules();
      const { getHistory } = await import("../chat.js");

      // getHistory will call getCortex and use the mock
      await getHistory();

      // Without a conversation ID, it should print info
      expect(printInfo).toHaveBeenCalled();
    });
  });

  describe("printConfig", () => {
    it("prints configuration details", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      vi.resetModules();
      const { printConfig } = await import("../chat.js");

      printConfig();

      const output = consoleSpy.mock.calls.flat().join("\n");
      expect(output).toContain("Configuration:");
      expect(output).toContain("Memory Space:");
      expect(output).toContain("User:");
      expect(output).toContain("Agent:");
      expect(output).toContain("Fact Extraction:");
      expect(output).toContain("Graph Sync:");
      expect(output).toContain("LLM:");

      consoleSpy.mockRestore();
    });
  });
});
