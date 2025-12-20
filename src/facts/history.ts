/**
 * Cortex SDK - Fact History Service
 *
 * SDK wrapper for fact change history operations.
 * Provides audit trail for belief revision decisions.
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type { ResilienceLayer } from "../resilience";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fact change action types
 */
export type FactChangeAction = "CREATE" | "UPDATE" | "SUPERSEDE" | "DELETE";

/**
 * Pipeline information for a change event
 */
export interface FactChangePipeline {
  slotMatching?: boolean;
  semanticMatching?: boolean;
  llmResolution?: boolean;
}

/**
 * Fact change event record
 */
export interface FactChangeEvent {
  eventId: string;
  factId: string;
  memorySpaceId: string;
  action: FactChangeAction;
  oldValue?: string;
  newValue?: string;
  supersededBy?: string;
  supersedes?: string;
  reason?: string;
  confidence?: number;
  pipeline?: FactChangePipeline;
  userId?: string;
  participantId?: string;
  conversationId?: string;
  timestamp: number;
}

/**
 * Parameters for logging a change event
 */
export interface LogEventParams {
  factId: string;
  memorySpaceId: string;
  action: FactChangeAction;
  oldValue?: string;
  newValue?: string;
  supersededBy?: string;
  supersedes?: string;
  reason?: string;
  confidence?: number;
  pipeline?: FactChangePipeline;
  userId?: string;
  participantId?: string;
  conversationId?: string;
}

/**
 * Filter for querying change events
 */
export interface ChangeFilter {
  memorySpaceId: string;
  after?: Date;
  before?: Date;
  action?: FactChangeAction;
  limit?: number;
  offset?: number;
}

/**
 * Activity summary for a time period
 */
export interface ActivitySummary {
  timeRange: {
    hours: number;
    since: string;
    until: string;
  };
  totalEvents: number;
  actionCounts: {
    CREATE: number;
    UPDATE: number;
    SUPERSEDE: number;
    DELETE: number;
  };
  uniqueFactsModified: number;
  activeParticipants: number;
}

/**
 * Supersession chain entry
 */
export interface SupersessionChainEntry {
  factId: string;
  supersededBy: string | null;
  timestamp: number;
  reason?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FactHistoryService
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Service for managing fact change history
 *
 * @example
 * ```typescript
 * const history = new FactHistoryService(convexClient);
 *
 * // Log a change event
 * await history.log({
 *   factId: "fact-123",
 *   memorySpaceId: "space-1",
 *   action: "UPDATE",
 *   oldValue: "User likes blue",
 *   newValue: "User likes purple",
 *   reason: "User explicitly stated preference change",
 * });
 *
 * // Get history for a fact
 * const events = await history.getHistory("fact-123");
 *
 * // Get changes in a time range
 * const recentChanges = await history.getChanges({
 *   memorySpaceId: "space-1",
 *   after: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
 * });
 * ```
 */
export class FactHistoryService {
  constructor(
    private client: ConvexClient,
    private resilience?: ResilienceLayer,
  ) {}

  /**
   * Execute an operation through the resilience layer (if available)
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }

  /**
   * Log a fact change event
   *
   * @param params - Event parameters
   * @returns The created event ID
   */
  async log(params: LogEventParams): Promise<{ eventId: string }> {
    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.factHistory.logEvent, {
          factId: params.factId,
          memorySpaceId: params.memorySpaceId,
          action: params.action,
          oldValue: params.oldValue,
          newValue: params.newValue,
          supersededBy: params.supersededBy,
          supersedes: params.supersedes,
          reason: params.reason,
          confidence: params.confidence,
          pipeline: params.pipeline,
          userId: params.userId,
          participantId: params.participantId,
          conversationId: params.conversationId,
        }),
      "factHistory:log",
    );

