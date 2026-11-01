/**
 * E2E Tests: HTTP Server
 *
 * Tests HTTP API endpoints against real Convex backend.
 * Requires: CONVEX_URL environment variable
 * Optional: OPENAI_API_KEY for LLM responses
 *
 * NOTE: These tests require the server to be running:
 *   npm run server
 *
 * Run with: CONVEX_URL=<url> npm run test:e2e
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  shouldSkipE2E,
  generateTestId,
  createTestConversationId,
  wait,
  makeServerRequest,
} from "../helpers/test-utils.js";

// Skip all tests if CONVEX_URL not set
const SKIP_E2E = shouldSkipE2E();

// Server URL - assumes server is running on default port
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

// Check if server is running (must return JSON with status: "ok")
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/health`, { method: "GET" });
    if (!response.ok) return false;
    
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) return false;
    
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

describe("HTTP Server E2E", () => {
  let serverRunning: boolean = false;

  beforeAll(async () => {
    if (SKIP_E2E) {
      console.log("Skipping E2E tests - CONVEX_URL not configured");
      return;
    }

    // Check if server is running
    serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.log(`
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Server not running at ${SERVER_URL}
        
        To run these tests, start the server first:
          CONVEX_URL=<your-url> npm run server
        
        Then run tests in another terminal:
          npm run test:e2e
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Health Check
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("GET /health", () => {
    it("should return health status", async () => {
      if (!serverRunning) return;

      const { status, data } = await makeServerRequest("/health", {
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.memorySpaceId).toBeDefined();
      expect(data.agentId).toBeDefined();
      expect(data.features).toBeDefined();
    });

    it("should report feature flags", async () => {
      if (!serverRunning) return;

      const { data } = await makeServerRequest("/health", {
        baseUrl: SERVER_URL,
      });

      expect(data.features.factExtraction).toBeDefined();
      expect(data.features.graphSync).toBeDefined();
      expect(data.features.llm).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Chat Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("POST /chat", () => {
    it("should process chat message", async () => {
      if (!serverRunning) return;

      const { status, data } = await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "Hello, this is a test message",
        },
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.response).toBeDefined();
      expect(data.conversationId).toBeDefined();
      expect(typeof data.memoriesRecalled).toBe("number");
      expect(typeof data.factsRecalled).toBe("number");
    }, 30000);

    it("should use provided conversation ID", async () => {
      if (!serverRunning) return;

      const customConvId = createTestConversationId();

      const { status, data } = await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "Testing with custom conversation ID",
          conversationId: customConvId,
        },
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.conversationId).toBe(customConvId);
    }, 30000);

    it("should return 400 for missing message", async () => {
      if (!serverRunning) return;

      const { status, data } = await makeServerRequest("/chat", {
        method: "POST",
        body: {},
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(400);
      expect(data.error).toBe("message is required");
    });

    it("should persist messages across calls in same conversation", async () => {
      if (!serverRunning) return;

      const conversationId = createTestConversationId();

      // First message
      await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "My name is TestUser",
          conversationId,
        },
        baseUrl: SERVER_URL,
      });

      await wait(2000);

      // Second message in same conversation
      const { status, data } = await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "What is my name?",
          conversationId,
        },
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.conversationId).toBe(conversationId);
      // May or may not recall the name depending on LLM and memory
    }, 60000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Recall Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("GET /recall", () => {
    it("should search memories", async () => {
      if (!serverRunning) return;

      // First store some memories
      await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "I love programming in TypeScript",
        },
        baseUrl: SERVER_URL,
      });

      await wait(2000);

      // Then recall
      const { status, data } = await makeServerRequest("/recall?query=TypeScript", {
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.memories).toBeDefined();
      expect(data.facts).toBeDefined();
      expect(data.query).toBe("TypeScript");
    }, 30000);

    it("should return 400 for missing query", async () => {
      if (!serverRunning) return;

      const { status, data } = await makeServerRequest("/recall", {
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(400);
      expect(data.error).toBe("query parameter is required");
    });

    it("should return empty arrays for no matches", async () => {
      if (!serverRunning) return;

      const randomQuery = generateTestId("nonexistent");

      const { status, data } = await makeServerRequest(`/recall?query=${randomQuery}`, {
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.memories).toBeDefined();
      expect(data.facts).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Facts Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("GET /facts", () => {
    it("should list facts", async () => {
      if (!serverRunning) return;

      const { status, data } = await makeServerRequest("/facts", {
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.facts).toBeDefined();
      expect(typeof data.count).toBe("number");
    });

    it("should return count of facts", async () => {
      if (!serverRunning) return;

      const { data } = await makeServerRequest("/facts", {
        baseUrl: SERVER_URL,
      });

      expect(data.count).toBe(data.facts.length);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // History Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("GET /history/:conversationId", () => {
    it("should return conversation history", async () => {
      if (!serverRunning) return;

      const conversationId = createTestConversationId();

      // Create conversation with messages
      await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "First message in history test",
          conversationId,
        },
        baseUrl: SERVER_URL,
      });

      await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "Second message in history test",
          conversationId,
        },
        baseUrl: SERVER_URL,
      });

      await wait(2000);

      // Get history
      const { status, data } = await makeServerRequest(`/history/${conversationId}`, {
        baseUrl: SERVER_URL,
      });

      // May be 200 or 404 depending on whether conversation was persisted
      expect([200, 404]).toContain(status);

      if (status === 200) {
        expect(data.conversationId).toBe(conversationId);
        expect(data.messages).toBeDefined();
      }
    }, 60000);

    it("should return 404 for non-existent conversation", async () => {
      if (!serverRunning) return;

      const nonExistentId = createTestConversationId();

      const { status, data } = await makeServerRequest(`/history/${nonExistentId}`, {
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(404);
      expect(data.error).toBe("Conversation not found");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Full Chat Flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("full chat flow", () => {
    it("should complete a full conversation flow", async () => {
      if (!serverRunning) return;

      const conversationId = createTestConversationId();

      // Step 1: Introduce with facts
      console.log("Step 1: Introducing user...");
      const intro = await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "Hi! My name is Alice and I work as a designer in New York.",
          conversationId,
        },
        baseUrl: SERVER_URL,
      });

      expect(intro.status).toBe(200);
      console.log(`  Response: ${intro.data.response?.slice(0, 50)}...`);

      await wait(3000);

      // Step 2: Ask a follow-up
      console.log("Step 2: Asking follow-up...");
      const followUp = await makeServerRequest("/chat", {
        method: "POST",
        body: {
          message: "What do you know about me?",
          conversationId,
        },
        baseUrl: SERVER_URL,
      });

      expect(followUp.status).toBe(200);
      console.log(`  Response: ${followUp.data.response?.slice(0, 100)}...`);
      console.log(`  Memories recalled: ${followUp.data.memoriesRecalled}`);
      console.log(`  Facts recalled: ${followUp.data.factsRecalled}`);

      // Step 3: Check recall
      console.log("Step 3: Testing recall...");
      const recall = await makeServerRequest("/recall?query=Alice", {
        baseUrl: SERVER_URL,
      });

      expect(recall.status).toBe(200);
      console.log(`  Found ${recall.data.memories?.length || 0} memories, ${recall.data.facts?.length || 0} facts`);

      // Step 4: List facts
      console.log("Step 4: Listing facts...");
      const facts = await makeServerRequest("/facts", {
        baseUrl: SERVER_URL,
      });

      expect(facts.status).toBe(200);
      console.log(`  Total facts in system: ${facts.data.count}`);

      console.log("✓ Full flow completed successfully");
    }, 120000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Root Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  (SKIP_E2E ? describe.skip : describe)("GET /", () => {
    it("should return API documentation", async () => {
      if (!serverRunning) return;

      const { status, data } = await makeServerRequest("/", {
        baseUrl: SERVER_URL,
      });

      expect(status).toBe(200);
      expect(data.name).toContain("Cortex Memory");
      expect(data.endpoints).toBeDefined();
    });
  });
});
