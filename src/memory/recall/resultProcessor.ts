/**
 * Result Processing Utilities for recall() Orchestration
 *
 * These utilities handle:
 * - Merging results from multiple sources (vector, facts, graph-expanded)
 * - Deduplicating items that appear in multiple sources
 * - Ranking items using a multi-signal scoring algorithm
 * - Formatting results for LLM injection
 */

import type {
  FactRecord,
  MemoryEntry,
  RecallItem,
  RecallSourceBreakdown,
  Conversation,
  Message,
} from "../../types";

/**
 * Ranking weights for the scoring algorithm.
 * These weights sum to 1.0 for normalized scoring.
 */
export const RANKING_WEIGHTS = {
  /** Weight for vector similarity score */
  semantic: 0.35,
  /** Weight for fact confidence (0-100 → 0-1) */
  confidence: 0.2,
  /** Weight for importance (0-100 → 0-1) */
  importance: 0.15,
  /** Weight for recency (time decay) */
  recency: 0.15,
  /** Weight for graph connectivity */
  graphConnectivity: 0.15,
} as const;

/**
 * Boost multipliers for special conditions
 */
export const SCORE_BOOSTS = {
  /** Boost for items with many graph connections */
  highlyConnected: 1.2,
  /** Boost for user messages (more likely to contain preferences) */
  userMessage: 1.1,
  /** Threshold for highly connected (number of entities) */
  highlyConnectedThreshold: 3,
} as const;

/**
 * Convert a memory entry to a RecallItem
 */
export function memoryToRecallItem(
  memory: MemoryEntry,
  source: "vector" | "graph-expanded",
  baseScore: number = 0.5,
): RecallItem {
  return {
    type: "memory",
    id: memory.memoryId,
    content: memory.content,
    score: baseScore,
    source,
    memory,
    graphContext: {
      connectedEntities: [],
    },
  };
}

/**
 * Convert a fact record to a RecallItem
 */
export function factToRecallItem(
  fact: FactRecord,
  source: "facts" | "graph-expanded",
  baseScore: number = 0.5,
): RecallItem {
  return {
    type: "fact",
    id: fact.factId,
    content: fact.fact,
    score: baseScore,
    source,
    fact,
    graphContext: {
      connectedEntities: fact.subject
        ? [fact.subject, ...(fact.object ? [fact.object] : [])]
        : [],
    },
  };
}

/**
 * Merge results from all sources into a unified list.
 *
 * @param vectorMemories - Memories from vector search
 * @param directFacts - Facts from direct facts search
 * @param graphExpandedMemories - Memories found via graph expansion
 * @param graphExpandedFacts - Facts found via graph expansion
 * @param discoveredEntities - Entities discovered through graph
 * @returns Array of RecallItems with source tracking
 */
export function mergeResults(
  vectorMemories: MemoryEntry[],
  directFacts: FactRecord[],
  graphExpandedMemories: MemoryEntry[],
  graphExpandedFacts: FactRecord[],
  discoveredEntities: string[] = [],
): RecallItem[] {
  const items: RecallItem[] = [];

  // Add vector memories
  for (const memory of vectorMemories) {
    const item = memoryToRecallItem(memory, "vector", 0.7);
    items.push(item);
  }

  // Add direct facts (primary source search)
  for (const fact of directFacts) {
    const item = factToRecallItem(fact, "facts", 0.7);
    items.push(item);
  }

  // Add graph-expanded memories (slightly lower base score since indirect)
  for (const memory of graphExpandedMemories) {
    const item = memoryToRecallItem(memory, "graph-expanded", 0.5);
    // Add discovered entities to graph context
    item.graphContext = {
      connectedEntities: discoveredEntities,
      relationshipPath: "graph-traversal",
    };
    items.push(item);
  }

  // Add graph-expanded facts
  for (const fact of graphExpandedFacts) {
    const item = factToRecallItem(fact, "graph-expanded", 0.5);
    // Add discovered entities to graph context
    item.graphContext = {
      connectedEntities: [
        ...(fact.subject ? [fact.subject] : []),
        ...(fact.object ? [fact.object] : []),
        ...discoveredEntities,
      ],
      relationshipPath: "graph-traversal",
    };
    items.push(item);
  }

  return items;
}

/**
 * Deduplicate items that appear in multiple sources.
 *
 * When the same memory or fact is found via vector search AND graph expansion,
 * keep the one with the better source (primary over graph-expanded) and
 * merge the graph context.
 */
