/**
 * Cortex Memory Configuration Factory
 *
 * Centralized configuration for Cortex Memory orchestration.
 * Provides a factory function to create memory configs with proper
 * defaults and environment variable support.
 */

import type {
  CortexMemoryConfig,
  LayerObserver,
} from "@cortexmemory/vercel-ai-provider";
import { getAgentId } from "./cortex";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

/**
 * Create a Cortex Memory configuration with all required settings.
 *
 * @param memorySpaceId - Memory space for isolation (from env or context)
 * @param userId - Authenticated user ID
 * @param conversationId - Chat/conversation ID for isolation
 * @param layerObserver - Optional observer for real-time layer events
 * @returns Complete CortexMemoryConfig
 */
export function getCortexMemoryConfig(
  memorySpaceId: string,
  userId: string,
  conversationId: string,
  layerObserver?: LayerObserver,
  signal?: AbortSignal,
): CortexMemoryConfig {
  return {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Core Cortex Configuration
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId,
    enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === "true",
    userId,
    userName: "User",
    agentId: getAgentId(),
    agentName: "Chat SDK Assistant",
    conversationId,

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Fact Extraction
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === "true",

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Belief Revision
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    beliefRevision: {
      enabled: true,
      slotMatching: true,
      llmResolution: true,
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Embedding Provider (OpenAI)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    embeddingProvider: {
      generate: async (text: string) => {
        const result = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: text,
          abortSignal: signal,
        });
        return result.embedding;
      },
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Streaming Options
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    streamingOptions: {
      storePartialResponse: true,
      progressiveFactExtraction: true,
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Memory Search Settings
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    memorySearchLimit: 20,

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Layer Observation (for UI visualization)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    layerObserver,

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Debug (enabled in development)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    debug: process.env.NODE_ENV === "development",
  };
}
