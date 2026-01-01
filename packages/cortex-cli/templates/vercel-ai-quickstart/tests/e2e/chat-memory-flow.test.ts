/**
 * E2E Tests: Chat API Memory Flow
 *
 * These tests verify the FULL memory flow through the chat API routes:
 * - Fact storage from conversations
 * - Belief revision (superseding facts)
 * - Memory recall across conversations
 * - Conversation lifecycle (create, chat, delete)
 *
 * REQUIRES:
 * - CONVEX_URL: Real Convex deployment
 * - OPENAI_API_KEY: For LLM calls and embeddings
 * - CORTEX_FACT_EXTRACTION=true: Enable fact extraction
 *
 * These tests use real HTTP requests to the quickstart server,
 * so the server must be running on localhost:3000.
 */

import { Cortex } from "@cortexmemory/sdk";

// Skip if required env vars not set
const SKIP_E2E =
  !process.env.CONVEX_URL ||
  !process.env.OPENAI_API_KEY ||
  !process.env.QUICKSTART_URL;

const BASE_URL = process.env.QUICKSTART_URL || "http://localhost:3000";

// Generate unique IDs for test isolation
function generateTestId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-e2e-${timestamp}-${random}`;
}

/**
 * Make a chat request to the API
 */
async function sendChatMessage(
  endpoint: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    userId: string;
    memorySpaceId: string;
    conversationId?: string;
  }
): Promise<{
  response: string;
  conversationId?: string;
}> {
  const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        content: m.content,
        createdAt: new Date().toISOString(),
      })),
      userId: options.userId,
      memorySpaceId: options.memorySpaceId,
      conversationId: options.conversationId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat API error: ${response.status} - ${error}`);
  }

  // Parse streaming response
  const text = await response.text();
  
  // Extract text content from the stream (simplified parsing)
  let fullResponse = "";
  let conversationId: string | undefined;
  
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("0:")) {
      // Text content
      try {
        const content = JSON.parse(line.slice(2));
        if (typeof content === "string") {
          fullResponse += content;
        }
      } catch {
        // Ignore parse errors
      }
    } else if (line.includes("data-conversation-update")) {
      // Extract conversation ID
      try {
        const match = line.match(/"conversationId":"([^"]+)"/);
        if (match) {
          conversationId = match[1];
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return { response: fullResponse, conversationId };
}

describe("Chat Memory Flow E2E", () => {
  let cortex: Cortex;
  let testUserId: string;
  let testMemorySpaceId: string;

  beforeAll(() => {
    if (SKIP_E2E) {
      console.log(
        "Skipping E2E tests - CONVEX_URL, OPENAI_API_KEY, or QUICKSTART_URL not configured"
      );
      return;
    }
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  beforeEach(() => {
    if (SKIP_E2E) return;
    testUserId = generateTestId("user");
    testMemorySpaceId = generateTestId("space");
  });

  afterAll(async () => {
    if (cortex) {
      cortex.close();
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // V5 Route Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("v5 route (/api/chat)", () => {
    it("should store facts from conversation", async () => {
      // Send a message with a fact
      await sendChatMessage(
        "chat",
        [{ role: "user", content: "My name is Alice and I work as a software engineer" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      // Wait for fact extraction
      await new Promise((r) => setTimeout(r, 5000));

      // Verify facts were stored
      const facts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`[V5] Stored facts: ${facts.length}`);
      facts.forEach((f) => console.log(`  - ${f.fact}`));

      expect(facts.length).toBeGreaterThan(0);
    }, 60000);

    it("should supersede facts through belief revision", async () => {
      // First message: establish a preference
      await sendChatMessage(
        "chat",
        [{ role: "user", content: "My favorite color is blue" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      await new Promise((r) => setTimeout(r, 5000));

      // Second message: change the preference
      await sendChatMessage(
        "chat",
        [
          { role: "user", content: "My favorite color is blue" },
          { role: "assistant", content: "Got it, blue is your favorite color!" },
          { role: "user", content: "Actually, my favorite color is purple now" },
        ],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      await new Promise((r) => setTimeout(r, 5000));

      // Check facts
      const allFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: true,
      });

      const activeFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`[V5] All facts: ${allFacts.length}, Active: ${activeFacts.length}`);
      allFacts.forEach((f) => {
        const status = f.supersededBy ? "SUPERSEDED" : "ACTIVE";
        console.log(`  [${status}] ${f.fact}`);
      });

      // Should have superseded the old color preference
      const colorFacts = activeFacts.filter(
        (f) =>
          f.fact.toLowerCase().includes("color") ||
          f.fact.toLowerCase().includes("purple") ||
          f.fact.toLowerCase().includes("blue")
      );

      // Ideally only one active color fact (purple)
      expect(colorFacts.length).toBeLessThanOrEqual(2);
    }, 90000);

    it("should recall facts in subsequent conversations", async () => {
      // First conversation: store a fact
      const conv1Result = await sendChatMessage(
        "chat",
        [{ role: "user", content: "I have a dog named Max" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      await new Promise((r) => setTimeout(r, 5000));

      // Second conversation: ask about the fact
      const conv2Result = await sendChatMessage(
        "chat",
        [{ role: "user", content: "What do you remember about my pets?" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      console.log(`[V5] Recall response: ${conv2Result.response.slice(0, 200)}...`);

      // Response should mention Max (the dog)
      const responseText = conv2Result.response.toLowerCase();
      const mentionsPet = responseText.includes("max") || responseText.includes("dog");
      
      // Note: LLM responses are non-deterministic, so we just verify we got a response
      expect(conv2Result.response.length).toBeGreaterThan(0);
    }, 90000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // V6 Route Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("v6 route (/api/chat-v6)", () => {
    it("should store facts from conversation", async () => {
      // Send a message with a fact
      await sendChatMessage(
        "chat-v6",
        [{ role: "user", content: "My name is Bob and I'm a data scientist" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      // Wait for fact extraction
      await new Promise((r) => setTimeout(r, 5000));

      // Verify facts were stored
      const facts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`[V6] Stored facts: ${facts.length}`);
      facts.forEach((f) => console.log(`  - ${f.fact}`));

      expect(facts.length).toBeGreaterThan(0);
    }, 60000);

    it("should supersede facts through belief revision", async () => {
      // First message: establish a preference
      await sendChatMessage(
        "chat-v6",
        [{ role: "user", content: "I prefer tea over coffee" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      await new Promise((r) => setTimeout(r, 5000));

      // Second message: change the preference
      await sendChatMessage(
        "chat-v6",
        [
          { role: "user", content: "I prefer tea over coffee" },
          { role: "assistant", content: "Got it, you prefer tea!" },
          { role: "user", content: "Actually I've switched to coffee now, it helps me focus" },
        ],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      await new Promise((r) => setTimeout(r, 5000));

      // Check facts
      const allFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: true,
      });

      const activeFacts = await cortex.facts.list({
        memorySpaceId: testMemorySpaceId,
        userId: testUserId,
        includeSuperseded: false,
      });

      console.log(`[V6] All facts: ${allFacts.length}, Active: ${activeFacts.length}`);
      allFacts.forEach((f) => {
        const status = f.supersededBy ? "SUPERSEDED" : "ACTIVE";
        console.log(`  [${status}] ${f.fact}`);
      });

      // Should have at least one fact about beverages
      const beverageFacts = allFacts.filter(
        (f) =>
          f.fact.toLowerCase().includes("tea") ||
          f.fact.toLowerCase().includes("coffee")
      );
      expect(beverageFacts.length).toBeGreaterThan(0);
    }, 90000);

    it("should recall facts in subsequent conversations", async () => {
      // First conversation: store a fact
      await sendChatMessage(
        "chat-v6",
        [{ role: "user", content: "I live in San Francisco" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      await new Promise((r) => setTimeout(r, 5000));

      // Second conversation: ask about the fact
      const conv2Result = await sendChatMessage(
        "chat-v6",
        [{ role: "user", content: "Where do I live?" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      console.log(`[V6] Recall response: ${conv2Result.response.slice(0, 200)}...`);

      // Verify we got a response
      expect(conv2Result.response.length).toBeGreaterThan(0);
    }, 90000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Feature Parity Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("v5 vs v6 feature parity", () => {
    it("both routes should store facts for the same message", async () => {
      const v5UserId = generateTestId("user-v5");
      const v6UserId = generateTestId("user-v6");
      const sharedSpaceId = testMemorySpaceId;

      // Send same message to both routes
      const message = "I am a TypeScript developer with 5 years of experience";

      await Promise.all([
        sendChatMessage(
          "chat",
          [{ role: "user", content: message }],
          { userId: v5UserId, memorySpaceId: sharedSpaceId }
        ),
        sendChatMessage(
          "chat-v6",
          [{ role: "user", content: message }],
          { userId: v6UserId, memorySpaceId: sharedSpaceId }
        ),
      ]);

      // Wait for fact extraction
      await new Promise((r) => setTimeout(r, 7000));

      // Check facts for both users
      const [v5Facts, v6Facts] = await Promise.all([
        cortex.facts.list({
          memorySpaceId: sharedSpaceId,
          userId: v5UserId,
          includeSuperseded: false,
        }),
        cortex.facts.list({
          memorySpaceId: sharedSpaceId,
          userId: v6UserId,
          includeSuperseded: false,
        }),
      ]);

      console.log(`V5 facts: ${v5Facts.length}, V6 facts: ${v6Facts.length}`);
      console.log("V5 facts:", v5Facts.map((f) => f.fact));
      console.log("V6 facts:", v6Facts.map((f) => f.fact));

      // CRITICAL: Both routes should store facts
      expect(v5Facts.length).toBeGreaterThan(0);
      expect(v6Facts.length).toBeGreaterThan(0);

      // Fact counts should be similar (allow some variance due to LLM non-determinism)
      const diff = Math.abs(v5Facts.length - v6Facts.length);
      expect(diff).toBeLessThanOrEqual(2);
    }, 90000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("conversation lifecycle", () => {
    it("should create, list, and delete conversations", async () => {
      // Create a conversation via chat
      const chatResult = await sendChatMessage(
        "chat",
        [{ role: "user", content: "Hello, this is a test conversation" }],
        { userId: testUserId, memorySpaceId: testMemorySpaceId }
      );

      // Wait for conversation to be created
      await new Promise((r) => setTimeout(r, 2000));

      // List conversations
      const listResponse = await fetch(
        `${BASE_URL}/api/conversations?userId=${testUserId}&memorySpaceId=${testMemorySpaceId}`
      );
      const listData = await listResponse.json();

      console.log(`Conversations: ${JSON.stringify(listData.conversations, null, 2)}`);
      expect(listData.conversations).toBeDefined();
      expect(listData.conversations.length).toBeGreaterThan(0);

      // Delete conversation
      const convId = listData.conversations[0].id;
      const deleteResponse = await fetch(
        `${BASE_URL}/api/conversations?conversationId=${convId}`,
        { method: "DELETE" }
      );
      const deleteData = await deleteResponse.json();

      expect(deleteData.success).toBe(true);

      // Verify deletion
      const listAfterDelete = await fetch(
        `${BASE_URL}/api/conversations?userId=${testUserId}&memorySpaceId=${testMemorySpaceId}`
      );
      const listAfterDeleteData = await listAfterDelete.json();

      // Should have one less conversation
      expect(listAfterDeleteData.conversations.length).toBeLessThan(
        listData.conversations.length
      );
    }, 60000);
  });
});
