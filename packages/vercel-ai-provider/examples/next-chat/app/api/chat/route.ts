/**
 * Chat API Route with Cortex Memory
 *
 * Demonstrates automatic memory retrieval and storage with Vercel AI SDK
 */

import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

// Initialize Cortex Memory provider
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: process.env.MEMORY_SPACE_ID || "default-chat",

  // For this simple example, use a single user
  // In production, you'd get this from session/auth
  userId: () => "demo-user",
  userName: "Demo User",

  // Optional: Enable debug logging
  debug: process.env.NODE_ENV === "development",

  // Optional: Configure memory search
  memorySearchLimit: 5,
  minMemoryRelevance: 0.7,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Generate response with automatic memory
    // Memory is:
    // 1. Searched before generation (injects relevant context)
    // 2. Stored after generation (remembers this conversation)
    const result = await streamText({
      model: cortexMemory(openai("gpt-5-nano")),
      messages,
      system:
        "You are a helpful assistant with long-term memory. You remember past conversations and can reference them naturally.",
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
