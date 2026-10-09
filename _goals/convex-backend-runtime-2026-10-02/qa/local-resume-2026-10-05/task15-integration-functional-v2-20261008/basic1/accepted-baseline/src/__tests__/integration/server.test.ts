/**
 * Integration Tests: HTTP Server
 *
 * Tests HTTP endpoints with mocked internals.
 * Uses Hono's test client for request simulation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { generateTestId } from "../helpers/test-utils.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MockMemory {
  memoryId: string;
  content: string;
  importance: number;
}

interface MockFact {
  factId: string;
  fact: string;
  factType: string;
  confidence: number;
}

interface MockConversation {
  conversationId: string;
  messages: Array<{ role: string; content: string }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Mutable state for each test
let memories: MockMemory[] = [];
let facts: MockFact[] = [];
let conversations: Map<string, MockConversation> = new Map();
let chatResult = {
  response: "Test response",
  conversationId: "conv-test-123",
  memoriesRecalled: 0,
  factsRecalled: 0,
};

// Reset state before each test
function resetState() {
  memories = [];
  facts = [];
  conversations = new Map();
  chatResult = {
    response: "Test response",
    conversationId: "conv-test-123",
    memoriesRecalled: 0,
    factsRecalled: 0,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Create Test App (mirrors server.ts routes)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function createTestApp() {
  const app = new Hono();

  const CONFIG = {
    memorySpaceId: "test-space",
    agentId: "test-agent",
    enableFactExtraction: true,
    enableGraphMemory: false,
  };

  // Health check
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      memorySpaceId: CONFIG.memorySpaceId,
      agentId: CONFIG.agentId,
      features: {
        factExtraction: CONFIG.enableFactExtraction,
        graphSync: CONFIG.enableGraphMemory,
        llm: false,
      },
    });
  });

  // Chat endpoint
  app.post("/chat", async (c) => {
    try {
      const body = await c.req.json();
      const { message, conversationId } = body;

      if (!message || typeof message !== "string") {
        return c.json({ error: "message is required" }, 400);
      }

      const convId = conversationId || generateTestId("conv");

      return c.json({
        response: chatResult.response,
        conversationId: convId,
        memoriesRecalled: chatResult.memoriesRecalled,
        factsRecalled: chatResult.factsRecalled,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  // Recall endpoint
  app.get("/recall", async (c) => {
    try {
      const query = c.req.query("query");

      if (!query) {
        return c.json({ error: "query parameter is required" }, 400);
      }

      return c.json({
        memories: memories,
        facts: facts,
        query,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  // Facts endpoint
  app.get("/facts", async (c) => {
    try {
      return c.json({ facts: facts, count: facts.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  // History endpoint
  app.get("/history/:conversationId", async (c) => {
    try {
      const conversationId = c.req.param("conversationId");
      const conversation = conversations.get(conversationId);

      if (!conversation) {
        return c.json({ error: "Conversation not found" }, 404);
      }

      return c.json({
        conversationId,
        messages: conversation.messages,
        messageCount: conversation.messages.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: message }, 500);
    }
  });

  // Root endpoint
  app.get("/", (c) => {
    return c.json({
      name: "Cortex Memory - Basic Demo API",
      version: "1.0.0",
    });
  });

  return app;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("HTTP Server Integration", () => {
  let app: Hono;

  beforeEach(() => {
    resetState();
    app = createTestApp();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Health Check
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("GET /health", () => {
    it("should return status ok", async () => {
      const res = await app.request("/health");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("ok");
    });

    it("should return config information", async () => {
      const res = await app.request("/health");
      const data = await res.json();

      expect(data.memorySpaceId).toBe("test-space");
      expect(data.agentId).toBe("test-agent");
      expect(data.features).toBeDefined();
      expect(data.features.factExtraction).toBe(true);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Chat Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("POST /chat", () => {
    it("should process valid chat message", async () => {
      const res = await app.request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello, world!" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.response).toBeDefined();
      expect(data.conversationId).toBeDefined();
      expect(data.memoriesRecalled).toBeDefined();
      expect(data.factsRecalled).toBeDefined();
    });

    it("should use provided conversation ID", async () => {
      const customConvId = "conv-custom-456";

      const res = await app.request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Hello",
          conversationId: customConvId,
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.conversationId).toBe(customConvId);
    });

    it("should return 400 if message is missing", async () => {
      const res = await app.request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("message is required");
    });

    it("should return 400 if message is not a string", async () => {
      const res = await app.request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: 123 }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("message is required");
    });

    it("should include memory and fact counts", async () => {
      chatResult.memoriesRecalled = 3;
      chatResult.factsRecalled = 2;

      const res = await app.request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "What do you know?" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.memoriesRecalled).toBe(3);
      expect(data.factsRecalled).toBe(2);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Recall Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("GET /recall", () => {
    it("should return memories and facts for query", async () => {
      // Add test data
      memories.push({
        memoryId: "mem-1",
        content: "Test memory",
        importance: 80,
      });
      facts.push({
        factId: "fact-1",
        fact: "Test fact",
        factType: "knowledge",
        confidence: 90,
      });

      const res = await app.request("/recall?query=test");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.memories).toBeDefined();
      expect(data.memories.length).toBe(1);
      expect(data.facts).toBeDefined();
      expect(data.facts.length).toBe(1);
      expect(data.query).toBe("test");
    });

    it("should return 400 if query is missing", async () => {
      const res = await app.request("/recall");
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("query parameter is required");
    });

    it("should return empty arrays when no memories found", async () => {
      const res = await app.request("/recall?query=nonexistent");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.memories).toEqual([]);
      expect(data.facts).toEqual([]);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Facts Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("GET /facts", () => {
    it("should return list of facts", async () => {
      facts.push({
        factId: "fact-1",
        fact: "User likes coffee",
        factType: "preference",
        confidence: 85,
      });
      facts.push({
        factId: "fact-2",
        fact: "User is a developer",
        factType: "occupation",
        confidence: 90,
      });

      const res = await app.request("/facts");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.facts).toBeDefined();
      expect(data.facts.length).toBe(2);
      expect(data.count).toBe(2);
    });

    it("should return empty array when no facts exist", async () => {
      const res = await app.request("/facts");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.facts).toEqual([]);
      expect(data.count).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // History Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("GET /history/:conversationId", () => {
    it("should return conversation history", async () => {
      // Add conversation
      conversations.set("conv-123", {
        conversationId: "conv-123",
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      });

      const res = await app.request("/history/conv-123");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.conversationId).toBe("conv-123");
      expect(data.messages).toBeDefined();
      expect(data.messageCount).toBe(2);
    });

    it("should return 404 for non-existent conversation", async () => {
      const res = await app.request("/history/nonexistent-conv");
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Conversation not found");
    });

    it("should return message count", async () => {
      conversations.set("conv-456", {
        conversationId: "conv-456",
        messages: [
          { role: "user", content: "First" },
          { role: "assistant", content: "First reply" },
          { role: "user", content: "Second" },
          { role: "assistant", content: "Second reply" },
        ],
      });

      const res = await app.request("/history/conv-456");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.messageCount).toBe(4);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Root Endpoint
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("GET /", () => {
    it("should return API info", async () => {
      const res = await app.request("/");
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.name).toContain("Cortex Memory");
      expect(data.version).toBeDefined();
    });
  });
});
