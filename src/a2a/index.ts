/**
 * A2A Communication API
 *
 * Agent-to-agent communication helpers with optional pub/sub support.
 * Provides convenience wrappers over the memory system with source.type='a2a'.
 *
 * Operations:
 * - send(): Fire-and-forget message (no pub/sub required)
 * - request(): Synchronous request-response (requires pub/sub)
 * - broadcast(): One-to-many communication (pub/sub optimal)
 * - getConversation(): Retrieve conversation history (no pub/sub required)
 */

import type { ConvexClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { api } from "../../convex-dev/_generated/api";

// Type assertion for the a2a module (Convex types regenerated on deploy)
const a2aApi = api as unknown as {
  a2a: {
    send: FunctionReference<"mutation">;
    request: FunctionReference<"mutation">;
    broadcast: FunctionReference<"mutation">;
    getConversation: FunctionReference<"query">;
  };
};
import type {
  A2ASendParams,
  A2AMessage,
  A2ARequestParams,
  A2AResponse,
  A2ABroadcastParams,
  A2ABroadcastResult,
  A2AConversation,
  A2AConversationFilters,
} from "../types";
import { A2ATimeoutError } from "../types";
import {
  validateSendParams,
  validateRequestParams,
  validateBroadcastParams,
  validateAgentId,
  validateConversationFilters,
} from "./validators";

// Re-export for convenience
export { A2AValidationError } from "./validators";

export class A2AAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly _graphAdapter?: unknown,
  ) {}

  /**
   * Send a message from one agent to another.
   * Stores in ACID conversation + both agents' Vector memories.
   *
   * No pub/sub required - this is fire-and-forget.
   *
   * @param params - Send parameters
   * @returns A2A message result
   *
   * @example
   * ```typescript
   * const result = await cortex.a2a.send({
   *   from: "sales-agent",
   *   to: "support-agent",
   *   message: "Customer asking about enterprise pricing",
   *   importance: 70
   * });
   * console.log(`Message ${result.messageId} sent`);
   * ```
   */
  async send(params: A2ASendParams): Promise<A2AMessage> {
    // Client-side validation
    validateSendParams(params);

    // Call backend
    const result = await this.client.mutation(
      a2aApi.a2a.send,
      {
        from: params.from,
        to: params.to,
        message: params.message,
        userId: params.userId,
        contextId: params.contextId,
        importance: params.importance,
        trackConversation: params.trackConversation,
        autoEmbed: params.autoEmbed,
        metadata: params.metadata,
      },
    );

    return result as A2AMessage;
  }

  /**
   * Send a request and wait for response (synchronous request-response).
   *
   * REQUIRES PUB/SUB INFRASTRUCTURE:
   * - Direct Mode: Configure your own Redis/RabbitMQ/NATS adapter
   * - Cloud Mode: Pub/sub infrastructure included automatically
   *
   * @param params - Request parameters
   * @returns A2A response
   * @throws A2ATimeoutError if no response within timeout
   *
   * @example
   * ```typescript
   * try {
   *   const response = await cortex.a2a.request({
   *     from: "finance-agent",
   *     to: "hr-agent",
   *     message: "What is the Q4 budget?",
   *     timeout: 30000
   *   });
   *   console.log(response.response);
   * } catch (error) {
   *   if (error instanceof A2ATimeoutError) {
   *     console.log("HR agent did not respond within timeout");
   *   }
   * }
   * ```
   */
  async request(params: A2ARequestParams): Promise<A2AResponse> {
    // Client-side validation
    validateRequestParams(params);

    try {
      // Call backend
      const result = await this.client.mutation(
        a2aApi.a2a.request,
        {
          from: params.from,
          to: params.to,
          message: params.message,
          timeout: params.timeout,
          retries: params.retries,
          userId: params.userId,
          contextId: params.contextId,
          importance: params.importance,
        },
      );

      // Check for timeout indicator
      const typedResult = result as { timeout?: boolean; messageId?: string };
      if (typedResult.timeout) {
        throw new A2ATimeoutError(
          `Request to ${params.to} timed out after ${params.timeout ?? 30000}ms`,
          typedResult.messageId ?? "unknown",
          params.timeout ?? 30000,
        );
      }

      return result as A2AResponse;
    } catch (error) {
      // Re-throw A2ATimeoutError as-is
      if (error instanceof A2ATimeoutError) {
        throw error;
      }

      // Handle backend error about pub/sub requirement
      if (error instanceof Error) {
        if (error.message.includes("PUBSUB_NOT_CONFIGURED")) {
          // Extract messageId from error message if present
          const messageIdMatch = error.message.match(/messageId: ([a-z0-9-]+)/);
          const messageId = messageIdMatch ? messageIdMatch[1] : "unknown";

          throw new A2ATimeoutError(
            `request() requires pub/sub infrastructure for real-time responses. ` +
              `In Direct Mode, configure your own Redis/RabbitMQ/NATS adapter. ` +
              `In Cloud Mode, pub/sub is included automatically.`,
            messageId,
            params.timeout ?? 30000,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Broadcast a message to multiple agents.
   *
   * REQUIRES PUB/SUB for optimized delivery confirmation.
   * Without pub/sub, messages are stored but delivery is not confirmed.
   *
   * @param params - Broadcast parameters
   * @returns Broadcast result
   *
   * @example
   * ```typescript
   * const result = await cortex.a2a.broadcast({
   *   from: "manager-agent",
   *   to: ["dev-agent-1", "dev-agent-2", "qa-agent"],
   *   message: "Sprint review meeting Friday at 2 PM",
   *   importance: 70
   * });
   * console.log(`Broadcast to ${result.recipients.length} agents`);
   * console.log(`Created ${result.memoriesCreated} total memories`);
   * ```
   */
  async broadcast(params: A2ABroadcastParams): Promise<A2ABroadcastResult> {
    // Client-side validation
    validateBroadcastParams(params);

    // Call backend
    const result = await this.client.mutation(
      a2aApi.a2a.broadcast,
      {
        from: params.from,
        to: params.to,
        message: params.message,
        userId: params.userId,
        contextId: params.contextId,
        importance: params.importance,
        trackConversation: params.trackConversation,
        metadata: params.metadata,
      },
    );

    return result as A2ABroadcastResult;
  }

  /**
   * Get conversation between two agents with filtering.
   *
   * No pub/sub required - this is a database query only.
   *
   * @param agent1 - First agent ID
   * @param agent2 - Second agent ID
   * @param filters - Optional filters
   * @returns A2A conversation with messages
   *
   * @example
   * ```typescript
   * const convo = await cortex.a2a.getConversation(
   *   "finance-agent",
   *   "hr-agent",
   *   {
   *     since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
   *     minImportance: 70,
   *     tags: ["budget"]
   *   }
   * );
   * console.log(`${convo.messageCount} messages exchanged`);
   * ```
   */
  async getConversation(
    agent1: string,
    agent2: string,
    filters?: A2AConversationFilters,
  ): Promise<A2AConversation> {
    // Client-side validation
    validateAgentId(agent1, "agent1");
    validateAgentId(agent2, "agent2");

    if (filters) {
      validateConversationFilters(filters);
    }

    // Call backend
    const result = await this.client.query(
      a2aApi.a2a.getConversation,
      {
        agent1,
        agent2,
        since: filters?.since ? filters.since.getTime() : undefined,
        until: filters?.until ? filters.until.getTime() : undefined,
        minImportance: filters?.minImportance,
        tags: filters?.tags,
        userId: filters?.userId,
        limit: filters?.limit,
        offset: filters?.offset,
      },
    );

    return result as A2AConversation;
  }
}
