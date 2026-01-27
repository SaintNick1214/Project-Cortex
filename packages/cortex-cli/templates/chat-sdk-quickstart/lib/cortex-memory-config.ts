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
): CortexMemoryConfig {
  return {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Core Cortex Configuration
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    convexUrl: process.env.CONVEX_URL!,
    memorySpaceId,
    userId,
    userName: "User",
    agentId: "chat-sdk-assistant",
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

/**
 * Get the memory space ID from environment or use a default.
 *
 * @returns Memory space ID
 */
export function getMemorySpaceId(): string {
  return process.env.MEMORY_SPACE_ID || "chat-sdk-demo";
}
