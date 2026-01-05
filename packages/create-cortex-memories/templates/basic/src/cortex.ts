/**
 * Cortex SDK Client Configuration
 *
 * Mirrors the quickstart's memory configuration with full feature support.
 * Includes optional embeddings, fact extraction, and belief revision.
 */

import { Cortex } from "@cortexmemory/sdk";
import type { RememberParams } from "@cortexmemory/sdk";
import { printLayerUpdate, printOrchestrationStart } from "./display.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CONFIG = {
  // Memory space for isolation
  memorySpaceId: process.env.MEMORY_SPACE_ID || "basic-demo",

  // User identification
  userId: process.env.USER_ID || "demo-user",
  userName: process.env.USER_NAME || "Demo User",

  // Agent identification (required for user-agent conversations in SDK v0.17.0+)
  agentId: process.env.AGENT_ID || "basic-assistant",
  agentName: process.env.AGENT_NAME || "Cortex CLI Assistant",

  // Feature flags
  enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION !== "false",
  enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",

  // Debug mode
  debug: process.env.DEBUG === "true",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Singleton Client
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let cortexClient: Cortex | null = null;

/**
 * Get or create a Cortex SDK client
 */
export function getCortex(): Cortex {
  if (!cortexClient) {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error(
        "CONVEX_URL environment variable is required.\n" +
          "Set it in .env.local or run: cortex init",
      );
    }

    cortexClient = new Cortex({
      convexUrl,
    });
  }

  return cortexClient;
}

/**
 * Close the Cortex client connection
 */
export function closeCortex(): void {
  if (cortexClient) {
    cortexClient.close();
    cortexClient = null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer Observer (for console output)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LayerEvent {
  layer: string;
  status: "in_progress" | "complete" | "error" | "skipped";
  timestamp: number;
  latencyMs?: number;
  data?: Record<string, unknown>;
  error?: string;
  revisionAction?: "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";
  supersededFacts?: string[];
}

/**
 * Create a layer observer that prints to console
 */
export function createLayerObserver() {
  return {
    onOrchestrationStart: (orchestrationId: string) => {
      printOrchestrationStart(orchestrationId);
    },
    onLayerUpdate: (event: LayerEvent) => {
      printLayerUpdate(event);
    },
    onOrchestrationComplete: (summary: {
      orchestrationId: string;
      totalLatencyMs: number;
      createdIds?: Record<string, string>;
    }) => {
      // Summary is printed by display.ts after all layers
      if (CONFIG.debug) {
        console.log("[Debug] Orchestration complete:", summary);
      }
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Embedding Provider (Optional)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get embedding provider if OpenAI is configured
 */
export async function getEmbeddingProvider(): Promise<
  ((text: string) => Promise<number[]>) | undefined
> {
  if (!process.env.OPENAI_API_KEY) {
    return undefined;
  }

  try {
    // Dynamic import to avoid requiring openai if not used
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    return async (text: string): Promise<number[]> => {
      const result = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return result.data[0].embedding;
    };
  } catch {
    // OpenAI not installed
    return undefined;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Remember Parameters Builder
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ChatMessage {
  userMessage: string;
  agentResponse: string;
  conversationId: string;
}

/**
 * Build RememberParams with full configuration
 */
export async function buildRememberParams(
  message: ChatMessage,
): Promise<RememberParams> {
  const embeddingProvider = await getEmbeddingProvider();

  const params: RememberParams = {
    // Identity
    memorySpaceId: CONFIG.memorySpaceId,
    conversationId: message.conversationId,
    userId: CONFIG.userId,
    userName: CONFIG.userName,
    agentId: CONFIG.agentId,

    // Content
    userMessage: message.userMessage,
    agentResponse: message.agentResponse,

    // Optional embedding
    generateEmbedding: embeddingProvider,

    // Fact extraction (enabled by default)
    extractFacts: CONFIG.enableFactExtraction ? true : undefined,

    // Belief revision (v0.24.0+)
    // Automatically handles fact updates, supersessions, and deduplication
    beliefRevision: CONFIG.enableFactExtraction
      ? {
          enabled: true,
          slotMatching: true,
          llmResolution: !!process.env.OPENAI_API_KEY,
        }
      : undefined,
  };

  return params;
}
