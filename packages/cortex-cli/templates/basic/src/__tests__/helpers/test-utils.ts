/**
 * Test Utilities for Basic Template Tests
 *
 * Shared helpers for both integration and e2e tests.
 */

import crypto from "crypto";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Environment Checks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if e2e tests should be skipped (no CONVEX_URL)
 */
export function shouldSkipE2E(): boolean {
  return !process.env.CONVEX_URL;
}

/**
 * Check if fact extraction tests should be skipped (no OPENAI_API_KEY)
 */
export function shouldSkipFactTests(): boolean {
  return !process.env.CONVEX_URL || !process.env.OPENAI_API_KEY;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ID Generation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a cryptographically secure random string
 */
function generateSecureRandomString(length: number): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  const charsLength = chars.length;
  const maxUnbiased = Math.floor(256 / charsLength) * charsLength;

  let result = "";
  while (result.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte >= maxUnbiased) continue;
    result += chars[byte % charsLength];
  }
  return result;
}

/**
 * Generate unique ID for test isolation
 */
export function generateTestId(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = generateSecureRandomString(6);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate unique memory space ID
 */
export function createTestMemorySpaceId(prefix: string = "test"): string {
  return generateTestId(`${prefix}-space`);
}

/**
 * Generate unique conversation ID
 */
export function createTestConversationId(): string {
  return generateTestId("conv-test");
}

/**
 * Generate unique user ID
 */
export function createTestUserId(): string {
  return generateTestId("user-test");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock Cortex SDK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MockMemory {
  memoryId: string;
  content: string;
  importance: number;
  conversationId?: string;
}

export interface MockFact {
  factId: string;
  fact: string;
  factType: string;
  confidence: number;
}

export interface MockConversation {
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
  messageCount: number;
}

/**
 * Create a mock Cortex SDK instance for integration tests
 */
export function createMockCortex() {
  // Internal state for stateful mocks
  const storedMemories: MockMemory[] = [];
  const storedFacts: MockFact[] = [];
  const storedConversations: Map<string, MockConversation> = new Map();

  return {
    memory: {
      recall: vi.fn().mockImplementation(async (params: { query?: string }) => {
        return {
          memories: storedMemories,
          facts: storedFacts,
          context: storedMemories.map((m) => m.content).join("\n"),
          totalResults: storedMemories.length + storedFacts.length,
          queryTimeMs: 50,
        };
      }),
      remember: vi.fn().mockImplementation(async (params: {
        conversationId?: string;
        userMessage?: string;
        agentResponse?: string;
      }) => {
        const convId = params.conversationId || generateTestId("conv");

        // Store memory
        const memory: MockMemory = {
          memoryId: generateTestId("mem"),
          content: params.userMessage || "",
          importance: 50,
          conversationId: convId,
        };
        storedMemories.push(memory);

        // Update conversation
        let conv = storedConversations.get(convId);
        if (!conv) {
          conv = {
            conversationId: convId,
            messages: [],
            messageCount: 0,
          };
          storedConversations.set(convId, conv);
        }
        conv.messages.push({ role: "user", content: params.userMessage || "" });
        conv.messages.push({ role: "assistant", content: params.agentResponse || "" });
        conv.messageCount = conv.messages.length;

        return {
          conversation: {
            conversationId: convId,
            messageIds: [`msg-${Date.now()}-1`, `msg-${Date.now()}-2`],
          },
          memories: [memory],
          facts: [],
        };
      }),
      list: vi.fn().mockImplementation(async () => storedMemories),
    },
    facts: {
      list: vi.fn().mockImplementation(async () => ({
        facts: storedFacts,
      })),
    },
    conversations: {
      get: vi.fn().mockImplementation(async (conversationId: string) => {
        return storedConversations.get(conversationId) || null;
      }),
      list: vi.fn().mockImplementation(async () => {
        return Array.from(storedConversations.values());
      }),
    },
    close: vi.fn(),

    // Test helpers to manipulate state
    __test: {
      addMemory: (memory: MockMemory) => storedMemories.push(memory),
      addFact: (fact: MockFact) => storedFacts.push(fact),
      clearAll: () => {
        storedMemories.length = 0;
        storedFacts.length = 0;
        storedConversations.clear();
      },
      getMemories: () => storedMemories,
      getFacts: () => storedFacts,
      getConversations: () => storedConversations,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock Data Factories
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create mock memories for testing
 */
export function createMockMemories(count: number = 2): MockMemory[] {
  return Array.from({ length: count }, (_, i) => ({
    memoryId: `mem-${i + 1}`,
    content: `Test memory ${i + 1}`,
    importance: 80 - i * 10,
    conversationId: `conv-${i + 1}`,
  }));
}

/**
 * Create mock facts for testing
 */
export function createMockFacts(count: number = 2): MockFact[] {
  return Array.from({ length: count }, (_, i) => ({
    factId: `fact-${i + 1}`,
    fact: `Test fact ${i + 1}`,
    factType: "knowledge",
    confidence: 90 - i * 5,
  }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Async Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await wait(interval);
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTTP Test Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a mock Request object for testing HTTP endpoints
 */
export function createTestRequest(
  method: string,
  url: string,
  options: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Request {
  const init: RequestInit = { method };

  if (options.body) {
    init.body = JSON.stringify(options.body);
    init.headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
  } else if (options.headers) {
    init.headers = options.headers;
  }

  return new Request(url, init);
}

/**
 * Parse JSON response from HTTP endpoint
 */
export async function parseTestResponse(response: Response): Promise<{
  status: number;
  data: Record<string, unknown>;
}> {
  const data = await response.json();
  return { status: response.status, data };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// E2E Test Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate OpenAI embedding for e2e tests
 */
export async function generateTestEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY required for embedding generation");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Make HTTP request to local server for e2e tests
 */
export async function makeServerRequest(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    baseUrl?: string;
  } = {},
): Promise<{ status: number; data: Record<string, unknown> }> {
  const baseUrl = options.baseUrl || "http://localhost:3001";
  const url = `${baseUrl}${path}`;

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
    fetchOptions.headers = { "Content-Type": "application/json" };
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  return { status: response.status, data };
}
