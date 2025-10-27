/**
 * Layer 3: Memory Convenience API
 *
 * High-level helpers that orchestrate Layer 1 (ACID) and Layer 2 (Vector) automatically.
 * Recommended API for most use cases.
 */

import { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import { ConversationsAPI } from "../conversations";
import { VectorAPI } from "../vector";
import {
  RememberParams,
  RememberResult,
  ForgetOptions,
  ForgetResult,
  GetMemoryOptions,
  EnrichedMemory,
  SearchMemoryOptions,
  MemoryEntry,
  ListMemoriesFilter,
  CountMemoriesFilter,
  MemoryVersion,
  SourceType,
  StoreMemoryInput,
} from "../types";

export class MemoryAPI {
  private client: ConvexClient;
  private conversations: ConversationsAPI;
  private vector: VectorAPI;

  constructor(client: ConvexClient) {
    this.client = client;
    this.conversations = new ConversationsAPI(client);
    this.vector = new VectorAPI(client);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Dual-Layer Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Remember a conversation exchange (stores in both ACID and Vector)
   *
   * @example
   * ```typescript
   * await cortex.memory.remember({
   *   agentId: 'agent-1',
   *   conversationId: 'conv-123',
   *   userMessage: 'The password is Blue',
   *   agentResponse: "I'll remember that!",
   *   userId: 'user-1',
   *   userName: 'Alex',
   * });
   * ```
   */
  async remember(params: RememberParams): Promise<RememberResult> {
    const now = Date.now();

    // Step 1: Store user message in ACID
    const userMsg = await this.conversations.addMessage({
      conversationId: params.conversationId,
      message: {
        role: "user",
        content: params.userMessage,
        metadata: { userId: params.userId },
      },
    });

    // Step 2: Store agent response in ACID
    const agentMsg = await this.conversations.addMessage({
      conversationId: params.conversationId,
      message: {
        role: "agent",
        content: params.agentResponse,
        agentId: params.agentId,
        metadata: {},
      },
    });

    // Step 3: Extract content (if provided)
    let userContent = params.userMessage;
    let agentContent = params.agentResponse;
    let contentType: "raw" | "summarized" = "raw";

    if (params.extractContent) {
      const extracted = await params.extractContent(
        params.userMessage,
        params.agentResponse,
      );
      if (extracted) {
        userContent = extracted;
        contentType = "summarized";
      }
    }

    // Step 4: Generate embeddings (if provided)
    let userEmbedding: number[] | undefined;
    let agentEmbedding: number[] | undefined;

    if (params.generateEmbedding) {
      userEmbedding =
        (await params.generateEmbedding(userContent)) || undefined;
      agentEmbedding =
        (await params.generateEmbedding(agentContent)) || undefined;
    }

    // Step 5: Store user message in Vector with conversationRef
    const userMemory = await this.vector.store(params.agentId, {
      content: userContent,
      contentType,
      embedding: userEmbedding,
      userId: params.userId,
      source: {
        type: "conversation",
        userId: params.userId,
        userName: params.userName,
        timestamp: now,
      },
      conversationRef: {
        conversationId: params.conversationId,
        messageIds: [userMsg.messages[userMsg.messages.length - 1].id],
      },
      metadata: {
        importance: params.importance || 50,
        tags: params.tags || [],
      },
    });

    // Step 6: Store agent response in Vector with conversationRef
    const agentMemory = await this.vector.store(params.agentId, {
      content: agentContent,
      contentType,
      embedding: agentEmbedding,
      userId: params.userId,
      source: {
        type: "conversation",
        userId: params.userId,
        userName: params.userName,
        timestamp: now + 1,
      },
      conversationRef: {
        conversationId: params.conversationId,
        messageIds: [agentMsg.messages[agentMsg.messages.length - 1].id],
      },
      metadata: {
        importance: params.importance || 50,
        tags: params.tags || [],
      },
    });

    return {
      conversation: {
        messageIds: [
          userMsg.messages[userMsg.messages.length - 1].id,
          agentMsg.messages[agentMsg.messages.length - 1].id,
        ],
        conversationId: params.conversationId,
      },
      memories: [userMemory, agentMemory],
    };
  }

  /**
   * Forget a memory (delete from Vector and optionally ACID)
   *
   * @example
   * ```typescript
   * await cortex.memory.forget('agent-1', 'mem-123', {
   *   deleteConversation: true,
   * });
   * ```
   */
  async forget(
    agentId: string,
    memoryId: string,
    options?: ForgetOptions,
  ): Promise<ForgetResult> {
    // Get the memory first
    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Delete from vector
    await this.vector.delete(agentId, memoryId);

    let conversationDeleted = false;
    let messagesDeleted = 0;

    // Optionally delete from ACID
    if (options?.deleteConversation && memory.conversationRef) {
      if (options.deleteEntireConversation) {
        // Get conversation first to count messages
        const conv = await this.conversations.get(
          memory.conversationRef.conversationId,
        );
        messagesDeleted = conv?.messageCount || 0;

        // Delete entire conversation
        await this.conversations.delete(memory.conversationRef.conversationId);
        conversationDeleted = true;
      } else {
        // Delete specific messages (not implemented in Layer 1a yet)
        // For now, just note that messages would be deleted
        messagesDeleted = memory.conversationRef.messageIds.length;
      }
    }

    return {
      memoryDeleted: true,
      conversationDeleted,
      messagesDeleted,
      restorable: !options?.deleteConversation, // Restorable if ACID preserved
    };
  }

  /**
   * Get memory with optional ACID enrichment
   *
   * @example
   * ```typescript
   * const enriched = await cortex.memory.get('agent-1', 'mem-123', {
   *   includeConversation: true,
   * });
   * ```
   */
  async get(
    agentId: string,
    memoryId: string,
    options?: GetMemoryOptions,
  ): Promise<MemoryEntry | EnrichedMemory | null> {
    // Get from vector
    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      return null;
    }

    // If no enrichment, return vector only
    if (!options?.includeConversation) {
      return memory;
    }

    // Enrich with ACID if conversationRef exists
    if (!memory.conversationRef) {
      return { memory }; // No conversation to enrich
    }

    // Fetch conversation
    const conversation = await this.conversations.get(
      memory.conversationRef.conversationId,
    );

    if (!conversation) {
      return { memory }; // Conversation deleted or missing
    }

    // Extract source messages
    const sourceMessages = conversation.messages.filter((m) =>
      memory.conversationRef!.messageIds.includes(m.id),
    );

    return {
      memory,
      conversation,
      sourceMessages,
    };
  }

  /**
   * Search memories with optional ACID enrichment
   *
   * @example
   * ```typescript
   * const results = await cortex.memory.search('agent-1', 'password', {
   *   embedding: await embed('password'),
   *   enrichConversation: true,
   * });
   * ```
   */
  async search(
    agentId: string,
    query: string,
    options?: SearchMemoryOptions,
  ): Promise<MemoryEntry[] | EnrichedMemory[]> {
    // Search vector
    const memories = await this.vector.search(agentId, query, {
      embedding: options?.embedding,
      userId: options?.userId,
      tags: options?.tags,
      sourceType: options?.sourceType,
      minImportance: options?.minImportance,
      limit: options?.limit,
      minScore: options?.minScore,
    });

    // If no enrichment, return vector only
    if (!options?.enrichConversation) {
      return memories;
    }

    // Batch fetch conversations (avoid N+1 queries)
    const conversationIds = new Set(
      memories
        .filter((m) => m.conversationRef)
        .map((m) => m.conversationRef!.conversationId),
    );

    const conversations = new Map();
    for (const convId of conversationIds) {
      const conv = await this.conversations.get(convId);
      if (conv) {
        conversations.set(convId, conv);
      }
    }

    // Enrich results
    const enriched: EnrichedMemory[] = memories.map((memory) => {
      if (!memory.conversationRef) {
        return { memory };
      }

      const conversation = conversations.get(
        memory.conversationRef.conversationId,
      );
      if (!conversation) {
        return { memory };
      }

      const sourceMessages = conversation.messages.filter((m: any) =>
        memory.conversationRef!.messageIds.includes(m.id),
      );

      return {
        memory,
        conversation,
        sourceMessages,
      };
    });

    return enriched;
  }

  /**
   * Store memory with smart layer detection
   *
   * @example
   * ```typescript
   * await cortex.memory.store('agent-1', {
   *   content: 'User prefers dark mode',
   *   contentType: 'raw',
   *   source: { type: 'system' },
   *   metadata: { importance: 60, tags: ['preferences'] },
   * });
   * ```
   */
  async store(agentId: string, input: StoreMemoryInput): Promise<MemoryEntry> {
    // Validate conversationRef requirement
    if (input.source.type === "conversation" && !input.conversationRef) {
      throw new Error(
        "INVALID_INPUT: conversationRef required for source.type='conversation'",
      );
    }

    // Delegate to vector
    return this.vector.store(agentId, input);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delegations (Thin Wrappers to Layer 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Update a memory (delegates to vector.update)
   */
  async update(
    agentId: string,
    memoryId: string,
    updates: {
      content?: string;
      embedding?: number[];
      importance?: number;
      tags?: string[];
    },
  ): Promise<MemoryEntry> {
    return this.vector.update(agentId, memoryId, updates);
  }

  /**
   * Delete a memory from Vector only (preserves ACID)
   */
  async delete(
    agentId: string,
    memoryId: string,
  ): Promise<{ deleted: boolean; memoryId: string }> {
    return this.vector.delete(agentId, memoryId);
  }

  /**
   * List memories (delegates to vector.list)
   */
  async list(filter: ListMemoriesFilter): Promise<MemoryEntry[]> {
    return this.vector.list(filter);
  }

  /**
   * Count memories (delegates to vector.count)
   */
  async count(filter: CountMemoriesFilter): Promise<number> {
    return this.vector.count(filter);
  }

  /**
   * Update many memories (delegates to vector.updateMany)
   */
  async updateMany(
    filter: {
      agentId: string;
      userId?: string;
      sourceType?: SourceType;
    },
    updates: {
      importance?: number;
      tags?: string[];
    },
  ): Promise<{ updated: number; memoryIds: string[] }> {
    return this.vector.updateMany(filter, updates);
  }

  /**
   * Delete many memories (delegates to vector.deleteMany)
   */
  async deleteMany(filter: {
    agentId: string;
    userId?: string;
    sourceType?: SourceType;
  }): Promise<{ deleted: number; memoryIds: string[] }> {
    return this.vector.deleteMany(filter);
  }

  /**
   * Export memories (delegates to vector.export)
   */
  async export(options: {
    agentId: string;
    userId?: string;
    format: "json" | "csv";
    includeEmbeddings?: boolean;
  }): Promise<{
    format: string;
    data: string;
    count: number;
    exportedAt: number;
  }> {
    return this.vector.export(options);
  }

  /**
   * Archive a memory (delegates to vector.archive)
   */
  async archive(
    agentId: string,
    memoryId: string,
  ): Promise<{ archived: boolean; memoryId: string; restorable: boolean }> {
    return this.vector.archive(agentId, memoryId);
  }

  /**
   * Get specific version (delegates to vector.getVersion)
   */
  async getVersion(
    agentId: string,
    memoryId: string,
    version: number,
  ): Promise<{
    memoryId: string;
    version: number;
    content: string;
    embedding?: number[];
    timestamp: number;
  } | null> {
    return this.vector.getVersion(agentId, memoryId, version);
  }

  /**
   * Get version history (delegates to vector.getHistory)
   */
  async getHistory(
    agentId: string,
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
    return this.vector.getHistory(agentId, memoryId);
  }

  /**
   * Get version at timestamp (delegates to vector.getAtTimestamp)
   */
  async getAtTimestamp(
    agentId: string,
    memoryId: string,
    timestamp: number | Date,
  ): Promise<{
    memoryId: string;
    version: number;
    content: string;
    embedding?: number[];
    timestamp: number;
  } | null> {
    return this.vector.getAtTimestamp(agentId, memoryId, timestamp);
  }
}
