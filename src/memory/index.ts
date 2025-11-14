/**
 * Layer 3: Memory Convenience API
 *
 * High-level helpers that orchestrate Layer 1 (ACID) and Layer 2 (Vector) automatically.
 * Recommended API for most use cases.
 */

import type { ConvexClient } from "convex/browser";
import { ConversationsAPI } from "../conversations";
import { VectorAPI } from "../vector";
import { FactsAPI } from "../facts";
import {
  type ArchiveResult,
  type Conversation,
  type CountMemoriesFilter,
  type DeleteManyResult,
  type DeleteMemoryOptions,
  type DeleteMemoryResult,
  type EnrichedMemory,
  type ExportMemoriesOptions,
  type ExtendedForgetOptions,
  type FactRecord,
  type ForgetResult,
  type GetMemoryOptions,
  type ListMemoriesFilter,
  type MemoryEntry,
  type Message,
  type RememberOptions,
  type RememberParams,
  type RememberResult,
  type RememberStreamParams,
  type RememberStreamResult,
  type SearchMemoryOptions,
  type SourceType,
  type StoreMemoryInput,
  type StoreMemoryResult,
  type UpdateManyResult,
  type UpdateMemoryOptions,
  type UpdateMemoryResult,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import { consumeStream } from "./streamUtils";

// Type for conversation with messages
interface ConversationWithMessages {
  messages: Message[];
  [key: string]: unknown;
}

export class MemoryAPI {
  private readonly client: ConvexClient;
  private readonly conversations: ConversationsAPI;
  private readonly vector: VectorAPI;
  private readonly facts: FactsAPI;
  private readonly graphAdapter?: GraphAdapter;

  constructor(client: ConvexClient, graphAdapter?: GraphAdapter) {
    this.client = client;
    this.graphAdapter = graphAdapter;
    this.conversations = new ConversationsAPI(client, graphAdapter);
    this.vector = new VectorAPI(client, graphAdapter);
    this.facts = new FactsAPI(client, graphAdapter);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helper Methods for Fact Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Helper: Find and cascade delete facts linked to a memory
   */
  private async cascadeDeleteFacts(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
    syncToGraph?: boolean,
  ): Promise<{ count: number; factIds: string[] }> {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 10000,
    });

    const factsToDelete = allFacts.filter(
      (fact) =>
        fact.sourceRef?.memoryId === memoryId ||
        (conversationId && fact.sourceRef?.conversationId === conversationId),
    );

    const deletedFactIds: string[] = [];
    for (const fact of factsToDelete) {
      try {
        await this.facts.delete(memorySpaceId, fact.factId, { syncToGraph });
        deletedFactIds.push(fact.factId);
      } catch (error) {
        console.warn("Failed to delete linked fact:", error);
      }
    }

    return { count: deletedFactIds.length, factIds: deletedFactIds };
  }

  /**
   * Helper: Archive facts (mark as expired)
   */
  private async archiveFacts(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
    syncToGraph?: boolean,
  ): Promise<{ count: number; factIds: string[] }> {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 10000,
    });

    const factsToArchive = allFacts.filter(
      (fact) =>
        fact.sourceRef?.memoryId === memoryId ||
        (conversationId && fact.sourceRef?.conversationId === conversationId),
    );

    const archivedFactIds: string[] = [];
    for (const fact of factsToArchive) {
      try {
        await this.facts.update(
          memorySpaceId,
          fact.factId,
          {
            validUntil: Date.now(),
            tags: [...fact.tags, "archived"],
          },
          { syncToGraph },
        );
        archivedFactIds.push(fact.factId);
      } catch (error) {
        console.warn("Failed to archive linked fact:", error);
      }
    }

    return { count: archivedFactIds.length, factIds: archivedFactIds };
  }

  /**
   * Helper: Fetch facts for a memory or conversation
   */
  private async fetchFactsForMemory(
    memorySpaceId: string,
    memoryId: string,
    conversationId?: string,
  ): Promise<FactRecord[]> {
    const allFacts = await this.facts.list({
      memorySpaceId,
      limit: 10000,
    });

    return allFacts.filter(
      (fact) =>
        fact.sourceRef?.memoryId === memoryId ||
        (conversationId && fact.sourceRef?.conversationId === conversationId),
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Dual-Layer Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Remember a conversation exchange (stores in both ACID and Vector)
   *
   * Auto-syncs to graph if configured (default: true)
   *
   * @example
   * ```typescript
   * await cortex.memory.remember({
   *   memorySpaceId: 'agent-1',
   *   conversationId: 'conv-123',
   *   userMessage: 'The password is Blue',
   *   agentResponse: "I'll remember that!",
   *   userId: 'user-1',
   *   userName: 'Alex',
   * });
   *
   * // Disable graph sync
   * await cortex.memory.remember(params, { syncToGraph: false });
   * ```
   */
  async remember(
    params: RememberParams,
    options?: RememberOptions,
  ): Promise<RememberResult> {
    const now = Date.now();

    // Step 1: Ensure conversation exists (auto-create if needed)
    const existingConversation = await this.conversations.get(
      params.conversationId,
    );

    if (!existingConversation) {
      // Auto-create conversation with sensible defaults
      await this.conversations.create(
        {
          memorySpaceId: params.memorySpaceId,
          conversationId: params.conversationId,
          type: "user-agent",
          participants: {
            userId: params.userId,
            participantId: params.participantId || "agent",
          },
        },
        {
          syncToGraph:
            options?.syncToGraph !== false && this.graphAdapter !== undefined,
        },
      );
    }

    // Step 2: Store user message in ACID
    const userMsg = await this.conversations.addMessage({
      conversationId: params.conversationId,
      message: {
        role: "user",
        content: params.userMessage,
        metadata: { userId: params.userId },
      },
    });

    // Step 3: Store agent response in ACID
    const agentMsg = await this.conversations.addMessage({
      conversationId: params.conversationId,
      message: {
        role: "agent",
        content: params.agentResponse,
        participantId: params.participantId, // Updated
        metadata: {},
      },
    });

    // Step 4: Extract content (if provided)
    let userContent = params.userMessage;
    const agentContent = params.agentResponse;
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

    // Step 5: Generate embeddings (if provided)
    let userEmbedding: number[] | undefined;
    let agentEmbedding: number[] | undefined;

    if (params.generateEmbedding) {
      userEmbedding =
        (await params.generateEmbedding(userContent)) || undefined;
      agentEmbedding =
        (await params.generateEmbedding(agentContent)) || undefined;
    }

    // Determine if we should sync to graph (default: true if configured)
    const shouldSyncToGraph =
      options?.syncToGraph !== false && this.graphAdapter !== undefined;

    // Step 6: Store user message in Vector with conversationRef
    const userMemory = await this.vector.store(
      params.memorySpaceId,
      {
        content: userContent,
        contentType,
        participantId: params.participantId, // Hive Mode tracking
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
      },
      { syncToGraph: shouldSyncToGraph },
    );

    // Step 7: Store agent response in Vector with conversationRef
    const agentMemory = await this.vector.store(
      params.memorySpaceId,
      {
        content: agentContent,
        contentType,
        participantId: params.participantId, // Hive Mode tracking
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
      },
      { syncToGraph: shouldSyncToGraph },
    );

    // Step 8: Extract and store facts (if extraction function provided)
    const extractedFacts: FactRecord[] = [];

    if (params.extractFacts) {
      try {
        const factsToStore = await params.extractFacts(
          params.userMessage,
          params.agentResponse,
        );

        if (factsToStore && factsToStore.length > 0) {
          for (const factData of factsToStore) {
            try {
              const storedFact = await this.facts.store(
                {
                  memorySpaceId: params.memorySpaceId,
                  participantId: params.participantId,
                  fact: factData.fact,
                  factType: factData.factType,
                  subject: factData.subject || params.userId,
                  predicate: factData.predicate,
                  object: factData.object,
                  confidence: factData.confidence,
                  sourceType: "conversation",
                  sourceRef: {
                    conversationId: params.conversationId,
                    messageIds: [
                      userMsg.messages[userMsg.messages.length - 1].id,
                      agentMsg.messages[agentMsg.messages.length - 1].id,
                    ],
                    memoryId: userMemory.memoryId,
                  },
                  tags: factData.tags || params.tags || [],
                },
                { syncToGraph: shouldSyncToGraph },
              );

              extractedFacts.push(storedFact);
            } catch (error) {
              console.warn("Failed to store fact:", error);
              // Continue with other facts
            }
          }
        }
      } catch (error) {
        console.warn("Failed to extract facts:", error);
        // Continue without facts - don't fail the entire remember operation
      }
    }

    return {
      conversation: {
        messageIds: [
          userMsg.messages[userMsg.messages.length - 1].id,
          agentMsg.messages[agentMsg.messages.length - 1].id,
        ],
        conversationId: params.conversationId,
      },
      memories: [userMemory, agentMemory],
      facts: extractedFacts,
    };
  }

  /**
   * Remember a conversation exchange from a streaming response
   *
   * This method consumes a stream (ReadableStream or AsyncIterable) and stores
   * the conversation in both ACID and Vector layers once the stream completes.
   *
   * Auto-syncs to graph if configured (default: true)
   *
   * @param params - Stream parameters including responseStream
   * @param options - Optional remember options
   * @returns Promise with remember result and full response text
   *
   * @example
   * ```typescript
   * // With ReadableStream
   * const stream = response.body; // From fetch or AI SDK
   * const result = await cortex.memory.rememberStream({
   *   memorySpaceId: 'agent-1',
   *   conversationId: 'conv-123',
   *   userMessage: 'What is the weather?',
   *   responseStream: stream,
   *   userId: 'user-1',
   *   userName: 'Alex',
   * });
   * console.log('Full response:', result.fullResponse);
   *
   * // With AsyncIterable (e.g., OpenAI streaming)
   * async function* streamGenerator() {
   *   yield 'The ';
   *   yield 'weather ';
   *   yield 'is sunny.';
   * }
   * const result = await cortex.memory.rememberStream({
   *   memorySpaceId: 'agent-1',
   *   conversationId: 'conv-123',
   *   userMessage: 'What is the weather?',
   *   responseStream: streamGenerator(),
   *   userId: 'user-1',
   *   userName: 'Alex',
   * });
   * ```
   */
  async rememberStream(
    params: RememberStreamParams,
    options?: RememberOptions,
  ): Promise<RememberStreamResult> {
    // Step 1: Consume the stream to get the full response text
    let agentResponse: string;

    try {
      agentResponse = await consumeStream(params.responseStream);
    } catch (error) {
      throw new Error(
        `Failed to consume response stream: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Step 2: Validate we got some content
    if (!agentResponse || agentResponse.trim().length === 0) {
      throw new Error(
        "Response stream completed but produced no content. Cannot store empty response.",
      );
    }

    // Step 3: Use the existing remember() method with the complete response
    const rememberResult = await this.remember(
      {
        memorySpaceId: params.memorySpaceId,
        participantId: params.participantId,
        conversationId: params.conversationId,
        userMessage: params.userMessage,
        agentResponse: agentResponse,
        userId: params.userId,
        userName: params.userName,
        extractContent: params.extractContent,
        generateEmbedding: params.generateEmbedding,
        extractFacts: params.extractFacts,
        autoEmbed: params.autoEmbed,
        autoSummarize: params.autoSummarize,
        importance: params.importance,
        tags: params.tags,
      },
      options,
    );

    // Step 4: Return the result with the full response
    return {
      ...rememberResult,
      fullResponse: agentResponse,
    };
  }

  /**
   * Forget a memory (delete from Vector and optionally ACID)
   *
   * Auto-syncs to graph if configured (default: true)
   *
   * @example
   * ```typescript
   * await cortex.memory.forget('agent-1', 'mem-123', {
   *   deleteConversation: true,
   * });
   *
   * // Disable graph sync
   * await cortex.memory.forget('agent-1', 'mem-123', {
   *   deleteConversation: true,
   *   syncToGraph: false,
   * });
   * ```
   */
  async forget(
    agentId: string,
    memoryId: string,
    options?: ExtendedForgetOptions,
  ): Promise<ForgetResult> {
    // Get the memory first
    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Determine if we should sync to graph (default: true if configured)
    const shouldSyncToGraph =
      options?.syncToGraph !== false && this.graphAdapter !== undefined;

    // Delete from vector (with graph cascade)
    await this.vector.delete(agentId, memoryId, {
      syncToGraph: shouldSyncToGraph,
    });

    // Cascade delete associated facts
    const { count: factsDeleted, factIds } = await this.cascadeDeleteFacts(
      agentId,
      memoryId,
      memory.conversationRef?.conversationId,
      shouldSyncToGraph,
    );

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

        // Delete entire conversation (with graph cascade)
        await this.conversations.delete(memory.conversationRef.conversationId, {
          syncToGraph: shouldSyncToGraph,
        });
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
      factsDeleted,
      factIds,
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

    // Fetch conversation if exists
    let conversation = undefined;
    let sourceMessages = undefined;

    if (memory.conversationRef) {
      const conv = await this.conversations.get(
        memory.conversationRef.conversationId,
      );

      conversation = conv ?? undefined;

      if (conversation) {
        sourceMessages = conversation.messages.filter((m) =>
          memory.conversationRef!.messageIds.includes(m.id),
        );
      }
    }

    // Fetch associated facts
    const relatedFacts = await this.fetchFactsForMemory(
      agentId,
      memoryId,
      memory.conversationRef?.conversationId,
    );

    return {
      memory,
      conversation,
      sourceMessages,
      facts: relatedFacts.length > 0 ? relatedFacts : undefined,
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

    // Batch fetch all facts for this memory space
    const allFacts = await this.facts.list({
      memorySpaceId: agentId,
      limit: 10000,
    });

    // Create lookup maps for efficient fact matching
    const factsByMemoryId = new Map<string, FactRecord[]>();
    const factsByConversationId = new Map<string, FactRecord[]>();

    for (const fact of allFacts) {
      if (fact.sourceRef?.memoryId) {
        if (!factsByMemoryId.has(fact.sourceRef.memoryId)) {
          factsByMemoryId.set(fact.sourceRef.memoryId, []);
        }
        factsByMemoryId.get(fact.sourceRef.memoryId)!.push(fact);
      }

      if (fact.sourceRef?.conversationId) {
        if (!factsByConversationId.has(fact.sourceRef.conversationId)) {
          factsByConversationId.set(fact.sourceRef.conversationId, []);
        }
        factsByConversationId.get(fact.sourceRef.conversationId)!.push(fact);
      }
    }

    // Enrich results with conversations AND facts
    const enriched: EnrichedMemory[] = memories.map((memory) => {
      const result: EnrichedMemory = { memory };

      // Add conversation
      if (memory.conversationRef) {
        const conversation = conversations.get(
          memory.conversationRef.conversationId,
        ) as ConversationWithMessages | undefined;
        if (conversation) {
          result.conversation = conversation as unknown as Conversation;
          result.sourceMessages = conversation.messages.filter((m: Message) =>
            memory.conversationRef!.messageIds.includes(m.id),
          );
        }
      }

      // Add facts
      const relatedFacts = [
        ...(factsByMemoryId.get(memory.memoryId) || []),
        ...(memory.conversationRef
          ? factsByConversationId.get(memory.conversationRef.conversationId) ||
            []
          : []),
      ];

      // Deduplicate facts by factId
      const uniqueFacts = Array.from(
        new Map(relatedFacts.map((f) => [f.factId, f])).values(),
      );

      if (uniqueFacts.length > 0) {
        result.facts = uniqueFacts;
      }

      return result;
    });

    return enriched;
  }

  /**
   * Store memory with smart layer detection and optional fact extraction
   *
   * @example
   * ```typescript
   * await cortex.memory.store('agent-1', {
   *   content: 'User prefers dark mode',
   *   contentType: 'raw',
   *   source: { type: 'system' },
   *   metadata: { importance: 60, tags: ['preferences'] },
   *   extractFacts: async (content) => [{
   *     fact: 'User prefers dark mode',
   *     factType: 'preference',
   *     confidence: 90,
   *   }],
   * });
   * ```
   */
  async store(
    agentId: string,
    input: StoreMemoryInput,
  ): Promise<StoreMemoryResult> {
    // Validate conversationRef requirement
    if (input.source.type === "conversation" && !input.conversationRef) {
      throw new Error(
        "INVALID_INPUT: conversationRef required for source.type='conversation'",
      );
    }

    // Store memory
    const memory = await this.vector.store(agentId, input);

    // Extract and store facts if callback provided
    const extractedFacts: FactRecord[] = [];

    if (input.extractFacts) {
      const factsToStore = await input.extractFacts(input.content);

      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            const storedFact = await this.facts.store(
              {
                memorySpaceId: agentId,
                participantId: input.participantId,
                fact: factData.fact,
                factType: factData.factType,
                subject: factData.subject || input.userId,
                predicate: factData.predicate,
                object: factData.object,
                confidence: factData.confidence,
                sourceType: input.source.type,
                sourceRef: {
                  conversationId: input.conversationRef?.conversationId,
                  messageIds: input.conversationRef?.messageIds,
                  memoryId: memory.memoryId,
                },
                tags:
                  factData.tags && factData.tags.length > 0
                    ? factData.tags
                    : input.metadata.tags,
              },
              { syncToGraph: true },
            );

            extractedFacts.push(storedFact);
          } catch (error) {
            console.warn("Failed to store fact:", error);
          }
        }
      }
    }

    return {
      memory,
      facts: extractedFacts,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delegations (Thin Wrappers to Layer 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Update a memory with optional fact re-extraction
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
    options?: UpdateMemoryOptions,
  ): Promise<UpdateMemoryResult> {
    const updatedMemory = await this.vector.update(agentId, memoryId, updates);

    const factsReextracted: FactRecord[] = [];

    // Re-extract facts if content changed and reextract requested
    if (options?.reextractFacts && updates.content && options.extractFacts) {
      // Delete old facts first
      await this.cascadeDeleteFacts(
        agentId,
        memoryId,
        undefined,
        options.syncToGraph,
      );

      // Extract new facts
      const factsToStore = await options.extractFacts(updates.content);

      if (factsToStore && factsToStore.length > 0) {
        for (const factData of factsToStore) {
          try {
            const storedFact = await this.facts.store(
              {
                memorySpaceId: agentId,
                fact: factData.fact,
                factType: factData.factType,
                subject: factData.subject || updatedMemory.userId,
                predicate: factData.predicate,
                object: factData.object,
                confidence: factData.confidence,
                sourceType: updatedMemory.sourceType,
                sourceRef: {
                  conversationId: updatedMemory.conversationRef?.conversationId,
                  messageIds: updatedMemory.conversationRef?.messageIds,
                  memoryId: updatedMemory.memoryId,
                },
                tags:
                  factData.tags && factData.tags.length > 0 ? factData.tags : updatedMemory.tags,
              },
              { syncToGraph: options.syncToGraph },
            );

            factsReextracted.push(storedFact);
          } catch (error) {
            console.warn("Failed to re-extract fact:", error);
          }
        }
      }
    }

    return {
      memory: updatedMemory,
      factsReextracted:
        factsReextracted.length > 0 ? factsReextracted : undefined,
    };
  }

  /**
   * Delete a memory with cascade delete of facts
   */
  async delete(
    agentId: string,
    memoryId: string,
    options?: DeleteMemoryOptions,
  ): Promise<DeleteMemoryResult> {
    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    const shouldSyncToGraph =
      options?.syncToGraph !== false && this.graphAdapter !== undefined;
    const shouldCascade = options?.cascadeDeleteFacts !== false; // Default: true

    // Delete facts if cascade enabled
    let factsDeleted = 0;
    let factIds: string[] = [];

    if (shouldCascade) {
      const result = await this.cascadeDeleteFacts(
        agentId,
        memoryId,
        memory.conversationRef?.conversationId,
        shouldSyncToGraph,
      );
      factsDeleted = result.count;
      factIds = result.factIds;
    }

    // Delete from vector
    await this.vector.delete(agentId, memoryId, {
      syncToGraph: shouldSyncToGraph,
    });

    return {
      deleted: true,
      memoryId,
      factsDeleted,
      factIds,
    };
  }

  /**
   * List memories with optional fact enrichment
   */
  async list(
    filter: ListMemoriesFilter,
  ): Promise<MemoryEntry[] | EnrichedMemory[]> {
    const memories = await this.vector.list(filter);

    if (!filter.enrichFacts) {
      return memories;
    }

    // Batch fetch facts
    const allFacts = await this.facts.list({
      memorySpaceId: filter.memorySpaceId,
      limit: 10000,
    });

    const factsByMemoryId = new Map<string, FactRecord[]>();

    for (const fact of allFacts) {
      if (fact.sourceRef?.memoryId) {
        if (!factsByMemoryId.has(fact.sourceRef.memoryId)) {
          factsByMemoryId.set(fact.sourceRef.memoryId, []);
        }
        factsByMemoryId.get(fact.sourceRef.memoryId)!.push(fact);
      }
    }

    return memories.map((memory) => ({
      memory,
      facts: factsByMemoryId.get(memory.memoryId),
    }));
  }

  /**
   * Count memories (delegates to vector.count)
   */
  async count(filter: CountMemoriesFilter): Promise<number> {
    return await this.vector.count(filter);
  }

  /**
   * Update many memories and track affected facts
   */
  async updateMany(
    filter: {
      memorySpaceId: string;
      userId?: string;
      sourceType?: SourceType;
    },
    updates: {
      importance?: number;
      tags?: string[];
    },
  ): Promise<UpdateManyResult> {
    const result = await this.vector.updateMany(filter, updates);

    // Count facts that reference updated memories
    const allFacts = await this.facts.list({
      memorySpaceId: filter.memorySpaceId,
      limit: 10000,
    });

    const affectedFacts = allFacts.filter((fact) =>
      result.memoryIds.includes(fact.sourceRef?.memoryId || ""),
    );

    return {
      ...result,
      factsAffected: affectedFacts.length,
    };
  }

  /**
   * Delete many memories with batch cascade delete of facts
   */
  async deleteMany(filter: {
    memorySpaceId: string;
    userId?: string;
    sourceType?: SourceType;
  }): Promise<DeleteManyResult> {
    // Get all memories to delete
    const memories = await this.vector.list(filter);

    let totalFactsDeleted = 0;
    const allFactIds: string[] = [];

    // Cascade delete facts for each memory
    for (const memory of memories) {
      const { count, factIds } = await this.cascadeDeleteFacts(
        filter.memorySpaceId,
        memory.memoryId,
        memory.conversationRef?.conversationId,
        true,
      );
      totalFactsDeleted += count;
      allFactIds.push(...factIds);
    }

    // Delete memories
    const result = await this.vector.deleteMany(filter);

    return {
      ...result,
      factsDeleted: totalFactsDeleted,
      factIds: allFactIds,
    };
  }

  /**
   * Export memories with optional fact inclusion
   */
  async export(options: ExportMemoriesOptions): Promise<{
    format: string;
    data: string;
    count: number;
    exportedAt: number;
  }> {
    const result = await this.vector.export(options);

    if (!options.includeFacts) {
      return result;
    }

    // Fetch all facts for this memory space
    const facts = await this.facts.list({
      memorySpaceId: options.memorySpaceId,
      limit: 10000,
    });

    // Parse existing export data
    const data = JSON.parse(result.data) as MemoryEntry[];

    // Add facts to each memory
    const enrichedData = data.map((memory: MemoryEntry) => {
      const relatedFacts = facts.filter(
        (fact) => fact.sourceRef?.memoryId === memory.memoryId,
      );

      return {
        ...memory,
        facts: relatedFacts.map((f) => ({
          factId: f.factId,
          fact: f.fact,
          factType: f.factType,
          confidence: f.confidence,
          tags: f.tags,
        })),
      };
    });

    return {
      ...result,
      data: JSON.stringify(enrichedData, null, 2),
    };
  }

  /**
   * Archive a memory and mark associated facts as expired
   */
  async archive(agentId: string, memoryId: string): Promise<ArchiveResult> {
    const memory = await this.vector.get(agentId, memoryId);

    if (!memory) {
      throw new Error("MEMORY_NOT_FOUND");
    }

    // Archive facts (mark as expired, not deleted)
    const { count: factsArchived, factIds } = await this.archiveFacts(
      agentId,
      memoryId,
      memory.conversationRef?.conversationId,
      true,
    );

    // Archive memory
    const result = await this.vector.archive(agentId, memoryId);

    return {
      ...result,
      factsArchived,
      factIds,
    };
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
    return await this.vector.getVersion(agentId, memoryId, version);
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
    return await this.vector.getHistory(agentId, memoryId);
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
    return await this.vector.getAtTimestamp(agentId, memoryId, timestamp);
  }
}
