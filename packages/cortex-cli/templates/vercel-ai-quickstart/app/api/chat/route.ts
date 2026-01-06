import { createCortexMemoryAsync } from "@cortexmemory/vercel-ai-provider";
import type {
  LayerObserver,
  CortexMemoryConfig,
} from "@cortexmemory/vercel-ai-provider";
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
- Help demonstrate the memory system by showing what you remember

Example interactions:
- User: "My name is Alex" → Remember and use their name
- User: "I work at Acme Corp" → Remember their employer
- User: "My favorite color is blue" → Remember their preference
- User: "What do you know about me?" → List everything you remember`;

// Create Cortex Memory config factory
// Uses createCortexMemoryAsync for graph support when CORTEX_GRAPH_SYNC=true
function getCortexMemoryConfig(
  memorySpaceId: string,
  userId: string,
  conversationId: string,
  layerObserver?: LayerObserver,
): CortexMemoryConfig {
  return {
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId,

    // User identification
    userId,
    userName: "Demo User",

    // Agent identification (required for user-agent conversations in SDK v0.17.0+)
    agentId: "quickstart-assistant",
    agentName: "Cortex Demo Assistant",

    // Conversation ID for chat history isolation
    conversationId,

    // Enable graph memory sync (auto-configured via env vars)
    // When true, uses CypherGraphAdapter to sync to Neo4j/Memgraph
    enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",

    // Enable fact extraction (auto-configured via env vars)
    enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",

    // Belief Revision (v0.24.0+)
    // Automatically handles fact updates, supersessions, and deduplication
    // When a user changes their preference (e.g., "I now prefer purple"),
    // the system intelligently updates or supersedes the old fact.
    beliefRevision: {
      enabled: true, // Enable the belief revision pipeline
      slotMatching: true, // Fast slot-based conflict detection (subject-predicate matching)
      llmResolution: true, // LLM-based resolution for nuanced conflicts
    },

    // Embedding provider for semantic matching (required for semantic dedup & belief revision)
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

    // Memory recall configuration (v0.23.0 - unified retrieval across all layers)
    memorySearchLimit: 20, // Results from combined vector + facts + graph search

    // Real-time layer tracking (v0.24.0+)
    // Events are emitted as each layer processes, enabling live UI updates
    layerObserver,

    // Debug in development
    debug: process.env.NODE_ENV === "development",
  };
}

/**
 * Generate a title from the first user message
 */
function generateTitle(message: string): string {
  // Take first 50 chars, cut at word boundary
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

/**
 * Normalize messages to ensure they have the `parts` array format
 * expected by AI SDK v6's convertToModelMessages.
 *
 * Handles:
 * - Messages with `content` string (legacy format) -> converts to `parts` array
 * - Messages with `role: "agent"` -> converts to `role: "assistant"`
 * - Messages already in v6 format -> passes through unchanged
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
      // Convert content string to parts array
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
 * Extract text from a message (handles both content string and parts array)
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages,
      memorySpaceId,
      userId,
      conversationId: providedConversationId,
    } = body;

    // Validate messages array exists
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Generate conversation ID if not provided (new chat)
    const conversationId =
      providedConversationId ||
      `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isNewConversation = !providedConversationId;

    // Normalize messages to ensure they have the `parts` array format
    // expected by AI SDK v6's convertToModelMessages
    const normalizedMessages = normalizeMessages(messages);

    // Convert UIMessage[] from useChat to ModelMessage[] for streamText
    // Note: In AI SDK v6+, convertToModelMessages may return a Promise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelMessagesResult = convertToModelMessages(
      normalizedMessages as any,
    );
    const modelMessages =
      modelMessagesResult instanceof Promise
        ? await modelMessagesResult
        : modelMessagesResult;

    // Get the first user message for title generation
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

    // Use createUIMessageStream to send both LLM text and layer events
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          // Create observer that writes layer events to the stream
          // These events are transient (not persisted in message history)
          const layerObserver: LayerObserver = {
            onOrchestrationStart: (orchestrationId) => {
              writer.write({
                type: "data-orchestration-start",
                data: { orchestrationId },
                transient: true,
              });
            },
            onLayerUpdate: (event) => {
              writer.write({
                type: "data-layer-update",
                data: {
                  layer: event.layer,
                  status: event.status,
                  timestamp: event.timestamp,
                  latencyMs: event.latencyMs,
                  data: event.data,
                  error: event.error,
                  revisionAction: event.revisionAction,
                  supersededFacts: event.supersededFacts,
                },
                transient: true,
              });
            },
            onOrchestrationComplete: (summary) => {
              writer.write({
                type: "data-orchestration-complete",
                data: {
                  orchestrationId: summary.orchestrationId,
                  totalLatencyMs: summary.totalLatencyMs,
                  createdIds: summary.createdIds,
                },
                transient: true,
              });
            },
          };

          // Build config with the observer and conversation ID
          const config = getCortexMemoryConfig(
            memorySpaceId || "quickstart-demo",
            userId || "demo-user",
            conversationId,
            layerObserver,
          );

          // Create memory-augmented model with async initialization (enables graph support)
          // This connects to Neo4j/Memgraph if CORTEX_GRAPH_SYNC=true
          const cortexMemory = await createCortexMemoryAsync(config);

          // Stream response with automatic memory integration
          const result = streamText({
            model: cortexMemory(openai("gpt-4o-mini")),
            messages: modelMessages,
            system: SYSTEM_PROMPT,
          });

          // Merge LLM stream into the UI message stream
          writer.merge(result.toUIMessageStream());

          // If this is a new conversation, create it in the SDK and update the title
          if (isNewConversation && messageText) {
            try {
              const cortex = getCortex();
              const title = generateTitle(messageText);

              // Create the conversation with the SDK
              await cortex.conversations.create({
                memorySpaceId: memorySpaceId || "quickstart-demo",
                conversationId,
                type: "user-agent",
                participants: {
                  userId: userId || "demo-user",
                  agentId: "quickstart-assistant",
                },
                metadata: { title },
              });

              // Send conversation update to the client
              writer.write({
                type: "data-conversation-update",
                data: {
                  conversationId,
                  title,
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
    console.error("[Chat API Error]", error);

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
