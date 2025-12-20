/**
 * Cortex SDK - Fact Deduplication Service
 *
 * Cross-session fact deduplication with configurable strategies:
 * - exact: Normalized text match (fastest, lowest accuracy)
 * - structural: Subject + predicate + object match (fast, medium accuracy)
 * - semantic: Embedding similarity search (slower, highest accuracy)
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type { FactRecord } from "../types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Available deduplication strategies
 *
 * - 'none': Skip deduplication (fastest, no accuracy)
 * - 'exact': Normalized text match (fast, low accuracy)
 * - 'structural': Subject + predicate + object match (fast, medium accuracy)
 * - 'semantic': Embedding similarity search (slower, highest accuracy)
 */
export type DeduplicationStrategy =
  | "none"
  | "exact"
  | "structural"
  | "semantic";

/**
 * Configuration for fact deduplication
 */
export interface DeduplicationConfig {
  /** Deduplication strategy to use */
  strategy: DeduplicationStrategy;

  /**
   * Similarity threshold for semantic matching (0-1)
   * Only used when strategy is 'semantic'
   * @default 0.85
   */
  similarityThreshold?: number;

  /**
   * Function to generate embeddings for semantic matching
   * Required when strategy is 'semantic', otherwise ignored
   */
  generateEmbedding?: (text: string) => Promise<number[]>;
}

/**
 * Candidate fact for deduplication check
 */
export interface FactCandidate {
  fact: string;
  factType: string;
  subject?: string;
  predicate?: string;
  object?: string;
  confidence: number;
  tags?: string[];
}

/**
 * Result of duplicate detection
 */
export interface DuplicateResult {
  /** Whether a duplicate was found */
  isDuplicate: boolean;

  /** The existing fact if a duplicate was found */
  existingFact?: FactRecord;

  /** Similarity score (0-1) for semantic matches, 1.0 for exact/structural */
  similarityScore?: number;

  /** Which strategy detected the duplicate */
  matchedBy?: DeduplicationStrategy;

  /** Whether the new fact has higher confidence than existing */
  shouldUpdate?: boolean;
}

/**
 * Result of store with deduplication
 */
export interface StoreWithDedupResult {
  /** The fact record (new or existing) */
  fact: FactRecord;

  /** Whether an existing fact was updated instead of creating new */
  wasUpdated: boolean;

