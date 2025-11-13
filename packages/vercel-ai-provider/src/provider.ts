/**
 * Cortex Memory Provider for Vercel AI SDK
 *
 * Wraps language models with automatic memory retrieval and storage
 */

import type { LanguageModelV1, LanguageModelV1StreamPart } from "ai";
import { Cortex } from "@cortexmemory/sdk";
import type { MemoryEntry } from "@cortexmemory/sdk";
import type { CortexMemoryConfig, Logger } from "./types";
import {
  resolveUserId,
  resolveConversationId,
  injectMemoryContext,
  getLastUserMessage,
} from "./middleware";
import { createLogger } from "./types";
import { createCompletionStream } from "./streaming";

/**
 * Cortex Memory Provider
 *
 * Wraps an existing language model with automatic memory capabilities
 */
export class CortexMemoryProvider implements LanguageModelV1 {
  public readonly specificationVersion: "v1" = "v1";
  public readonly provider: string;
  public readonly modelId: string;
  public readonly defaultObjectGenerationMode = "json" as const;

  private cortex: Cortex;
  private config: CortexMemoryConfig;
  private logger: Logger;
  private underlyingModel: LanguageModelV1;

  constructor(underlyingModel: LanguageModelV1, config: CortexMemoryConfig) {
    this.underlyingModel = underlyingModel;
    this.config = config;
    this.logger = config.logger || createLogger(config.debug || false);
    this.provider = underlyingModel.provider;
    this.modelId = underlyingModel.modelId;

    // Initialize Cortex SDK
    this.cortex = new Cortex({ convexUrl: config.convexUrl });

    this.logger.debug(
      `Initialized CortexMemoryProvider for model: ${this.modelId}`,
    );
  }

