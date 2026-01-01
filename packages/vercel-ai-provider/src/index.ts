/**
 * Cortex Memory Provider for Vercel AI SDK
 *
 * @example
 * ```typescript
 * import { createCortexMemory } from '@cortexmemory/vercel-ai-provider';
 * import { streamText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const cortexMemory = createCortexMemory({
 *   convexUrl: process.env.CONVEX_URL!,
 *   memorySpaceId: 'my-agent',
 *   userId: 'user-123',
 *   userName: 'User',
 *   agentId: 'my-assistant', // Required for user-agent conversations (SDK v0.17.0+)
 * });
 *
 * // Use the augmented model
 * const result = await streamText({
 *   model: cortexMemory(openai('gpt-4o-mini')),
 *   messages: [{ role: 'user', content: 'What did I tell you about my name?' }],
 * });
 *
 * // Manual memory control
 * const memories = await cortexMemory.search('my preferences');
 * ```
 */

// Types handled dynamically to support all AI SDK versions
import type { MemoryEntry } from "@cortexmemory/sdk";
import { Cortex } from "@cortexmemory/sdk";
import type {
  CortexMemoryConfig,
  CortexMemoryModel,
  ManualMemorySearchOptions,
  ManualRememberOptions,
  ManualClearOptions,
} from "./types";
import { CortexMemoryProvider } from "./provider";
import {
  validateConfig,
  resolveUserId,
  resolveConversationId,
} from "./memory-middleware";
import { createLogger } from "./types";

/**
 * Create a Cortex Memory-augmented model factory
 *
 * @param config - Cortex memory configuration
 * @returns Model factory function with manual memory control methods
 *
 * @example
 * ```typescript
 * import { createCortexMemory } from '@cortexmemory/vercel-ai-provider';
 * import { streamText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const cortexMemory = createCortexMemory({
 *   convexUrl: process.env.CONVEX_URL!,
 *   memorySpaceId: 'my-chatbot',
 *   userId: () => getCurrentUserId(), // Can be async function
 *   userName: 'User',
 *   agentId: 'my-assistant', // Required for user-agent conversations
 *
 *   // Optional: Embedding provider
 *   embeddingProvider: {
 *     generate: async (text) => {
 *       const { embedding } = await embed({
 *         model: openai.embedding('text-embedding-3-small'),
 *         value: text,
 *       });
 *       return embedding;
 *     },
 *   },
 *
 *   // Optional: Enable graph memory sync
 *   enableGraphMemory: process.env.CORTEX_GRAPH_SYNC === 'true',
 *
 *   // Optional: Enable fact extraction
 *   enableFactExtraction: process.env.CORTEX_FACT_EXTRACTION === 'true',
 * });
 *
 * // Use with streamText
 * const result = await streamText({
 *   model: cortexMemory(openai('gpt-4o-mini')),
 *   messages,
 * });
 *
 * // Or manually control memory
 * const memories = await cortexMemory.search('user preferences');
 * await cortexMemory.remember('My name is Alice', 'Nice to meet you!');
 * ```
 */
