/**
 * Cortex SDK Client Configuration
 *
 * Mirrors the quickstart's memory configuration with full feature support.
 * Includes optional embeddings, fact extraction, and belief revision.
 */

import { Cortex } from "@cortexmemory/sdk";
import type { RememberParams } from "@cortexmemory/sdk";
import {
  printLayerUpdate,
  printRecallStart,
  printRecallComplete,
  printRememberStart,
  printRememberComplete,
} from "./display.js";

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
let initPromise: Promise<Cortex> | null = null;

/**
 * Initialize the Cortex SDK client (async)
 *
 * Uses Cortex.create() for automatic graph configuration from env vars.
 * When CORTEX_GRAPH_SYNC=true and NEO4J_URI (or MEMGRAPH_URI) is set,
 * the graph adapter is automatically created and connected.
 *
 * v0.29.0+: Graph sync is automatic when graphAdapter is configured.
 * No need to pass syncToGraph option to remember() calls.
 */
export async function initCortex(): Promise<Cortex> {
  if (cortexClient) {
    return cortexClient;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error(
        "CONVEX_URL environment variable is required.\n" +
          "Set it in .env.local or run: cortex init",
      );
    }

    // Build client config
     
    const config: any = { convexUrl };

    // Configure LLM for auto fact extraction when OpenAI key is available
    if (process.env.OPENAI_API_KEY && CONFIG.enableFactExtraction) {
      config.llm = {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.CORTEX_FACT_EXTRACTION_MODEL || "gpt-4o-mini",
      };
    }

    // Use Cortex.create() for async initialization with auto graph configuration
    // This automatically:
    // - Detects CORTEX_GRAPH_SYNC=true
    // - Reads NEO4J_URI/MEMGRAPH_URI and credentials from env
    // - Creates and connects the CypherGraphAdapter
    cortexClient = await Cortex.create(config);
    return cortexClient;
  })();

  return initPromise;
}

/**
 * Get the Cortex SDK client (must call initCortex first)
 *
 * @throws Error if client hasn't been initialized
 */
export function getCortex(): Cortex {
  if (!cortexClient) {
    throw new Error(
      "Cortex client not initialized. Call initCortex() first.",
    );
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

/**
 * Phase of the orchestration
 * - "recall": Context retrieval phase (before LLM response)
 * - "remember": Memory storage phase (after LLM response)
 */
export type OrchestrationPhase = "recall" | "remember";

/**
 * Memory layer types
 */
export type MemoryLayer =
  | "memorySpace"
  | "user"
  | "agent"
  | "context"
  | "conversation"
  | "vector"
  | "facts"
  | "graph";

/**
 * Layer event with phase-aware tracking (v0.35.1+)
 */
export interface LayerEvent {
  layer: MemoryLayer;
  status: "pending" | "in_progress" | "complete" | "error" | "skipped";
  timestamp: number;
  latencyMs?: number;
  /** Phase this event belongs to */
  phase: OrchestrationPhase;
  data?: Record<string, unknown>;
  error?: { message: string; code?: string };
  revisionAction?: "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";
  supersededFacts?: string[];
}

/**
 * Summary of the recall phase (context retrieval)
 */
export interface RecallSummary {
  orchestrationId: string;
  phase: "recall";
  totalLatencyMs: number;
  context: {
    memoriesCount: number;
    factsCount: number;
    graphEntitiesCount: number;
  };
}

/**
 * Summary of the remember phase (memory storage)
 */
export interface OrchestrationSummary {
  orchestrationId: string;
  phase: "remember";
  totalLatencyMs: number;
  createdIds: {
    conversationId?: string;
    memoryIds?: string[];
    factIds?: string[];
  };
}

/**
 * Phase-aware orchestration observer (v0.35.1+)
 *
 * Provides callbacks for both recall (context retrieval) and
 * remember (memory storage) phases of memory orchestration.
 */
export interface OrchestrationObserver {
  /** Called when recall phase starts */
  onRecallStart?: (orchestrationId: string) => void | Promise<void>;
  /** Called when recall phase completes */
  onRecallComplete?: (summary: RecallSummary) => void | Promise<void>;
  /** Called when remember phase starts */
  onRememberStart?: (orchestrationId: string) => void | Promise<void>;
  /** Called when remember phase completes */
  onRememberComplete?: (summary: OrchestrationSummary) => void | Promise<void>;
  /** Called when a layer's status changes (includes phase info) */
  onLayerUpdate?: (event: LayerEvent) => void | Promise<void>;
}

/**
 * Create a phase-aware layer observer for recall operations
 */
export function createRecallObserver(): OrchestrationObserver {
  return {
    onRecallStart: (orchestrationId: string) => {
      printRecallStart(orchestrationId);
    },
    onLayerUpdate: (event: LayerEvent) => {
      printLayerUpdate(event);
    },
    onRecallComplete: (summary: RecallSummary) => {
      printRecallComplete(summary.totalLatencyMs);
      if (CONFIG.debug) {
        console.log("[Debug] Recall complete:", summary);
      }
    },
  };
}

/**
 * Create a phase-aware layer observer for remember operations
 */
export function createRememberObserver(): OrchestrationObserver {
  return {
    onRememberStart: (orchestrationId: string) => {
      printRememberStart(orchestrationId);
    },
    onLayerUpdate: (event: LayerEvent) => {
      printLayerUpdate(event);
    },
    onRememberComplete: (summary: OrchestrationSummary) => {
      printRememberComplete(summary.totalLatencyMs);
      if (CONFIG.debug) {
        console.log("[Debug] Remember complete:", summary);
      }
    },
  };
}

/**
 * Create a legacy-compatible layer observer (deprecated)
 * @deprecated Use createRecallObserver() and createRememberObserver() instead
 */
export function createLayerObserver(): OrchestrationObserver {
  return {
    onRememberStart: (orchestrationId: string) => {
      printRememberStart(orchestrationId);
    },
    onLayerUpdate: (event: LayerEvent) => {
      printLayerUpdate(event);
    },
    onRememberComplete: (summary: OrchestrationSummary) => {
      printRememberComplete(summary.totalLatencyMs);
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

    // Fact extraction and belief revision are handled automatically
    // by the llmConfig on the Cortex client when enableFactExtraction is true
  };

  return params;
}