  /**
   * Generate text with automatic memory retrieval and storage
   */
  async doGenerate(
    options: Parameters<LanguageModelV1["doGenerate"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> {
    this.logger.debug("doGenerate called");

    // Step 1: Resolve user context
    const userId = await resolveUserId(this.config, this.logger);
    const conversationId = await resolveConversationId(
      this.config,
      this.logger,
    );

    this.logger.debug(`User: ${userId}, Conversation: ${conversationId}`);

    // Step 2: Search for relevant memories (if enabled)
    let memories: MemoryEntry[] = [];
    const lastUserMessage = getLastUserMessage(options.prompt);

    if (this.config.enableMemorySearch !== false && lastUserMessage) {
      memories = await this.searchRelevantMemories(lastUserMessage, userId);
      this.logger.info(`Found ${memories.length} relevant memories`);
    }

    // Step 3: Inject memory context (cast to work around type complexity)
    const augmentedPrompt =
      memories.length > 0
        ? (injectMemoryContext(
            options.prompt,
            memories,
            this.config,
            this.logger,
          ) as typeof options.prompt)
        : options.prompt;

    // Step 4: Call underlying LLM
    const result = await this.underlyingModel.doGenerate({
      ...options,
      prompt: augmentedPrompt,
    });

    // Step 5: Store conversation (async, don't block)
    if (this.config.enableMemoryStorage !== false) {
      const lastUserMessage = getLastUserMessage(options.prompt);
      if (lastUserMessage && result.text) {
        this.storeConversation(
          lastUserMessage,
          result.text,
          userId,
          conversationId,
        ).catch((error) => {
          this.logger.error("Failed to store memory:", error);
        });
      }
    }

    return result;
  }

  /**
   * Stream text with automatic memory retrieval and storage
   */
  async doStream(
    options: Parameters<LanguageModelV1["doStream"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>> {
    this.logger.debug("doStream called");

    // Step 1: Resolve user context
    const userId = await resolveUserId(this.config, this.logger);
    const conversationId = await resolveConversationId(
      this.config,
      this.logger,
    );

    this.logger.debug(`User: ${userId}, Conversation: ${conversationId}`);

    // Step 2: Search for relevant memories (if enabled)
    let memories: MemoryEntry[] = [];
    const lastUserMessage = getLastUserMessage(options.prompt);

    if (this.config.enableMemorySearch !== false && lastUserMessage) {
      memories = await this.searchRelevantMemories(lastUserMessage, userId);
      this.logger.info(`Found ${memories.length} relevant memories`);
    }

    // Step 3: Inject memory context (cast to work around type complexity)
    const augmentedPrompt =
      memories.length > 0
        ? (injectMemoryContext(
            options.prompt,
            memories,
            this.config,
            this.logger,
          ) as typeof options.prompt)
        : options.prompt;

    // Step 4: Call underlying LLM stream
    const streamResult = await this.underlyingModel.doStream({
      ...options,
      prompt: augmentedPrompt,
    });

    // Step 5: Wrap stream to collect response and store
    if (this.config.enableMemoryStorage !== false && lastUserMessage) {
      const wrappedStream = this.wrapStreamWithMemory(
        streamResult.stream,
        lastUserMessage,
        userId,
        conversationId,
      );

      return {
        ...streamResult,
        stream: wrappedStream,
      };
    }

    return streamResult;
  }

  /**
   * Search for relevant memories
   */
  private async searchRelevantMemories(
    query: string,
    userId: string,
  ): Promise<MemoryEntry[]> {
    try {
      // Generate embedding if configured
      let embedding: number[] | undefined;
      if (this.config.embeddingProvider) {
        try {
          embedding = await this.config.embeddingProvider.generate(query);
          this.logger.debug(
            `Generated embedding for search: ${embedding.length} dimensions`,
          );
        } catch (error) {
          this.logger.warn(
            "Failed to generate embedding, using keyword search:",
            error,
          );
        }
      }

      // Search Cortex
      const memories = await this.cortex.memory.search(
        this.config.memorySpaceId,
        query,
        {
          embedding,
          limit: this.config.memorySearchLimit || 5,
          minScore: this.config.minMemoryRelevance || 0.7,
          userId,
        },
      );

      return memories as MemoryEntry[];
    } catch (error) {
      this.logger.error("Memory search failed:", error);
      // Return empty array to allow LLM call to continue
      return [];
    }
  }

  /**
   * Store conversation (async, non-blocking)
   */
  private async storeConversation(
    userMessage: string,
    agentResponse: string,
    userId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Storing conversation: ${conversationId}`);

      // Prepare extraction functions
      const generateEmbedding = this.config.embeddingProvider
        ? this.config.embeddingProvider.generate
        : undefined;

      const extractFacts = this.config.enableFactExtraction
        ? this.config.extractFacts
        : undefined;

      // Store using Cortex SDK
      const result = await this.cortex.memory.remember(
        {
          memorySpaceId: this.config.memorySpaceId,
          conversationId,
          userMessage,
          agentResponse,
          userId,
          userName: this.config.userName || "User",
          participantId: this.config.hiveMode?.participantId,
          generateEmbedding,
          extractFacts,
          importance: this.config.defaultImportance || 50,
          tags: this.config.defaultTags || [],
        },
        {
          syncToGraph: this.config.enableGraphMemory || false,
        },
      );

      this.logger.info(
        `Stored memory: ${result.memories.length} memories, ${result.facts.length} facts`,
      );
    } catch (error) {
      this.logger.error("Failed to store conversation:", error);
      // Don't throw - storage failure shouldn't break the LLM response
    }
  }

  /**
   * Wrap a stream to collect the response and store it
   */
  private wrapStreamWithMemory(
    originalStream: ReadableStream<LanguageModelV1StreamPart>,
    userMessage: string,
    userId: string,
    conversationId: string,
  ): ReadableStream<LanguageModelV1StreamPart> {
    const textChunks: string[] = [];

    const transformStream = new TransformStream<
      LanguageModelV1StreamPart,
      LanguageModelV1StreamPart
    >({
      transform: (chunk, controller) => {
        // Collect text chunks
        if (chunk.type === "text-delta") {
          textChunks.push(chunk.textDelta);
        }

        // Forward chunk downstream
        controller.enqueue(chunk);
      },

      flush: async () => {
        // Stream completed - store the conversation
        const fullResponse = textChunks.join("");

        if (fullResponse.trim().length > 0) {
          await this.storeConversation(
            userMessage,
            fullResponse,
            userId,
            conversationId,
          );
        } else {
          this.logger.warn("Stream completed but produced no text content");
        }
      },
    });

    return originalStream.pipeThrough(transformStream);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Delegate remaining methods to underlying model
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  get supportsStructuredOutputs() {
    return this.underlyingModel.supportsStructuredOutputs ?? false;
  }

  get supportsImageUrls() {
    return this.underlyingModel.supportsImageUrls ?? false;
  }

  /**
   * Close Cortex connection
   */
  close(): void {
    this.cortex.close();
  }
}
