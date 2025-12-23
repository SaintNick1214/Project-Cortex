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

export async function POST(req: Request) {
  try {
    const { messages, memorySpaceId, userId } = await req.json();

    // Convert UIMessage[] from useChat to ModelMessage[] for streamText
    const modelMessages = convertToModelMessages(messages);

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

          // Build config with the observer
          const config = getCortexMemoryConfig(
            memorySpaceId || "quickstart-demo",
            userId || "demo-user",
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
