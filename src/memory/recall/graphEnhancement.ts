/**
 * Graph Enhancement Utilities for recall() Orchestration
 *
 * These utilities leverage the graph database to discover related context
 * that wouldn't be found through direct vector/fact searches alone.
 *
 * The graph expansion strategy:
 * 1. Extract entities from initial search results
 * 2. Traverse graph relationships to discover connected entities
 * 3. Fetch additional memories/facts that mention discovered entities
 */

import type { GraphAdapter } from "../../graph/types";
import type { FactRecord, MemoryEntry } from "../../types";
import type { FactsAPI } from "../../facts";
import type { VectorAPI } from "../../vector";

/**
 * Configuration for graph expansion
 */
export interface GraphExpansionConfig {
  /** Maximum traversal depth. Default: 2 */
  maxDepth: number;
  /** Relationship types to follow. Empty = all types */
  relationshipTypes: string[];
  /** Expand from discovered facts */
  expandFromFacts: boolean;
  /** Expand from discovered memories */
  expandFromMemories: boolean;
}

/**
 * Result from graph expansion
 */
export interface GraphExpansionResult {
  /** Entities discovered through graph traversal */
  discoveredEntities: string[];
  /** Memories found via graph expansion */
  relatedMemories: MemoryEntry[];
  /** Facts found via graph expansion */
  relatedFacts: FactRecord[];
  /** IDs already processed (to avoid re-fetching) */
  processedIds: Set<string>;
}

/**
 * Extract entity names from memories and facts.
 *
 * Entities are found in:
 * - Fact subjects and objects
 * - Memory content (mentioned entities)
 * - Fact entity arrays (enriched extraction)
 */
export function extractEntitiesFromResults(
  memories: MemoryEntry[],
  facts: FactRecord[],
): string[] {
  const entities = new Set<string>();

  // Extract from facts (primary source of structured entities)
  for (const fact of facts) {
    if (fact.subject) {
      entities.add(fact.subject);
    }
    if (fact.object) {
      entities.add(fact.object);
    }

    // Extract from enriched entities array
    if (fact.entities) {
      for (const entity of fact.entities) {
        entities.add(entity.name);
      }
    }
  }

  // Extract from memories (user/agent mentions)
  for (const memory of memories) {
    // Check for userId as an entity
    if (memory.userId) {
      entities.add(memory.userId);
    }

    // Extract enriched content entities if available
    if (memory.factCategory) {
      entities.add(memory.factCategory);
    }
  }

  return Array.from(entities).filter(
    (e) => e && e.trim().length > 0 && e.length < 100,
  );
}

/**
 * Extract potential entity names from a query string by looking them up
 * in the graph database.
 *
 * This enables graph expansion even when initial search results don't
 * contain facts with entities. The query text is tokenized and each
 * significant word/phrase is checked against Entity nodes in the graph.
 *
 * Strategy:
 * 1. Tokenize query into words and n-grams (2-3 word phrases)
 * 2. Query the graph for Entity nodes matching each candidate
 * 3. Return matched entity names for graph traversal
 */
export async function extractEntitiesFromQuery(
  query: string,
  graphAdapter: GraphAdapter | undefined,
): Promise<string[]> {
  if (!graphAdapter || !query || query.trim().length === 0) {
    return [];
  }

  try {
    // Check if graph is connected
    const isConnected = await graphAdapter.isConnected();
    if (!isConnected) {
      return [];
    }

    const matchedEntities: string[] = [];

    // Tokenize query: split on spaces and common punctuation
    const words = query
      .toLowerCase()
      .replace(/[^\w\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2); // Skip very short words

    // Generate candidate phrases: single words and n-grams
    const candidates = new Set<string>();

    // Add individual words (capitalized - common for names)
    for (const word of words) {
      // Capitalize first letter (entity names are often proper nouns)
      const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      candidates.add(capitalized);
      candidates.add(word); // Also try lowercase
    }

    // Add 2-word phrases (for names like "Planet Granite", "Sarah Chen")
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words
        .slice(i, i + 2)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      candidates.add(phrase);
    }

    // Add 3-word phrases (for longer entity names)
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words
        .slice(i, i + 3)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      candidates.add(phrase);
    }

    // Query graph for each candidate (limit to avoid performance issues)
    const candidateArray = Array.from(candidates).slice(0, 20);

    for (const candidate of candidateArray) {
      try {
        // Look for exact match on entity name
        const entityNodes = await graphAdapter.findNodes(
          "Entity",
          { name: candidate },
          1,
        );

        if (entityNodes.length > 0) {
          matchedEntities.push(candidate);
        }
      } catch {
        // Individual lookup failure - continue with others
        continue;
      }
    }

    return matchedEntities;
  } catch {
    // Query entity extraction failed - return empty (graceful degradation)
    return [];
  }
}

