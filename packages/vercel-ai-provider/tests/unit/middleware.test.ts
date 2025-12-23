/**
 * Unit Tests: Middleware Functions
 *
 * Tests all middleware functions with comprehensive edge cases
 */

import {
  resolveUserId,
  resolveConversationId,
  resolveAgentId,
  resolveAgentName,
  buildMemoryContext,
  injectMemoryContext,
  getLastUserMessage,
  validateConfig,
  generateId,
} from "../../src/memory-middleware";
import { createLogger } from "../../src/types";
import type { CortexMemoryConfig } from "../../src/types";
import {
  createTestConfig,
  createMockMemories,
} from "../helpers/test-utils";

describe("Middleware Functions", () => {
  const logger = createLogger(false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // resolveUserId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("resolveUserId", () => {
    it("should return static userId string", async () => {
      const config = createTestConfig({ userId: "user-123" });
      const userId = await resolveUserId(config, logger);
      expect(userId).toBe("user-123");
    });

    it("should resolve userId from sync function", async () => {
      const config = createTestConfig({ userId: () => "dynamic-user" });
      const userId = await resolveUserId(config, logger);
      expect(userId).toBe("dynamic-user");
    });

    it("should resolve userId from async function", async () => {
      const config = createTestConfig({
        userId: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "async-user";
        },
      });
      const userId = await resolveUserId(config, logger);
      expect(userId).toBe("async-user");
    });

    it("should throw error when function returns empty string", async () => {
      const config = createTestConfig({ userId: () => "" });
      await expect(resolveUserId(config, logger)).rejects.toThrow(
        "must return a non-empty string",
      );
    });

    it("should throw error when function returns non-string", async () => {
      const config = createTestConfig({
        userId: () => null as unknown as string,
      });
      await expect(resolveUserId(config, logger)).rejects.toThrow(
        "must return a non-empty string",
      );
    });

    it("should throw error when function throws", async () => {
      const config = createTestConfig({
        userId: () => {
          throw new Error("User not found");
        },
      });
      await expect(resolveUserId(config, logger)).rejects.toThrow(
        "Failed to resolve userId",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // resolveConversationId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("resolveConversationId", () => {
    it("should return static conversationId string", async () => {
      const config = createTestConfig({ conversationId: "conv-123" });
      const conversationId = await resolveConversationId(config, logger);
      expect(conversationId).toBe("conv-123");
    });

    it("should resolve conversationId from function", async () => {
      const config = createTestConfig({
        conversationId: () => "dynamic-conv",
      });
      const conversationId = await resolveConversationId(config, logger);
      expect(conversationId).toBe("dynamic-conv");
    });

    it("should auto-generate conversationId when not provided", async () => {
      const config = createTestConfig();
      delete (config as any).conversationId;

      const conversationId = await resolveConversationId(config, logger);
      expect(conversationId).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });

    it("should generate unique conversationIds", async () => {
      const config = createTestConfig();
      delete (config as any).conversationId;

      const id1 = await resolveConversationId(config, logger);
      const id2 = await resolveConversationId(config, logger);
      expect(id1).not.toBe(id2);
    });

    it("should throw error when function returns empty string", async () => {
      const config = createTestConfig({ conversationId: () => "" });
      await expect(resolveConversationId(config, logger)).rejects.toThrow(
        "must return a non-empty string",
      );
    });

    it("should throw error when function throws", async () => {
      const config = createTestConfig({
        conversationId: () => {
          throw new Error("Conv lookup failed");
        },
      });
      await expect(resolveConversationId(config, logger)).rejects.toThrow(
        "Failed to resolve conversationId",
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // resolveAgentId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("resolveAgentId", () => {
    it("should return agentId when provided", () => {
      const config = createTestConfig({ agentId: "my-agent" });
      const agentId = resolveAgentId(config);
      expect(agentId).toBe("my-agent");
    });

    it("should throw error when agentId is missing", () => {
      const config = createTestConfig();
      delete (config as any).agentId;

      expect(() => resolveAgentId(config)).toThrow("agentId is required");
    });

    it("should throw error when agentId is empty string", () => {
      const config = createTestConfig({ agentId: "" });
      expect(() => resolveAgentId(config)).toThrow("agentId is required");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // resolveAgentName
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("resolveAgentName", () => {
    it("should return agentName when provided", () => {
      const config = createTestConfig({
        agentId: "agent-1",
        agentName: "My Assistant",
      });
      const name = resolveAgentName(config);
      expect(name).toBe("My Assistant");
    });

    it("should fall back to agentId when agentName not provided", () => {
      const config = createTestConfig({ agentId: "agent-1" });
      delete (config as any).agentName;

      const name = resolveAgentName(config);
      expect(name).toBe("agent-1");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // buildMemoryContext
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("buildMemoryContext", () => {
    it("should return empty string for empty memories", () => {
      const config = createTestConfig();
      const context = buildMemoryContext([], config, logger);
      expect(context).toBe("");
    });

    it("should build context from multiple memories", () => {
      const config = createTestConfig();
      const memories = createMockMemories(2);

      const context = buildMemoryContext(memories, config, logger);

      expect(context).toContain("Test memory 1");
      expect(context).toContain("Test memory 2");
      expect(context).toContain("importance: 80/100");
      expect(context).toContain("importance: 70/100");
    });

    it("should use custom context builder when provided", () => {
      const config = createTestConfig({
        customContextBuilder: (memories) =>
          `Custom: ${memories.map((m) => m.content).join(", ")}`,
      });
      const memories = createMockMemories(2);

      const context = buildMemoryContext(memories, config, logger);

      expect(context).toBe("Custom: Test memory 1, Test memory 2");
    });

    it("should fall back to default when custom builder throws", () => {
      const config = createTestConfig({
        customContextBuilder: () => {
          throw new Error("Custom builder failed");
        },
      });
      const memories = createMockMemories(1);

      const context = buildMemoryContext(memories, config, logger);

      // Should use default format
      expect(context).toContain("Test memory 1");
      expect(context).toContain("importance:");
    });

    it("should handle memories with missing content", () => {
      const config = createTestConfig();
      const memories = [
        { ...createMockMemories(1)[0], content: undefined as unknown as string },
      ];

      const context = buildMemoryContext(memories, config, logger);
      expect(context).toContain("(importance:");
    });

    it("should handle memories with missing importance", () => {
      const config = createTestConfig();
      const memories = [
        { ...createMockMemories(1)[0], importance: undefined as unknown as number },
      ];

      const context = buildMemoryContext(memories, config, logger);
      expect(context).toContain("importance: 50/100"); // default
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // injectMemoryContext
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("injectMemoryContext", () => {
    it("should return original messages when no memories", () => {
      const config = createTestConfig();
      const messages = [
        { role: "system" as const, content: "Be helpful" },
        { role: "user" as const, content: "Hello" },
      ];

      const result = injectMemoryContext(messages, [], config, logger);
      expect(result).toEqual(messages);
    });

    describe("system strategy", () => {
      it("should inject into existing system message", () => {
        const config = createTestConfig({ contextInjectionStrategy: "system" });
        const memories = createMockMemories(1);
        const messages = [
          { role: "system" as const, content: "Be helpful" },
          { role: "user" as const, content: "Hello" },
        ];

        const result = injectMemoryContext(messages, memories, config, logger);

        expect(result[0].role).toBe("system");
        expect(result[0].content).toContain("Be helpful");
        expect(result[0].content).toContain("Test memory 1");
        expect(result.length).toBe(2);
      });

      it("should create new system message when none exists", () => {
        const config = createTestConfig({ contextInjectionStrategy: "system" });
        const memories = createMockMemories(1);
        const messages = [{ role: "user" as const, content: "Hello" }];

        const result = injectMemoryContext(messages, memories, config, logger);

        expect(result[0].role).toBe("system");
        expect(result[0].content).toContain("Test memory 1");
        expect(result.length).toBe(2);
        expect(result[1].content).toBe("Hello");
      });
    });

    describe("user strategy", () => {
      it("should inject into last user message", () => {
        const config = createTestConfig({ contextInjectionStrategy: "user" });
        const memories = createMockMemories(1);
        const messages = [
          { role: "system" as const, content: "Be helpful" },
          { role: "user" as const, content: "First message" },
          { role: "assistant" as const, content: "Reply" },
          { role: "user" as const, content: "Second message" },
        ];

        const result = injectMemoryContext(messages, memories, config, logger);

        // Last user message (index 3) should have context
        expect(result[3].content).toContain("Second message");
        expect(result[3].content).toContain("Relevant context");
        expect(result[3].content).toContain("Test memory 1");
        // Earlier messages unchanged
        expect(result[1].content).toBe("First message");
      });

      it("should return original when no user message found", () => {
        const config = createTestConfig({ contextInjectionStrategy: "user" });
        const memories = createMockMemories(1);
        const messages = [
          { role: "system" as const, content: "Be helpful" },
          { role: "assistant" as const, content: "Hello!" },
        ];

        const result = injectMemoryContext(messages, memories, config, logger);
        expect(result).toEqual(messages);
      });
    });

    describe("custom strategy", () => {
      it("should fall back to system when custom without builder", () => {
        const config = createTestConfig({ contextInjectionStrategy: "custom" });
        const memories = createMockMemories(1);
        const messages = [{ role: "user" as const, content: "Hello" }];

        const result = injectMemoryContext(messages, memories, config, logger);

        // Falls back to system strategy
        expect(result[0].role).toBe("system");
        expect(result[0].content).toContain("Test memory 1");
      });
    });

    describe("unknown strategy", () => {
      it("should return original messages for unknown strategy", () => {
        const config = createTestConfig({
          contextInjectionStrategy: "unknown" as any,
        });
        const memories = createMockMemories(1);
        const messages = [{ role: "user" as const, content: "Hello" }];

        const result = injectMemoryContext(messages, memories, config, logger);
        expect(result).toEqual(messages);
      });
    });

    it("should use system strategy by default", () => {
      const config = createTestConfig();
      delete (config as any).contextInjectionStrategy;
      const memories = createMockMemories(1);
      const messages = [{ role: "user" as const, content: "Hello" }];

      const result = injectMemoryContext(messages, memories, config, logger);

      expect(result[0].role).toBe("system");
      expect(result[0].content).toContain("Test memory 1");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getLastUserMessage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getLastUserMessage", () => {
    it("should extract text from content parts array", () => {
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
          ],
        },
      ];

      const result = getLastUserMessage(messages);
      expect(result).toBe("Hello  world");
    });

    it("should return null for no user message", () => {
      const messages = [{ role: "system" as const, content: "Be helpful" }];
      const result = getLastUserMessage(messages);
      expect(result).toBeNull();
    });

    it("should return null for empty messages", () => {
      const result = getLastUserMessage([]);
      expect(result).toBeNull();
    });

    it("should return null for non-array content", () => {
      const messages = [{ role: "user" as const, content: "Plain text" }];
      // The function only handles array content
      const result = getLastUserMessage(messages);
      expect(result).toBeNull();
    });

    it("should filter non-text parts", () => {
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "image", url: "http://example.com/img.png" },
            { type: "text", text: "Describe this" },
          ],
        },
      ];

      const result = getLastUserMessage(messages);
      expect(result).toBe("Describe this");
    });

    it("should get the LAST user message", () => {
      const messages = [
        {
          role: "user" as const,
          content: [{ type: "text", text: "First" }],
        },
        { role: "assistant" as const, content: "Reply" },
        {
          role: "user" as const,
          content: [{ type: "text", text: "Second" }],
        },
      ];

      const result = getLastUserMessage(messages);
      expect(result).toBe("Second");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // validateConfig
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("validateConfig", () => {
    describe("required fields", () => {
      it("should throw when convexUrl is missing", () => {
        const config = createTestConfig();
        (config as any).convexUrl = "";

        expect(() => validateConfig(config)).toThrow("convexUrl is required");
      });

      it("should throw when memorySpaceId is missing", () => {
        const config = createTestConfig();
        (config as any).memorySpaceId = "";

        expect(() => validateConfig(config)).toThrow(
          "memorySpaceId is required",
        );
      });

      it("should throw when userId is missing", () => {
        const config = createTestConfig();
        (config as any).userId = "";

        expect(() => validateConfig(config)).toThrow("userId is required");
      });

      it("should throw when agentId is missing", () => {
        const config = createTestConfig();
        (config as any).agentId = "";

        expect(() => validateConfig(config)).toThrow("agentId is required");
      });

      it("should throw descriptive error for missing agentId", () => {
        const config = createTestConfig();
        delete (config as any).agentId;

        expect(() => validateConfig(config)).toThrow(
          /agentId is required.*SDK v0\.17\.0/,
        );
      });
    });

    describe("agentId validation", () => {
      it("should throw when agentId is whitespace only", () => {
        const config = createTestConfig({ agentId: "   " });
        expect(() => validateConfig(config)).toThrow(
          "agentId must be a non-empty string",
        );
      });
    });

    describe("numeric ranges", () => {
      it("should throw when memorySearchLimit is negative", () => {
        const config = createTestConfig({ memorySearchLimit: -1 });
        expect(() => validateConfig(config)).toThrow(
          "memorySearchLimit must be >= 0",
        );
      });

      it("should accept memorySearchLimit of 0", () => {
        const config = createTestConfig({ memorySearchLimit: 0 });
        expect(() => validateConfig(config)).not.toThrow();
      });

      it("should throw when minMemoryRelevance is below 0", () => {
        const config = createTestConfig({ minMemoryRelevance: -0.1 });
        expect(() => validateConfig(config)).toThrow(
          "minMemoryRelevance must be between 0 and 1",
        );
      });

      it("should throw when minMemoryRelevance is above 1", () => {
        const config = createTestConfig({ minMemoryRelevance: 1.1 });
        expect(() => validateConfig(config)).toThrow(
          "minMemoryRelevance must be between 0 and 1",
        );
      });

      it("should accept minMemoryRelevance between 0 and 1", () => {
        const config = createTestConfig({ minMemoryRelevance: 0.7 });
        expect(() => validateConfig(config)).not.toThrow();
      });

      it("should throw when defaultImportance is below 0", () => {
        const config = createTestConfig({ defaultImportance: -1 });
        expect(() => validateConfig(config)).toThrow(
          "defaultImportance must be between 0 and 100",
        );
      });

      it("should throw when defaultImportance is above 100", () => {
        const config = createTestConfig({ defaultImportance: 101 });
        expect(() => validateConfig(config)).toThrow(
          "defaultImportance must be between 0 and 100",
        );
      });

      it("should accept defaultImportance between 0 and 100", () => {
        const config = createTestConfig({ defaultImportance: 50 });
        expect(() => validateConfig(config)).not.toThrow();
      });
    });

    it("should pass validation for valid config", () => {
      const config = createTestConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // generateId
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("generateId", () => {
    it("should generate ID with default prefix", () => {
      const id = generateId();
      expect(id).toMatch(/^id-\d+-[a-z0-9]+$/);
    });

    it("should generate ID with custom prefix", () => {
      const id = generateId("conv");
      expect(id).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
