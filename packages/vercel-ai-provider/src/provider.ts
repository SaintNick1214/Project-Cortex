/**
 * Cortex Memory Provider for Vercel AI SDK
 *
 * Wraps language models with automatic memory retrieval and storage
 */

import { Cortex } from "@cortexmemory/sdk";
import type { RecallResult } from "@cortexmemory/sdk";
import type {
  CortexMemoryConfig,
  Logger,
  LayerEvent,
  MemoryLayer,
  OrchestrationSummary,
  RevisionAction,
} from "./types";
import {
  resolveUserId,
  resolveConversationId,
  resolveAgentId,
  resolveAgentName,
  getLastUserMessage,
} from "./memory-middleware";
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
  private agentId: string;
  private agentName: string;

  constructor(underlyingModel: any, config: CortexMemoryConfig) {
    this.underlyingModel = underlyingModel;
    this.config = config;
    this.logger = config.logger || createLogger(config.debug || false);
    this.provider = underlyingModel.provider;
    this.modelId = underlyingModel.modelId;
    this.specificationVersion = underlyingModel.specificationVersion;
    this.defaultObjectGenerationMode =
      underlyingModel.defaultObjectGenerationMode;

    // Resolve agent identity (required for user-agent conversations)
    this.agentId = resolveAgentId(config);
    this.agentName = resolveAgentName(config);

    // Initialize Cortex SDK
    this.cortex = new Cortex({ convexUrl: config.convexUrl });

    this.logger.debug(
      `Initialized CortexMemoryProvider for model: ${this.modelId}, agent: ${this.agentId}`,
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

    // Step 2: Recall relevant context (if enabled)
    let recallResult: RecallResult | null = null;
    const lastUserMessage = getLastUserMessage(options.prompt);

    if (this.config.enableMemorySearch !== false && lastUserMessage) {
      recallResult = await this.recallContext(lastUserMessage, userId);
      this.logger.info(
        `Recalled ${recallResult?.totalResults || 0} items from memory`,
      );
    }

    // Step 3: Inject memory context using recall()'s pre-formatted context
    const augmentedPrompt = recallResult?.context
      ? this.injectRecallContext(options.prompt, recallResult.context)
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
        // Notify layer observer of orchestration start
        const orchestrationId = `orch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.notifyLayerObserver("memorySpace", "pending", orchestrationId);

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
              agentId: this.agentId, // Required for user-agent conversations (SDK v0.17.0+)
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
              // Belief revision (v0.24.0+) - automatically handle fact updates/supersessions
              // Note: Type assertion needed until SDK v0.24.0 is published to npm
              beliefRevision:
                this.config.beliefRevision !== false
                  ? this.config.beliefRevision
                  : undefined,
            } as any,
          )
          .then((result: any) => {
            // Notify layer observer of completion
            this.notifyLayerObserver(
              "conversation",
              "complete",
              orchestrationId,
            );
            this.notifyLayerObserver("vector", "complete", orchestrationId);
            if (this.config.enableFactExtraction) {
              this.notifyLayerObserver("facts", "complete", orchestrationId);
            }
            if (this.config.enableGraphMemory) {
              this.notifyLayerObserver("graph", "complete", orchestrationId);
            }
          })
          .catch((error: Error) => {
            this.logger.error("Failed to store memory:", error);
            this.notifyLayerObserver(
              "conversation",
              "error",
              orchestrationId,
              undefined,
              error.message,
            );
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

    // Step 2: Recall relevant context (if enabled)
    let recallResult: RecallResult | null = null;
    const lastUserMessage = getLastUserMessage(options.prompt);

    if (this.config.enableMemorySearch !== false && lastUserMessage) {
      recallResult = await this.recallContext(lastUserMessage, userId);
      this.logger.info(
        `Recalled ${recallResult?.totalResults || 0} items from memory`,
      );
    }

    // Step 3: Inject memory context using recall()'s pre-formatted context
    const augmentedPrompt = recallResult?.context
      ? this.injectRecallContext(options.prompt, recallResult.context)
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
   * Recall context using the unified recall() API
   *
   * This uses cortex.memory.recall() which orchestrates retrieval across all layers:
   * - Vector memories (Layer 2)
   * - Facts (Layer 3) - searched directly, not just as enrichment
   * - Graph relationships (Layer 4) - if configured
   *
   * Returns a RecallResult with pre-formatted LLM context.
   */
  private async recallContext(
    query: string,
    userId: string,
  ): Promise<RecallResult | null> {
    try {
      // Generate embedding if configured (recommended for better relevance)
      let embedding: number[] | undefined;
      if (this.config.embeddingProvider) {
        try {
          embedding = await this.config.embeddingProvider.generate(query);
          this.logger.debug(
            `Generated embedding for recall: ${embedding.length} dimensions`,
          );
        } catch (error) {
          this.logger.warn(
            "Failed to generate embedding, recall will use keyword search:",
            error,
          );
        }
      }

      // Use recall() for full orchestrated retrieval across all layers
      const result = await this.cortex.memory.recall({
        memorySpaceId: this.config.memorySpaceId,
        query,
        embedding,
        userId,
        limit: this.config.memorySearchLimit || 20,
        // Note: minMemoryRelevance is applied internally by the vector search
        // recall() uses sensible defaults: vector + facts + graph (if configured)
        // No need to explicitly enable sources - batteries included
        formatForLLM: true, // Get pre-formatted context string
        includeConversation: true, // Include ACID conversation data
      });

      this.logger.debug(
        `Recall complete: ${result.totalResults} items in ${result.queryTimeMs}ms ` +
          `(vector: ${result.sources.vector.count}, facts: ${result.sources.facts.count}, ` +
          `graph: ${result.sources.graph.count})`,
      );

      return result;
    } catch (error) {
      this.logger.error("Memory recall failed:", error);
      // Return null to allow LLM call to continue without context
      return null;
    }
  }

  /**
   * Inject recall context into the prompt
   *
   * Uses the pre-formatted context string from recall() result.
   */
  private injectRecallContext(messages: any[], contextString: string): any[] {
    if (!contextString) {
      return messages;
    }

    const strategy = this.config.contextInjectionStrategy || "system";

    if (strategy === "system") {
      // Check if first message is system message
      const hasSystemMessage =
        messages.length > 0 && messages[0].role === "system";

      if (hasSystemMessage) {
        // Append to existing system message
        this.logger.debug(
          "Injecting recall context into existing system message",
        );
        return [
          {
            ...messages[0],
            content: `${messages[0].content}\n\n${contextString}`,
          },
          ...messages.slice(1),
        ];
      } else {
        // Create new system message at start
        this.logger.debug("Creating new system message with recall context");
        return [
          {
            role: "system" as const,
            content: contextString,
          },
          ...messages,
        ];
      }
    } else if (strategy === "user") {
      // Append to last user message
      const lastUserIndex = messages.findLastIndex(
        (m: any) => m.role === "user",
      );

      if (lastUserIndex === -1) {
        this.logger.warn("No user message found, cannot inject context");
        return messages;
      }

      this.logger.debug(
        `Injecting recall context into user message at index ${lastUserIndex}`,
      );

      return [
        ...messages.slice(0, lastUserIndex),
        {
          ...messages[lastUserIndex],
          content: `${messages[lastUserIndex].content}\n\nRelevant context:\n${contextString}`,
        },
        ...messages.slice(lastUserIndex + 1),
      ];
    }

    // Default: return original messages
    return messages;
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
        // Note: Type assertion needed until SDK v0.24.0 is published to npm
        const streamingOptions = {
          syncToGraph: this.config.enableGraphMemory || false,
          // Belief revision (v0.24.0+) - automatically handle fact updates/supersessions
          beliefRevision:
            this.config.beliefRevision !== false
              ? this.config.beliefRevision
              : undefined,
          ...this.config.streamingOptions,
          hooks: this.config.streamingHooks,
        } as any;

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
              agentId: this.config.agentId, // Required for user-agent conversations (SDK v0.17.0+)
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
   * Notify layer observer of status changes
   *
   * Used by the quickstart demo to visualize data flowing
   * through the Cortex memory system in real-time.
   */
  private notifyLayerObserver(
    layer: MemoryLayer,
    status: "pending" | "in_progress" | "complete" | "error" | "skipped",
    orchestrationId: string,
    data?: {
      id?: string;
      preview?: string;
      metadata?: Record<string, unknown>;
    },
    errorMessage?: string,
    revisionInfo?: {
      action?: RevisionAction;
      supersededFacts?: string[];
    },
  ): void {
    if (!this.config.layerObserver?.onLayerUpdate) {
      return;
    }

    const event: LayerEvent = {
      layer,
      status,
      timestamp: Date.now(),
      data,
      error: errorMessage ? { message: errorMessage } : undefined,
      revisionAction: revisionInfo?.action,
      supersededFacts: revisionInfo?.supersededFacts,
    };

    try {
      this.config.layerObserver.onLayerUpdate(event);
    } catch (e) {
      this.logger.warn("Layer observer callback failed:", e);
    }
  }

  /**
   * Close Cortex connection
   */
  close(): void {
    this.cortex.close();
  }
}
