/**
 * Integration Tests: Chat Flow
 *
 * Tests the complete chat pipeline with mocked Cortex SDK.
 * Verifies: recall -> generate -> remember sequence
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateTestId } from "../helpers/test-utils.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MockMemory {
  memoryId: string;
  content: string;
  importance: number;
}

interface MockFact {
  factId: string;
  fact: string;
  factType: string;
  confidence: number;
}

interface MockConversation {
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Mutable state for test control
let memories: MockMemory[] = [];
let facts: MockFact[] = [];
let conversations: Map<string, MockConversation> = new Map();
let recallCalled = false;
let rememberCalled = false;
let recallShouldFail = false;
let rememberShouldFail = false;
let factsListShouldFail = false;

function resetState() {
  memories = [];
  facts = [];
  conversations = new Map();
  recallCalled = false;
  rememberCalled = false;
  recallShouldFail = false;
  rememberShouldFail = false;
  factsListShouldFail = false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock Setup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Create mock cortex that uses the module-level state
const createMockCortex = () => ({
  memory: {
    recall: vi.fn(async () => {
      recallCalled = true;
      if (recallShouldFail) {
        throw new Error("Recall failed");
      }
      // Return a copy to avoid reference issues when remember modifies the array
      const memoriesCopy = [...memories];
      const factsCopy = [...facts];
      return {
        memories: memoriesCopy,
        facts: factsCopy,
        context: memoriesCopy.map(m => m.content).join("\n"),
        totalResults: memoriesCopy.length + factsCopy.length,
      };
    }),
    remember: vi.fn(async (params: any) => {
      rememberCalled = true;
      if (rememberShouldFail) {
        throw new Error("Remember failed");
      }
      const convId = params.conversationId || generateTestId("conv");
      memories.push({
        memoryId: generateTestId("mem"),
        content: params.userMessage,
        importance: 50,
      });
      return {
        conversation: { conversationId: convId },
        memories: memories,
        facts: [],
      };
    }),
    list: vi.fn(async () => memories),
  },
  facts: {
    list: vi.fn(async () => {
      if (factsListShouldFail) {
        throw new Error("List failed");
      }
      return { facts };
    }),
  },
  conversations: {
    get: vi.fn(async (convId: string) => conversations.get(convId) || null),
    list: vi.fn(async () => Array.from(conversations.values())),
  },
  close: vi.fn(),
});

let mockCortex = createMockCortex();

// Mock the cortex module
vi.mock("../../cortex.js", () => ({
  getCortex: vi.fn(() => mockCortex),
  closeCortex: vi.fn(),
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
  buildRememberParams: vi.fn(async (msg: { userMessage: string; agentResponse: string; conversationId: string }) => ({
    memorySpaceId: "test-space",
    conversationId: msg.conversationId,
    userMessage: msg.userMessage,
    agentResponse: msg.agentResponse,
    userId: "test-user",
    userName: "Test User",
    agentId: "test-agent",
    agentName: "Test Agent",
  })),
  createLayerObserver: vi.fn(() => ({
    onOrchestrationStart: vi.fn(),
    onLayerUpdate: vi.fn(),
    onOrchestrationComplete: vi.fn(),
  })),
}));

// Mock LLM module
vi.mock("../../llm.js", () => ({
  isLLMAvailable: vi.fn(() => false),
  generateResponse: vi.fn(async (userMessage: string) => `Echo: ${userMessage}`),
}));

// Mock display module (suppress console output in tests)
vi.mock("../../display.js", () => ({
  printRecallResults: vi.fn(),
  printOrchestrationComplete: vi.fn(),
  printInfo: vi.fn(),
  printError: vi.fn(),
  printSuccess: vi.fn(),
}));

// Import after mocks
import {
  chat,
  recallMemories,
  listFacts,
  getHistory,
  generateConversationId,
  getConversationId,
  newConversation,
  printConfig,
} from "../../chat.js";

import { printRecallResults, printInfo } from "../../display.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Chat Flow Integration", () => {
  beforeEach(() => {
    resetState();
    mockCortex = createMockCortex();
    vi.clearAllMocks();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Full Chat Flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("chat()", () => {
    it("should complete full recall -> generate -> remember flow", async () => {
      const result = await chat("Hello, world!");

      // Verify recall was called
      expect(recallCalled).toBe(true);

      // Verify remember was called
      expect(rememberCalled).toBe(true);

      // Verify result structure
      expect(result).toHaveProperty("response");
      expect(result).toHaveProperty("conversationId");
      expect(result).toHaveProperty("memoriesRecalled");
      expect(result).toHaveProperty("factsRecalled");
    });

    it("should return recalled memories and facts count", async () => {
      // Add memories and facts
      memories.push({
        memoryId: "mem-1",
        content: "Previous memory",
        importance: 80,
      });
      facts.push({
        factId: "fact-1",
        fact: "Test fact",
        factType: "knowledge",
        confidence: 90,
      });

      const result = await chat("What do you remember?");

      expect(result.memoriesRecalled).toBe(1);
      expect(result.factsRecalled).toBe(1);
    });

    it("should use provided conversation ID", async () => {
      const customConvId = generateTestId("custom-conv");

      const result = await chat("Hello", customConvId);

      expect(result.conversationId).toBe(customConvId);
    });

    it("should generate conversation ID if not provided", async () => {
      const result = await chat("Hello");

      expect(result.conversationId).toBeDefined();
      expect(result.conversationId).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });

    it("should display recall results", async () => {
      await chat("Hello");

      expect(printRecallResults).toHaveBeenCalled();
    });

    it("should handle recall errors gracefully", async () => {
      recallShouldFail = true;

      // Should not throw
      const result = await chat("Hello");

      // Should still return a response
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.memoriesRecalled).toBe(0);
      expect(result.factsRecalled).toBe(0);
    });

    it("should still return response if remember fails", async () => {
      rememberShouldFail = true;

      // Should not throw
      const result = await chat("Hello");

      // Should still have the response
      expect(result.response).toBe("Echo: Hello");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Management
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("conversation management", () => {
    it("should generate valid conversation IDs", () => {
      const id = generateConversationId();

      expect(id).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });

    it("should reuse conversation ID within same session", async () => {
      const result1 = await chat("First message");
      const result2 = await chat("Second message");

      expect(result1.conversationId).toBe(result2.conversationId);
    });

    it("should create new conversation ID when requested", () => {
      const oldId = getConversationId();
      const newId = newConversation();

      expect(newId).not.toBe(oldId);
      expect(newId).toMatch(/^conv-\d+-[a-z0-9]+$/);
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("Started new conversation"));
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Query Functions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("recallMemories()", () => {
    it("should call recall with query", async () => {
      await recallMemories("test query");

      expect(recallCalled).toBe(true);
    });

    it("should display recall results", async () => {
      await recallMemories("test");

      expect(printRecallResults).toHaveBeenCalled();
    });

    it("should handle recall errors", async () => {
      recallShouldFail = true;

      // Should not throw
      await expect(recallMemories("test")).resolves.not.toThrow();
    });
  });

  describe("listFacts()", () => {
    it("should call facts.list", async () => {
      facts.push({
        factId: "fact-1",
        fact: "Test fact",
        factType: "knowledge",
        confidence: 90,
      });

      await listFacts();

      // Should display results
      expect(printRecallResults).toHaveBeenCalled();
    });

    it("should display facts results", async () => {
      facts.push({
        factId: "fact-1",
        fact: "Test fact",
        factType: "knowledge",
        confidence: 90,
      });

      await listFacts();

      expect(printRecallResults).toHaveBeenCalled();
    });

    it("should handle list errors", async () => {
      factsListShouldFail = true;

      // Should not throw
      await expect(listFacts()).resolves.not.toThrow();
    });
  });

  describe("getHistory()", () => {
    it("should get conversation history when available", async () => {
      // First create a conversation by chatting
      await chat("Hello");
      const convId = getConversationId();

      // Add conversation to mock state
      conversations.set(convId, {
        conversationId: convId,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      });

      // Should not throw
      await expect(getHistory()).resolves.not.toThrow();
    });

    it("should handle conversation not found", async () => {
      // Create a conversation first
      await chat("Hello");

      // Should not throw even if conversation doesn't exist in mock
      await expect(getHistory()).resolves.not.toThrow();
    });
  });

  describe("printConfig()", () => {
    it("should be callable", () => {
      // Just verify it doesn't throw
      expect(() => printConfig()).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Accumulation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("memory accumulation", () => {
    it("should store memories across multiple messages", async () => {
      await chat("First message");
      await chat("Second message");
      await chat("Third message");

      // Should have accumulated memories
      expect(memories.length).toBe(3);
    });

    it("should return increasing memory count on recall", async () => {
      // First chat stores 1 memory
      await chat("First message");

      // Mock returns accumulated memories
      const result2 = await chat("Second message");

      // Should show memories from previous chats
      expect(result2.memoriesRecalled).toBeGreaterThanOrEqual(1);
    });
  });
});
