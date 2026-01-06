/**
 * Unit tests for llm.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock cortex.js CONFIG
vi.mock("../cortex.js", () => ({
  CONFIG: {
    debug: false,
  },
}));

describe("llm", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("isLLMAvailable", () => {
    it("returns false when OPENAI_API_KEY is not set", async () => {
      delete process.env.OPENAI_API_KEY;

      const { isLLMAvailable } = await import("../llm.js");

      expect(isLLMAvailable()).toBe(false);
    });

    it("returns true when OPENAI_API_KEY is set", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";

      const { isLLMAvailable } = await import("../llm.js");

      expect(isLLMAvailable()).toBe(true);
    });
  });

  describe("generateResponse", () => {
    describe("echo mode (no LLM)", () => {
      beforeEach(() => {
        delete process.env.OPENAI_API_KEY;
      });

      it("echoes the user message", async () => {
        const { generateResponse } = await import("../llm.js");

        const response = await generateResponse("Hello world", [], []);

        expect(response).toContain('I heard you say: "Hello world"');
      });

      it("shows empty memory message when no memories", async () => {
        const { generateResponse } = await import("../llm.js");

        const response = await generateResponse("Hello", [], []);

        expect(response).toContain("I don't have any memories of you yet");
        expect(response).toContain("Tell me something about yourself");
      });

      it("shows facts when available", async () => {
        const { generateResponse } = await import("../llm.js");

        const facts = [
          { content: "User's name is Alex", factType: "identity" },
          { content: "User likes coffee", factType: "preference" },
        ];

        const response = await generateResponse("Hello", [], facts);

        expect(response).toContain("Here's what I remember about you");
        expect(response).toContain("Facts:");
        expect(response).toContain("User's name is Alex");
        expect(response).toContain("[identity]");
        expect(response).toContain("User likes coffee");
      });

      it("shows memories when available", async () => {
        const { generateResponse } = await import("../llm.js");

        const memories = [
          { content: "User said hello yesterday" },
          { content: "User asked about the weather" },
        ];

        const response = await generateResponse("Hello", memories, []);

        expect(response).toContain("Here's what I remember about you");
        expect(response).toContain("Recent conversations:");
        expect(response).toContain("User said hello yesterday");
        expect(response).toContain("User asked about the weather");
      });

      it("truncates long memory content", async () => {
        const { generateResponse } = await import("../llm.js");

        const memories = [
          {
            content: "A".repeat(100), // 100 characters
          },
        ];

        const response = await generateResponse("Hello", memories, []);

        // Should truncate at 80 chars with "..."
        expect(response).toContain("A".repeat(80) + "...");
      });

      it("truncates long fact lists", async () => {
        const { generateResponse } = await import("../llm.js");

        const facts = Array(10)
          .fill(null)
          .map((_, i) => ({ content: `Fact ${i}` }));

        const response = await generateResponse("Hello", [], facts);

        expect(response).toContain("... and 5 more facts");
      });

      it("truncates long memory lists", async () => {
        const { generateResponse } = await import("../llm.js");

        const memories = Array(10)
          .fill(null)
          .map((_, i) => ({ content: `Memory ${i}` }));

        const response = await generateResponse("Hello", memories, []);

        expect(response).toContain("... and 7 more memories");
      });

      it("shows info about echo mode", async () => {
        const { generateResponse } = await import("../llm.js");

        const response = await generateResponse("Hello", [], []);

        expect(response).toContain("Running in echo mode");
        expect(response).toContain("OPENAI_API_KEY");
      });
    });

    describe("LLM mode", () => {
      it("calls OpenAI API when API key is set", async () => {
        process.env.OPENAI_API_KEY = "sk-test-key";

        const mockCreate = vi.fn().mockResolvedValue({
          choices: [{ message: { content: "Hello from AI!" } }],
        });

        vi.doMock("openai", () => ({
          default: vi.fn().mockImplementation(() => ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          })),
        }));

        const { generateResponse } = await import("../llm.js");

        const response = await generateResponse("Hello", [], []);

        expect(response).toBe("Hello from AI!");
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: "gpt-4o-mini",
            messages: expect.arrayContaining([
              expect.objectContaining({ role: "system" }),
              expect.objectContaining({ role: "user", content: "Hello" }),
            ]),
          }),
        );
      });

      it("includes memory context in system message", async () => {
        process.env.OPENAI_API_KEY = "sk-test-key";

        const mockCreate = vi.fn().mockResolvedValue({
          choices: [{ message: { content: "AI response" } }],
        });

        vi.doMock("openai", () => ({
          default: vi.fn().mockImplementation(() => ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          })),
        }));

        const { generateResponse } = await import("../llm.js");

        const facts = [{ content: "User's name is Alex", factType: "identity" }];
        const memories = [{ content: "User said hello" }];

        await generateResponse("Hello", memories, facts);

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: "system",
                content: expect.stringContaining("Alex"),
              }),
            ]),
          }),
        );
      });

      it("falls back to echo mode on API error", async () => {
        process.env.OPENAI_API_KEY = "sk-test-key";

        vi.doMock("openai", () => ({
          default: vi.fn().mockImplementation(() => ({
            chat: {
              completions: {
                create: vi.fn().mockRejectedValue(new Error("API Error")),
              },
            },
          })),
        }));

        const { generateResponse } = await import("../llm.js");

        const response = await generateResponse("Hello", [], []);

        // Should fall back to echo mode
        expect(response).toContain('I heard you say: "Hello"');
        expect(response).toContain("echo mode");
      });

      it("handles empty API response", async () => {
        process.env.OPENAI_API_KEY = "sk-test-key";

        vi.doMock("openai", () => ({
          default: vi.fn().mockImplementation(() => ({
            chat: {
              completions: {
                create: vi.fn().mockResolvedValue({
                  choices: [{ message: { content: null } }],
                }),
              },
            },
          })),
        }));

        const { generateResponse } = await import("../llm.js");

        const response = await generateResponse("Hello", [], []);

        expect(response).toBe("I couldn't generate a response.");
      });
    });
  });

  describe("context building", () => {
    it("builds context from facts and memories", async () => {
      delete process.env.OPENAI_API_KEY;

      const { generateResponse } = await import("../llm.js");

      const facts = [
        { content: "User's name is Alex", factType: "identity" },
      ];
      const memories = [
        { content: "User mentioned they like TypeScript" },
      ];

      const response = await generateResponse("Hello", memories, facts);

      expect(response).toContain("Alex");
      expect(response).toContain("TypeScript");
    });

    it("handles facts without factType", async () => {
      delete process.env.OPENAI_API_KEY;

      const { generateResponse } = await import("../llm.js");

      const facts = [{ content: "Some fact without type" }];

      const response = await generateResponse("Hello", [], facts);

      expect(response).toContain("Some fact without type");
      // Should not have brackets for type
      expect(response).not.toMatch(/\[\]/);
    });

    it("handles memories without content", async () => {
      delete process.env.OPENAI_API_KEY;

      const { generateResponse } = await import("../llm.js");

      const memories = [{ content: undefined } as { content?: string }];

      // Should not throw
      const response = await generateResponse("Hello", memories, []);

      expect(response).toBeDefined();
    });
  });

  describe("system prompt", () => {
    it("includes capabilities and guidelines", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";

      let capturedMessages: unknown[] = [];
      vi.doMock("openai", () => ({
        default: vi.fn().mockImplementation(() => ({
          chat: {
            completions: {
              create: vi.fn().mockImplementation((opts: { messages: unknown[] }) => {
                capturedMessages = opts.messages;
                return { choices: [{ message: { content: "response" } }] };
              }),
            },
          },
        })),
      }));

      const { generateResponse } = await import("../llm.js");

      await generateResponse("Hello", [], []);

      const systemMessage = capturedMessages.find(
        (m: unknown) => (m as { role: string }).role === "system",
      ) as { content: string } | undefined;

      expect(systemMessage?.content).toContain("Cortex");
      expect(systemMessage?.content).toContain("remember");
      expect(systemMessage?.content).toContain("recall");
    });
  });
});