export function deduplicateResults(items: RecallItem[]): RecallItem[] {
  const seen = new Map<string, RecallItem>();

  for (const item of items) {
    const existing = seen.get(item.id);

    if (!existing) {
      seen.set(item.id, item);
      continue;
    }

    // If existing is from primary source, keep it but merge graph context
    if (
      existing.source !== "graph-expanded" &&
      item.source === "graph-expanded"
    ) {
      // Merge graph context from the graph-expanded version
      existing.graphContext = {
        connectedEntities: [
          ...(existing.graphContext?.connectedEntities || []),
          ...(item.graphContext?.connectedEntities || []),
        ],
        relationshipPath:
          existing.graphContext?.relationshipPath ||
          item.graphContext?.relationshipPath,
      };
      // Boost score since it was found in multiple sources
      existing.score = Math.min(1.0, existing.score * 1.1);
      continue;
    }

    // If new item is from primary source, replace
    if (
      item.source !== "graph-expanded" &&
      existing.source === "graph-expanded"
    ) {
      // Merge graph context from the existing graph-expanded version
      item.graphContext = {
        connectedEntities: [
          ...(item.graphContext?.connectedEntities || []),
          ...(existing.graphContext?.connectedEntities || []),
        ],
        relationshipPath:
          item.graphContext?.relationshipPath ||
          existing.graphContext?.relationshipPath,
      };
      item.score = Math.min(1.0, item.score * 1.1);
      seen.set(item.id, item);
      continue;
    }

    // Both from same priority level - keep higher score
    if (item.score > existing.score) {
      seen.set(item.id, item);
    }
  }

  return Array.from(seen.values());
}

/**
 * Calculate time decay score (0-1).
 * More recent items score higher.
 *
 * Uses exponential decay with half-life of 30 days.
 */
function calculateRecencyScore(timestamp: number): number {
  const now = Date.now();
  const ageMs = now - timestamp;
  const halfLifeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Exponential decay: score = 2^(-age/halfLife)
  return Math.pow(2, -ageMs / halfLifeMs);
}

/**
 * Calculate graph connectivity score (0-1).
 * Items connected to more entities score higher.
 */
function calculateConnectivityScore(connectedEntities: string[]): number {
  const count = connectedEntities.length;
  // Logarithmic scale with max at ~10 connections
  return Math.min(1.0, Math.log2(count + 1) / Math.log2(11));
}

/**
 * Rank items using a multi-signal scoring algorithm.
 *
 * Score = weighted sum of:
 * - Semantic similarity (from vector search)
 * - Confidence (for facts)
 * - Importance
 * - Recency (time decay)
 * - Graph connectivity
 *
 * Plus boosts for:
 * - Highly connected items (>3 entities)
 * - User messages (more likely to contain preferences)
 */
export function rankResults(items: RecallItem[]): RecallItem[] {
  const scoredItems = items.map((item) => {
    let score = 0;

    // Base semantic score (from source)
    const semanticScore = item.score || 0.5;
    score += semanticScore * RANKING_WEIGHTS.semantic;

    // Confidence score (facts only)
    if (item.type === "fact" && item.fact) {
      const confidenceScore = item.fact.confidence / 100;
      score += confidenceScore * RANKING_WEIGHTS.confidence;
    } else {
      // For memories, use a default confidence of 0.8
      score += 0.8 * RANKING_WEIGHTS.confidence;
    }

    // Importance score
    if (item.type === "memory" && item.memory) {
      const importanceScore = item.memory.importance / 100;
      score += importanceScore * RANKING_WEIGHTS.importance;
    } else if (item.type === "fact" && item.fact) {
      // Facts don't have importance, use confidence as proxy
      score += (item.fact.confidence / 100) * RANKING_WEIGHTS.importance;
    }

    // Recency score
    const timestamp =
      item.type === "memory"
        ? item.memory?.createdAt || Date.now()
        : item.fact?.createdAt || Date.now();
    const recencyScore = calculateRecencyScore(timestamp);
    score += recencyScore * RANKING_WEIGHTS.recency;

    // Graph connectivity score
    const connectedEntities = item.graphContext?.connectedEntities || [];
    const connectivityScore = calculateConnectivityScore(connectedEntities);
    score += connectivityScore * RANKING_WEIGHTS.graphConnectivity;

    // Boost for highly connected items
    if (connectedEntities.length > SCORE_BOOSTS.highlyConnectedThreshold) {
      score *= SCORE_BOOSTS.highlyConnected;
    }

    // Boost for user messages
    if (item.type === "memory" && item.memory?.messageRole === "user") {
      score *= SCORE_BOOSTS.userMessage;
    }

    // Clamp to [0, 1]
    item.score = Math.min(1.0, Math.max(0, score));
    return item;
  });

  // Sort by score descending
  return scoredItems.sort((a, b) => b.score - a.score);
}