export function createCortexMemory(
  config: CortexMemoryConfig,
): CortexMemoryModel {
  // Validate configuration
  validateConfig(config);

  const logger = config.logger || createLogger(config.debug || false);
  logger.debug("Creating Cortex Memory provider");

  // Initialize Cortex SDK (shared instance)
  const cortex = new Cortex({ convexUrl: config.convexUrl });

  /**
   * Main function: Wrap a language model with memory
   */
  const cortexMemory: CortexMemoryModel = Object.assign(
    (underlyingModel: any, settings?: Record<string, unknown>): any => {
      logger.debug(`Wrapping model: ${underlyingModel.modelId}`);

      // Create memory-augmented provider
      return new CortexMemoryProvider(underlyingModel, config);
    },
    {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Manual Memory Control Methods
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      search: async (
        query: string,
        options?: ManualMemorySearchOptions,
      ): Promise<MemoryEntry[]> => {
        logger.debug(`Manual search: "${query}"`);

        try {
          // Generate embedding if configured
          let embedding: number[] | undefined;
          if (options?.embedding) {
            embedding = options.embedding;
          } else if (config.embeddingProvider) {
            embedding = await config.embeddingProvider.generate(query);
          }

          const memories = await cortex.memory.search(
            config.memorySpaceId,
            query,
            {
              embedding,
              limit: options?.limit || config.memorySearchLimit || 10,
              minScore: options?.minScore || config.minMemoryRelevance || 0.7,
              userId: options?.userId,
              tags: options?.tags,
              sourceType: options?.sourceType,
              minImportance: options?.minImportance,
            },
          );

          logger.info(`Manual search found ${memories.length} memories`);
          return memories as MemoryEntry[];
        } catch (error) {
          logger.error("Manual search failed:", error);
          throw error;
        }
      },

      remember: async (
        userMessage: string,
        agentResponse: string,
        options?: ManualRememberOptions,
      ): Promise<void> => {
        logger.debug("Manual remember called");

        try {
          const userId = await resolveUserId(config, logger);
          const conversationId =
            options?.conversationId ||
            (await resolveConversationId(config, logger));

          const generateEmbedding =
            options?.generateEmbedding || config.embeddingProvider?.generate;

          const extractFacts = options?.extractFacts || config.extractFacts;

          await cortex.memory.remember(
            {
              memorySpaceId: config.memorySpaceId,
              conversationId,
              userMessage,
              agentResponse,
              userId,
              userName: config.userName || "User",
              agentId: config.agentId, // Required for user-agent conversations (SDK v0.17.0+)
              participantId: config.hiveMode?.participantId,
              generateEmbedding,
              extractFacts: extractFacts as any,
              importance: config.defaultImportance || 50,
              tags: config.defaultTags || [],
            },
            {
              syncToGraph:
                options?.syncToGraph ?? config.enableGraphMemory ?? false,
            },
          );

          logger.info("Manual remember completed");
        } catch (error) {
          logger.error("Manual remember failed:", error);
          throw error;
        }
      },

      getMemories: async (options?: {
        limit?: number;
      }): Promise<MemoryEntry[]> => {
        logger.debug("Getting all memories");

        try {
          const memories = await cortex.memory.list({
            memorySpaceId: config.memorySpaceId,
            limit: options?.limit || 100,
          });

          logger.info(`Retrieved ${memories.length} memories`);
          return memories as MemoryEntry[];
        } catch (error) {
          logger.error("Failed to get memories:", error);
          throw error;
        }
      },

      clearMemories: async (options?: ManualClearOptions): Promise<number> => {
        logger.debug("Clearing memories");

        if (!options?.confirm) {
          throw new Error(
            "clearMemories requires { confirm: true } to prevent accidental deletion",
          );
        }

        try {
          const result = await cortex.memory.deleteMany({
            memorySpaceId: config.memorySpaceId,
            userId: options.userId,
            sourceType: options.sourceType,
          });

          logger.info(`Cleared ${result.deleted} memories`);
          return result.deleted;
        } catch (error) {
          logger.error("Failed to clear memories:", error);
          throw error;
        }
      },

      getConfig: (): Readonly<CortexMemoryConfig> => {
        return Object.freeze({ ...config });
      },
    },
  );

  return cortexMemory;
}

/**
 * Create a Cortex Memory-augmented model factory with async initialization
 *
 * Use this when you want automatic graph database configuration from environment variables.
 * The async factory allows for connection setup before returning the model factory.
 *
 * @param config - Cortex memory configuration
 * @returns Promise of model factory function with manual memory control methods
 *
 * @example
 * ```typescript
 * import { createCortexMemoryAsync } from '@cortexmemory/vercel-ai-provider';
 *
 * // With env vars: CORTEX_GRAPH_SYNC=true, NEO4J_URI=bolt://localhost:7687
 * const cortexMemory = await createCortexMemoryAsync({
 *   convexUrl: process.env.CONVEX_URL!,
 *   memorySpaceId: 'my-chatbot',
 *   userId: 'user-123',
 *   userName: 'User',
 *   agentId: 'my-assistant',
 *   enableGraphMemory: true, // This will now work!
 * });
 *
 * // Graph is automatically configured from env vars!
 * ```
 */
