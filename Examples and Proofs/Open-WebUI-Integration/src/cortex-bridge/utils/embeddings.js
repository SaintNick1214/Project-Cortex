/**
 * Embeddings Utility
 * Handles OpenAI embedding generation with caching and error handling
 */

import OpenAI from "openai";
import logger from "./logger.js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory cache for embeddings
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Generate embedding for text using OpenAI
 * @param {string} text - Text to embed
 * @param {string} model - Embedding model (default: text-embedding-3-small)
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(
  text,
  model = "text-embedding-3-small",
) {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty");
  }

  // Check cache
  const cacheKey = `${model}:${text}`;
  const cached = embeddingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug("Embedding cache hit", { textLength: text.length });
    return cached.embedding;
  }

  try {
    logger.debug("Generating embedding", {
      textLength: text.length,
      model,
    });

    const startTime = Date.now();

    const response = await openai.embeddings.create({
      model,
      input: text,
    });

    const embedding = response.data[0].embedding;
    const duration = Date.now() - startTime;

    logger.debug("Embedding generated", {
      dimension: embedding.length,
      duration: `${duration}ms`,
    });

    // Cache the result
    if (embeddingCache.size >= CACHE_MAX_SIZE) {
      // Simple LRU: delete oldest entry
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }

    embeddingCache.set(cacheKey, {
      embedding,
      timestamp: Date.now(),
    });

    return embedding;
  } catch (error) {
    logger.error("Error generating embedding", {
      error: error.message,
      textLength: text.length,
      model,
    });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to embed
 * @param {string} model - Embedding model
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(
  texts,
  model = "text-embedding-3-small",
) {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    logger.debug("Generating batch embeddings", {
      count: texts.length,
      model,
    });

    const startTime = Date.now();

    const response = await openai.embeddings.create({
      model,
      input: texts,
    });

    const embeddings = response.data.map((item) => item.embedding);
    const duration = Date.now() - startTime;

    logger.debug("Batch embeddings generated", {
      count: embeddings.length,
      duration: `${duration}ms`,
      avgPerText: `${(duration / texts.length).toFixed(2)}ms`,
    });

    return embeddings;
  } catch (error) {
    logger.error("Error generating batch embeddings", {
      error: error.message,
      count: texts.length,
      model,
    });
    throw error;
  }
}

/**
 * Clear embedding cache
 */
export function clearCache() {
  const size = embeddingCache.size;
  embeddingCache.clear();
  logger.info("Embedding cache cleared", { entriesCleared: size });
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: embeddingCache.size,
    maxSize: CACHE_MAX_SIZE,
    ttl: CACHE_TTL,
  };
}

export default {
  generateEmbedding,
  generateEmbeddings,
  clearCache,
  getCacheStats,
};
