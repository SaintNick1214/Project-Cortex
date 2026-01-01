/**
 * Memory-Enabled Agent (AI SDK v6)
 *
 * This file demonstrates how to create a reusable agent with
 * Cortex Memory integration using AI SDK v6's ToolLoopAgent.
 *
 * The agent:
 * - Automatically injects relevant memories into context
 * - Can be used with both generate() and stream()
 * - Supports type-safe call options for userId, memorySpaceId, etc.
 *
 * @example
 * ```typescript
 * const result = await memoryAgent.generate({
 *   prompt: 'What do you remember about me?',
 *   options: {
 *     userId: 'user_123',
 *     memorySpaceId: 'my-app',
 *   },
 * });
 * ```
 */

import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  createCortexCallOptionsSchema,
  createMemoryPrepareCall,
  type CortexCallOptions,
} from "@cortexmemory/vercel-ai-provider";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Agent Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYSTEM_PROMPT = `You are a helpful AI assistant with long-term memory powered by Cortex.

Your capabilities:
- You remember everything users tell you across conversations
- You can recall facts, preferences, and context from past interactions
- You naturally reference what you've learned about the user

Behavior guidelines:
- When you remember something from a previous conversation, mention it naturally
- If asked about something you learned, reference it specifically
- Be conversational and friendly
- Help demonstrate the memory system by showing what you remember`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory Agent Definition
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * A memory-enabled agent using AI SDK v6's ToolLoopAgent.
 *
 * This agent demonstrates:
 * - callOptionsSchema for type-safe runtime config (userId, memorySpaceId, etc.)
 * - prepareCall for automatic memory context injection via Cortex's recall() API
 * - Built-in tools for memory operations (optional)
 *
 * The callOptionsSchema ensures TypeScript type safety when calling the agent:
 * - userId: required for memory isolation per user
 * - memorySpaceId: required for data partitioning
 * - conversationId: optional for session continuity
 * - agentId: optional agent identifier
 */
export const memoryAgent = new ToolLoopAgent({
  id: "cortex-memory-agent",
  model: openai("gpt-4o-mini"),
  instructions: SYSTEM_PROMPT,

  // ┌─────────────────────────────────────────────────────────────────┐
  // │ callOptionsSchema: Type-Safe Runtime Configuration             │
  // │                                                                 │
  // │ This Zod schema defines what options must/can be passed when   │
  // │ calling the agent. AI SDK v6 validates these at runtime.       │
  // │                                                                 │
  // │ Example usage:                                                  │
  // │   await memoryAgent.generate({                                 │
  // │     prompt: 'Hello!',                                          │
  // │     options: { userId: 'u1', memorySpaceId: 'app1' }, // typed!│
  // │   });                                                          │
  // └─────────────────────────────────────────────────────────────────┘
  callOptionsSchema: createCortexCallOptionsSchema(),

  // ┌─────────────────────────────────────────────────────────────────┐
  // │ prepareCall: Memory Context Injection                          │
  // │                                                                 │
  // │ Called before each agent invocation. This hook:                │
  // │ 1. Extracts the user's query from messages                     │
  // │ 2. Calls Cortex memory.recall() with userId + memorySpaceId    │
  // │ 3. Injects the returned context into instructions              │
  // │                                                                 │
  // │ The recall() API orchestrates all memory layers:               │
  // │ - Vector memories (semantic search)                            │
  // │ - Facts (extracted knowledge)                                  │
  // │ - Graph relationships (if configured)                          │
  // └─────────────────────────────────────────────────────────────────┘
  prepareCall: createMemoryPrepareCall({
    convexUrl: process.env.CONVEX_URL!,
    maxMemories: 20,     // Max items to inject from recall
    includeFacts: true,  // Include Layer 3 facts
    includeVector: true, // Include Layer 2 vector memories
    includeGraph: true,  // Expand through graph relationships
  }),

  // Default to 5 steps (sufficient for most chat interactions)
  stopWhen: stepCountIs(5),

  // Optional: Add memory-specific tools for explicit memory operations
  // Uncomment to let the agent actively search/store memories
  /*
  tools: {
    searchMemory: tool({
      description: 'Search for specific memories about the user',
      inputSchema: z.object({
        query: z.string().describe('What to search for in memory'),
      }),
      execute: async ({ query }, { options }) => {
        const { Cortex } = await import('@cortexmemory/sdk');
        const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
        const result = await cortex.memory.recall({
          memorySpaceId: options.memorySpaceId,
          query,
          userId: options.userId,
          limit: 5,
        });
        return result.context || 'No memories found.';
      },
    }),
  },
  */
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Type Exports for Client Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Inferred UIMessage type for this agent.
 *
 * Use this in your client components for full type safety:
 *
 * ```typescript
 * import { useChat } from '@ai-sdk/react';
 * import type { MemoryAgentUIMessage } from '@/lib/agents/memory-agent';
 *
 * const { messages } = useChat<MemoryAgentUIMessage>();
 * ```
 */
export type MemoryAgentUIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  createdAt?: Date;
  parts?: Array<
    | { type: "text"; text: string }
    | { type: "tool-invocation"; toolCallId: string; state: string }
  >;
};

/**
 * Re-export call options type for convenience.
 */
export type { CortexCallOptions };
