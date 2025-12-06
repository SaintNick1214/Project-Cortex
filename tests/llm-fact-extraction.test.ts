/**
 * LLM Fact Extraction Tests
 *
 * Unit tests for the LLM-based fact extraction module.
 * Tests the extraction logic, response parsing, and error handling
 * with mocked LLM responses.
 */

import { jest } from "@jest/globals";

// Store mock functions for each provider - using explicit any for Jest mock compatibility
const mockOpenAICreate = jest.fn<(...args: any[]) => any>();
const mockAnthropicCreate = jest.fn<(...args: any[]) => any>();

// Mock OpenAI before imports
jest.unstable_mockModule("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockOpenAICreate,
      },
    };
  },
}));

// Mock Anthropic before imports
jest.unstable_mockModule("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mockAnthropicCreate,
    };
  },
}));

// Import after mocking
const { createLLMClient, isLLMAvailable } = await import("../src/llm/index.js");

describe("LLM Fact Extraction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLLMClient", () => {
    it("creates OpenAI client for openai provider", () => {
      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      expect(client).not.toBeNull();
    });

    it("creates Anthropic client for anthropic provider", () => {
      const client = createLLMClient({
        provider: "anthropic",
        apiKey: "test-key",
      });

      expect(client).not.toBeNull();
    });

    it("returns null for custom provider without extractFacts", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const client = createLLMClient({
        provider: "custom",
        apiKey: "test-key",
      });

      expect(client).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Custom provider requires extractFacts"),
      );

      warnSpy.mockRestore();
    });

    it("creates custom client with extractFacts function", () => {
      const customExtractor = async (
        _userMsg: string,
        _agentMsg: string,
      ): Promise<Array<{
        fact: string;
        factType: "preference";
        confidence: number;
      }> | null> => {
        return [
          {
            fact: "Custom fact",
            factType: "preference",
            confidence: 0.9,
          },
        ];
      };

      const client = createLLMClient({
        provider: "custom",
        apiKey: "test-key",
        extractFacts: customExtractor,
      });

      expect(client).not.toBeNull();
    });
  });

  describe("OpenAI Client", () => {
    it("extracts facts from valid response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                facts: [
                  {
                    fact: "User prefers TypeScript",
                    factType: "preference",
                    confidence: 0.95,
                    subject: "User",
                    predicate: "prefers",
                    object: "TypeScript",
                    tags: ["programming"],
                  },
                ],
              }),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts(
        "I love TypeScript",
        "Great choice!",
      );

      expect(facts).toHaveLength(1);
      expect(facts![0].fact).toBe("User prefers TypeScript");
      expect(facts![0].factType).toBe("preference");
      expect(facts![0].confidence).toBe(0.95);
    });

    it("handles empty facts array", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ facts: [] }),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Hello", "Hi there!");

      expect(facts).toHaveLength(0);
    });

    it("handles markdown-wrapped JSON response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                "```json\n" +
                JSON.stringify({
                  facts: [
                    {
                      fact: "User lives in London",
                      factType: "identity",
                      confidence: 0.9,
                    },
                  ],
                }) +
                "\n```",
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts(
        "I moved to London",
        "Nice city!",
      );

      expect(facts).toHaveLength(1);
      expect(facts![0].fact).toBe("User lives in London");
    });

    it("normalizes invalid fact types to custom", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                facts: [
                  {
                    fact: "Some fact",
                    factType: "invalid_type",
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toHaveLength(1);
      expect(facts![0].factType).toBe("custom");
    });

    it("clamps confidence to 0-1 range", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                facts: [
                  {
                    fact: "Fact with high confidence",
                    factType: "preference",
                    confidence: 1.5, // Over 1
                  },
                  {
                    fact: "Fact with low confidence",
                    factType: "preference",
                    confidence: -0.5, // Under 0
                  },
                ],
              }),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toHaveLength(2);
      expect(facts![0].confidence).toBe(1);
      expect(facts![1].confidence).toBe(0);
    });

    it("handles API errors gracefully", async () => {
      mockOpenAICreate.mockRejectedValueOnce(new Error("API Error"));

      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("OpenAI extraction failed"),
        expect.any(Error),
      );

      errorSpy.mockRestore();
    });

    it("handles empty response", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toBeNull();

      warnSpy.mockRestore();
    });

    it("uses custom model from config", async () => {
      const mockResponse = {
        choices: [{ message: { content: JSON.stringify({ facts: [] }) } }],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-4o",
      });

      await client!.extractFacts("Test", "Response");

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
        }),
      );
    });

    it("uses custom temperature and maxTokens", async () => {
      const mockResponse = {
        choices: [{ message: { content: JSON.stringify({ facts: [] }) } }],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
        temperature: 0.5,
        maxTokens: 500,
      });

      await client!.extractFacts("Test", "Response");

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          max_tokens: 500,
        }),
      );
    });
  });

  describe("Anthropic Client", () => {
    it("extracts facts from valid response", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              facts: [
                {
                  fact: "User works at Acme Corp",
                  factType: "identity",
                  confidence: 0.9,
                },
              ],
            }),
          },
        ],
      };

      mockAnthropicCreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "anthropic",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts(
        "I work at Acme Corp",
        "Interesting!",
      );

      expect(facts).toHaveLength(1);
      expect(facts![0].fact).toBe("User works at Acme Corp");
      expect(facts![0].factType).toBe("identity");
    });

    it("handles API errors gracefully", async () => {
      mockAnthropicCreate.mockRejectedValueOnce(new Error("API Error"));

      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const client = createLLMClient({
        provider: "anthropic",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toBeNull();

      errorSpy.mockRestore();
    });
  });

  describe("Custom Client", () => {
    it("uses custom extractFacts function", async () => {
      const customFacts = [
        {
          fact: "Custom extracted fact",
          factType: "knowledge" as const,
          confidence: 0.85,
        },
      ];

      const customExtractor = jest
        .fn<(...args: any[]) => any>()
        .mockResolvedValue(customFacts);

      const client = createLLMClient({
        provider: "custom",
        apiKey: "test-key",
        extractFacts: customExtractor as Parameters<
          typeof createLLMClient
        >[0]["extractFacts"],
      });

      const facts = await client!.extractFacts("Input", "Output");

      expect(customExtractor).toHaveBeenCalledWith("Input", "Output");
      expect(facts).toHaveLength(1);
    });
  });

  describe("isLLMAvailable", () => {
    it("returns true for available providers", async () => {
      // Since we mocked the modules, they should be "available"
      const openaiAvailable = await isLLMAvailable("openai");
      const anthropicAvailable = await isLLMAvailable("anthropic");

      expect(openaiAvailable).toBe(true);
      expect(anthropicAvailable).toBe(true);
    });
  });

  describe("Response Parsing Edge Cases", () => {
    it("filters out invalid fact objects", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                facts: [
                  {
                    fact: "Valid fact",
                    factType: "preference",
                    confidence: 0.9,
                  },
                  { invalid: "object" }, // Missing required fields
                  null, // Null entry
                  "string", // Wrong type
                  { fact: "Another valid", factType: "event", confidence: 0.8 },
                ],
              }),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toHaveLength(2);
      expect(facts![0].fact).toBe("Valid fact");
      expect(facts![1].fact).toBe("Another valid");
    });

    it("handles response that is just an array", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  fact: "Direct array fact",
                  factType: "preference",
                  confidence: 0.9,
                },
              ]),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toHaveLength(1);
      expect(facts![0].fact).toBe("Direct array fact");
    });

    it("handles malformed JSON gracefully", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "This is not JSON {{{",
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toBeNull();

      warnSpy.mockRestore();
    });

    it("filters non-string tags", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                facts: [
                  {
                    fact: "Fact with mixed tags",
                    factType: "preference",
                    confidence: 0.9,
                    tags: ["valid", 123, null, "another-valid", { obj: true }],
                  },
                ],
              }),
            },
          },
        ],
      };

      mockOpenAICreate.mockResolvedValueOnce(mockResponse);

      const client = createLLMClient({
        provider: "openai",
        apiKey: "test-key",
      });

      const facts = await client!.extractFacts("Test", "Response");

      expect(facts).toHaveLength(1);
      expect(facts![0].tags).toEqual(["valid", "another-valid"]);
    });
  });
});
