/**
 * Cortex SDK Configuration
 *
 * Centralized configuration with environment variable support.
 * Values can be overridden at runtime via API parameters.
 */

import type { RecallLimits } from "./types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LLM Model Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Default models by usage area.
 *
 * Based on benchmarks from Documentation/core-features/fact-extraction.mdx:
 * - gpt-4o-2024-11-20: Best balance (13 facts, 11.6s latency)
 * - gpt-4o-mini: Budget option (11 facts, 16s latency)
 * - gpt-5-mini: Best quality but 5x latency cost
 */
export const MODEL_DEFAULTS = {
  factExtraction: {
    openai: "gpt-4o-2024-11-20",
    anthropic: "claude-3-haiku-20240307",
  },
  conflictResolution: {
    openai: "gpt-4o-2024-11-20",
    anthropic: "claude-3-haiku-20240307",
  },
  embedding: "text-embedding-3-small",
} as const;

/**
 * Resolve model for fact extraction.
 *
 * Priority order:
 * 1. configModel (programmatic config)
 * 2. CORTEX_FACT_EXTRACTION_MODEL env var
 * 3. Provider-specific default
 *
 * @param configModel - Model from LLMConfig.model
 * @param provider - LLM provider ("openai" or "anthropic")
 * @returns Resolved model name
 */
export function resolveFactExtractionModel(
  configModel?: string,
  provider: "openai" | "anthropic" = "openai",
): string {
  return (
    configModel ||
    process.env.CORTEX_FACT_EXTRACTION_MODEL ||
    MODEL_DEFAULTS.factExtraction[provider]
  );
}

/**
 * Resolve model for conflict resolution (belief revision).
 *
 * Priority order:
 * 1. configModel (per-call or programmatic config)
 * 2. CORTEX_CONFLICT_RESOLUTION_MODEL env var
 * 3. CORTEX_FACT_EXTRACTION_MODEL env var (fallback)
 * 4. Provider-specific default
 *
 * @param configModel - Model from BeliefRevisionConfig.llmResolution.model
 * @param provider - LLM provider ("openai" or "anthropic")
 * @returns Resolved model name
 */
export function resolveConflictResolutionModel(
  configModel?: string,
  provider: "openai" | "anthropic" = "openai",
): string {
  return (
    configModel ||
    process.env.CORTEX_CONFLICT_RESOLUTION_MODEL ||
    process.env.CORTEX_FACT_EXTRACTION_MODEL ||
    MODEL_DEFAULTS.conflictResolution[provider]
  );
}

/**
 * Resolve model for embedding generation.
 *
 * Priority order:
 * 1. configModel (programmatic config)
 * 2. CORTEX_EMBEDDING_MODEL env var
 * 3. Default model
 *
 * @param configModel - Model from EmbeddingConfig.model
 * @returns Resolved model name
 */
export function resolveEmbeddingModel(configModel?: string): string {
  return (
    configModel || process.env.CORTEX_EMBEDDING_MODEL || MODEL_DEFAULTS.embedding
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Recall Limits Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse an environment variable as an integer with a default value.
 * Returns the default if the env var is not set or is not a valid number.
 */
function parseEnvInt(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Default limits for recall() operations.
 *
 * Configuration hierarchy (highest priority first):
 * 1. Per-call override via RecallParams.limits
 * 2. Environment variables (CORTEX_RECALL_*)
 * 3. These SDK defaults
 *
 * Environment variables:
 * - CORTEX_RECALL_LIMIT_MEMORIES: Max memories from vector search (default: 20)
 * - CORTEX_RECALL_LIMIT_FACTS: Max facts from semantic search (default: 15)
 * - CORTEX_RECALL_GRAPH_HOPS: Graph traversal depth, 0=off (default: 2)
 * - CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP: Entities to expand per hop (default: 5)
 * - CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY: Results per entity (default: 3)
 * - CORTEX_RECALL_LIMIT_TOTAL: Final aggregate limit (default: 30)
 */
export const RECALL_DEFAULTS: Required<RecallLimits> = {
  memories: parseEnvInt(process.env.CORTEX_RECALL_LIMIT_MEMORIES, 20),
  facts: parseEnvInt(process.env.CORTEX_RECALL_LIMIT_FACTS, 15),
  graphHops: parseEnvInt(process.env.CORTEX_RECALL_GRAPH_HOPS, 2),
  graphEntitiesPerHop: parseEnvInt(
    process.env.CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP,
    5,
  ),
  graphResultsPerEntity: parseEnvInt(
    process.env.CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY,
    3,
  ),
  total: parseEnvInt(process.env.CORTEX_RECALL_LIMIT_TOTAL, 30),
};

/**
 * Merge user-provided limits with defaults.
 * User values take precedence, falling back to env vars, then SDK defaults.
 *
 * @param userLimits - Optional limits from RecallParams
 * @param legacyLimit - Optional legacy 'limit' param for backward compat
 * @returns Fully resolved limits with all fields populated
 */
export function resolveRecallLimits(
  userLimits?: RecallLimits,
  legacyLimit?: number,
): Required<RecallLimits> {
  // Start with defaults (already includes env var overrides)
  const resolved = { ...RECALL_DEFAULTS };

  // Apply user-provided limits
  if (userLimits) {
    if (userLimits.memories !== undefined) {
      resolved.memories = userLimits.memories;
    }
    if (userLimits.facts !== undefined) {
      resolved.facts = userLimits.facts;
    }
    if (userLimits.graphHops !== undefined) {
      resolved.graphHops = userLimits.graphHops;
    }
    if (userLimits.graphEntitiesPerHop !== undefined) {
      resolved.graphEntitiesPerHop = userLimits.graphEntitiesPerHop;
    }
    if (userLimits.graphResultsPerEntity !== undefined) {
      resolved.graphResultsPerEntity = userLimits.graphResultsPerEntity;
    }
    if (userLimits.total !== undefined) {
      resolved.total = userLimits.total;
    }
  }

  // Legacy 'limit' param maps to 'total' (only if limits.total not set)
  if (legacyLimit !== undefined && userLimits?.total === undefined) {
    resolved.total = legacyLimit;
  }

  return resolved;
}
