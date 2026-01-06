/**
 * Cortex Memory - HTTP Server Mode
 *
 * REST API server for demonstrating Cortex Memory SDK.
 * Useful for testing with tools like curl, Postman, or integrating with other apps.
 *
 * Usage:
 *   npm run server
 *
 * Endpoints:
 *   POST /chat          Chat and store memory
 *   GET  /recall        Search memories
 *   GET  /facts         List stored facts
 *   GET  /history/:id   Get conversation history
 *   GET  /health        Health check
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { closeCortex, CONFIG } from "./cortex.js";
import {
  chat,
  recallMemories,
  listFacts,
  generateConversationId,
} from "./chat.js";
import { printWelcome, printInfo, printError } from "./display.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Server Setup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Health check
 */
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    memorySpaceId: CONFIG.memorySpaceId,
    agentId: CONFIG.agentId,
    features: {
      factExtraction: CONFIG.enableFactExtraction,
      graphSync: CONFIG.enableGraphMemory,
      llm: !!process.env.OPENAI_API_KEY,
    },
  });
});

/**
 * Chat endpoint
 *
 * POST /chat
 * Body: { message: string, conversationId?: string }
 */
app.post("/chat", async (c) => {
  try {
    const body = await c.req.json();
    const { message, conversationId } = body;

    if (!message || typeof message !== "string") {
      return c.json({ error: "message is required" }, 400);
    }

    const convId = conversationId || generateConversationId();

    console.log(`\n[Chat] User: ${message.slice(0, 50)}${message.length > 50 ? "..." : ""}`);

    const result = await chat(message, convId);

    console.log(`[Chat] Response sent (${result.memoriesRecalled} memories, ${result.factsRecalled} facts recalled)\n`);

    return c.json({
      response: result.response,
      conversationId: result.conversationId,
      memoriesRecalled: result.memoriesRecalled,
      factsRecalled: result.factsRecalled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    printError("Chat failed", error instanceof Error ? error : undefined);
    return c.json({ error: message }, 500);
  }
});

/**
 * Recall endpoint
 *
 * GET /recall?query=<query>
 */
app.get("/recall", async (c) => {
  try {
    const query = c.req.query("query");

    if (!query) {
      return c.json({ error: "query parameter is required" }, 400);
    }

    console.log(`\n[Recall] Query: ${query}`);

    // Use the internal recall function but capture results
    const { getCortex } = await import("./cortex.js");
    const cortex = getCortex();

    const result = await cortex.memory.recall({
      memorySpaceId: CONFIG.memorySpaceId,
      query,
      limit: 10,
      sources: {
        vector: true,
        facts: true,
        graph: CONFIG.enableGraphMemory,
      },
    });

    console.log(`[Recall] Found ${result.memories?.length || 0} memories, ${result.facts?.length || 0} facts\n`);

    return c.json({
      memories: result.memories || [],
      facts: result.facts || [],
      query,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/**
 * Facts endpoint
 *
 * GET /facts
 */
app.get("/facts", async (c) => {
  try {
    const { getCortex } = await import("./cortex.js");
    const cortex = getCortex();

    const result = await cortex.facts.list({
      memorySpaceId: CONFIG.memorySpaceId,
      limit: 50,
    });

    const facts = result.facts || result || [];

    return c.json({ facts, count: facts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/**
 * Conversation history endpoint
 *
 * GET /history/:conversationId
 */
app.get("/history/:conversationId", async (c) => {
  try {
    const conversationId = c.req.param("conversationId");

    const { getCortex } = await import("./cortex.js");
    const cortex = getCortex();

    const conversation = await cortex.conversations.get(conversationId);

    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json({
      conversationId,
      messages: conversation.messages || [],
      messageCount: conversation.messages?.length || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

/**
 * Root endpoint - API docs
 */
app.get("/", (c) => {
  return c.json({
    name: "Cortex Memory - Basic Demo API",
    version: "1.0.0",
    endpoints: {
      "POST /chat": {
        description: "Chat and store memory",
        body: { message: "string", conversationId: "string (optional)" },
      },
      "GET /recall": {
        description: "Search memories",
        query: { query: "string" },
      },
      "GET /facts": {
        description: "List all stored facts",
      },
      "GET /history/:id": {
        description: "Get conversation history",
      },
      "GET /health": {
        description: "Health check",
      },
    },
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Server Start
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main(): Promise<void> {
  // Check for required environment
  if (!process.env.CONVEX_URL) {
    printError(
      "CONVEX_URL is required. Set it in .env.local or run: cortex init",
    );
    process.exit(1);
  }

  // Print welcome
  printWelcome("server");

  // Start server
  console.log(`🚀 Server starting on http://localhost:${PORT}`);
  console.log("");
  console.log("Endpoints:");
  console.log(`   POST http://localhost:${PORT}/chat`);
  console.log(`   GET  http://localhost:${PORT}/recall?query=...`);
  console.log(`   GET  http://localhost:${PORT}/facts`);
  console.log(`   GET  http://localhost:${PORT}/history/:id`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log("");
  console.log("Example:");
  console.log(`   curl -X POST http://localhost:${PORT}/chat \\`);
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"message": "My name is Alex"}\'');
  console.log("");

  serve({
    fetch: app.fetch,
    port: PORT,
  });

  printInfo(`Server running on port ${PORT}`);
}

// Handle cleanup
process.on("SIGINT", () => {
  console.log("\n\nShutting down...");
  closeCortex();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeCortex();
  process.exit(0);
});

// Run
main().catch((error) => {
  printError("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
