import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { getResponseChunksByPrompt } from "@/tests/prompts/utils";

const mockUsage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
  outputTokens: { reasoning: 0, text: 20, total: 20 },
};

export const chatModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    content: [{ text: "Hello, world!", type: "text" }],
    finishReason: { raw: "stop", unified: "stop" },
    usage: mockUsage,
    warnings: [],
  }),
  doStream: async ({ prompt }): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      chunks: getResponseChunksByPrompt(prompt),
      initialDelayInMs: 1000,
    }),
  }),
});

export const reasoningModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    content: [{ text: "Hello, world!", type: "text" }],
    finishReason: { raw: "stop", unified: "stop" },
    usage: mockUsage,
    warnings: [],
  }),
  doStream: async ({ prompt }): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      chunks: getResponseChunksByPrompt(prompt, true),
      initialDelayInMs: 1000,
    }),
  }),
});

export const titleModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    content: [{ text: "This is a test title", type: "text" }],
    finishReason: { raw: "stop", unified: "stop" },
    usage: mockUsage,
    warnings: [],
  }),
  doStream: async (): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      chunks: [
        { id: "1", type: "text-start" },
        { delta: "This is a test title", id: "1", type: "text-delta" },
        { id: "1", type: "text-end" },
        {
          finishReason: { raw: "stop", unified: "stop" },
          type: "finish",
          usage: mockUsage,
        },
      ],
      initialDelayInMs: 1000,
    }),
  }),
});

export const artifactModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    content: [{ text: "Hello, world!", type: "text" }],
    finishReason: { raw: "stop", unified: "stop" },
    usage: mockUsage,
    warnings: [],
  }),
  doStream: async ({ prompt }): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      chunks: getResponseChunksByPrompt(prompt),
      initialDelayInMs: 100,
    }),
  }),
});
