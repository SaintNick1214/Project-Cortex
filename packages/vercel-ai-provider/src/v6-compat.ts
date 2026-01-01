/**
 * AI SDK v6 Compatibility Layer
 *
 * This module provides helpers and type utilities for integrating
 * Cortex Memory with AI SDK v6's new Agent architecture while
 * maintaining backward compatibility with v5.
 *
 * @module v6-compat
 * @since 0.27.0
 */

import type { CortexMemoryConfig } from "./types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI SDK v6 Type Re-exports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if AI SDK v6 is available
 *
 * This allows runtime detection of v6 features without
 * breaking on v5 installations.
 */
export async function isV6Available(): Promise<boolean> {
  try {
    const ai = await import("ai");
    // Check for v6-specific exports
    return (
      "ToolLoopAgent" in ai ||
      "createAgentUIStreamResponse" in ai ||
      "Output" in ai
    );
  } catch {
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cortex-specific Call Options Schema
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Standard call options for Cortex memory-enabled agents.
 *
 * When using ToolLoopAgent with Cortex, these options can be
 * passed at runtime to configure memory retrieval and storage.
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { CortexCallOptionsSchema } from '@cortexmemory/vercel-ai-provider';
 *
 * const myAgent = new ToolLoopAgent({
 *   model: 'openai/gpt-4o-mini',
 *   callOptionsSchema: CortexCallOptionsSchema,
 *   prepareCall: async ({ options, ...settings }) => {
 *     // Inject memories into context
 *     const memories = await fetchMemories(options.userId, options.memorySpaceId);
 *     return { ...settings, instructions: `${settings.instructions}\n\n${memories}` };
 *   },
 * });
 *
 * await myAgent.generate({
 *   prompt: 'What do you remember about me?',
 *   options: {
 *     userId: 'user_123',
 *     memorySpaceId: 'my-app',
 *   },
 * });
 * ```
 */
export interface CortexCallOptions {
  /** User ID for memory isolation */
  userId: string;

  /** Memory space ID for data partitioning */
  memorySpaceId: string;

  /** Optional conversation ID for session continuity */
  conversationId?: string;

  /** Optional agent ID (defaults to agent's id property) */
  agentId?: string;
}

/**
 * Create a Zod schema for Cortex call options.
 *
 * Use this with ToolLoopAgent's callOptionsSchema for type-safe
 * runtime configuration of memory operations.
 *
 * @example
 * ```typescript
 * import { createCortexCallOptionsSchema } from '@cortexmemory/vercel-ai-provider';
 *
 * const myAgent = new ToolLoopAgent({
 *   model: 'anthropic/claude-sonnet-4.5',
 *   callOptionsSchema: createCortexCallOptionsSchema(),
 *   // ...
 * });
 * ```
 */
export function createCortexCallOptionsSchema() {
  // Dynamic import to avoid requiring zod at module load
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { z } = require("zod");

  return z.object({
    userId: z.string().describe("User ID for memory isolation"),
    memorySpaceId: z.string().describe("Memory space ID for data partitioning"),
    conversationId: z
      .string()
      .optional()
      .describe("Conversation ID for session continuity"),
    agentId: z
      .string()
      .optional()
      .describe("Agent ID (defaults to agent's id property)"),
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent UI Message Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Cortex-specific message metadata attached to UI messages.
 *
 * This metadata can be accessed in your UI components when
 * rendering messages from a Cortex-enabled agent.
 */
export interface CortexMessageMetadata {
  /** Memories retrieved for this message */
  memoriesUsed?: number;

  /** Facts extracted from this message */
  factsExtracted?: number;

  /** Whether the response was augmented with memory */
  memoryAugmented?: boolean;

  /** Memory layer processing info (for visualization) */
  layerInfo?: {
    orchestrationId?: string;
    totalLatencyMs?: number;
  };
}

/**
 * Type helper for inferring UI message types from an agent.
 *
 * Re-export from AI SDK v6 when available, otherwise provide
 * a compatible type definition.
 *
 * @example
 * ```typescript
 * import { InferAgentUIMessage } from '@cortexmemory/vercel-ai-provider';
 * import { myAgent } from './agents/my-agent';
 *
 * type MyAgentMessage = InferAgentUIMessage<typeof myAgent>;
 *
 * // Use in your component
 * const { messages } = useChat<MyAgentMessage>();
 * ```
 */
export type InferAgentUIMessage<TAgent> = TAgent extends {
  tools: infer Tools;
}
  ? {
      id: string;
      role: "user" | "assistant" | "system";
      createdAt?: Date;
      metadata?: CortexMessageMetadata;
      parts?: Array<
        | { type: "text"; text: string }
        | { type: "tool-invocation"; toolCallId: string; toolName: keyof Tools }
      >;
    }
  : never;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory Injection Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Configuration for the memory injection helper.
 */
export interface MemoryInjectionConfig {
  /** Convex deployment URL */
  convexUrl: string;

  /** Maximum memories to inject (default: 20) */
  maxMemories?: number;

  /** Minimum importance score 0-100 (optional) */
  minImportance?: number;

  /** Include facts in recall (default: true) */
  includeFacts?: boolean;

  /** Include vector memories in recall (default: true) */
  includeVector?: boolean;

  /** Use graph expansion for related context (default: true if graph configured) */
  includeGraph?: boolean;

  /** Custom context formatting (default: uses Cortex's built-in LLM formatting) */
  formatContext?: (recallContext: string) => string;
}

/**
 * Default context formatter - wraps Cortex's recall context.
 * Cortex recall() already returns LLM-optimized markdown.
 */
export function defaultMemoryContextFormatter(recallContext: string): string {
  if (!recallContext) {
    return "";
  }
  return recallContext;
}

/**
 * Create a prepareCall function that injects Cortex memories.
 *
 * This helper creates an async prepareCall function suitable for
 * use with AI SDK v6's ToolLoopAgent. It uses Cortex's `memory.recall()`
 * orchestration API to fetch and inject context from all memory layers
 * (vector, facts, graph) in a single call.
 *
 * The recall() API automatically:
 * - Searches vector memories and facts in parallel
 * - Expands through graph relationships
 * - Merges, deduplicates, and ranks results
 * - Formats context for LLM injection
 *
 * @param config - Memory injection configuration
 * @returns A prepareCall function for ToolLoopAgent
 *
 * @example
 * ```typescript
 * import { ToolLoopAgent } from 'ai';
 * import { createMemoryPrepareCall, createCortexCallOptionsSchema } from '@cortexmemory/vercel-ai-provider';
 *
 * const myAgent = new ToolLoopAgent({
 *   model: 'openai/gpt-4o-mini',
 *   instructions: 'You are a helpful assistant with long-term memory.',
 *   callOptionsSchema: createCortexCallOptionsSchema(),
 *   prepareCall: createMemoryPrepareCall({
 *     convexUrl: process.env.CONVEX_URL!,
 *     maxMemories: 20,
 *   }),
 * });
 * ```
 */
export function createMemoryPrepareCall(config: MemoryInjectionConfig) {
  const {
    convexUrl,
    maxMemories = 20,
    minImportance,
    includeFacts = true,
    includeVector = true,
    includeGraph = true,
    formatContext = defaultMemoryContextFormatter,
  } = config;

  return async <T extends { options: CortexCallOptions; instructions?: string; messages?: unknown[] }>(
    settings: T
  ): Promise<T> => {
    const { options, instructions = "", messages = [], ...rest } = settings;

    // Extract query from the last user message
    const lastUserMessage = [...messages].reverse().find(
      (m: unknown) => (m as { role: string }).role === "user"
    ) as { content?: string; parts?: Array<{ type: string; text?: string }> } | undefined;

    let query = "";
    if (lastUserMessage) {
      if (typeof lastUserMessage.content === "string") {
        query = lastUserMessage.content;
      } else if (lastUserMessage.parts) {
        query = lastUserMessage.parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text)
          .join(" ");
      }
    }

    // If no query, nothing to recall
    if (!query) {
      return settings;
    }

    try {
      // Dynamic import to avoid bundling issues
      const { Cortex } = await import("@cortexmemory/sdk");
      const cortex = new Cortex({ convexUrl });

      // Use the recall() orchestration API - searches all layers in parallel
      // and returns unified, ranked, LLM-ready context
      const recallResult = await cortex.memory.recall({
        memorySpaceId: options.memorySpaceId,
        query,
        userId: options.userId,
        limit: maxMemories,
        minImportance,
        sources: {
          vector: includeVector,
          facts: includeFacts,
          graph: includeGraph,
        },
        formatForLLM: true, // Get pre-formatted context string
      });

      // Inject the recall context into instructions
      const contextBlock = formatContext(recallResult.context || "");
      const augmentedInstructions = contextBlock
        ? `${instructions}\n\n${contextBlock}`
        : instructions;

      return {
        ...rest,
        options,
        instructions: augmentedInstructions,
        messages,
      } as T;
    } catch (error) {
      // If memory recall fails, continue without augmentation
      console.warn("[Cortex] Memory recall failed:", error);
      return settings;
    }
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// v6 API Route Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Options for creating an agent UI stream response with Cortex.
 */
export interface CortexAgentStreamOptions {
  /** The agent to run */
  agent: unknown;

  /** UI messages from the client */
  messages: unknown[];

  /** Cortex-specific options */
  cortexOptions: CortexCallOptions;

  /** Additional request body fields */
  additionalBody?: Record<string, unknown>;

  /** Response headers */
  headers?: Record<string, string>;
}

/**
 * Helper to create an agent UI stream response with Cortex options.
 *
 * This wraps AI SDK v6's createAgentUIStreamResponse and passes
 * Cortex-specific options to the agent.
 *
 * @example
 * ```typescript
 * // app/api/chat/route.ts
 * import { createCortexAgentStreamResponse } from '@cortexmemory/vercel-ai-provider';
 * import { myAgent } from '@/agents/my-agent';
 *
 * export async function POST(req: Request) {
 *   const { messages, userId, memorySpaceId, conversationId } = await req.json();
 *
 *   return createCortexAgentStreamResponse({
 *     agent: myAgent,
 *     messages,
 *     cortexOptions: {
 *       userId,
 *       memorySpaceId,
 *       conversationId,
 *     },
 *   });
 * }
 * ```
 */
export async function createCortexAgentStreamResponse(
  options: CortexAgentStreamOptions
): Promise<Response> {
  const { agent, messages, cortexOptions, headers } = options;

  // Dynamic import to support both v5 and v6
  const ai = await import("ai");

  if ("createAgentUIStreamResponse" in ai) {
    // v6 path
    const createAgentUIStreamResponse = ai.createAgentUIStreamResponse as (
      opts: {
        agent: unknown;
        messages: unknown[];
        options?: CortexCallOptions;
      }
    ) => Promise<Response>;

    return createAgentUIStreamResponse({
      agent,
      messages,
      options: cortexOptions,
    });
  }

  // Fallback error for v5
  throw new Error(
    "createCortexAgentStreamResponse requires AI SDK v6. " +
      "For v5, use createUIMessageStreamResponse with streamText instead."
  );
}