/**
 * Discover connected entities via graph traversal.
 *
 * Uses the GraphAdapter's traverse() method to find entities
 * connected to the initial set within the specified depth.
 */
export async function expandViaGraph(
  initialEntities: string[],
  graphAdapter: GraphAdapter,
  config: GraphExpansionConfig,
): Promise<string[]> {
  if (!graphAdapter || initialEntities.length === 0) {
    return [];
  }

  const discoveredEntities = new Set<string>();

  try {
    // Check if graph is connected
    const isConnected = await graphAdapter.isConnected();
    if (!isConnected) {
      return [];
    }

    // For each initial entity, traverse the graph
    for (const entityName of initialEntities.slice(0, 10)) {
      // Limit to first 10 to avoid performance issues
      try {
        // Find the entity node
        const entityNodes = await graphAdapter.findNodes(
          "Entity",
          { name: entityName },
          1,
        );

        if (entityNodes.length === 0) {
          continue;
        }

        const entityNode = entityNodes[0];
        if (!entityNode.id) {
          continue;
        }

        // Traverse from this entity
        const connectedNodes = await graphAdapter.traverse({
          startId: entityNode.id,
          maxDepth: config.maxDepth,
          relationshipTypes:
            config.relationshipTypes.length > 0
              ? config.relationshipTypes
              : undefined,
          direction: "BOTH",
        });

        // Extract entity names from connected nodes
        for (const node of connectedNodes) {
          if (node.label === "Entity" && node.properties?.name) {
            discoveredEntities.add(node.properties.name as string);
          }
        }
      } catch {
        // Individual entity traversal failure - continue with others
        continue;
      }
    }

    // Remove initial entities from discovered (we already have those)
    for (const initial of initialEntities) {
      discoveredEntities.delete(initial);
    }

    return Array.from(discoveredEntities);
  } catch {
    // Graph expansion failed - return empty (graceful degradation)
    return [];
  }
}

/**
 * Fetch memories that reference discovered entities.
 *
 * Searches for memories where:
 * - The content mentions any of the discovered entities
 * - The memory is linked to facts about those entities
 */
export async function fetchRelatedMemories(
  discoveredEntities: string[],
  memorySpaceId: string,
  vectorAPI: VectorAPI,
  processedIds: Set<string>,
  limit: number = 10,
): Promise<MemoryEntry[]> {
  if (discoveredEntities.length === 0) {
    return [];
  }

  const relatedMemories: MemoryEntry[] = [];

  try {
    // Search for each entity (limit to top 5 entities to avoid too many queries)
    for (const entity of discoveredEntities.slice(0, 5)) {
      try {
        // Use text search to find memories mentioning this entity
        const memories = await vectorAPI.search(memorySpaceId, entity, {
          limit: Math.ceil(limit / 5), // Distribute limit across entities
          minScore: 0.5, // Reasonable relevance threshold
        });

        for (const memory of memories) {
          // Skip if already processed
          if (processedIds.has(memory.memoryId)) {
            continue;
          }

          relatedMemories.push(memory);
          processedIds.add(memory.memoryId);

          // Stop if we've reached the limit
          if (relatedMemories.length >= limit) {
            break;
          }
        }

        if (relatedMemories.length >= limit) {
          break;
        }
      } catch {
        // Individual search failure - continue with others
        continue;
      }
    }

    return relatedMemories;
  } catch {
    // Memory fetch failed - return empty (graceful degradation)
    return [];
  }
}

/**
 * Fetch facts that reference discovered entities.
 *
 * Searches for facts where:
 * - The subject or object matches discovered entities
 * - The fact mentions the entity in its content
 */
