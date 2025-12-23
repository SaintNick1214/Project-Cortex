/**
 * Test utilities for Vercel AI Provider tests
 */

import type { CortexMemoryConfig } from "../../src/types";

/**
 * Generate unique memory space ID for test isolation
 */
export function createTestMemorySpaceId(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate unique conversation ID for test isolation
 */
export function createTestConversationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `conv-test-${timestamp}-${random}`;
}

/**
 * Generate unique user ID for test isolation
 */
export function createTestUserId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `user-test-${timestamp}-${random}`;
}

/**
 * Create base test configuration
 */
export function createTestConfig(
  overrides: Partial<CortexMemoryConfig> = {},
): CortexMemoryConfig {
  return {
    convexUrl: process.env.CONVEX_URL || "https://test.convex.cloud",
    memorySpaceId: createTestMemorySpaceId(),
    userId: createTestUserId(),
    userName: "Test User",
    agentId: "test-agent",
    agentName: "Test Agent",
    ...overrides,
  };
}

/**
 * Mock language model compatible with AI SDK
 */
export interface MockLanguageModel {
  specificationVersion: string;
  provider: string;
  modelId: string;
  defaultObjectGenerationMode?: string;
  doGenerate: jest.Mock;
  doStream: jest.Mock;
  supportsStructuredOutputs?: boolean;
  supportsImageUrls?: boolean;
}

/**
 * Create a mock language model for unit tests
 */
export function createMockLLM(
  overrides: Partial<MockLanguageModel> = {},
): MockLanguageModel {
  return {
    specificationVersion: "v1",
    provider: "openai",
    modelId: "gpt-4o-mini",
    defaultObjectGenerationMode: "json",
    doGenerate: jest.fn().mockResolvedValue({
      text: "Test response",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 20 },
    }),
    doStream: jest.fn().mockResolvedValue({
      stream: createMockStream(["Test ", "response"]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
    supportsStructuredOutputs: false,
    supportsImageUrls: false,
    ...overrides,
  };
}

/**
 * Create a mock ReadableStream from text chunks
 */
export function createMockStream(chunks: string[]): ReadableStream<any> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue({ type: "text-delta", textDelta: chunk });
      }
      controller.close();
    },
  });
}

/**
 * Create mock stream with AI SDK v5 format
 */
export function createMockStreamV5(chunks: string[]): ReadableStream<any> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue({ type: "text-delta", delta: chunk });
      }
      controller.close();
    },
  });
}

/**
 * Create mock stream with text type (alternative format)
 */
export function createMockStreamText(chunks: string[]): ReadableStream<any> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue({ type: "text", text: chunk });
      }
      controller.close();
    },
  });
}

/**
 * Consume a stream and return all chunks
 */
export async function consumeStream<T>(
  stream: ReadableStream<T>,
): Promise<T[]> {
  const chunks: T[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return chunks;
}

/**
 * Wait for a specified time (for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock Cortex SDK instance
 */
export function createMockCortex() {
  return {
    memory: {
      search: jest.fn().mockResolvedValue([]),
      remember: jest.fn().mockResolvedValue({
        conversation: {
          messageIds: ["msg-1", "msg-2"],
          conversationId: "conv-1",
        },
        memories: [],
        facts: [],
      }),
      rememberStream: jest.fn().mockResolvedValue({
        fullResponse: "Test response",
        conversation: {
          messageIds: ["msg-1", "msg-2"],
          conversationId: "conv-1",
        },
        memories: [],
        facts: [],
        streamMetrics: {
          totalChunks: 1,
          streamDurationMs: 100,
        },
      }),
      recall: jest.fn().mockResolvedValue({
        context: "Relevant context from memory",
        totalResults: 1,
        queryTimeMs: 50,
        sources: {
          vector: { count: 1, items: [] },
          facts: { count: 0, items: [] },
          graph: { count: 0, items: [] },
        },
      }),
      list: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ deleted: 0 }),
    },
    facts: {
      list: jest.fn().mockResolvedValue([]),
    },
    close: jest.fn(),
  };
}

/**
 * Create mock memories for testing
 */
export function createMockMemories(count: number = 2) {
  return Array.from({ length: count }, (_, i) => ({
    memoryId: `mem-${i + 1}`,
    memorySpaceId: "test-space",
    userId: "test-user",
    content: `Test memory ${i + 1}`,
    importance: 80 - i * 10,
    contentType: "text" as const,
    sourceType: "conversation" as const,
    sourceTimestamp: Date.now() - i * 1000,
    tags: [],
    version: 1,
    previousVersions: [],
    createdAt: Date.now() - i * 1000,
    updatedAt: Date.now() - i * 1000,
    accessCount: 0,
  }));
}

/**
 * Create mock facts for testing
 */
export function createMockFacts(count: number = 2) {
  return Array.from({ length: count }, (_, i) => ({
    factId: `fact-${i + 1}`,
    memorySpaceId: "test-space",
    fact: `Test fact ${i + 1}`,
    factType: "knowledge" as const,
    confidence: 90 - i * 5,
    source: "conversation",
    createdAt: Date.now() - i * 1000,
    updatedAt: Date.now() - i * 1000,
  }));
}

/**
 * Create test messages array
 */
export function createTestMessages(content: string = "Hello") {
  return [
    { role: "system" as const, content: "You are a helpful assistant." },
    { role: "user" as const, content },
  ];
}

/**
 * Create test messages without system message
 */
export function createTestMessagesNoSystem(content: string = "Hello") {
  return [{ role: "user" as const, content }];
}

/**
 * Create test messages with content parts
 */
export function createTestMessagesWithParts(textContent: string = "Hello") {
  return [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: textContent }],
    },
  ];
}
