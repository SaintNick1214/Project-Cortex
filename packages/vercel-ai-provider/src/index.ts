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
 * });
 *
 * // Use the augmented model
 * const result = await streamText({
 *   model: cortexMemory(openai('gpt-4')),
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
} from "./middleware";
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
 * });
 *
 * // Use with streamText
 * const result = await streamText({
 *   model: cortexMemory(openai('gpt-4')),
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

// Re-export types for convenience
export type {
  CortexMemoryConfig,
  CortexMemoryModel,
  ManualMemorySearchOptions,
  ManualRememberOptions,
  ManualClearOptions,
  ContextInjectionStrategy,
  SupportedProvider,
} from "./types";

export { CortexMemoryProvider } from "./provider";
