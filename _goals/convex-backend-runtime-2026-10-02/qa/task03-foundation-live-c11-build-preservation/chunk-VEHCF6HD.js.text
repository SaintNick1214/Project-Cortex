import {
  api
} from "./chunk-24X3JR4G.js";

// src/domain/deduplication.ts
function normalizeFactText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,!?;:'"]+/g, "").replace(/\b(the|a|an|is|are|was|were|be|been|being)\b/gi, "").trim();
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  for (let index = 0; index < a.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(a, index) || !Object.prototype.hasOwnProperty.call(b, index) || !Number.isFinite(a[index]) || !Number.isFinite(b[index])) {
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

// src/facts/deduplication.ts
var FactDeduplicationService = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Find a duplicate fact in the database
   *
   * @param candidate - The fact to check for duplicates
   * @param memorySpaceId - Memory space to search in
   * @param config - Deduplication configuration
   * @param userId - Optional user ID filter
   * @returns Duplicate detection result
   */
  async findDuplicate(candidate, memorySpaceId, config, userId) {
    if (config.strategy === "none") {
      return { isDuplicate: false };
    }
    if (config.strategy === "structural" || config.strategy === "semantic") {
      const structuralMatch = await this.findStructuralMatch(
        candidate,
        memorySpaceId,
        userId
      );
      if (structuralMatch) {
        return {
          isDuplicate: true,
          existingFact: structuralMatch,
          similarityScore: 1,
          matchedBy: "structural",
          shouldUpdate: candidate.confidence > structuralMatch.confidence
        };
      }
    }
    if (config.strategy === "exact" || config.strategy === "semantic") {
      const exactMatch = await this.findExactMatch(
        candidate,
        memorySpaceId,
        userId
      );
      if (exactMatch) {
        return {
          isDuplicate: true,
          existingFact: exactMatch,
          similarityScore: 1,
          matchedBy: "exact",
          shouldUpdate: candidate.confidence > exactMatch.confidence
        };
      }
    }
    if (config.strategy === "semantic") {
      if (!config.generateEmbedding) {
        console.warn(
          "[Cortex] Semantic deduplication requested but no generateEmbedding function provided. Falling back to structural."
        );
        return { isDuplicate: false };
      }
      const semanticMatch = await this.findSemanticMatch(
        candidate,
        memorySpaceId,
        config.generateEmbedding,
        config.similarityThreshold ?? 0.85,
        userId
      );
      if (semanticMatch) {
        return {
          isDuplicate: true,
          existingFact: semanticMatch.fact,
          similarityScore: semanticMatch.score,
          matchedBy: "semantic",
          shouldUpdate: candidate.confidence > semanticMatch.fact.confidence
        };
      }
    }
    return { isDuplicate: false };
  }
  /**
   * Find a fact with matching subject, predicate, and object
   */
  async findStructuralMatch(candidate, memorySpaceId, userId) {
    if (!candidate.subject || !candidate.predicate && !candidate.object) {
      return null;
    }
    try {
      const facts = await this.client.query(api.facts.findByStructure, {
        memorySpaceId,
        subject: candidate.subject,
        predicate: candidate.predicate,
        object: candidate.object,
        userId,
        limit: 1
      });
      return facts && facts.length > 0 ? facts[0] : null;
    } catch {
      return null;
    }
  }
  /**
   * Find a fact with matching normalized text
   */
  async findExactMatch(candidate, memorySpaceId, userId) {
    const normalizedCandidate = normalizeFactText(candidate.fact);
    const facts = await this.client.query(api.facts.list, {
      memorySpaceId,
      userId,
      factType: candidate.factType,
      limit: 100
      // Check first 100 facts
    });
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
  async findSemanticMatch(candidate, memorySpaceId, generateEmbedding, threshold, userId) {
    const candidateEmbedding = await generateEmbedding(candidate.fact);
    const facts = await this.client.query(api.facts.list, {
      memorySpaceId,
      userId,
      factType: candidate.factType,
      limit: 50
      // Limit for performance
    });
    let bestMatch = null;
    for (const fact of facts) {
      const existingEmbedding = await generateEmbedding(fact.fact);
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
  static getDefaultConfig(strategy, generateEmbedding) {
    return {
      strategy,
      similarityThreshold: 0.85,
      generateEmbedding
    };
  }
  /**
   * Resolve deduplication config with fallbacks
   *
   * If semantic is requested but no embedding function is available,
   * falls back to structural.
   */
  static resolveConfig(config, fallbackEmbedding) {
    if (typeof config === "string") {
      config = { strategy: config };
    }
    if (!config) {
      config = { strategy: "semantic" };
    }
    if (!config.generateEmbedding && fallbackEmbedding) {
      config.generateEmbedding = fallbackEmbedding;
    }
    if (config.strategy === "semantic" && !config.generateEmbedding) {
      console.warn(
        "[Cortex] Semantic deduplication requested but no generateEmbedding function available. Falling back to structural strategy."
      );
      return {
        ...config,
        strategy: "structural"
      };
    }
    return config;
  }
};

export {
  FactDeduplicationService
};