export async function fetchRelatedFacts(
  discoveredEntities: string[],
  memorySpaceId: string,
  factsAPI: FactsAPI,
  processedIds: Set<string>,
  limit: number = 10,
): Promise<FactRecord[]> {
  if (discoveredEntities.length === 0) {
    return [];
  }

  const relatedFacts: FactRecord[] = [];

  try {
    // Query facts for each entity
    for (const entity of discoveredEntities.slice(0, 5)) {
      try {
        // Query facts where entity is the subject
        const subjectFacts = await factsAPI.queryBySubject({
          memorySpaceId,
          subject: entity,
          limit: Math.ceil(limit / 10),
        });

        for (const fact of subjectFacts) {
          if (processedIds.has(fact.factId)) {
            continue;
          }
          relatedFacts.push(fact);
          processedIds.add(fact.factId);
        }

        // Also search facts by text to catch mentions in object/content
        const searchFacts = await factsAPI.search(memorySpaceId, entity, {
          limit: Math.ceil(limit / 10),
        });

        for (const fact of searchFacts) {
          if (processedIds.has(fact.factId)) {
            continue;
          }
          relatedFacts.push(fact);
          processedIds.add(fact.factId);
        }

        if (relatedFacts.length >= limit) {
          break;
        }
      } catch {
        // Individual query failure - continue with others
        continue;
      }
    }

    return relatedFacts.slice(0, limit);
  } catch {
    // Facts fetch failed - return empty (graceful degradation)
    return [];
  }
}

/**
 * Full graph expansion pipeline.
 *
 * 1. Extract entities from query text (NEW: enables expansion without facts)
 * 2. Extract entities from initial search results
 * 3. Combine and traverse graph to discover connected entities
 * 4. Fetch related memories and facts
 *
 * @param initialMemories - Memories from initial vector search
 * @param initialFacts - Facts from initial facts search
 * @param memorySpaceId - The memory space to search
 * @param graphAdapter - Graph database adapter
 * @param vectorAPI - Vector search API
 * @param factsAPI - Facts search API
 * @param config - Expansion configuration
 * @param queryText - Optional query text for entity extraction (NEW)
 */
export async function performGraphExpansion(
  initialMemories: MemoryEntry[],
  initialFacts: FactRecord[],
  memorySpaceId: string,
  graphAdapter: GraphAdapter | undefined,
  vectorAPI: VectorAPI,
  factsAPI: FactsAPI,
  config: GraphExpansionConfig,
  queryText?: string,
): Promise<GraphExpansionResult> {
  const processedIds = new Set<string>();

  // Track initial IDs to avoid re-fetching
  for (const memory of initialMemories) {
    processedIds.add(memory.memoryId);
  }
  for (const fact of initialFacts) {
    processedIds.add(fact.factId);
  }

  // If no graph adapter or expansion disabled, return empty result
  if (!graphAdapter || !config.expandFromFacts || !config.expandFromMemories) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds,
    };
  }

  // Step 1: Extract entities from QUERY TEXT (NEW - enables expansion without facts)
  // This allows graph expansion even when initial search results don't contain facts
  const queryEntities = queryText
    ? await extractEntitiesFromQuery(queryText, graphAdapter)
    : [];

  // Step 2: Extract entities from initial results (existing behavior)
  const resultEntities = extractEntitiesFromResults(
    initialMemories,
    initialFacts,
  );

  // Step 3: Combine all entities (deduplicated)
  const allEntities = Array.from(
    new Set([...queryEntities, ...resultEntities]),
  );

  if (allEntities.length === 0) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds,
    };
  }

  // Step 4: Expand via graph traversal
  const discoveredEntities = await expandViaGraph(
    allEntities,
    graphAdapter,
    config,
  );

  // Even if no NEW entities discovered, if we have initial entities from query,
  // we should still fetch related content for those entities
  const entitiesToFetch =
    discoveredEntities.length > 0 ? discoveredEntities : allEntities;

  if (entitiesToFetch.length === 0) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds,
    };
  }

  // Step 5: Fetch related data in parallel
  const [relatedMemories, relatedFacts] = await Promise.all([
    config.expandFromMemories
      ? fetchRelatedMemories(
          entitiesToFetch,
          memorySpaceId,
          vectorAPI,
          processedIds,
          10,
        )
      : Promise.resolve([]),
    config.expandFromFacts
      ? fetchRelatedFacts(
          entitiesToFetch,
          memorySpaceId,
          factsAPI,
          processedIds,
          10,
        )
      : Promise.resolve([]),
  ]);

  return {
    discoveredEntities: entitiesToFetch,
    relatedMemories,
    relatedFacts,
    processedIds,
  };
}
