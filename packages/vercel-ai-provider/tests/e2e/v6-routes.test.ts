/**
 * E2E Tests: AI SDK v6 Routes
 *
 * Tests the v6 API routes with different message formats and the
 * v6 compatibility helpers (createCortexCallOptionsSchema, createMemoryPrepareCall).
 *
 * Requires: CONVEX_URL, OPENAI_API_KEY
 */

import { Cortex } from "@cortexmemory/sdk";
import {
  createTestMemorySpaceId,
  createTestUserId,
  createTestConversationId,
} from "../helpers/test-utils";
import {
  createCortexCallOptionsSchema,
  createMemoryPrepareCall,
  isV6Available,
} from "../../src/v6-compat";

// Skip if no Convex URL configured
const SKIP_E2E = !process.env.CONVEX_URL;

// Skip if no OpenAI API key
const SKIP_NO_OPENAI = !process.env.OPENAI_API_KEY;

describe("AI SDK v6 Routes E2E", () => {
  let memorySpaceId: string;
  let userId: string;
  let cortex: Cortex;

  beforeAll(() => {
    if (SKIP_E2E) {
      console.log("Skipping E2E tests - CONVEX_URL not configured");
      return;
    }
    if (SKIP_NO_OPENAI) {
      console.log("Skipping E2E tests - OPENAI_API_KEY not configured");
      return;
    }
  });

  beforeEach(async () => {
    if (SKIP_E2E || SKIP_NO_OPENAI) return;

    memorySpaceId = createTestMemorySpaceId("e2e-v6");
    userId = createTestUserId();
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  afterEach(async () => {
    if (cortex) {
      cortex.close();
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // v6 Feature Detection
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("v6 feature detection", () => {
    it("should detect if v6 is available", async () => {
      const available = await isV6Available();
      // This will be true if ai package exports v6 features
      expect(typeof available).toBe("boolean");
      console.log(`AI SDK v6 available: ${available}`);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Call Options Schema
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createCortexCallOptionsSchema", () => {
    it("should create a valid zod schema for call options", () => {
      const schema = createCortexCallOptionsSchema();
      expect(schema).toBeDefined();
      expect(typeof schema.parse).toBe("function");

      // Test valid input
      const validOptions = {
        userId: "test-user",
        memorySpaceId: "test-space",
        conversationId: "test-conv",
      };
      const parsed = schema.parse(validOptions);
      expect(parsed.userId).toBe("test-user");
      expect(parsed.memorySpaceId).toBe("test-space");
      expect(parsed.conversationId).toBe("test-conv");
    });

    it("should allow optional fields", () => {
      const schema = createCortexCallOptionsSchema();

      // Test with only required fields
      const minimalOptions = {
        userId: "test-user",
        memorySpaceId: "test-space",
      };
      const parsed = schema.parse(minimalOptions);
      expect(parsed.userId).toBe("test-user");
      expect(parsed.conversationId).toBeUndefined();
      expect(parsed.agentId).toBeUndefined();
    });

    it("should reject invalid input", () => {
      const schema = createCortexCallOptionsSchema();

      // Test missing required fields
      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ userId: "test" })).toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory PrepareCall
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E || SKIP_NO_OPENAI ? describe.skip : describe)(
    "createMemoryPrepareCall",
    () => {
      it("should create a prepareCall function", () => {
        const prepareCall = createMemoryPrepareCall({
          convexUrl: process.env.CONVEX_URL!,
          maxMemories: 10,
        });

        expect(typeof prepareCall).toBe("function");
      });

      it("should inject memory context into messages", async () => {
        const prepareCall = createMemoryPrepareCall({
          convexUrl: process.env.CONVEX_URL!,
          maxMemories: 10,
          includeFacts: true,
        });

        // Test prepareCall with a fresh user (no memories stored yet)
        // The function should still work, just return no context
        const originalMessages = [
          {
            role: "user",
            content: [{ type: "text", text: "Hello, this is a test" }],
          },
        ];

        const result = await prepareCall({
          options: { userId, memorySpaceId },
          messages: originalMessages,
        });

        // The result should have the messages property
        expect(result).toBeDefined();
        expect(result.messages).toBeDefined();

        // Should return at least the original messages
        expect(result.messages.length).toBeGreaterThanOrEqual(
          originalMessages.length,
        );

        console.log(
          "PrepareCall result:",
          JSON.stringify(result, null, 2).slice(0, 500),
        );
      }, 30000);
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Message Format Normalization
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("message format handling", () => {
    // Test message formats that the routes must handle
    const v5Messages = [
      {
        id: "msg-1",
        role: "user",
        content: "Hello, my name is Test User",
        createdAt: new Date().toISOString(),
      },
    ];

    const v6Messages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello, my name is Test User" }],
        createdAt: new Date().toISOString(),
      },
    ];

    const mixedMessages = [
      {
        id: "msg-1",
        role: "user",
        content: "First message",
        createdAt: new Date().toISOString(),
      },
      {
        id: "msg-2",
        role: "agent", // Note: "agent" role instead of "assistant"
        content: "Response from agent",
        createdAt: new Date().toISOString(),
      },
      {
        id: "msg-3",
        role: "user",
        parts: [{ type: "text", text: "Follow up question" }],
        createdAt: new Date().toISOString(),
      },
    ];

    it("should normalize v5 messages (content string) to have parts array", () => {
      // This tests the normalizeMessages function logic
      const normalized = normalizeMessagesForTest(v5Messages);
      expect(normalized[0].parts).toBeDefined();
      expect(normalized[0].parts[0].type).toBe("text");
      expect(normalized[0].parts[0].text).toBe("Hello, my name is Test User");
    });

    it("should pass through v6 messages unchanged", () => {
      const normalized = normalizeMessagesForTest(v6Messages);
      expect(normalized[0].parts).toEqual(v6Messages[0].parts);
    });

    it("should normalize agent role to assistant", () => {
      const normalized = normalizeMessagesForTest(mixedMessages);
      expect(normalized[1].role).toBe("assistant");
    });

    it("should handle mixed format messages", () => {
      const normalized = normalizeMessagesForTest(mixedMessages);

      // First message: content -> parts
      expect(normalized[0].parts).toBeDefined();
      expect(normalized[0].parts[0].text).toBe("First message");

      // Second message: agent -> assistant, content -> parts
      expect(normalized[1].role).toBe("assistant");
      expect(normalized[1].parts[0].text).toBe("Response from agent");

      // Third message: already has parts
      expect(normalized[2].parts[0].text).toBe("Follow up question");
    });
  });
});

/**
 * Normalize messages to AI SDK v6 UIMessage format.
 * This mirrors the normalizeMessages function in the route files.
 */
function normalizeMessagesForTest(messages: unknown[]): any[] {
  return messages.map((msg: unknown) => {
    const m = msg as Record<string, unknown>;

    // Normalize role: "agent" -> "assistant"
    let role = m.role as string;
    if (role === "agent") {
      role = "assistant";
    }

    // Ensure parts array exists
    let parts = m.parts as Array<{ type: string; text?: string }> | undefined;
    if (!parts) {
      // Convert content string to parts array
      const content = m.content as string | undefined;
      if (content) {
        parts = [{ type: "text", text: content }];
      } else {
        parts = [];
      }
    }

    return {
      ...m,
      role,
      parts,
    };
  });
}