export async function createCortexMemoryAsync(
  config: CortexMemoryConfig,
): Promise<CortexMemoryModel> {
  // Validate configuration
  validateConfig(config);

  const logger = config.logger || createLogger(config.debug || false);
  logger.debug("Creating Cortex Memory provider (async)");

  // Use Cortex.create() for async initialization with auto-graph config
  // This handles graph adapter creation/connection from env vars
  const cortex = await Cortex.create({ convexUrl: config.convexUrl });

  logger.debug(
    "Cortex SDK initialized" +
      (config.enableGraphMemory ? " (graph support requested)" : ""),
  );

  // Return the model factory that creates providers with the shared Cortex instance
  const cortexMemory: CortexMemoryModel = Object.assign(
    (underlyingModel: any, settings?: Record<string, unknown>): any => {
      logger.debug(`Wrapping model: ${underlyingModel.modelId}`);
      // Create provider with the pre-initialized Cortex instance (includes graph adapter)
      return new CortexMemoryProvider(underlyingModel, config, cortex);
    },
    {
      search: async (
        query: string,
        options?: ManualMemorySearchOptions,
      ): Promise<MemoryEntry[]> => {
        logger.debug(`Manual search: "${query}"`);

        try {
          let embedding: number[] | undefined;
          if (options?.embedding) {
            embedding = options.embedding;
          } else if (config.embeddingProvider) {
            embedding = await config.embeddingProvider.generate(query);
          }

          const memories = await cortex.memory.search(
            config.memorySpaceId,
            query,
            {
              embedding,
              limit: options?.limit || config.memorySearchLimit || 10,
              minScore: options?.minScore || config.minMemoryRelevance || 0.7,
              userId: options?.userId,
              tags: options?.tags,
              sourceType: options?.sourceType,
              minImportance: options?.minImportance,
            },
          );

          logger.info(`Manual search found ${memories.length} memories`);
          return memories as MemoryEntry[];
        } catch (error) {
          logger.error("Manual search failed:", error);
          throw error;
        }
      },

      remember: async (
        userMessage: string,
        agentResponse: string,
        options?: ManualRememberOptions,
      ): Promise<void> => {
        logger.debug("Manual remember called");

        try {
          const userId = await resolveUserId(config, logger);
          const conversationId =
            options?.conversationId ||
            (await resolveConversationId(config, logger));

          await cortex.memory.remember(
            {
              memorySpaceId: config.memorySpaceId,
              conversationId,
              userMessage,
              agentResponse,
              userId,
              userName: config.userName || "User",
              agentId: config.agentId,
              participantId: config.hiveMode?.participantId,
              generateEmbedding:
                options?.generateEmbedding ||
                config.embeddingProvider?.generate,
              extractFacts: (options?.extractFacts ||
                config.extractFacts) as any,
              importance: config.defaultImportance || 50,
              tags: config.defaultTags || [],
            },
            {
              syncToGraph:
                options?.syncToGraph ?? config.enableGraphMemory ?? false,
            },
          );

          logger.info("Manual remember completed");
        } catch (error) {
          logger.error("Manual remember failed:", error);
          throw error;
        }
      },

      getMemories: async (options?: {
        limit?: number;
      }): Promise<MemoryEntry[]> => {
        logger.debug("Getting all memories");

        try {
          const memories = await cortex.memory.list({
            memorySpaceId: config.memorySpaceId,
            limit: options?.limit || 100,
          });

          logger.info(`Retrieved ${memories.length} memories`);
          return memories as MemoryEntry[];
        } catch (error) {
          logger.error("Failed to get memories:", error);
          throw error;
        }
      },

      clearMemories: async (options?: ManualClearOptions): Promise<number> => {
        logger.debug("Clearing memories");

        if (!options?.confirm) {
          throw new Error(
            "clearMemories requires { confirm: true } to prevent accidental deletion",
          );
        }

        try {
          const result = await cortex.memory.deleteMany({
            memorySpaceId: config.memorySpaceId,
            userId: options.userId,
            sourceType: options.sourceType,
          });

          logger.info(`Cleared ${result.deleted} memories`);
          return result.deleted;
        } catch (error) {
          logger.error("Failed to clear memories:", error);
          throw error;
        }
      },

      getConfig: (): Readonly<CortexMemoryConfig> => {
        return Object.freeze({ ...config });
      },
    },
  );

  return cortexMemory;
}

// Re-export types for convenience
export type {
  CortexMemoryConfig,
  CortexMemoryModel,
  ManualMemorySearchOptions,
  ManualRememberOptions,
  ManualClearOptions,
  ContextInjectionStrategy,
  SupportedProvider,
  // Layer observation types (for visualization)
  LayerObserver,
  LayerEvent,
  LayerStatus,
  MemoryLayer,
  OrchestrationSummary,
  // Belief revision types (v0.24.0+)
  RevisionAction,
} from "./types";

export { CortexMemoryProvider } from "./provider";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI SDK v6 Compatibility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export {
  // v6 feature detection
  isV6Available,
  // Call options for ToolLoopAgent
  createCortexCallOptionsSchema,
  // Memory injection helpers
  createMemoryPrepareCall,
  defaultMemoryContextFormatter,
  // API route helpers
  createCortexAgentStreamResponse,
} from "./v6-compat";

export type {
  // Types for v6 integration
  CortexCallOptions,
  CortexMessageMetadata,
  InferAgentUIMessage,
  MemoryInjectionConfig,
  CortexAgentStreamOptions,
} from "./v6-compat";
