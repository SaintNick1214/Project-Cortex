/**
 * Cortex SDK - Vector Memory API
 *
 * Layer 2: Searchable agent-private memories with embeddings
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  CountMemoriesFilter,
  DeleteMemoryOptions,
  ListMemoriesFilter,
  MemoryEntry,
  SearchMemoriesOptions,
  StoreMemoryInput,
  StoreMemoryOptions,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import {
  syncMemoryToGraph,
  syncMemoryRelationships,
  deleteMemoryFromGraph,
} from "../graph";
import {
  validateMemorySpaceId,
  validateMemoryId,
  validateStoreInput,
  validateSearchOptions,
  validateListFilter,
  validateCountFilter,
  validateUpdateInput,
  validateVersion,
  validateTimestamp,
  validateExportOptions,
  validateDeleteManyFilter,
  validateUpdateManyInputs,
} from "./validators";
import type { ResilienceLayer } from "../resilience";

export class VectorAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
    private readonly resilience?: ResilienceLayer,
  ) {}

  /**
   * Execute an operation through the resilience layer (if available)
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }

  /**
   * Handle ConvexError from direct Convex calls
   */
  private handleConvexError(error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "data" in error &&
      (error as { data: unknown }).data !== undefined
    ) {
      const convexError = error as { data: unknown };
      const errorData =
        typeof convexError.data === "string"
          ? convexError.data
          : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }

  /**
   * Store a vector memory
   *
   * @example
   * ```typescript
   * const memory = await cortex.vector.store('agent-1', {
   *   content: 'User prefers dark mode',
   *   contentType: 'raw',
   *   embedding: await embed('User prefers dark mode'),
   *   source: { type: 'conversation', userId: 'user-123' },
   *   metadata: { importance: 70, tags: ['preferences'] },
   * });
   *
   * // With graph sync
   * const memory = await cortex.vector.store('agent-1', data, {
   *   syncToGraph: true
   * });
   * ```
   */
  async store(
    memorySpaceId: string,
    input: StoreMemoryInput,
    options?: StoreMemoryOptions,
  ): Promise<MemoryEntry> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateStoreInput(input);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memories.store, {
          memorySpaceId,
          participantId: input.participantId, // NEW: Hive Mode
          content: input.content,
          contentType: input.contentType,
          embedding: input.embedding,
          sourceType: input.source.type,
          sourceUserId: input.source.userId,
          sourceUserName: input.source.userName,
          userId: input.userId,
          agentId: input.agentId, // NEW: Agent-owned memories support
          messageRole: input.messageRole, // NEW: For semantic search weighting
          conversationRef: input.conversationRef,
          immutableRef: input.immutableRef,
          mutableRef: input.mutableRef,
          importance: input.metadata.importance,
          tags: input.metadata.tags,
        }),
      "vector:store",
    );

    // Sync to graph if requested and configured
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        const nodeId = await syncMemoryToGraph(
          result as MemoryEntry,
          this.graphAdapter,
        );
        await syncMemoryRelationships(
          result as MemoryEntry,
          nodeId,
          this.graphAdapter,
        );
      } catch (error) {
        // Log but don't fail - graph sync is non-critical
        console.warn("Failed to sync memory to graph:", error);
      }
    }

    return result as MemoryEntry;
  }

  /**
   * Get memory by ID
   *
   * @example
   * ```typescript
   * const memory = await cortex.vector.get('agent-1', 'mem-abc123');
   * ```
   */
  async get(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<MemoryEntry | null> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.get, {
          memorySpaceId,
          memoryId,
        }),
      "vector:get",
    );

    return result as MemoryEntry | null;
  }

  /**
   * Search memories (semantic with embeddings or keyword without)
   *
   * @example
   * ```typescript
   * const results = await cortex.vector.search('agent-1', 'user preferences', {
   *   embedding: await embed('user preferences'),
   *   limit: 10,
   * });
   * ```
   */
  async search(
    memorySpaceId: string,
    query: string,
    options?: SearchMemoriesOptions,
  ): Promise<MemoryEntry[]> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateSearchOptions(options);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.search, {
          memorySpaceId,
          query,
          embedding: options?.embedding,
          userId: options?.userId,
          tags: options?.tags,
          sourceType: options?.sourceType,
          minImportance: options?.minImportance,
          minScore: options?.minScore, // FIX: Forward minScore parameter
          limit: options?.limit,
        }),
      "vector:search",
    );

    return result as MemoryEntry[];
  }

  /**
   * Delete a memory
   *
   * @example
   * ```typescript
   * await cortex.vector.delete('agent-1', 'mem-abc123');
   *
   * // With graph sync and orphan cleanup
   * await cortex.vector.delete('agent-1', 'mem-abc123', {
   *   syncToGraph: true
   * });
   * ```
   */
  async delete(
    memorySpaceId: string,
    memoryId: string,
    options?: DeleteMemoryOptions,
  ): Promise<{ deleted: boolean; memoryId: string }> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);

    let result;
    try {
      result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.memories.deleteMemory, {
            memorySpaceId,
            memoryId,
          }),
        "vector:delete",
      );
    } catch (error) {
      this.handleConvexError(error);
    }

    // Delete from graph with orphan cleanup
    if (options?.syncToGraph && this.graphAdapter) {
      try {
        await deleteMemoryFromGraph(memoryId, this.graphAdapter, true);
      } catch (error) {
        console.warn("Failed to delete memory from graph:", error);
      }
    }

    return result as { deleted: boolean; memoryId: string };
  }

  /**
   * List memories with filters
   *
   * @example
   * ```typescript
   * const memories = await cortex.vector.list({
   *   agentId: 'agent-1',
   *   userId: 'user-123',
   *   limit: 50,
   * });
   * ```
   */
  async list(filter: ListMemoriesFilter): Promise<MemoryEntry[]> {
    // Client-side validation
    validateListFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.list, {
          memorySpaceId: filter.memorySpaceId,
          userId: filter.userId,
          sourceType: filter.sourceType,
          limit: filter.limit,
        }),
      "vector:list",
    );

    return result as MemoryEntry[];
  }

  /**
   * Count memories
   *
   * @example
   * ```typescript
   * const count = await cortex.vector.count({
   *   agentId: 'agent-1',
   *   userId: 'user-123',
   * });
   * ```
   */
  async count(filter: CountMemoriesFilter): Promise<number> {
    // Client-side validation
    validateCountFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.count, {
          memorySpaceId: filter.memorySpaceId,
          userId: filter.userId,
          sourceType: filter.sourceType,
        }),
      "vector:count",
    );

    return result;
  }

  /**
   * Update a memory (creates new version)
   *
   * @example
   * ```typescript
   * await cortex.vector.update('agent-1', 'mem-123', {
   *   content: 'Updated content',
   *   importance: 90,
   * });
   * ```
   */
  async update(
    memorySpaceId: string,
    memoryId: string,
    updates: {
      content?: string;
      embedding?: number[];
      importance?: number;
      tags?: string[];
    },
  ): Promise<MemoryEntry> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    validateUpdateInput(updates);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memories.update, {
          memorySpaceId,
          memoryId,
          content: updates.content,
          embedding: updates.embedding,
          importance: updates.importance,
          tags: updates.tags,
        }),
      "vector:update",
    );

    return result as MemoryEntry;
  }

  /**
   * Get specific version of a memory
   *
   * @example
   * ```typescript
   * const v1 = await cortex.vector.getVersion('agent-1', 'mem-123', 1);
   * ```
   */
  async getVersion(
    memorySpaceId: string,
    memoryId: string,
    version: number,
  ): Promise<{
    memoryId: string;
    version: number;
    content: string;
    embedding?: number[];
    timestamp: number;
  } | null> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    validateVersion(version);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.getVersion, {
          memorySpaceId,
          memoryId,
          version,
        }),
      "vector:getVersion",
    );

    return result as {
      memoryId: string;
      version: number;
      content: string;
      embedding?: number[];
      timestamp: number;
    } | null;
  }

  /**
   * Get version history for a memory
   *
   * @example
   * ```typescript
   * const history = await cortex.vector.getHistory('agent-1', 'mem-123');
   * ```
   */
  async getHistory(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<
    Array<{
      memoryId: string;
      version: number;
      content: string;
      embedding?: number[];
      timestamp: number;
    }>
  > {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.getHistory, {
          memorySpaceId,
          memoryId,
        }),
      "vector:getHistory",
    );

    return result as Array<{
      memoryId: string;
      version: number;
      content: string;
      embedding?: number[];
      timestamp: number;
    }>;
  }

  /**
   * Delete many memories matching filters
   *
   * @example
   * ```typescript
   * await cortex.vector.deleteMany({
   *   agentId: 'agent-1',
   *   sourceType: 'system',
   * });
   * ```
   */
  async deleteMany(filter: {
    memorySpaceId: string;
    userId?: string;
    sourceType?: "conversation" | "system" | "tool" | "a2a";
  }): Promise<{ deleted: number; memoryIds: string[] }> {
    // Client-side validation
    validateDeleteManyFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memories.deleteMany, {
          memorySpaceId: filter.memorySpaceId,
          userId: filter.userId,
          sourceType: filter.sourceType,
        }),
      "vector:deleteMany",
    );

    return result as { deleted: number; memoryIds: string[] };
  }

  /**
   * Export memories to JSON or CSV
   *
   * @example
   * ```typescript
   * const exported = await cortex.vector.export({
   *   agentId: 'agent-1',
   *   format: 'json',
   * });
   * ```
   */
  async export(options: {
    memorySpaceId: string;
    userId?: string;
    format: "json" | "csv";
    includeEmbeddings?: boolean;
  }): Promise<{
    format: string;
    data: string;
    count: number;
    exportedAt: number;
  }> {
    // Client-side validation
    validateExportOptions(options);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.exportMemories, {
          memorySpaceId: options.memorySpaceId,
          userId: options.userId,
          format: options.format,
          includeEmbeddings: options.includeEmbeddings,
        }),
      "vector:export",
    );

    return result as {
      format: string;
      data: string;
      count: number;
      exportedAt: number;
    };
  }

  /**
   * Update many memories matching filters
   *
   * @example
   * ```typescript
   * await cortex.vector.updateMany({
   *   agentId: 'agent-1',
   *   sourceType: 'system',
   * }, {
   *   importance: 20,
   * });
   * ```
   */
  async updateMany(
    filter: {
      memorySpaceId: string;
      userId?: string;
      sourceType?: "conversation" | "system" | "tool" | "a2a";
    },
    updates: {
      importance?: number;
      tags?: string[];
    },
  ): Promise<{ updated: number; memoryIds: string[] }> {
    // Client-side validation
    validateUpdateManyInputs(filter, updates);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memories.updateMany, {
          memorySpaceId: filter.memorySpaceId,
          userId: filter.userId,
          sourceType: filter.sourceType,
          importance: updates.importance,
          tags: updates.tags,
        }),
      "vector:updateMany",
    );

    return result as { updated: number; memoryIds: string[] };
  }

  /**
   * Archive a memory (soft delete)
   *
   * @example
   * ```typescript
   * await cortex.vector.archive('agent-1', 'mem-123');
   * ```
   */
  async archive(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<{ archived: boolean; memoryId: string; restorable: boolean }> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.memories.archive, {
          memorySpaceId,
          memoryId,
        }),
      "vector:archive",
    );

    return result as {
      archived: boolean;
      memoryId: string;
      restorable: boolean;
    };
  }

  /**
   * Get version at specific timestamp
   *
   * @example
   * ```typescript
   * const memory = await cortex.vector.getAtTimestamp('agent-1', 'mem-123', Date.parse('2025-01-01'));
   * ```
   */
  async getAtTimestamp(
    memorySpaceId: string,
    memoryId: string,
    timestamp: number | Date,
  ): Promise<{
    memoryId: string;
    version: number;
    content: string;
    embedding?: number[];
    timestamp: number;
  } | null> {
    // Client-side validation
    validateMemorySpaceId(memorySpaceId);
    validateMemoryId(memoryId);
    validateTimestamp(timestamp);

    const ts = typeof timestamp === "number" ? timestamp : timestamp.getTime();

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.memories.getAtTimestamp, {
          memorySpaceId,
          memoryId,
          timestamp: ts,
        }),
      "vector:getAtTimestamp",
    );

    return result as {
      memoryId: string;
      version: number;
      content: string;
      embedding?: number[];
      timestamp: number;
    } | null;
  }
}

// Export validation error for users who want to catch it specifically
export { VectorValidationError } from "./validators";
