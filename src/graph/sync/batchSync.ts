/**
 * Graph Batch Sync
 *
 * Functions for initial bulk sync of Cortex data to graph database
 */

/* eslint-disable no-console */
// Console logging is intentional for batch sync progress tracking

import type { Cortex } from "../..";
import type { GraphAdapter } from "../types";
import {
  syncContextToGraph,
  syncConversationToGraph,
  syncMemoryToGraph,
  syncFactToGraph,
  syncMemorySpaceToGraph,
} from "./syncUtils";
import {
  syncContextRelationships,
  syncConversationRelationships,
  syncMemoryRelationships,
  syncFactRelationships,
  syncA2ARelationships,
} from "./syncRelationships";

export interface BatchSyncOptions {
  /** Maximum records to sync per entity type */
  limits?: {
    memorySpaces?: number;
    contexts?: number;
    conversations?: number;
    memories?: number;
    facts?: number;
  };

  /** Whether to sync relationships (default: true) */
  syncRelationships?: boolean;

  /** Progress callback */
  onProgress?: (entity: string, current: number, total: number) => void;
}

export interface BatchSyncResult {
  memorySpaces: { synced: number; failed: number };
  contexts: { synced: number; failed: number };
  conversations: { synced: number; failed: number };
  memories: { synced: number; failed: number };
  facts: { synced: number; failed: number };
  errors: Array<{ entity: string; id: string; error: string }>;
  duration: number;
}

/**
 * Perform initial graph sync from Cortex
 *
 * Syncs all existing Cortex data to the graph database.
 * This should be run once after setting up a new graph database.
 *
 * @example
 * ```typescript
 * const adapter = new CypherGraphAdapter();
 * await adapter.connect({ uri: 'bolt://localhost:7687', username: 'neo4j', password: 'password' });
 *
 * const result = await initialGraphSync(cortex, adapter, {
 *   onProgress: (entity, current, total) => {
 *     console.log(`Syncing ${entity}: ${current}/${total}`);
 *   }
 * });
 *
 * console.log('Sync complete:', result);
 * ```
 */
export async function initialGraphSync(
  cortex: Cortex,
  adapter: GraphAdapter,
  options: BatchSyncOptions = {},
): Promise<BatchSyncResult> {
  const startTime = Date.now();
  const result: BatchSyncResult = {
    memorySpaces: { synced: 0, failed: 0 },
    contexts: { synced: 0, failed: 0 },
    conversations: { synced: 0, failed: 0 },
    memories: { synced: 0, failed: 0 },
    facts: { synced: 0, failed: 0 },
    errors: [],
    duration: 0,
  };

  const syncRels = options.syncRelationships !== false;

  try {
    // Phase 1: Sync Memory Spaces
    console.log("📦 Phase 1: Syncing Memory Spaces...");
    const memorySpacesResult = await syncMemorySpaces(
      cortex,
      adapter,
      options.limits?.memorySpaces,
      options.onProgress,
    );
    result.memorySpaces = memorySpacesResult;

    // Phase 2: Sync Contexts
    console.log("📦 Phase 2: Syncing Contexts...");
    const contextsResult = await syncContexts(
      cortex,
      adapter,
      syncRels,
      options.limits?.contexts,
      options.onProgress,
    );
    result.contexts = contextsResult.stats;
    result.errors.push(...contextsResult.errors);

    // Phase 3: Sync Conversations
    console.log("📦 Phase 3: Syncing Conversations...");
    const conversationsResult = await syncConversations(
      cortex,
      adapter,
      syncRels,
      options.limits?.conversations,
      options.onProgress,
    );
    result.conversations = conversationsResult.stats;
    result.errors.push(...conversationsResult.errors);

    // Phase 4: Sync Memories
    console.log("📦 Phase 4: Syncing Memories...");
    const memoriesResult = await syncMemories(
      cortex,
      adapter,
      syncRels,
      options.limits?.memories,
      options.onProgress,
    );
    result.memories = memoriesResult.stats;
    result.errors.push(...memoriesResult.errors);

    // Phase 5: Sync Facts
    console.log("📦 Phase 5: Syncing Facts...");
    const factsResult = await syncFacts(
      cortex,
      adapter,
      syncRels,
      options.limits?.facts,
      options.onProgress,
    );
    result.facts = factsResult.stats;
    result.errors.push(...factsResult.errors);

    console.log("✅ Initial graph sync complete!");
  } catch (error) {
    console.error("❌ Batch sync failed:", error);
    throw error;
  }

  result.duration = Date.now() - startTime;
  return result;
}

// ============================================================================
// Internal Sync Functions
// ============================================================================