  /** Deduplication details */
  deduplication?: {
    strategy: DeduplicationStrategy;
    matchedExisting: boolean;
    similarityScore?: number;
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utility Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Normalize fact text for exact matching
 */
function normalizeFactText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/[.,!?;:'"]+/g, "") // Remove punctuation
    .replace(/\b(the|a|an|is|are|was|were|be|been|being)\b/gi, "") // Remove common words
    .trim();
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FactDeduplicationService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Service for cross-session fact deduplication
 *
 * @example
 * ```typescript
 * const dedupService = new FactDeduplicationService(convexClient);
 *
 * // Check for duplicates before storing
 * const result = await dedupService.findDuplicate(
 *   { fact: "User prefers dark mode", factType: "preference", confidence: 95 },
 *   "memory-space-1",
 *   { strategy: "semantic", generateEmbedding: embedFn }
 * );
 *
 * if (result.isDuplicate) {
 *   console.log("Found duplicate:", result.existingFact?.factId);
 * }
 * ```
 */
export class FactDeduplicationService {
  constructor(private client: ConvexClient) {}

  /**
   * Find a duplicate fact in the database
   *
   * @param candidate - The fact to check for duplicates
   * @param memorySpaceId - Memory space to search in
   * @param config - Deduplication configuration
   * @param userId - Optional user ID filter
   * @returns Duplicate detection result
   */
  async findDuplicate(
    candidate: FactCandidate,
    memorySpaceId: string,
    config: DeduplicationConfig,
    userId?: string,
  ): Promise<DuplicateResult> {
    // Skip if strategy is 'none'
    if (config.strategy === "none") {
      return { isDuplicate: false };
    }

    // Try strategies in order of specificity
    // Structural is most specific, then exact, then semantic

    // 1. Structural match (most reliable)
    if (config.strategy === "structural" || config.strategy === "semantic") {
      const structuralMatch = await this.findStructuralMatch(
        candidate,
        memorySpaceId,
        userId,
      );

      if (structuralMatch) {
        return {
          isDuplicate: true,
          existingFact: structuralMatch,
          similarityScore: 1.0,
          matchedBy: "structural",
          shouldUpdate: candidate.confidence > structuralMatch.confidence,
        };
      }
    }

    // 2. Exact text match
    if (config.strategy === "exact" || config.strategy === "semantic") {
      const exactMatch = await this.findExactMatch(
        candidate,
        memorySpaceId,
        userId,
      );

      if (exactMatch) {
        return {
          isDuplicate: true,
          existingFact: exactMatch,
          similarityScore: 1.0,
          matchedBy: "exact",
          shouldUpdate: candidate.confidence > exactMatch.confidence,
        };
      }
    }

    // 3. Semantic similarity (most expensive)
    if (config.strategy === "semantic") {
      // Check if generateEmbedding is available
      if (!config.generateEmbedding) {
        console.warn(
          "[Cortex] Semantic deduplication requested but no generateEmbedding function provided. Falling back to structural.",
        );
        return { isDuplicate: false };
      }

      const semanticMatch = await this.findSemanticMatch(
        candidate,
        memorySpaceId,
        config.generateEmbedding,
        config.similarityThreshold ?? 0.85,
        userId,
      );

      if (semanticMatch) {
        return {
          isDuplicate: true,
          existingFact: semanticMatch.fact,
          similarityScore: semanticMatch.score,
          matchedBy: "semantic",
          shouldUpdate: candidate.confidence > semanticMatch.fact.confidence,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Find a fact with matching subject, predicate, and object
   */
  private async findStructuralMatch(
    candidate: FactCandidate,
    memorySpaceId: string,
    userId?: string,
  ): Promise<FactRecord | null> {
    // Only check structural match if we have at least subject AND (predicate OR object)
    if (!candidate.subject || (!candidate.predicate && !candidate.object)) {
      return null;
    }

    try {
      const facts = await this.client.query(api.facts.findByStructure, {
        memorySpaceId,
        subject: candidate.subject,
        predicate: candidate.predicate,
        object: candidate.object,
        userId,
        limit: 1,
      });

      return (facts && facts.length > 0 ? facts[0] : null) as FactRecord | null;
    } catch {
      // Query might not exist yet, fall through
      return null;
    }
  }

  /**
   * Find a fact with matching normalized text
   */
  private async findExactMatch(
    candidate: FactCandidate,
    memorySpaceId: string,
    userId?: string,
  ): Promise<FactRecord | null> {
    const normalizedCandidate = normalizeFactText(candidate.fact);

    // Get facts for this memory space and optionally filter by user
    const facts = (await this.client.query(api.facts.list, {
      memorySpaceId,
      userId,
      factType: candidate.factType as
        | "preference"
        | "identity"
        | "knowledge"
        | "relationship"
        | "event"
        | "observation"
        | "custom",
      limit: 100, // Check first 100 facts
    })) as FactRecord[];

    // Find exact match by normalized text
    for (const fact of facts) {
      const normalizedExisting = normalizeFactText(fact.fact);
      if (normalizedCandidate === normalizedExisting) {
        return fact;
      }
    }

    return null;
  }

  /**
   * Find a semantically similar fact using embeddings
   */
  private async findSemanticMatch(
    candidate: FactCandidate,
    memorySpaceId: string,
    generateEmbedding: (text: string) => Promise<number[]>,
    threshold: number,
    userId?: string,
  ): Promise<{ fact: FactRecord; score: number } | null> {
    // Generate embedding for candidate fact
    const candidateEmbedding = await generateEmbedding(candidate.fact);

    // Get existing facts
    const facts = (await this.client.query(api.facts.list, {
      memorySpaceId,
      userId,
      factType: candidate.factType as
        | "preference"
        | "identity"
        | "knowledge"
        | "relationship"
        | "event"
        | "observation"
        | "custom",
      limit: 50, // Limit for performance
    })) as FactRecord[];

    let bestMatch: { fact: FactRecord; score: number } | null = null;

    // Compare with each existing fact
    for (const fact of facts) {
      // Generate embedding for existing fact
      const existingEmbedding = await generateEmbedding(fact.fact);

      // Calculate similarity
      const score = cosineSimilarity(candidateEmbedding, existingEmbedding);

      if (score >= threshold) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { fact, score };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get default deduplication config for a given strategy
   */
  static getDefaultConfig(
    strategy: DeduplicationStrategy,
    generateEmbedding?: (text: string) => Promise<number[]>,
  ): DeduplicationConfig {
    return {
      strategy,
      similarityThreshold: 0.85,
      generateEmbedding,
    };
  }

  /**
   * Resolve deduplication config with fallbacks
   *
   * If semantic is requested but no embedding function is available,
   * falls back to structural.
   */
  static resolveConfig(
    config: DeduplicationConfig | DeduplicationStrategy | undefined,
    fallbackEmbedding?: (text: string) => Promise<number[]>,
  ): DeduplicationConfig {
    // Handle string shorthand
    if (typeof config === "string") {
      config = { strategy: config };
    }

    // Default to semantic
    if (!config) {
      config = { strategy: "semantic" };
    }

    // Add fallback embedding function if not provided
    if (!config.generateEmbedding && fallbackEmbedding) {
      config.generateEmbedding = fallbackEmbedding;
    }

    // Fallback from semantic to structural if no embedding function
    if (config.strategy === "semantic" && !config.generateEmbedding) {
      console.warn(
        "[Cortex] Semantic deduplication requested but no generateEmbedding function available. Falling back to structural strategy.",
      );
      return {
        ...config,
        strategy: "structural",
      };
    }

    return config;
  }
}
