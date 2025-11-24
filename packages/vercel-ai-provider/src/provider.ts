/**
 * Cortex Memory Provider for Vercel AI SDK
 *
 * Wraps language models with automatic memory retrieval and storage
 */

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
export class CortexMemoryProvider {
  public readonly specificationVersion: string;
  public readonly provider: string;
  public readonly modelId: string;
  public readonly defaultObjectGenerationMode?: string;

  private cortex: Cortex;
  private config: CortexMemoryConfig;
  private logger: Logger;
  private underlyingModel: any;

  constructor(underlyingModel: any, config: CortexMemoryConfig) {
    this.underlyingModel = underlyingModel;
    this.config = config;
    this.logger = config.logger || createLogger(config.debug || false);
    this.provider = underlyingModel.provider;
    this.modelId = underlyingModel.modelId;
    this.specificationVersion = underlyingModel.specificationVersion;
    this.defaultObjectGenerationMode =
      underlyingModel.defaultObjectGenerationMode;

    // Initialize Cortex SDK
    this.cortex = new Cortex({ convexUrl: config.convexUrl });

    this.logger.debug(
      `Initialized CortexMemoryProvider for model: ${this.modelId}`,
    );
  }

  /**
   * Generate text with automatic memory retrieval and storage
   */
  async doGenerate(options: any): Promise<any> {
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
        // Use remember() for non-streaming responses
        this.cortex.memory
          .remember(
            {
              memorySpaceId: this.config.memorySpaceId,
              conversationId,
              userMessage: lastUserMessage,
              agentResponse: result.text,
              userId,
              userName: this.config.userName || "User",
              participantId: this.config.hiveMode?.participantId,
              generateEmbedding: this.config.embeddingProvider?.generate,
              extractFacts: this.config.enableFactExtraction
                ? this.config.extractFacts
                : undefined,
              importance: this.config.defaultImportance,
              tags: this.config.defaultTags,
            },
            {
              syncToGraph: this.config.enableGraphMemory || false,
            },
          )
          .catch((error: Error) => {
            this.logger.error("Failed to store memory:", error);
          });
      }
    }

    return result;
  }

  /**
   * Stream text with automatic memory retrieval and storage
   */
  async doStream(options: any): Promise<any> {
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

    // Step 5: Use rememberStream() for enhanced streaming
    if (this.config.enableMemoryStorage !== false && lastUserMessage) {
      const wrappedStream = this.wrapStreamWithRememberStream(
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
   * Wrap stream with rememberStream for enhanced streaming capabilities
   */
  private wrapStreamWithRememberStream(
    originalStream: ReadableStream<any>,
    userMessage: string,
    userId: string,
    conversationId: string,
  ): ReadableStream<any> {
    const textChunks: string[] = [];

    // Create transform stream that collects text AND forwards chunks
    const transformStream = new TransformStream<any, any>({
      transform: (chunk, controller) => {
        // Extract text from AI SDK chunks (support v3, v4, v5 formats)
        if (chunk.type === "text-delta") {
          textChunks.push(chunk.delta || chunk.textDelta || "");
        } else if (chunk.type === "text") {
          textChunks.push(chunk.text || "");
        }

        // Forward chunk downstream
        controller.enqueue(chunk);
      },

      flush: async (controller) => {
        // Stream completed - create async iterable from collected text
        const fullText = textChunks.join("");

        if (fullText.trim().length === 0) {
          this.logger.warn("Stream completed but produced no text content");
          return;
        }

        // Create simple async iterable for rememberStream
        async function* textStream() {
          yield fullText;
        }

        // Prepare streaming options
        const streamingOptions: any = {
          syncToGraph: this.config.enableGraphMemory || false,
          ...this.config.streamingOptions,
          hooks: this.config.streamingHooks,
        };

        // Call rememberStream and await it to ensure it completes before stream ends
        try {
          const result = await this.cortex.memory.rememberStream(
            {
              memorySpaceId: this.config.memorySpaceId,
              conversationId,
              userMessage,
              responseStream: textStream(),
              userId,
              userName: this.config.userName || "User",
              participantId: this.config.hiveMode?.participantId,
              generateEmbedding: this.config.embeddingProvider?.generate,
              extractFacts: this.config.enableFactExtraction
                ? this.config.extractFacts
                : undefined,
              importance: this.config.defaultImportance,
              tags: this.config.defaultTags,
            },
            streamingOptions,
          );

          // Log streaming results
          if (
            this.config.enableStreamMetrics !== false &&
            (result as any).streamMetrics
          ) {
            this.logger.info("Stream metrics:", (result as any).streamMetrics);
          }
          if ((result as any).performance) {
            this.logger.debug("Performance:", (result as any).performance);
          }
        } catch (error) {
          this.logger.error(
            "Failed to store stream:",
            error instanceof Error ? error : new Error(String(error)),
          );
          // Don't rethrow - storage failure shouldn't break the stream
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
   * Get current configuration (read-only)
   */
  getConfig(): Readonly<CortexMemoryConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Close Cortex connection
   */
  close(): void {
    this.cortex.close();
  }
}