    return result as { eventId: string };
  }

  /**
   * Get history for a specific fact
   *
   * @param factId - The fact ID to get history for
   * @param limit - Max events to return (default: 100)
   * @returns Array of change events
   */
  async getHistory(factId: string, limit?: number): Promise<FactChangeEvent[]> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.factHistory.getHistory, {
          factId,
          limit,
        }),
      "factHistory:getHistory",
    );

    return result as FactChangeEvent[];
  }

  /**
   * Get a specific change event by ID
   *
   * @param eventId - The event ID
   * @returns The event or null if not found
   */
  async getEvent(eventId: string): Promise<FactChangeEvent | null> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.factHistory.getEvent, {
          eventId,
        }),
      "factHistory:getEvent",
    );

    return result as FactChangeEvent | null;
  }

  /**
   * Get changes in a time range with filters
   *
   * @param filter - Filter parameters
   * @returns Array of change events
   */
  async getChanges(filter: ChangeFilter): Promise<FactChangeEvent[]> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.factHistory.getChangesByTimeRange, {
          memorySpaceId: filter.memorySpaceId,
          after: filter.after?.getTime(),
          before: filter.before?.getTime(),
          action: filter.action,
          limit: filter.limit,
          offset: filter.offset,
        }),
      "factHistory:getChanges",
    );

    return result as FactChangeEvent[];
  }

  /**
   * Count changes by action type
   *
   * @param memorySpaceId - Memory space to query
   * @param after - Start timestamp
   * @param before - End timestamp
   * @returns Counts by action type
   */
  async countByAction(
    memorySpaceId: string,
    after?: Date,
    before?: Date,
  ): Promise<{
    CREATE: number;
    UPDATE: number;
    SUPERSEDE: number;
    DELETE: number;
    total: number;
  }> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.factHistory.countByAction, {
          memorySpaceId,
          after: after?.getTime(),
          before: before?.getTime(),
        }),
      "factHistory:countByAction",
    );

    return result as {
      CREATE: number;
      UPDATE: number;
      SUPERSEDE: number;
      DELETE: number;
      total: number;
    };
  }

  /**
   * Get the supersession chain for a fact
   *
   * Returns the chain of facts that led to the current state,
   * showing how the knowledge evolved over time.
   *
   * @param factId - The fact ID to trace
   * @returns Array of chain entries from oldest to newest
   */
  async getSupersessionChain(
    factId: string,
  ): Promise<SupersessionChainEntry[]> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.factHistory.getSupersessionChain, {
          factId,
        }),
      "factHistory:getSupersessionChain",
    );

    return result as SupersessionChainEntry[];
  }

  /**
   * Get activity summary for a time period
   *
   * @param memorySpaceId - Memory space to query
   * @param hours - Number of hours to look back (default: 24)
   * @returns Activity summary
   */
  async getActivitySummary(
    memorySpaceId: string,
    hours?: number,
  ): Promise<ActivitySummary> {
    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.factHistory.getActivitySummary, {
          memorySpaceId,
          hours,
        }),
      "factHistory:getActivitySummary",
    );

    return result as ActivitySummary;
  }

  /**
   * Delete history for a fact (GDPR cascade)
   *
   * @param factId - The fact ID
   * @returns Number of events deleted
   */
  async deleteByFactId(factId: string): Promise<{ deleted: number }> {
    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.factHistory.deleteByFactId, {
          factId,
        }),
      "factHistory:deleteByFactId",
    );

    return result as { deleted: number };
  }

  /**
   * Delete history for a user (GDPR cascade)
   *
   * @param userId - The user ID
   * @returns Number of events deleted
   */
  async deleteByUserId(userId: string): Promise<{ deleted: number }> {
    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.factHistory.deleteByUserId, {
          userId,
        }),
      "factHistory:deleteByUserId",
    );

    return result as { deleted: number };
  }

  /**
   * Delete history for a memory space
   *
   * @param memorySpaceId - The memory space ID
   * @returns Number of events deleted
   */
  async deleteByMemorySpace(
    memorySpaceId: string,
  ): Promise<{ deleted: number }> {
    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.factHistory.deleteByMemorySpace, {
          memorySpaceId,
        }),
      "factHistory:deleteByMemorySpace",
    );

    return result as { deleted: number };
  }

  /**
   * Purge old history events (retention policy)
   *
   * @param memorySpaceId - Optional memory space filter
   * @param olderThan - Delete events before this date
   * @param limit - Max events to delete per call
   * @returns Deletion result
   */
  async purgeOldEvents(
    olderThan: Date,
    memorySpaceId?: string,
    limit?: number,
  ): Promise<{ deleted: number; remaining: number }> {
    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.factHistory.purgeOldEvents, {
          memorySpaceId,
          olderThan: olderThan.getTime(),
          limit,
        }),
      "factHistory:purgeOldEvents",
    );

    return result as { deleted: number; remaining: number };
  }
}
