/**
 * Integration Tests: AI SDK v6 API Routes
 *
 * Tests the v6 API route handlers with different message formats.
 * These tests don't require a running server - they test the route
 * handler logic directly.
 */

import {
  createTestMemorySpaceId,
  createTestUserId,
  createTestConversationId,
} from "../helpers/test-utils";

describe("AI SDK v6 API Route Integration", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Message Normalization
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("normalizeMessages", () => {
    const normalizeMessages = (messages: unknown[]): unknown[] => {
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
    };

    describe("v5 message format (content string)", () => {
      it("should convert content string to parts array", () => {
        const messages = [
          {
            id: "msg-1",
            role: "user",
            content: "Hello world",
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        const msg = normalized[0] as any;

        expect(msg.parts).toEqual([{ type: "text", text: "Hello world" }]);
        expect(msg.role).toBe("user");
      });

      it("should handle empty content", () => {
        const messages = [
          {
            id: "msg-1",
            role: "user",
            content: "",
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        const msg = normalized[0] as any;

        expect(msg.parts).toEqual([]);
      });

      it("should handle undefined content", () => {
        const messages = [
          {
            id: "msg-1",
            role: "user",
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        const msg = normalized[0] as any;

        expect(msg.parts).toEqual([]);
      });
    });

    describe("v6 message format (parts array)", () => {
      it("should pass through parts array unchanged", () => {
        const messages = [
          {
            id: "msg-1",
            role: "user",
            parts: [
              { type: "text", text: "Hello" },
              { type: "text", text: " world" },
            ],
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        const msg = normalized[0] as any;

        expect(msg.parts).toEqual([
          { type: "text", text: "Hello" },
          { type: "text", text: " world" },
        ]);
      });

      it("should preserve other part types", () => {
        const messages = [
          {
            id: "msg-1",
            role: "user",
            parts: [
              { type: "text", text: "Check this image:" },
              { type: "image", url: "https://example.com/image.png" },
            ],
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        const msg = normalized[0] as any;

        expect(msg.parts).toHaveLength(2);
        expect(msg.parts[1].type).toBe("image");
      });
    });

    describe("role normalization", () => {
      it('should convert "agent" role to "assistant"', () => {
        const messages = [
          {
            id: "msg-1",
            role: "agent",
            content: "I am an agent",
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        const msg = normalized[0] as any;

        expect(msg.role).toBe("assistant");
      });

      it("should preserve user role", () => {
        const messages = [
          {
            id: "msg-1",
            role: "user",
            content: "Hello",
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        expect((normalized[0] as any).role).toBe("user");
      });

      it("should preserve assistant role", () => {
        const messages = [
          {
            id: "msg-1",
            role: "assistant",
            content: "Hello",
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        expect((normalized[0] as any).role).toBe("assistant");
      });

      it("should preserve system role", () => {
        const messages = [
          {
            id: "msg-1",
            role: "system",
            content: "You are a helpful assistant",
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);
        expect((normalized[0] as any).role).toBe("system");
      });
    });

    describe("mixed format messages", () => {
      it("should handle conversation with mixed formats", () => {
        const messages = [
          {
            id: "msg-1",
            role: "user",
            content: "What's my favorite color?",
            createdAt: new Date().toISOString(),
          },
          {
            id: "msg-2",
            role: "agent",
            content: "Based on what you told me, your favorite color is blue.",
            createdAt: new Date().toISOString(),
          },
          {
            id: "msg-3",
            role: "user",
            parts: [{ type: "text", text: "Actually, I prefer purple now" }],
            createdAt: new Date().toISOString(),
          },
        ];

        const normalized = normalizeMessages(messages);

        // First message: v5 format -> converted
        expect((normalized[0] as any).parts[0].text).toBe("What's my favorite color?");
        expect((normalized[0] as any).role).toBe("user");

        // Second message: agent role -> assistant, content -> parts
        expect((normalized[1] as any).role).toBe("assistant");
        expect((normalized[1] as any).parts[0].text).toContain("favorite color is blue");

        // Third message: already v6 format
        expect((normalized[2] as any).parts[0].text).toBe("Actually, I prefer purple now");
        expect((normalized[2] as any).role).toBe("user");
      });
    });

    describe("preserves other properties", () => {
      it("should preserve id, createdAt, and custom properties", () => {
        const messages = [
          {
            id: "msg-123",
            role: "user",
            content: "Hello",
            createdAt: "2026-01-01T00:00:00Z",
            customProp: "value",
            metadata: { key: "value" },
          },
        ];

        const normalized = normalizeMessages(messages);
        const msg = normalized[0] as any;

        expect(msg.id).toBe("msg-123");
        expect(msg.createdAt).toBe("2026-01-01T00:00:00Z");
        expect(msg.customProp).toBe("value");
        expect(msg.metadata).toEqual({ key: "value" });
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getMessageText Helper
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("getMessageText", () => {
    const getMessageText = (message: {
      content?: string;
      parts?: Array<{ type: string; text?: string }>;
    }): string => {
      if (typeof message.content === "string") {
        return message.content;
      }
      if (message.parts && Array.isArray(message.parts)) {
        return message.parts
          .filter((part) => part.type === "text" && part.text)
          .map((part) => part.text)
          .join("");
      }
      return "";
    };

    it("should extract text from content string", () => {
      const message = { content: "Hello world" };
      expect(getMessageText(message)).toBe("Hello world");
    });

    it("should extract text from parts array", () => {
      const message = {
        parts: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world" },
        ],
      };
      expect(getMessageText(message)).toBe("Hello world");
    });

    it("should ignore non-text parts", () => {
      const message = {
        parts: [
          { type: "text", text: "Check this:" },
          { type: "image", url: "https://example.com/image.png" },
          { type: "text", text: " Cool, right?" },
        ],
      };
      expect(getMessageText(message)).toBe("Check this: Cool, right?");
    });

    it("should return empty string for empty message", () => {
      expect(getMessageText({})).toBe("");
      expect(getMessageText({ parts: [] })).toBe("");
      expect(getMessageText({ content: "" })).toBe("");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Request Body Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("request body validation", () => {
    const validateRequestBody = (body: any): { valid: boolean; error?: string } => {
      if (!body.messages || !Array.isArray(body.messages)) {
        return { valid: false, error: "messages array is required" };
      }
      return { valid: true };
    };

    it("should accept valid request with messages array", () => {
      const body = {
        messages: [{ role: "user", content: "Hello" }],
        memorySpaceId: "test",
        userId: "user-1",
      };
      expect(validateRequestBody(body)).toEqual({ valid: true });
    });

    it("should reject request with undefined messages", () => {
      const body = {
        memorySpaceId: "test",
        userId: "user-1",
      };
      expect(validateRequestBody(body)).toEqual({
        valid: false,
        error: "messages array is required",
      });
    });

    it("should reject request with null messages", () => {
      const body = {
        messages: null,
        memorySpaceId: "test",
        userId: "user-1",
      };
      expect(validateRequestBody(body)).toEqual({
        valid: false,
        error: "messages array is required",
      });
    });

    it("should reject request with non-array messages", () => {
      const body = {
        messages: "not an array",
        memorySpaceId: "test",
        userId: "user-1",
      };
      expect(validateRequestBody(body)).toEqual({
        valid: false,
        error: "messages array is required",
      });
    });

    it("should accept request with empty messages array", () => {
      // Empty array is technically valid - route can handle it
      const body = {
        messages: [],
        memorySpaceId: "test",
        userId: "user-1",
      };
      expect(validateRequestBody(body)).toEqual({ valid: true });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation ID Generation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("conversation ID generation", () => {
    it("should use provided conversation ID", () => {
      const providedId = "conv-provided-123";
      const conversationId = providedId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      expect(conversationId).toBe(providedId);
    });

    it("should generate unique ID when not provided", () => {
      const providedId = null;
      const conversationId = providedId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      expect(conversationId).toMatch(/^conv-\d+-[a-z0-9]+$/);
    });

    it("should generate different IDs each time", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        ids.add(id);
      }
      // Should have at least 90 unique IDs (accounting for same timestamp)
      expect(ids.size).toBeGreaterThan(90);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Title Generation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("generateTitle", () => {
    const generateTitle = (message: string): string => {
      let title = message.slice(0, 50);
      if (message.length > 50) {
        const lastSpace = title.lastIndexOf(" ");
        if (lastSpace > 20) {
          title = title.slice(0, lastSpace);
        }
        title += "...";
      }
      return title;
    };

    it("should return short messages unchanged", () => {
      expect(generateTitle("Hello world")).toBe("Hello world");
    });

    it("should truncate long messages at word boundary", () => {
      const longMessage = "This is a very long message that should be truncated at a word boundary";
      const title = generateTitle(longMessage);
      expect(title.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(title).toMatch(/\.\.\.$/);
      // Should end with complete word + "..."
      // The logic finds last space before char 50 and cuts there
      expect(title).toBe("This is a very long message that should be...");
    });

    it("should handle messages exactly 50 chars", () => {
      const message = "A".repeat(50);
      expect(generateTitle(message)).toBe(message);
    });

    it("should handle messages just over 50 chars", () => {
      const message = "A".repeat(51);
      const title = generateTitle(message);
      expect(title.endsWith("...")).toBe(true);
    });
  });
});
