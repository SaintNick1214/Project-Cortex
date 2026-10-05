import type { FactRecord } from "../types/index.js";

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

/**
 * Normalize fact text for exact matching
 */
export function normalizeFactText(text: string): string {
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
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  for (let index = 0; index < a.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(a, index) || !Object.prototype.hasOwnProperty.call(b, index) ||
        !Number.isFinite(a[index]) || !Number.isFinite(b[index])) {
      throw new Error("Embedding coordinates must be dense and finite");
    }
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
