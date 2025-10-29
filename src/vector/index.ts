/**
 * Cortex SDK - Vector Memory API
 *
 * Layer 2: Searchable agent-private memories with embeddings
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  CountMemoriesFilter,
  ListMemoriesFilter,
  MemoryEntry,
  SearchMemoriesOptions,
  StoreMemoryInput,
} from "../types";

export class VectorAPI {
  constructor(private readonly client: ConvexClient) {}

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
   * ```
   */
  async store(memorySpaceId: string, input: StoreMemoryInput): Promise<MemoryEntry> {
    const result = await this.client.mutation(api.memories.store, {
      memorySpaceId,
      content: input.content,
      contentType: input.contentType,
      embedding: input.embedding,
      sourceType: input.source.type,
      sourceUserId: input.source.userId,
      sourceUserName: input.source.userName,
      userId: input.userId,
      conversationRef: input.conversationRef,
      immutableRef: input.immutableRef,
      mutableRef: input.mutableRef,
      importance: input.metadata.importance,
      tags: input.metadata.tags,
    });

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
  async get(memorySpaceId: string, memoryId: string): Promise<MemoryEntry | null> {
    const result = await this.client.query(api.memories.get, {
      memorySpaceId,
      memoryId,
    });

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
    const result = await this.client.query(api.memories.search, {
      memorySpaceId,
      query,
      embedding: options?.embedding,
      userId: options?.userId,
      tags: options?.tags,
      sourceType: options?.sourceType,
      minImportance: options?.minImportance,
      limit: options?.limit,
    });

    return result as MemoryEntry[];
  }

  /**
   * Delete a memory
   *
   * @example
   * ```typescript
   * await cortex.vector.delete('agent-1', 'mem-abc123');
   * ```
   */
  async delete(
    memorySpaceId: string,
    memoryId: string,
  ): Promise<{ deleted: boolean; memoryId: string }> {
    const result = await this.client.mutation(api.memories.deleteMemory, {
      memorySpaceId,
      memoryId,
    });

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
    const result = await this.client.query(api.memories.list, {
      memorySpaceId: filter.memorySpaceId,
      userId: filter.userId,
      sourceType: filter.sourceType,
      limit: filter.limit,
    });

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
    const result = await this.client.query(api.memories.count, {
      memorySpaceId: filter.memorySpaceId,
      userId: filter.userId,
      sourceType: filter.sourceType,
    });

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
    const result = await this.client.mutation(api.memories.update, {
      memorySpaceId,
      memoryId,
      content: updates.content,
      embedding: updates.embedding,
      importance: updates.importance,
      tags: updates.tags,
    });

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
    const result = await this.client.query(api.memories.getVersion, {
      memorySpaceId,
      memoryId,
      version,
    });

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
    const result = await this.client.query(api.memories.getHistory, {
      memorySpaceId,
      memoryId,
    });

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
    const result = await this.client.mutation(api.memories.deleteMany, {
      memorySpaceId: filter.memorySpaceId,
      userId: filter.userId,
      sourceType: filter.sourceType,
    });

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
    const result = await this.client.query(api.memories.exportMemories, {
      memorySpaceId: options.memorySpaceId,
      userId: options.userId,
      format: options.format,
      includeEmbeddings: options.includeEmbeddings,
    });

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
    const result = await this.client.mutation(api.memories.updateMany, {
      memorySpaceId: filter.memorySpaceId,
      userId: filter.userId,
      sourceType: filter.sourceType,
      importance: updates.importance,
      tags: updates.tags,
    });

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
    const result = await this.client.mutation(api.memories.archive, {
      memorySpaceId,
      memoryId,
    });

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
    const ts = typeof timestamp === "number" ? timestamp : timestamp.getTime();

    const result = await this.client.query(api.memories.getAtTimestamp, {
      memorySpaceId,
      memoryId,
      timestamp: ts,
    });

    return result as {
      memoryId: string;
      version: number;
      content: string;
      embedding?: number[];
      timestamp: number;
    } | null;
  }
}