async function syncMemorySpaces(
  cortex: Cortex,
  adapter: GraphAdapter,
  limit: number = 10000,
  onProgress?: (entity: string, current: number, total: number) => void,
): Promise<{ synced: number; failed: number }> {
  const stats = { synced: 0, failed: 0 };

  try {
    // List all memory spaces
    const memorySpaces = await cortex.memorySpaces.list({ limit });

    for (let i = 0; i < memorySpaces.length; i++) {
      const memorySpace = memorySpaces[i];

      try {
        await syncMemorySpaceToGraph(memorySpace, adapter);
        stats.synced++;

        if (onProgress) {
          onProgress("MemorySpaces", i + 1, memorySpaces.length);
        }
      } catch (error) {
        stats.failed++;
        console.error(
          `Failed to sync memory space ${memorySpace.memorySpaceId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Failed to list memory spaces:", error);
  }

  return stats;
}

async function syncContexts(
  cortex: Cortex,
  adapter: GraphAdapter,
  syncRels: boolean,
  limit: number = 10000,
  onProgress?: (entity: string, current: number, total: number) => void,
): Promise<{
  stats: { synced: number; failed: number };
  errors: Array<{ entity: string; id: string; error: string }>;
}> {
  const stats = { synced: 0, failed: 0 };
  const errors: Array<{ entity: string; id: string; error: string }> = [];

  try {
    // List all contexts
    const contexts = await cortex.contexts.list({ limit });

    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];

      try {
        // Sync node
        const nodeId = await syncContextToGraph(context, adapter);
        stats.synced++;

        // Sync relationships
        if (syncRels) {
          await syncContextRelationships(context, nodeId, adapter);
        }

        if (onProgress) {
          onProgress("Contexts", i + 1, contexts.length);
        }
      } catch (error) {
        stats.failed++;
        errors.push({
          entity: "Context",
          id: context.contextId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    console.error("Failed to list contexts:", error);
  }

  return { stats, errors };
}

async function syncConversations(
  cortex: Cortex,
  adapter: GraphAdapter,
  syncRels: boolean,
  limit: number = 10000,
  onProgress?: (entity: string, current: number, total: number) => void,
): Promise<{
  stats: { synced: number; failed: number };
  errors: Array<{ entity: string; id: string; error: string }>;
}> {
  const stats = { synced: 0, failed: 0 };
  const errors: Array<{ entity: string; id: string; error: string }> = [];

  try {
    // List all conversations
    const conversations = await cortex.conversations.list({ limit });

    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];

      try {
        // Sync node
        const nodeId = await syncConversationToGraph(conversation, adapter);
        stats.synced++;

        // Sync relationships
        if (syncRels) {
          await syncConversationRelationships(conversation, nodeId, adapter);
        }

        if (onProgress) {
          onProgress("Conversations", i + 1, conversations.length);
        }
      } catch (error) {
        stats.failed++;
        errors.push({
          entity: "Conversation",
          id: conversation.conversationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    console.error("Failed to list conversations:", error);
  }

  return { stats, errors };
}

async function syncMemories(
  cortex: Cortex,
  adapter: GraphAdapter,
  syncRels: boolean,
  limit: number = 10000,
  onProgress?: (entity: string, current: number, total: number) => void,
): Promise<{
  stats: { synced: number; failed: number };
  errors: Array<{ entity: string; id: string; error: string }>;
}> {
  const stats = { synced: 0, failed: 0 };
  const errors: Array<{ entity: string; id: string; error: string }> = [];

  try {
    // We need to get memories from each memory space
    // First, get all memory spaces
    const memorySpaces = await cortex.memorySpaces.list({ limit: 1000 });

    let processedCount = 0;

    for (const memorySpace of memorySpaces) {
      try {
        // List memories for this memory space
        const memories = await cortex.vector.list({
          memorySpaceId: memorySpace.memorySpaceId,
          limit: Math.floor(limit / memorySpaces.length), // Distribute limit across spaces
        });

        for (const memory of memories) {
          if (processedCount >= limit) break;

          try {
            // Sync node
            const nodeId = await syncMemoryToGraph(memory, adapter);
            stats.synced++;

            // Sync relationships
            if (syncRels) {
              await syncMemoryRelationships(memory, nodeId, adapter);

              // Check for A2A relationships
              if (memory.sourceType === "a2a") {
                await syncA2ARelationships(memory, adapter);
              }
            }

            processedCount++;

            if (onProgress) {
              onProgress("Memories", processedCount, limit);
            }
          } catch (error) {
            stats.failed++;
            errors.push({
              entity: "Memory",
              id: memory.memoryId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        console.error(
          `Failed to list memories for space ${memorySpace.memorySpaceId}:`,
          error,
        );
      }

      if (processedCount >= limit) break;
    }
  } catch (error) {
    console.error("Failed to sync memories:", error);
  }

  return { stats, errors };
}

async function syncFacts(
  cortex: Cortex,
  adapter: GraphAdapter,
  syncRels: boolean,
  limit: number = 10000,
  onProgress?: (entity: string, current: number, total: number) => void,
): Promise<{
  stats: { synced: number; failed: number };
  errors: Array<{ entity: string; id: string; error: string }>;
}> {
  const stats = { synced: 0, failed: 0 };
  const errors: Array<{ entity: string; id: string; error: string }> = [];

  try {
    // Get all memory spaces to list facts
    const memorySpaces = await cortex.memorySpaces.list({ limit: 1000 });

    let processedCount = 0;

    for (const memorySpace of memorySpaces) {
      try {
        // List facts for this memory space
        const facts = await cortex.facts.list({
          memorySpaceId: memorySpace.memorySpaceId,
          limit: Math.floor(limit / memorySpaces.length),
        });

        for (const fact of facts) {
          if (processedCount >= limit) break;

          try {
            // Sync node
            const nodeId = await syncFactToGraph(fact, adapter);
            stats.synced++;

            // Sync relationships
            if (syncRels) {
              await syncFactRelationships(fact, nodeId, adapter);
            }

            processedCount++;

            if (onProgress) {
              onProgress("Facts", processedCount, limit);
            }
          } catch (error) {
            stats.failed++;
            errors.push({
              entity: "Fact",
              id: fact.factId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        console.error(
          `Failed to list facts for space ${memorySpace.memorySpaceId}:`,
          error,
        );
      }

      if (processedCount >= limit) break;
    }
  } catch (error) {
    console.error("Failed to sync facts:", error);
  }

  return { stats, errors };
}