/**
 * Generate LLM-ready context string from ranked items.
 *
 * Output format:
 * ```
 * ## Relevant Context
 *
 * ### Known Facts
 * - User prefers dark mode (confidence: 95%)
 * - User works at Acme Corp (confidence: 88%)
 *
 * ### Conversation History
 * [user]: I prefer dark mode
 * [agent]: I'll remember that!
 * ```
 */
export function formatForLLM(items: RecallItem[]): string {
  const facts = items.filter((i) => i.type === "fact");
  const memories = items.filter((i) => i.type === "memory");

  const sections: string[] = [];

  // Facts section
  if (facts.length > 0) {
    const factLines = facts.map((item) => {
      const confidence = item.fact?.confidence || 0;
      return `- ${item.content} (confidence: ${confidence}%)`;
    });
    sections.push(`### Known Facts\n${factLines.join("\n")}`);
  }

  // Memories/conversation section
  if (memories.length > 0) {
    const memoryLines = memories.map((item) => {
      const role = item.memory?.messageRole || "unknown";
      return `[${role}]: ${item.content}`;
    });
    sections.push(`### Conversation History\n${memoryLines.join("\n")}`);
  }

  if (sections.length === 0) {
    return "";
  }

  return `## Relevant Context\n\n${sections.join("\n\n")}`;
}

/**
 * Build source breakdown for RecallResult.
 */
export function buildSourceBreakdown(
  vectorMemories: MemoryEntry[],
  directFacts: FactRecord[],
  graphExpandedMemories: MemoryEntry[],
  graphExpandedFacts: FactRecord[],
  discoveredEntities: string[],
): RecallSourceBreakdown {
  return {
    vector: {
      count: vectorMemories.length,
      items: vectorMemories,
    },
    facts: {
      count: directFacts.length,
      items: directFacts,
    },
    graph: {
      count: graphExpandedMemories.length + graphExpandedFacts.length,
      expandedEntities: discoveredEntities,
    },
  };
}

/**
 * Enrich recall items with conversation data.
 *
 * Fetches full conversation and source messages for each memory item.
 */
export function enrichWithConversations(
  items: RecallItem[],
  conversationsMap: Map<string, Conversation>,
): RecallItem[] {
  return items.map((item) => {
    if (item.type !== "memory" || !item.memory?.conversationRef) {
      return item;
    }

    const convId = item.memory.conversationRef.conversationId;
    const conversation = conversationsMap.get(convId);

    if (!conversation) {
      return item;
    }

    // Extract source messages
    const sourceMessages = conversation.messages.filter((m: Message) =>
      item.memory!.conversationRef!.messageIds.includes(m.id),
    );

    return {
      ...item,
      conversation,
      sourceMessages,
    };
  });
}

/**
 * Full processing pipeline for recall results.
 *
 * 1. Merge results from all sources
 * 2. Deduplicate
 * 3. Rank
 * 4. Optionally format for LLM
 */
export function processRecallResults(
  vectorMemories: MemoryEntry[],
  directFacts: FactRecord[],
  graphExpandedMemories: MemoryEntry[],
  graphExpandedFacts: FactRecord[],
  discoveredEntities: string[],
  options: {
    limit?: number;
    formatForLLM?: boolean;
  } = {},
): {
  items: RecallItem[];
  sources: RecallSourceBreakdown;
  context?: string;
} {
  // Step 1: Merge
  const merged = mergeResults(
    vectorMemories,
    directFacts,
    graphExpandedMemories,
    graphExpandedFacts,
    discoveredEntities,
  );

  // Step 2: Deduplicate
  const deduped = deduplicateResults(merged);

  // Step 3: Rank
  const ranked = rankResults(deduped);

  // Step 4: Apply limit
  const limited = options.limit ? ranked.slice(0, options.limit) : ranked;

  // Step 5: Build source breakdown
  const sources = buildSourceBreakdown(
    vectorMemories,
    directFacts,
    graphExpandedMemories,
    graphExpandedFacts,
    discoveredEntities,
  );

  // Step 6: Format for LLM (if requested)
  const context =
    options.formatForLLM !== false ? formatForLLM(limited) : undefined;

  return {
    items: limited,
    sources,
    context,
  };
}
