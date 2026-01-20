/**
 * Chat API Route (AI SDK v6 Style)
 *
 * This route uses AI SDK v6's patterns while maintaining full Cortex Memory
 * capabilities including:
 * - Memory recall (reading past memories)
 * - Memory storage (saving new conversations)
 * - Fact extraction (extracting knowledge from conversations)
 * - Belief revision (superseding outdated facts)
 * - Layer observer (real-time UI updates)
 *
 * The key difference from v5 is using v6's cleaner APIs, but the memory
 * infrastructure is identical to ensure feature parity.
 */

import {
  createCortexMemoryAsync,
  createLayerStreamObserver,
} from "@cortexmemory/vercel-ai-provider";
import type { CortexMemoryConfig } from "@cortexmemory/vercel-ai-provider";
import { openai, createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  embed,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { getCortex } from "@/lib/cortex";

// Create OpenAI client for embeddings
const openaiClient = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// System prompt for the assistant
const SYSTEM_PROMPT = `You are a helpful AI assistant with long-term memory powered by Cortex.

Your capabilities:
- You remember everything users tell you across conversations
- You can recall facts, preferences, and context from past interactions
- You naturally reference what you've learned about the user

Behavior guidelines:
- When you remember something from a previous conversation, mention it naturally
- If asked about something you learned, reference it specifically
- Be conversational and friendly
- Help demonstrate the memory system by showing what you remember`;

/**
 * Create Cortex Memory config - IDENTICAL to v5 route for feature parity
 */
function getCortexMemoryConfig(
  memorySpaceId: string,
  userId: string,
  conversationId: string,
): Omit<CortexMemoryConfig, "layerObserver"> {
  return {
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId,

    // User identification
    userId,
    userName: "Demo User",

    // Agent identification
    agentId: "cortex-memory-agent",
    agentName: "Cortex v6 Assistant",

    // Conversation ID for chat history isolation
    conversationId,

    // Enable graph memory sync
    enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",

    // Enable fact extraction - CRITICAL for memory to work!
    enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",

    // Belief Revision - handles fact updates and supersessions
    beliefRevision: {
      enabled: true,
      slotMatching: true,
      llmResolution: true,
    },

    // Embedding provider for semantic matching
    embeddingProvider: {
      generate: async (text: string) => {
        const result = await embed({
          model: openaiClient.embedding("text-embedding-3-small"),
          value: text,
        });
        return result.embedding;
      },
    },

    // Streaming enhancements
    streamingOptions: {
      storePartialResponse: true,
      progressiveFactExtraction: true,
      enableAdaptiveProcessing: true,
    },

    // Memory recall configuration
    memorySearchLimit: 20,

    // Debug in development
    debug: process.env.NODE_ENV === "development",
  };
}

/**
 * Normalize messages to AI SDK v6 UIMessage format
 */
function normalizeMessages(messages: unknown[]): unknown[] {
  return messages.map((msg: unknown) => {
    const m = msg as Record<string, unknown>;

    // Normalize role: "agent" -> "assistant"
    let role = m.role as string;
    if (role === "agent") {
      role = "assistant";
    }

    // Ensure parts array exists
    let parts = m.parts as Array<{ type: string; text?: string }> | undefined;
    if (!parts) {
      const content = m.content as string | undefined;
      if (content) {
        parts = [{ type: "text", text: content }];
      } else {
        parts = [];
      }
    }

    return {
      ...m,
      role,
      parts,
    };
  });
}

/**
 * Extract text from a message
 */
function getMessageText(message: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("");
  }
  return "";
}

/**
 * Generate a title from the first user message
 */
function generateTitle(message: string): string {
  let title = message.slice(0, 50);
  if (message.length > 50) {
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > 20) {
      title = title.slice(0, lastSpace);
    }
    title += "...";
  }
  return title;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      memorySpaceId = "quickstart-demo",
      userId = "demo-user",
      conversationId: providedConversationId,
    } = body;

    // Validate messages array exists
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Generate conversation ID if not provided
    const conversationId =
      providedConversationId ||
      `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isNewConversation = !providedConversationId;

    // Normalize messages for convertToModelMessages
    const normalizedMessages = normalizeMessages(messages);

    // Convert to model messages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelMessagesResult = convertToModelMessages(
      normalizedMessages as any,
    );
    const modelMessages =
      modelMessagesResult instanceof Promise
        ? await modelMessagesResult
        : modelMessagesResult;

    // Get first user message for title
    const firstUserMessage = messages.find(
      (m: { role: string }) => m.role === "user",
    ) as
      | {
          role: string;
          content?: string;
          parts?: Array<{ type: string; text?: string }>;
        }
      | undefined;

    const messageText = firstUserMessage
      ? getMessageText(firstUserMessage)
      : "";

    // Use createUIMessageStreamResponse - same as v5 for full memory support
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          // Create layer observer using the streaming helper
          // This replaces ~35 lines of manual observer setup with 2 lines!
          const { observer, emitTo } = createLayerStreamObserver();
          emitTo(writer);

          // Build config with observer
          const config = getCortexMemoryConfig(
            memorySpaceId,
            userId,
            conversationId,
          );

          // Create memory-augmented model - THIS handles both recall AND storage!
          const cortexMemory = await createCortexMemoryAsync({
            ...config,
            layerObserver: observer,
          });

          // Stream response with automatic memory integration
          const result = streamText({
            model: cortexMemory(openai("gpt-4o-mini")),
            messages: modelMessages,
            system: SYSTEM_PROMPT,
          });

          // Merge LLM stream into UI message stream
          writer.merge(result.toUIMessageStream());

          // Create conversation if new
          if (isNewConversation && messageText) {
            try {
              const cortex = getCortex();
              await cortex.conversations.create({
                memorySpaceId,
                conversationId,
                type: "user-agent",
                participants: {
                  userId,
                  agentId: "cortex-memory-agent",
                },
                metadata: { title: generateTitle(messageText) },
              });

              // Send conversation update to client
              writer.write({
                type: "data-conversation-update",
                data: {
                  conversationId,
                  title: generateTitle(messageText),
                },
                transient: true,
              });
            } catch (error) {
              console.error("Failed to create conversation:", error);
            }
          }
        },
      }),
    });
  } catch (error) {
    console.error("[Chat v6 API Error]", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
