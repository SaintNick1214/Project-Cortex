import type { LanguageModelV4 } from "@ai-sdk/provider";

const mockResponses: Record<string, string> = {
  default: "This is a mock response for testing.",
  greeting: "Hello! How can I help you today?",
  weather: "The weather in San Francisco is sunny and 72°F.",
};

const finishReason = { raw: "stop", unified: "stop" as const };

const mockUsage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
  outputTokens: { reasoning: 0, text: 20, total: 20 },
};

function getResponseForPrompt(prompt: unknown): string {
  const promptStr = JSON.stringify(prompt).toLowerCase();

  if (promptStr.includes("weather") || promptStr.includes("temperature")) {
    return mockResponses.weather;
  }
  if (
    promptStr.includes("hello") ||
    promptStr.includes("hi") ||
    promptStr.includes("hey")
  ) {
    return mockResponses.greeting;
  }

  return mockResponses.default;
}

const createMockModel = (): LanguageModelV4 => ({
  doGenerate: async ({ prompt }: { prompt: unknown }) => ({
    content: [{ text: getResponseForPrompt(prompt), type: "text" }],
    finishReason,
    usage: mockUsage,
    warnings: [],
  }),
  doStream: async ({ prompt }: { prompt: unknown }) => {
    const response = getResponseForPrompt(prompt);
    const words = response.split(" ");

    return {
      stream: new ReadableStream({
        async start(controller) {
          controller.enqueue({ id: "t1", type: "text-start" });
          for (const word of words) {
            controller.enqueue({
              delta: `${word} `,
              id: "t1",
              type: "text-delta",
            });
            await new Promise((resolve) => {
              setTimeout(resolve, 10);
            });
          }
          controller.enqueue({ id: "t1", type: "text-end" });
          controller.enqueue({
            finishReason,
            type: "finish",
            usage: mockUsage,
          });
          controller.close();
        },
      }),
    };
  },
  modelId: "mock-model",
  provider: "mock",
  specificationVersion: "v4",
  supportedUrls: {},
});

const createMockReasoningModel = (): LanguageModelV4 => ({
  doGenerate: async () => ({
    content: [
      { text: "Let me think through this step by step...", type: "reasoning" },
      { text: "This is a reasoned response.", type: "text" },
    ],
    finishReason,
    usage: mockUsage,
    warnings: [],
  }),
  doStream: async () => ({
    stream: new ReadableStream({
      async start(controller) {
        controller.enqueue({ id: "r1", type: "reasoning-start" });
        controller.enqueue({
          delta: "Let me think through this step by step... ",
          id: "r1",
          type: "reasoning-delta",
        });
        controller.enqueue({ id: "r1", type: "reasoning-end" });
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
        controller.enqueue({ id: "t1", type: "text-start" });
        controller.enqueue({
          delta: "This is a reasoned response.",
          id: "t1",
          type: "text-delta",
        });
        controller.enqueue({ id: "t1", type: "text-end" });
        controller.enqueue({
          finishReason,
          type: "finish",
          usage: mockUsage,
        });
        controller.close();
      },
    }),
  }),
  modelId: "mock-reasoning-model",
  provider: "mock",
  specificationVersion: "v4",
  supportedUrls: {},
});

const createMockTitleModel = (): LanguageModelV4 => ({
  doGenerate: async () => ({
    content: [{ text: "Test Conversation", type: "text" }],
    finishReason,
    usage: {
      inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 5, total: 5 },
      outputTokens: { reasoning: 0, text: 5, total: 5 },
    },
    warnings: [],
  }),
  doStream: async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ id: "t1", type: "text-start" });
        controller.enqueue({
          delta: "Test Conversation",
          id: "t1",
          type: "text-delta",
        });
        controller.enqueue({ id: "t1", type: "text-end" });
        controller.enqueue({
          finishReason,
          type: "finish",
          usage: {
            inputTokens: {
              cacheRead: 0,
              cacheWrite: 0,
              noCache: 5,
              total: 5,
            },
            outputTokens: { reasoning: 0, text: 5, total: 5 },
          },
        });
        controller.close();
      },
    }),
  }),
  modelId: "mock-title-model",
  provider: "mock",
  specificationVersion: "v4",
  supportedUrls: {},
});

export const chatModel = createMockModel();
export const reasoningModel = createMockReasoningModel();
export const titleModel = createMockTitleModel();
export const artifactModel = createMockModel();
