/**
 * RAG Chat API with Document Search + Conversation Memory
 */

import { createCortexMemory } from "@cortexmemory/vercel-ai-provider";
import { openai } from "@ai-sdk/openai";
import { streamText, embed } from "ai";
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: "rag-chat",
  userId: () => "demo-user",
  userName: "Demo User",

  // Use OpenAI embeddings for memory search
  embeddingProvider: {
    generate: async (text) => {
      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: text,
      });
      return embedding;
    },
  },
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1].content;

    // 1. Search documents (immutable layer)
    const documentResults = await cortex.immutable.search({
      query: lastMessage,
      type: "document",
      limit: 3,
    });

    // 2. Search conversation memories (handled by cortexMemory automatically)
    // This will inject conversation context

    // 3. Build document context
    const documentContext =
      documentResults.length > 0
        ? `Relevant documents:\n${documentResults
            .map((doc, i) => `${i + 1}. ${doc.data.title}: ${doc.data.content}`)
            .join("\n")}`
        : "";

    // 4. Generate response with both contexts
    const result = await streamText({
      model: cortexMemory(openai("gpt-4-turbo")),
      messages,
      system: `You are a helpful assistant with access to documents and conversation memory.
      
${documentContext}

Use the above documents and your memory of past conversations to answer questions.`,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("RAG API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      { status: 500 },
    );
  }
}
